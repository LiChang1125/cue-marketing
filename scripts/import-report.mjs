// Import an independently researched editorial issue without exposing an upload API.
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore} from '../server/store.js';
import {shanghaiDay,yesterdayWindow,reportSchedule} from '../server/reports.js';
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/import-report.mjs <report.json>');
const input=JSON.parse(readFileSync(resolve(file),'utf8')),now=new Date(),window=yesterdayWindow(now);
if(input.date!==shanghaiDay(now)||input.newsDate!==window.newsDate)throw Error('Issue date or yesterday date is incorrect');
if(!Array.isArray(input.entries)||input.entries.length>20)throw Error('Expected up to 20 verified entries');
const sections=['品牌与公司','联名与 IP','新品与消费','平台与营销'];
const seen=new Set();
const entries=input.entries.map((e,index)=>{
  if(typeof e.title!=='string'||!e.title.trim()||e.title.length>160||typeof e.excerpt!=='string'||e.excerpt.length<15||e.excerpt.length>450||!sections.includes(e.section))throw Error('Invalid editorial entry '+index);
  const url=new URL(e.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Expected a public HTTPS article link');
  if(typeof e.sourceName!=='string'||!e.sourceName.trim())throw Error('Missing source attribution');
  const published=Date.parse(e.publishedAt);if(!Number.isFinite(published)||published<window.start||published>=window.end)throw Error('Article publication must fall within yesterday in Shanghai');
  if(seen.has(e.url))throw Error('Duplicate article');seen.add(e.url);
  return {id:'editorial-'+index,title:e.title.trim(),excerpt:e.excerpt.trim(),section:e.section,url:e.url,sourceName:e.sourceName.trim(),source:'editorial',publishedAt:e.publishedAt,summaryKind:'edited'};
});
const store=openStore(resolve(dirname(fileURLToPath(import.meta.url)),'../data'));
try{
  const existing=store.report(input.date);
  if(existing?.editorial&&!process.argv.includes('--replace'))throw Error('An editorial issue already exists. Use --replace only for a verified correction.');
  const report={date:input.date,newsDate:input.newsDate,title:'CUE 早报',subtitle:entries.slice(0,3).map(e=>e.title).join('；'),scheduledAt:reportSchedule(now).due,generatedAt:now.toISOString(),windowStart:new Date(window.start).toISOString(),windowEnd:new Date(window.end).toISOString(),editorial:true,status:entries.length?'ready':'insufficient',entries,coverage:[...new Set(entries.map(e=>e.sourceName))].map(name=>({id:name,name,state:'fresh'}))};
  store.saveReport(report);console.log(JSON.stringify({date:report.date,newsDate:report.newsDate,entries:entries.length,status:report.status}));
}finally{store.close();}
