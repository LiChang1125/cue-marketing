import {load} from 'cheerio';
import {readArticleMetadata,publicationDate,articlePath} from './media-metadata.js';
import {createHash} from 'node:crypto';
import {mediaSources,mediaIds} from '../shared/media-sources.js';
import {meaningfulContent} from '../shared/quality.js';
import {consumerContent} from '../integrations/hot-monitor/consumer-market.mjs';
import {sectorId,uniqueCases} from '../shared/insights.js';
import {parseSocialBeta,parseBrandstar} from './sources.js';
const editorial=/品牌|营销|行銷|廣告|广告|联名|聯名|消费|零售|新品|快闪|香水|香氛|潮玩|campaign|brand|marketing|advertis|retail|fragrance|perfume|collaborat|pop.up|consumer|e.commerce|packaging|rebrand|logo|loyalty|sponsor|marketer|消费者|用户洞察|品牌传播|短片|TVC|包装|雙11|双11|快閃|零售|消費|行销/i;
const noise=/招聘|招募|培训报名|征稿|课程报名|早安|晚安|中奖|抽奖|获奖名单|职位|净利润|季度业绩|财务业绩|领导讲话|高质量发展|Logo.*Skill|annual results|quarterly earnings|job vacancy|senior hires|hall of good|appoints? |promot(?:es|ed) |joins? .* as |chief .* officer|(?:award|awards) (?:entries|deadline)|nominations? open|affiliate deals|best .* deals|coupon/i;
const text=value=>load('<body>'+String(value||'')+'</body>')('body').text().replace(/\s+/g,' ').trim();
export function marketingArticle(item,source){
 if(source?.consumerOnly&&!consumerContent(item))return false;
 const title=item.originalTitle||item.title||'',excerpt=item.originalExcerpt||item.excerpt||'';
 return mediaIds.has(item.source)&&meaningfulContent(item)&&!noise.test(title)&&!/restock|where to buy|购物清单|招标|代理公司需要|升任|任命|临床|医疗器械|供应商招募|get \d+% off|free entry|entries open|jury chairs|on the hunt for.*role|local authorities/i.test(title)&&! /\/(company|people|user|tags|jobs)\//.test(item.url||'')&&title.length>=8&&title.length<=180&&(source?.specialized?(['adguider','meihua','digitaling','adquan','topmarketing'].includes(source.key)&&articlePath(item.url,source))||editorial.test(title+' '+excerpt)||/case|strategy|creative|design|创意|策略|案例|設計|设计|洞察/i.test(title):editorial.test(title));
}
function safeUrl(value,base){if(typeof value!=='string'||!value.trim())return null;try{const u=new URL(value,base);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}
function sameSite(url,source){try{return new URL(url).hostname.replace(/^www\./,'')===new URL(source.url).hostname.replace(/^www\./,'');}catch{return false;}}
export function normalize(source,item,now){
 const title=text(item.title).replace(/\s*20\d{2}[-/]\d{1,2}[-/]\d{1,2}\s*$/,'').replace(/^[A-Z\s]+\d{1,2} [A-Za-z]+ 20\d{2}/,''),url=safeUrl(item.url,source.url),at=Date.parse(publicationDate(item.publishedAt));
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
 $('a[href]').each((_,el)=>{const a=$(el),href=safeUrl(a.attr('href'),source.url),title=a.attr('title')||a.find('h1,h2,h3,h4').first().text()||a.clone().find('script,style').remove().end().text();
 if(!href||!sameSite(href,source)||text(title).length<8||text(title).length>210||!articlePath(href,source))return;
 const row=a.closest('article,li,.item,.post,.card,.news-item,.article-item,.articleItem,.list-item,.news_box').length?a.closest('article,li,.item,.post,.card,.news-item,.article-item,.articleItem,.list-item,.news_box'):a.parent();
 const date=row.find('time').attr('datetime')||row.find('time,.item-date,.date,.time').first().text().trim()||row.find('[itemprop="datePublished"]').attr('content')||row.text().match(/20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/)?.[0];
 const image=row.find('img').first();
 const item=normalize(source,{title,url:href,publishedAt:date,excerpt:row.find('p').first().text(),image:image.attr('data-original')||image.attr('data-src')||image.attr('src')},now);if(item)out.push(item);
 });return uniqueCases(out);
}
export async function fetchPublicText(url,fetcher=fetch){const response=await fetcher(url,{headers:{'User-Agent':'CUE-MediaReader/1.0 (+https://github.com/LiChang1125/cue-marketing)','Accept':'application/rss+xml, application/atom+xml, text/html, application/xml;q=0.9,*/*;q=0.5'},signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('HTTP '+response.status);const body=await response.text();if(body.length>8e6)throw Error('Response too large');return {body,url:response.url};}
export async function collectMediaSource(source,{fetcher=fetch,now=new Date().toISOString(),details=36,previous=[]}={}){
 let items=[],method='html',lastError,successful=0;const attempts=[];
 const urls=[...new Set([source.feed,source.url,...(source.entries||[])].filter(Boolean))];
 for(const entry of urls){try{const {body,url}=await fetchPublicText(entry,fetcher);if(!sameSite(url,source))throw Error('来源已跳转，需核实新站点');successful++;let found=/^\s*<\?xml|<rss[ >]|<feed[ >]/i.test(body)?parseMediaFeed(body,source,now):parseMediaHtml(body,source,now);if(/<rss[ >]|<feed[ >]/i.test(body))method='rss+html';items.push(...found);attempts.push({url:entry,state:'ok',found:found.length});
 if(entry===source.url&&!source.feed){const $=load(body);const feed=$('link[type="application/rss+xml"],link[type="application/atom+xml"]').first().attr('href');const resolved=safeUrl(feed,source.url);if(resolved&&sameSite(resolved,source)&&!urls.includes(resolved))urls.push(resolved);}
 }catch(e){lastError=e;attempts.push({url:entry,state:'unavailable',message:e.message});}}
 const candidates=uniqueCases(items).filter(i=>articlePath(i.url,source)||['socialbeta','brandstar'].includes(source.id)).filter(i=>!noise.test(i.title)).slice(0,180);
 const verified=new Map(previous.filter(i=>i.source===source.id&&i.publishedAt).map(i=>[i.id,i]));
 for(const item of candidates){const prior=verified.get(item.id);if(prior){item.publishedAt||=prior.publishedAt;item.excerpt||=prior.originalExcerpt||prior.excerpt||'';item.image||=prior.image;}}
 const undated=candidates.filter(i=>!i.publishedAt||source.id==='media-adquan').slice(0,details);
 for(let k=0;k<undated.length;k+=4)await Promise.all(undated.slice(k,k+4).map(async item=>{try{const {body}=await fetchPublicText(item.url,fetcher),metadata=readArticleMetadata(body,source,Date.parse(now));
 if(metadata.publishedAt&&Date.parse(metadata.publishedAt)<=Date.parse(now)+300000)item.publishedAt=metadata.publishedAt;
 if(metadata.title&&metadata.title.length>=8&&metadata.title.length<=180)item.title=metadata.title;
 item.image||=safeUrl(metadata.image,item.url);item.excerpt||=metadata.excerpt||'';
 }catch{}}));
 const recent=candidates.filter(i=>marketingArticle(i,source)&&i.publishedAt&&Date.parse(i.publishedAt)>=Date.parse(now)-30*86400000&&Date.parse(i.publishedAt)<=Date.parse(now));
 return {items:recent,status:{id:source.id,name:source.name,url:source.url,method,state:recent.length?'ok':successful?'no-recent-content':'unavailable',count:recent.length,candidates:candidates.length,undated:candidates.filter(i=>!i.publishedAt).length,attempts,checkedAt:now,...(!successful?{message:lastError?.message||'未发现可核实的公开文章'}:{})}};
}
export function selectMediaNews(items,now=Date.now(),limit=90){
 const sorted=uniqueCases(items.filter(i=>marketingArticle(i,mediaSources.find(s=>s.id===i.source))&&Date.parse(i.publishedAt)<=now&&Date.parse(i.publishedAt)>=now-30*86400000)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 const result=[],counts=new Map();for(const item of sorted){if((counts.get(item.source)||0)>=Math.max(8,Math.ceil(limit/5)))continue;result.push(item);counts.set(item.source,(counts.get(item.source)||0)+1);if(result.length>=limit)break;}return result;
}
