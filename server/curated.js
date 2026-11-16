import {parseBrandstar} from './sources.js';
import {curatedTabs} from '../shared/curated.js';
const cache=new Map(),inflight=new Map();
let articles=null;
export function setCuratedArticles(service){articles=service;}
export async function curatedPage(kind='all',page=1,fetcher=fetch){
  if(!curatedTabs.some(([id])=>id===kind)||!Number.isInteger(page)||page<1||page>30)throw new Error('分类或页码无效');
  const key=kind+':'+page,prior=cache.get(key);
  if(prior&&Date.now()-prior.at<300000)return {...prior.value,items:prior.value.items.map(i=>articles?.decorate(i)||i)};
  if(inflight.has(key))return inflight.get(key);
  const url=new URL('https://radar.brandstar.com.cn/');if(kind!=='all')url.searchParams.set('kind',kind);url.searchParams.set('pno',String(page));
  const request=(async()=>{const response=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('精选来源暂不可用');const html=await response.text();let items=[];try{items=parseBrandstar(html,new Date().toISOString());}catch(e){if(page===1||!html.includes('bs-curated'))throw e;}
    if(articles){for(let i=0;i<items.length;i+=6){const group=await Promise.all(items.slice(i,i+6).map(item=>articles.resolveLink(item)));items.splice(i,group.length,...group);}articles.enqueue(items);}
    const value={items,kind,page,hasMore:items.length>0&&page<30,sourceUrl:url.href};cache.set(key,{at:Date.now(),value});return value;
  })().finally(()=>inflight.delete(key));inflight.set(key,request);return request;
}
