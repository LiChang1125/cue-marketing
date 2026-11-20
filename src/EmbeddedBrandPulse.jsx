import React,{useLayoutEffect,useRef} from 'react';
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
 return <iframe ref={ref} title="品牌脉动" src={topic?'/all?q='+encodeURIComponent(topic):'/?cueReader=pulse'} style={{display:'block',width:'100%',border:0}}/>;
}
