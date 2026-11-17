import OriginalLink from './OriginalLink.jsx';
import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import Cover from './Cover.jsx';
import {marketingLogic,sectorId,sectors} from '../shared/insights.js';
export const publishedDate=item=>item.publishedAt?new Date(item.publishedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}):item.contentType==='hot-topic'?'热榜话题':'日期未标注';
export default function CaseCard({item,sources=[],onOpen,analysis=false}){
  const logic=marketingLogic(item);
  return <article className={'case-card'+(analysis?' analysis-card':'')}>
    <button className="case-image-button" onClick={()=>onOpen(item)} aria-label={'查看：'+item.title}><Cover item={item}/></button>
    <div className="case-meta"><span>{sources.find(s=>s.id===item.source)?.name||item.sourceName||item.source}</span><span>{publishedDate(item)}</span></div>
    <button className="case-title" onClick={()=>onOpen(item)}>{item.title}</button>
    {item.excerpt&&<p className="case-excerpt">{item.excerpt}</p>}
    {analysis&&<div className="case-logic"><span>{sectors.find(s=>s.id===sectorId(item))?.name} / {logic.label}</span>{logic.reason?<><p>{logic.reason}</p><small>{logic.idea}</small></>:<p>暂无足够信息拆解营销思路。</p>}</div>}
    <OriginalLink className="case-original" item={item}>阅读原文 <ArrowUpRight size={13}/></OriginalLink>
  </article>;
}
