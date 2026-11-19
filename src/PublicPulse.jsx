import MarketPulse from './MarketPulse.jsx';
import React,{useEffect,useMemo,useState} from 'react';

import {SearchBox} from './TopicExplorer.jsx';
import Cover from './Cover.jsx';
import OriginalLink from './OriginalLink.jsx';

import {searchLiveTopic} from './live-topic.js';
import {searchRadar} from '../shared/radar.js';
import './pulse.css';
export default function PublicPulse({feed,query='',onQuery,onOpen}){
 const [draft,setDraft]=useState(query),[submitted,setSubmitted]=useState(query),[kind,setKind]=useState('all'),[source,setSource]=useState('all'),[days,setDays]=useState(30),[limit,setLimit]=useState(10);
 const [lookup,setLookup]=useState({key:'',items:[],done:0,ok:0,running:false});
 const searchKey=submitted+'|'+days;
 useEffect(()=>{
   if(!submitted)return;
   const ctl=new AbortController();
   setLookup({key:searchKey,items:[],done:0,ok:0,running:true});
   searchLiveTopic(submitted,days,ctl.signal,(_source,rows,ok)=>{
     if(!ctl.signal.aborted)setLookup(prev=>({...prev,items:[...prev.items,...rows],done:prev.done+1,ok:prev.ok+Number(ok)}));
   }).finally(()=>{if(!ctl.signal.aborted)setLookup(prev=>({...prev,running:false}));});
   return()=>ctl.abort();
 },[submitted,days,searchKey]);
 const live=lookup.key===searchKey?lookup.items:null;
 const items=useMemo(()=>{
   const news=[...(feed?.items||[]),...(feed?.socialTrends?.editorialCases||[])].map(i=>({...i,source:i.source||i.publisher||'editorial',sourceName:i.publisher||i.sourceName||'选刊',contentType:'article',id:i.id||i.url}));
   return [...(live||[]),...news,...(feed?.radar?.items||[])];
 },[feed,live]);
 const result=useMemo(()=>searchRadar(items,{query:submitted,kind,source,days}),[items,submitted,kind,source,days]);
 function search(word){setDraft(word);setSubmitted(word.trim());onQuery?.(word.trim());setSource('all');setLimit(10);}
 useEffect(()=>setLimit(10),[kind,source,days]);
 return <section className="cue-pulse">{!submitted&&<MarketPulse feed={feed}/>}<SearchBox value={draft} onChange={setDraft} onSearch={search}/>{submitted&&<div className="cue-pulse-results"><MarketPulse key={submitted} feed={feed} query={submitted} live={live}/><div className="cue-pulse-content"><div className="cue-pulse-heading"><div><h2>{submitted||'值得关注'}</h2><p>{result.total} 条相关内容 · {result.sourceCount} 个来源{lookup.key===searchKey&&(lookup.running?' · 正在联网检索':lookup.ok?' · 已完成联网检索':' · 联网来源暂不可用')}</p></div><select aria-label="热点时间范围" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>近 7 天</option><option value={30}>近 30 天</option></select></div><div className="cue-pulse-filters"><div role="tablist" aria-label="内容类型">{[['all','全部'],['hot','热榜'],['article','报道']].map(([id,label])=><button key={id} role="tab" aria-selected={kind===id} onClick={()=>setKind(id)}>{label}</button>)}</div><select aria-label="脉动来源" value={source} onChange={e=>setSource(e.target.value)}><option value="all">所有来源</option>{result.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="cue-pulse-grid">{result.items.slice(0,limit).map(item=><article className="cue-pulse-card" key={item.id}><button className="cue-pulse-cover" onClick={()=>onOpen({...item,excerpt:item.originalExcerpt?undefined:item.excerpt})} aria-label={'查看：'+item.title}><Cover item={item}/>{item.contentType==='hot-topic'&&item.rank>0&&<span className="cue-rank">热榜 #{item.rank}</span>}</button><div className="cue-pulse-copy"><div className="cue-pulse-meta"><span>{item.sourceName}</span>{item.publishedAt&&<time dateTime={item.publishedAt}>{item.dateBasis==='indexed'?'索引于 ':null}{new Date(item.publishedAt).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})}</time>}</div><button className="cue-pulse-title" onClick={()=>onOpen({...item,excerpt:item.originalExcerpt?undefined:item.excerpt})}>{item.title}</button>{item.excerpt&&!item.originalExcerpt&&<p>{item.excerpt}</p>}<div className="cue-pulse-card-bottom"><OriginalLink item={item}>阅读原文 ↗</OriginalLink>{item.rankTimeline?.filter(p=>Number.isFinite(p.rank)).length>1&&<RankLine item={item}/>}</div></div></article>)}</div>{!result.total&&<div className="cue-pulse-empty"><h3>暂无匹配内容</h3></div>}{result.total>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+10)}>更多内容 ↓</button>}</div></div>}</section>;
}
function RankLine({item}){const points=item.rankTimeline.filter(p=>Number.isFinite(p.rank)),lo=Math.min(...points.map(p=>p.rank)),hi=Math.max(...points.map(p=>p.rank));return <svg className="cue-rank-line" viewBox="0 0 94 28" role="img" aria-label="热榜排名变化"><title>{points.map(p=>p.time+' 第'+p.rank+'名').join('；')}</title><polyline fill="none" stroke="#7e9470" strokeWidth="1.6" points={points.map((p,i)=>`${4+i*86/Math.max(1,points.length-1)},${4+(p.rank-lo)/Math.max(1,hi-lo)*20}`).join(' ')}/></svg>;}
