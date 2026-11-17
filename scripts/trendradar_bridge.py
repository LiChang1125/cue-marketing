"""Run the unmodified, pinned TrendRadar collector as a separate process.

Upstream: https://github.com/sansan0/TrendRadar (GPL-3.0).
Only public hotlists are enabled. No login, paid AI, or notifications.
"""
import argparse
import contextlib
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='.artifacts/trendradar-current.json')
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('trendradar_upstream_fetcher', '.tools/trendradar/trendradar/crawler/fetcher.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
fetcher = module.DataFetcher()
sources = [('weibo', '微博', 'weibo.com'), ('douyin', '抖音', 'douyin.com'), ('zhihu', '知乎', 'zhihu.com'), ('baidu', '百度', 'baidu.com'), ('bilibili-hot-search', 'B站', 'bilibili.com')]
result = {'engine': 'TrendRadar', 'revision': '86584f5544c66d4e22132f9b87c44a7ea3a32fea', 'checkedAt': datetime.now(timezone.utc).isoformat(), 'sources': [], 'items': []}
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
        result['items'].append({'title': title, 'url': item['url'], 'source': source, 'sourceName': name, 'rank': rank, 'at': at, 'observedAt': result['checkedAt']})
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'engine': result['engine'], 'sources': result['sources'], 'items': len(result['items'])}, ensure_ascii=False))
