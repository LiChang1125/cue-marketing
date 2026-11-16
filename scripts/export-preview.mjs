import {mkdir,writeFile} from 'node:fs/promises';
import {curatedTabs} from '../shared/curated.js';
const base=process.env.PREVIEW_SOURCE||'http://127.0.0.1:14173';
const output='.artifacts/preview-export';
await mkdir(output+'/media',{recursive:true});
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(path+': '+r.status);return r.json();}
const [raw,reports]=await Promise.all([read('/api/feed'),read('/api/reports')]);
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
const feed=pick(raw,['items','editorial','editorialCandidates','hotlist','serverTime']);
feed.sources=raw.sources.map(s=>pick(s,['id','name','state','count','lastSuccess','lastSearchSuccess','intervalSeconds']));
feed.topics=raw.topics.map(t=>({...pick(t,['id','query','items']),state:'done'}));
const curated={};
for(const [kind] of curatedTabs){const result=await read('/api/curated?kind='+kind+'&page=1');curated[kind]=result.items;}
const histories={};
for(let i=0;i<feed.items.length;i+=12)await Promise.all(feed.items.slice(i,i+12).map(async item=>{histories[item.id]=(await read('/api/items/'+encodeURIComponent(item.id)+'/history')).points;}));
const allItems=[...feed.items,...feed.editorial,...feed.editorialCandidates,...feed.hotlist,...reports.reports.flatMap(r=>r.entries),...Object.values(curated).flat()];
const media=[...new Set(allItems.map(i=>i.imageLocal).filter(path=>typeof path==='string'&&/^\/media\/[\w.-]+$/.test(path)))];
let mediaCount=0;
for(let i=0;i<media.length;i+=8)await Promise.all(media.slice(i,i+8).map(async path=>{
  try{const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error();await writeFile(output+path,Buffer.from(await r.arrayBuffer()));mediaCount++;}
  catch{for(const item of allItems)if(item.imageLocal===path)delete item.imageLocal;}
}));
const generatedAt=new Date().toISOString();
await writeFile(output+'/preview-data.json',JSON.stringify({generatedAt,feed,reports,curated,histories}));
console.log(JSON.stringify({output,generatedAt,news:feed.items.length,editorial:feed.editorial.length,reports:reports.reports.length,curated:Object.fromEntries(Object.entries(curated).map(([k,v])=>[k,v.length])),media:mediaCount}));
