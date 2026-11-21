import {publicTopicSearch} from '../shared/public-topic-search.js';
import {useState,useEffect} from 'react';
const base=new URL('../',document.baseURI),cache=new Map();
async function read(file){
  const old=cache.get(file);
  if(old&&Date.now()-old.at<60000)return old.promise;
  const promise=fetch(new URL(file,base),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('读取失败');return r.json()});
  cache.set(file,{at:Date.now(),promise});
  try{return await promise}catch(e){if(cache.get(file)?.promise===promise)cache.delete(file);throw e}
}
async function lookup(path,signal,onProgress){
  const url=new URL(path,base),route=url.pathname.split('/').pop();
  if(route==='story'){const id=url.searchParams.get('id');if(!/^[a-f0-9]{20}$/.test(id||''))throw Error('无效事件');return read('pulse/stories/'+id+'.json');}
  if(route==='hot')return read('pulse/events.json');
  if(route==='tools')return read('pulse/tools.json');
  if(route==='brand-cases'){
    const tools=await read('pulse/tools.json'),list=tools.ranking.find(x=>x.name===url.searchParams.get('brand'))?.cases||[];
    const page=Math.max(1,Number(url.searchParams.get('page'))||1);return {total:list.length,items:list.slice((page-1)*8,page*8)};
  }
  const supplement=Promise.all([read('pulse/cases.json').catch(()=>({cases:[]})),read('pulse/source-index.json').catch(()=>({items:[],publishers:[]}))]).then(([p,e])=>({items:[...p.cases,...e.items],publishers:e.publishers}));
  return publicTopicSearch(url.searchParams.get('q')||'',{supplement,signal,onProgress});
}
export function useBrandData(path){
  const [state,setState]=useState({}),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true,pending=false;const stop=new AbortController();async function refresh(){if(pending)return;pending=true;try{const data=await lookup(path,stop.signal,data=>{if(active)setState({data,path})});if(active)setState({data,path})}catch{if(active)setState({failed:true,path})}finally{pending=false}}
    refresh();const timer=setInterval(()=>{if(!document.hidden)refresh()},path.includes("/search?")?300000:60000);return()=>{active=false;stop.abort();clearInterval(timer)}},[path,attempt]);
  return {...(state.path===path?state:{}),retry:()=>setAttempt(n=>n+1)};
}
