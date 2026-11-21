export type PlatformChartData = {
  observedAt: string;
  source: string;
  rows: {title:string; url:string; rank:number; consumer:boolean; value:number|null}[];
};
const number = new Intl.NumberFormat('zh-CN');
const platforms = {
  '抖音': [['抖音指数','https://trendinsight.oceanengine.com/'],['巨量创意','https://cc.oceanengine.com/inspiration/douyin/content']],
  '小红书': [['灵犀','https://idea.xiaohongshu.com/'],['聚光','https://ad.xiaohongshu.com/'],['创作中心','https://creator.xiaohongshu.com/']]
};
export type ChartHistory = Record<string,{at:number;value:number}[]>;
function History({points,at,value}:{points:ChartHistory[string];at:number;value:number|null}){
  const hour=3600000,series=points.filter(p=>p.at>at-24*hour&&p.at<at);
  if(value!=null)series.push({at,value});
  if(series.length<2)return null;
  const low=Math.min(...series.map(p=>p.value)),high=Math.max(...series.map(p=>p.value));
  const coords=series.map(p=>[100*(1-(at-p.at)/(24*hour)),high===low?12:22-20*(p.value-low)/(high-low)]);
  return <svg viewBox="0 0 102 24" className="platform-curve" role="img" aria-label={'近24小时平台热度，'+series.length+'次观测'}>
    {coords.map(([x,y],i)=><g key={series[i]!.at}>{i>0&&series[i]!.at-series[i-1]!.at<=1.5*hour&&<line x1={coords[i-1]![0]} y1={coords[i-1]![1]} x2={x} y2={y} stroke="currentColor"/>}<circle cx={x} cy={y} r="1.2" fill="currentColor"><title>{new Date(series[i]!.at).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit'})} · {number.format(series[i]!.value)}</title></circle></g>)}
  </svg>;
}
export default function PlatformChart({name,chart,history={}}:{name:string; chart?:PlatformChartData|null;history?:ChartHistory}) {
  const picked=(chart?.rows||[]).filter(row=>row.consumer);
  const curve=(row:PlatformChartData['rows'][number])=><History points={Object.hasOwn(history,row.title)?history[row.title]!:[]} at={Date.parse(chart!.observedAt)} value={row.value}/>;
  const list=(rows:PlatformChartData['rows'])=><ol>{rows.map(row=><li key={row.title}><span>{row.rank}</span><a href={row.url} target="_blank" rel="noreferrer">{row.title}</a>
    <div className="platform-metric">{curve(row)}<span>{row.value==null?'—':number.format(row.value)}</span></div></li>)}</ol>;
  return <section className="platform-chart card" aria-label={name+'公开热词'}>
    <div className="platform-chart-head"><h2>平台公开热词</h2>
      {chart&&<a href={chart.source} target="_blank" rel="noreferrer">公开榜单归档 ↗</a>}
    </div>
    {!chart?<p role="status">暂未取得最近一期平台榜单。</p>:<>
      <div className="platform-chart-caption"><span>{name}原榜名次</span><span>平台热度</span></div>
      {picked.length?<><div className="platform-podium">{picked.slice(0,3).map(row=><article className="card" key={row.title}>
        <small>原榜 NO.{String(row.rank).padStart(2,'0')}</small><h3><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a></h3>
        <div className="platform-metric">{curve(row)}<strong>{row.value==null?'—':number.format(row.value)}</strong></div>
      </article>)}</div>{picked.length>3&&list(picked.slice(3))}</>:<p>本期原榜暂未出现可识别的消费营销词条。</p>}
      <details><summary>查看完整原榜 · {chart.rows.length} 个热词</summary>{list(chart.rows)}</details>
    </>}
    <footer className="platform-tools">{platforms[name as keyof typeof platforms]?.map(([label,url])=><a key={url} href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}</footer>
  </section>;
}
