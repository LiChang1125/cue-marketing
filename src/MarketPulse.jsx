import React,{useMemo,useState} from 'react';
import {discovery} from '../shared/social-discovery.js';
import {originalHref} from '../shared/original.js';
import './market-pulse.css';

const tabs=[['brands','品牌与 IP'],['methods','营销玩法'],['partnerships','新合作']];
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
 const ig=entry.tracks.find(t=>t.last.platform==='Instagram')?.last;
 return <article className="market-card"><header><h3>{entry.name}</h3><small>{entry.platforms} 个平台 · {entry.timestamps} 天上榜</small></header>
 {entry.tracks.slice(0,2).map(t=><Track key={t.series} track={t}/>)}
 <SalesEvidence track={entry.tracks.find(t=>t.series==='蝉妈妈品牌销售榜')}/>
 <p><b>热度依据　</b>{entry.timestamps} 天内有 {entry.subjects.length} 个不同榜单条目涉及{entry.name}。{!ig&&entry.subjects.length>1?'其中包括「'+entry.subjects[1]+'」。':''}</p>
 {(!ig||story)&&<p>{story?<><b>同期动作　</b><Link href={originalHref(story)}>{story.title}</Link></>:trigger?<><b>话题起因线索　</b><Link href={trigger.url}>{trigger.title}</Link></>:<><b>关注线索　</b>{last.series.includes('销售')?'该品牌进入抖音日销售榜，成交表现值得关注。暂缺能解释销量的活动报道。':<>榜上讨论集中在「{last.title}」。具体带动因素待核实。</>}</>}</p>}
 {ig&&<p><b>社区反应　</b>{ig.author} 提及品牌的{ig.format}在来源的七天样本中排第 {ig.rank}，新增 {ig.value} 次赞评，累计 {ig.total}。<Link href={ig.url}>查看帖子</Link></p>}
 {entry.idea&&<p><b>营销观察　</b>{entry.idea}</p>}
 {!entry.idea&&<p><b>客户调研切口　</b>{ig?'可向品牌数字营销团队了解多地区内容的制作、管理和效果归因流程。':entry.tracks.some(t=>t.series.includes('销售'))?'可向品牌数字业务团队了解大促流量峰值、直播分发容量与全渠道数据分析需求。':/上线|发布|发售|游戏|赛事|夺冠|电竞/.test([last.title,trigger?.title,story?.title].join(' '))?'可向 IP 运营方了解上线或赛事期间的峰值访问、直播分发和内容审核安排。':'可从近期活动入手，核实主办方、活动规模及线上服务承载需求。'}</p>}
 <footer><Link href={last.url}>原始话题或品牌</Link> · <Link href={last.source}>榜单依据</Link></footer></article>;
}
export default function MarketPulse({feed}){
 const [tab,setTab]=useState('brands'),[more,setMore]=useState(false);
 const d=useMemo(()=>discovery(feed?.socialTrends,feed?.items,Date.now(),feed?.radar?.items),[feed]);
 const salesTrack=e=>e.tracks.find(t=>t.series==='蝉妈妈品牌销售榜');
 const leads=d.brands.filter(e=>salesTrack(e)).sort((a,b)=>salesTrack(b).last.day.localeCompare(salesTrack(a).last.day)||salesTrack(b).change-salesTrack(a).change||salesTrack(a).last.rank-salesTrack(b).last.rank);
 const overseas=d.brands.filter(e=>e.tracks.some(t=>t.last.platform==='Instagram')).sort((a,b)=>a.tracks.find(t=>t.last.platform==='Instagram').last.rank-b.tracks.find(t=>t.last.platform==='Instagram').last.rank);
 const cultural=d.brands.filter(e=>!salesTrack(e)&&!overseas.includes(e));
 const spotlight=[...new Set([leads[0],overseas[0],cultural[0],leads[1],cultural[1],...d.brands].filter(Boolean))];
 const content=tab==='brands'?spotlight:d[tab]||[],take=more?12:4;
 return <section className="market-pulse"><header><h2>本周市场动向</h2><small>{d.days[0].slice(5)} — {d.today.slice(5)}</small></header>
 <div className="market-tabs" aria-label="市场动向分类">{tabs.map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setMore(false);}}>{label}</button>)}</div>
 {tab==='partnerships'?<div className="market-stories">{content.slice(0,take).map(i=><article key={originalHref(i)}><small>{i.publisher||i.sourceName} · {i.publishedAt.slice(0,10)}</small><h3><Link href={originalHref(i)}>{i.title}</Link></h3>{i.excerpt&&<p>{i.excerpt.slice(0,125)}</p>}</article>)}</div>:<div className="market-grid">{content.slice(0,take).map(e=><Signal key={e.name} entry={e}/>)}</div>}
 {content.length===0&&<p>近七天暂无可核实的{tabs.find(t=>t[0]===tab)[1]}线索。</p>}
 {content.length>4&&<button className="market-more" onClick={()=>setMore(!more)}>{more?'收起':'展开更多'}</button>}
 {tab==='methods'&&d.instagram.length>0&&<section className="market-side"><h3>Instagram · 品牌内容形式</h3><p>{d.instagram[0].day} 的近七天品牌帖互动增量样本中，{d.instagram.length} 条上榜帖子有 {d.instagram.filter(r=>r.format==='短视频').length} 条短视频、{d.instagram.filter(r=>r.format==='照片').length} 条照片。</p>{d.instagram.slice(0,3).map(r=><p key={r.url}><Link href={r.url}>{r.entity} · {r.author} 的{r.format}</Link>　七天新增赞评 {r.value}</p>)}<small><Link href={d.instagram[0].source}>Monitor Mentions 样本与统计口径</Link></small></section>}
 {tab!=='partnerships'&&d.cases.length>0&&<section className="market-side"><h3>海外品牌创意</h3>{d.cases.slice(0,2).map(c=><p key={c.url}><Link href={c.url}>{c.title}</Link> <small> DIELINE</small></p>)}</section>}
 </section>;
}
