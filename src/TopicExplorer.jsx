import React,{useEffect,useState} from 'react';
import {Search,ArrowUpRight} from 'lucide-react';
import {isMarketingCase,topicMatches,uniqueCases} from '../shared/insights.js';
import CaseCard from './CaseCard.jsx';
import TrendOverview from './TrendOverview.jsx';
import AttentionPanel from './AttentionPanel.jsx';
export function SearchBox({value,onChange,onSearch,busy=false,suggestions=true}){return <section className="search-zone"><form className="search-box unified-search" onSubmit={e=>{e.preventDefault();onSearch(value);}}><Search size={21}/><input aria-label="搜索主题" maxLength={40} placeholder="搜索香水、亚文化、品牌或 IP…" value={value} onChange={e=>onChange(e.target.value)}/><button className="search-submit" disabled={busy||!value.trim()}>{busy?'搜索中…':'搜索'} <ArrowUpRight size={14}/></button></form>{suggestions&&<div className="quick-topics"><span>热门方向</span>{['香水','亚文化','品牌联名','潮玩','快闪'].map(word=><button disabled={busy} key={word} onClick={()=>onSearch(word)}>{word}</button>)}</div>}</section>;}

export default function TopicExplorer({feed,activeTopic,query,onQuery,onSearch,onSelect,onOpen,onReset,busy}){
  const [limit,setLimit]=useState(6);
  useEffect(()=>setLimit(6),[activeTopic?.id]);
  const now=Date.now();
  const items=activeTopic?uniqueCases(feed.items.filter(i=>!i.historical&&topicMatches(i,activeTopic.query)&&i.contentType!=='topic'&&!Number.isFinite(i.metrics?.topicViews)&&(i.publishedAt?Date.parse(i.publishedAt)>=now-7*86400000&&Date.parse(i.publishedAt)<=now:Date.parse(i.fetchedAt)>=now-86400000))).sort((a,b)=>Number(isMarketingCase(b))-Number(isMarketingCase(a))):[];
  const searching=['queued','running'].includes(activeTopic?.state);
  return <section className="topic-explorer"><SearchBox value={query} onChange={onQuery} onSearch={onSearch} busy={busy} suggestions={false}/>
    <div className="public-topics" aria-label="主题目录"><button className={!activeTopic?'active':''} onClick={onReset}>全部趋势</button>{feed.topics?.map(t=><button className={activeTopic?.id===t.id?'active':''} key={t.id} onClick={()=>onSelect(t)}>{t.query}</button>)}</div>
    {activeTopic?<><div className="topic-result-heading"><div><span>TOPIC / CULTURAL PULSE</span><h2>{activeTopic.query}</h2>{searching&&<p role="status">正在搜索相关动态…</p>}</div></div>
      <AttentionPanel query={activeTopic.query}/><div className="topic-case-heading"><h3>相关动态</h3></div>
      <div className="topic-case-grid">{items.slice(0,limit).map(i=><CaseCard key={i.id} item={i} sources={feed.sources} onOpen={onOpen}/>)}</div>
      {!items.length&&<div className="quiet-empty">{searching?'正在查找相关内容…':'暂无近期相关内容'}</div>}{items.length>limit&&<button className="load-more" onClick={()=>setLimit(limit+6)}>更多结果 ↓</button>}
    </>:<TrendOverview items={feed.items} sources={feed.sources} onOpen={onOpen}/>}
  </section>;
}
