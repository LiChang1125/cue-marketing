import React,{useEffect,useMemo,useState} from 'react';
import TopicTrends from './TopicTrends.jsx';
import CaseCard from './CaseCard.jsx';
import {directionIds} from '../shared/insights.js';
export default function SectorCharts({group,direction,sources,onOpen}){
  const [days,setDays]=useState(7),[day,setDay]=useState(null),[source,setSource]=useState('all'),[limit,setLimit]=useState(6);
  useEffect(()=>{setDay(null);setSource('all');setLimit(6);},[group.id,direction,days]);
  const {activity,items}=useMemo(()=>{
    const now=Date.now(),DAY=86400000,today=Math.floor((now+8*3600000)/DAY)*DAY-8*3600000,start=today-(days-1)*DAY;
    const items=(group.chartItems||[]).filter(i=>Date.parse(i.publishedAt)>=start&&Date.parse(i.publishedAt)<=now&&(!direction||directionIds(i).includes(direction))).sort((a,b)=>Number(!!b.imageLocal)-Number(!!a.imageLocal)||Number(['socialbeta','brandstar'].includes(b.source))-Number(['socialbeta','brandstar'].includes(a.source))||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
    const daily=Array.from({length:days},(_,index)=>{const begin=start+index*DAY,end=begin+DAY;return{id:new Date(begin+8*3600000).toISOString().slice(0,10),start:begin,end,count:items.filter(i=>Date.parse(i.publishedAt)>=begin&&Date.parse(i.publishedAt)<end).length};});
    const distribution=Object.entries(items.reduce((map,i)=>{map[i.source]=(map[i.source]||0)+1;return map;},{})).map(([source,count])=>({source,count})).sort((a,b)=>b.count-a.count);
    return {items,activity:{daily,distribution,recentCount:items.length,cohorts:[]}};
  },[group,direction,days]);
  const selectedDay=activity.daily.find(d=>d.id===day);
  const visible=items.filter(i=>(source==='all'||i.source===source)&&(!selectedDay||Date.parse(i.publishedAt)>=selectedDay.start&&Date.parse(i.publishedAt)<selectedDay.end));
  return <section className="sector-explorer" aria-label="方向交互图表"><div className="sector-chart-toolbar"><span>案例分布 · {items.length} 条</span><div className="range-switch">{[7,30].map(n=><button key={n} className={days===n?'active':''} onClick={()=>setDays(n)}>近 {n} 天</button>)}</div></div><TopicTrends activity={activity} sources={sources} day={day} source={source} onDay={setDay} onSource={setSource}/><div className="topic-case-heading"><h3>相关案例 <small>{visible.length}</small></h3><div>{day&&<button onClick={()=>setDay(null)}>{day.slice(5)} ×</button>}{source!=='all'&&<button onClick={()=>setSource('all')}>{sources.find(s=>s.id===source)?.name} ×</button>}</div></div><div className="story-cases">{visible.slice(0,limit).map(item=><CaseCard key={item.id} item={item} sources={sources} onOpen={onOpen}/>)}</div>{!visible.length&&<p className="quiet-empty">暂无符合条件的案例</p>}{visible.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+6)}>更多案例 ↓</button>}</section>;
}
