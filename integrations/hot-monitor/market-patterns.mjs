import {consumerBrands} from './brand-attention.mjs';
import {publisherIdentity} from './publisher-identity.mjs';
const sectors=[
 ['运动鞋履',/跑鞋|球鞋|运动鞋|スニーカー|sneakers?|footwear|Air Jordan|Air Force|GEL-Lyte/i],
 ['香氛美妆',/香水|香氛|美妆|彩妆|コスメ|香り|フレグランス|perfume|fragrance|skincare|cosmetics/i],
 ['咖啡茶饮',/咖啡|奶茶|茶饮|コーヒー|カフェ|coffee|latte|bubble tea/i],
 ['户外装备',/露营|户外装备|キャンプ|テント|寝袋|camping|sleeping bag|campground/i],
 ['玩具与收藏',/手办|盲盒|玩具|フィギュア|グッズ|collectible|figurine|blind box|\btoy(s)?\b/i],
 ['服饰配件',/服饰|时装|服装|アパレル|ファッション|fashion|streetwear|apparel|menswear|clothing|handbag/i],
 ['餐饮食品',/餐厅|餐饮|烘焙|食品|巧克力|甜点|レストラン|菓子|restaurant|chocolate|bakery|beverage/i]];
const moves=[
 ['节日限定',/圣诞|节日限定|クリスマス|ホリデー|Christmas|holiday collection|advent calendar/i],
 ['联名合作',/联名|联乘|联动|聯名|コラボ|別注|collab|capsule collection|\s[x×]\s/i],
 ['线下体验',/主题店|快闪|首店|体验店|ポップアップ|オープン|pop.up|flagship|in.store activation/i],
 ['代言与品牌广告',/品牌广告|广告片|代言|大使|アンバサダー|ambassador|ad campaign|campaign starring/i],
 ['限量发售',/限定|限量|限量版|limited.edition|exclusive drop/i]];
export function patternCandidate(e){
 const s=e.originalTitle||e.title||'';
 return sectors.some(([,r])=>r.test(s))&&moves.some(([,r])=>r.test(s))&&consumerBrands(s).length>0;
}
export function marketPatterns(events,now=Date.now()){
 const groups=new Map();
 for(const e of events){
   const title=e.originalTitle||e.title,brands=consumerBrands(title),sector=sectors.find(([,r])=>r.test(title)),move=moves.find(([,r])=>r.test(title));
   if(!brands.length||!sector||!move)continue;
   const reports=e.reports.filter(r=>Date.parse(r.publishedAt)<=now&&now-Date.parse(r.publishedAt)<7*86400000);
   if(!reports.length)continue;
   const label=sector[0]+' · '+move[0];
   if(!groups.has(label))groups.set(label,{label,brands:new Set(),origins:new Set(),copies:new Set(),events:new Map(),active:false});
   const g=groups.get(label);if(g.events.has(e.url))continue;
   if(reports.some(r=>now-Date.parse(r.publishedAt)<48*3600000))g.active=true;
   g.events.set(e.url,{title:e.title,url:e.url,brand:brands.join(' × '),publishedAt:e.publishedAt});
   brands.forEach(b=>g.brands.add(b));
   for(const r of reports){if(r.copyId&&g.copies.has(r.copyId))continue;if(r.copyId)g.copies.add(r.copyId);g.origins.add(r.identity||r.issuerChannel||publisherIdentity(r.url,r.attribution));}
 }
 return [...groups.values()].filter(g=>g.active&&g.brands.size>=2&&g.events.size>=2&&g.origins.size>=2)
 .sort((a,b)=>b.origins.size-a.origins.size||b.events.size-a.events.size||a.label.localeCompare(b.label))
 .slice(0,6).map(g=>({label:g.label,brands:[...g.brands],origins:g.origins.size,count:g.events.size,examples:[...g.events.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,3)}));
}

