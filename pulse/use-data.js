import {useState,useEffect} from 'react';
const base=new URL('../',document.baseURI),cache=new Map();
async function read(file){
  const old=cache.get(file);
  if(old&&Date.now()-old.at<60000)return old.promise;
  const promise=fetch(new URL(file,base),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('读取失败');return r.json()});
  cache.set(file,{at:Date.now(),promise});
  try{return await promise}catch(e){if(cache.get(file)?.promise===promise)cache.delete(file);throw e}
}
async function lookup(path){
  const url=new URL(path,base),route=url.pathname.split('/').pop();
  if(route==='latest')return read('agent/articles.json');
  if(route==='hot')return read('pulse/events.json');
  if(route==='tools')return read('pulse/tools.json');
  if(route==='brand-cases'){
    const tools=await read('pulse/tools.json'),list=tools.ranking.find(x=>x.name===url.searchParams.get('brand'))?.cases||[];
    const page=Math.max(1,Number(url.searchParams.get('page'))||1);return {total:list.length,items:list.slice((page-1)*8,page*8)};
  }
  const {cases}=await read('pulse/cases.json');
  const words=(url.searchParams.get('q')||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results=cases.filter(r=>words.every(w=>[r.title,r.content,...r.reports.map(s=>s.title+' '+s.publisher)].join(' ').toLowerCase().includes(w))).slice(0,10);
  return {results,brief:{coverage:[{name:'本期公开报道',count:results.length,read:cases.length}],reach:{readArticles:cases.length}}};
}
export function useBrandData(path){
  const [state,setState]=useState({}),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true,pending=false;async function refresh(){if(pending)return;pending=true;try{const data=await lookup(path);if(active)setState({data,path})}catch{if(active)setState({failed:true,path})}finally{pending=false}}
    refresh();const timer=setInterval(()=>{if(!document.hidden)refresh()},60000);return()=>{active=false;clearInterval(timer)}},[path,attempt]);
  return {...(state.path===path?state:{}),retry:()=>setAttempt(n=>n+1)};
}
