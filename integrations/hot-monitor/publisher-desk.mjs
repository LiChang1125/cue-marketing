import {beatSites} from './subject-publications.mjs';
import {listedPublishers,discoverPublisher,creditedAuthor} from './recommended-sources.mjs';
import {originalHref} from '../../shared/original.js';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {load} from 'cheerio';

import {consumerContent,excludedSearchSource} from './consumer-market.mjs';
import {listedArticles} from './listed-articles.mjs';
import {mediaSources} from '../../shared/media-sources.js';
import {collectMediaSource} from '../../server/media-news.js';
import {editorialDiscovery} from './editorial-discovery.mjs';
const day=86400000;
const canonical=host=>host.toLowerCase().replace(/^www\./,'');
const clear=s=>String(s||'').replace(/\s+/g,' ').trim();
const plain=s=>clear(load(String(s||''),null,false).text());
// Public feeds issued by brands themselves and independent specialist publications.
export const specialistFeeds=[
 ['https://stories.hilton.com/feed','official'],['https://newsroom.hyatt.com/news-releases?pagetemplate=rss','official'],
 ['https://newsroom.chipotle.com/press-releases?pagetemplate=rss','official'],['https://newsroom.subway.com/Press-Releases?pagetemplate=rss','official'],
 ['https://www.snaxshot.com/feed','creator'],['https://www.magasin.ltd/feed','creator'],['https://www.blackbirdspyplane.com/feed','creator'],
 ['https://perfumeposse.com/feed/','creator'],['https://keedan.com/track/feed/','media'],['https://www.advertimes.com/feed/','media'],
 ['https://www.just-style.com/feed/','media'],['https://www.nrn.com/rss.xml','media'],['https://outdoori.com/feed/','media']
].map(([url,role])=>({id:canonical(new URL(url).hostname),url,role,format:'rss'}));
export async function publisherCatalog(){
  const raw=await readFile(new URL('../../config/pulse-publishers.txt',import.meta.url),'utf8');
  const unique=new Map();
  for(const line of raw.split(/\r?\n/)){
    if(!line.trim()||line.trim().startsWith('#'))continue;
    const [host,path='/feed/',role='media',format='rss']=line.trim().split(/\s+/),id=canonical(host);
    if(!unique.has(id))unique.set(id,{id,url:'https://'+host+path,role,format});
  }
  for(const source of mediaSources){
    const id=canonical(new URL(source.url).hostname);
    if(!unique.has(id)&&source.specialized&&source.key!=='adobe99u')unique.set(id,{id,url:source.url,role:'media',format:'cue',key:source.key});
  }
  for(const s of specialistFeeds)unique.set(s.id,s);
  for(const s of listedPublishers())if(!unique.has(s.id))unique.set(s.id,s);
  return [...unique.values()];
}
function absolute(value,base){
  if(!value?.trim())return null;
  try{const u=new URL(value,base);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function parsePublisher(xml,source,now){
  const $=load(xml,{xml:true}),label=plain($('channel > title,feed > title').first().text()).slice(0,100)||source.id;
  const rows=[];
  for(const el of $('item,entry').slice(0,100).toArray()){
    const item=$(el),rawUrl=item.children('link').filter((_,l)=>!$(l).attr('rel')||$(l).attr('rel')==='alternate').first();
    const url=absolute(rawUrl.attr('href')||rawUrl.text()||item.children('guid').text(),source.url);
    if(!url)continue;
    const host=canonical(new URL(url).hostname);
    if(host!==source.id&&!host.endsWith('.'+source.id)&&!source.id.endsWith('.'+host))continue;
    const at=Date.parse(item.children('pubDate,published,dc\\:date').first().text());
    if(!Number.isFinite(at)||at>now||at<now-30*day)continue;
    const title=plain(item.children('title').text()).slice(0,280);
    if(!title||new URL(url).pathname==='/')continue;
    const bodies=item.children('description,summary,content,content\\:encoded').toArray().map(e=>$(e).text());
    const body=bodies.sort((a,b)=>b.length-a.length)[0]||'';
    const html=load(body,null,false);
    const image=item.find('media\\:content,media\\:thumbnail,enclosure').filter((_,e)=>!$(e).attr('type')||$(e).attr('type').startsWith('image/')).first().attr('url')||html('img').first().attr('src');
    const author=plain(item.find('dc\\:creator,author > name,author').first().text()).slice(0,100);
    const citedUrls=html('a[href^="https://"]').map((_,a)=>html(a).attr('href')).get().filter(h=>{try{const u=new URL(h);return u.hostname!==new URL(url).hostname&&u.pathname.length>3&&!/amazon\.|facebook\.|instagram\.|twitter\.|doubleclick|rakuten\.|youtu\./i.test(u.hostname);}catch{return false;}}).slice(0,3);
    rows.push({url,title,citedUrls,publishedAt:new Date(at).toISOString(),content:clear(html.text()).slice(0,650),image:image?absolute(image,url):null,publisher:label,publisherId:source.id,author,role:creditedAuthor(author)?'creator':source.role||'media',source:'editorial',firstPartyFeed:true});
  }
  return [...new Map(rows.map(r=>[r.url,r])).values()];
}
async function archivePages(source, first, now, stop){
  const url=new URL(source.url),articles=new Map(first.map(r=>[r.url,r]));
  if(!/^\/feed\/?$/.test(url.pathname)||source.format==='list')return [];
  for(let page=2;page<=6;page++){
    if(first.length&&Math.min(...first.map(r=>Date.parse(r.publishedAt)))<now-14*day)break;
    url.searchParams.set('paged',String(page));
    try{
      const r=await fetch(url,{signal:AbortSignal.any([stop,AbortSignal.timeout(6500)])});
      if(!r.ok){await r.body?.cancel();break;}
      const chunks=[];let bytes=0;
      for await(const chunk of r.body){chunks.push(chunk);bytes+=chunk.length;if(bytes>3e6)break;}
      first=parsePublisher(Buffer.concat(chunks).toString(),source,now);
      const fresh=first.filter(row=>!articles.has(row.url));
      if(!fresh.length)break;
      fresh.forEach(row=>articles.set(row.url,row));
    }catch{break;}
  }
  return [...articles.values()];
}
async function scan(source,old,now,stop){
  const checkedAt=new Date(now).toISOString();
  try{
    if(source.format==='discover'){
      const fresh=await discoverPublisher(source,now,stop,parsePublisher);
      if(!fresh.length)throw Error('无近期可核实原文');
      const merged=new Map([...(old?.items||[]),...fresh].filter(r=>Date.parse(r.publishedAt)>=now-30*day).map(r=>[r.url,r]));
      return {...source,ok:true,lastSuccess:checkedAt,checkedAt,items:[...merged.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,550)};
    }
    if(source.format==='cue'){
      const config=mediaSources.find(s=>s.key===source.key);
      const feed=await collectMediaSource(config,{now:checkedAt,details:4,fetcher:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.any([opts.signal,stop])})});
      const recent=feed.items.map(r=>({...r,source:'editorial',publisherId:source.id,content:r.excerpt,role:source.role,url:originalHref(r)})).filter(r=>r.url&&consumerContent(r));
      if(!recent.length)throw Error(feed.status.message||'未发现近期可核实的消费品牌报道');
      const merged=new Map([...(old?.items||[]),...recent].filter(r=>consumerContent(r)&&now-Date.parse(r.publishedAt)<30*day).map(r=>[r.url,r]));
      return {...source,ok:true,lastSuccess:checkedAt,checkedAt,items:[...merged.values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,550)};
    }
    const response=await fetch(source.url,{signal:AbortSignal.any([stop,AbortSignal.timeout(12000)]),headers:{Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml','User-Agent':'CUE-Marketing/1.0 RSS reader',...(old?.etag&&old.historyAt&&now-Date.parse(old.historyAt)<day?{'If-None-Match':old.etag}:{})}});
    if(response.status===304&&old.items?.some(r=>consumerContent(r)&&Date.parse(r.publishedAt)>=now-30*day))return {...old,checkedAt,lastSuccess:checkedAt,ok:true,error:null};
    if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
    const chunks=[];let bytes=0;
    for await(const chunk of response.body){chunks.push(chunk);bytes+=chunk.length;if(bytes>4e6)break;}
    const buffer=Buffer.concat(chunks),charset=buffer.subarray(0,250).toString().match(/encoding=["'](gbk|gb2312|big5|shift_jis|euc-jp)/i);
    const markup=new TextDecoder(charset?.[1]||response.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]||'utf-8').decode(buffer);
    const parsed=source.format==='list'?listedArticles(markup,source,now):parsePublisher(markup,source,now);
    const loadHistory=!old?.historyAt||now-Date.parse(old.historyAt)>day;
    const historical=loadHistory?await archivePages(source,parsed,now,stop):[];
    const previous=new Map((old?.items||[]).map(r=>[r.url,r]));
    const items=[...parsed,...historical].filter(consumerContent).map(r=>r.approximateDate&&previous.has(r.url)?{...r,publishedAt:previous.get(r.url).publishedAt}:r);
    if(!items.length)throw Error('未读到近30天有日期的消费品牌或营销内容');
    const merged=new Map([...(old?.items||[]),...items].filter(r=>consumerContent(r)&&Date.parse(r.publishedAt)>=now-30*day).map(r=>[r.url,r]));
    return {...source,checkedAt,historyAt:loadHistory?checkedAt:old.historyAt,lastSuccess:checkedAt,ok:true,error:null,etag:response.headers.get('etag'),items:[...merged.values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,550)};
  }catch(e){return {...source,...old,checkedAt,ok:false,error:e.cause?.code||e.message,items:old?.items||[]};}
}
export function publisherDesk(dataDir){
  const discovery=editorialDiscovery(dataDir);
  let globalIndex;
  const indexReady=import('./press-index.mjs').then(({pressIndex})=>{if(!closed){globalIndex=pressIndex(dataDir);}});
  let sources={},round=null,timer,fastTimer,closed=false,revision=0;
  const inFlight=new Set();
  const controller=new AbortController(),path=join(dataDir,'pulse-publishers.json');
  const localReady=readFile(path,'utf8').then(v=>{sources=JSON.parse(v)}).catch(e=>{if(e.code!=='ENOENT')console.error('读取媒体索引',e.message);});
  const ready=Promise.all([indexReady,localReady,discovery.ready]);
  async function updateSource(s){
    if(closed||inFlight.has(s.id))return;
    inFlight.add(s.id);
    try{
      const old=sources[s.id],next=await scan(s,old,Date.now(),controller.signal);
      if(closed)return;
      sources[s.id]=next;
      if(old?.items?.[0]?.url!==next.items?.[0]?.url||old?.items?.length!==next.items.length||old?.ok!==next.ok)revision++;
    }finally{inFlight.delete(s.id);}
  }
  async function fastTick(){
    await ready;if(closed)return;
    const fast=(await publisherCatalog()).filter(s=>s.format==='list'||s.role==='official'&&sources[s.id]?.ok||['campreview.jp','web.goout.jp','socialbeta.com','digitaling.com','foodaily.com','marketingdive.com','adweek.com'].includes(s.id))
      .filter(s=>!inFlight.has(s.id)&&Date.now()-(Date.parse(sources[s.id]?.checkedAt)||0)>120000)
      .sort((a,b)=>(Date.parse(sources[a.id]?.checkedAt)||0)-(Date.parse(sources[b.id]?.checkedAt)||0)).slice(0,5);
    await Promise.allSettled(fast.map(updateSource));
  }
  async function refresh(concurrency=10,sourceLimit=Infinity){
    await ready;
    if(round)return round;
    round=(async()=>{
      const queue=(await publisherCatalog()).sort((a,b)=>(Date.parse(sources[a.id]?.checkedAt)||0)-(Date.parse(sources[b.id]?.checkedAt)||0)).slice(0,sourceLimit);
      async function worker(){while(queue.length&&!closed){const s=queue.shift();if(Date.now()-(Date.parse(sources[s.id]?.checkedAt)||0)>120000)await updateSource(s);}}
      await Promise.all(Array.from({length:concurrency},worker));
      if(closed)return;
      await mkdir(dataDir,{recursive:true});await writeFile(path+'.'+process.pid+'.tmp',JSON.stringify(sources));await rename(path+'.'+process.pid+'.tmp',path);
      await discovery.refresh(Object.values(sources).flatMap(s=>s.items));revision++;
    })().finally(()=>{round=null;});return round;
  }
  function summary(){
    return Object.values(sources).map(s=>{
      const recent=s.items.filter(r=>consumerContent(r)&&Date.now()-Date.parse(r.publishedAt)<30*day);
      return {domain:s.id,role:s.role||'media',url:s.url,checkedAt:s.checkedAt,active:s.ok&&Date.now()-Date.parse(s.checkedAt)<day&&recent.length>0,count:recent.length,sample:recent[0]?.url,sampleTitle:recent[0]?.title,date:recent[0]?.publishedAt,error:s.error};
    }).sort((a,b)=>a.domain.localeCompare(b.domain));
  }
  function start(){const quick=()=>fastTick().catch(e=>console.error('优先新闻轮询',e.message));void quick();fastTimer=setInterval(quick,60000);fastTimer.unref();const tick=()=>refresh().catch(e=>console.error('媒体轮询',e.message));void ready.then(()=>{if(!closed){globalIndex.start();}});void tick();timer=setInterval(tick,3*60000);timer.unref();}
  async function search(query,terms){
    await ready;
    const english=terms.find(t=>/^[a-z]/i.test(t))||query;
    const related=beatSites(query);
    const ranked=Object.values(sources).filter(s=>(s.ok||s.items?.length||related.includes(s.id))&&/\/feed\/?$/.test(s.url)).map(s=>{
      const matches=s.items.filter(r=>terms.some(t=>(r.title+' '+r.content).toLowerCase().includes(t.toLowerCase()))).length;
      return {s,matches:matches+(related.includes(s.id)?1000:0)};
    }).sort((a,b)=>b.matches-a.matches);
    const batches=await Promise.allSettled(ranked.slice(0,16).map(async({s})=>{
      const u=new URL(s.url);const chinese=/\.cn$|\.tw$|ifanr|appinn|uisdc|woshipm|toodaylab/.test(s.id);
      const japanese=/\.jp$|cosplaymode|numan\.tokyo/.test(s.id);
      const term=(japanese&&terms.find(t=>/[ァ-ヶぁ-ん]/.test(t)))||(chinese?query:english);
      u.searchParams.set('s',term);
      const r=await fetch(u,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8500)])});
      if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
      const chunks=[];let n=0;for await(const c of r.body){chunks.push(c);n+=c.length;if(n>1800000)break;}
      const xml=Buffer.concat(chunks).toString();if(!/<(?:rss|feed)(?:\s|>)/i.test(xml))throw Error('未返回订阅格式');
      return parsePublisher(xml,s,Date.now()).filter(row=>terms.some(t=>(row.title+' '+row.content).toLowerCase().includes(t.toLowerCase())));
    }));
    if(batches.length&&batches.every(b=>b.status==='rejected'))throw Error('出版方检索接口未返回可用数据');
    return batches.flatMap(b=>b.status==='fulfilled'?b.value:[]);
  }
  async function officialSearch(leads,query){
    await ready;
    const {consumerBrands}=await import('./brand-attention.mjs');
    const needles=new Set(leads.flatMap(n=>[n,...consumerBrands(n)]).map(s=>s.toLowerCase()));
    const specialist=beatSites(query);
    const matches=(await publisherCatalog()).filter(s=>s.role==='official').map(s=>{
      const existing=sources[s.id]?.items||[];
      const own=[s.id,s.name||'',...existing.slice(0,12).map(r=>r.publisher||'')].join(' ');
      const names=consumerBrands(own).map(n=>n.toLowerCase());
      const score=[...needles].filter(n=>names.includes(n)||own.toLowerCase().includes(n)).length*3+(specialist.includes(s.id)?1:0);
      return {s,score};
    }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
    const batches=await Promise.all(matches.map(({s})=>scan(s,sources[s.id],Date.now(),controller.signal)));
    return batches.flatMap(s=>s.items||[]);
  }
  return {ready,refresh,start,summary,search,officialSearch,version:()=>revision,scope:()=>({domains:new Set([...(globalIndex?.sources()||[]).map(r=>r.domain),...Object.values(sources).filter(s=>s.items?.some(r=>Date.parse(r.publishedAt)>Date.now()-30*day)).map(s=>s.id)]).size}),globalSearch:terms=>globalIndex?.search(terms)||[],globalSources:()=>globalIndex?.sources()||[],directFeeds:()=>globalIndex?.directFeeds()||[],patternHistory:()=>globalIndex?.rows(7,6000)||[],globalRecent:()=>(globalIndex?.rows()||[]).filter(r=>!excludedSearchSource(r)),items:()=>[...Object.values(sources).flatMap(s=>s.items),...discovery.items()].filter(r=>consumerContent(r)&&Date.now()-Date.parse(r.publishedAt)<30*day),close(){closed=true;discovery.close();globalIndex?.close();clearInterval(timer);clearInterval(fastTimer);controller.abort();}};
}
