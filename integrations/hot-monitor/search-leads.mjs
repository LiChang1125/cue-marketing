import {publicSearchPage} from './public-search-fetch.mjs';
import {mkdir,rename,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {load} from 'cheerio';
import {consumerBrands} from './brand-attention.mjs';

// A publisher credited as an issuer and named campaign partners can be previously unknown brands.
function namedParties(row,title){
 const out=new Set(consumerBrands(title));
 if(row.role==='official'&&row.issuerChannel&&row.publisher)out.add(row.publisher.replace(/^(?:株式会社|有限会社)|(?:株式会社|有限公司)$/gu,'').trim());
 const paired=/([A-Z][A-Za-z0-9'-]*(?: [A-Z][A-Za-z0-9'-]*){0,2}|[\p{Script=Han}]{2,8})\s*(?:×|\s[xX]\s|携手|牵手|聯乘|联乘)\s*([A-Z][A-Za-z0-9'-]*(?: [A-Z][A-Za-z0-9'-]*){0,2}|[\p{Script=Han}]{2,8})/gu;
 for(const m of title.matchAll(paired)){out.add(m[1]);out.add(m[2].split(/推出|联名|聯名|发布|限定|打造/)[0]);}
 return [...out].filter(value=>value.length>=2&&value.length<=48&&!/^品牌|^新品|^联名|^限定|^系列/.test(value));
}

export function leadsFor(rows,query){
  const counts=new Map();
  for(const row of rows){
    const title=row.originalTitle||row.title;
    const names=[...title.matchAll(/[《「“『]([^》」”』]{3,38})[》」”』]/gu)].map(m=>m[1]);
    const mentions=[...names,...namedParties(row,title),...(row.subjects||[])];
    for(const name of new Set(mentions)){
      if(name.toLowerCase()===query.toLowerCase()||name.length<2||name.length>48)continue;
      const item=counts.get(name)||{name,weight:0};
      item.weight+=names.includes(name)?3:1;counts.set(name,item);
    }
  }
  return [...counts.values()].sort((a,b)=>b.weight-a.weight).slice(0,5).map(r=>r.name);
}

// A story without the umbrella keyword must share two named identifiers with a verified seed.
export function relatedCampaigns(seeds){
 const anchors=[];
 for(const seed of seeds){
  const text=seed.originalTitle||seed.title;
  const brands=namedParties(seed,text);
  const quoted=[...text.matchAll(/[《「“『]([^》」”』]{3,40})[》」”』]/gu)].map(m=>m[1]);
  const products=text.match(/\b[A-Za-z]{2,12}[- ]?\d{2,6}[A-Za-z]?\b/gu)||[];
  const names=[...new Set([...brands,...quoted,...products])].filter(s=>s.length>=2);
  if(names.length<2)continue;
  if(!quoted.length&&!products.length&&!/联名|联动|携手|collab|コラボ| [×x] /i.test(text))continue;
  anchors.push({names,url:seed.url});
 }
 return anchors.slice(0,24);
}
export function campaignMatch(row,campaigns){
 const text=(row.title+' '+String(row.content||'').slice(0,220)).normalize('NFKC').toLowerCase();
 return campaigns.find(c=>c.url!==row.url&&c.names.filter(n=>text.includes(n.normalize('NFKC').toLowerCase())).length>=2);
}
// Yahoo Japan carries attributed articles from Japanese publishers. Read only the search results array.
async function fetchJapanese(term){
  const u=new URL('https://news.yahoo.co.jp/search');u.searchParams.set('p',term);
  const $=load(await publicSearchPage(u)),prefix='window.__PRELOADED_STATE__ = ';
  const state=$('script').toArray().map(s=>$(s).text().trim()).find(s=>s.startsWith(prefix));
  if(!state)throw Error('缺少新闻结果');
  const now=Date.now(),year=new Date(now+9*3600000).getUTCFullYear();
  return (JSON.parse(state.slice(prefix.length).replace(/;\s*$/,'')).search?.contents||[]).flatMap(x=>{
    const match=x.publishTime?.date?.match(/^(\d{1,2})\/(\d{1,2})/);
    if(!match||!/^https:\/\/news\.yahoo\.co\.jp\/articles\/[a-f0-9]+$/.test(x.permalink)||!x.highlightSearchText?.headline)return [];
    const md=match.slice(1,3).map(s=>s.padStart(2,'0')).join('-'),time=x.publishTime.time?.padStart(5,'0')||'00:00';
    let at=Date.parse(year+'-'+md+'T'+time+':00+09:00');
    if(at>now)at=Date.parse((year-1)+'-'+md+'T'+time+':00+09:00');
    if(!(at>=now-30*86400000&&at<=now))return [];
    const clean=t=>(t||'').replace(/[\u0002\u0003]/g,'').trim();
    return [{title:clean(x.highlightSearchText.headline),content:clean(x.highlightSearchText.body),publishedAt:new Date(at).toISOString(),url:x.permalink,publisher:x.media?.name,syndicator:'Yahoo! JAPAN',image:x.thumbnail?.url,source:'editorial'}];
  });
}

export async function japaneseNews(term,dir){
 if(!dir)return fetchJapanese(term);
 const folder=join(dir,'query-cache'),path=join(folder,createHash('sha256').update(term).digest('hex')+'.json');
 const old=await readFile(path,'utf8').then(JSON.parse).catch(()=>null);
 if(old&&Date.now()-old.checked<15*60000)return old.rows;
 try{
  const rows=await fetchJapanese(term);
  if(rows.length){
   const merged=new Map([...rows,...(old?.rows||[])].filter(r=>Date.parse(r.publishedAt)>=Date.now()-30*86400000).map(r=>[r.url,r]));
   rows.splice(0,rows.length,...Array.from(merged.values()).slice(0,100));await mkdir(folder,{recursive:true});const tmp=path+'.'+randomUUID();await writeFile(tmp,JSON.stringify({rows,checked:Date.now()}));await rename(tmp,path);}
  return rows;
 }catch(e){if(old&&Date.now()-old.checked<86400000)return old.rows;throw e;}
}
