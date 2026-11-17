import topics from '../config/research-topics.json' with {type:'json'};
import {uniqueCases} from './insights.js';
export const researchTopics=topics;
export const researchTerms=query=>topics.find(t=>t.name.toLowerCase()===query.trim().toLowerCase())?.terms||[query.trim()];
const market=/品牌|营销|市场|消费|零售|美妆|香水|香氛|时尚|圈层|潮玩|青年|新生代|IP|电商|文化|广告|brand|market|consumer|retail|beauty|fragrance|fashion|culture|advertis|creator|luxury/i;
const depth=/报告|研究|调研|白皮书|洞察|趋势|观察|分析|策略|模式|经济|为何|如何|为什么|report|research|insight|trend|analysis|strategy|strategies|economy|why|how|outlook|consumer|gen.?z/i;
export function researchValue(i){const title=i.originalTitle||i.title||'',text=[title,i.originalExcerpt||i.excerpt,(i.tags||[]).join(' ')].join(' ');return i.contentType!=='hot-topic'&&!!i.publishedAt&&market.test(text)&&(i.contentType==='research-report'||depth.test(title))&&!/净利润|财报|股价|营收50强|军事|官宣代言|coupon|earnings|stock price/i.test(title);}
export function searchResearch(items,{query='',days=90,now=Date.now()}={}){
 const terms=researchTerms(query).map(t=>t.toLowerCase());
 const matched=uniqueCases(items.filter(i=>researchValue(i)&&Date.parse(i.publishedAt)<=now&&Date.parse(i.publishedAt)>=now-days*86400000&&(!query||terms.some(t=>[i.title,i.originalTitle,i.excerpt,i.originalExcerpt,...(i.tags||[])].join(' ').toLowerCase().includes(t)))));
 matched.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 const selected=matched.slice(0,10),buckets=Math.min(days,12),step=Math.ceil(days/buckets);
 const series=Array.from({length:buckets},(_,n)=>{const start=now-(buckets-n)*step*86400000,end=now-(buckets-n-1)*step*86400000;return {date:new Date(end).toISOString().slice(0,10),count:matched.filter(i=>Date.parse(i.publishedAt)>start&&Date.parse(i.publishedAt)<=end).length};});
 return {query,days,articles:selected,total:matched.length,mediaCount:new Set(matched.map(i=>i.source)).size,series,engine:'TrendRadar'};
}
