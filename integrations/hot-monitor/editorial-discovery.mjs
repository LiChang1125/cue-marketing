import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {consumerBrands} from './brand-attention.mjs';
import {consumerContent} from './consumer-market.mjs';
import catalog from '../../config/pulse-recommended.json' with {type:'json'};
import {load} from 'cheerio';
import {publisherText,webNews} from './open-news.mjs';
import {publicMarketingPress} from '../../server/topic-search.js';
const day=86400000;
function eventProbe(brand,reports){
  const recent=reports.filter(r=>consumerBrands(r.title).includes(brand)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  for(const report of recent){
    const title=report.title;
    if(/投资者大会|investor day/i.test(title))return brand+' 投资者大会';
    const partner=consumerBrands(title).find(n=>n!==brand);
    if(partner&&/联名|联动|携手|collab|コラボ|\s[x×]\s/i.test(title))return brand+' '+partner;
    const product=title.match(/(?:「([^」]{3,32})」|《([^》]{3,32})》|“([^”]{4,32})”|\b([A-Z][A-Z0-9]{1,8}[- ][A-Z0-9-]{2,12}\d[A-Z0-9-]*)\b)/);
    if(product)return brand+' '+product.slice(1).find(Boolean);
  }
  return null;
}
export function editorialDiscovery(dir){
 const path=join(dir,'pulse-discovery.json');
 let state={checked:{},items:[]},closed=false;
 const ready=readFile(path,'utf8').then(x=>{state=JSON.parse(x)}).catch(e=>{if(e.code!=='ENOENT')console.error('品牌报道索引',e.message);});
 async function refresh(rows){
   await ready;if(closed)return;
   const now=Date.now(),counts=new Map();
   for(const row of rows){
     if(now-Date.parse(row.publishedAt)>7*day)continue;
     for(const brand of consumerBrands(row.title)){
       if(!counts.has(brand))counts.set(brand,new Set());
       counts.get(brand).add(row.publisherId||new URL(row.url).hostname);
     }
   }
   // Revisit widely covered subjects and reserve space for less covered brands each round.
   const eligible=[...counts.keys()].filter(b=>now-(state.checked[b]||0)>2*3600000);
   eligible.sort((a,b)=>counts.get(b).size-counts.get(a).size);
   const popular=eligible.slice(0,8),other=eligible.slice(8).sort((a,b)=>(state.checked[a]||0)-(state.checked[b]||0));
   const queue=[...popular,...other.slice(0,4)];
   const found=[];
   async function search(){while(queue.length&&!closed){
      const brand=queue.shift();
      const [news,trades]=await Promise.allSettled([webNews([brand,eventProbe(brand,rows),brand+' 联名'].filter(Boolean),[brand]),publicMarketingPress(brand,now-14*day)]);
      if(news.status==='fulfilled'||trades.status==='fulfilled')state.checked[brand]=now;
      const hits=[...(news.value||[]),...(trades.value||[]).map(r=>({...r,content:r.excerpt,publisher:r.sourceName}))];
      found.push(...hits.filter(r=>consumerContent(r)&&consumerBrands(r.title+' '+(r.content||'')).includes(brand)));
   }}
   async function contributors(){
     const cursor=Number(state.authorCursor)||0;
     const names=Array.from({length:3},(_,i)=>catalog.bylines[(cursor+i)%catalog.bylines.length]);
     state.authorCursor=(cursor+names.length)%catalog.bylines.length;
     await Promise.allSettled(names.map(async name=>{
       const hits=await webNews([name+' 品牌 营销'],[name]);
       for(const r of hits.slice(0,3)){
         if(closed||!consumerContent(r)||!(Date.parse(r.publishedAt)>=now-30*day))continue;
         const $=load(await publisherText(r.url));
         const attrs=$('meta[name="author"],a[rel="author"],#js_name,.rich_media_meta_nickname,.author-name').toArray().map(e=>($(e).attr('content')||$(e).text()).replace(/\s+/g,'').trim());
         if(attrs.includes(name))found.push({...r,author:name,role:'creator'});
       }
     }));
   }
   await Promise.all([search(),search(),search(),search(),contributors()]);if(closed)return;
   state.items=[...new Map([...state.items,...found].filter(r=>now-Date.parse(r.publishedAt)<30*day&&consumerContent(r)).map(r=>[r.url,r])).values()];
   await mkdir(dir,{recursive:true});await writeFile(path+'.tmp',JSON.stringify(state));await rename(path+'.tmp',path);
 }
 return {refresh,ready,items:()=>state.items.filter(consumerContent),close(){closed=true;}};
}
