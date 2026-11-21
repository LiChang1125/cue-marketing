import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {chinesePress,publicNews,visitIndustryDesks,industryArticles,industryPublishers} from '../shared/public-topic-search.js';
import {consumerBrands} from '../integrations/hot-monitor/brand-attention.mjs';
import {pressIndex} from '../integrations/hot-monitor/press-index.mjs';
import {consumerContent,excludedSearchSource} from '../integrations/hot-monitor/consumer-market.mjs';
import {listedPublishers} from '../integrations/hot-monitor/recommended-sources.mjs';
import {publisherCatalog,publisherDesk,specialistFeeds,parsePublisher} from '../integrations/hot-monitor/publisher-desk.mjs';
import directory from '../config/pulse-directory.json' with {type:'json'};
import {collectPublicCases} from './public-case-sources.mjs';
const day=86400000,now=Date.now();
const seed=process.argv.includes('--seed'),dir=seed?'.artifacts/hot-monitor-preview':'.artifacts/pages-source-cache';
const seedFile='config/pulse-public-index.json.gz',out=resolve(process.env.PULSE_OUTPUT||'dist/pulse');await mkdir(dir,{recursive:true});
const index=pressIndex(dir),desk=publisherDesk(dir);
await desk.ready;
const rows=new Map();
function merge(list){for(const r of list){
 const time=Date.parse(r.publishedAt);if(excludedSearchSource(r)||!(time<=now&&now-time<=30*day)||!r.title||!/^https?:\/\//.test(r.url))continue;
 // Publish only public article metadata; operational tables and reader searches stay on their host.
 const prior=rows.get(r.url);
 const translated=r.originalTitle?r:prior?.originalTitle===r.title?prior:null;
 rows.set(r.url,{url:r.url,title:translated?.title||r.title,originalTitle:translated?.originalTitle,industryDesk:r.industryDesk||prior?.industryDesk||undefined,publishedAt:new Date(time).toISOString(),image:/^https:\/\//.test(r.image||'')?r.image:prior?.image,publisher:r.publisher||prior?.publisher,attribution:r.attribution||prior?.attribution,excerpt:r.content?.slice(0,360)||r.excerpt?.slice(0,360)||prior?.excerpt,issuerChannel:r.issuerChannel||prior?.issuerChannel,role:r.role||prior?.role||'media',citation:r.citation||prior?.citation,brands:r.brands||prior?.brands,metricDisplay:r.metricDisplay||prior?.metricDisplay,channel:r.channel||prior?.channel});
}}
if(!seed){
 try{merge(JSON.parse(gunzipSync(await readFile(seedFile))));}catch(e){if(e.code!=='ENOENT')throw e}
 try{const r=await fetch('https://lichang1125.github.io/cue-marketing/pulse/source-index.json',{signal:AbortSignal.timeout(16000)});if(r.ok)merge((await r.json()).items)}catch{}
 const ctl=AbortSignal.timeout(70000),base=Math.floor(now/900000)*900000-900000;
 await Promise.allSettled([desk.refresh(10,36),index.feeds(56,10,ctl),index.minute(base+60000,ctl),index.pull(base,false,ctl)]);
 const terms=['品牌 联名','品牌 快闪','品牌 代言人','限定 首店','运动品牌 赞助','消费品牌 新品'];
 const runs=await Promise.allSettled(terms.flatMap(t=>[publicNews(t,AbortSignal.timeout(13000)),chinesePress(t.replace(/^品牌 /,''),AbortSignal.timeout(13000))]));
 const general=runs.flatMap(r=>r.status==='fulfilled'?r.value:[]);merge(general);
 const leads=new Set();
 const edition=await readFile(resolve(out,'../content-data.json'),'utf8').then(JSON.parse).catch(()=>({}));
 const headlines=(edition.feed?.items||[]).filter(r=>now-Date.parse(r.publishedAt)<3*day&&/联名|快闪|首店|限定|赞助|首发|代言/.test(r.title));
 for(const r of [...headlines,...general]){
   const names=consumerBrands(r.title),entity=r.title.match(/[《「“]([^》」”]{2,20})[》」”]/u)?.[1];
   if(names.length&&entity)leads.add(entity);
   else if(names.length)leads.add(names[0]);
 }
 const more=await Promise.allSettled([...leads].slice(0,8).map(t=>chinesePress(t,AbortSignal.timeout(9000))));
 for(const r of more)if(r.status==='fulfilled')merge(r.value);
}
merge(index.rows(30,40000));merge(desk.items());index.close();desk.close();
// Persist the last successful public source reads across runner locations and temporary outages.
const evidenceCache=resolve(dir,'public-case-evidence.json');
const evidenceByUrl=new Map();
for(const file of ['config/public-case-evidence.json',evidenceCache]){
 try{for(const r of JSON.parse(await readFile(file,'utf8')))if(now-Date.parse(r.publishedAt)<=30*day)evidenceByUrl.set(r.url,r);}catch(e){if(e.code!=='ENOENT')throw e;}
}
const brands=[...new Set([...rows.values()].slice(0,200).flatMap(r=>consumerBrands(r.title)))];
for(const r of await collectPublicCases(brands))evidenceByUrl.set(r.url,r);
merge(evidenceByUrl.values());
await writeFile(evidenceCache,JSON.stringify([...evidenceByUrl.values()]));
await Promise.all([
 visitIndustryDesks(industryPublishers,async src=>{
   try{const batch=await industryArticles(src,'',AbortSignal.timeout(10000));merge(batch.map(r=>({...r,industryDesk:src[1]})));}catch{}
 }),
 visitIndustryDesks([...new Map([...specialistFeeds,...listedPublishers().filter(s=>s.format==='rss')].map(s=>[s.url,s])).values()],async src=>{
   try{const response=await fetch(src.url,{signal:AbortSignal.timeout(12000)});if(!response.ok){await response.body?.cancel();return;}
     const articles=parsePublisher(await response.text(),src,now);
     merge((src.name?articles.filter(consumerContent):articles).map(r=>({...r,industryDesk:src.id})));}catch{}
 })
]);
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
