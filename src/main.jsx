import {apiFetch,assetUrl,previewMode,publicMode,contentNow} from './urls.js';
import OriginalLink from './OriginalLink.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {X,ExternalLink,ArrowUpRight} from 'lucide-react';
import './style.css';
import './editorial.css';
import './public-platform.css';
import Reports from './Reports.jsx';
import Curated from './Curated.jsx';
import MarketingBoard from './MarketingBoard.jsx';
import TopicExplorer,{SearchBox} from './TopicExplorer.jsx';
import PublicPulse from './PublicPulse.jsx';
import EmbeddedBrandPulse from './EmbeddedBrandPulse.jsx';
import AccessGate from './AccessGate.jsx';
import {featuredNews} from '../shared/featured.js';
import CaseCard from './CaseCard.jsx';
import Cover from './Cover.jsx';
import Hotlist from './Hotlist.jsx';
import {freshness} from './freshness.js';
import {sectors,sectorId,marketingLogic,isMarketingCase,uniqueCases} from '../shared/insights.js';

const date=t=>t?new Date(t).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}):'日期未标注';
const pages=[['discover','视野','营销、品牌与文化动态','发现潮流'],['curated','选刊','品牌与消费文化','精选'],['stats','脉动','多平台热点与关键词洞察','品牌趋势'],['board','灵感档案','热点分布与案例思路','营销看板'],['reports','晨报','品牌动态 · 联名 IP · 新消费','营销日报']];

