import {originalHref} from './original.js';

const dictionary=[
 ['GTA 6',/GTA\s*(?:VI|6)|侠盗猎车手6/i],['英雄联盟',/英雄联盟|LPL|英雄联盟世界赛/i],
 ['EDG',/\bEDG|EDG战队/i],['BLG',/BLG/i],['王者荣耀',/王者荣耀|王者电竞|KPL/],['宝可梦',/宝可梦|皮卡丘|Pokémon/i],['原神',/原神|Genshin/i],
 ['泡泡玛特',/泡泡玛特|POP MART/i],['LABUBU',/LABUBU|拉布布/i],['华为',/华为|鸿蒙|HUAWEI/i],['小米',/小米(?:汽车|手机|集团|SU|数字|[0-9])|雷军/i],
 ['麦当劳',/麦当劳|McDonald/i],['肯德基',/肯德基|\bKFC\b/i],['瑞幸',/瑞幸|Luckin/i],['霸王茶姬',/霸王茶姬/],
 ['星巴克',/星巴克|Starbucks/i],['苹果',/iPhone|苹果公司|Apple Watch|苹果手机/i],['耐克',/耐克|\bNike\b/i],
 ['迪士尼',/迪士尼|Disney/i],['任天堂',/任天堂|Nintendo/i],['三丽鸥',/三丽鸥|Hello Kitty/i],
 ['两京十五日',/两京十五日/],['恋与深空',/恋与深空/],['名侦探柯南',/名侦探柯南|剧场版柯南/]
];
const formats=[
 ['手作改造',/拼豆|手作|手工改造|自制周边|DIY/i],
 ['妆造仿拍',/仿妆|妆容|美甲|淡颜|妆教|出片|拍照姿势/],
 ['线下打卡',/快闪|打卡|市集|主题街区/],
 ['联名周边',/联名|限定周边|痛包|谷子/],
 ['参与式挑战',/舞蹈大赛|挑战赛|接力挑战|翻跳|跟跳/]
];
const event=/发布|推出|上市|上线|首发|发售|上新|官宣|合作|联名|开幕|夺冠|夺得|世界赛|快闪|上市|launch|collab|partner|release/i;
const collab=/联名|跨界合作|携手|联合推出|collaborat|partners? with|teams? up with|joins? forces/i;
const safe=url=>/^https?:\/\//i.test(url||'');
// Specific objects in community headlines, kept separate from brand sales and campaign formats.
const objects=/羽绒服|冲锋衣|拼豆|火漆印章|冰箱贴|痛包|卡牌|徽章|谷子|盲盒|手办|毛绒挂件|手机壳|机械键盘|香水|球鞋|碎钻美甲|爆米花馒头|数码相机|拍立得|流沙麻将/g;
const disputed=/吐槽|争议|质疑|投诉|翻车|抵制|召回|打假/;
function names(row,sales){
 const text=row.originalTitle||row.title;
 if(row.entity)return [row.entity];
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
 const cases=[...(data.cases||[]),...articles].filter(i=>Date.parse(i.publishedAt)<=now&&Date.parse(i.publishedAt)>=now-7*86400000&&originalHref(i));
 const candidates=new Map(),methods=new Map(),products=new Map();
 const sales=new Set(rows.filter(r=>r.series==='蝉妈妈品牌销售榜').map(r=>r.entity).filter(Boolean));
 function add(map,key,row){if(!map.has(key))map.set(key,[]);map.get(key).push(row);}
 for(const r of rows){
   if(/APEC|外国政要|中美元首|特朗普|普京|外交部|习近平|俄乌|以色列/.test(r.title))continue;
   for(const name of names(r,sales))add(candidates,name,r);
   for(const [name,re] of formats)if(re.test(r.title))add(methods,name,r);
   for(const name of new Set(r.title.match(objects)||[]))add(products,name,r);
 }
 function build([name,matches]){
   const bySeries=Map.groupBy?Map.groupBy(matches,r=>r.series):matches.reduce((m,r)=>m.set(r.series,[...(m.get(r.series)||[]),r]),new Map());
   const tracks=[...bySeries].map(([series,values])=>{
     const points=days.map(day=>values.filter(v=>v.day===day).sort((a,b)=>a.rank-b.rank)[0]||null);
     const samples=points.filter(Boolean),last=samples.at(-1),first=samples[0];
     return {series,points,last,first,days:samples.length,change:first.rank-last.rank};
   }).sort((a,b)=>b.last.day.localeCompare(a.last.day)||b.days-a.days||a.last.rank-b.last.rank);
   const platforms=new Set(matches.map(r=>r.platform)).size;
   const timestamps=new Set(matches.map(r=>r.day)).size;
   const last=tracks[0].last;
   const match=dictionary.find(([key])=>key===name)?.[1]||formats.find(([key])=>key===name)?.[1];
   const stories=cases.filter(i=>[i.title,i.originalTitle].some(t=>t&&(match?match.test(t):t.includes(name)))&&event.test(i.title+' '+(i.originalTitle||''))).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
   const trigger=matches.filter(r=>event.test(r.title)).sort((a,b)=>b.day.localeCompare(a.day)||a.rank-b.rank)[0];
   const subjects=[...new Set(matches.slice().sort((a,b)=>b.day.localeCompare(a.day)||a.rank-b.rank).map(r=>r.title))];
   const controversy=matches.find(r=>disputed.test(r.title));
   return {name,tracks,platforms,timestamps,subjects,last,story:stories[0],trigger,controversy};
 }
 const sorted=map=>[...map].map(build).sort((a,b)=>b.last.day.localeCompare(a.last.day)||b.platforms-a.platforms||b.timestamps-a.timestamps||a.last.rank-b.last.rank||a.name.localeCompare(b.name));
 const mentions=rows.filter(r=>r.platform==='Instagram');
 const latestDay=mentions.reduce((d,r)=>d>r.day?d:r.day,'');
 const instagram=mentions.filter(r=>r.day===latestDay).sort((a,b)=>a.rank-b.rank);
 const unique=new Set();
 const partnerships=cases.filter(i=>collab.test(i.title+' '+(i.originalTitle||''))).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(i=>{const key=originalHref(i);if(unique.has(key))return false;unique.add(key);return true;});
 const popularObjects=sorted(products).sort((a,b)=>b.subjects.length-a.subjects.length||b.platforms-a.platforms);
 return {brands:sorted(candidates),methods:sorted(methods),products:popularObjects,partnerships,instagram,days,today,cases:data.cases?.filter(c=>cases.includes(c))||[]};
}
