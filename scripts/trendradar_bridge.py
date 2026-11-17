"""Run the unmodified, pinned TrendRadar collector as a separate process.

Upstream: https://github.com/sansan0/TrendRadar (GPL-3.0).
Only public hotlists are enabled. No login, paid AI, or notifications.
"""
import argparse
import contextlib
import importlib.util
import json
import sys
import hashlib
import requests
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='.artifacts/trendradar-current.json')
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('trendradar_upstream_fetcher', '.tools/trendradar/trendradar/crawler/fetcher.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
fetcher = module.DataFetcher()
sources = [('weibo', '微博', 'weibo.com'), ('douyin', '抖音', 'douyin.com'), ('zhihu', '知乎', 'zhihu.com'), ('baidu', '百度', 'baidu.com'), ('bilibili-hot-search', 'B站', 'bilibili.com'), ('ithome', 'IT之家', 'ithome.com'), ('thepaper', '澎湃新闻', 'thepaper.cn'), ('wallstreetcn-news', '华尔街见闻', 'wallstreetcn.com'), ('cls-hot', '财联社', 'cls.cn'), ('sspai', '少数派', 'sspai.com'), ('zaobao', '联合早报', 'zaobao.com')]
result = {'engine': 'TrendRadar', 'revision': '86584f5544c66d4e22132f9b87c44a7ea3a32fea', 'checkedAt': datetime.now(timezone.utc).isoformat(), 'sources': [], 'items': [], 'articles': [], 'feedHealth': []}
for source, name, domain in sources:
    with contextlib.redirect_stdout(sys.stderr):
        payload, _, _ = fetcher.fetch_data((source, name), max_retries=1)
    if not payload:
        result['sources'].append({'id': source, 'name': name, 'state': 'unavailable'})
        continue
    data = json.loads(payload)
    rows = data.get('items', [])
    invalid = fetcher._check_domain_safety(rows, domain)
    if invalid:
        result['sources'].append({'id': source, 'name': name, 'state': 'invalid-domain'})
        continue
    raw_time = data.get('updatedTime')
    at = None
    if isinstance(raw_time, (int, float)):
        try:
            at = datetime.fromtimestamp(raw_time / (1000 if raw_time > 100000000000 else 1), timezone.utc).isoformat()
        except (ValueError, OverflowError, OSError):
            pass
    result['sources'].append({'id': source, 'name': name, 'state': 'ok' if rows else 'empty', 'count': len(rows), 'at': at, 'cached': data.get('status') == 'cache'})
    for rank, item in enumerate(rows, 1):
        title = str(item.get('title') or '').strip()
        if not title or not item.get('url'):
            continue
        published = item.get('pubDate') or (item.get('extra') or {}).get('date')
        published_at = None
        if isinstance(published, (int, float)):
            try:
                published_at = datetime.fromtimestamp(published / (1000 if published > 100000000000 else 1), timezone.utc).isoformat()
            except (ValueError, OverflowError, OSError):
                pass
        result['items'].append({'title': title, 'url': item['url'], 'source': source, 'sourceName': name, 'rank': rank, 'at': at, 'publishedAt': published_at, 'observedAt': result['checkedAt']})

# The unmodified upstream RSS parser handles RSS, Atom and JSON Feed.
rss_spec = importlib.util.spec_from_file_location('trendradar_rss_parser', '.tools/trendradar/trendradar/crawler/rss/parser.py')
rss_module = importlib.util.module_from_spec(rss_spec)
sys.modules[rss_spec.name] = rss_module
rss_spec.loader.exec_module(rss_module)
feeds = json.loads(Path('config/pulse-feeds.json').read_text(encoding='utf-8-sig'))
def collect_feed(feed):
    try:
        response = requests.get(feed['url'], timeout=18, headers={'User-Agent': 'CUE/TrendRadar public RSS reader'})
        response.raise_for_status()
        parsed = rss_module.RSSParser(max_summary_length=240).parse(response.text, feed['url'])
        domain = urlparse(feed['url']).hostname.removeprefix('www.')
        articles = []
        for item in parsed[:120]:
            if fetcher._check_domain_safety([{'url': item.url}], domain):
                continue
            articles.append({'id': 'pulse-' + hashlib.sha256(item.url.encode()).hexdigest()[:18], 'title': item.title, 'url': item.url, 'publishedAt': item.published_at, 'excerpt': item.summary or '', 'source': 'pulse-' + feed.get('group', feed['id']), 'sourceName': feed['name'], 'publisher': feed['name'], 'engine': 'TrendRadar', 'origin': 'trendradar-rss', 'contentType': 'article'})
        return articles, {'id': feed['id'], 'name': feed['name'], 'state': 'ok' if articles else 'empty', 'count': len(articles)}
    except Exception as error:
        return [], {'id': feed['id'], 'name': feed['name'], 'state': 'unavailable', 'message': type(error).__name__}
with ThreadPoolExecutor(max_workers=4) as executor:
    for articles, status in executor.map(collect_feed, feeds):
        result['articles'].extend(articles)
        result['feedHealth'].append(status)
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'engine': result['engine'], 'sources': result['sources'], 'items': len(result['items']), 'articles': len(result['articles']), 'feeds': result['feedHealth']}, ensure_ascii=False))
