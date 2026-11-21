import {createHash} from 'node:crypto';
import {consumerBrands,heatAt} from './brand-attention.mjs';
import {publisherIdentity} from './publisher-identity.mjs';
const day=86400000;
const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
const patterns=[
 ['品牌与 IP 的联名合作',/联[名动乘]|聯[名動乘]|コラボ|collab|licensing/i,/动漫|游戏|漫画|角色|动画|周边|玩具|电影|卡通|授权|宝可梦|迪士尼|小丸子|三丽鸥|品牌IP|文化IP|\bIP\b|anime|character|Disney|Pok.mon|figurine/i],
 ['门店里的跨界体验',/快闪|快閃|主题店|主題店|改造|改成|pop.up|限时店/i,/门店|商店|空间|空间|線下|空間|店|场馆|store|shop|bakery/i],
 ['赛事与运动品牌合作',/冠名|赞助|贊助|联名|合作|sponsor|partnership/i,/赛事|马拉松|足球|赛季|越野|篮球|跑鞋|F1\b|marathon|league|football/i],
 ['饮食品牌的跨界联名',/联名|联乘|聯名|コラボ|collab/i,/咖啡|饮品|餐厅|奶茶|烘焙|食品|啤酒|食物|冰淇淋|coffee|brew|bakery|restaurant/i],
 ['服饰与鞋履的联名系列',/联名|联乘|聯名|collab|capsule collection/i,/服饰|时装|鞋|运动服|街头|牛仔|fashion|sneaker|footwear|apparel/i],
 ['香氛与美妆的新品发布',/首发|发布|上市|推出|首秀|新品|launch|debut|unveil/i,/香水|香氛|彩妆|护肤|fragrance|cosmetic|perfume/i],
 ['节庆礼盒与限定包装',/圣诞|聖誕|春节|过年|新年|假日|holiday|christmas|festive/i,/礼盒|禮盒|包装|限定套装|倒数日历|advent calendar|gift set|packaging/i],
 ['茶咖与餐饮的季节上新',/咖啡|茶饮|奶茶|烘焙|甜品|coffee|bakery|restaurant/i,/季节|季節|限定菜单|上新|新品|季節限定|seasonal|new menu|new flavo[u]?r|limited.time menu/i],
 ['消费品牌开设城市首店',/首店|旗舰店|概念店|概念空间|flagship|concept store|first store/i,/开业|开幕|启幕|落地|进驻|揭幕|入驻|开设|open|debut/i],
 ['运动品牌走进户外社群',/户外|露营|徒步|登山|攀岩|跑团|hiking|trail run|camping|climbing/i,/联名|发售|新品|体验营|社群|系列|collab|community|collectio|launch/i],
 ['品牌与设计师推出限定系列',/设计师|設計師|艺术家|插画师|designer|artist/i,/联名|合作|跨界|限定系列|capsule|collab|partner/i],
 ['文化 IP 的线下体验',/动漫|动画|漫画|动漫IP|宝可梦|迪士尼|三丽鸥|anime|character|Disney|Pok.mon/i,/主题乐园|主题展|沉浸式|巡展|见面会|pop.up|exhibition|theme park/i],
 ['游戏 IP 的跨界合作',/游戏|遊戲|电竞|電競|手游|video game|gaming|esports|game franchise/i,/联[名乘动]|聯[名動乘]|授权|合作|限定|周边|collab|partner|licens|merchandise/i],
 ['电影与剧集的主题营销',/电影|電影|剧集|影剧|星球大战|星際大戰|star wars|cinema|motion picture|film franchise|movie/i,/联[名动乘]|合作|授权|主题商品|联乘系列|限定|周边|跨界|collab|capsule collection|licens|brand partner|brand campaign|merchandise/i],
 ['动漫角色走进日常消费',/二次元|卡通|动画|动漫|漫画|吉伊卡哇|吉卡瓦|高达|高達|chiikawa|gundam|anime|manga|sanrio|三丽鸥|宝可梦/i,/授权|周边|新品|发售|限定|系列|联[名乘动]|合作|玩具|collab|licens|collection|launch|merchandise/i],
 ['家居品牌与生活方式设计',/宜家|家具|家居|家飾|室内装饰|家纺|IKEA|furniture|homeware|home decor/i,/上新|设计|推出|改造|联名|合作|系列|门店|快闪|collection|launch|collab|unveil|pop.up/i],
 ['时装品牌的当季系列与传播',/服装|时装|成衣|服饰|时尚品牌|羽绒服|时装周|ZARA|fashion|apparel|outerwear|runway/i,/系列|秀场|首秀|大秀|广告|形象大片|品牌活动|秋冬|春夏|campaign|collection|debut|runway show/i],
 ['潮玩与收藏品的限定发售',/潮玩|盲盒|手办|公仔|模型玩具|玩偶|收藏玩具|figurine|collectible|blind box/i,/联名|新品|首发|发售|预售|开售|限定|收藏系列|drop|launch|releas|collection|limited/i],
 ['消费品牌的节日营销',/圣诞|聖誕|春节|万圣节|跨年|情人节|holiday|christmas|festive/i,/广告片|营销活动|快闪|主题活动|宣传片|campaign|commercial|activation|pop.up/i],
 ['明星代言与品牌广告',/明星|歌手|艺人|演员|代言|品牌大使|蕾哈娜|Rihanna|celebrity|ambassador|singer|actress|actor/i,/代言|官宣|携手|广告|品牌大使|品牌挚友|广告大片|campaign|ambassador|endorse/i],
 ['品牌包装与视觉焕新',/品牌|产品|包装|brand|packaging/i,/更换标志|品牌焕新|视觉升级|包装焕新|包装设计|全新包装|brand refresh|rebrand|redesign|new packaging/i],
 ['消费品牌在地快闪与展览',/品牌|联名|限时|品牌空间|brand|flagship|retail/i,/快闪|快閃|巡展|主题展|沉浸式展|pop.up|immersive experience/i],

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
 if(!heat||new Set(reports.filter(r=>now-Date.parse(r.publishedAt)<2*day).map(r=>r.identity)).size<2)return;
 const trend=Array.from({length:24},(_,i)=>{const at=now-(23-i)*3600000;return {at,value:heatAt(reports,at)}});
 const storyId=id(group.key),kind=group.theme?'专题趋势':'事件追踪',title=group.theme||lead.title;
 const brands=[...new Set(group.events.flatMap(e=>consumerBrands(e.title)))];
 const illustrated=reports.findLast(r=>/^https:\/\//.test(r.image||'')&&!/favicon|logo|placeholder|default[_-]img|\/covers\//i.test(r.image));
 return {...lead,image:illustrated?.image,imageLocal:undefined,coverArticle:illustrated&&{url:illustrated.url,title:illustrated.title},storyId,kind,title,reports,people,outlets:sources.size,heat,trend,delta:prior?Math.round((heat-prior)*100/prior):null,
   brand:brands.slice(0,3).join(' × '),firstAt:reports[0].publishedAt,lastAt:reports.at(-1).publishedAt,
   content:group.theme?brands.slice(0,5).join('、')+'等品牌有 '+group.events.length+' 项相关动作，'+sources.size+' 个独立来源提供报道。':lead.content,
   eventCount:group.events.length,publishedAt:reports.at(-1).publishedAt};
}
export function clusterStories(events,now=Date.now(),{trendsOnly=false}={}){
 const anchorMap=new Map(),byUrl=new Map(),groups=[];
 const active=events.filter(e=>now-Date.parse(e.publishedAt)<14*day).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt));
 for(const e of active){
   const keys=signals(e);let g=keys.map(k=>anchorMap.get(k)).find(x=>x&&Math.abs(Date.parse(e.publishedAt)-Date.parse(x.events[0].publishedAt))<7*day);
   if(!g)g=(e.citedUrls||[]).map(url=>byUrl.get(url)).find(x=>x&&consumerBrands(e.title).some(n=>consumerBrands(x.events[0].title).includes(n)));
   if(!g){g={key:keys[0]||e.url,events:[]};groups.push(g)}
   g.events.push(e);e.reports.forEach(r=>byUrl.set(r.url,g));keys.forEach(k=>anchorMap.set(k,g));
 }
 const singles=trendsOnly?[]:groups.map(g=>describe(g,now)).filter(Boolean).sort((a,b)=>b.heat-a.heat||b.outlets-a.outlets);
 const themes=[];
 for(const [theme,action,sector] of patterns){
   const members=[];
   for(const g of groups){
     const selected=g.events.filter(e=>{
       if(now-Date.parse(e.publishedAt)>=7*day||/film slate|film festival|museum.{0,50}fashion collection|fashion collection.{0,50}museum|博物馆馆藏/i.test(e.originalTitle||e.title))return false;
       const headline=[e.title,e.originalTitle].filter(Boolean).join(' '),text=headline+' '+String(e.content||'').slice(0,200);
       return (action.test(headline)||sector.test(headline))&&action.test(text)&&sector.test(text);
     });
     if(selected.length)members.push(selected);
   }
   if(members.length<2)continue;
   const matches=members.flat(),story=describe({key:'theme:'+theme,theme,events:matches},now);
   if(!story)continue;
   story.cases=members.map(group=>{
     const representative=group.at(-1);
     return {title:representative.title,url:representative.url,publisher:representative.publisher,publishedAt:representative.publishedAt};
   }).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
   story.eventCount=members.length;
   const names=[...new Set(matches.flatMap(e=>consumerBrands(e.title+' '+(e.originalTitle||''))))];
   story.content='近 7 天有 '+members.length+' 个相关案例，来自 '+story.outlets+' 个独立报道来源。'+(names.length?'涉及'+names.slice(0,5).join('、')+'。':'');
   themes.push(story);
 }
 const ranking=[];
 for(const s of [...singles,...themes].sort((a,b)=>b.heat-a.heat||b.outlets-a.outlets)){
   const links=new Set(s.reports.map(r=>r.url));
   if(ranking.some(other=>other.reports.filter(r=>links.has(r.url)).length/Math.max(links.size,other.reports.length)>0.8))continue;
   ranking.push(s);
 }
 return ranking.slice(0,16);
}
