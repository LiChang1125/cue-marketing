import {scopedItems} from './relevance.js';
import {sectors,directions,sectorId,directionIds,recentPublication,uniqueCases,marketingLogic,isMarketingCase} from '../shared/insights.js';
import {freshness} from '../src/freshness.js';

const DAY=86400000;
function observation(item,history,now){
  const points=history.filter(p=>Date.parse(p.at)>=now-DAY&&Date.parse(p.at)<=now).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  for(const metric of ['views','likes','topicViews']){
    const valid=points.filter(p=>Number.isFinite(p[metric])&&p[metric]>=0);
    if(valid.length<2)continue;
    const a=valid[0],b=valid.at(-1);if(Date.parse(b.at)-Date.parse(a.at)<600000)continue;
    return {id:item.id,source:item.source,metric,before:a[metric],after:b[metric],delta:b[metric]-a[metric],minutes:Math.round((Date.parse(b.at)-Date.parse(a.at))/60000)};
  }
  return null;
}
function summarize(items,observations,now){
  const recent=items.filter(i=>isMarketingCase(i)&&recentPublication(i,now));
  const previous=items.filter(i=>{const at=Date.parse(i.publishedAt);return isMarketingCase(i)&&at<now-7*DAY&&at>=now-14*DAY;});
  // Historical articles discovered today do not establish a historical collection baseline.
  const sustainedSources=new Set(items.filter(i=>Date.parse(i.firstSeen)<=now-14*DAY).map(i=>i.source));
  const comparableSources=[...new Set(recent.map(i=>i.source))].filter(source=>sustainedSources.has(source)&&previous.some(i=>i.source===source));
  const currentComparable=recent.filter(i=>comparableSources.includes(i.source)).length;
  const previousComparable=previous.filter(i=>comparableSources.includes(i.source)).length;
  const ids=new Set(items.filter(i=>recentPublication(i,now)||!i.publishedAt).map(i=>i.id));
  const signals=observations.filter(o=>ids.has(o.id)),rising=signals.filter(o=>o.delta>0).length;
  const cohorts=Object.values(signals.reduce((map,o)=>{
    const key=o.source+':'+o.metric;const group=map[key]??={source:o.source,metric:o.metric,before:0,after:0,delta:0,count:0,rising:0,minMinutes:Infinity,maxMinutes:0};
    group.before+=o.before;group.after+=o.after;group.delta+=o.delta;group.count++;group.rising+=o.delta>0?1:0;group.minMinutes=Math.min(group.minMinutes,o.minutes);group.maxMinutes=Math.max(group.maxMinutes,o.minutes);return map;
  },{})).map(g=>({...g,percent:g.before>0?g.delta/g.before*100:null}));
  const changePercent=previousComparable&&comparableSources.length?(currentComparable-previousComparable)/previousComparable*100:null;
  const heating=cohorts.some(g=>g.count>=3&&g.rising/g.count>=.6&&g.delta>0);
  const cooling=signals.length>=3&&signals.filter(o=>o.delta<0).length/signals.length>=.6;
  const status=heating?'互动升温':changePercent!==null&&currentComparable>=3&&changePercent>0?'报道增多':cooling?'互动回落':signals.length>=3?'变化分化':'持续观察';
  const sourceCount=new Set(recent.map(i=>i.source)).size;
  return {recentCount:recent.length,sourceCount,undatedCount:items.filter(i=>!i.publishedAt).length,comparableCount:signals.length,risingCount:rising,cohorts,changePercent,currentComparable,previousComparable,status,
    summary:recent.length?`近 7 天有 ${recent.length} 个相关案例，来自 ${sourceCount} 个来源。${signals.length?`${signals.length} 个可比较样本中，${rising} 个互动指标增加。`:''}`:signals.length?`近期 ${signals.length} 个话题或内容可比较，${rising} 个互动指标增加。`:'近期案例仍在积累。',
    cases:recent.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,4).map(i=>({...i,logic:marketingLogic(i)}))};
}
export function trendInsights(rawItems,historyFor,now=Date.now(),sources=[],days=7){
  const items=uniqueCases(scopedItems(rawItems));const sourceMap=Object.fromEntries(sources.map(s=>[s.id,s]));
  const observations=items.flatMap(i=>{
    if(sources.length&&freshness(i.fetchedAt,sourceMap[i.source],now)!=='fresh')return [];
    const result=observation(i,historyFor(i.id),now);return result?[result]:[];
  });
  const groups=sectors.map(s=>{const subset=items.filter(i=>sectorId(i)===s.id);return {...s,...summarize(subset,observations,now),directions:directions.map(d=>({id:d.id,name:d.name,...summarize(subset.filter(i=>directionIds(i).includes(d.id)),observations,now)})).filter(d=>d.recentCount||d.comparableCount).sort((a,b)=>(b.status==='互动升温')-(a.status==='互动升温')||b.recentCount-a.recentCount)};});
  for(const group of groups){const top=group.directions.filter(d=>d.recentCount).slice(0,2);if(top.length)group.summary=`近期案例集中在${top.map(d=>`${d.name}（${d.recentCount} 个）`).join('、')}。`+group.summary;group.chartItems=items.filter(i=>sectorId(i)===group.id&&isMarketingCase(i)&&recentPublication(i,now,31));}
  days=days===30?30:7;
  const today=Math.floor((now+8*3600000)/DAY)*DAY-8*3600000;
  const start=today-(days-1)*DAY;
  const recent=items.filter(i=>{const at=Date.parse(i.publishedAt);return at>=start&&at<=now;});
  const daily=Array.from({length:days},(_,index)=>{const begin=start+index*DAY,end=begin+DAY;return {id:new Date(begin+8*3600000).toISOString().slice(0,10),start:begin,end,count:recent.filter(i=>Date.parse(i.publishedAt)>=begin&&Date.parse(i.publishedAt)<end).length};});
  const distribution=Object.entries(recent.reduce((m,i)=>{m[i.source]=(m[i.source]||0)+1;return m;},{})).map(([source,count])=>({source,count})).sort((a,b)=>b.count-a.count);
  const signal=summarize(items,observations,now);
  const activity={days,start,end:now,recentCount:recent.length,sourceCount:distribution.length,daily,distribution,comparableCount:signal.comparableCount,risingCount:signal.risingCount,cohorts:signal.cohorts};
  return {windowDays:7,groups,activity,totalRecent:items.filter(i=>isMarketingCase(i)&&recentPublication(i,now)).length,sourceCount:new Set(items.filter(i=>isMarketingCase(i)&&recentPublication(i,now)).map(i=>i.source)).size};
}
