import {evidenceMatches,isWhaleTopic} from './community.js';
import {topicMatches,uniqueCases} from './insights.js';
import {defaultPulseValue} from './pulse-content.js';
export function radarMatches(item,query){if(isWhaleTopic(query))return evidenceMatches([item.title,item.originalTitle,item.excerpt].filter(Boolean).join(' '),query);if(item.matchedQuery===query)return true;const merged={...item,title:[item.title,item.originalTitle].filter(Boolean).join(' '),excerpt:[item.excerpt,item.originalExcerpt].filter(Boolean).join(' ')};if(query==='品牌营销')return /品牌|营销|广告|brand|campaign|marketing/i.test(merged.title+' '+merged.excerpt);return topicMatches(merged,query);}
export function searchRadar(items,{query='',source='all',kind='all',days=7,now=Date.now()}={}){
 const candidates=items.filter(i=>{const at=Date.parse(i.publishedAt||i.observedAt);return Number.isFinite(at)&&at<=now&&at>=now-days*86400000&&(query?radarMatches(i,query):defaultPulseValue(i));});
 const sources=[...new Map(candidates.map(i=>[i.source,{id:i.source,name:i.sourceName}])).values()];
 const selected=uniqueCases(candidates.filter(i=>(source==='all'||i.source===source)&&(kind==='all'||(kind==='hot'?i.contentType==='hot-topic':i.contentType!=='hot-topic')))).sort((a,b)=>Date.parse(b.publishedAt||b.observedAt)-Date.parse(a.publishedAt||a.observedAt)||(b.nativeWeight||0)-(a.nativeWeight||0));
 return {items:selected,sources,total:selected.length,sourceCount:new Set(selected.map(i=>i.source)).size};
}
