import {load} from 'cheerio';
import catalog from '../../config/pulse-recommended.json' with {type:'json'};
import {readArticleMetadata,articlePath} from '../../server/media-metadata.js';
import {consumerContent} from './consumer-market.mjs';
import {publisherFeed} from './open-news.mjs';
const host=url=>new URL(url).hostname.replace(/^www\./,'');
const norm=s=>String(s||'').replace(/\s/g,'').toLowerCase();
const bylines=new Map(catalog.bylines.map(n=>[norm(n),n]));
export function creditedAuthor(author){return bylines.get(norm(author));}
export function listedPublishers(){
 const rows=[];
 for(const site of catalog.sites){if(!site.url)continue;
  const url=new URL(site.url);if(url.protocol!=='https:'||url.hostname==='shturl.cc')continue;
  const feed=site.feed?new URL(site.feed):null;
  const useFeed=feed?.protocol==='https:'&&host(feed)===host(url);
  rows.push({id:host(url),url:useFeed?feed.href:url.href,role:site.role||'media',format:useFeed?'rss':'discover',name:site.name});
 }
 return rows;
}
async function htmlAt(url,signal,domain){
 let target=new URL(url);
 for(let i=0;i<3;i++){
   if(target.protocol!=='https:'||host(target)!==domain||target.username||target.password||target.port)throw Error('出版地址不符');
   const r=await fetch(target,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),redirect:'manual'});
   if(r.status>=300&&r.status<400&&r.headers.get('location')){target=new URL(r.headers.get('location'),target);await r.body?.cancel();continue;}
   if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
   const chunks=[];let length=0;for await(const c of r.body){length+=c.length;if(length>2200000)break;chunks.push(c);}
   return Buffer.concat(chunks).toString('utf8');
 }
 throw Error('出版方重定向过多');
}
export async function discoverPublisher(source,now,signal,parse){
 const html=await htmlAt(source.url,signal,source.id),$=load(html);
 const recognized=norm($('title').text()+' '+$('meta[property="og:site_name"]').attr('content'));
 const aliases=norm(source.name).split(/[&｜|（(]/).filter(Boolean);
 if(source.name&&/[\u3400-\u9fff]/.test(source.name)&&!aliases.some(a=>recognized.includes(a.slice(0,2)))&&!recognized.includes(source.id.split('.')[0]))return [];
 const links=$('link[rel="alternate"][type*="xml"]').map((_,e)=>$(e).attr('href')).get();
 for(const entry of links.slice(0,2)){try{const u=new URL(entry,source.url);if(host(u)!==source.id)continue;const rows=parse(await publisherFeed(u.href),source,now).filter(consumerContent);if(rows.length)return rows;}catch{}}
 const picked=new Set();
 for(const a of $('article a[href],main a[href],h2 a[href],h3 a[href],a[href]').toArray()){
   let u;try{u=new URL($(a).attr('href'),source.url);}catch{continue;}
   if(u.protocol==='https:'&&host(u)===source.id&&articlePath(u.href,{})&&!/\.(?:pdf|zip)$/i.test(u.pathname)&&u.pathname!==new URL(source.url).pathname&&$(a).text().trim().length>=6)picked.add(u.href);
   if(picked.size>=5)break;
 }
 const results=await Promise.allSettled([...picked].map(async url=>{
  const body=await htmlAt(url,signal,source.id),doc=load(body),meta=readArticleMetadata(body,{},now);
  const at=Date.parse(meta.publishedAt);
  if(!meta.title||!(at<=now&&at>=now-30*86400000))return;
  const author=doc('meta[name="author"]').attr('content')||doc('[rel="author"]').first().text();
  const row={title:meta.title,url,publishedAt:meta.publishedAt,content:meta.excerpt||'',image:meta.image,publisher:source.name||source.id,publisherId:source.id,author,role:creditedAuthor(author)?'creator':source.role,source:'editorial'};
  if(consumerContent(row))return row;
 }));
 return results.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
}

