import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,Navigate,NavLink,useLocation} from 'react-router';
import {Flame,BookOpen,ChartColumn,CalendarDays,Plug} from 'lucide-react';
import BrandCases from '../integrations/aihot/overlay/apps/web/app/components/BrandCases';
import BrandTools from '../integrations/aihot/overlay/apps/web/app/routes/brand-tools';
import ReadingSites from '../integrations/aihot/overlay/apps/web/app/routes/reading-sites';

function Edition(){
  const here=useLocation(),q=new URLSearchParams(here.search).get('q')?.trim()||'';
  const groups=[['阅读',[['/hot','热点榜',Flame]]],['品牌工具',[['/brand-lab/ranking','品牌榜',ChartColumn],['/brand-lab/calendar','营销日历',CalendarDays],['/brand-lab/reading','值得阅读',BookOpen]]]];
  const hot=here.pathname==='/hot'||here.pathname==='/search';
  if(here.pathname==='/'||here.pathname==='/all'||here.pathname==='/featured')return <Navigate replace to={q?'/search?q='+encodeURIComponent(q):'/hot'}/>;
  return <div className="edition"><aside className="reader-rail"><div className="rail-inner"><a href="#/hot" className="rail-brand" aria-label="CUE 热点榜"><img src="../cue-logo.svg" alt="CUE"/></a><nav aria-label="脉动栏目">{groups.map(([name,links])=><section key={name}><p>{name}</p>{links.map(([path,label,Icon])=><NavLink key={path} to={path} end className={({isActive})=>isActive||(path==='/hot'&&hot)?'active':''}><Icon size={18} aria-hidden="true"/>{label}</NavLink>)}</section>)}<section><p>更多</p><a href="../agent/"><Plug size={18}/>Agent 接入</a></section></nav></div></aside><main>
  {here.pathname==='/brand-lab/reading'?<ReadingSites/>:here.pathname.startsWith('/brand-lab/')?<BrandTools/>:<BrandCases key={q} query={q}/>}
  </main></div>;
}
createRoot(document.getElementById('root')).render(<HashRouter><Edition/></HashRouter>);
