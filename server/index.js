import {installTopicSearch} from './topic-search.js';
import {installBrandPulse} from './brand-pulse.js';
import express from 'express';
import {publicCors} from './cors.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openStore } from './store.js';
import { collectSource, collectFollowers, sourceDefinitions, parseDate } from './sources.js';
import { collectCli, cliSources, publicCollection } from './cli.js';
import { buildReport, reportSchedule } from './reports.js';
import { trendStats } from './stats.js';
import { scopedItems } from './relevance.js';
import { trendInsights } from './insights.js';
import { topicMatches } from '../shared/insights.js';
import { marketingHotlist } from './hotlist.js';
import { curatedPage,setCuratedArticles } from './curated.js';
import {createArticleService} from './articles.js';
import {editorialFeed,editorialCandidates,isEditorialStory} from './editorial.js';
import {platformEnabled,platformMode} from './platform-api.js';
import {attentionTrends} from './attention.js';
import {closeCloudBrowser,ensureCloudBrowser} from './cloud-browser.js';
import { searchPlan } from './search-plan.js';
import { freshness } from '../src/freshness.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = openStore(process.env.DATA_DIR || resolve(root, 'data'));
const articles=createArticleService(process.env.DATA_DIR || resolve(root,'data'));
setCuratedArticles(articles);
function queueArticles(items){articles.enqueue(scopedItems(items).filter(i=>['socialbeta','brandstar'].includes(i.source)&&Date.parse(i.publishedAt)>=Date.now()-30*86400000).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)));articles.enqueue(scopedItems(items).filter(i=>i.image&&(Date.parse(i.publishedAt)>=Date.now()-7*86400000||!i.publishedAt&&['xiaohongshu','douyin'].includes(i.source)&&Date.parse(i.fetchedAt)>=Date.now()-86400000)));}
queueArticles(store.items());
articles.enqueue(store.reports().flatMap(report=>report.entries));
// Repair legacy normalization without adding new metric observations.
for(const item of store.items()){
  if(item.source==='weibo'&&!item.publishedAt&&item.publishedLabel){const publishedAt=parseDate(item.publishedLabel,item.fetchedAt);if(publishedAt)store.updateItemData({...item,publishedAt});}
  if(item.source==='xiaohongshu'&&item.searchQuery&&item.publishedAt&&!item.publicationVerified)store.updateItemData({...item,publishedAt:null,publishedLabel:'来源未提供可核实的发布时间'});
}
const app = express(), interval = 5 * 60 * 1000;
let running = null, cliRunning = null, topicRunning = null, lastAttempt = 0;
let publicRunning=null;
async function refreshPublicPlatforms(){
  if(!['public','selfhosted'].includes(platformMode()))return;
  if(publicRunning)return publicRunning;
  publicRunning=(async()=>{
    for(const id of ['weibo','zhihu']){
      const source=cliSources.find(s=>s.id===id),prior=store.sources().find(s=>s.id===id),now=new Date().toISOString();
      try{
        const items=await publicCollection(id,now);store.saveItems(items,now);queueArticles(items);
        const searchFresh=prior?.supportsSearch&&Date.now()-Date.parse(prior.lastSearchSuccess)<30*60000;
        store.saveSource({...source,...prior,...items.collectionInfo,state:'ok',count:items.length,lastSuccess:now,attemptedAt:now,lastHotlistSuccess:now,scope:searchFresh?'search+hotlist':'hotlist',supportsSearch:!!searchFresh,message:'公开热榜已更新'});
      }catch(e){
        if(prior?.supportsSearch&&Date.now()-Date.parse(prior.lastSearchSuccess)<30*60000)store.saveSource({...prior,hotlistError:e.message});
        else store.saveSource({...source,...prior,state:'error',attemptedAt:now,message:e.message});
      }
    }
  })().finally(()=>{publicRunning=null;});return publicRunning;
}
app.disable('x-powered-by');
const pagesCors=publicCors(process.env.PUBLIC_WEB_ORIGINS||'');
app.use('/api',pagesCors.middleware);
if(process.env.NODE_ENV==='production')app.set('trust proxy',1);
app.use(express.json({ limit: '8kb' }));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');if(req.path.startsWith('/api')) res.setHeader('Cache-Control','no-store');next();});
app.use('/api',(req,res,next)=>{
  const maintenance=req.method!=='GET'&&(/\/sources\//.test(req.path)||req.path==='/refresh'||req.path==='/reports/generate'||req.method==='PATCH');
  if(process.env.NODE_ENV==='production'&&maintenance&&(!process.env.ADMIN_TOKEN||req.get('authorization')!==`Bearer ${process.env.ADMIN_TOKEN}`))return res.status(403).json({error:'此操作仅供管理员使用'});
  next();
});
let searchWindow=0,searchCount=0;
app.use('/api/topics',(req,res,next)=>{if(req.method==='POST'){if(Date.now()-searchWindow>60000){searchWindow=Date.now();searchCount=0;}if(++searchCount>30)return res.status(429).json({error:'搜索较多，请稍后再试'});}next();});

async function refresh() {
  if (running) return running;
  if (Date.now() - lastAttempt < 60000) return { cached: true };
  lastAttempt = Date.now();
  running = (async () => {
    for (const source of sourceDefinitions) {
      const now = new Date().toISOString(), prior = store.sources().find(s=>s.id===source.id);
      try {
        const items = await collectSource(source.id, now);
        if(!items.length)throw new Error('来源未返回可收录内容');
        store.saveItems(items, now);
        queueArticles(items);
        store.saveSource({...source, state:'ok', count:items.length, attemptedAt:now, lastSuccess:now, message:'采集成功'});
        if(source.id === 'bilibili') {
          // Limit follower requests to a small rotating sample, never infer growth from views.
          const mids=[...new Set(items.map(i=>i.creatorId).filter(Boolean))].slice(0,8);
          for (const mid of mids) {
            const old=store.followers(mid).at(-1);
            if(old && Date.now()-new Date(old.at).getTime() < 30*60000) continue;
            try {store.saveFollowers(mid,new Date().toISOString(),await collectFollowers(mid));} catch { /* Missing observations remain missing. */ }
          }
        }
      } catch(error) {
        store.saveSource({...source,state:'error',count:prior?.count||0,attemptedAt:now,lastSuccess:prior?.lastSuccess||null,message:error.message});
      }
    }
    store.prune();return {cached:false};
  })().finally(()=>{running=null;});
  return running;
}

async function refreshCli(id,query='',fromTopic=false,options={}){
  const source=cliSources.find(s=>s.id===id);
  if(!source)throw new Error('未知来源');
  if(topicRunning&&!fromTopic)throw new Error('正在采集关注主题，请稍后再试');
  if(cliRunning)throw new Error('另一项连接检查正在进行，请稍后再试');
  const prior=store.sources().find(s=>s.id===id),now=new Date().toISOString();
  if(!query&&prior?.attemptedAt&&Date.now()-new Date(prior.attemptedAt)<60000) return {count:prior.count||0,message:'刚刚已检查，请稍后再试'};
  cliRunning=id;
  try{const items=await collectCli(id,now,query,options);store.saveItems(items,now);queueArticles(items);store.saveSource({...source,...items.collectionInfo,lastSearchAttempt:now,lastSearchSuccess:items.collectionInfo?.supportsSearch?now:prior?.lastSearchSuccess||null,lastHotlistSuccess:items.collectionInfo?.scope==='hotlist'?now:prior?.lastHotlistSuccess||null,state:items.length||prior?.lastSuccess?'ok':'empty',count:items.length,lastSuccess:items.length?now:prior?.lastSuccess||null,attemptedAt:now,failures:0,message:items.length?'已返回来源内容':'未找到相关结果'});return{count:items.length,items,limited:items.collectionInfo?.supportsSearch===false};}
  catch(e){if(e.message==='未找到相关结果'){store.saveSource({...source,state:prior?.lastSuccess?'ok':'empty',count:0,lastSuccess:prior?.lastSuccess||null,attemptedAt:now,lastSearchAttempt:now,failures:0,message:e.message});return {count:0,items:[]};}store.saveSource({...source,state:prior?.lastSuccess?'error':'setup',count:prior?.count||0,lastSuccess:prior?.lastSuccess||null,attemptedAt:now,lastSearchAttempt:now,failures:(prior?.failures||0)+1,message:e.message});throw e;}
  finally{cliRunning=null;}
}

const topicPlatforms=['xiaohongshu','bilibili-cli','douyin','weibo','zhihu'].filter(id=>platformEnabled(id));
// Interrupted reads have no live worker after a restart. Requeue, rather than
// leaving a persisted "running" label on the page indefinitely.
for(const topic of store.topics())if(topic.state==='running')store.saveTopic({...topic,state:'queued',nextCheck:new Date().toISOString()});
async function runTopic(id){
  if(topicRunning||cliRunning)return;
  const topic=store.topics().find(t=>t.id===id);
  if(!topic||topic.paused)return;
  topicRunning=id;topic.state='running';topic.startedAt=new Date().toISOString();topic.progress=[];store.saveTopic(topic);
  const queries=platformMode()==='public'?[topic.query]:searchPlan(topic.query),seenBySource=new Map();
  const tasks=queries.flatMap(query=>topicPlatforms.map(source=>({source,query,page:1})));
  if(topicPlatforms.includes('bilibili-cli'))tasks.push({source:'bilibili-cli',query:topic.query,page:2});
  for(const {source,query,page} of tasks){
    const at=new Date().toISOString();
    try{
      const result=await refreshCli(source,query,true,{limit:30,page});
      const items=scopedItems(result.items||[]).filter(i=>topicMatches(i,topic.query));
      const added=store.saveTopicRun(id,source,items,at,items.length?'ok':'empty');
      const seen=seenBySource.get(source)||new Set();for(const item of items)seen.add(item.id);seenBySource.set(source,seen);
      const previous=topic.progress.find(p=>p.source===source);topic.progress=topic.progress.filter(p=>p.source!==source);topic.progress.push({source,state:result.limited?'limited':seen.size?'ok':'empty',count:seen.size,added:added+(previous?.added||0),at});
    }catch(e){store.saveTopicRun(id,source,[],at,'error');const previous=topic.progress.find(p=>p.source===source);topic.progress=topic.progress.filter(p=>p.source!==source);topic.progress.push({source,state:'error',count:previous?.count||0,added:previous?.added||0,at,message:e.message});}
    // Preserve a pause requested while the current read was in flight.
    topic.paused=store.topics().find(t=>t.id===id)?.paused||false;
    store.saveTopic(topic);
    if(topic.paused)break;
  }
  topic.state=!tasks.length||topic.progress.some(p=>['error','limited'].includes(p.state))?'partial':'done';
  topic.lastChecked=new Date().toISOString();topic.nextCheck=new Date(Date.now()+15*60000).toISOString();
  store.saveTopic(topic);topicRunning=null;
}
function queueTopic(id){runTopic(id).catch(e=>{console.error('主题采集未完成：',e.message);topicRunning=null;});}
function seedTopic(topic){
  const items=scopedItems(store.items()).filter(i=>topicMatches(i,topic.query));
  for(const source of new Set(items.map(i=>i.source)))store.saveTopicRun(topic.id,source,items.filter(i=>i.source===source),new Date().toISOString(),'ok');
}
app.use('/api/topics',(req,res,next)=>{const origin=req.get('origin');if(req.method!=='GET'&&origin&&origin!==`${req.protocol}://${req.get('host')}`&&!(req.method==='POST'&&req.path==='/'&&pagesCors.trusted(origin)))return res.status(403).json({error:'请从本站操作'});next();});
app.post('/api/topics',(req,res)=>{
  const query=typeof req.body?.query==='string'?req.body.query.trim():'';
  if(!query||query.length>40)return res.status(400).json({error:'主题请输入 1—40 个字'});
  const id=createHash('sha256').update(query.toLowerCase()).digest('hex').slice(0,20);
  let topic=store.topics().find(t=>t.id===id);
  if((!topic||topic.paused)&&store.topics().filter(t=>!t.paused).length>=8){
    const oldest=store.topics().filter(t=>!t.paused&&t.id!==topicRunning).sort((a,b)=>Date.parse(a.searchedAt||a.createdAt)-Date.parse(b.searchedAt||b.createdAt))[0];
    if(oldest)store.saveTopic({...oldest,paused:true});
  }
  if(topic&&!topic.paused&&(topic.state==='running'||topic.startedAt&&Date.now()-Date.parse(topic.startedAt)<5*60000)){store.saveTopic({...topic,searchedAt:new Date().toISOString()});seedTopic(topic);return res.status(202).json({id,message:'正在显示这个主题的最新结果'});}
  topic=topic?{...topic,paused:false,state:'queued',nextCheck:new Date().toISOString()}:{id,query,createdAt:new Date().toISOString(),state:'queued',paused:false,progress:[],nextCheck:new Date().toISOString()};
  seedTopic(topic);
  topic.searchedAt=new Date().toISOString();
  store.saveTopic(topic);queueTopic(id);res.status(202).json({id,message:'已加入主题跟进队列'});
});
app.post('/api/topics/:id/refresh',(req,res)=>{
  const topic=store.topics().find(t=>t.id===req.params.id);if(!topic)return res.status(404).json({error:'主题不存在'});
  if(topic.startedAt&&Date.now()-new Date(topic.startedAt)<5*60000)return res.status(429).json({error:'刚刚已跟进，请等待至少 5 分钟再刷新'});
  store.saveTopic({...topic,paused:false,state:'queued',nextCheck:new Date().toISOString()});queueTopic(topic.id);res.status(202).json({message:'已加入跟进队列'});
});
app.patch('/api/topics/:id',(req,res)=>{
  const topic=store.topics().find(t=>t.id===req.params.id);if(!topic)return res.status(404).json({error:'主题不存在'});
  if(typeof req.body?.paused!=='boolean')return res.status(400).json({error:'缺少暂停状态'});
  if(!req.body.paused&&topic.paused&&store.topics().filter(t=>!t.paused).length>=8)return res.status(400).json({error:'同时最多跟进 8 个主题'});
  store.saveTopic({...topic,paused:req.body.paused,...(!req.body.paused?{state:'queued',nextCheck:new Date().toISOString()}:{})});if(!req.body.paused)queueTopic(topic.id);res.json({ok:true});
});
installTopicSearch(app);
const closePulse=installBrandPulse(app,{pollPublishers:true,feed:()=>({items:scopedItems(store.items())}),dataDir:process.env.DATA_DIR||resolve(root,'data'),allowed:()=>true});
app.get('/api/topics/:id/history',(req,res)=>res.json({runs:store.topicHistory(req.params.id)}));

app.get('/api/feed',(req,res)=>{
  const persisted=store.sources();
  const sources=[...sourceDefinitions,...cliSources].map(s=>{
    if(s.setup&&platformMode()!=='browser'&&!platformEnabled(s.id))return {...s,state:'setup',count:0,lastSuccess:null,message:'云端接口尚未配置'};
    const value=persisted.find(p=>p.id===s.id)||{...s,state:s.setup?'setup':'pending',count:0,message:s.setup?'首次使用请检查连接':undefined};
    return {...value,intervalSeconds:s.setup?900:300,nextCheckAt:s.setup?(value.lastSuccess?new Date(Date.parse(value.attemptedAt||value.lastSuccess)+cliDelay(value)).toISOString():null):new Date(lastAttempt+interval).toISOString()};
  });
  const items=scopedItems(store.items()).map(i=>articles.decorate(i)).map(item=>{
    const points=item.creatorId?store.followers(item.creatorId):[];
    const latest=points.at(-1), baseline=latest?points.findLast(p=>new Date(latest.at)-new Date(p.at)>=86400000):null;
    return {...item,followers:latest?.count??null,followersAt:latest?.at??null, followerChange:baseline?latest.count-baseline.count:null, followerBaselineAt:baseline?.at??null};
  });
  const visibleItems=new Map(items.map(i=>[i.id,i]));
  const topics=store.topics().map(t=>({...t,items:store.topicItems(t.id).filter(i=>visibleItems.has(i.id)&&topicMatches(visibleItems.get(i.id),t.query))}));
  const editorial=editorialFeed(items);
  res.json({items,sources,topics,editorial,editorialCandidates:editorialCandidates(items),hotlist:marketingHotlist(editorial,sources),topicRunning,refreshing:!!running,cliRunning,intervalSeconds:interval/1000,serverTime:new Date().toISOString(),nextRefreshAt:new Date(lastAttempt+interval).toISOString()});
});
const cliAttempts=new Map();
app.post('/api/sources/:id/check',async(req,res)=>{
  const origin=req.get('origin');
  if(origin&&origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'请从本站检查连接'});
  if(!cliSources.some(s=>s.id===req.params.id))return res.status(400).json({error:'未知来源'});
  const last=cliAttempts.get(req.params.id)||0;
  if(Date.now()-last<60000)return res.status(429).json({error:'一分钟内刚刚检查过，请稍后再试'});
  cliAttempts.set(req.params.id,Date.now());
  const query=typeof req.body?.query==='string'?req.body.query.trim().slice(0,80):'';
  try{res.json(await refreshCli(req.params.id,query));}catch(e){res.status(503).json({error:e.message});}
});
app.post('/api/refresh',async(req,res)=>{
  const origin=req.get('origin');
  if(origin && origin!==`${req.protocol}://${req.get('host')}`) return res.status(403).json({error:'请从本站刷新'});
  refreshKnownCli().catch(console.error);
  try {res.json(await refresh());}catch {res.status(500).json({error:'更新未完成，请稍后重试'});}
});
app.get('/api/items/:id/history',(req,res)=>res.json({points:store.history(req.params.id)}));
app.get('/api/stats',(req,res)=>{
  const id=typeof req.query.topic==='string'?req.query.topic:null;
  if(id&&!store.topics().some(t=>t.id===id))return res.status(404).json({error:'主题不存在'});
  const memberships=id?store.topicItems(id):null;
  const items=store.items().filter(i=>!memberships||memberships.some(t=>t.id===i.id));
  res.json(trendStats(items,id=>store.history(id),Date.now(),memberships));
});
app.get('/api/insights',(req,res)=>{
  const id=typeof req.query.topic==='string'?req.query.topic:null;
  const topic=id?store.topics().find(t=>t.id===id):null;
  if(id&&!topic)return res.status(404).json({error:'主题不存在'});
  const members=topic?new Set(store.topicItems(id).map(i=>i.id)):null;
  const items=store.items().filter(i=>topic?members.has(i.id)&&topicMatches(i,topic.query):isEditorialStory(i)).map(i=>articles.decorate(i));
  const result=trendInsights(items,id=>store.history(id),Date.now(),store.sources(),req.query.days==='30'?30:7);
  if(topic)result.activity.platformSignals=items.filter(i=>i.source==='douyin'&&Number.isFinite(i.metrics?.topicViews)&&i.metrics.topicViews>0&&freshness(i.fetchedAt,store.sources().find(s=>s.id===i.source))==='fresh').sort((a,b)=>(b.title.trim()===topic.query)-(a.title.trim()===topic.query)||b.metrics.topicViews-a.metrics.topicViews).slice(0,1).map(i=>({title:i.title,url:i.url,source:i.source,value:i.metrics.topicViews}));
  res.json(result);
});
app.get('/api/health',(_,res)=>res.json({ok:true}));
app.get('/api/attention',(req,res)=>{
  const query=String(req.query.query||'').trim().slice(0,40),sector=['brand','ip','culture'].includes(req.query.sector)?req.query.sector:null;
  const sources=store.sources().map(s=>cliSources.some(c=>c.id===s.id)&&!platformEnabled(s.id)?{...s,state:'setup'}:s);
  res.json(attentionTrends(scopedItems(store.items()),id=>store.history(id),{query,sector,days:req.query.days==='30'?30:7,sources}));
});
app.get('/api/curated',async(req,res)=>{
  const kind=typeof req.query.kind==='string'?req.query.kind:'all',page=Number(req.query.page||1);
  try{const result=await curatedPage(kind,page);store.saveItems(result.items,new Date().toISOString());res.json(result);}catch(e){res.status(/无效/.test(e.message)?400:503).json({error:e.message});}
});
let reportRunning=null,lastReportAttempt=0,reportError=null;
async function generateReport(){
  if(reportRunning)return reportRunning;
  const editorial=store.report(reportSchedule().day);
  if(editorial?.editorial)return editorial;
  lastReportAttempt=Date.now();reportError=null;
  reportRunning=(async()=>{
    await refresh();
    const persisted=store.sources();
    const sources=[...sourceDefinitions,...cliSources].map(s=>persisted.find(p=>p.id===s.id)||{...s,state:'setup'});
    const report=await buildReport(store.items(),sources);
    store.saveReport(report);return report;
  })().catch(e=>{reportError=e.message;throw e;}).finally(()=>{reportRunning=null;});
  return reportRunning;
}
app.get('/api/reports',(_,res)=>{
  const current=new Map(store.items().map(i=>[i.id,i]));
  const reports=store.reports().map(r=>({...r,entries:r.entries.map(i=>articles.decorate({...current.get(i.id),...i,image:i.image||current.get(i.id)?.image||null}))}));
  res.json({reports,generating:!!reportRunning,error:reportError,schedule:{...reportSchedule(),timezone:'Asia/Shanghai',time:'08:00'}});
});
app.post('/api/reports/generate',async(req,res)=>{
  const origin=req.get('origin');
  if(origin&&origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({error:'请从本站生成日报'});
  if(!reportRunning&&Date.now()-lastReportAttempt<60000)return res.status(429).json({error:'一分钟内刚刚生成过，请稍后重试'});
  try{res.json(await generateReport());}catch{res.status(503).json({error:'日报生成失败，稍后将自动重试'});}
});
app.use('/api',(_,res)=>res.status(404).json({error:'接口不存在'}));

app.use('/media',express.static(articles.mediaDirectory,{maxAge:'7d',immutable:true}));
if (existsSync(resolve(root,'dist/index.html'))) {
  app.use(express.static(resolve(root,'dist')));
  app.get('/{*path}',(_,res)=>res.sendFile(resolve(root,'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root,server: {middlewareMode:true}, appType:'spa' });
  app.use(vite.middlewares);
}
const port=Number(process.env.PORT || 4173), host=process.env.HOST || (process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
function cliDelay(source){return Math.min(30,(source.scope==='hotlist'?5:15)*Math.max(1,source.failures||0))*60000;}
async function refreshKnownCli(){
  if(topicRunning||cliRunning)return;
  for(const s of cliSources){
    if(topicRunning||cliRunning)return;
    if(!platformEnabled(s.id))continue;
    if(platformMode()==='public')continue;
    const prior=store.sources().find(p=>p.id===s.id);
    if(!prior?.lastSearchAttempt||Date.now()-Date.parse(prior.lastSearchAttempt)>=cliDelay(prior)){
      try{await refreshCli(s.id,'品牌联名');}catch{/* Keep last successful content; retry with a bounded delay. */}
    }
  }
}
const server=app.listen(port,host,()=>{console.log(`CUE 已启动：http://${host}:${port}`);if(platformMode()==='selfhosted')ensureCloudBrowser().catch(()=>console.error('云端浏览器暂不可用；请检查运行环境。'));refresh().catch(console.error);refreshPublicPlatforms().catch(console.error);refreshKnownCli().catch(console.error);});
const publicTimer=setInterval(()=>refreshPublicPlatforms().catch(console.error),5*60000);
const timer=setInterval(()=>refresh().catch(console.error),interval);
const cliTimer=setInterval(()=>refreshKnownCli().catch(console.error),60000);
const topicTimer=setInterval(()=>{if(topicRunning||cliRunning)return;const next=store.topics().filter(t=>!t.paused&&new Date(t.nextCheck||0)<=new Date()).sort((a,b)=>(b.state==='queued')-(a.state==='queued')||new Date(a.lastChecked||0)-new Date(b.lastChecked||0))[0];if(next)queueTopic(next.id);},5000);
function checkReport(){
  const schedule=reportSchedule(),existing=store.report(schedule.day);
  const needsReport=!existing||(!existing.editorial&&existing.status!=='ready'&&Date.now()-Date.parse(existing.generatedAt)>15*60000);
  if(schedule.ready&&needsReport&&!reportRunning&&Date.now()-lastReportAttempt>60000)generateReport().catch(console.error);
}
const reportTimer=setInterval(checkReport,30000);
const reportStartup=setTimeout(checkReport,30000);
let shuttingDown=false;
async function shutdown(){
  if(shuttingDown)return;shuttingDown=true;
  closePulse();clearInterval(publicTimer);clearInterval(timer);clearInterval(cliTimer);clearInterval(topicTimer);clearInterval(reportTimer);clearTimeout(reportStartup);
  // Flush the persistent browser profile before exiting the app process.
  const closed=new Promise(resolve=>server.close(resolve));
  const deadline=setTimeout(()=>process.exit(1),25000);deadline.unref();
  await Promise.all([closed,closeCloudBrowser().catch(()=>{})]);
  store.close();clearTimeout(deadline);process.exit(0);
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
