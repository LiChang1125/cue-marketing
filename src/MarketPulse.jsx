import React,{useMemo,useState} from 'react';
import {discovery,outlook} from '../shared/social-discovery.js';
import {originalHref} from '../shared/original.js';
import './market-pulse.css';

const tabs=[['overview','概览'],['brands','热门品牌'],['ips','热门 IP'],['instagram','Instagram'],['methods','营销趋势'],['partnerships','新合作']];
const formatValue=v=>typeof v==='number'?v.toLocaleString('zh-CN'):v;
function Link({href,children}){return <a href={href} target="_blank" rel="noreferrer">{children} ↗</a>;}
function Track({track}){
 const {points,first,last,days,change}=track;
 return <div className="market-track"><div><b>{last.series}</b> · {last.day.slice(5)} 最高第 {last.rank} 名
 {days>1&&<small>{first.day.slice(5)} 第 {first.rank} 名 → {last.day.slice(5)} 第 {last.rank} 名{change>0?'，上升 '+change+' 位':change<0?'，下降 '+(-change)+' 位':'，持平'}</small>}
 {last.value!=null&&<small>{last.unit} {formatValue(last.value)}</small>}</div>
 <div className="market-bars" aria-label={last.series+'近七天最佳位次'}>{points.map((r,i)=>r?<a key={i} href={r.source} title={r.day+' 第 '+r.rank+' 名'} aria-label={r.day+' 第 '+r.rank+' 名'} target="_blank" rel="noreferrer" style={{height:(7+32/Math.sqrt(r.rank))+'px'}}/>:<i key={i} title="无观测"/>)}</div></div>;
}
function SalesEvidence({track}){
 if(!track)return null;
 const history=track.points.filter(r=>r?.volume),latest=history.at(-1),prior=history.at(-2);
 if(!latest)return null;
 return <p><b>成交与传播　</b>{latest.day.slice(5)} 预估售出 {latest.volume} 件，关联 {latest.videos??'—'} 条视频、{latest.lives??'—'} 场直播。
 {prior&&Number.isFinite(prior.creators)&&Number.isFinite(latest.creators)?<>关联达人从 {prior.day.slice(5)} 的 {prior.creators} 位变为 {latest.creators} 位。<Link href={prior.source}>前期榜单</Link> · </>:<>关联达人 {latest.creators??'—'} 位。</>}<Link href={latest.source}>当日数据</Link></p>;
}
function Signal({entry}){
 const {story,trigger,last}=entry;
 const forecast=outlook(entry);
 const ig=entry.tracks.find(t=>t.last.platform==='Instagram')?.last;
 return <article className="market-card"><header><h3>{entry.name}</h3><small>{entry.platforms} 个平台 · {entry.timestamps} 天上榜</small></header>
 {entry.tracks.slice(0,2).map(t=><Track key={t.series} track={t}/>)}
 <SalesEvidence track={entry.tracks.find(t=>t.series==='蝉妈妈品牌销售榜')}/>
 <p><b>热度依据　</b>近七天有 {entry.subjects.length} 个不同标题涉及{entry.name}。{!ig&&entry.subjects.length>1?'其中包括「'+entry.subjects[1]+'」。':''}</p>
 {entry.controversy&&<p><b>争议讨论　</b><Link href={entry.controversy.url}>{entry.controversy.title}</Link></p>}
 {(!ig||story)&&<p>{story?<><b>相关报道　</b><Link href={originalHref(story)}>{story.title}</Link></>:trigger?<><b>话题起因线索　</b><Link href={trigger.url}>{trigger.title}</Link></>:<><b>关注线索　</b>{last.series.includes('销售')?'该品牌进入抖音日销售榜。具体活动对成交的贡献待核实。':<>榜上讨论集中在「{last.title}」。具体带动因素待核实。</>}</>}</p>}
 {ig&&<p><b>社区反应　</b>{ig.author} 的{ig.format}{entry.campaignTag?'带有活动标签 '+entry.campaignTag:'提及了该品牌'}，在 <Link href={ig.source}>Monitor Mentions</Link> 七天互动增量样本中排第 {ig.rank}，新增 {ig.value} 次赞评，累计 {ig.total}。<Link href={ig.url}>查看帖子</Link></p>}
 <p className="market-outlook"><b>未来七天 · {forecast.trend}</b><small>{forecast.basis}</small></p>
 <footer><Link href={last.url}>原始话题或品牌</Link> · <Link href={last.source}>榜单依据</Link></footer></article>;
}
export default function MarketPulse({feed,query='',live}){
 const [tab,setTab]=useState('overview'),[more,setMore]=useState(false);
 const d=useMemo(()=>discovery(feed?.socialTrends,[...(live||[]),...(feed?.items||[])],Date.now(),feed?.radar?.items,query),[feed,live,query]);
 const salesTrack=e=>e.tracks.find(t=>t.series==='蝉妈妈品牌销售榜');
 const leads=d.brands.filter(e=>salesTrack(e)).sort((a,b)=>salesTrack(b).last.day.localeCompare(salesTrack(a).last.day)||salesTrack(b).change-salesTrack(a).change||salesTrack(a).last.rank-salesTrack(b).last.rank);
 const overseas=d.brands.filter(e=>e.tracks.some(t=>t.last.platform==='Instagram')).sort((a,b)=>a.tracks.find(t=>t.last.platform==='Instagram').last.rank-b.tracks.find(t=>t.last.platform==='Instagram').last.rank);
 const ips=d.brands.filter(e=>e.isIP);
 const brandList=d.brands.filter(e=>!e.isIP);
 const spotlight=[...new Set([leads[0],overseas[0],ips[0],ips[1],...d.brands].filter(Boolean))];
 const content=tab==='overview'?spotlight:tab==='ips'?ips:tab==='brands'?brandList:tab==='instagram'?overseas:tab==='methods'?d.methods:d.partnerships;
 const take=more?content.length:4;
 if(query&&!d.brands.length&&!d.methods.length&&!d.partnerships.length)return null;
 return <section className="market-pulse"><header><h2>{query?'主题动向':'本周品牌与 IP'}</h2><small>{d.days[0].slice(5)} — {d.today.slice(5)}</small></header>
 <div className="market-tabs" aria-label="市场动向分类">{tabs.map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setMore(false);}}>{label}</button>)}</div>
 {tab==='methods'?<div className="market-stories">{content.slice(0,take).map(m=><article key={m.name}><small>近七天 · {m.stories.length} 篇相关报道{m.previous!==null&&<> · 前七天 {m.previous} 篇</>}</small><h3>{m.name}</h3>{m.stories.slice(0,2).map(i=><p key={originalHref(i)}><Link href={originalHref(i)}>{i.title}</Link></p>)}</article>)}</div>:tab==='partnerships'?<div className="market-stories">{content.slice(0,take).map(i=><article key={originalHref(i)}><small>{i.publisher||i.sourceName} · {i.publishedAt.slice(0,10)}</small><h3><Link href={originalHref(i)}>{i.title}</Link></h3>{i.excerpt&&<p>{i.excerpt.slice(0,125)}</p>}</article>)}</div>:<div className="market-grid">{content.slice(0,take).map(e=><Signal key={e.name} entry={e}/>)}</div>}
 {content.length===0&&<p>近七天暂无可核实的{tabs.find(t=>t[0]===tab)[1]}线索。</p>}
 {content.length>4&&<button className="market-more" onClick={()=>setMore(!more)}>{more?'收起':'展开更多'}</button>}
 </section>;
}
