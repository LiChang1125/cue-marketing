import React,{useState} from 'react';
import {directions,directionIds,recentPublication,uniqueCases,marketingLogic,isMarketingCase} from '../shared/insights.js';
import CaseCard from './CaseCard.jsx';
export default function MarketingBoard({items,sources,onOpen}){
  const [focus,setFocus]=useState(null),[limit,setLimit]=useState(12);
  const cases=uniqueCases(items.filter(i=>isMarketingCase(i)&&recentPublication(i))).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const map=directions.map(d=>({...d,count:cases.filter(i=>directionIds(i).includes(d.id)).length})).filter(d=>d.count).sort((a,b)=>b.count-a.count);
  const filtered=focus?cases.filter(i=>directionIds(i).includes(focus)):cases;
  const methods=Object.entries(filtered.reduce((m,i)=>{const label=marketingLogic(i).label;if(label!=='待补充')m[label]=(m[label]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]);
  return <section className="marketing-board" aria-label="公共营销看板"><div className="board-heading"><div><span>THE CULTURE MAP</span><h2>热点分布</h2></div><span>近 7 天 · {cases.length} 个案例</span></div>
    <div className="hotspot-map" aria-label="热点图">{map.map((d,index)=><button aria-pressed={focus===d.id} key={d.id} className={'map-tile tone-'+index%4+(focus===d.id?' active':'')} style={{flexGrow:Math.max(1,Math.sqrt(d.count))}} onClick={()=>{setFocus(focus===d.id?null:d.id);setLimit(12);}}><span>{d.name}</span><strong>{d.count}<small>个案例</small></strong><i>↗</i></button>)}</div>
    {!map.length&&<div className="quiet-empty">近期热点正在汇入</div>}
    <div className="board-reading"><span>营销思路分布</span>{methods.slice(0,6).map(([label,count])=><span className="method-chip" key={label}>{label} <b>{count}</b></span>)}</div>
    <div className="board-heading"><h2>{focus?directions.find(d=>d.id===focus)?.name:'案例与营销思路'}</h2>{focus&&<button onClick={()=>setFocus(null)}>查看全部 ×</button>}</div><div className="board-cases">{filtered.slice(0,limit).map(item=><CaseCard key={item.id} item={item} sources={sources} onOpen={onOpen} analysis/>)}</div>{filtered.length>limit&&<button className="load-more" onClick={()=>setLimit(limit+12)}>更多案例 ↓</button>}
  </section>;
}
