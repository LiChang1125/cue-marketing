import {createHash} from 'node:crypto';
import {consumerBrands,heatAt} from './brand-attention.mjs';
import {publisherIdentity} from './publisher-identity.mjs';
const day=86400000;
const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
const patterns=[
 ['品牌与 IP 的联名合作',/联[名动乘]|聯[名動乘]|コラボ|collab|licensing/i,/动漫|游戏|漫画|角色|动画|周边|玩具|电影|卡通|授权|宝可梦|迪士尼|小丸子|三丽鸥|IP\b|anime|character|Disney|Pok.mon|figurine/i],
 ['门店里的跨界体验',/快闪|快閃|主题店|主題店|改造|改成|pop.up|限时店/i,/门店|商店|空间|空间|線下|空間|店|场馆|store|shop|bakery/i],
 ['赛事与运动品牌合作',/冠名|赞助|贊助|联名|合作|sponsor|partnership/i,/赛事|马拉松|足球|赛季|越野|篮球|跑鞋|F1\b|marathon|league|football/i],
 ['饮食品牌的跨界联名',/联名|联乘|聯名|コラボ|collab/i,/咖啡|饮品|餐厅|奶茶|烘焙|食品|啤酒|食物|冰淇淋|coffee|brew|bakery|restaurant/i],
 ['服饰与鞋履的联名系列',/联名|联乘|聯名|collab|capsule collection/i,/服饰|时装|鞋|运动服|街头|牛仔|fashion|sneaker|footwear|apparel/i],
 ['香氛与美妆的新品发布',/首发|发布|上市|推出|首秀|新品|launch|debut|unveil/i,/香水|香氛|彩妆|护肤|fragrance|cosmetic|perfume/i],
 ['品牌与代言人的合作',/代言|品牌大使|ambassador/i,/官宣|宣布|携手|签约|出任|成为|announc|appoint/i]
];
function signals(e){
 const headline=e.originalTitle||e.title,brands=consumerBrands(headline),names=[...new Set([...brands,...(e.parties||[])].map(key).filter(k=>k.length>=2))];
 const quoted=[...headline.matchAll(/[「《“『]([^」》”』]{3,35})[」》”』]/gu)].map(m=>key(m[1]));
 const models=headline.match(/\b[A-Za-z]{2,}[ -]?\d{2,5}[A-Za-z]?\b/g)||[];
 const keys=[];
 for(const b of names){for(const a of [...quoted,...models.map(key)])keys.push('named:'+b+'|'+a);}
 if(brands.length===2&&/联[名动乘]|聯名|合作|コラボ|collab|\s[x×]\s/i.test(headline))keys.push('duo:'+brands.map(key).sort().join('|'));
 return keys;
}
function stage(title){
 if(/测评|实测|评测|开箱|体验报告|試穿|试穿|到店探访|review|hands.on/i.test(title))return '体验与测评';
 if(/售罄|排队|销量|反馈|补货|售出|sold.out|restock/i.test(title))return '市场反响';
 if(/复盘|解读|观察|为何|为什么|解析|analysis/i.test(title))return '分析与观点';
 if(/首发|发售|官宣|首店|发布|揭幕|推出|开幕|launch|unveil|debut/i.test(title))return '发布与落地';
 return '相关报道';
}
function describe(group,now){
 const sources=new Map(),copies=new Map(),reports=[],urls=new Set();
 for(const e of group.events){
   for(const r of e.reports){
     if(urls.has(r.url))continue;urls.add(r.url);
     const credit=publisherIdentity(r.url,r.attribution),origin=r.attribution?(credit===new URL(r.url).hostname.replace(/^www\./,'')?'credit:'+key(r.attribution):credit):credit;
     // Mirrors carrying the same headline or the same release copy do not provide additional confirmation.
     const headline=key(r.title),copyKeys=[...(headline.length>=12?['title:'+headline]:[]),...(r.copyId?['copy:'+r.copyId]:[])];
     const identity=copyKeys.map(k=>copies.get(k)).find(Boolean)||origin;
     for(const k of copyKeys)copies.set(k,identity);
     const row={...r,identity,stage:stage(r.title)};reports.push(row);
     if(!sources.has(identity))sources.set(identity,{name:r.attribution||r.publisher,url:r.url,role:r.role||'media',domain:new URL(r.url).hostname});
   }
 }
 if(sources.size<2)return;
 reports.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt));
 if(now-Date.parse(reports.at(-1).publishedAt)>=2*day)return;
 const lead=group.events[0],people=[...sources.values()],heat=heatAt(reports,now),prior=heatAt(reports,now-day);
 if(!heat)return;
 const trend=Array.from({length:24},(_,i)=>{const at=now-(23-i)*3600000;return {at,value:heatAt(reports,at)}});
 const storyId=id(group.key),kind=group.theme?'专题趋势':'事件追踪',title=group.theme||lead.title;
 const brands=[...new Set(group.events.flatMap(e=>consumerBrands(e.title)))];
 return {...lead,storyId,kind,title,reports,people,outlets:sources.size,heat,trend,delta:prior?Math.round((heat-prior)*100/prior):null,
   brand:brands.slice(0,3).join(' × '),firstAt:reports[0].publishedAt,lastAt:reports.at(-1).publishedAt,
   content:group.theme?brands.slice(0,5).join('、')+'等品牌有 '+group.events.length+' 项相关动作，'+sources.size+' 个独立来源提供报道。':lead.content,
   eventCount:group.events.length,publishedAt:reports.at(-1).publishedAt};
}
export function clusterStories(events,now=Date.now()){
 const anchorMap=new Map(),byUrl=new Map(),groups=[];
 const active=events.filter(e=>now-Date.parse(e.publishedAt)<14*day).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt));
 for(const e of active){
   const keys=signals(e);let g=keys.map(k=>anchorMap.get(k)).find(x=>x&&Math.abs(Date.parse(e.publishedAt)-Date.parse(x.events[0].publishedAt))<7*day);
   if(!g)g=(e.citedUrls||[]).map(url=>byUrl.get(url)).find(x=>x&&consumerBrands(e.title).some(n=>consumerBrands(x.events[0].title).includes(n)));
   if(!g){g={key:keys[0]||e.url,events:[]};groups.push(g)}
   g.events.push(e);e.reports.forEach(r=>byUrl.set(r.url,g));keys.forEach(k=>anchorMap.set(k,g));
 }
 const singles=groups.map(g=>describe(g,now)).filter(Boolean).sort((a,b)=>b.heat-a.heat||b.outlets-a.outlets);
 const themes=[];
 for(const [theme,action,sector] of patterns){
   const matches=active.filter(e=>now-Date.parse(e.publishedAt)<7*day&&action.test(e.title+' '+(e.originalTitle||''))&&sector.test(e.title+' '+(e.content||'').slice(0,140)));
   const brands=new Set(matches.flatMap(e=>consumerBrands(e.title)));
   if(matches.length<2||brands.size<2||new Set(matches.map(e=>groups.find(g=>g.events.includes(e)))).size<2)continue;
   const story=describe({key:'theme:'+theme,theme,events:matches},now);if(story)themes.push(story);
 }
 return [...singles,...themes].sort((a,b)=>b.heat-a.heat||b.outlets-a.outlets).slice(0,16);
}
