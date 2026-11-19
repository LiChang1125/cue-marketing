// Hacker News adapter based on liyupi/yupi-hot-monitor's server (ISC).
// Upstream revision and license notice are in public/licenses/yupi-hot-monitor.md.
export async function searchHackerNews(term, days, signal, fetcher = fetch) {
  const until = Date.now();
  const since = until - days * 86400000;
  const endpoint = new URL('https://hn.algolia.com/api/v1/search');
  endpoint.search = new URLSearchParams({
    query: term, tags: 'story', hitsPerPage: '20',
    numericFilters: 'created_at_i>=' + Math.floor(since / 1000)
  });
  const response = await fetcher(endpoint, {signal: AbortSignal.any([signal, AbortSignal.timeout(9000)])});
  if (!response.ok) throw Error('Hacker News HTTP ' + response.status);
  const {hits} = await response.json();
  if (!Array.isArray(hits)) throw Error('Missing Hacker News results');
  const posts = new Map();
  for (const hit of hits) {
    const at = Date.parse(hit.created_at);
    if (!/^\d+$/.test(hit.objectID) || !hit.title || !(at >= since && at <= until)) continue;
    if (!Number.isInteger(hit.num_comments) || !Number.isInteger(hit.points)) continue;
    const url = 'https://news.ycombinator.com/item?id=' + hit.objectID;
    posts.set(url, {platform: 'Hacker News', url, originalTitle: hit.title,
      day: hit.created_at.slice(0, 10), points: hit.points, replies: hit.num_comments});
  }
  return [...posts.values()];
}

// Compare only successful observations of the same source and search window.
export function monitorRound(previous, observations, days=30, now=Date.now()) {
  const sources = new Map(previous);
  const added = new Set();
  for (const part of observations) {
    if (!part.ok) continue;
    const before = sources.get(part.name);
    const since=new Date(now-(days-1)*86400000).toISOString().slice(0,10);
    const recent=part.community.filter(p=>!p.day||p.day>=since);
    const urls = new Set([...part.items.filter(p=>!p.historical), ...recent].map(p => p.url).filter(Boolean));
    if (before) for (const url of urls) if (!before.has(url)) added.add(url);
    const seen = new Set([...(before || []), ...urls]);
    sources.set(part.name, new Set([...seen].slice(-2000)));
  }
  return {sources, added: added.size};
}
