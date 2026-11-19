import {originalHref} from './original.js';

const dictionary=[
 ['GTA 6',/GTA\s*(?:VI|6)|侠盗猎车手6/i],['英雄联盟',/英雄联盟|LPL|英雄联盟世界赛/i],
 ['EDG',/(?<![a-z])EDG(?![a-z])/i],['BLG',/(?<![a-z])BLG(?![a-z])/i],['王者荣耀',/王者荣耀|王者电竞|KPL/],['宝可梦',/宝可梦|皮卡丘|Pokémon/i],['原神',/原神|Genshin/i],
 ['泡泡玛特',/泡泡玛特|POP MART/i],['LABUBU',/LABUBU|拉布布/i],['华为',/华为|鸿蒙|HUAWEI/i],['小米',/小米(?:汽车|手机|集团|SU|数字|[0-9])|雷军/i],
 ['麦当劳',/麦当劳|McDonald/i],['肯德基',/肯德基|\bKFC\b/i],['瑞幸',/瑞幸|Luckin/i],['霸王茶姬',/霸王茶姬/],
 ['星巴克',/星巴克|Starbucks/i],['苹果',/iPhone|苹果公司|Apple Watch|苹果手机/i],['耐克',/耐克|\bNike\b/i],
 ['迪士尼',/迪士尼|Disney/i],['任天堂',/任天堂|Nintendo/i],['三丽鸥',/三丽鸥|Hello Kitty/i],
 ['两京十五日',/两京十五日/],['恋与深空',/恋与深空/],['名侦探柯南',/名侦探柯南|剧场版柯南/]
];
const ipNames=new Set(['GTA 6','英雄联盟','EDG','BLG','王者荣耀','宝可梦','原神','LABUBU','三丽鸥','两京十五日','恋与深空','名侦探柯南']);
const editorialAliases=new Map([
 ['Ralph Lauren',/\bRalph Lauren\b|拉夫[·\s]?劳伦/i],['Sephora',/\bSephora\b|丝芙兰/i],
 ['阿迪达斯',/\badidas\b|阿迪达斯/i],['OPPO',/\boppo\b/i],['AP',/Audemars Piguet|爱彼(?:表|腕表)/i],
 ['美的',/\bMidea\b|美的(?:集团|空调|冰箱|家电|电器)/i],['骆驼',/Camel品牌|骆驼(?:户外|冲锋衣|鞋|服饰)/i]
]);
const event=/发布|推出|上市|上线|首发|发售|上新|官宣|合作|联名|开幕|夺冠|夺得|世界赛|快闪|上市|launch|collab|partner|release/i;
const collab=/联名|跨界合作|携手|联合推出|collaborat|partners? with|teams? up with|joins? forces/i;
const safe=url=>/^https?:\/\//i.test(url||'');
const disputed=/吐槽|争议|质疑|投诉|翻车|抵制|召回|打假/;
function editorialMatcher(name){
 const known=editorialAliases.get(name)||dictionary.find(([key])=>key===name)?.[1];
 if(known)return known;
 const literal=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(/^[a-z0-9]/i.test(name)?'(?<![a-z0-9])'+literal+'(?![a-z0-9])':literal,'i');
}
function names(row,sales){
 const text=row.originalTitle||row.title;
 if(row.entity){
   const exact=[...dictionary,...editorialAliases].find(([,re])=>re.test(row.entity));
   return [exact?.[0]||row.entity];
 }
 const names=dictionary.filter(([,match])=>match.test(text)).map(([name])=>name);
 for(const name of sales){
   if(dictionary.some(([key])=>key===name))continue;
   const ambiguous={美的:/Midea|美的(?:集团|空调|冰箱|家电|电器)/i,骆驼:/Camel品牌|骆驼(?:户外|冲锋衣|鞋|服饰)/i};
   if(ambiguous[name]?ambiguous[name].test(text):name.length>1&&text.includes(name))names.push(name);
 }
 for(const m of text.matchAll(/《([^《》]{2,20})》/g))names.push(m[1]);
 return [...new Set(names)];
}
export function discovery(data={},articles=[],now=Date.now(),native=[]){
 const today=new Date(now+28800000).toISOString().slice(0,10);
 const days=Array.from({length:7},(_,i)=>new Date(now+28800000-(6-i)*86400000).toISOString().slice(0,10));
 const rows=(data.rows||[]).filter(r=>days.includes(r.day)&&safe(r.url)&&safe(r.source));
 for(const item of native){
   if(!/bilibili|zhihu/.test(item.source)||!item.observedAt||item.contentType!=='hot-topic'||!safe(item.url))continue;
   const day=item.observedAt.slice(0,10),rank=item.rank;
   if(!days.includes(day)||!Number.isInteger(rank)||rank<1)continue;
   const bili=item.source.includes('bilibili');
   rows.push({platform:bili?'B站':'知乎',series:bili?'B站热搜':'知乎热榜',title:item.title,day,rank,url:item.url,source:item.url});
 }
 const cases=[...articles,...(data.editorialCases||[])].filter(i=>Date.parse(i.publishedAt)<=now&&Date.parse(i.publishedAt)>=now-7*86400000&&originalHref(i));
 const candidates=new Map();
 const sales=new Set(rows.filter(r=>r.series==='蝉妈妈品牌销售榜').map(r=>r.entity).filter(Boolean));
 function add(map,key,row){if(!map.has(key))map.set(key,[]);map.get(key).push(row);}
 for(const r of rows){
   if(/APEC|外国政要|中美元首|特朗普|普京|外交部|习近平|俄乌|以色列/.test(r.title))continue;
   for(const name of names(r,sales))add(candidates,name,r);
 }
 function build([name,matches]){
   const match=editorialMatcher(name);
   const related=cases.filter(i=>[i.title,i.originalTitle].some(t=>t&&match.test(t)));
   if(!related.length)return null;
   const isIP=ipNames.has(name)||matches.some(r=>r.title.includes('《'+name+'》'))&&related.some(i=>/游戏|电影|剧集|小说|角色|动画|漫画|纪录片|IP\b/i.test(i.title+' '+(i.excerpt||'')));
   if(!isIP&&!dictionary.some(([key])=>key===name)&&!matches.some(r=>r.entity))return null;
   const bySeries=Map.groupBy?Map.groupBy(matches,r=>r.series):matches.reduce((m,r)=>m.set(r.series,[...(m.get(r.series)||[]),r]),new Map());
   const tracks=[...bySeries].map(([series,values])=>{
     const points=days.map(day=>values.filter(v=>v.day===day).sort((a,b)=>a.rank-b.rank)[0]||null);
     const samples=points.filter(Boolean),last=samples.at(-1),first=samples[0];
     return {series,points,last,first,days:samples.length,change:first.rank-last.rank};
   }).sort((a,b)=>b.last.day.localeCompare(a.last.day)||b.days-a.days||a.last.rank-b.last.rank);
   const platforms=new Set(matches.map(r=>r.platform)).size;
   const timestamps=new Set(matches.map(r=>r.day)).size;
   const last=tracks[0].last;
   related.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
   const story=related.find(i=>event.test(i.title+' '+(i.originalTitle||'')))||related[0];
   const trigger=matches.filter(r=>event.test(r.title)).sort((a,b)=>b.day.localeCompare(a.day)||a.rank-b.rank)[0];
   const subjects=[...new Set(matches.slice().sort((a,b)=>b.day.localeCompare(a.day)||a.rank-b.rank).map(r=>r.title))];
   const controversy=matches.find(r=>disputed.test(r.title));
   return {name,isIP,tracks,platforms,timestamps,subjects,last,story,trigger,controversy};
 }
 const brands=[...candidates].map(build).filter(Boolean).sort((a,b)=>b.last.day.localeCompare(a.last.day)||b.platforms-a.platforms||b.timestamps-a.timestamps||a.last.rank-b.last.rank||a.name.localeCompare(b.name));
 const unique=new Set();
 const partnerships=cases.filter(i=>collab.test(i.title+' '+(i.originalTitle||''))).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(i=>{const key=originalHref(i);if(unique.has(key))return false;unique.add(key);return true;});
 return {brands,partnerships,days,today};
}
