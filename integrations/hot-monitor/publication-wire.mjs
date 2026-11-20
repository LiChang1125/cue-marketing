import {writeFile,readFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {consumerContent,excludedSearchSource} from './consumer-market.mjs';
import {publicationPictures} from './publication-pictures.mjs';
import {mediaSources} from '../../shared/media-sources.js';
import {normalize,marketingArticle} from '../../server/media-news.js';
const host=u=>new URL(u).hostname.replace(/^www\./,'');
const homeSources=new Map(mediaSources.map(s=>[host(s.url),s]));
const change=/上新|冠名|上架|登场|揭幕|展出|开售|签约|限定版|推出|联名|联动|发售|发布|开业|推出|首店|携手|合作|上新|新品|上市|授权|企划|代言|快闪|新款|品牌活动|限定|新品|旗舰店|签约|开幕|跨界|コラボ|別注|発売|登場|オープン|pop.up|opens?|launch|partners?|unveils?|debut|campaign|limited edition|collab|release/i;
export function liveNewswire(desk,translate,dir,publishHome){
 const pictures=publicationPictures(dir),file=join(dir,'pulse-wire.json');let active,closed=false,timer;
 async function poll(){
   await desk.ready;
   const before=JSON.parse(await readFile(file,'utf8').catch(()=>'[]')),known=new Set(before.map(r=>r.url)),now=Date.now();
   const pool=[...desk.items(),...desk.globalRecent()].filter(r=>r.title&&Date.parse(r.publishedAt)<=now&&now-Date.parse(r.publishedAt)<(r.role==='official'?7*86400000:48*3600000)&&!excludedSearchSource(r)&&consumerContent(r)&&change.test(r.title));
   const latest=new Map();for(const r of pool.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)))if(!known.has(r.url)&&!latest.has(r.url))latest.set(r.url,r);
   const allowed=[...latest.values()].filter(r=>homeSources.has(host(r.url))&&/[一-龥]/.test(r.title)&&!/[ぁ-ヿ]/.test(r.title));
   const fresh=[...new Map([...allowed.slice(0,6),...[...latest.values()].filter(r=>r.role==='official').slice(0,4),...[...latest.values()].slice(0,12)].map(r=>[r.url,r])).values()];
   if(!fresh.length||closed)return;
   const rendered=await translate(fresh.map(r=>({title:r.title,content:r.content?.slice(0,160)||'',originalTitle:r.title,role:r.role,image:r.image,url:r.url,publishedAt:r.publishedAt,publisher:r.publisher||r.publisherId})));
   const rows=rendered.filter(r=>(r.title.match(/[一-龥]/g)||[]).length>=5&&!/^\d{1,2}月\d{1,2}日(?:\(.{1,4}\))?[,，.。]?$/.test(r.title)&&r.title!=='中文标题暂不可用'&&/[一-龥]/.test(r.title));
   if(!rows.length||closed)return;
   const all=[...rows,...before].filter(r=>now-Date.parse(r.publishedAt)<7*86400000).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,450);
   const tmp=file+'.'+process.pid+'.tmp';await writeFile(tmp,JSON.stringify(all));await rename(tmp,file);
   if(publishHome){
     const homepage=all.flatMap(r=>{
       const src=homeSources.get(host(r.url));if(!src)return [];
       const v=normalize(src,{...r,excerpt:r.content||r.title},new Date(now).toISOString());
       return v&&marketingArticle(v,src)?[{...v,rollingPublication:true,originalTitle:r.originalTitle}]:[];
     });
     if(homepage.length){
       const illustrated=await pictures(homepage.slice(0,8));
       for(const r of illustrated)if(r.imageLocal)r.imageOrigin=r.image;
       await publishHome(homepage);
     }
   }
 }
 function tick(){if(!closed&&!active)active=poll().catch(e=>console.error('脉动快讯更新',e.message)).finally(()=>{active=null;});}
 return {start(){tick();timer=setInterval(tick,60000);timer.unref();},close(){closed=true;clearInterval(timer);}};
}

