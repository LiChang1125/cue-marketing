import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

export function publicUrl(value,base){
  if(typeof value!=='string'||!value.trim())return null;
  try{const u=new URL(value,base);if(!/^https?:$/.test(u.protocol)||u.username||u.password||!u.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)|\.local$|[\[\]:]/i.test(u.hostname))return null;return u.href;}catch{return null;}
}
export const isAggregator=url=>{try{return /(^|\.)brandstar\.com\.cn$/.test(new URL(url).hostname);}catch{return false;}};
const badImage=/logo|favicon|site-icon|qrcode|qr-code|wechat-qr|avatar|share-card|data:image/i;
export function articleMetadata(html,url){
  const $=load(html);
  const external=isAggregator(url)&&/\/select\//.test(url)?publicUrl($('.bs-curated-end .bs-read-link').first().attr('href'),url):null;
  const candidates=[...$('meta[property="og:image"],meta[name="twitter:image"],meta[property="og:image:secure_url"]').map((_,e)=>$(e).attr('content')).get(),...$('article img,.entry-content img,.post-content img,.article-content img').map((_,e)=>$(e).attr('data-src')||$(e).attr('src')).get()].map(v=>publicUrl(v,url)).filter(v=>v&&!badImage.test(v));
  const description=$('meta[name="description"],meta[property="og:description"]').first().attr('content')||'';
  return {originalUrl:external&&!isAggregator(external)?external:null,images:[...new Set(candidates)],excerpt:description.trim().slice(0,220)};
}
function imageExtension(b){if(b.length<1024)return null;if(b[0]===0xff&&b[1]===0xd8)return 'jpg';if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'webp';if(b.toString('ascii',0,3)==='GIF')return 'gif';return null;}
export function createArticleService(directory,{fetcher=fetch,concurrency=5}={}){
  const mediaDirectory=resolve(directory,'media'),manifest=resolve(directory,'article-assets.json');mkdirSync(mediaDirectory,{recursive:true});
  let cache={};try{cache=JSON.parse(readFileSync(manifest,'utf8'));}catch{}
  const linkJobs=new Map(),jobs=new Map(),queue=new Map(),active=new Set();let saveTimer;
  function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{writeFileSync(manifest+'.tmp',JSON.stringify(cache));renameSync(manifest+'.tmp',manifest);},100);saveTimer.unref();}
  async function request(url,max=3*1024*1024){
    let next=publicUrl(url);if(!next)throw Error('Invalid article URL');
    for(let hops=0;hops<5;hops++){
      const r=await fetcher(next,{signal:AbortSignal.timeout(10000),redirect:'manual'});
      if(r.status>=300&&r.status<400){next=publicUrl(r.headers.get('location'),next);if(!next)throw Error('Invalid redirect');continue;}
      if(!r.ok)throw Error('Source HTTP '+r.status);if(Number(r.headers.get('content-length'))>max)throw Error('Source too large');
      const reader=r.body.getReader(),chunks=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw Error('Source too large');}chunks.push(value);}
      return {data:Buffer.concat(chunks),url:next};
    }throw Error('Too many redirects');
  }
  const keyFor=item=>item.aggregationUrl||item.url;
  function decorate(item){const key=keyFor(item),entry=cache[key];if(!entry)return item;return {...item,...(entry.originalUrl?{url:entry.originalUrl,originalUrl:entry.originalUrl,aggregationUrl:key}:{}),image:entry.image||item.image,imageLocal:entry.imageLocal&&existsSync(resolve(directory,entry.imageLocal.slice(1)))?entry.imageLocal:null,imageOrigin:entry.image||item.image,excerpt:item.excerpt||entry.excerpt||''};}
  async function resolveLink(item){
    const key=keyFor(item),entry=cache[key]||{};
    if(!isAggregator(key)||!/\/select\//.test(key))return decorate(item);
    if(entry.originalUrl)return decorate(item);
    if(linkJobs.has(key)){await linkJobs.get(key);return decorate(item);}
    const job=(async()=>{try{const {data}=await request(key);const meta=articleMetadata(data.toString('utf8'),key);cache[key]={...cache[key],...meta,linkCheckedAt:Date.now()};save();}catch{/* Keep the record; an unresolved wrapper is never offered as its original. */}})().finally(()=>linkJobs.delete(key));linkJobs.set(key,job);await job;return decorate(item);
  }
  async function enrich(item){
    const key=keyFor(item),entry=cache[key];if(entry?.checkedAt&&Date.now()-entry.checkedAt<(entry.imageLocal?86400000:3600000))return decorate(item);
    if(jobs.has(key))return jobs.get(key);
    const job=(async()=>{
      let resolved=await resolveLink(item),current=cache[key]||{},candidates=[resolved.image,...(current.images||[])].filter(Boolean),excerpt=current.excerpt;
      try{if(!resolved.image||isAggregator(key)&&/\/select\//.test(key)){
        if(!isAggregator(resolved.url)||!/\/select\//.test(resolved.url)){const result=await request(resolved.url);const meta=articleMetadata(result.data.toString('utf8'),result.url);candidates=[...meta.images,...candidates];excerpt=excerpt||meta.excerpt;}
      }}catch{/* Existing original pictures remain candidates when metadata is unavailable. */}
      let image=current.image||candidates.find(candidate=>publicUrl(candidate)&&!badImage.test(candidate))||null,imageLocal=current.imageLocal||null;
      for(const candidate of [...new Set(candidates)].slice(0,4)){
        if(!publicUrl(candidate)||badImage.test(candidate))continue;
        try{const {data}=await request(candidate,8*1024*1024);const ext=imageExtension(data);if(!ext)continue;const name=createHash('sha256').update(candidate).digest('hex').slice(0,32)+'.'+ext;writeFileSync(resolve(mediaDirectory,name),data);image=candidate;imageLocal='/media/'+name;break;}catch{}
      }
      cache[key]={...cache[key],image,imageLocal,excerpt,checkedAt:Date.now()};save();return decorate(item);
    })().finally(()=>jobs.delete(key));jobs.set(key,job);return job;
  }
  function drain(){while(active.size<concurrency&&queue.size){const [key,item]=queue.entries().next().value;queue.delete(key);active.add(key);enrich(item).catch(()=>{}).finally(()=>{active.delete(key);drain();});}}
  function enqueue(items){for(const item of items){const key=keyFor(item),entry=cache[key];if(!active.has(key)&&(!entry?.checkedAt||Date.now()-entry.checkedAt>(entry.imageLocal?86400000:3600000)))queue.set(key,item);}drain();}
  return {decorate,resolveLink,enrich,enqueue,mediaDirectory,pending:()=>queue.size+active.size};
}
