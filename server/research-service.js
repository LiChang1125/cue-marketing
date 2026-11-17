import {createHash} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {searchResearch} from '../shared/research.js';
import {command} from './public-worker.js';

export function createResearchService({dataDir,getData,run=command}){
 const inflight=new Map(),cache=new Map();
 return async(query,days=90)=>{
  query=String(query||'').trim();if(!query||query.length>40)throw Error('主题请输入 1—40 个字');
  if(![30,90,180].includes(days))days=90;
  const data=getData(),key=createHash('sha256').update(JSON.stringify([query,days,data.generatedAt])).digest('hex').slice(0,24);
  if(cache.has(key))return cache.get(key);if(inflight.has(key))return inflight.get(key);
  if(inflight.size>=4)throw Error('报告生成繁忙，请稍后重试');
  const task=(async()=>{const result={...searchResearch(data.feed.publicPulse?.researchItems||[],{query,days}),key};if(!result.articles.length)return result;
   const input=join(dataDir,'research-input-'+key+'.json');await mkdir(dataDir,{recursive:true});await writeFile(input,JSON.stringify([result]));
   try{await run(process.env.PYTHON||'python',['scripts/render-research.py','--input',input,'--output',join(dataDir,'research')]);result.reportUrl='research/'+key+'.html';}
   finally{await rm(input,{force:true});}
   cache.set(key,result);if(cache.size>64)cache.delete(cache.keys().next().value);return result;
  })().finally(()=>inflight.delete(key));inflight.set(key,task);return task;
 };
}
