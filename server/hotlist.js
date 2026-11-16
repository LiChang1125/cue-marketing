import {scopedItems} from './relevance.js';
import {recentPublication,isMarketingCase} from '../shared/insights.js';
import {freshness} from '../src/freshness.js';

const platform=id=>id.startsWith('bilibili')?'bilibili':id;
const normalized=text=>String(text).toLowerCase().replace(/[\s\p{P}]/gu,'');
function similar(a,b){
  a=normalized(a);b=normalized(b);if(a===b)return true;if(a.length<12||b.length<12)return false;
  const grams=t=>new Set(Array.from({length:t.length-1},(_,i)=>t.slice(i,i+2)));
  const x=grams(a),y=grams(b),intersection=[...x].filter(g=>y.has(g)).length;
  return intersection/(x.size+y.size-intersection)>=.65;
}
export function marketingHotlist(rawItems,sources=[],now=Date.now()){
  const sourceMap=Object.fromEntries(sources.map(s=>[s.id,s]));
  const items=scopedItems(rawItems).filter(i=>recentPublication(i,now)&&isMarketingCase(i));
  const buckets=new Map();
  for(const item of items){
    if(sources.length&&freshness(item.fetchedAt,sourceMap[item.source],now)!=='fresh')continue;
    const metric=['likes','views'].find(k=>Number.isFinite(item.metrics?.[k])&&item.metrics[k]>0);
    if(metric){const key=platform(item.source)+':'+metric;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({id:item.id,value:item.metrics[metric]});}
  }
  const relative=new Map();for(const rows of buckets.values())for(const row of rows)relative.set(row.id,rows.length>=3?rows.filter(r=>r.value<row.value).length/(rows.length-1):0);
  const events=[];
  for(const item of items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))){
    const event=events.find(e=>e.items.some(i=>i.url?.split('?')[0]===item.url?.split('?')[0]||similar(i.title,item.title)));
    if(event)event.items.push(item);else events.push({items:[item]});
  }
  return events.map(event=>{
    const item=event.items.find(i=>['socialbeta','brandstar'].includes(i.source))||event.items[0];
    const platforms=[...new Set(event.items.map(i=>platform(i.source)))];
    const recency=Math.max(0,1-(now-Math.max(...event.items.map(i=>Date.parse(i.publishedAt))))/(7*86400000));
    const score=recency*.5+Math.max(...event.items.map(i=>relative.get(i.id)||0))*.3+Math.min(1,(platforms.length-1)/3)*.2;
    return {...item,mentions:event.items.length,platformCount:platforms.length,evidence:event.items.map(i=>({id:i.id,title:i.title,url:i.url,source:i.source})),score};
  }).sort((a,b)=>b.score-a.score||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,10).map(({score,...item},index)=>({...item,hotRank:index+1}));
}
