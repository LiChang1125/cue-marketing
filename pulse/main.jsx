import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,NavLink,useLocation,useNavigate} from 'react-router';
import BrandCases from '../integrations/aihot/overlay/apps/web/app/components/BrandCases';
import BrandTools from '../integrations/aihot/overlay/apps/web/app/routes/brand-tools';
import {useBrandData} from './use-data';

function Edition(){
  const here=useLocation(),go=useNavigate(),q=new URLSearchParams(here.search).get('q')||'';
  const [term,setTerm]=useState(q);
  useEffect(()=>setTerm(q),[q]);
  const stories=useBrandData('/api/brand-pulse/latest');
  const tabs=[['/','精选'],['/all','全部品牌动态'],['/hot','热点榜'],['/brand-lab/ranking','品牌榜'],['/brand-lab/calendar','营销日历']];
  return <div className="edition"><aside><nav aria-label="脉动栏目">{tabs.map(([path,label])=><NavLink key={path} to={path} end>{label}</NavLink>)}<a href="../agent/">Agent 接入 ↗</a></nav></aside><main>
  <form role="search" onSubmit={e=>{e.preventDefault();go('/all'+(term.trim()?'?q='+encodeURIComponent(term.trim()):''));}}><input aria-label="搜索品牌、IP 或主题" placeholder="搜索品牌、IP 或主题" type="search" value={term} onChange={e=>setTerm(e.target.value)} maxLength={100}/><button>搜索</button></form>
  {here.pathname.startsWith('/brand-lab/')?<BrandTools/>:here.pathname==='/hot'?<BrandCases/>:q?<BrandCases key={q} query={q}/>:<>{here.pathname==='/'&&<BrandCases compact/>}<h1 className="mb-3 text-2xl font-bold">{here.pathname==='/'?'品牌现场':'全部品牌动态'}</h1>{stories.failed?<button onClick={stories.retry}>重新读取报道</button>:(stories.data?.items||[]).slice(0,here.pathname==='/'?15:150).map(r=><article key={r.url} className="border-t border-line-soft py-3"><small>{r.publisher} · {r.publishedAt.slice(0,10)}</small><h2 className="font-semibold"><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a></h2></article>)}</>}
  </main></div>;
}
createRoot(document.getElementById('root')).render(<HashRouter><Edition/></HashRouter>);
