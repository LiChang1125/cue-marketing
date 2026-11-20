import {liveNewswire} from '../integrations/hot-monitor/publication-wire.mjs';
import brandLogos from '../config/pulse-brand-logos.json' with {type:'json'};
import {publicationPictures} from '../integrations/hot-monitor/publication-pictures.mjs';
import {load} from 'cheerio';
import {publisherDesk} from '../integrations/hot-monitor/publisher-desk.mjs';
import {caseArchive} from '../integrations/hot-monitor/evidence-review.mjs';
import {Readable} from 'node:stream';
import {createChineseDisplay} from '../integrations/hot-monitor/chinese.mjs';
import {createTopicBrief} from '../integrations/hot-monitor/topic-brief.mjs';
import {currentHotspots} from '../integrations/hot-monitor/brand-events.mjs';
import {createBrandTools,rankingFocus} from '../integrations/hot-monitor/brand-tools.mjs';

async function indexSearch(term){
 const url=new URL('https://www.bing.com/search');url.search=new URLSearchParams({q:term,format:'rss'});
 const response=await fetch(url,{signal:AbortSignal.timeout(6500)});if(!response.ok)throw Error('公开索引不可用');
 const $=load(await response.text(),{xml:true});return $('item').map((_,e)=>({url:$(e).find('link').text()})).get();
}
export function installBrandPulse(app,{feed,dataDir,allowed,publishHome,pollPublishers=false,origin=process.env.CUE_PULSE_WEB||'http://127.0.0.1:4390'}){
 const publications=async(q)=>{
  const url=new URL('/api/v1/items',origin);
  url.search=new URLSearchParams({mode:'all',limit:q?'50':'12',window:'7d',...(q?{q}:{})}).toString();
  const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('脉动发布服务暂不可用');
  const {items}=await response.json();
  return items.filter(i=>i.links?.original&&i.publishedAt).map(i=>({title:i.title,content:i.summary,url:i.links.original,source:q?'editorial':i.source?.name||'行业媒体',publishedAt:i.publishedAt}));
 };
 const translate=createChineseDisplay(dataDir),pictures=publicationPictures(dataDir);
 const localize=async rows=>pictures(await translate(rows));
 const desk=publisherDesk(dataDir),archive=caseArchive(dataDir);
 const wire=liveNewswire(desk,createChineseDisplay(dataDir),dataDir,publishHome);
 if(pollPublishers){desk.start();wire.start();}
 app.get('/api/brand-pulse/sources',async(req,res)=>{if(!allowed(req))return res.sendStatus(401);await desk.ready;res.json({sources:desk.summary(),indexedSources:desk.globalSources(),directoryFeeds:desk.directFeeds(),officialNewsrooms:desk.summary().filter(s=>s.role==='official'&&s.active)});});
 const research=createTopicBrief(feed,localize,{publicationSearch:publications,desk,archive,dataDir});
 const collectHot=currentHotspots(feed,localize,desk,archive);
 const stories=new Map();
 const hotspots=async()=>{
   const data=await collectHot();
   const retention=Date.now()-30*86400000;
   for(const [id,item] of stories)if(Date.parse(item.lastAt)<retention)stories.delete(id);
   for(const item of data.results)stories.set(item.storyId,item);
   return data;
 };
 app.get('/api/brand-pulse/story',async(req,res)=>{
   if(!allowed(req))return res.sendStatus(401);
   const id=String(req.query.id||'');
   if(!/^[a-f0-9]{20}$/.test(id))return res.sendStatus(400);
   try{if(!stories.has(id))await hotspots();const story=stories.get(id);return story?res.json(story):res.sendStatus(404);}
   catch{return res.status(503).json({error:'事件档案暂不可读'});}
 });
 const brandTools=createBrandTools(feed,desk);
 const refreshHot=()=>hotspots().catch(e=>console.error('更新事件榜',e.message));
 const hotTimer=pollPublishers?setInterval(refreshHot,60000):null;
 hotTimer?.unref();
 if(pollPublishers)void desk.ready.then(()=>Promise.allSettled([refreshHot(),brandTools()]));


 app.get('/api/brand-pulse/tools',async(req,res)=>{
   if(!allowed(req))return res.sendStatus(401);
   try{
     const data=await brandTools(),leaders=data.ranking.filter(b=>b.outlets>=4);
     const examples=leaders.map(b=>[...b.cases].sort((a,c)=>c.outlets-a.outlets||Number(/[一-龥]/.test(c.title))-Number(/[一-龥]/.test(a.title))||c.date.localeCompare(a.date))[0]);
     const headlines=await translate(examples.map(c=>({title:c.title})));
     res.json({...data,ranking:leaders.map(({cases,...b},i)=>({...b,focus:rankingFocus(cases),logo:brandLogos[b.name],reason:headlines[i].title==='中文标题暂不可用'?null:headlines[i].title,example:examples[i].url}))});
   }catch{res.status(503).json({error:'品牌工具暂不可用'});}
 });
 app.get('/api/brand-pulse/brand-cases',async(req,res)=>{
   if(!allowed(req))return res.sendStatus(401);
   try{
     const {ranking}=await brandTools();
     const cases=ranking.find(b=>b.name===req.query.brand)?.cases||[];
     const page=Number(req.query.page)||1;
     if(!Number.isSafeInteger(page)||page<1)return res.sendStatus(400);
     const selected=cases.slice((page-1)*8,page*8);
     const items=await localize(selected);
     const missing=items.flatMap((item,i)=>item.title==='中文标题暂不可用'?selected[i].reports.filter(r=>r.title!==selected[i].title).map(r=>({title:r.title,caseIndex:i})):[]);
     if(missing.length){
       for(const alternative of await localize(missing)){
         if(alternative.title!=='中文标题暂不可用'&&items[alternative.caseIndex].title==='中文标题暂不可用')items[alternative.caseIndex].title=alternative.title;
       }
     }
     res.json({items,total:cases.length});
   }catch{res.status(503).json({error:'案例暂不可用'});}
 });
 app.get('/api/brand-pulse/hot',async(req,res)=>{
   if(!allowed(req))return res.sendStatus(401);
   try{res.json(await hotspots());}catch{res.status(503).json({error:'热点数据暂不可用'});}
 });
 app.get('/api/brand-pulse/search',async(req,res)=>{
  const q=typeof req.query.q==='string'?req.query.q.trim():'';
  if(!q||q.length>100)return res.status(400).json({error:'请输入 1 至 100 字的主题'});
  try{res.json(await research(q,indexSearch));}catch{res.status(503).json({error:'主题检索暂不可用'});}
 });
 app.get('/api/brand-pulse/latest',async(req,res)=>{
  try{res.json({results:await publications()});
  }catch{res.status(503).json({error:'动态暂不可用'});}
 });
 app.get('/dispatch',(req,res)=>res.redirect(req.query.q?'/all?q='+encodeURIComponent(String(req.query.q)):'/?cueReader=pulse'));
 app.all('/api/site/feedback',(req,res)=>res.sendStatus(410));
 app.get(/^\/(starred|about|changelog|feedback)\/?$/,(req,res)=>res.redirect('/?cueReader=pulse'));
 const paths=/^\/(?:search-busy|all|hot|topics|items|story|daily|weekly|monthly|about|terms|privacy|feedback|more|starred|agent|changelog)(?:[/.]|$)|^\/(?:_\.data|_root\.data|__manifest|root\.data|manifest\.webmanifest|favicon\.ico|icon\.png|feed\.xml|llms\.txt|openapi-v1\.json|sitemap\.xml|api\/mcp)$|^\/(?:api\/site|api\/v1|feed|sitemaps|brand|media-proxy|og)\//;
 app.use(async(req,res,next)=>{
  const mcp=req.method==='POST'&&req.path==='/api/mcp'&&req.is('application/json');
  if(!mcp&&!['GET','HEAD'].includes(req.method))return next();
   if(/^\/topics(?:[/.]|$)/.test(req.path))return res.redirect(302,'/?cueReader=pulse');
   if(/^\/(?:brand-lab\/benefits|daily|weekly|monthly)(?:[/.]|$)/.test(req.path))return res.redirect('/hot');
   const home=req.path==='/'&&(req.query.cueReader==='pulse'||req.query.channel==='firstParty'||['collab','campaign','launch','culture','industry','opinion'].includes(req.query.category)||req.headers['sec-fetch-dest']==='iframe');
   const asset=req.path.startsWith('/assets/');
   if(!home&&!asset&&!paths.test(req.path)&&!/^\/brand-lab\/(?:ranking|calendar)(?:\.data)?$/.test(req.path))return next();
  if(!allowed(req)){if(asset)return next();return res.status(401).send('请先登录 CUE');}
  try{
   const target=new URL(origin);target.pathname=req.path;
   if(target.pathname!==req.path||/%2f|%5c/i.test(target.pathname))return res.sendStatus(404);
   target.search=new URL(req.originalUrl,'http://localhost').search;
   const headers={accept:req.headers.accept||'*/*'};
   if(mcp)headers['content-type']='application/json';
   const body=mcp?{body:JSON.stringify(req.body)}:{};
   const response=await fetch(target,{method:req.method,redirect:'manual',signal:AbortSignal.timeout(18000),headers,...body});
   if(asset&&response.status!==200)return next();
   const location=response.headers.get('location');if(location){const to=new URL(location,target);if(to.origin===target.origin)return res.redirect(response.status,to.pathname+to.search);return res.sendStatus(502);}
   res.status(response.status).set('Cache-Control','private, no-store');const type=response.headers.get('content-type');if(type)res.set('Content-Type',type);
   if(req.method==='HEAD'||!response.body)return res.end();Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);
  }catch{if(asset)return next();res.status(503).send('品牌脉动服务暂不可用');}
 });
 return ()=>{clearInterval(hotTimer);wire.close();desk.close();archive.close();};
}
