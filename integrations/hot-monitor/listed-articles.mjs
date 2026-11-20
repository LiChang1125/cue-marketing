import {load} from 'cheerio';
import {publicationDate} from '../../server/media-metadata.js';
import {consumerContent} from './consumer-market.mjs';

const lists = {
 'store.alpen-group.jp':{publisher:'Alpen Group',card:'.m-list-news li',link:'a[href]',path:/^\/corporate\/news\//,heading:'.news-ttl'},
 'foodaily.com': {publisher:'Foodaily每日食品',card:'.news-wrapper',link:'.news-title a',path:/^\/articles\/\d+/},
 'socialbeta.com': {publisher:'SocialBeta',card:'li',link:'.tit a',path:/^\/campaign\/\d+/},
 'digitaling.com': {publisher:'数英',card:'.page_1',link:'a[href*="/articles/"]',path:/^\/articles\/\d+\.html/},
 'finance.eastmoney.com': {publisher:'东方财富',card:'li',link:'a[href*="/a/"]',path:/^\/a\/(20\d{6})\d+\.html/}
};

export function listedArticles(html,source,now){
 const config=lists[source.id];
 if(!config)return [];
 const $=load(html),items=[];
 for(const el of $(config.card).toArray()){
  const card=$(el);
  const a=card.find(config.link).toArray().map(n=>$(n)).find(n=>n.text().trim().length>=7);
  if(!a)continue;
  let url;try{url=new URL(a.attr('href'),source.url);}catch{continue;}
  if(url.hostname.replace(/^www\./,'')!==source.id||!config.path.test(url.pathname))continue;
  const content=card.text().replace(/\s+/g,' ').trim().slice(0,650);
  const exact=content.match(/20\d\d[-/.]\d{1,2}[-/.]\d{2}/)?.[0];
  const ago=content.match(/(\d+)\s*(分钟|小时|天)前/);
  const datedPath=source.id==='finance.eastmoney.com'&&config.path.exec(url.pathname)?.[1];
  const publishedAt=exact?publicationDate(exact.replaceAll('.','-')):ago?new Date(now-Number(ago[1])*({'分钟':60000,'小时':3600000,'天':86400000}[ago[2]])).toISOString():datedPath?publicationDate(datedPath.replace(/(\d{4})(\d\d)(\d\d)/,'$1-$2-$3')):null;
  if(!publishedAt||Date.parse(publishedAt)>now||now-Date.parse(publishedAt)>30*86400000)continue;
  const img=card.find('img').first(),src=img.attr('data-original')||img.attr('data-src')||img.attr('src');
  const row={approximateDate:Boolean(!exact&&ago),title:(config.heading?card.find(config.heading).text():a.text()).trim(),content,url:url.href,publishedAt,publisher:config.publisher,publisherId:source.id,role:'media',source:'editorial',firstPartyFeed:true};
  if(src){try{row.image=new URL(src,source.url).href;}catch{}}
  if(consumerContent(row))items.push(row);
 }
 return [...new Map(items.map(r=>[r.url,r])).values()];
}
