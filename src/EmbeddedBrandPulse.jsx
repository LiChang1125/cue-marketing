import React,{useLayoutEffect,useRef} from 'react';
import {assetUrl,publicMode} from './urls.js';
export default function EmbeddedBrandPulse({topic}){
 const ref=useRef(null);
 useLayoutEffect(()=>{
  const frame=ref.current;
  function resize(){frame.style.height=Math.max(280,window.innerHeight-Math.max(0,frame.getBoundingClientRect().top))+'px';}
  const observer=new ResizeObserver(resize);
  const header=document.querySelector('.header');
  if(header)observer.observe(header);
  window.addEventListener('resize',resize);
  resize();
  return ()=>{observer.disconnect();window.removeEventListener('resize',resize);};
 },[]);
 const src=publicMode?assetUrl('pulse/')+(topic?'#/search?q='+encodeURIComponent(topic):''):topic?'/all?q='+encodeURIComponent(topic):'/hot';
 return <iframe ref={ref} title="品牌脉动" src={src} style={{display:'block',width:'100%',border:0}}/>;
}
