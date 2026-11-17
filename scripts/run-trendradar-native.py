"""Run the complete pinned upstream application in an isolated working directory.

No upstream Python, HTML, CSS or JavaScript is rewritten. Only deployment
configuration is adapted: public sources, local storage, no AI or notifications.
"""
import os
import sys
import json
import shutil
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
analyzer.run()
report = runtime / 'output/index.html'
if not report.exists() or report.stat().st_size < 10000 or 'class="news-link"' not in report.read_text(encoding='utf-8'):
    raise RuntimeError('Native TrendRadar report was not generated')
output.mkdir(parents=True, exist_ok=True)
shutil.copy2(report, output / 'index.html')
shutil.copy2(upstream / 'LICENSE', output / 'LICENSE.txt')
(output / 'manifest.json').write_text(json.dumps({'engine':'TrendRadar','generatedAt':datetime.now(timezone.utc).isoformat(),'version':'6.11.0','revision':'86584f5544c66d4e22132f9b87c44a7ea3a32fea','platforms':cfg['platforms']['sources'],'rss':[f for f in cfg['rss']['feeds'] if f.get('enabled',True)],'report':'trendradar/index.html'},ensure_ascii=False),encoding='utf-8')
print('Native TrendRadar application report published')
