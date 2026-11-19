import {topicKey,v2exItems} from '../shared/community.js';
import {apiFetch,publicMode,previewMode} from './urls.js';
import {topicMatches} from '../shared/insights.js';
const publishers=[
  {id:'keedan',name:'KEEDAN',base:'https://keedan.com/track',language:'zh'},
  {id:'coolstyle',name:'COOL 流行酷报',base:'https://www.cool-style.com.tw/wd2',language:'zh'},
  {id:'theindustrybeauty',name:'TheIndustry.beauty',base:'https://theindustry.beauty',language:'en'},
  {id:'dieline',name:'DIELINE',base:'https://thedieline.com',language:'en'},
  {id:'digiday',name:'Digiday',base:'https://digiday.com',language:'en'}
];
const equivalents={
  '亚文化':['次文化','subculture'],'香水':['香水','fragrance'],'香氛':['香氛','fragrance'],
  '潮玩':['潮玩','designer toys'],'品牌联名':['聯名','collaboration'],'快闪':['快閃','pop-up'],
  '美妆':['美妝','beauty'],'运动品牌':['運動品牌','sportswear'],'球鞋':['球鞋','sneakers']
};
function plain(value){
  const el=document.createElement('textarea');
  el.innerHTML=String(value||'').replace(/<[^>]+>/g,' ');
  return el.value.trim();
}
function webLink(value){
  try{return ['https:','http:'].includes(new URL(value).protocol);}catch{return false;}
}
async function getJson(url,signal,timeout=9000){
  const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(timeout)]),credentials:'omit'});
  if(!r.ok)throw Error('HTTP '+r.status);
  return r.json();
}
const translations=new Map();
async function translate(text,pair,signal){
  const key=pair+text;
  if(translations.has(key))return translations.get(key);
  const u=new URL('https://api.mymemory.translated.net/get');
  u.searchParams.set('q',text);u.searchParams.set('langpair',pair);
  const d=await getJson(u,signal);
  const value=plain(d.responseData?.translatedText);
  if(Number(d.responseStatus)!==200||d.quotaFinished||!value)throw Error('translation unavailable');
  if(translations.size>=512)translations.delete(translations.keys().next().value);
  translations.set(key,value);return value;
}
async function fromPublisher(provider,term,query,after,signal){
  const u=new URL(provider.base+'/wp-json/wp/v2/posts');
  u.search=new URLSearchParams({search:term,per_page:'5',after:after.slice(0,19),orderby:'date',order:'desc',_fields:'link,title,date_gmt'});
  const rows=await getJson(u,signal);
  if(!Array.isArray(rows))throw Error('invalid response');
  const items=await Promise.all(rows.filter(r=>webLink(r.link)&&r.date_gmt).map(async r=>{
    const originalTitle=plain(r.title?.rendered),publishedAt=r.date_gmt+'Z';
    if(!originalTitle||Date.parse(publishedAt)>Date.now())return null;
    let title=originalTitle;
    if(provider.language==='en'&&!/[\u3400-\u9fff]/.test(title)){
      try{title=await translate(title,'en|zh-CN',signal);}catch{return null;}
      if(!/[\u3400-\u9fff]/.test(title))return null;
    }
    return {id:r.link,url:r.link,title,originalTitle,publishedAt,source:provider.id,sourceName:provider.name,contentType:'article',matchedQuery:query};
  }));
  return items.filter(Boolean);
}
async function fromNewsIndex(query,days,signal){
  const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  const literal=query.replace(/["()\r\n]/g,' ').trim();
  u.search=new URLSearchParams({query:'"'+literal+'" sourcelang:chinese',mode:'artlist',format:'json',timespan:days+'d',sort:'datedesc',maxrecords:'20'});
  const d=await getJson(u,signal);
  return (d.articles||[]).filter(r=>webLink(r.url)&&/[\u3400-\u9fff]/.test(r.title)&&/品牌|联名|聯名|新品|發售|营销|行銷|快闪|代言|合作|IP|零售|潮流|香氛/.test(r.title)).map(r=>({
    id:r.url,title:plain(r.title),url:r.url,publishedAt:r.seendate?.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/,'$1-$2-$3T$4:$5:$6Z'),
    source:'gdelt-'+r.domain,sourceName:r.domain,contentType:'article',matchedQuery:query,dateBasis:'indexed'
  }));
}
// Each provider publishes independently, so a timeout cannot suppress another source.
export async function searchLiveTopic(query,days,signal,onSource){
  const after=new Date(Date.now()-days*86400000).toISOString();
  const pair=equivalents[query];
  const english=pair?Promise.resolve(pair[1]):/[\u3400-\u9fff]/.test(query)?translate(query,'zh-CN|en',signal).catch(()=>query):Promise.resolve(query);
  const jobs=publishers.map(p=>[p.name,async()=>fromPublisher(p,p.language==='en'?await english:(pair?.[0]||query),query,after,signal)]);
  jobs.push(['GDELT',()=>fromNewsIndex(query,days,signal)]);
  const boards=async()=>{
    try{
      const data=await getJson('https://solarhell.github.io/hot-search-crawler/latest.json',signal);
      for(const b of data.boards||[]){
        const ok=b.ok!==false&&Date.parse(b.fetched_at)>=Date.now()-86400000;
        const rows=(ok?b.items||[]:[]).filter(i=>webLink(i.url)&&topicMatches(i,query)).map(i=>({
          id:i.url,title:i.title,url:i.url,rank:i.rank,observedAt:b.fetched_at,source:b.platform,
          sourceName:b.name,contentType:'hot-topic',matchedQuery:query
        }));
        if(!signal.aborted)onSource(b.name,rows,ok);
      }
    }catch{if(!signal.aborted)onSource('社区公开榜单',[],false);}
  };
  const domestic=async()=>{
    if(publicMode||previewMode)return;
    try{
      const r=await apiFetch('/api/topic-search?'+new URLSearchParams({q:query,days}),{signal});
      if(!r.ok)throw Error('domestic search unavailable');
      for(const part of await r.json())if(!signal.aborted)onSource(part.name,part.items,part.ok,part.community||[]);
    }catch{if(!signal.aborted)onSource('国内媒体',[],false);}
  };
  const forums=async()=>{
    try{
      const u=new URL('https://www.sov2ex.com/api/search');
      u.search=new URLSearchParams({q:topicKey(query),size:'40'});
      const d=await getJson(u,signal);
      if(!Array.isArray(d.hits))throw Error('invalid forum results');
      if(!signal.aborted)onSource('V2EX',[],true,v2exItems(d,query));
    }catch{if(!signal.aborted)onSource('V2EX',[],false);}
  };
  const extra=Promise.all([domestic(),boards(),forums()]);
  await Promise.all(jobs.map(async([name,search])=>{
    try{const items=await search();if(!signal.aborted)onSource(name,items,true);}
    catch{if(!signal.aborted)onSource(name,[],false);}
  }));
  await extra;
}
