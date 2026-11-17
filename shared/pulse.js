import {topicMatches,uniqueCases,isMarketingCase} from './insights.js';
import {defaultPulseValue,pulseValue,pulseDate} from './pulse-content.js';
const day=at=>new Date(at).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
export function mergeRankHistory(previous=[],current=[],now=Date.now()){
  const points=new Map();
  for(const p of [...previous,...current]){
    const at=Date.parse(p.at);
    if(!Number.isFinite(at)||at>now+300000||at<now-30*86400000||!Number.isInteger(p.rank)||p.rank<1)continue;
    points.set([p.source,p.url,p.at].join('|'),p);
  }
  return [...points.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
}
export function topicPulse(items,history,{query='',days=7,platform='all',now=Date.now()}={}){
  const match=i=>query?topicMatches({...i,excerpt:[i.excerpt,i.originalTitle,i.originalExcerpt].join(' ')},query):defaultPulseValue(i);
  const start=Date.parse(day(now)+'T00:00:00+08:00')-(days-1)*86400000;
  const articles=uniqueCases(items.filter(i=>pulseValue(i)&&match(i)&&Date.parse(pulseDate(i))>=start&&Date.parse(pulseDate(i))<=now)).sort((a,b)=>(a.contentType==='hot-topic')-(b.contentType==='hot-topic')||Date.parse(pulseDate(b))-Date.parse(pulseDate(a)));
  const ranks=history.filter(i=>(query?match(i):isMarketingCase(i)&&/品牌|营销|联名|广告|代言|潮玩|香水|香氛|文创|泡泡玛特|消费|零售|新品|双11|双十一|brand|campaign|marketing/i.test(i.title))&&(platform==='all'||i.source===platform)&&Date.parse(i.at)>=start&&Date.parse(i.at)<=now);
  const series=Array.from({length:days},(_,i)=>{const date=day(now-(days-1-i)*86400000);return {date,label:date.slice(5).replace('-','/'),count:articles.filter(a=>a.publishedAt&&day(a.publishedAt)===date).length};});
  const groups=new Map();for(const r of ranks){const key=r.source+'|'+r.url;let g=groups.get(key);if(!g){g={...r,points:[]};groups.set(key,g);}g.points.push(r);}
  const trajectories=[...groups.values()].sort((a,b)=>Math.min(...a.points.map(p=>p.rank))-Math.min(...b.points.map(p=>p.rank))).slice(0,8);
  // Diversify ten results first; then fill remaining slots without discarding relevance.
  const selected=[],counts=new Map();for(const item of articles){if((counts.get(item.source)||0)>=3)continue;selected.push(item);counts.set(item.source,(counts.get(item.source)||0)+1);if(selected.length===10)break;}
  for(const item of articles){if(selected.length===10)break;if(!selected.includes(item))selected.push(item);}
  return {articles:selected,total:articles.filter(i=>i.publishedAt).length,mediaCount:new Set(articles.filter(i=>i.publishedAt).map(i=>i.source)).size,series,trajectories,hotTopics:groups.size};
}
