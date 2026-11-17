"""Run pinned, unmodified TrendRadar keyword analysis and native RSS report renderer."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path('.tools/trendradar').resolve()))
from trendradar.core.analyzer import count_rss_frequency
from trendradar.report.generator import prepare_report_data
from trendradar.report.rss_html import render_rss_html_content

parser = argparse.ArgumentParser()
parser.add_argument('--input', default='.artifacts/report-selections.json')
parser.add_argument('--output', default='.artifacts/public-data/research')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
selections = json.loads(Path(args.input).read_text(encoding='utf-8-sig'))
for report in selections:
    rows = [{'title': i['title'], 'feed_id': i['source'], 'feed_name': i.get('publisher', i['source']), 'url': i.get('originalUrl') or i['url'], 'published_at': i['publishedAt'], 'summary': i.get('excerpt', '')} for i in report['articles']]
    # The input is already the ten quality-ranked topic matches, so the upstream
    # all-RSS group preserves Chinese translations and original English keywords.
    stats, total = count_rss_frequency(rows, [], [], max_news_per_keyword=10, quiet=True)
    prepared = prepare_report_data(stats, mode='current', show_new_section=False)
    report['trendradar'] = {'revision': '86584f5544c66d4e22132f9b87c44a7ea3a32fea', 'total': total, 'report': prepared}
    (output / (report['key'] + '.html')).write_text(render_rss_html_content(rows, len(rows)), encoding='utf-8')
    (output / (report['key'] + '.json')).write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'nativeTrendRadarReports': len(selections)}))
