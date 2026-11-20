import {probeFragments} from './query-language.mjs';
import {publicSearchPage} from './public-search-fetch.mjs';
import {readArticleMetadata} from '../../server/media-metadata.js';
import {excludedTopic} from './consumer-market.mjs';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import {load} from 'cheerio';

const day=86400000;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const asText=s=>clean(load(String(s||'')).text());
function newsDate(label,now){
  const relative=label.match(/^(\d+)\s*(分钟|小时|天)前$/);
  if(relative)return new Date(now-Number(relative[1])*({'分钟':60000,'小时':3600000,'天':day}[relative[2]])).toISOString();
  const exact=label.match(/^(\d{4}-\d\d-\d\d)(?:\s+(\d\d:\d\d))?$/);
  return exact?new Date(exact[1]+'T'+(exact[2]||'00:00')+':00+08:00').toISOString():null;
}
export function newsHits(html,now=Date.now()){
  const $=load(html);
  const stamp=Number($('body').attr('data-time'))*1000;
  const reference=stamp>0&&stamp<=now?stamp:now;
  return $('.res-list[data-url]').toArray().flatMap(el=>{
    const node=$(el),title=clean(node.find('h3').text()),url=node.attr('data-url');
    const publishedAt=newsDate(node.find('.time').text().trim(),reference);
    if(!publishedAt||!title||!/^https:\/\//i.test(url)||now-Date.parse(publishedAt)>30*day)return [];
    return [{title,url,publishedAt,publisher:clean(node.find('cite').first().text()),content:clean(node.find('.g-summary,.res-desc,.g-content,.summary').first().text()),source:'editorial'}];
  });
}
// Resolve and pin the address for this connection before reading a publisher supplied by an index.
async function publisherResource(address,image=false,feed=false){
  const url=new URL(address);
  if(url.protocol!=='https:'||url.port||url.username||url.password||!/^([a-z\d-]+\.)+[a-z]{2,}$/i.test(url.hostname))throw Error('无公开原文');
  const records=await lookup(url.hostname,{all:true,family:4,signal:AbortSignal.timeout(2500)});
  if(!records.length||records.some(r=>ipaddr.parse(r.address).range()!=='unicast'))throw Error('地址不可用');
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{agent:false,autoSelectFamily:false,family:4,signal:AbortSignal.timeout(4800),
      lookup:(_h,options,cb)=>options.all?cb(null,[records[0]]):cb(null,records[0].address,4),
      headers:{Accept:image?'image/png,image/webp,image/jpeg,image/gif':feed?'application/rss+xml,application/atom+xml,application/xml,text/xml':'text/html','Accept-Encoding':'identity','User-Agent':'CUE-Marketing/1.0'}},res=>{
      if(res.statusCode!==200||!(image?/^image\/(?:png|jpeg|webp|gif)/i.test(res.headers['content-type']||''):(feed?/xml|rss|atom|text\/plain|octet-stream/i.test(res.headers['content-type']||''):res.headers['content-type']?.includes('html')))){res.destroy();return reject(Error('无正文'));}
      const chunks=[];let size=0;
      res.on('error',reject);res.on('data',chunk=>{size+=chunk.length;if(size>(image?6000000:1500000)){res.destroy(Error('正文过大'));return;}chunks.push(chunk);});
      res.on('end',()=>{const body=Buffer.concat(chunks);if(image)return resolve(body);const charset=(res.headers['content-type']+' '+body.subarray(0,1500).toString('ascii')).match(/charset=["']?(gbk|gb2312|gb18030)/i);
        resolve(new TextDecoder(charset?'gb18030':'utf-8').decode(body));});
    });req.on('error',reject);
  });
}
export const publisherText=url=>publisherResource(url);
export const publisherFeed=url=>publisherResource(url,false,true);
export const publisherImage=url=>publisherResource(url,true);
function credit($){return $('meta[name="source"],meta[name="mediaid"],.source,.news-source,.article-source,#source').toArray().map(el=>clean($(el).attr('content')||$(el).text()).replace(/^(?:文章来源|消息来源|来源|Source)\s*[:：]\s*/i,'')).find(x=>x.length>=2&&x.length<=35);}
export async function publisherCredit(address){
  return credit(load(await publisherText(address)))||null;
}
const event=/联名|联动|携手|快闪|合作|首发|新品|推出|品牌|cosplay|collab|campaign|brand|launch/i;
async function hydrate(row,terms){
  try{
    const html=await publisherText(row.url),$=load(html);
    const by=credit($);
    if(by)row.attribution=by;
    row.originalRead=Boolean($('h1,article,#ContentBody').length);
    const image=$('meta[property="og:image"]').attr('content');if(image){try{row.image=new URL(image,row.url).href;}catch{}}
    let date=$('meta[property="article:published_time"],meta[name="pubdate"],meta[name="publishdate"],meta[itemprop="datePublished"]').first().attr('content')||$('time[itemprop="datePublished"]').attr('datetime');
    if(!date)for(const tag of $('script[type="application/ld+json"]').toArray()){
      try{const doc=JSON.parse($(tag).text()),nodes=Array.isArray(doc)?doc:doc['@graph']||[doc];
        date=nodes.find(n=>n&&/Article|NewsArticle|BlogPosting/i.test(String(n['@type']))&&n.datePublished)?.datePublished;if(date)break;
      }catch{}
    }
    date ||= readArticleMetadata(html).publishedAt;
    if(!date)date=$('meta[name="PubDate" i],meta[name="publish_time" i],meta[name="weibo:article:create_at" i]').first().attr('content');
    if(date&&Number.isFinite(Date.parse(date)))row.publishedAt=new Date(date).toISOString();
    const paragraphs=$('article p,main p,.article p,#artibody p,#ContentBody p,.article-content p').toArray().map(el=>clean($(el).text())).filter(s=>s.length>20);
    const hits=paragraphs.filter(p=>terms.some(t=>p.toLowerCase().includes(t.toLowerCase())));
    const best=hits.find(p=>event.test(p))||hits[0]||paragraphs.find(p=>event.test(p));
    const excerpt=clean($('meta[name="description"],meta[property="og:description"]').first().attr('content'));
    const headline=clean($('h1').first().text()||$('meta[property="og:title"]').attr('content'));
    if(headline&&headline.length<=180&&/\.{3}|…/.test(row.title))row.title=headline;
    row.content=[best,excerpt,row.content].filter(Boolean).join(' ').slice(0,900);
  }catch{}
  return row;
}
export async function worldNews(term,terms){
  const words=term.replace(/[^\p{L}\p{N} -]/gu,' ').trim();
  if(!words)return [];
  const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  u.search=new URLSearchParams({query:words,mode:'artlist',format:'json',timespan:'30d',sort:'datedesc',maxrecords:'12'});
  const r=await fetch(u,{signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('国际新闻索引暂不可用');
  const payload=await r.json();
  const list=payload.articles||[];
  const out=[];
  for(let i=0;i<Math.min(list.length,8);i+=4){
    const rows=await Promise.all(list.slice(i,i+4).map(item=>hydrate({source:'editorial',url:item.url,title:item.title,publisher:item.domain},terms)));
    out.push(...rows.filter(row=>row.publishedAt));
  }
  return out;
}
export async function webPages(query,terms){
  const url=new URL('https://www.so.com/s');url.search=new URLSearchParams({q:query,adv_t:'m'});
  const $=load(await publicSearchPage(url));if(!$('title').text().includes('360搜索'))throw Error('网页搜索暂不可用');
  const hits=$('h3.res-title a[data-mdurl]').toArray().map(e=>({url:$(e).attr('data-mdurl'),title:clean($(e).text()),source:'editorial'}))
    .filter(r=>/^https:\/\//.test(r.url)&&!r.url.includes('baike.')&&!/百科|官方网站|官网首页/.test(r.title)).slice(0,12);
  const rows=await Promise.all(hits.map(r=>hydrate(r,terms)));
  // Web-index dates describe indexing. Only the publisher's publication date qualifies.
  return rows.filter(r=>r.publishedAt);
}
// Search result snippets are discovery leads. Only an original publisher page with a
// publication date can become a result; redirects to a search engine are never shown.
export function sogouLinks(html){
 const $=load(html),out=new Map();
 if(!/搜狗搜索/.test($('title').text()))throw Error('未返回公开搜索页');
 for(const a of $('h3 a').toArray()){
  const link=$(a),card=link.closest('.vrwrap,.rb');
  const url=card.find('[data-url^="https://"]').first().attr('data-url')||link.attr('href');
  if(!/^https:\/\//.test(url||'')||/\/\/(?:[^/]+\.)?(?:sogou\.com|baike\.baidu\.com)\//i.test(url))continue;
  const title=clean(link.text());if(title&&!/百科|官方网站|是什么|网址导航/.test(title))out.set(url,{url,title,source:'editorial'});
 }
 if(!out.size&&!/没有找到|未找到相关|找不到和您|没有搜到/.test($('body').text()))throw Error('搜索入口未提供可读的原文列表');
 return [...out.values()];
}
export async function publicWebArticles(query,terms){
 const format=Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',timeZone:'Asia/Shanghai'});
 const parts=probeFragments(query).reverse();
 const probes=[query,'品牌 '+(parts.length?parts.join(' '):query)+' 新推出',query+' '+format.format(Date.now())];
 const lists=await Promise.allSettled(probes.map(async text=>{
   const url=new URL('https://www.sogou.com/web');url.search=new URLSearchParams(text===query?{query:text,tsn:'3'}:{query:text});
   return sogouLinks(await publicSearchPage(url));
 }));
 if(lists.every(r=>r.status==='rejected'))throw Error('网页检索暂不可用');
 const links=new Map();for(const list of lists)if(list.status==='fulfilled')for(const r of list.value.slice(0,8))links.set(r.url,r);
 const rows=await Promise.all([...links.values()].slice(0,16).map(r=>hydrate(r,terms)));
 return rows.filter(r=>r.publishedAt&&Date.parse(r.publishedAt)>=Date.now()-30*day);
}
export async function webNews(queries,terms){
  const batches=await Promise.allSettled([...new Set(queries)].slice(0,5).map(async q=>{
    const url=new URL('https://news.so.com/ns');url.search=new URLSearchParams({q,tn:'news',rank:'rank'});
    const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('新闻索引暂不可用');
    const html=await r.text();if(!html.includes('body_SO'))throw Error('新闻索引暂不可用');
    return newsHits(html);
  }));
  if(batches.every(b=>b.status==='rejected'))throw Error('新闻索引暂不可用');
  const groups=batches.filter(b=>b.status==='fulfilled').map(b=>b.value.filter(r=>!excludedTopic(r.title)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)));
  const unique=new Map();
  for(let i=0;i<10&&unique.size<28;i++)for(const group of groups){if(group[i]&&!unique.has(group[i].url))unique.set(group[i].url,group[i]);}
  const rows=[...unique.values()].slice(0,28),out=[];
  for(let i=0;i<rows.length;i+=7)out.push(...await Promise.all(rows.slice(i,i+7).map(r=>hydrate(r,terms))));
  return out;
}
export async function internationalNews(term){
  const url=new URL('https://public-api.wordpress.com/rest/v1.1/read/search');
  url.search=new URLSearchParams({q:term,number:'35',order_by:'date',after:new Date(Date.now()-30*day).toISOString().slice(0,10),fields:'title,URL,date,excerpt,site_name,like_count,comment_count'});
  const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('国际出版索引暂不可用');
  const {posts}=await r.json();if(!Array.isArray(posts))throw Error('国际出版索引暂不可用');
  return posts.filter(p=>/^https?:\/\//i.test(p.URL)).map(p=>({source:'editorial',publisher:asText(p.site_name),title:asText(p.title),content:asText(p.excerpt).slice(0,480),url:p.URL,publishedAt:p.date,
    likeCount:Number.isSafeInteger(p.like_count)?p.like_count:undefined,commentCount:Number.isSafeInteger(p.comment_count)?p.comment_count:undefined}));
}
