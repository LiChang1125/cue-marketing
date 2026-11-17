import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {publicationDate} from '../server/media-metadata.js';
import {load} from 'cheerio';

// Public research abstracts exposed by the publisher's own unauthenticated site.
// No member-only PDFs, account cookies or paid data are requested.
const items=[],health=[];const now=Date.now(),cutoff=now-180*86400000;
for(let page=1;page<=5;page++){
 try{const r=await fetch('https://www.iimedia.cn/api/v4/imw/getArticleInfoByPage',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({cid:'400',pageNum:String(page),pageSize:'40'}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.code!==200||!Array.isArray(data.data?.rows))throw Error('Unexpected publisher response');
  for(const row of data.data.rows){const publishedAt=publicationDate(row.publishTime),url=new URL(row.url,'https://www.iimedia.cn/');if(url.hostname!=='www.iimedia.cn'||!publishedAt||Date.parse(publishedAt)>now||Date.parse(publishedAt)<cutoff)continue;items.push({id:'research-iimedia-'+row.articleId,title:row.title,url:url.href,publishedAt,excerpt:row.summary?.slice(0,380)||'',tags:row.keywords||[],image:row.image,source:'research-iimedia',publisher:'艾媒咨询',sourceName:'艾媒咨询',engine:'TrendRadar',origin:'publisher-report',contentType:'research-report'});}
  health.push({id:'iimedia-'+page,name:'艾媒咨询',state:'ok',count:data.data.rows.length});
  if(!data.data.rows.length||data.data.rows.every(i=>Date.parse(publicationDate(i.publishTime))<cutoff))break;
 }catch(e){health.push({id:'iimedia-'+page,state:'unavailable',message:e.message});break;}
}
// CBNData embeds the same public article metadata used by its frontend as JSON.
try{const r=await fetch('https://www.cbndata.com/information',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const html=await r.text(),$=load(html);const code=$('script').map((_,e)=>$(e).text()).get().find(s=>s.startsWith('window.__INITIAL_STATE__='));const state=JSON.parse(code.slice('window.__INITIAL_STATE__='.length).replace(/;\s*$/,''));
 const walk=x=>{if(!x||typeof x!=='object')return;if(x.id&&x.title&&x.date&&x.summary){const publishedAt=publicationDate(x.date);if(publishedAt&&Date.parse(publishedAt)>=cutoff&&Date.parse(publishedAt)<=now)items.push({id:'research-cbn-'+x.id,title:x.title,url:'https://www.cbndata.com/information/'+x.id,publishedAt,excerpt:x.summary.slice(0,380),image:x.thumbnail_url,source:'research-cbn',publisher:'CBNData',sourceName:'CBNData',engine:'TrendRadar',origin:'publisher-report',contentType:'article'});}for(const child of Object.values(x))if(typeof child==='object')Array.isArray(child)?child.forEach(walk):walk(child);};walk(state);health.push({id:'cbndata',state:'ok'});
}catch(e){health.push({id:'cbndata',state:'unavailable',message:e.message});}
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/research-current.json',JSON.stringify({items,health}));console.log(JSON.stringify({researchArticles:items.length,health}));
