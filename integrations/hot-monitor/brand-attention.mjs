import {publisherIdentity} from './publisher-identity.mjs';
import {originalHref} from '../../shared/original.js';
import {consumerContent,excludedTopic} from './consumer-market.mjs';
import {brandScore} from '../aihot/overlay/apps/web/app/lib/brand-score.ts';
const hour=3600000;
const aliases = [
 ['雪峰','Snow Peak','スノーピーク'],['科勒曼','Coleman','コールマン'],['DOD'],['NANGA','ナンガ'],['Alpen Outdoors','アルペン'],['鹿牌','CAPTAIN STAG','キャプテンスタッグ'],['BUNDOK','バンドック'],['UNIFLAME','ユニフレーム'],['Barebones','ベアボーンズ'],['牧高笛','Mobi Garden'],['挪客','Naturehike'],
 ['潘海利根','Penhaligon'],['文华东方','文華東方','Mandarin Oriental'],['GCDS'],['迪赛','DIESEL'],['奥特曼','Ultraman'],['拉夫劳伦','Ralph Lauren'],['罗森','Lawson'],['原神','Genshin Impact'],['麦富迪'],['瑞幸','Luckin'],['库迪','Cotti'],['星巴克','Starbucks'],['雀巢','Nestlé','Nestle'],['麦当劳',"McDonald’s","McDonald's",'マクドナルド'],['肯德基','KFC'],['汉堡王','Burger King'],['百胜','Yum China'],['喜茶','HEYTEA'],['蜜雪冰城','Mixue'],['霸王茶姬','CHAGEE'],['奈雪','Nayuki'],['茶百道'],['海底捞','Haidilao'],['可口可乐','Coca-Cola'],['百事','Pepsi'],['蒙牛'],['伊利'],['三顿半'],['元气森林'],['茅台','Moutai'],['奥利奥','Oreo'],['费列罗','Ferrero'],['乐事',"Lay’s"],['百威','Budweiser'],['喜力','Heineken'],
 ['耐克','Nike','Air Jordan'],['阿迪达斯','Adidas'],['彪马','Puma'],['亚瑟士','ASICS'],['安踏','ANTA'],['李宁','Li-Ning'],['萨洛蒙','Salomon'],['昂跑','On Running'],['始祖鸟',"Arc’teryx","Arc'teryx"],['优衣库','Uniqlo','ユニクロ'],['无印良品','Muji'],['露露乐蒙','Lululemon'],['新百伦','New Balance'],['卡骆驰','Crocs'],['匡威','Converse'],['范斯','Vans'],['拉科斯特','Lacoste'],['Zara'],['H&M'],['Gap'],['Supreme'],
 ['路易威登','Louis Vuitton'],['香奈儿','Chanel'],['迪奥','Dior'],['古驰','Gucci'],['爱马仕','Hermès','Hermes'],['蔻驰','Coach New York'],['普拉达','Prada'],['博柏利','Burberry'],['圣罗兰','Saint Laurent'],['蒂芙尼','Tiffany'],['卡地亚','Cartier'],['劳力士','Rolex'],['丝芙兰','Sephora'],['雅诗兰黛','Estée Lauder'],['欧莱雅',"L’Oréal","L'Oréal"],['祖玛珑','Jo Malone'],['蒂普提克','Diptyque'],['勒莱柏','Le Labo'],['柏芮朵','Byredo'],['观夏','To Summer'],['闻献','DOCUMENTS香水'],['花西子','Florasis'],['珀莱雅','Proya'],
 ['乐高','LEGO'],['迪士尼','Disney','ディズニー'],['宝可梦','Pokémon','Pokemon','ポケモン'],['高达','Gundam','ガンダム'],['万代','Bandai','バンダイ'],['三丽鸥','Sanrio','サンリオ','Hello Kitty'],['星球大战','Star Wars'],['漫威','Marvel'],['吉伊卡哇','Chiikawa','ちいかわ'],['初音未来','Hatsune Miku','初音ミク'],['海贼王','One Piece'],['芭比','Barbie'],['泡泡玛特','POP MART','LABUBU'],['美泰','Mattel'],['孩之宝','Hasbro'],['史努比','Snoopy'],['吉卜力','Ghibli'],['名创优品','Miniso'],['宜家','IKEA'],['丝涟','Sealy'],['万豪','Marriott'],['希尔顿','Hilton']
];
const brandTerms=aliases.map(([name,...rest])=>[name,[name,...rest].map(s=>{const escaped=s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(/^[\x00-\x7f]/.test(s)?'(?<![a-z0-9])'+escaped+'(?![a-z0-9])':escaped,'iu')})]);
export function consumerBrands(title){
  const names=new Set(brandTerms.filter(([,terms])=>terms.some(term=>term.test(title))).map(([name])=>name));
  const namedBrand=/(?:香氛|香水|服装|美妆|护肤|潮玩|鞋履|咖啡|家居|珠宝|运动|餐饮|茶饮|设计师|食品|生活方式)?品牌\s*[「“『]([^”」』]{2,24})[」”』]/gu;
  for(const [,name] of title.matchAll(namedBrand)){
    if(!excludedTopic(name)&&/^[\p{L}\d ·&'.-]+$/u.test(name)&&!brandTerms.some(([,terms])=>terms.some(t=>t.test(name))))names.add(name);
  }
  return [...names];
}
const action=/联名|合作|新品|推出|发售|发布|上线|代言|营销|快闪|投资者大会|五年计划|销售目标|开店|闭店|签约|赞助|登场|上映|上市|限定|宣布|销量|新款|曝光|预售|launch|unveil|collab|campaign|partner|debut|announce|release|exclusive|introduc|reveals?|expan[ds]|sponsor|premiere|capsule|collection|merchandise|新発売|発売|コラボ|グッズ/i;
const noise=/best deals|black friday deals|gift guide|how to|discount code|coupon|is on sale|股票|股价|换手率|官网入口|领券|传闻|rumou?r/i;
export function heatAt(reports,at){
  const latest=new Map();
  for(const r of reports){const t=Date.parse(r.publishedAt);if(t>at||at-t>=48*hour)continue;
    latest.set(r.identity,Math.max(t,latest.get(r.identity)||0));}
  return Math.round(10*[...latest.values()].reduce((sum,t)=>sum+2**(-(at-t)/(24*hour)),0));
}
export function brandAttention(rows,now=Date.now()){
  const groups=new Map(),seen=new Set();
  for(const row of rows){
    const t=Date.parse(row.publishedAt);if(!consumerContent(row)||!Number.isFinite(t)||t>now||now-t>=72*hour||!row.title||noise.test(row.title)||!action.test(row.title+' '+String(row.content||'').slice(0,240)))continue;
    const original=originalHref(row);if(!original)continue;
    let url;try{url=new URL(original);if(!/^https?:$/.test(url.protocol))continue;}catch{continue;}
    url.hash='';if(seen.has(url.href))continue;seen.add(url.href);
    const domain=(row.publisherId||url.hostname).replace(/^www\./,'');
    const byline=row.author||'',profile=row.role==='creator'||row.role==='community';
    const family=publisherIdentity(url.href,row.attribution);
    const identity=profile&&byline?family+'/'+byline.toLowerCase():family;
    for(const name of consumerBrands(row.title+' '+(row.originalTitle||''))){
      if(!groups.has(name))groups.set(name,[]);
      groups.get(name).push({...row,url:url.href,domain,identity,name:profile&&byline?byline:(row.publisher==='品牌星球'?'首发原文':row.publisher)||domain,role:row.role||'media'});
    }
  }
  const output=[];
  for(const [name,all] of groups){
    const reports=all.filter(r=>now-Date.parse(r.publishedAt)<48*hour).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
    const domains=new Set(reports.map(r=>publisherIdentity(r.url,r.attribution)));
    if(domains.size<4)continue;
    const people=[...new Map(reports.map(r=>[r.identity,{name:r.name,avatar:r.avatar,domain:r.domain,role:r.role,url:r.url}])).values()];
    const lead=reports.find(r=>r.image&&/[\u4e00-\u9fff]/.test(r.title))||reports.find(r=>r.image)||reports[0];
    const end=Math.floor(now/hour)*hour;
    const trend=Array.from({length:24},(_,i)=>{const at=i===23?now:end-(23-i)*hour;return {at,value:heatAt(all,at)}});
    const heat=heatAt(all,now),before=heatAt(all,now-24*hour);
    output.push({...lead,id:name,brand:name,parties:[name],outlets:domains.size,people,heat,trend,delta:before?Math.round((heat-before)/before*100):null,
      reports:reports.map(r=>({publisher:r.name,url:r.url,title:r.title,publishedAt:r.publishedAt})),score:brandScore(lead.title,lead.content||'')});
  }
  return output.sort((a,b)=>b.heat-a.heat||b.outlets-a.outlets).slice(0,10);
}
