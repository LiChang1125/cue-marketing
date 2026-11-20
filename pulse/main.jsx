import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,Link,Navigate,NavLink,useLocation,useNavigate} from 'react-router';
import {Flame,Zap,ChartColumn,CalendarDays,Plug} from 'lucide-react';
import BrandCases from '../integrations/aihot/overlay/apps/web/app/components/BrandCases';
import BrandTools from '../integrations/aihot/overlay/apps/web/app/routes/brand-tools';
import {useBrandData} from './use-data';

const filters=[['all','全部'],['firstParty','一手'],['collab','IP 联名'],['campaign','营销现场'],['launch','新品与零售'],['culture','消费文化'],['industry','品牌动向'],['opinion','市场观察']];
function NewsFeed({params}){
 const {data,failed,retry}=useBrandData('/api/brand-pulse/latest');
 const selected=params.get('channel')==='firstParty'?'firstParty':params.get('category')||'all';
 const base='/featured';
 const href=k=>base+(k==='all'?'':k==='firstParty'?'?channel=firstParty':'?category='+k);
 const rows=(data?.items||[]).filter(r=>r.featured&&(selected==='all'||(selected==='firstParty'?r.role==='official':r.category===selected)));
 const [visible,setVisible]=useState(24);useEffect(()=>setVisible(24),[selected]);
 return <section><h1 className="mb-3 text-2xl font-bold">精选</h1>
 <nav aria-label="报道分类" className="mb-4 flex flex-wrap gap-2">{filters.map(([key,label])=><Link key={key} to={href(key)} aria-current={key===selected?'page':undefined} className={'rounded-full px-3 py-2 text-sm '+(key===selected?'bg-ink text-bg':'bg-well text-ink')}>{label}</Link>)}</nav>
 {failed?<button onClick={retry}>重新读取报道</button>:!data?<p role="status">正在读取报道…</p>:!rows.length?<p>近 30 天暂无本栏报道。</p>:<><small>{rows.length} 篇报道</small>{rows.slice(0,visible).map(r=><article key={r.url} className="border-t border-line-soft py-3"><small>{r.publisher} · {r.publishedAt.slice(0,10)}</small><h2 className="font-semibold"><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a></h2></article>)}{rows.length>visible&&<button onClick={()=>setVisible(n=>n+24)}>更多报道</button>}</>}</section>;
}
function Edition(){
  const here=useLocation(),go=useNavigate(),q=new URLSearchParams(here.search).get('q')||'';
  const [term,setTerm]=useState(q);
  useEffect(()=>setTerm(q),[q]);
  const params=new URLSearchParams(here.search);
  const groups=[['阅读',[['/hot','热点榜',Flame],['/featured','精选',Zap]]],['品牌工具',[['/brand-lab/ranking','品牌榜',ChartColumn],['/brand-lab/calendar','营销日历',CalendarDays]]]];
  const hot=(here.pathname==='/'||here.pathname==='/hot')&&!params.has('category')&&!params.has('channel')&&!q;
  if(here.pathname==='/all')return <Navigate replace to={(q?'/search':'/featured')+here.search}/>;
  return <div className="edition"><aside className="reader-rail"><div className="rail-inner"><a href="#/hot" className="rail-brand" aria-label="CUE 热点榜"><img src="../cue-logo.svg" alt="CUE"/></a><nav aria-label="脉动栏目">{groups.map(([name,links])=><section key={name}><p>{name}</p>{links.map(([path,label,Icon])=><NavLink key={path} to={path} end className={({isActive})=>isActive||(path==='/hot'&&hot)?'active':''}><Icon size={18} aria-hidden="true"/>{label}</NavLink>)}</section>)}<section><p>更多</p><a href="../agent/"><Plug size={18}/>Agent 接入</a></section></nav></div></aside><main>
  <form role="search" onSubmit={e=>{e.preventDefault();go(term.trim()?'/search?q='+encodeURIComponent(term.trim()):'/featured');}}><input aria-label="搜索品牌、IP 或主题" placeholder="搜索品牌、IP 或主题" type="search" value={term} onChange={e=>setTerm(e.target.value)} maxLength={100}/><button>搜索</button></form>
  {here.pathname.startsWith('/brand-lab/')?<BrandTools/>:hot?<BrandCases/>:q?<BrandCases key={q} query={q}/>:<NewsFeed params={params}/>}
  </main></div>;
}
createRoot(document.getElementById('root')).render(<HashRouter><Edition/></HashRouter>);
