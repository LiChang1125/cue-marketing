import React,{useEffect,useState} from 'react';
import './attention.css';
const num=n=>new Intl.NumberFormat('zh-CN').format(n);
const stamp=t=>new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
export default function AttentionPanel({query='',sector=null}){
  const [data,setData]=useState(null),[error,setError]=useState(false),[days,setDays]=useState(7),[source,setSource]=useState('xiaohongshu'),[metric,setMetric]=useState('comments'),[chart,setChart]=useState('line'),[focus,setFocus]=useState(null);
  useEffect(()=>{let alive=true,busy=false;const ctl=new AbortController();setData(null);setFocus(null);setError(false);
    async function read(){if(busy)return;busy=true;try{const r=await fetch('/api/attention?'+new URLSearchParams({query,sector:sector||'',days}),{signal:AbortSignal.any([ctl.signal,AbortSignal.timeout(8000)]),cache:'no-store'});if(!r.ok)throw Error();const next=await r.json();if(alive){setData(next);setError(false);}}catch(e){if(alive&&e.name!=='AbortError')setError(true);}finally{busy=false;}}
    read();const timer=setInterval(read,15000);return()=>{alive=false;ctl.abort();clearInterval(timer);};
  },[query,sector,days]);
  const platform=data?.platforms.find(p=>p.source===source)||data?.platforms[0];
  const selected=platform?.series.find(s=>s.metric===metric)||platform?.series[0];
  const points=selected?.points||[],point=points.find(p=>p.at===focus)||points.at(-1);
  const min=chart==='bar'?0:Math.min(...points.map(p=>p.value)),max=Math.max(1,...points.map(p=>p.value)),span=Math.max(1,max-min),duration=points.length>1?Date.parse(points.at(-1).at)-Date.parse(points[0].at):0,x=i=>!duration?500:40+(Date.parse(points[i].at)-Date.parse(points[0].at))/duration*920,y=p=>150-(p.value-min)/span*120;
  return <section className="attention-panel" aria-label="平台关注趋势"><div className="attention-top"><h3>关注脉动</h3><div className="range-switch">{[7,30].map(n=><button key={n} className={days===n?'active':''} onClick={()=>setDays(n)}>近 {n} 天</button>)}</div></div>
    {error&&<p role="status" className="attention-note">连接暂时中断{data?' · 显示上次结果':''}</p>}
    {!data?<p className="quiet-empty">{error?'趋势数据暂不可用':'正在读取平台数据…'}</p>:!platform?<p className="quiet-empty">暂无可核实的平台互动数据</p>:<>
      <div className="attention-platforms" aria-label="趋势平台">{data.platforms.map(p=><button key={p.source} aria-pressed={platform.source===p.source} className={platform.source===p.source?'active':''} onClick={()=>{setSource(p.source);setFocus(null);}}>{p.name}</button>)}</div>
      <div className="attention-metrics" aria-label="互动指标">{platform.series.map(s=><button key={s.metric} className={selected.metric===s.metric?'active':''} onClick={()=>{setMetric(s.metric);setFocus(null);}}><span>{s.label}</span><strong>{num(s.value)}</strong></button>)}</div>
      <div className="attention-caption"><span>{selected.scope}{selected.metric!=='topicViews'?` · ${selected.sampleSize} 篇`:''}{selected.stale?' · 暂未更新':''}</span><span>{selected.delta!==null?`${selected.delta>=0?'+':''}${num(selected.delta)} ${selected.label}`:'暂无可比较的历史数据'}</span></div>
      <div className="chart-heading"><span aria-live="polite">{point?`${stamp(point.at)} · ${num(point.value)} ${selected.label}`:''}</span><div className="chart-switch"><button className={chart==='line'?'active':''} onClick={()=>setChart('line')}>折线</button><button className={chart==='bar'?'active':''} onClick={()=>setChart('bar')}>柱状</button></div></div>
      <svg className="attention-chart" viewBox="0 0 1000 180" role="img" aria-label={`${platform.name}${selected.label}变化，${points.length}个数据点`}><path d="M40 30H960 M40 90H960 M40 150H960" stroke="#e8eae6" fill="none"/>
        <text x="40" y="20" fill="#7b857f" fontSize="12">{num(max)}</text><text x="40" y="170" fill="#7b857f" fontSize="12">{num(min)}</text>
        {chart==='line'&&points.length>1&&<polyline points={points.map((p,i)=>`${x(i)},${y(p)}`).join(' ')} fill="none" stroke="#738d82" strokeWidth="3"/>}
        {points.map((p,i)=><g key={p.at} tabIndex="0" role="button" aria-label={`${stamp(p.at)}，${num(p.value)}${selected.label}`} onFocus={()=>setFocus(p.at)} onMouseEnter={()=>setFocus(p.at)} onClick={()=>setFocus(p.at)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFocus(p.at);}}}><title>{stamp(p.at)} · {num(p.value)}</title><rect x={x(i)-Math.min(20,400/points.length)} y="15" width={Math.min(40,800/points.length)} height="145" fill="transparent"/>{chart==='bar'?<rect x={x(i)-Math.min(15,350/points.length)} y={y(p)} width={Math.min(30,700/points.length)} height={150-y(p)} fill="#8c9d94"/>:<circle cx={x(i)} cy={y(p)} r={focus===p.at?6:4} fill="#597568"/>}</g>)}
      </svg><div className="attention-axis"><span>{points[0]?stamp(points[0].at):''}</span><span>{points.length>1?stamp(points.at(-1).at):''}</span></div>
      <details className="attention-evidence"><summary>相关内容与数据</summary>{selected.items.slice(0,12).map(i=><a key={i.id} href={i.url} target="_blank" rel="noreferrer"><span>{i.title}</span><b>{num(i.value)} {selected.label} ↗</b></a>)}</details>
    </>}
  </section>;
}
