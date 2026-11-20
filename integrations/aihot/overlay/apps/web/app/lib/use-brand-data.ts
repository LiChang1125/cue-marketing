import {useEffect,useState} from "react";

export function useBrandData<T>(path:string){
  const [data,setData]=useState<T|null>(null);
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const interval=path.includes("/search?")||path.includes("/brand-cases?")?300000:45000;
    let pending=false,checked=0;
    setData(null);setFailed(false);
    async function refresh(){
      if(pending||document.hidden||Date.now()-checked<interval)return;
      pending=true;checked=Date.now();
      try{
        const response=await fetch(path,{signal:controller.signal});
        if(!response.ok)throw Error("读取失败");
        const result:T=await response.json();
        if(!controller.signal.aborted){setData(result);setFailed(false);}
      }catch{if(!controller.signal.aborted)setFailed(true);}
      finally{pending=false;}
    }
    void refresh();
    const timer=window.setInterval(refresh,interval);
    document.addEventListener("visibilitychange",refresh);
    return ()=>{controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
  },[path,attempt]);
  return {data,failed,retry:()=>setAttempt(n=>n+1)};
}
