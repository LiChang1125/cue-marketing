// Loaded inside the pinned upstream server package, using its own lockfile.
import {Router} from 'express';
import {Server} from 'socket.io';
import cron from 'node-cron';
import keywords from './routes/keywords.js';
import hotspots from './routes/hotspots.js';
import settings from './routes/settings.js';
import notifications from './routes/notifications.js';
import {runHotspotCheck} from './jobs/hotspotChecker.js';
import {prisma} from './db.js';
import {searchBing,searchHackerNews,deduplicateResults} from './services/search.js';
import {searchSogou,searchBilibili,searchWeibo} from './services/chinaSearch.js';
import {searchTwitter} from './services/twitter.js';
import {analyzeContent,expandKeyword,preMatchKeyword} from './services/ai.js';

const providers={bing:searchBing,hackernews:searchHackerNews,sogou:searchSogou,bilibili:searchBilibili,weibo:searchWeibo,twitter:searchTwitter};
const base='/api/hot-monitor';

export function mount(app,httpServer,sessionAllowed,{localize,editorialFor,marketingWeight,topicBrief}) {
  const io=new Server(httpServer,{path:base+'/socket.io',allowRequest:(req,done)=>{
    let allowed=sessionAllowed(req);
    if(req.headers.origin){
      try{allowed=allowed&&new URL(req.headers.origin).host===req.headers.host;}catch{allowed=false;}
    }
    done(null,allowed);
  }});
  const sessions=new Map();
  io.on('connection',socket=>{
    sessions.set(socket,socket.request);
    for(const event of ['subscribe','unsubscribe']){
      socket.on(event,(terms)=>{
        if(!Array.isArray(terms)||!sessionAllowed(socket.request))return;
        for(const term of terms.filter(t=>typeof t==='string').slice(0,200)){
          const room='keyword:'+term;
          if(event==='subscribe')socket.join(room);else socket.leave(room);
        }
      });
    }
    socket.on('disconnect',()=>sessions.delete(socket));
  });
  const checkSessions=setInterval(()=>{
    for(const [socket,req] of sessions)if(!sessionAllowed(req))socket.disconnect(true);
  },15000);
  checkSessions.unref();
  const api=Router();
  api.use((req,res,next)=>{
    if(!/^\/(hotspots|notifications)(\/|$)/.test(req.path))return next();
    const send=res.json.bind(res);
    res.json=(payload)=>{
      if(res.statusCode>=400||!payload||payload.brief)return send(payload);
      const key=Array.isArray(payload.results)?'results':Array.isArray(payload.data)?'data':null;
      if(!key&&!payload.title)return send(payload);
      localize(key?payload[key]:[payload]).then(rows=>send(key?{...payload,[key]:rows}:rows[0]),next);
      return res;
    };
    next();
  });
  api.use('/keywords',keywords);
  api.use('/settings',settings);
  api.use('/notifications',notifications);
  // The upstream manual route returns SearchResult + nested analysis, while its
  // search UI filters Hotspot records. Adapt that boundary and reuse its collectors.
  api.post('/hotspots/search',async(req,res)=>{
    const query=typeof req.body?.query==='string'?req.body.query.trim():'';
    if(!query||query.length>160)return res.status(400).json({error:'请输入 1 至 160 字的关键词'});
    if(!req.body.sources)return res.json(await topicBrief(query,searchBing));
    const selected=Object.entries(providers).filter(([name])=>
      (name!=='twitter'||process.env.TWITTER_API_KEY)&&(!Array.isArray(req.body.sources)||req.body.sources.includes(name)));
    const batches=await Promise.allSettled(selected.map(([,fn])=>fn(query)));
    const editorials=(!req.body.sources||req.body.sources.includes('editorial'))?editorialFor(query):[];
    const rows=deduplicateResults([...editorials,...batches.flatMap(batch=>batch.status==='fulfilled'?batch.value:[])]);
    const terms=await expandKeyword(query);
    const getMatch=r=>preMatchKeyword(r.title+' '+r.content,terms);
    const top=rows.filter(r=>/^https?:\/\//i.test(r.url)&&(getMatch(r).matched||r.source==='editorial'))
      .sort((a,b)=>marketingWeight(b,query)-marketingWeight(a,query)||Number(new Date(b.publishedAt||0))-Number(new Date(a.publishedAt||0))).slice(0,10);
    const results=await Promise.all(top.map(async row=>{
      const analysis=await analyzeContent(row.title+' '+row.content,query,getMatch(row));
      return {...row,...analysis,id:row.source+'|'+row.url,createdAt:new Date(),keyword:null,
        authorName:row.author?.name,authorUsername:row.author?.username,authorAvatar:row.author?.avatar};
    }));
    res.json({results});
  });
  api.use('/hotspots',hotspots);
  let pending;
  const localizedEvent=(emitter,event,payload)=>{
    localize([payload]).then(([localized])=>emitter.emit(event,localized)).catch(e=>console.error('热点通知:',e.message));
  };
  const events={emit:(event,payload)=>localizedEvent(io,event,payload),
    to:room=>({emit:(event,payload)=>localizedEvent(io.to(room),event,payload)})};
  function scan(){
    if(!pending)pending=runHotspotCheck(events).finally(()=>{pending=null;});
    return pending;
  }
  api.post('/check-hotspots',async(_req,res)=>{await scan();res.json({message:'Hotspot check completed'});});
  api.get('/health',(_req,res)=>res.json({ok:true,ai:Boolean(process.env.OPENROUTER_API_KEY),twitter:Boolean(process.env.TWITTER_API_KEY),
    email:Boolean(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS&&process.env.NOTIFY_EMAIL)}));
  app.use(base,api);
  const task=cron.schedule('*/30 * * * *',()=>scan().catch(e=>console.error('Hot Monitor task:',e.message)));
  return async()=>{task.stop();clearInterval(checkSessions);io.disconnectSockets();io.engine.close();if(pending)await pending;await prisma.$disconnect();};
}

