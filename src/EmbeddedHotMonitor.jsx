import React,{useEffect,useRef} from 'react';
import {assetUrl} from './urls.js';

export default function EmbeddedHotMonitor(){
  const frame=useRef(null);
  useEffect(()=>{
    const el=frame.current;
    let observer;
    function resize(){
      observer?.disconnect();
      const root=el.contentDocument?.getElementById('root');
      if(!root)return;
      observer=new ResizeObserver(()=>{el.style.height=Math.max(450,Math.ceil(root.getBoundingClientRect().height)+8)+'px';});
      observer.observe(root);
    }
    el.addEventListener('load',resize);
    resize();
    return ()=>{observer?.disconnect();el.removeEventListener('load',resize);};
  },[]);
  return <iframe ref={frame} title="脉动 · 热点雷达" src={assetUrl('hot-monitor/index.html')}
    style={{width:'100%',minHeight:450,border:0,display:'block'}}/>;
}
