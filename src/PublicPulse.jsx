import CommunityEvidence from './CommunityEvidence.jsx';
import MarketPulse from './MarketPulse.jsx';
import React,{useEffect,useMemo,useState} from 'react';

import {SearchBox} from './TopicExplorer.jsx';
import Cover from './Cover.jsx';
import OriginalLink from './OriginalLink.jsx';

import {useTopicMonitor} from './useTopicMonitor.js';
import {searchRadar} from '../shared/radar.js';
import './pulse.css';
export default function PublicPulse({feed,query='',onQuery,onOpen}){
 const [draft,setDraft]=useState(query),[submitted,setSubmitted]=useState(query),[kind,setKind]=useState('all'),[source,setSource]=useState('all'),[days,setDays]=useState(30),[limit,setLimit]=useState(10);
 const recentBrands=Object.values(feed?.socialTrends?.instagramTopics||{})
   .filter(entry=>entry.items?.some(p=>Date.parse(p.day)>=Date.now()-30*86400000))
   .map(entry=>entry.items[0].entity).slice(0,6);
 const [order,setOrder]=useState('relevance');
 const searchKey=submitted+'|'+days,lookup=useTopicMonitor(submitted,days);
 const live=lookup.key===searchKey?lookup.items:null;
 const archived=(live||[]).filter(i=>i.historical).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,3);
 const items=useMemo(()=>{
   const news=[...(feed?.items||[]),...(feed?.socialTrends?.editorialCases||[])].map(i=>({...i,source:i.source||i.publisher||'editorial',sourceName:i.publisher||i.sourceName||'选刊',contentType:'article',id:i.id||i.url}));
   return [...(live||[]),...news,...(feed?.radar?.items||[])];
 },[feed,live]);
 const result=useMemo(()=>searchRadar(items,{query:submitted,kind,source,days,order}),[items,submitted,kind,source,days,order]);
 function search(word){setDraft(word);setSubmitted(word.trim());onQuery?.(word.trim());setSource('all');setLimit(10);}
 useEffect(()=>setLimit(10),[kind,source,days]);
 return <section className="cue-pulse"><SearchBox value={draft} onChange={setDraft} onSearch={search}/>
 {!submitted&&<>{recentBrands.length>0&&<div className="market-tabs pulse-brand-mentions" aria-label="近期品牌帖"><small>品牌帖观察</small>{recentBrands.map(brand=><button key={brand} onClick={()=>search(brand)}>{brand}</button>)}</div>}<MarketPulse feed={feed}/></>}
 {submitted&&<div className="cue-pulse-results">{lookup.key===searchKey&&lookup.coverage.length>0&&<details className="topic-coverage"><summary>搜索范围</summary><p>{lookup.coverage.map(s=>s.name+' · '+(s.ok?(s.count?'有匹配':'无匹配'):'暂不可用')).join('　')}</p><small>Instagram 使用公开品牌帖样本；微博、抖音、小红书使用公开榜单。</small></details>}<CommunityEvidence key={searchKey} feed={feed} query={submitted} days={days} extra={lookup.key===searchKey?lookup.community:[]} busy={lookup.key!==searchKey||lookup.running}/><MarketPulse key={submitted} feed={feed} query={submitted} live={live}/><div className="cue-pulse-content"><div className="cue-pulse-heading"><div><h2>{submitted||'值得关注'}</h2><p>{result.total} 条相关内容 · {result.sourceCount} 个来源{lookup.key===searchKey&&(lookup.running?' · 正在联网检索':lookup.ok?' · 本页每 5 分钟更新':' · 联网来源暂不可用')}{lookup.key===searchKey&&!lookup.running&&lookup.added!=null&&lookup.added>0&&<> · 本轮新见 {lookup.added} 条</>}</p></div><select aria-label="热点时间范围" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>近 7 天</option><option value={30}>近 30 天</option></select></div><div className="cue-pulse-filters"><div role="tablist" aria-label="内容类型">{[['all','全部'],['hot','热榜'],['article','报道']].map(([id,label])=><button key={id} role="tab" aria-selected={kind===id} onClick={()=>setKind(id)}>{label}</button>)}</div><select aria-label="结果排序" value={order} onChange={e=>{setOrder(e.target.value);setLimit(10);}}><option value="relevance">按相关性</option><option value="latest">按时间</option></select><select aria-label="脉动来源" value={source} onChange={e=>setSource(e.target.value)}><option value="all">所有来源</option>{result.sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="cue-pulse-grid">{result.items.slice(0,limit).map(item=><article className="cue-pulse-card" key={item.id}><button className="cue-pulse-cover" onClick={()=>onOpen({...item,excerpt:item.originalExcerpt?undefined:item.excerpt})} aria-label={'查看：'+item.title}><Cover item={item}/>{item.contentType==='hot-topic'&&item.rank>0&&<span className="cue-rank">热榜 #{item.rank}</span>}</button><div className="cue-pulse-copy"><div className="cue-pulse-meta"><span>{item.sourceName}</span>{item.publishedAt&&<time dateTime={item.publishedAt}>{item.dateBasis==='indexed'?'索引于 ':null}{new Date(item.publishedAt).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})}</time>}</div><button className="cue-pulse-title" onClick={()=>onOpen({...item,excerpt:item.originalExcerpt?undefined:item.excerpt})}>{item.title}</button>{item.excerpt&&!item.originalExcerpt&&<p>{item.excerpt}</p>}<div className="cue-pulse-card-bottom"><OriginalLink item={item}>阅读原文 ↗</OriginalLink>{item.rankTimeline?.filter(p=>Number.isFinite(p.rank)).length>1&&<RankLine item={item}/>}</div></div></article>)}</div>{!result.total&&<div className="cue-pulse-empty"><h3>近 {days} 天暂无匹配报道</h3></div>}{result.total>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+10)}>更多内容 ↓</button>}{archived.length>0&&<section className="market-side archived-cases"><h3>往期案例</h3>{archived.map(i=><p key={i.url}><small>{i.publishedAt.slice(0,10)} · {i.sourceName}　</small><OriginalLink item={i}>{i.title} ↗</OriginalLink></p>)}</section>}</div></div>}</section>;
}
function RankLine({item}){const points=item.rankTimeline.filter(p=>Number.isFinite(p.rank)),lo=Math.min(...points.map(p=>p.rank)),hi=Math.max(...points.map(p=>p.rank));return <svg className="cue-rank-line" viewBox="0 0 94 28" role="img" aria-label="热榜排名变化"><title>{points.map(p=>p.time+' 第'+p.rank+'名').join('；')}</title><polyline fill="none" stroke="#7e9470" strokeWidth="1.6" points={points.map((p,i)=>`${4+i*86/Math.max(1,points.length-1)},${4+(p.rank-lo)/Math.max(1,hi-lo)*20}`).join(' ')}/></svg>;}
