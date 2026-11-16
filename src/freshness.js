// Collection freshness is independent from the original publication date.
export function cadence(source) { return source?.setup ? 15 * 60 : 5 * 60; }
export function freshness(at, source, now = Date.now()) {
  const time = Date.parse(at);
  if (!Number.isFinite(time) || time > now + 60000) return 'unknown';
  if (source?.state !== 'ok') return 'unavailable';
  return now - time <= (cadence(source) + 60) * 1000 ? 'fresh' : 'stale';
}
export function age(at, now = Date.now()) {
  const elapsed = now - (typeof at==='number'?at:Date.parse(at));
  if (!Number.isFinite(elapsed) || elapsed < -60000) return '时间待核实';
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  return minutes < 1 ? '刚刚' : minutes < 60 ? `${minutes} 分钟前` : minutes < 1440 ? `${Math.floor(minutes / 60)} 小时前` : `${Math.floor(minutes / 1440)} 天前`;
}
