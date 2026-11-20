import {load} from 'cheerio';
import * as OpenCC from 'opencc-js';
import {publicSearchPage} from './public-search-fetch.mjs';

const toTraditional=OpenCC.Converter({from:'cn',to:'twp'}),toSimple=OpenCC.Converter({from:'tw',to:'cn'});
export const regionalTerms=term=>[...new Set([term,toTraditional(term),toSimple(term)])];
const clean=s=>load(String(s||''),null,false).text().replace(/\s+/gu,' ').trim();
function date(label,now){
 const m=String(label).match(/\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?/);if(!m)return;
 const t=Date.parse(m[0].replace(' ','T')+'+08:00');
 if(t<=now&&t>=now-30*86400000)return new Date(t).toISOString();
}
export function chinaNewsRows(html,now=Date.now()){
 const payload=html.match(/\bvar docArr\s*=\s*(\[[^\r\n]*\])\s*;/);
 if(!payload)throw Error('缺少中新搜索结果');
 return JSON.parse(payload[1]).flatMap(item=>{
   if(!/^https?:\/\/(?:[\w-]+\.)?(?:chinanews\.com(?:\.cn)?|ecns\.cn)\/[^?#]+\/[\w.-]+$/i.test(item.url||''))return [];
   const publishedAt=date(item.pubtime,now)||date(item.createtime,now);
   if(!publishedAt||!item.title)return [];
   return [{title:clean(item.title),content:clean(item.content_without_tag),url:item.url.replace(/^http:/,'https:'),publishedAt,
      source:'editorial',publisher:'中国新闻网',publisherId:'chinanews.com.cn',firstPartyFeed:true,
      image:/^https:\/\//.test(item.thumbnail_file)?item.thumbnail_file:undefined}];
 });
}
export function etTodayRows(html,now=Date.now()){
 const $=load(html),rows=[];
 if(!/ETtoday/.test($('title').text()))throw Error('缺少媒体搜索页');
 for(const entry of $('.archive').toArray()){
   const card=$(entry),link=card.find('h2 a'),url=link.attr('href')||'';
   if(!/^https:\/\/(?:[\w-]+\.)?ettoday\.net\/(?:news|article)\/(?:\d+\/)?\d+(?:\.htm)?\/?$/.test(url))continue;
   const detail=card.find('.detail').clone(),publishedAt=date(detail.find('.date').text(),now);detail.find('.date').remove();
   if(!publishedAt||!link.text().trim())continue;
   const image=card.find('img').attr('src')||'';
   rows.push({title:toSimple(link.text().trim()),originalTitle:link.text().trim(),content:toSimple(detail.text().trim()),url,publishedAt,
     publisher:'ETtoday 新闻云',publisherId:'ettoday.net',firstPartyFeed:true,source:'editorial',image:image.startsWith('//')?'https:'+image:image||undefined});
 }return rows;
}
export async function searchRegionalNews(topic,provider){
 const taiwan=provider==='ettoday',query=taiwan?toTraditional(topic):toSimple(topic);
 const url=new URL(taiwan?'https://www.ettoday.net/news_search/doSearch.php':'https://sou.chinanews.com.cn/search.do');
 url.search=taiwan?new URLSearchParams({keywords:query}):new URLSearchParams({q:query,sortType:'_score',dateType:'1month',searchField:'all'});
 const html=await publicSearchPage(url);return taiwan?etTodayRows(html):chinaNewsRows(html);
}
