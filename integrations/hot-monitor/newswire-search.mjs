import {publicSearchPage} from './public-search-fetch.mjs';
import {load} from 'cheerio';

import {phraseMatches,subjectPassage} from './query-language.mjs';
const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'});
function publishedInNewYork(label){
 const found=label.trim().match(/^([A-Z][a-z]{2} \d{1,2}, \d{4}),? (\d{1,2}:\d{2}) ET$/);
 if(!found)return NaN;
 const wallTime=Date.parse(found[1]+' '+found[2]+' UTC');
 if(!Number.isFinite(wallTime))return NaN;
 const utcOffset=zone.formatToParts(wallTime).find(p=>p.type==='timeZoneName')?.value.match(/GMT(-\d+)/)?.[1];
 return utcOffset?wallTime-Number(utcOffset)*3600000:NaN;
}
export function wireReleases(html,now=Date.now()){
 const $=load(html),rows=[];
 for(const card of $('.newsCards').toArray()){
    const entry=$(card),a=entry.find('h3 a.news-release'),path=a.attr('href'),at=publishedInNewYork(entry.find('h3 small').text());
    if(!/^\/news-releases\/[\w%-]+-\d+\.html$/.test(path||'')||!(at<=now&&at>=now-30*86400000))continue;
    const owner=entry.find('p a[href^="/news/"]').first(),name=owner.text().trim(),title=a.text().trim().replace(/\s+/g,' ');
    if(!title||!name)continue;
    const publisherId='prnewswire:'+owner.attr('href').split('/').filter(Boolean).pop();
    rows.push({title,content:entry.find('.card p').first().text().trim(),url:new URL(path,'https://www.prnewswire.com').href,publisher:name,publisherId,
      issuerChannel:new URL(owner.attr('href'),'https://www.prnewswire.com').href,publishedAt:new Date(at).toISOString(),firstPartyFeed:true,source:'editorial',role:'official',image:entry.find('img').attr('src')});
 }
 return rows;
}
async function readOriginals(rows,terms){
 const ordered=[...rows].sort((a,b)=>Number(terms.some(t=>subjectPassage(b.title+' '+b.content,t)))-Number(terms.some(t=>subjectPassage(a.title+' '+a.content,t))));
 let index=0;
 const worker=async()=>{while(index<Math.min(12,ordered.length)){
    const row=ordered[index++];try{
      const $=load(await publicSearchPage(row.url));
      const paragraphs=$('.release-body p,.generalbody p,article p,.content p,section.release-body p,#dvContent p,.article-content p').toArray()
        .map(el=>$(el).text().replace(/\\s+/g,' ').trim()).filter(t=>t.length>15&&t.length<2100);
      const lead=terms.find(t=>paragraphs.some(p=>phraseMatches(p,t)))||terms.find(t=>paragraphs.some(p=>subjectPassage(p,t)));
      const passage=lead&&paragraphs.find(p=>phraseMatches(p,lead))||lead&&paragraphs.find(p=>subjectPassage(p,lead));
      if(passage){row.content=passage.slice(0,1200);row.originalRead=true;}
    }catch{}
 }};
 await Promise.all(Array.from({length:4},worker));return rows;
}
export async function searchNewswire(term){
 const url=new URL('https://www.prnewswire.com/search/news/');url.searchParams.set('keyword',term);
 const html=await publicSearchPage(url);
 if(!/News Search Results/i.test(html))throw Error('新闻搜索未返回结果页');
 return readOriginals(wireReleases(html),[term]);
}

export function asiaReleases(html,now=Date.now()){
 const $=load(html),rows=[];
 for(const card of $('.search-story-wrap .card').toArray()){
    const entry=$(card),link=entry.find('h3 a'),url=link.attr('href'),stamp=entry.find('.datetime').text().trim();
    if(!/^https:\/\/www\.prnasia\.com\/story\/\d+-\d+\.shtml$/.test(url||'')||!/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(stamp))continue;
    const at=Date.parse(stamp.replace(' ','T')+':00+08:00');if(!(at<=now&&at>=now-30*86400000))continue;
    rows.push({title:link.text().trim(),url,content:entry.find('.card-text-summary').text().replace(/\s+/g,' ').trim(),publishedAt:new Date(at).toISOString(),
      publisher:'美通社亚太',firstPartyFeed:true,role:'media',source:'editorial',image:entry.find('img').attr('src')});
 }return rows;
}
export async function searchAsiaNewswire(query,fragments){
 const queries=[...new Set([query,...fragments.slice(0,2)])];
 const batches=await Promise.allSettled(queries.map(async term=>{
   const url=new URL('https://www.prnasia.com/search/');url.search=new URLSearchParams({lang:'1',post:'1',keywords:term,scope:'fulltext',sortby:'1'});
   const html=await publicSearchPage(url);if(!/search-result-wrap/.test(html))throw Error('未返回新闻检索页');
   return asiaReleases(html);
 }));
 if(batches.every(r=>r.status==='rejected'))throw Error('新闻稿检索暂不可用');
 const rows=[...new Map(batches.flatMap(b=>b.status==='fulfilled'?b.value:[]).map(r=>[r.url,r])).values()];
 return readOriginals(rows,[query]);
}
