import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {mediaSources,mediaIds} from '../shared/media-sources.js';
import {meaningfulContent} from '../shared/quality.js';
import {sectorId,uniqueCases} from '../shared/insights.js';
import {parseSocialBeta,parseBrandstar} from './sources.js';
const editorial=/品牌|营销|行銷|廣告|广告|联名|聯名|消费|零售|新品|快闪|香水|香氛|潮玩|campaign|brand|marketing|advertis|retail|fragrance|perfume|collaborat|pop.up|consumer|e.commerce|packaging|rebrand|logo|loyalty|sponsor/i;
const noise=/招聘|招募|培训报名|征稿|课程报名|早安|晚安|中奖|抽奖|获奖名单|职位|净利润|季度业绩|财务业绩|领导讲话|高质量发展|Logo.*Skill|annual results|quarterly earnings|job vacancy|senior hires|hall of good|appoints? |promot(?:es|ed) |joins? .* as |chief .* officer|(?:award|awards) (?:entries|deadline)|nominations? open|affiliate deals|best .* deals|coupon/i;
const text=value=>load('<body>'+String(value||'')+'</body>')('body').text().replace(/\s+/g,' ').trim();
export function marketingArticle(item,source){
 const title=item.originalTitle||item.title||'',excerpt=item.originalExcerpt||item.excerpt||'';
 return mediaIds.has(item.source)&&meaningfulContent(item)&&!noise.test(title)&&!/restock|where to buy|购物清单|招标|代理公司需要|升任|任命|临床|医疗器械|供应商招募|get \d+% off|free entry|entries open|jury chairs|on the hunt for.*role|local authorities/i.test(title)&&! /\/(company|people|user|tags|jobs)\//.test(item.url||'')&&title.length>=8&&title.length<=180&&(source?.specialized?editorial.test(title+' '+excerpt)||/case|strategy|creative|design|创意|策略|案例|設計|设计|洞察/i.test(title):editorial.test(title));
}
function safeUrl(value,base){if(typeof value!=='string'||!value.trim())return null;try{const u=new URL(value,base);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}
function sameSite(url,source){try{return new URL(url).hostname.replace(/^www\./,'')===new URL(source.url).hostname.replace(/^www\./,'');}catch{return false;}}
function normalize(source,item,now){
 const title=text(item.title).replace(/\s*20\d{2}[-/]\d{1,2}[-/]\d{1,2}\s*$/,'').replace(/^[A-Z\s]+\d{1,2} [A-Za-z]+ 20\d{2}/,''),url=safeUrl(item.url,source.url),at=Date.parse(item.publishedAt);
 if(!url||!sameSite(url,source)||!title)return null;
 const publishedAt=Number.isFinite(at)&&at<=Date.parse(now)+300000?new Date(at).toISOString():null;
 const result={...item,id:source.id+'-'+createHash('sha256').update(url).digest('hex').slice(0,18),title,url,source:source.id,publisher:source.name,excerpt:text(item.excerpt).slice(0,280),image:safeUrl(item.image,source.url),publishedAt,fetchedAt:now,metrics:item.metrics||{},tags:item.tags||[],categories:['brand'],contentType:'article',mediaEditorial:true};
 result.categories=[sectorId(result)];return result;
}
export function parseMediaFeed(xml,source,now=new Date().toISOString()){
 const $=load(xml,{xmlMode:true});const out=[];
 $('item,entry').each((_,el)=>{const node=$(el),html=node.find('description,summary,content,content\\:encoded').first().text();
 const image=node.find('media\\:content,media\\:thumbnail,enclosure').filter((_,e)=>!$(e).attr('type')||$(e).attr('type').startsWith('image/')).first().attr('url')||load(html)('img').first().attr('src');
 const item=normalize(source,{title:node.find('title').first().text(),url:node.find('link').filter((_,e)=>!$(e).attr('rel')||$(e).attr('rel')==='alternate').first().attr('href')||node.find('link').first().text(),excerpt:html,image,publishedAt:node.find('pubDate,published,dc\\:date').first().text(),tags:node.find('category').map((_,e)=>$(e).text()).get()},now);
 if(item)out.push(item);
 });return uniqueCases(out);
}
export function parseMediaHtml(html,source,now=new Date().toISOString()){
 if(source.id==='socialbeta')return parseSocialBeta(html,now).map(i=>({...i,mediaEditorial:true,publisher:source.name}));
 if(source.id==='brandstar')return parseBrandstar(html,now).map(i=>({...i,mediaEditorial:true,publisher:source.name}));
 const $=load(html),out=[];
 $('a[href]').each((_,el)=>{const a=$(el),href=safeUrl(a.attr('href'),source.url),title=a.attr('title')||a.find('h1,h2,h3,h4').first().text()||a.text();
 if(!href||!sameSite(href,source)||text(title).length<8||text(title).length>210||!/\/(?:article|articles|posts?|news|detail|cases?|insights|marketing|branding|creativity|[a-z0-9]+-[a-z0-9-]+|\d{4,})/i.test(new URL(href).pathname)||/\/(?:tag|category|author|search|login|about|contact|page)\//.test(href))return;
 const row=a.closest('article,li,.item,.post,.card').length?a.closest('article,li,.item,.post,.card'):a.parent();
 const date=row.find('time').attr('datetime')||row.find('[itemprop="datePublished"]').attr('content')||row.text().match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/)?.[0];
 const image=row.find('img').first();
 const item=normalize(source,{title,url:href,publishedAt:date,excerpt:row.find('p').first().text(),image:image.attr('data-original')||image.attr('data-src')||image.attr('src')},now);if(item)out.push(item);
 });return uniqueCases(out);
}
export async function fetchPublicText(url,fetcher=fetch){const response=await fetcher(url,{headers:{'User-Agent':'CUE-MediaReader/1.0 (+https://github.com/LiChang1125/cue-marketing)','Accept':'application/rss+xml, application/atom+xml, text/html, application/xml;q=0.9,*/*;q=0.5'},signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('HTTP '+response.status);const body=await response.text();if(body.length>8e6)throw Error('Response too large');return {body,url:response.url};}
export async function collectMediaSource(source,{fetcher=fetch,now=new Date().toISOString(),details=8}={}){
 let items=[],method='html',lastError;
 if(source.feed){try{const {body}=await fetchPublicText(source.feed,fetcher);items=parseMediaFeed(body,source,now);if(items.length)method='rss';}catch(e){lastError=e;}}
 if(!items.length){const {body,url}=await fetchPublicText(source.url,fetcher);if(!sameSite(url,source))throw Error('来源已跳转，需核实新站点');const $=load(body);const feeds=$('link[type="application/rss+xml"],link[type="application/atom+xml"]').map((_,e)=>safeUrl($(e).attr('href'),source.url)).get().filter(u=>sameSite(u,source));
   for(const feed of feeds.slice(0,1)){try{items=parseMediaFeed((await fetchPublicText(feed,fetcher)).body,source,now);if(items.length){method='rss';break;}}catch{}}
   if(!items.length)items=parseMediaHtml(body,source,now);
 }
 const candidates=items.filter(i=>marketingArticle(i,source)).slice(0,60);
 const undated=candidates.filter(i=>!i.publishedAt||source.id==='media-adquan').slice(0,details);
 for(let k=0;k<undated.length;k+=3)await Promise.all(undated.slice(k,k+3).map(async item=>{try{const {body}=await fetchPublicText(item.url,fetcher),$=load(body);let date=$('meta[property="article:published_time"],meta[name="pubdate"],meta[itemprop="datePublished"]').first().attr('content')||$('time').first().attr('datetime');
   $('script[type="application/ld+json"]').each((_,el)=>{try{const json=JSON.parse($(el).text());const walk=v=>{if(!v||typeof v!=='object')return;if(v.datePublished&&!date)date=v.datePublished;for(const x of Object.values(v))if(typeof x==='object')Array.isArray(x)?x.forEach(walk):walk(x);};walk(json);}catch{}});
   if(Number.isFinite(Date.parse(date))&&Date.parse(date)<=Date.parse(now)+300000)item.publishedAt=new Date(date).toISOString();
   const headline=$('meta[property="og:title"]').attr('content')||$('h1').first().text();
   if(headline&&text(headline).length>=8&&text(headline).length<=180)item.title=text(headline).replace(/\s*[-_|]\s*(广告门|数英|TOPYS).*$/,'');
   item.image||=safeUrl($('meta[property="og:image"]').attr('content'),item.url);item.excerpt||=text($('meta[name="description"]').attr('content')).slice(0,280);
 }catch{}}));
 const recent=candidates.filter(i=>marketingArticle(i,source)&&i.publishedAt&&Date.parse(i.publishedAt)>=Date.parse(now)-30*86400000&&Date.parse(i.publishedAt)<=Date.parse(now));
 return {items:recent,status:{id:source.id,name:source.name,url:source.url,method,state:recent.length?'ok':items.length?'no-recent-content':'unavailable',count:recent.length,checkedAt:now,...(!items.length?{message:lastError?.message||'未发现可核实的公开文章'}:{})}};
}
export function selectMediaNews(items,now=Date.now(),limit=90){
 const sorted=uniqueCases(items.filter(i=>marketingArticle(i,mediaSources.find(s=>s.id===i.source))&&Date.parse(i.publishedAt)<=now&&Date.parse(i.publishedAt)>=now-30*86400000)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 const result=[],counts=new Map();for(const item of sorted){if((counts.get(item.source)||0)>=Math.max(8,Math.ceil(limit/5)))continue;result.push(item);counts.set(item.source,(counts.get(item.source)||0)+1);if(result.length>=limit)break;}return result;
}
