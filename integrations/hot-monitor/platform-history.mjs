import {platformNames,readPlatformChart} from '../../shared/platform-hot.js';

const hour = 3600000;
export async function readChartHistory(now) {
  const history = Object.fromEntries(Object.keys(platformNames).map(id=>[id,Object.create(null)]));
  const slots = Array.from({length:24},(_,i)=>now-i*hour);
  async function collect() {
    while (slots.length) {
      const stamp = slots.pop();
      const local = new Date(stamp+8*hour).toISOString();
      const url = 'https://raw.githubusercontent.com/solarhell/hot-search-crawler/main/data/'+local.slice(0,10)+'/'+local.slice(11,13)+'.json';
      try {
        const response = await fetch(url,{signal:AbortSignal.timeout(5000)});
        if (!response.ok) {await response.body?.cancel();continue;}
        const snapshot = await response.json();
        for (const id of Object.keys(platformNames)) {
          const board = readPlatformChart(snapshot,id,now);
          if (!board) continue;
          const at=Date.parse(board.observedAt);
          if(Math.floor(stamp/hour)!==Math.floor(at/hour))continue;
          for(const row of board.rows){
            if(row.value==null)continue;
            const points=history[id];
            (points[row.title]??=[]).push({at,value:row.value});
          }
        }
      } catch { /* Missing hourly editions leave a gap in the series. */ }
    }
  }
  await Promise.all(Array.from({length:5},collect));
  for(const series of Object.values(history))for(const points of Object.values(series))points.sort((a,b)=>a.at-b.at);
  return history;
}
