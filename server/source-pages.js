const domains={xiaohongshu:'xiaohongshu.com',douyin:'douyin.com',weibo:'weibo.com',zhihu:'zhihu.com','bilibili-cli':'bilibili.com'};
const belongs=(page,domain)=>{try{const host=new URL(page.url()).hostname;return host===domain||host.endsWith('.'+domain);}catch{return false;}};

// Keep each collector on its own page in the same authenticated context.
// Other sources must not navigate away from an administrator's verification.
export function createSourcePageRouter(context,{fetcher=fetch}={}){
  const pages=new Map(),pending=new Map();
  async function resolveEndpoint(id){
    const domain=domains[id];if(!domain)throw Error('未知的云端采集来源');
    let page=pages.get(id);
    if(!page||page.isClosed()){
      const claimed=new Set([...pages.values()].filter(p=>!p.isClosed()));
      const available=context.pages().filter(p=>!p.isClosed()&&!claimed.has(p));
      page=available.find(p=>belongs(p,domain))||available.find(p=>p.url()==='about:blank')||await context.newPage();
      pages.set(id,page);
    }
    const session=await context.newCDPSession(page);
    let targetId;
    try{targetId=(await session.send('Target.getTargetInfo')).targetInfo.targetId;}finally{await session.detach();}
    const response=await fetcher('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('无法读取云端采集页面');
    const targets=await response.json(),target=targets.find(t=>t.id===targetId&&t.type==='page');
    let url;try{url=new URL(target?.webSocketDebuggerUrl);}catch{throw Error('云端采集页面连接不可用');}
    if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1'||url.port!=='9222'||url.username||url.password)throw Error('云端采集页面连接地址无效');
    return url.href;
  }
  return {endpointFor(id){
    if(pending.has(id))return pending.get(id);
    const job=resolveEndpoint(id).finally(()=>pending.delete(id));pending.set(id,job);return job;
  }};
}