function App(){
  const [feed,setFeed]=useState({items:[],sources:[],topics:[],hotlist:[],editorial:[]});
  const [view,setView]=useState(()=>location.hash==='#pulse'?'stats':'discover'),[query,setQuery]=useState(''),[topicId,setTopicId]=useState(null),[topicBusy,setTopicBusy]=useState(false);
  const [tab,setTab]=useState('all'),[source,setSource]=useState('all'),[period,setPeriod]=useState('7'),[limit,setLimit]=useState(18);
  const [error,setError]=useState(''),[searchError,setSearchError]=useState(''),[now,setNow]=useState(contentNow()),[loaded,setLoaded]=useState(false);
  const [selected,setSelected]=useState(null),[history,setHistory]=useState(null);
  const loading=useRef(false),dialog=useRef(null),searching=useRef(false);
  async function load(){
    if(loading.current)return;loading.current=true;
    try{const r=await apiFetch('/api/feed',{cache:'no-store',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error();const data=await r.json();data.sources=data.sources.map(s=>s.id==='brandstar'?{...s,name:'精选资讯'}:s);setFeed(data);setError('');setLoaded(true);setNow(contentNow());}
    catch{setError('连接暂时中断，正在重新连接。');}finally{loading.current=false;}
  }
  useEffect(()=>{load();const tick=()=>{if(!document.hidden)load();};const timer=setInterval(tick,10000);window.addEventListener('online',tick);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);window.removeEventListener('online',tick);document.removeEventListener('visibilitychange',tick);};},[]);
  useEffect(()=>setLimit(18),[tab,source,period]);
  useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close();},[selected]);
  useEffect(()=>{if(!selected)return;const ctl=new AbortController();setHistory(null);apiFetch('/api/items/'+encodeURIComponent(selected.id)+'/history',{signal:ctl.signal}).then(r=>r.ok?r.json():Promise.reject()).then(d=>setHistory(d.points)).catch(()=>setHistory([]));return()=>ctl.abort();},[selected?.id]);
  const activeTopic=feed.topics.find(t=>t.id===topicId);
  async function searchTopic(word){
    word=word.trim();if(word&&!previewMode&&!publicMode){setQuery(word);setView('stats');return;}if(!word||searching.current)return;searching.current=true;setTopicBusy(true);setSearchError('');
    try{const r=await apiFetch('/api/topics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:word}),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error||'搜索暂不可用');setQuery(word);setTopicId(d.id);setView('stats');await load();}
    catch(e){setSearchError(e.name==='TimeoutError'?'搜索暂时超时，请重试。':e.message);}
    finally{searching.current=false;setTopicBusy(false);}
  }
  function selectTopic(topic){setQuery(topic.query);setTopicId(topic.id);setView('stats');setSearchError('');searchTopic(topic.query);}
  function navigate(id){setView(id);setSearchError('');if(id==='discover')setQuery('');if(id==='stats'){setTopicId(null);setQuery('');}window.scrollTo({top:0});}
  function close(){setSelected(null);}
  const sourceMap=Object.fromEntries(feed.sources.map(s=>[s.id,s]));
  const fresh=item=>!error&&freshness(item.fetchedAt,sourceMap[item.source],now)==='fresh';
  const filtered=uniqueCases((source==='all'?feed.editorial||[]:feed.editorialCandidates||[]).filter(i=>(tab==='all'||sectorId(i)===tab)&&(source==='all'||i.source===source)&&(period==='all'||Date.parse(i.publishedAt||i.fetchedAt)<=now&&now-Date.parse(i.publishedAt||i.fetchedAt)<=Number(period)*86400000)));
  const [failedFeatured,setFailedFeatured]=useState([]);
  const featured=featuredNews(feed.editorial||[],now,failedFeatured);
  const coverFailed=id=>setFailedFeatured(ids=>ids.includes(id)?ids:[...ids,id]);
  const embeddedMonitor=view==='stats'&&!previewMode;
  const page=pages.find(p=>p[0]===view),logic=selected?marketingLogic(selected):null;
  return <>
    <header className="header"><div className="header-inner"><a className="logo" href={assetUrl('/')} aria-label="CUE 首页"><img className="brand-wordmark" src={assetUrl('/cue-logo.svg')} alt="CUE"/><span className="brand-descriptor">MARKETING<br/>& CULTURE</span></a><nav className="top-nav" aria-label="主导航">{pages.map(([id,name,,meaning])=><button key={id} className={view===id?'active':''} onClick={()=>navigate(id)}>{name}<span className="nav-meaning"> · {meaning}</span></button>)}</nav><div className="internal-use"><img src={assetUrl('/baidu.ico')} alt="百度" width="20" height="20"/><span><span>泛科技通用拓展二组</span><span>内部使用</span></span></div></div></header>
    <main className={embeddedMonitor?undefined:"shell"}>{previewMode&&<p className="preview-notice" role="status">内容预览 · 截至 {new Date(contentNow()).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间） · 搜索限当前内容，暂不自动更新</p>}{!embeddedMonitor&&<div className="edition-line"><span>Where brands meet culture.</span><span>{new Date(now).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'})}</span></div>}{!embeddedMonitor&&<div className="page-intro"><div><h1>{page[1]}</h1><p>{page[2]}</p></div></div>}
      {error&&<div className="error-box" role="alert">{error}<button onClick={load}>重试</button></div>}{searchError&&<div className="error-box" role="alert">{searchError}</div>}
      {view==='curated'?<Curated onOpen={setSelected}/>:view==='reports'?<Reports/>:view==='board'?<MarketingBoard items={feed.items} sources={feed.sources} onOpen={setSelected}/>:embeddedMonitor?<EmbeddedBrandPulse topic={query}/>:view==='stats'?<PublicPulse feed={feed} activeTopic={activeTopic} query={query} onQuery={setQuery} onSearch={searchTopic} onSelect={selectTopic} onOpen={setSelected} onReset={()=>{setTopicId(null);setQuery('');}} busy={topicBusy}/>:<>
        {!loaded&&!error&&<div className="quiet-empty">正在读取新闻…</div>}
        {featured.length>0&&<section className="feature-layout" aria-label="焦点新闻"><article className="feature-main"><button className="feature-cover" onClick={()=>setSelected(featured[0])} aria-label={'查看：'+featured[0].title}><Cover item={featured[0]} eager originalOnly onOriginalFailure={()=>coverFailed(featured[0].id)}/></button><div className="feature-copy"><span className="editorial-label">{sourceMap[featured[0].source]?.name}</span><button onClick={()=>setSelected(featured[0])}><h2>{featured[0].title}</h2></button><p>{date(featured[0].publishedAt)}</p><OriginalLink item={featured[0]}>阅读原文 <ArrowUpRight size={16}/></OriginalLink></div></article><div className="feature-side">{featured.slice(1).map(item=><article key={item.id}><button className="feature-thumb" onClick={()=>setSelected(item)} aria-label={'查看：'+item.title}><Cover item={item} originalOnly onOriginalFailure={()=>coverFailed(item.id)}/></button><div><span className="editorial-label">{sourceMap[item.source]?.name}</span><button onClick={()=>setSelected(item)}><h3>{item.title}</h3></button></div></article>)}</div></section>}
        <div className="content-layout"><section className="discovery"><div className="section-heading"><h2>潮流与品牌精选</h2><span className="editorial-label">{filtered.length} 条</span></div><div className="tabs" role="tablist" aria-label="内容分类">{[{id:'all',name:'全部内容'},...sectors].map(s=><button role="tab" aria-selected={tab===s.id} className={tab===s.id?'active':''} key={s.id} onClick={()=>setTab(s.id)}>{s.name}</button>)}</div><div className="filters"><select aria-label="筛选来源" value={source} onChange={e=>setSource(e.target.value)}><option value="all">所有来源</option>{feed.sources.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select><select aria-label="发布时间" value={period} onChange={e=>setPeriod(e.target.value)}><option value="7">近 7 天</option><option value="1">近 24 小时</option><option value="30">近 30 天</option><option value="all">全部内容</option></select></div><div className="card-grid">{filtered.slice(0,limit).map(item=><CaseCard key={item.id} item={item} sources={feed.sources} onOpen={setSelected}/>)}</div>{loaded&&!filtered.length&&<div className="quiet-empty">暂无符合条件的新闻</div>}{filtered.length>limit&&<button className="load-more" onClick={()=>setLimit(limit+18)}>更多新闻 ↓</button>}</section><aside className="sidebar"><Hotlist items={feed.hotlist} onOpen={setSelected} onBoard={()=>navigate('board')}/></aside></div>
      </>}
      {!embeddedMonitor&&<footer className="site-footer"><span>CUE · MARKETING & CULTURE</span><span>© {new Date(now).getFullYear()} CUE</span></footer>}
    </main>
    <dialog ref={dialog} onCancel={close} onClick={e=>{if(e.target===dialog.current)close();}}><div className="dialog-head"><span>新闻与案例</span><button aria-label="关闭弹窗" onClick={close}><X size={21}/></button></div>{selected?<div className="detail"><Cover item={selected} eager/><div className="detail-tags"><span>{sectors.find(s=>s.id===sectorId(selected))?.name}</span></div><h2>{selected.title}</h2><p className="detail-creator">{sourceMap[selected.source]?.name||selected.sourceName} · {date(selected.publishedAt)}</p>{selected.excerpt&&<p>{selected.excerpt}</p>}{logic.reason&&<section className="detail-logic"><h3>营销思路 · {logic.label}</h3><p>{logic.reason}</p><small>{logic.idea}</small></section>}{selected.evidence?.length>1&&<section className="detail-evidence"><h3>相关报道</h3>{selected.evidence.map(e=><OriginalLink key={e.id} item={e}>{sourceMap[e.source]?.name} · {e.title} ↗</OriginalLink>)}</section>}{history?.length>=2&&<details className="evidence-details"><summary>查看互动数据</summary><TrendChart points={history}/></details>}<div className="detail-actions"><OriginalLink className="primary" item={selected}>阅读原文 <ExternalLink size={16}/></OriginalLink><button className="secondary" onClick={()=>{const direction=selected.categories?.includes('ip')?'品牌联名':selected.categories?.includes('culture')?'潮玩':'品牌营销';close();searchTopic(direction);}}>搜索相关主题</button></div></div>:null}</dialog>
  </>;
}
function TrendChart({points}){
  const metric=['views','topicViews','likes'].find(m=>points.filter(p=>Number.isFinite(p[m])).length>=2);if(!metric)return null;
  const valid=points.filter(p=>Number.isFinite(p[metric])),min=Math.min(...valid.map(p=>p[metric])),max=Math.max(...valid.map(p=>p[metric])),start=Date.parse(valid[0].at),end=Date.parse(valid.at(-1).at);
  const xy=valid.map(p=>`${15+(Date.parse(p.at)-start)/Math.max(1,end-start)*570},${110-(p[metric]-min)/Math.max(1,max-min)*85}`).join(' ');
  return <div className="trend-chart"><p>{{views:'视频播放量',topicViews:'话题累计播放',likes:'点赞数'}[metric]}：{valid[0][metric].toLocaleString()} → {valid.at(-1)[metric].toLocaleString()}</p><svg viewBox="0 0 600 135" role="img" aria-label="互动数据曲线"><polyline points={xy} fill="none" stroke="#738879" strokeWidth="3"/></svg></div>;
}
createRoot(document.getElementById('root')).render(<AccessGate><App/></AccessGate>);
