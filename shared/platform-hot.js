export const platformNames = {douyin: '抖音', xiaohongshu: '小红书'};
export const publicHotArchive = 'https://solarhell.github.io/hot-search-crawler/latest.json';
const hosts = {douyin: 'douyin.com', xiaohongshu: 'xiaohongshu.com'};
const consumerTopic=/品牌|联名|代言|旗舰店|首店|快闪|新品|限定|零售|文创|潮玩|美妆|化妆|[妆妝]容|妆面|美甲|穿搭|服饰|珠宝|球鞋|香水|香氛|奶茶|咖啡|玩具|盲盒|围巾|户外装备|IP周边|毛绒|公仔/iu;

export function readPlatformChart(snapshot, platform, now = Date.now()) {
  if (!Object.hasOwn(hosts, platform)) return null;
  const board = snapshot?.boards?.find(b => b.platform === platform && b.ok === true);
  const stamp = Date.parse(board?.fetched_at);
  if (!Number.isFinite(stamp) || stamp > now || now - stamp > 86400000) return null;
  const rows = [], seen = new Set();
  for (const item of board.items || []) {
    if (typeof item.title !== 'string' || !item.title.trim() || !Number.isInteger(item.rank) || item.rank < 1 || seen.has(item.title)) continue;
    let url;
    try { url = new URL(item.url); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === hosts[platform] || url.hostname.endsWith('.' + hosts[platform]))) continue;
    seen.add(item.title);
    rows.push({title: item.title.trim(), rank: item.rank, url: url.href, consumer:consumerTopic.test(item.title), value: Number.isFinite(item.hot) && item.hot >= 0 ? item.hot : null});
  }
  return rows.length ? {observedAt: new Date(stamp).toISOString(), source: publicHotArchive, rows: rows.sort((a,b) => a.rank-b.rank)} : null;
}

export async function fetchPlatformCharts(signal) {
  const response = await fetch(publicHotArchive, {signal: signal || AbortSignal.timeout(8000), cache: 'no-cache', credentials:'omit'});
  if (!response.ok) throw Error('平台归档暂时不可用');
  const snapshot = await response.json();
  return Object.fromEntries(Object.keys(hosts).map(id => [id, readPlatformChart(snapshot, id)]));
}
