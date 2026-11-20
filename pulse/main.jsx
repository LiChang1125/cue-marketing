import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,NavLink,useLocation,useNavigate} from 'react-router';
import {Flame,Zap,List,ChartColumn,CalendarDays,Plug} from 'lucide-react';
import BrandCases from '../integrations/aihot/overlay/apps/web/app/components/BrandCases';
import BrandTools from '../integrations/aihot/overlay/apps/web/app/routes/brand-tools';
import {useBrandData} from './use-data';

function Edition(){
  const here=useLocation(),go=useNavigate(),q=new URLSearchParams(here.search).get('q')||'';
  const [term,setTerm]=useState(q);
  useEffect(()=>setTerm(q),[q]);
  const stories=useBrandData('/api/brand-pulse/latest');
  const groups=[['阅读',[['/hot','热点榜',Flame],['/featured','精选',Zap],['/all','全部品牌动态',List]]],['品牌工具',[['/brand-lab/ranking','品牌榜',ChartColumn],['/brand-lab/calendar','营销日历',CalendarDays]]]];
  const hot=here.pathname==='/'||here.pathname==='/hot';
  return <div className="edition"><aside className="reader-rail"><div className="rail-inner"><a href="#/hot" className="rail-brand" aria-label="CUE 热点榜"><img src="../cue-logo.svg" alt="CUE"/></a><nav aria-label="脉动栏目">{groups.map(([name,links])=><section key={name}><p>{name}</p>{links.map(([path,label,Icon])=><NavLink key={path} to={path} end className={({isActive})=>isActive||(path==='/hot'&&hot)?'active':''}><Icon size={18} aria-hidden="true"/>{label}</NavLink>)}</section>)}<section><p>更多</p><a href="../agent/"><Plug size={18}/>Agent 接入</a></section></nav></div></aside><main>
  <form role="search" onSubmit={e=>{e.preventDefault();go('/all'+(term.trim()?'?q='+encodeURIComponent(term.trim()):''));}}><input aria-label="搜索品牌、IP 或主题" placeholder="搜索品牌、IP 或主题" type="search" value={term} onChange={e=>setTerm(e.target.value)} maxLength={100}/><button>搜索</button></form>
  {here.pathname.startsWith('/brand-lab/')?<BrandTools/>:hot?<BrandCases/>:q?<BrandCases key={q} query={q}/>:<><h1 className="mb-3 text-2xl font-bold">{here.pathname==='/featured'?'品牌现场':'全部品牌动态'}</h1>{stories.failed?<button onClick={stories.retry}>重新读取报道</button>:(stories.data?.items||[]).slice(0,here.pathname==='/featured'?15:150).map(r=><article key={r.url} className="border-t border-line-soft py-3"><small>{r.publisher} · {r.publishedAt.slice(0,10)}</small><h2 className="font-semibold"><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a></h2></article>)}</>}
  </main></div>;
}
createRoot(document.getElementById('root')).render(<HashRouter><Edition/></HashRouter>);
