"""Run the complete pinned upstream application in an isolated working directory.

No upstream Python, HTML, CSS or JavaScript is rewritten. Only deployment
configuration is adapted: public sources, local storage, no AI or notifications.
"""
import os
import sys
import json
import shutil
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import yaml

root = Path(__file__).resolve().parent.parent
upstream = root / '.tools/trendradar-native'
runtime = Path(os.environ.get('TRENDRADAR_STATE_DIR', root / '.artifacts/trendradar-state')).resolve()
output = root / '.artifacts/public-data/trendradar'
runtime.mkdir(parents=True, exist_ok=True)
shutil.copytree(upstream / 'config', runtime / 'config', dirs_exist_ok=True)
cfg = yaml.safe_load((upstream / 'config/config.yaml').read_text(encoding='utf-8'))
cfg['app']['show_version_update'] = False
cfg['schedule']['enabled'] = False
cfg['report'].update(mode='current', display_mode='platform', max_news_per_keyword=0)
cfg['filter']['method'] = 'keyword'
cfg['display']['region_order'] = ['hotlist', 'rss', 'new_items', 'standalone', 'ai_analysis']
cfg['notification']['enabled'] = False
cfg['ai_analysis']['enabled'] = False
cfg['ai_translation']['enabled'] = False
cfg['storage']['backend'] = 'local'
cfg['storage']['local'].update(data_dir='output', retention_days=30)
cfg['storage']['formats'].update(html=True, txt=False)
cfg['storage']['pull']['enabled'] = False
cfg['rss']['freshness_filter']['max_age_days'] = 7
# Keep every default platform and enabled feed from the original project.
extra = [('ithome', 'IT之家', 'ithome.com'), ('wallstreetcn-news', '华尔街见闻快讯', 'wallstreetcn.com'), ('sspai', '少数派', 'sspai.com'), ('zaobao', '联合早报', 'zaobao.com')]
ids = {p['id'] for p in cfg['platforms']['sources']}
cfg['platforms']['sources'].extend(dict(id=i, name=n, expected_domain=d) for i, n, d in extra if i not in ids)
feeds = json.loads((root / 'config/pulse-feeds.json').read_text(encoding='utf-8-sig'))
urls = {f['url'] for f in cfg['rss']['feeds']}
for feed in feeds:
    if '/page/' not in feed['url'] and 'paged=' not in feed['url'] and feed['url'] not in urls:
        cfg['rss']['feeds'].append(dict(id=feed['id'], name=feed['name'], url=feed['url'], enabled=True))
        urls.add(feed['url'])
(runtime / 'config/config.yaml').write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding='utf-8')
(runtime / 'config/frequency_words.txt').write_text('# No keyword restriction: native report search filters the collected news.\n', encoding='utf-8')
sys.path.insert(0, str(upstream))
os.chdir(runtime)
os.environ['CONFIG_PATH'] = str(runtime / 'config/config.yaml')
os.environ['DOCKER_CONTAINER'] = 'true'
os.environ['AI_ANALYSIS_ENABLED'] = 'false'
os.environ['AI_TRANSLATION_ENABLED'] = 'false'
os.environ['AI_FILTER_ENABLED'] = 'false'
from trendradar.core import load_config
from trendradar.__main__ import NewsAnalyzer
config = load_config()
config['DEBUG'] = True
analyzer = NewsAnalyzer(config=config)
if '--export-only' not in sys.argv:
    analyzer.run()
report = runtime / 'output/index.html'
if not report.exists() or report.stat().st_size < 10000 or 'class="news-link"' not in report.read_text(encoding='utf-8'):
    raise RuntimeError('Native TrendRadar report was not generated')
output.mkdir(parents=True, exist_ok=True)
shutil.copy2(report, output / 'index.html')
shutil.copy2(upstream / 'LICENSE', output / 'LICENSE.txt')
from trendradar.core.analyzer import calculate_news_weight
news = analyzer.storage_manager.get_today_all_data()
rss = analyzer.storage_manager.get_rss_data()
rows = []
for source, entries in (news.items if news else {}).items():
    for item in entries:
        raw = item.to_dict()
        rows.append({'id':'radar-'+hashlib.sha256((source+item.url).encode()).hexdigest()[:20], 'title':item.title, 'url':item.url, 'source':'radar-'+source, 'sourceName':news.id_to_name.get(source,source), 'contentType':'hot-topic', 'rank':item.rank, 'rankTimeline':item.rank_timeline, 'appearances':item.count, 'nativeWeight':calculate_news_weight(raw,5,{'RANK_WEIGHT':0.6,'FREQUENCY_WEIGHT':0.3,'HOTNESS_WEIGHT':0.1}), 'observedAt':news.date+'T'+(item.last_time or item.crawl_time).replace('-',':')+':00+08:00', 'engine':'TrendRadar'})
for source, entries in (rss.items if rss else {}).items():
    for item in entries:
        published = item.published_at
        if published:
            parsed = datetime.fromisoformat(published.replace('Z','+00:00'))
            if parsed.tzinfo is None:
                published = parsed.replace(tzinfo=timezone.utc).isoformat()
        rows.append({'id':'radar-'+hashlib.sha256(item.url.encode()).hexdigest()[:20], 'title':item.title, 'excerpt':item.summary, 'url':item.url, 'source':'radar-'+source, 'sourceName':rss.id_to_name.get(source,source), 'contentType':'article', 'publishedAt':published, 'engine':'TrendRadar'})
(root / '.artifacts/trendradar-native-current.json').write_text(json.dumps({'engine':'TrendRadar','items':rows,'platforms':cfg['platforms']['sources'],'generatedAt':datetime.fromtimestamp(report.stat().st_mtime,timezone.utc).isoformat()},ensure_ascii=False),encoding='utf-8')
analyzer.ctx.cleanup()
(output / 'manifest.json').write_text(json.dumps({'engine':'TrendRadar','generatedAt':datetime.now(timezone.utc).isoformat(),'version':'6.11.0','revision':'86584f5544c66d4e22132f9b87c44a7ea3a32fea','platforms':cfg['platforms']['sources'],'rss':[f for f in cfg['rss']['feeds'] if f.get('enabled',True)],'report':'trendradar/index.html'},ensure_ascii=False),encoding='utf-8')
print('Native TrendRadar application report published')
