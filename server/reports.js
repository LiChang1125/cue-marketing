import { load } from 'cheerio';
import { freshness } from '../src/freshness.js';
import { isRelevant, relevance } from './relevance.js';

export function shanghaiDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function reportSchedule(now = new Date()) {
  const day=shanghaiDay(now), due=new Date(`${day}T08:00:00+08:00`);
  return {day,due:due.toISOString(),ready:now>=due,next:new Date(due.getTime()+(now>=due?86400000:0)).toISOString()};
}
export function yesterdayWindow(now=new Date()){
  const end=new Date(`${shanghaiDay(now)}T00:00:00+08:00`).getTime();
  return {start:end-86400000,end,newsDate:shanghaiDay(new Date(end-1))};
}
export function marketingSection(item) {
  const text=String(item.title||'');
  if (/联名|跨界|IP合作|IP联动|代言|品牌大使/i.test(text)||relevance(item)?.categories.includes('ip')) return '联名与 IP';
  if (/平台|电商|投放|直播带货|营销|广告|短片|快闪|种草/.test(item.title)) return '平台与营销';
  if (/新品|新店|消费|零售|开店|茶饮|咖啡|美妆|潮玩|盲盒|耳机|相机|推出|发布/.test(item.title)) return '新品与消费';
  if (/品牌|发布|推出/.test(text)||item.categories?.includes('brand')) return '品牌与公司';
  return null;
}
export function selectReportItems(items,sources,now=new Date()) {
  const sourceMap=Object.fromEntries(sources.map(s=>[s.id,s]));
  const {start,end}=yesterdayWindow(now),seen=new Set();
  return items.filter(i=>{
    const published=Date.parse(i.publishedAt);
    return isRelevant(i)&&marketingSection(i)&&published>=start&&published<end&&freshness(i.fetchedAt,sourceMap[i.source],now.getTime())==='fresh'&&/^https:\/\//.test(i.url||'');
  }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(i=>{
    const key=i.title.replace(/[\s\p{P}]/gu,'').toLowerCase();
    if(seen.has(key)||seen.has(i.url))return false;seen.add(key);seen.add(i.url);return true;
  }).slice(0,12);
}
export function extractReportExcerpt(html) {
  const $=load(html);
  const body=$('.content').first().clone();
  body.find('script,style,iframe').remove();body.find('br').replaceWith('\n');
  const paragraphs=body.text().split(/\n+/).map(p=>p.replace(/\s+/g,' ').trim()).filter(p=>p.length>=20&&!/^[〇©]|^图源|^图片/.test(p));
  const lead=paragraphs.find(p=>/推出|发布|宣布|上线|开设|开业|联名|携手|合作|官宣|营销|广告|活动/.test(p));
  if(lead){const sentences=lead.match(/[^。！？]+[。！？]?/g)||[lead];let excerpt='';for(const sentence of sentences){if(excerpt.length+sentence.length>180)break;excerpt+=sentence;if(excerpt.length>=90)break;}return excerpt||lead.slice(0,180)+'…';}
  const description=$('meta[name="description"]').attr('content')?.replace(/\s+/g,' ').trim();
  // Extract source sentences. Never infer event details from the headline.
  return description&&description.length>=8?description.slice(0,160)+(description.length>160?'…':''):null;
}
export async function buildReport(items,sources,now=new Date(),fetcher=fetch) {
  const selected=selectReportItems(items,sources,now),sourceMap=Object.fromEntries(sources.map(s=>[s.id,s]));
  const entries=[];
  for(const item of selected){
    let excerpt=item.excerpt||null;
    if(/^https:\/\/socialbeta\.com\/(campaign|article)\/\d+$/.test(item.url)){
      try{const r=await fetcher(item.url,{signal:AbortSignal.timeout(8000),redirect:'error'});if(r.ok)excerpt=extractReportExcerpt(await r.text());}catch{/* An unavailable full article stays a linked headline. */}
    }
    entries.push({id:item.id,title:item.title,url:item.url,image:item.image||null,source:item.source,sourceName:sourceMap[item.source]?.name||item.source,publishedAt:item.publishedAt,fetchedAt:item.fetchedAt,section:['socialbeta','brandstar'].includes(item.source)?marketingSection(item):'社交平台线索',excerpt,attribution:['socialbeta','brandstar'].includes(item.source)?'行业媒体报道':'平台用户内容'});
  }
  const schedule=reportSchedule(now);
  const coverage=sources.filter(s=>['socialbeta','brandstar'].includes(s.id)||entries.some(e=>e.source===s.id)).map(s=>({id:s.id,name:s.name,state:freshness(s.lastSuccess,s,now.getTime()),lastSuccess:s.lastSuccess||null}));
  const missing=coverage.filter(s=>s.state!=='fresh');
  const window=yesterdayWindow(now);
  return {date:schedule.day,newsDate:window.newsDate,title:'CUE 早报',subtitle:entries.slice(0,3).map(i=>i.title).join('；'),scheduledAt:schedule.due,generatedAt:now.toISOString(),windowStart:new Date(window.start).toISOString(),windowEnd:new Date(window.end).toISOString(),late:now.getTime()-Date.parse(schedule.due)>5*60000,status:!entries.length?'insufficient':missing.length?'partial':'ready',entries,coverage,omittedUndated:items.filter(i=>marketingSection(i)&&!i.publishedAt).length};
}
