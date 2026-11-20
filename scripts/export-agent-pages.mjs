import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {originalHref} from '../shared/original.js';
import {consumerContent} from '../integrations/hot-monitor/consumer-market.mjs';
import {currentHotspots,eventCards} from '../integrations/hot-monitor/brand-events.mjs';
import {buildBrandTools,rankingFocus} from '../integrations/hot-monitor/brand-tools.mjs';
import logos from '../config/pulse-brand-logos.json' with {type:'json'};

const base='https://lichang1125.github.io/cue-marketing/';
const file=process.argv[2]||'dist/content-data.json',out=resolve(process.argv[3]||'dist');
const data=JSON.parse(await readFile(file,'utf8')),at=Date.now();
const generatedAt=data.generatedAt||new Date(at).toISOString();
const candidates=[...data.feed.items,...Object.values(data.curated||{}).flat(),...(data.feed.socialTrends?.editorialCases||[])];
const chinese=t=>/[\u3400-\u9fff]/u.test(t||'')&&!/[ぁ-ヿ]/u.test(t);
const rows=new Map();
for(const r of candidates){
  const url=originalHref(r),time=Date.parse(r.publishedAt);
  if(!url||!chinese(r.title)||!consumerContent(r)||!(time<=at&&at-time<=30*86400000)||rows.has(url))continue;
  const publisher=r.publisher||r.sourceName||new URL(url).hostname;
  rows.set(url,{title:r.title,originalTitle:r.originalTitle||undefined,content:chinese(r.excerpt)?r.excerpt.slice(0,260):'',url,publisher,
    publishedAt:new Date(time).toISOString(),source:'editorial',role:'media',image:/^https:\/\//.test(r.image||'')?r.image:undefined});
}
const list=[...rows.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
if(!list.length)throw Error('没有可用于公开接入的消费品牌报道');
const events=await currentHotspots(()=>({items:list.map(r=>({...r,excerpt:r.content}))}),async rs=>rs,undefined,undefined,{online:false})();
const tools=buildBrandTools(list,at);
tools.ranking=tools.ranking.map(b=>({...b,focus:rankingFocus(b.cases),reason:b.cases[0]?.title,example:b.cases[0]?.url,logo:logos[b.name]?new URL(logos[b.name].slice(1),base).href:undefined}));
const items=list.map(({content,source,role,...r})=>({...r,summary:content}));
const cases=eventCards(list,at).map(e=>({title:e.title,content:e.content,url:e.url,publishedAt:e.publishedAt,publisher:e.publisher,source:e.source,image:e.image,outlets:e.outlets,reports:e.reports}));
await Promise.all(['agent','pulse'].map(d=>mkdir(resolve(out,d),{recursive:true})));
const put=(name,value)=>writeFile(resolve(out,name),typeof value==='string'?value:JSON.stringify(value));
const xml=s=>String(s??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const rss='<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>CUE · 消费品牌报道</title><link>'+base+'</link><description>消费品牌与营销动态</description>'+items.slice(0,50).map(r=>'<item><title>'+xml(r.title)+'</title><link>'+xml(r.url)+'</link><guid isPermaLink="true">'+xml(r.url)+'</guid><pubDate>'+new Date(r.publishedAt).toUTCString()+'</pubDate><description>'+xml(r.summary)+'</description></item>').join('')+'</channel></rss>';
const paths={};
for(const [p,id,field] of [['/agent/articles.json','latestArticles','items'],['/pulse/events.json','hotEvents','results']]){
  paths[p]={get:{operationId:id,responses:{200:{description:'本期已发布数据，含原文链接',content:{'application/json':{schema:{type:'object',required:['generatedAt',field],properties:{generatedAt:{type:'string',format:'date-time'},[field]:{type:'array',items:{type:'object',properties:{title:{type:'string'},url:{type:'string',format:'uri'},publishedAt:{type:'string',format:'date-time'}}}}}}}}}}}};
}
await Promise.all([put('agent/articles.json',{generatedAt,items}),put('pulse/events.json',{generatedAt,...events}),put('pulse/tools.json',tools),put('pulse/cases.json',{generatedAt,cases}),put('agent/feed.xml',rss),
 put('agent/openapi.json',{openapi:'3.1.0',info:{title:'CUE 公开数据',version:'1.0.0'},servers:[{url:base.replace(/\/$/,'')}],paths}),
 put('llms.txt','# CUE · 消费品牌与市场营销\n\n- [接入说明]('+base+'agent/)\n- [近 30 天报道]('+base+'agent/articles.json)\n- [热点榜与证据]('+base+'pulse/events.json)\n- [RSS]('+base+'agent/feed.xml)\n- [OpenAPI]('+base+'agent/openapi.json)\n\n数据随网站发布更新。引用报道时请保留发布方、发布日期及原文 URL。\n')]);
console.log('公开文章',items.length,'热点',events.results.length,'品牌',tools.ranking.length);
