import {load} from 'cheerio';
import {consumerContent,excludedSearchSource} from '../integrations/hot-monitor/consumer-market.mjs';

const day=86400000;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const recent=(date,now)=>Date.parse(date)<=now&&Date.parse(date)>=now-30*day;
const absoluteDate=s=>s?.match(/\b\d{4}-\d\d-\d\d(?: \d\d:\d\d)?\b/)?.[0];
function beijing(s){return s&&(s.length===10?s+'T00:00':s.replace(' ','T'))+':00+08:00';}
async function html(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(8000),credentials:'omit'});
 if(!response.ok)throw Error('HTTP '+response.status);
 return load(await response.text());
}
export function communityNote($){
 for(const node of $('script[type="application/ld+json"]').toArray()){
   let item;try{item=JSON.parse($(node).text());}catch{continue;}
   if(item['@type']!=='Article'||!/^https:\/\/post\.smzdm\.com\/(?:talk\/)?p\/\w+\/$/.test(item.url||''))continue;
   const counts=(item.interactionStatistic||[]).filter(c=>Number.isSafeInteger(c.userInteractionCount)).flatMap(c=>{
     const label=({LikeAction:'赞',CommentAction:'评论'})[c.interactionType?.split('/').pop()];
     return label?[label+' '+c.userInteractionCount]:[];
   });
   return {url:item.url,title:item.headline,content:clean(item.description),publishedAt:item.datePublished,publisher:item.author?.name||'什么值得买社区',role:'creator',channel:'什么值得买',metricDisplay:counts.join(' · ')};
 }
}
export function socialCase($,url){
 const original=$('a').filter((_,el)=>$(el).text().trim()==='案例原链接').first();
 const publishedAt=beijing(absoluteDate(original.parent().text()||$('.info').first().text()));
 const title=clean($('title').text()).split(/[|｜]/)[0].trim();
 const content=clean($('.cont_cam .content').first().text());
 if(!title||!publishedAt||!content)return;
 let citation;
 try{
   const u=new URL(original.attr('href')),platform=[
     ['小红书',/(^|\.)xiaohongshu\.com$/, /^\/(?:explore|discovery\/item)\/[a-f\d]{24}/i],
     ['微博',/(^|\.)weibo\.(?:com|cn)$/, /^\/(?:\d+|detail|status)\/\w+/],
     ['哔哩哔哩',/(^|\.)bilibili\.com$/, /^\/video\/BV/],
     ['微信',/^mp\.weixin\.qq\.com$/, /^\/s(?:\/|$)/],
     ['Instagram',/(^|\.)instagram\.com$/, /^\/(?:reel|p)\//]
   ].find(([,host,path])=>u.protocol==='https:'&&host.test(u.hostname)&&path.test(u.pathname));
   if(platform)citation={url:u.href,platform:platform[0]};
 }catch{}
 const brands=$('.cont_cam .tag a').first().text().trim();
 return {title,content:content.slice(0,900),url,publishedAt,publisher:'SocialBeta',role:'media',brands:brands?[brands]:[],citation};
}
export function issuerRelease($,url,publishedAt){
 const owner=clean($('body').text().match(/消息来源[：:]\s*([^\n\r]{2,70})/)?.[1]);
 const title=clean($('h1').first().text()),content=clean($('.release-body p,.generalbody p,#dvContent p').slice(0,4).text());
 if(!owner||!title||!content)return;
 return {title,content:content.slice(0,900),url,publishedAt,publisher:owner,brands:[owner],role:'official',channel:'美通社'};
}
export async function collectPublicCases(headlines=[],now=Date.now()){
 const candidates=new Map(),rows=[];
 function add(url,parse){if(!candidates.has(url))candidates.set(url,parse);}
 const topics=[...new Set(['小红书','联名','快闪',...headlines.slice(0,4)])];
 await Promise.allSettled([
   ...['https://socialbeta.com/campaign',...topics.map(t=>'https://socialbeta.com/search/'+encodeURIComponent(t))].map(async url=>{
     const $=await html(url);
     for(const a of $('.tit a').toArray().slice(0,22)){
       const href=$(a).attr('href');if(/^https:\/\/socialbeta\.com\/campaign\/\d+$/.test(href))add(href,socialCase);
     }
   }),
   (async()=>{const $=await html('https://post.smzdm.com/');
     for(const a of $('a[href]').toArray()){const href=$(a).attr('href');if(/^https:\/\/post\.smzdm\.com\/(?:talk\/)?p\/\w+\/$/.test(href))add(href,communityNote);}
   })(),
   ...['https://www.prnasia.com/releases/all/listpage-all-all-all-all-all-industry-1.shtml',
     ...topics.map(t=>'https://www.prnasia.com/search/?'+new URLSearchParams({lang:'1',post:'1',keywords:t,scope:'fulltext',sortby:'1'}))
   ].map(async desk=>{const $=await html(desk);
     for(const card of $('.card').toArray()){
       const r=$(card),url=r.find('h3 a').attr('href'),publishedAt=beijing(absoluteDate(r.find('.datetime').text()));
       if(/^https:\/\/www\.prnasia\.com\/story\/\d+-\d+\.shtml$/.test(url)&&recent(publishedAt,now)&&consumerContent({title:r.find('h3').text(),content:r.find('.card-text-summary').text()}))add(url,($,u)=>issuerRelease($,u,publishedAt));
     }
   })
 ]);
 const queue=candidates.entries();
 await Promise.all(Array.from({length:5},async()=>{
   for(const [url,parse] of queue){
     try{const row=parse(await html(url),url);if(row&&recent(row.publishedAt,now)&&consumerContent(row)&&!excludedSearchSource(row))rows.push(row);}catch{}
   }
 }));
 return rows;
}
