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
 return <article className="market-card"><header><h3>{entry.name}</h3><small>{entry.platforms} 个平台 · {entry.timestamps} 天上榜</small></header>
 {entry.tracks.slice(0,2).map(t=><Track key={t.series} track={t}/>)}
 <SalesEvidence track={entry.tracks.find(t=>t.series==='蝉妈妈品牌销售榜')}/>
 <p><b>热度依据　</b>{entry.timestamps} 天内有 {entry.subjects.length} 个不同榜单条目涉及{entry.name}。{entry.subjects.length>1?'其中包括「'+entry.subjects[1]+'」。':''}</p>
 <p>{story?<><b>同期动作　</b><Link href={originalHref(story)}>{story.title}</Link></>:trigger?<><b>话题起因线索　</b><Link href={trigger.url}>{trigger.title}</Link></>:<><b>关注线索　</b>{last.series.includes('销售')?'该品牌进入抖音日销售榜，成交表现值得关注。暂缺能解释销量的活动报道。':<>榜上讨论集中在「{last.title}」。具体带动因素待核实。</>}</>}</p>
 {entry.idea&&<p><b>可借鉴　</b>{entry.idea}</p>}
 {!entry.idea&&!story&&<p><b>销售跟进　</b>{entry.tracks.some(t=>t.series.includes('销售'))?'优先核对热销品类和当期活动，联系品牌电商团队了解下一档推广计划。':trigger?'以「'+trigger.title+'」为切口，向相关品牌确认活动档期、合作权益和目标受众。':'先确认上榜话题与品牌的关联及舆情方向，再决定是否联系市场团队。'}</p>}
 {!entry.idea&&story&&<p><b>跟进切口　</b>{/联名|联动|携手|合作/.test(story.title)?'从这次合作的联名产品、合作方和发行渠道入手，寻找下一轮推广需求。':/发布|上市|发售|上线/.test(story.title)?'围绕本次发布，核对在售产品与传播档期，再联系品牌市场团队。':'先结合这条报道核对品牌近期项目，再判断与团队客户的关联。'}</p>}
 <footer><Link href={last.url}>原始话题或品牌</Link> · <Link href={last.source}>榜单依据</Link></footer></article>;
}
export default function MarketPulse({feed}){
 const [tab,setTab]=useState('brands'),[more,setMore]=useState(false);
 const d=useMemo(()=>discovery(feed?.socialTrends,feed?.items,Date.now(),feed?.radar?.items),[feed]);
 const leads=d.brands.filter(e=>e.tracks.some(t=>t.series==='蝉妈妈品牌销售榜'));
 const spotlight=[...new Set([d.brands[0],leads[0],d.brands[1],leads[1],...d.brands].filter(Boolean))];
 const content=tab==='brands'?spotlight:d[tab]||[],take=more?12:4;
 return <section className="market-pulse"><header><h2>本周市场动向</h2><small>{d.days[0].slice(5)} — {d.today.slice(5)}</small></header>
 <div className="market-tabs" aria-label="市场动向分类">{tabs.map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setMore(false);}}>{label}</button>)}</div>
 {tab==='partnerships'?<div className="market-stories">{content.slice(0,take).map(i=><article key={originalHref(i)}><small>{i.publisher||i.sourceName} · {i.publishedAt.slice(0,10)}</small><h3><Link href={originalHref(i)}>{i.title}</Link></h3>{i.excerpt&&<p>{i.excerpt.slice(0,125)}</p>}</article>)}</div>:<div className="market-grid">{content.slice(0,take).map(e=><Signal key={e.name} entry={e}/>)}</div>}
 {content.length===0&&<p>近七天暂无可核实的{tabs.find(t=>t[0]===tab)[1]}线索。</p>}
 {content.length>4&&<button className="market-more" onClick={()=>setMore(!more)}>{more?'收起':'展开更多'}</button>}
 {tab!=='partnerships'&&d.audios.length>0&&<section className="market-side"><h3>海外短视频 · 正在增长的配乐</h3>{d.audios.slice(0,tab==='methods'?3:1).map(r=><p key={r.url}><Link href={r.url}>{r.entity}</Link>　24 小时使用增量 {r.value} · 累计 {r.total} 条</p>)}<small>{d.audios[0].day} · <Link href={d.audios[0].source}>Kabo 跟踪的配乐样本</Link></small></section>}
 {tab!=='partnerships'&&d.cases.length>0&&<section className="market-side"><h3>海外品牌创意</h3>{d.cases.slice(0,2).map(c=><p key={c.url}><Link href={c.url}>{c.title}</Link> <small> DIELINE</small></p>)}</section>}
 </section>;
}
