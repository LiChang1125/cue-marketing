import express from 'express';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPreviewFetch} from '../src/preview.js';
import {createPublicWorker} from './public-worker.js';

export async function startPublicServer({dataDir=process.env.DATA_DIR||'.artifacts/cloud-data',port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1',collect=true}={}){
 await mkdir(dataDir,{recursive:true});const path=join(dataDir,'content-data.json');let data;
 try{data=JSON.parse(await readFile(path,'utf8'));}catch{
  const r=await fetch('https://lichang1125.github.io/cue-marketing/content-data.json',{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Initial content unavailable');data=await r.json();if(!data.feed?.items?.length)throw Error('Invalid initial content');await writeFile(path,JSON.stringify(data));
 }
 let handle=createPreviewFetch(data);const worker=createPublicWorker({dataDir,intervalMs:Math.max(60000,Number(process.env.COLLECT_INTERVAL_MS)||600000),onPublish:next=>{data=next;handle=createPreviewFetch(next);}});
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'8kb'}));
 app.get('/api/health',(_,res)=>res.json({ok:true,generatedAt:data.generatedAt,collector:worker.state}));
 app.use('/api',async(req,res)=>{try{const r=await handle(req.originalUrl,{method:req.method,body:req.method==='GET'?undefined:JSON.stringify(req.body)});res.status(r.status).type('json').send(await r.text());}catch{res.status(503).json({error:'内容暂不可用，请稍后重试'});}});
 app.get('/content-data.json',(_,res)=>res.set('Cache-Control','no-store').json(data));
 app.use('/media',express.static(resolve(dataDir,'media')));app.use('/research',express.static(resolve(dataDir,'research')));
 app.use(express.static(resolve('dist'),{setHeaders(res,path){if(path.endsWith('.html'))res.set('Cache-Control','no-cache');}}));
 const server=await new Promise(resolve=>{const s=app.listen(port,host,()=>resolve(s));});if(collect)worker.start();
 return {server,worker,close:()=>{worker.stop();return new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const runtime=await startPublicServer();console.log('CUE public cloud service ready');for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>runtime.close().then(()=>process.exit(0)));}
