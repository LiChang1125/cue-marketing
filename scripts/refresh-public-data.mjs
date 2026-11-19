import {refreshCommunityTopics} from '../server/community-topics.js';
import {discovery} from '../shared/social-discovery.js';
import {collectSocialTrends} from '../server/social-trends.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {mediaSources,mediaSource} from '../shared/media-sources.js';
import {collectMediaSource,selectMediaNews,marketingArticle,fetchPublicText,parseMediaHtml} from '../server/media-news.js';
import {uniqueCases} from '../shared/insights.js';
import {featuredNews} from '../shared/featured.js';
import {curatedPage} from '../server/curated.js';
import {curatedTabs} from '../shared/curated.js';
import {createArticleService} from '../server/articles.js';
import {reportSchedule,yesterdayWindow,marketingSection} from '../server/reports.js';

const now=new Date(),output=process.env.PUBLIC_DATA_OUTPUT||'.artifacts/public-data/content-data.json';
const site='https://lichang1125.github.io/cue-marketing/';
let previous;
if(process.env.PUBLIC_DATA_PREVIOUS){previous=JSON.parse(await readFile(process.env.PUBLIC_DATA_PREVIOUS,'utf8'));}
else for(const path of ['content-data.json','preview-data.json']){try{const r=await fetch(site+path,{signal:AbortSignal.timeout(20000)});if(r.ok){previous=await r.json();break;}}catch{}}
if(!previous?.curated||!previous?.reports)throw Error('Previous published content is required to preserve curated articles and report archives');
const socialTrends=collectSocialTrends(previous.feed?.socialTrends);
const collected=[],sources=[];let cursor=0;
await Promise.all(Array.from({length:5},async()=>{while(cursor<mediaSources.length){const source=mediaSources[cursor++];try{const result=await collectMediaSource(source,{details:48,previous:previous.feed?.items||[]});collected.push(...result.items);sources.push(result.status);console.log(source.name+': '+result.items.length);}catch(e){sources.push({id:source.id,name:source.name,state:'unavailable',count:0,message:e.message,checkedAt:now.toISOString()});console.log(source.name+': unavailable');}}}));
// Walk public editorial archives to broaden keyword coverage, never platform accounts.
const archives=[];
for(let page=2;page<=6;page++){archives.push(['socialbeta',`https://socialbeta.com/campaign?page=${page}`]);archives.push(['brandstar',`https://radar.brandstar.com.cn/?pno=${page}`]);}
for(let i=0;i<archives.length;i+=3)await Promise.all(archives.slice(i,i+3).map(async([id,url])=>{try{const {body}=await fetchPublicText(url);collected.push(...parseMediaHtml(body,mediaSource(id),now.toISOString()));}catch{}}));
const oldItems=(previous.feed?.items||[]).filter(i=>mediaSource(i.source));
const items=selectMediaNews([...collected,...oldItems],now.getTime(),1200);
if(!items.length)throw Error('No verified editorial articles; leaving the published site intact');
const service=createArticleService('.artifacts/public-articles');
const curated={...previous.curated};
for(const [kind] of curatedTabs){try{const page=await curatedPage(kind);if(page.items.length)curated[kind]=uniqueCases([...page.items,...(previous.curated[kind]||[])]);}catch{}}
for(let page=2;page<=5;page++){try{const more=await curatedPage('all',page);curated.all=uniqueCases([...(curated.all||[]),...more.items]);if(!more.items.length)break;}catch{break;}}
const resolveItems=uniqueCases([...items.filter(i=>i.source==='brandstar'),...Object.values(curated).flat()]);
const resolved=new Map();for(let i=0;i<resolveItems.length;i+=6)await Promise.all(resolveItems.slice(i,i+6).map(async item=>{try{resolved.set(item.id,await service.resolveLink(item));}catch{}}));
const imageCache=new Map();const priority=selectMediaNews(items,now.getTime(),48);
for(let i=0;i<priority.length;i+=5)await Promise.all(priority.slice(i,i+5).map(async item=>{try{const input={...item};if(/default_img|placeholder|favicon|site-logo/i.test(input.image||''))input.image=null;imageCache.set(item.id,await service.enrich(input));}catch{}}));
const decorate=i=>{const item={...i,...resolved.get(i.id)};delete item.imageLocal;return {...item,...imageCache.get(i.id)};};
let native={items:[],platforms:[]};try{native=JSON.parse(await readFile('.artifacts/trendradar-native-current.json','utf8'));}catch{}
const nativeItems=uniqueCases([...(native.items||[]),...(previous.feed?.radar?.items||[])]).filter(i=>{const at=Date.parse(i.publishedAt||i.observedAt);return at<=now.getTime()&&at>=now.getTime()-30*86400000;}).slice(0,3000);
const nativePictures=nativeItems.filter(i=>i.contentType==='article').slice(0,24);
for(let i=0;i<nativePictures.length;i+=5)await Promise.all(nativePictures.slice(i,i+5).map(async item=>{try{const enriched=await service.enrich(item);Object.assign(item,enriched);}catch{}}));
const cleanItems=items.map(decorate);for(const kind of Object.keys(curated))curated[kind]=curated[kind].map(decorate);
const editorial=selectMediaNews(cleanItems,now.getTime(),90);
if(featuredNews(editorial,now.getTime()).length<3)throw Error('Three verified original hero images are required; keeping the last release');
const activeSources=mediaSources.filter(s=>cleanItems.some(i=>i.source===s.id)).map(s=>({...s,...sources.find(x=>x.id===s.id)}));
const reports={...previous.reports,reports:previous.reports.reports.map(r=>({...r,entries:r.entries.map(decorate)}))};
const schedule=reportSchedule(now),window=yesterdayWindow(now);
if(schedule.ready&&!reports.reports.some(r=>r.date===schedule.day&&r.entries.length)){
 const entries=selectMediaNews(cleanItems.filter(i=>Date.parse(i.publishedAt)>=window.start&&Date.parse(i.publishedAt)<window.end),now.getTime(),12).map(i=>({...i,sourceName:i.publisher,section:marketingSection(i)||'品牌与公司',attribution:'行业媒体报道'}));
 if(entries.length)reports.reports.unshift({date:schedule.day,newsDate:window.newsDate,title:'CUE 早报',subtitle:entries.slice(0,3).map(i=>i.title).join('；'),scheduledAt:schedule.due,generatedAt:now.toISOString(),status:'ready',entries});
}
reports.reports=reports.reports.slice(0,90);
const market=await socialTrends;
market.editorialCases=uniqueCases(Object.values(curated).flat())
 .filter(i=>Date.parse(i.publishedAt)>=now.getTime()-14*86400000)
 .map(({title,originalTitle,url,originalUrl,publishedAt,publisher,excerpt})=>({title,originalTitle,url,originalUrl,publishedAt,publisher,excerpt}));
const featuredSubjects=discovery(market,cleanItems,now.getTime(),nativeItems).brands;
market.communityTopics=await refreshCommunityTopics(previous.feed?.socialTrends?.communityTopics,
 ['DeepSeek 鲸鱼',...featuredSubjects.slice(0,9).map(b=>b.name)],now.getTime());
const data={schemaVersion:3,generatedAt:now.toISOString(),translationCache:previous.translationCache||{},feed:{socialTrends:market,radar:{engine:'TrendRadar',items:nativeItems,platforms:native.platforms,generatedAt:native.generatedAt},items:cleanItems,editorial,editorialCandidates:cleanItems,sources:activeSources,topics:[],hotlist:editorial.slice(0,8)},curated,reports,histories:{},sourceHealth:sources};
await mkdir(output.replace(/[\\/][^\\/]+$/,''),{recursive:true});await writeFile(output,JSON.stringify(data));
console.log(JSON.stringify({articles:cleanItems.length,activeMedia:activeSources.length,nativeItems:nativeItems.length,platforms:native.platforms,reports:reports.reports.length,output}));
