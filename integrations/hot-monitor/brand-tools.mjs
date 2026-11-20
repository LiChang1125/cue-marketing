import {publisherIdentity} from './publisher-identity.mjs';
import {eventCards} from './brand-events.mjs';
import {webNews,publisherCredit} from './open-news.mjs';
import {publicMarketingPress} from '../../server/topic-search.js';
import {originalHref} from '../../shared/original.js';
import {consumerBrands} from './brand-attention.mjs';
import {excludedTopic} from './consumer-market.mjs';

const day=86400000;
const chinaDay=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
const calendarWords=/举办|开幕|启幕|开启|开业|开售|上市|发售|上线|登陆|开场|揭幕|首发|开展|开放|快闪|活动期间|展期/;
const marketAction=/联名|联乘|联动|携手|合作|投资者大会|五年计划|销售目标|增收目标|开设|闭店|关店|签约|客流|门店|赞助|代言|品牌大使|品牌活动|快闪|上市|发售|推出|发布|开业|首发|广告|预售|售罄|销售额|限定|营销|跨界|launch|collab|partnership|campaign|release|debut|unveil|collection|introduc|sponsor|発表|発売|コラボ|グッズ|\s[x×]\s|×/i;
const calendarDate=/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号](?:\s*(?:至|到|—|–|-)\s*(?:(\d{4})\s*年\s*)?(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*[日号])?/;
function dateKey(year,month,d){
  const ms=Date.UTC(year,month-1,d);
  return new Date(ms).getUTCMonth()===month-1&&d>0?new Date(ms).toISOString().slice(0,10):null;
}
function dateSpan(line,publishedAt){
  const m=line.match(calendarDate);if(!m)return;
  const anchor=new Date(Date.parse(publishedAt)+8*3600000);
  const month=Number(m[2]),baseYear=anchor.getUTCFullYear();
  const year=Number(m[1])||(month===1&&anchor.getUTCMonth()>=10?baseYear+1:month===12&&anchor.getUTCMonth()===0?baseYear-1:baseYear);
  const start=dateKey(year,month,Number(m[3]));
  const endMonth=Number(m[5])||month;
  const end=m[6]?dateKey(Number(m[4])||(endMonth<month?year+1:year),endMonth,Number(m[6])):null;
  if(!start||(m[6]&&(!end||end<start)))return;
  return {start,end};
}
export function buildBrandTools(rows,now=Date.now()){
  const events=eventCards(rows,now),leaders=new Map(),calendar=[];
  const today=chinaDay(now);
  for(const e of events){
    if(/体育官方网站|选购攻略|去哪买|各平台优惠对比|朋友们有福了|博彩|官网入口|限时抢购攻略/.test(e.title))continue;
    const names=consumerBrands(e.title+' '+(e.originalTitle||''));
    // Two named collaborators joined by an explicit collaboration marker can be new entrants.
    if(!names.length&&/×|\s[xX]\s|携手/.test(e.title))names.push(...e.parties.filter(n=>!excludedTopic(n)&&n.length>=2&&n.length<=16&&!/[的这新]/.test(n)));
    const age=now-Date.parse(e.publishedAt);
    for(const name of new Set(names)){
      if(age>=14*day||!marketAction.test(e.title+' '+String(e.content||'').slice(0,160)))continue;
      const leader=leaders.get(name)||{name,current:0,previous:0,outlets:new Set(),cases:[]};
      if(age<7*day){
        leader.current++;
        for(const report of e.reports)leader.outlets.add(publisherIdentity(report.url,report.attribution));
        leader.cases.push({title:e.title,url:e.url,date:e.publishedAt,outlets:new Set(e.reports.map(r=>publisherIdentity(r.url,r.attribution))).size,reports:e.reports});
      }
      else leader.previous++;
      leaders.set(name,leader);
    }
    const meta={title:e.title,url:e.url,publisher:e.reports[0].publisher,names};
    const lines=[e.title,...String(e.content||'').replace(/[^。\n]{0,50}\/美通社\/\s*--/g,'').split(/[。！？\n]/)].map(s=>s.trim()).filter(Boolean);
    const dated=lines.find(line=>calendarWords.test(line)&&calendarDate.test(line)&&!/(?:截至|截止).{0,12}月.{0,6}日.{0,10}(?:累计|已达|销量)/.test(line));
    if(dated){const span=dateSpan(dated,e.publishedAt);if(span&&(span.end||span.start)>=chinaDay(now-14*day)&&span.start<=chinaDay(now+180*day))calendar.push({...meta,...span,evidence:dated});}

  }
  const ranking=[...leaders.values()].filter(b=>b.current).map(b=>({...b,outlets:b.outlets.size,delta:b.current-b.previous,cases:b.cases.sort((a,c)=>c.date.localeCompare(a.date))}))
    .sort((a,b)=>b.outlets-a.outlets||b.current-a.current||b.delta-a.delta);
  calendar.sort((a,b)=>a.start.localeCompare(b.start));
  return {ranking,calendar,today};
}
async function verifySharedReports(ranking,credits){
  const reports=ranking.flatMap(b=>b.cases.filter(c=>c.reports.length>1).flatMap(c=>c.reports));
  const now=Date.now(),unique=new Set(reports.filter(r=>!r.attribution).map(r=>r.url));
  const queue=[...unique].filter(url=>!(credits.get(url)?.until>now)).slice(0,64);
  async function worker(){while(queue.length){
    const url=queue.shift();const attribution=await publisherCredit(url).catch(()=>null);
    credits.set(url,{attribution,until:now+(attribution?7*day:3600000)});
  }}
  for(const [k,v] of credits)if(v.until<=now)credits.delete(k);
  await Promise.all(Array.from({length:6},worker));
  for(const brand of ranking){
    const origins=new Set();
    for(const c of brand.cases){
      const group=new Set();
      for(const r of c.reports){
        r.attribution||=credits.get(r.url)?.attribution;
        const identity=publisherIdentity(r.url,r.attribution);origins.add(identity);group.add(identity);
      }
      c.outlets=group.size;
    }
    brand.outlets=origins.size;
  }
  ranking.sort((a,b)=>b.outlets-a.outlets||b.current-a.current||b.delta-a.delta);
}
export function rankingFocus(cases){
 const themes=[['联名合作',/联名|联动|联乘|携手|collab|partnership|コラボ| [x×] /i],['代言与传播',/代言|宣传片|品牌大使|营销|campaign|ambassador|sponsor|赞助|キャンペーン/i],['门店与快闪',/门店|首店|快闪|开业|pop[- ]up|opens? .*store|flagship|オープン/i],['新品发售',/新品|发售|新系列|限量|上市|release|launch|collection|unveil|capsule|発売/i]];
 const counts=new Map();
 for(const c of cases){const theme=themes.find(([,pattern])=>pattern.test(c.title))?.[0];if(theme)counts.set(theme,(counts.get(theme)||0)+1);}
 return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([label,count])=>({label,count}));
}
export function createBrandTools(feed,desk){
  const credits=new Map();
  let cache,pending;
  return async()=>{
    if(cache?.until>Date.now()&&cache.version===desk?.version())return cache.data;
    if(!pending)pending=(async()=>{
      const now=Date.now();
      const [web,...media]=await Promise.all([
        webNews(['品牌 快闪 开幕','品牌 联名 首发','品牌 线下 活动'],['快闪','联名','首发']).catch(()=>[]),
        ...['快闪','联名','首发'].map(q=>publicMarketingPress(q,now-30*day).catch(()=>[]))
      ]);
      const local=(feed().items||[]).map(r=>({...r,url:originalHref(r),content:r.excerpt,source:'editorial'}));
      await desk?.ready;
      const data=buildBrandTools([...(desk?.items()||[]),...(desk?.globalRecent?.()||[]),...web,...media.flat().map(r=>({...r,content:r.excerpt,publisher:r.sourceName})),...local],now);
      await verifySharedReports(data.ranking,credits);
      cache={data,version:desk?.version(),until:now+5*60000};return data;
    })().finally(()=>{pending=null;});
    if(cache){pending.catch(()=>{});return cache.data;}
    return pending;
  };
}
