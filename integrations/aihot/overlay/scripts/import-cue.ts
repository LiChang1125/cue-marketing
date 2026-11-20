import {consumerContent,excludedSearchSource,publicationCategory} from './consumer-market.mjs';
// Import previously published CUE summaries via the native material and publication layers.
import {join,dirname} from "node:path";
import {readFile} from "node:fs/promises";
import {sql,closeDb} from "../packages/backend/src/db.ts";
import {upsertMaterial} from "../packages/backend/src/content/materials.ts";
import {publishArticleTx} from "../packages/backend/src/publication/publish.ts";
import {recordSignal} from "../packages/backend/src/events/group.ts";
import {snapshotHeat} from "../packages/backend/src/events/hot.ts";
import {composeDaily,dueDaily,saveReport} from "../packages/backend/src/reports/compose.ts";
import {ENTITIES} from "../industry/taxonomy.ts";
import {createHash} from "node:crypto";
const snapshot=process.argv[2];if(!snapshot)throw Error("缺少 CUE 内容快照路径");
type Item={title:string;url:string;originalUrl?:string;publishedAt:string;excerpt?:string;publisher?:string;mediaEditorial?:boolean;categories?:string[];tags?:string[];fetchedAt?:string;section?:string;role?:string;liveAction?:boolean};
const data=JSON.parse(await readFile(snapshot,"utf8"));
const feed=data.feed as {items:Item[];editorial?:Item[];hotlist?:Item[]};
const ids=new Map<string,string>();
const featured=new Set([...(feed.editorial||[]),...(feed.hotlist||[])].map(r=>r.url));
// Merge dated original dispatches that arrived after the main CUE snapshot.
type Wire={title:string;url:string;publishedAt:string;content?:string;publisher?:string;role?:string};
const deskPath=join(dirname(snapshot),"pulse-publishers.json");
const wires:Record<string,{items:Wire[]}>=JSON.parse(await readFile(deskPath,"utf8").catch(()=>"{}"));
const byUrl=new Map(feed.items.map(r=>[r.url,r]));
const allWires=Object.values(wires).flatMap(v=>v.items||[]);
const officialHosts=new Set(allWires.filter(r=>r.role==='official').map(r=>new URL(r.url).hostname));
const recent=allWires.filter(r=>consumerContent(r)&&!excludedSearchSource(r)&&Date.parse(r.publishedAt)>=Date.now()-7*86400000&&/[一-龥]/.test(r.title)&&!/[ぁ-ヿ]/.test(r.title))
 .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
