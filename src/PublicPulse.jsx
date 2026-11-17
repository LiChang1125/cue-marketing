import React,{useEffect,useRef,useState} from 'react';
import {assetUrl} from './urls.js';
import './pulse.css';
import NextActions from './NextActions.jsx';
export default function PublicPulse({query=''}){
 const frame=useRef(null),[loaded,setLoaded]=useState(false),[version,setVersion]=useState(Date.now);
 const [currentQuery,setCurrentQuery]=useState(query),[rows,setRows]=useState([]);
 const latest=useRef(null),search=useRef(query),cleanup=useRef(()=>{});
 useEffect(()=>()=>cleanup.current(),[]);
 useEffect(()=>{const tick=async()=>{if(document.hidden)return;try{const r=await fetch(assetUrl('trendradar/manifest.json'),{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(latest.current&&latest.current!==d.generatedAt){search.current=frame.current?.contentDocument?.querySelector('.search-input')?.value||'';setVersion(v=>v+1);}latest.current=d.generatedAt;}catch{}};tick();const timer=setInterval(tick,60000);return()=>clearInterval(timer);},[]);
 function ready(){setLoaded(true);cleanup.current();const doc=frame.current?.contentDocument,input=doc?.querySelector('.search-input');if(!input)return;
  const entries=[...doc.querySelectorAll('.news-item,.rss-item')].map(el=>{const a=el.querySelector('.news-title a,.rss-title a');return a?{title:a.textContent.trim(),url:a.href,source:el.querySelector('.source-name')?.textContent?.trim()||el.closest('.word-group,.rss-feed-group')?.querySelector('.word-name,.feed-name')?.textContent?.trim()||el.querySelector('.rss-author')?.textContent?.trim()||new URL(a.href).hostname}:null;}).filter(Boolean);setRows(entries);
  let timer;const update=()=>{clearTimeout(timer);timer=setTimeout(()=>{search.current=input.value.trim();setCurrentQuery(search.current);},240);};input.addEventListener('input',update);cleanup.current=()=>{clearTimeout(timer);input.removeEventListener('input',update);};if(search.current){input.value=search.current;input.dispatchEvent(new Event('input',{bubbles:true}));}else setCurrentQuery('');}

 return <section className="native-radar" aria-label="TrendRadar 热点雷达">
  <div className="native-radar-toolbar"><span>TrendRadar <small>热点 · RSS · 关键词</small></span><div><button onClick={()=>{search.current=frame.current?.contentDocument?.querySelector('.search-input')?.value||'';setLoaded(false);setVersion(v=>v+1);}}>刷新</button><a href={assetUrl('trendradar/index.html')} target="_blank" rel="noreferrer">展开报告 ↗</a></div></div>
  {!loaded&&<p role="status">正在打开热点雷达…</p>}
  <div className="radar-workspace"><iframe ref={frame} key={version} className="native-radar-frame" src={assetUrl('trendradar/index.html')+'?v='+version+'#all'} title="TrendRadar 原生热点报告" onLoad={ready}/><NextActions query={currentQuery} rows={rows}/></div>
 </section>;
}
