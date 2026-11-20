import {evidenceMatches} from '../../shared/community.js';
import {originalHref} from '../../shared/original.js';

const action=/联名|聯名|联乘|携手|合作推出|合作系列|品牌大使|代言|快闪|快閃|首发|首發|新品|官宣|品牌升级|品牌活动|广告片|营销活动|营销案例|营销策略|\bcollab(?:oration)?\b|\bpartnership\b|\bcampaign\b|\bambassador\b|\blaunch(?:es|ed)?\b|\bpop-up\b|\brebrand/i;
const salesNoise=/领取优惠券|价格对比|优惠码|国内保税仓|免费下载|招聘|coupon codes?|online shopping|official site|free download/i;
// A named brand must appear in the evidence. Category synonyms such as
// "blind box" are useful for 潮玩, but cannot establish a mention of POP MART.
const brands=[
 ['泡泡玛特','泡泡马特','pop mart','popmart'],['任天堂','nintendo'],['乐高','lego'],
 ['耐克','nike'],['阿迪达斯','adidas'],['苹果','apple'],['迪士尼','disney']
];
export function subjectMatch(text,query){
  const key=query.trim().normalize('NFKC').toLowerCase();
  const brand=brands.find(group=>group.includes(key));
  const normalized=text.normalize('NFKC').toLowerCase();
  return brand?brand.some(name=>normalized.includes(name)):evidenceMatches(text,query);
}
export function marketingWeight(row,query){
  const title=row.title||'', copy=[title,row.content||''].join(' ');
  return (subjectMatch(title,query)?4:0)+(action.test(title)?8:action.test(copy)?3:0)
    +(row.source==='editorial'?7:0)-(salesNoise.test(title)?12:0);
}
export function editorialMatches(feed,query,now=Date.now()){
  const recent=[...(feed?.items||[]),...(feed?.socialTrends?.editorialCases||[])];
  return recent.filter(row=>{
    const date=Date.parse(row.publishedAt);
    return date>=now-30*86400000&&date<=now&&subjectMatch([row.title,row.originalTitle,row.excerpt].join(' '),query);
  }).map(row=>({source:'editorial',url:originalHref(row),title:row.title,content:row.excerpt||row.title,
    publishedAt:row.publishedAt,author:{name:row.publisher||row.sourceName||'行业媒体'}}))
    .filter(row=>/^https?:\/\//i.test(row.url));
}