const perCategory=new Map<string,number>();
for(const r of recent){
 const category=publicationCategory(r),count=perCategory.get(category)||0;
 if(category==='industry'||count>=30)continue;
 perCategory.set(category,count+1);featured.add(r.url);
 if(!byUrl.has(r.url)){
   const item={...r,mediaEditorial:true,excerpt:r.content?.slice(0,500)||r.title};
   feed.items.push(item);byUrl.set(r.url,item);
 }
}
const liveWire:Wire[]=JSON.parse(await readFile(join(dirname(snapshot),"pulse-wire.json"),"utf8").catch(()=>"[]"));
for(const r of liveWire){
 if(!r.title||!r.url||!r.publishedAt)continue;
 featured.add(r.url);
 const existing=byUrl.get(r.url);
 if(existing){if(r.role==='official')existing.role=r.role;continue;}
 const item={...r,liveAction:true,mediaEditorial:true,excerpt:r.content?.trim()||r.title};
 byUrl.set(r.url,item);feed.items.push(item);
}
let count=0;const cutoff=Date.now()-30*86400000;
try{for(const r of feed.items){
 const date=new Date(r.publishedAt),copy=r.excerpt?.trim();
 if(excludedSearchSource(r)||!r.mediaEditorial||!copy||!/[\u3400-\u9fff]/u.test(r.title)||!/^https?:\/\//i.test(r.url)||!(+date>=cutoff&&+date<=Date.now())||/百科|是什么意思|优惠码|优惠券/.test(r.title))continue;
 let link:URL;try{link=new URL(r.originalUrl||r.url);}catch{continue;}
 if(!/^https?:$/.test(link.protocol)||(/(^|\.)brandstar\.com\.cn$/.test(link.hostname)&&!/^\/articles\/[^/]+\/?$/.test(link.pathname)))continue;
 const host=link.hostname,source='cue-media-'+host;
 const publisher=r.originalUrl||r.publisher==='品牌星球'?host:r.publisher||host;
 const text=r.title+' '+copy;
 const category=publicationCategory(r) as 'collab'|'campaign'|'launch'|'culture'|'industry'|'opinion';
 const interpretive=(category==='opinion'||category==='culture')&&consumerContent(r);
 const actionable=r.liveAction===true||interpretive||consumerContent({...r,content:copy})&&/联名|联动|联乘|合作|携手|推出|发售|快闪|开店|门店|发布|新品|上线|广告片|任命|赞助|代言|收购|升级|首秀|市场份额|销量|销售额/.test(text)&&!/速成课|(?:是什么意思|入门教程|历史沿革|优惠券|基础知识)/.test(r.title);
 const tier=r.role==='official'||officialHosts.has(host)?'T1':'T2';
 const tags=[{collab:'品牌联名',campaign:'营销活动',launch:'新品上市',culture:'消费趋势',industry:'行业动态',opinion:'市场研究'}[category],...['亚文化','街头文化','二次元','潮玩','香水','球鞋','快闪'].filter(k=>text.includes(k)),...Object.entries(ENTITIES).filter(([,e])=>e.aliases.some(a=>text.toLowerCase().includes(a.toLowerCase()))).map(([id])=>'entity:'+id)];
 const selected=(featured.has(r.url)||interpretive||tier==='T1')&&actionable;
 const fingerprint=createHash('sha256').update(JSON.stringify([r.title,copy,category,tags,selected,actionable,tier])).digest('hex');
 await sql.begin(async tx=>{
  await tx`INSERT INTO sources(id,name,kind,config,tier,participation_mode,interval_minutes,enabled,health,tags) VALUES (${source},${publisher},'external','{}',${tier},'editorial',60,true,'ok','{}') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,tier=CASE WHEN sources.tier='T1' THEN sources.tier ELSE EXCLUDED.tier END`;
  const seen=Date.parse(r.fetchedAt||'');
  const material=await upsertMaterial({sourceId:source,url:link.href,title:r.title,publishedAt:date,publicationTime:r.publishedAt,discoveredAt:Number.isFinite(seen)&&seen<=Date.now()?new Date(seen):undefined,excerpt:copy,language:'zh',via:'import',backfill:'cue-publisher-time'},tx);
  // Public CUE timelines use the original publication time, including previously imported rows.
  const reclocked=await tx`UPDATE articles SET timeline_at=published_at,backfill=true,backfill_reason='cue-publisher-time'
    WHERE id=${material.articleId} AND source_id=${source} AND published_at IS NOT NULL AND timeline_at IS DISTINCT FROM published_at RETURNING id`;
  if(actionable)ids.set(r.url,material.articleId);
  const fields={title:r.title,summary:copy,category,tags,relevance:actionable?'pass':'block',selected};
  const updated=await tx`INSERT INTO editorial_overrides(article_id,fields,visibility,reason,version,updated_by) VALUES (${material.articleId},${tx.json(fields)},${actionable?'public':'withdrawn'},${fingerprint},1,'cue-import') ON CONFLICT(article_id) DO UPDATE SET fields=EXCLUDED.fields,visibility=EXCLUDED.visibility,reason=EXCLUDED.reason,version=editorial_overrides.version+1 WHERE editorial_overrides.updated_by='cue-import' AND editorial_overrides.reason IS DISTINCT FROM EXCLUDED.reason RETURNING article_id`;
  if(actionable&&updated.length){
   // Only exact dated headlines are shared across publishers without a model decision.
   // Preserve previously assigned event identity, including an editor's manual regrouping.
   const [member]=await tx`SELECT fact_id FROM fact_articles WHERE article_id=${material.articleId} LIMIT 1`;
   if(!member){
    const key=createHash('sha256').update('cue:'+date.toISOString().slice(0,10)+r.title.normalize('NFKC').replace(/\s+/g,'')).digest('hex');
    const [story]=await tx`INSERT INTO stories(public_id,title,first_report_at,latest_at,origin) VALUES (${key.slice(0,32)}::uuid,${r.title.slice(0,120)},${date},${date},'replay') ON CONFLICT(public_id) DO UPDATE SET latest_at=GREATEST(stories.latest_at,EXCLUDED.latest_at) RETURNING id`;
    const [fact]=await tx`INSERT INTO facts(public_id,story_id,title,created_at) VALUES (${'f'+key.slice(32,44)},${story!.id},${r.title.slice(0,60)},${date}) ON CONFLICT(public_id) DO UPDATE SET title=EXCLUDED.title RETURNING id`;
    await tx`INSERT INTO fact_articles(fact_id,article_id,role,created_at) VALUES (${fact!.id},${material.articleId},'report',${date}) ON CONFLICT DO NOTHING`;
    await recordSignal(tx,Number(story!.id),material.articleId,{id:source,signal_group_id:null},'editorial',date);
   }
  }
  if(updated.length||material.created||material.revised||reclocked.length){await publishArticleTx(tx,material.articleId,{releasedAt:date});count++;}
 });
}await snapshotHeat();
// Carry the actual CUE issues into the native archive; never invent a missing edition.
for(const issue of data.reports?.reports||[]){
 if(!/^\d{4}-\d\d-\d\d$/.test(issue.date)||!Array.isArray(issue.entries))continue;
 const entries=(issue.entries as Item[]).filter(r=>ids.has(r.url)).map(r=>({itemId:ids.get(r.url)!,title:r.title,summary:r.excerpt||'',
  factId:null,storyPublicId:null,sourceName:r.publisher==='品牌星球'?new URL(r.originalUrl||r.url).hostname:r.publisher||new URL(r.url).hostname,sourceId:'cue-media-'+new URL(r.originalUrl||r.url).hostname,sourceUrl:r.originalUrl||r.url,
  firstParty:false,role:'媒体',score:null,publishedAt:r.publishedAt,sources:1,section:r.section||'品牌动态'}));
 if(!entries.length)continue;
 const [first]=entries,end=new Date(issue.scheduledAt),start=new Date(+end-86400000);
 if(!first||!Number.isFinite(+end))continue;
 await saveReport('daily',issue.date,start,end,{date:issue.date,lead:{title:first.title,leadParagraph:first.summary},leadItemId:first.itemId,highlights:entries.slice(1,4).map(e=>e.itemId),
  sections:[...new Set(entries.map(e=>e.section))].map(label=>({label,items:entries.filter(e=>e.section===label)})),flashes:[],metrics:{totalEvents:entries.length,sourcesCount:new Set(entries.map(e=>e.sourceId)).size,firstPartyEvents:0},
  windowStart:start.toISOString(),windowEnd:end.toISOString(),generator:{version:'cue-archive'}},undefined,[]);
}
try{await composeDaily(dueDaily());}catch(e){if(!(e instanceof Error)||!e.message.endsWith('nothing judged in its window'))throw e;}
console.log('同步 CUE 已发布摘要',count);}finally{await closeDb();}

