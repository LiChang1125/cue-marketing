import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {publicNews} from '../shared/public-topic-search.js';
import {consumerBrands} from '../integrations/hot-monitor/brand-attention.mjs';
import {pressIndex} from '../integrations/hot-monitor/press-index.mjs';
import {brandNewsrooms,sections} from '../integrations/hot-monitor/brand-newsrooms.mjs';
import {publisherCatalog} from '../integrations/hot-monitor/publisher-desk.mjs';
import directory from '../config/pulse-directory.json' with {type:'json'};
const day=86400000,now=Date.now();
const seed=process.argv.includes('--seed'),dir=seed?'.artifacts/hot-monitor-preview':'.artifacts/pages-source-cache';
const seedFile='config/pulse-public-index.json.gz',out=resolve(process.env.PULSE_OUTPUT||'dist/pulse');await mkdir(dir,{recursive:true});
const index=pressIndex(dir),issuers=brandNewsrooms(dir);
const rows=new Map();
function merge(list){for(const r of list){
 const time=Date.parse(r.publishedAt);if(!(time<=now&&now-time<=30*day)||!r.title||!/^https?:\/\//.test(r.url))continue;
 // Publish only public article metadata; operational tables and reader searches stay on their host.
 rows.set(r.url,{url:r.url,title:r.title,publishedAt:new Date(time).toISOString(),publisher:r.publisher,issuerChannel:r.issuerChannel,role:r.role||'media'});
}}
if(!seed){
 try{merge(JSON.parse(gunzipSync(await readFile(seedFile))));}catch(e){if(e.code!=='ENOENT')throw e}
 try{const r=await fetch('https://lichang1125.github.io/cue-marketing/pulse/source-index.json',{signal:AbortSignal.timeout(16000)});if(r.ok)merge((await r.json()).items)}catch{}
 const ctl=AbortSignal.timeout(70000),base=Math.floor(now/900000)*900000-900000;
 await Promise.allSettled([index.feeds(56,10,ctl),index.minute(base+60000,ctl),index.pull(base,false,ctl),
   ...sections.map(s=>issuers.page('main_category',s,1)).slice(0,6)]);
 const terms=['品牌 联名','品牌 快闪','品牌 代言人','限定 首店','运动品牌 赞助','消费品牌 新品'];
 const runs=await Promise.allSettled(terms.map(t=>publicNews(t,ctl)));
 const general=runs.flatMap(r=>r.status==='fulfilled'?r.value:[]);merge(general);
 const leads=new Set();
 for(const r of general){
   const names=consumerBrands(r.title),entity=r.title.match(/[《「“]([^》」”]{2,20})[》」”]/u)?.[1];
   if(names.length&&entity)leads.add(names[0]+' '+entity);
   else if(names.length>=2)leads.add(names.slice(0,2).join(' '));
 }
 const more=await Promise.allSettled([...leads].slice(0,8).map(t=>publicNews(t,AbortSignal.timeout(9000))));
 for(const r of more)if(r.status==='fulfilled')merge(r.value);
}
merge(index.rows(30,40000));merge(issuers.recent(30,40000));index.close();issuers.close();
const items=[...rows.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
if(seed){await writeFile(seedFile,gzipSync(JSON.stringify(items),{level:9}));}
else{
 await mkdir(out,{recursive:true});const origins=new Set(items.map(r=>r.issuerChannel||new URL(r.url).hostname.replace(/^www\./,'')));
 const candidates=[...new Set([...(await publisherCatalog()).map(r=>r.url),...directory.feeds].map(s=>new URL(s).origin))];
 const shift=Math.floor(now/1800000)*31%candidates.length;
 const sample=[...candidates.slice(shift),...candidates.slice(0,shift)].slice(0,45);const validated=new Map();
 try{for(const row of JSON.parse(await readFile(dir+'/browser-publishers.json','utf8')))if(row.until>now)validated.set(row.site,row);}catch{}
 let cursor=0;async function verify(){while(cursor<sample.length){const site=sample[cursor++];try{
 const r=await fetch(site+'/wp-json/wp/v2/posts?per_page=1&_fields=title,link,date_gmt',{headers:{Origin:'https://lichang1125.github.io'},signal:AbortSignal.timeout(3800)});
 if(!r.ok||!['https://lichang1125.github.io','*'].includes(r.headers.get('access-control-allow-origin'))){await r.body?.cancel();continue}
 const [a]=await r.json();if(!a?.title?.rendered||!(Date.parse(a.date_gmt+'Z')>now-30*day))continue;
 validated.set(site,{site,name:new URL(site).hostname,lang:/[\u3400-\u9fff]/u.test(a.title.rendered)?'zh':'en',until:now+7*day});
 }catch{}}}await Promise.all(Array.from({length:8},verify));
 await writeFile(dir+'/browser-publishers.json',JSON.stringify([...validated.values()]));
 await writeFile(out+'/source-index.json',JSON.stringify({generatedAt:new Date(now),origins:origins.size,items,publishers:[...validated.values()].map(r=>[r.name,r.site,r.lang])}));
}
console.log('近30天公开索引',items.length,'篇',new Set(items.map(r=>r.issuerChannel||new URL(r.url).hostname)).size,'个发布来源');
