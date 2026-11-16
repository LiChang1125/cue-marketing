import { scopedItems } from './relevance.js';
export function trendStats(items,historyFor,now=Date.now(),topicItems=null){
  items=scopedItems(items);
  const firstSeen=i=>Date.parse(topicItems?.find(x=>x.id===i.id)?.discoveredAt||i.firstSeen);
  const oldest=Math.min(now,...items.map(firstSeen).filter(Number.isFinite));
  const current=items.filter(i=>firstSeen(i)>now-86400000&&firstSeen(i)<=now).length;
  const previous=items.filter(i=>firstSeen(i)>now-2*86400000&&firstSeen(i)<=now-86400000).length;
  const distribution=Object.entries(items.reduce((m,i)=>({...m,[i.source]:(m[i.source]||0)+1}),{})).map(([source,count])=>({source,count})).sort((a,b)=>b.count-a.count);
  const changes=[];
  for(const item of items){
    const points=historyFor(item.id).filter(p=>Date.parse(p.at)>=now-86400000&&Date.parse(p.at)<=now);
    for(const metric of ['views','likes','topicViews']){
      const valid=points.filter(p=>Number.isFinite(p[metric]));
      const a=valid[0],b=valid.at(-1);
      if(valid.length<2||Date.parse(b.at)-Date.parse(a.at)<10*60000)continue;
      const delta=b[metric]-a[metric];
      changes.push({id:item.id,title:item.title,url:item.url,source:item.source,metric,start:a.at,end:b.at,before:a[metric],after:b[metric],delta,percent:a[metric]>0?Math.round(delta/a[metric]*1000)/10:null,points:valid.map(p=>({at:p.at,value:p[metric]}))});
      break;
    }
  }
  const hourly=Array.from({length:24},(_,i)=>({at:new Date(now-(23-i)*3600000).toISOString(),count:0}));
  for(const item of items){const elapsed=now-firstSeen(item);if(elapsed>=0&&elapsed<86400000)hourly[23-Math.floor(elapsed/3600000)].count++;}
  const groups=new Map();
  for(const change of changes.sort((a,b)=>Date.parse(b.end)-Date.parse(a.end))){if(!groups.has(change.source))groups.set(change.source,[]);groups.get(change.source).push(change);}
  const displayed=[];
  for(let row=0;displayed.length<8;row++){let found=false;for(const group of groups.values()){if(group[row]){displayed.push(group[row]);found=true;}if(displayed.length===8)break;}if(!found)break;}
  return {generatedAt:new Date(now).toISOString(),total:items.length,new24h:current,previous24h:now-oldest>=2*86400000?previous:null,changePercent:now-oldest>=2*86400000&&previous>0?Math.round((current-previous)/previous*1000)/10:null,observedSince:items.length?new Date(oldest).toISOString():null,distribution,hourly,comparableCount:changes.length,changes:displayed};
}
