import React,{useState} from 'react';
import {sectors,sectorId,isMarketingCase,uniqueCases} from '../shared/insights.js';
import CaseCard from './CaseCard.jsx';
import AttentionPanel from './AttentionPanel.jsx';
export default function TrendOverview({items=[],sources=[],onOpen}){
  const [sector,setSector]=useState('brand');
  const cases=uniqueCases(items.filter(i=>!i.historical&&isMarketingCase(i)&&sectorId(i)===sector&&(i.publishedAt?Date.parse(i.publishedAt)>=Date.now()-7*86400000:Date.parse(i.fetchedAt)>=Date.now()-86400000)&&i.contentType!=='topic'&&!Number.isFinite(i.metrics?.topicViews))).sort((a,b)=>Number(!!b.imageLocal)-Number(!!a.imageLocal));
  return <section className="trend-overview" aria-label="营销方向趋势"><div className="pulse-sectors">{sectors.map(s=><button key={s.id} className={s.id===sector?'active':''} onClick={()=>setSector(s.id)}>{s.name}</button>)}</div><AttentionPanel sector={sector}/><div className="topic-case-heading"><h3>近期案例</h3></div><div className="topic-case-grid">{cases.slice(0,6).map(i=><CaseCard key={i.id} item={i} sources={sources} onOpen={onOpen}/>)}</div>{!cases.length&&<p className="quiet-empty">暂无近期案例</p>}</section>;
}
