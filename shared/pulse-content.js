import {meaningfulContent} from './quality.js';
import {mediaSources} from './media-sources.js';
const homeHosts=new Set(mediaSources.map(s=>new URL(s.url).hostname.replace(/^www\./,'')));
export const pulseDate=i=>i.publishedAt||i.firstSeenAt;
export function pulseValue(item){
 const title=item.originalTitle||item.title||'';
 if(!meaningfulContent({...item,title,originalTitle:title})||title.length<7||title.length>230)return false;
 return !/优惠券|满减|补贴后|到手价|爆料|绯闻|车祸|凶杀|遇难|军事|外交|芯片禁令|重要讲话|招标|净利润|财报|股价|涨停|融资|股息|炒股|court|election|murder|stock price|coupon|deals? of the day|earnings/i.test(title);
}
export function defaultPulseValue(item){return pulseValue(item)&&/品牌|营销|联名|广告|新品|消费|零售|香水|香氛|潮玩|文化|创意|文创|电商|时尚|美妆|代言|门店|奢侈|服饰|brand|marketing|campaign|retail|consumer|fragrance|perfume|beauty|fashion|luxury|streetwear|collaborat|rebrand|e.commerce|creator economy/i.test([item.title,item.originalTitle,item.excerpt].join(' '));}
export function buildPulseItems(radar,previous=[],homepage=[],now=Date.now()){
 const homeUrls=new Set(homepage.flatMap(i=>[i.url,i.originalUrl].filter(Boolean).map(u=>u.split('?')[0])));
 const prior=new Map(previous.map(i=>[i.url,i]));
 const incoming=[...(radar.articles||[]),...(radar.items||[]).map(i=>({...i,id:'pulse-'+i.source+'-'+encodeURIComponent(i.url),publisher:i.sourceName,engine:'TrendRadar',origin:'trendradar-hotlist',contentType:i.publishedAt?'article':'hot-topic',excerpt:'',firstSeenAt:prior.get(i.url)?.firstSeenAt||i.at}))];
 const result=new Map();
 for(const i of [...incoming,...previous]){
  let url;try{url=new URL(i.url);}catch{continue;}
  if(!/^https?:$/.test(url.protocol)||homeHosts.has(url.hostname.replace(/^www\./,''))||homeUrls.has(i.url.split('?')[0])||!pulseValue(i))continue;
  const at=Date.parse(pulseDate(i));if(!Number.isFinite(at)||at>now+300000||at<now-30*86400000)continue;
  const key=i.url.split('?')[0];if(!result.has(key))result.set(key,i);
 }
 return [...result.values()].sort((a,b)=>Date.parse(pulseDate(b))-Date.parse(pulseDate(a))).slice(0,1800);
}
