import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir,stat,unlink,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';

const hosts=new Set(['www.sogou.com','www.so.com','sou.chinanews.com.cn','www.ettoday.net','www.prnewswire.com','www.prnasia.com','prtimes.jp','news.yahoo.co.jp','dict.youdao.com']);
const recent=new Map(),pending=new Map();
const maximum=6*1024*1024;
function nativePage(url,signal,python=false){
 const windows=process.platform==='win32'&&!python;
 const script="import sys,urllib.request as u; r=u.build_opener(type('FixedHost',(u.HTTPRedirectHandler,),{'redirect_request':lambda self,req,fp,code,msg,h,url:None})()).open(u.Request(sys.argv[1],headers={'User-Agent':'CUE-Marketing/1.0'}),timeout=15); b=r.read(6291457); assert len(b)<=6291456; sys.stdout.buffer.write(b)";
 const exe=windows?'curl.exe':process.env.PYTHON||'python3',args=windows?['--silent','--show-error','--fail','--proto','=https','--max-time','15','--max-filesize',String(maximum),'--',url]:['-I','-c',script,url];
 return new Promise((resolve,reject)=>{
   const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','ignore'],signal});
   let bytes=0;const parts=[];
   p.on('error',reject);p.stdout.on('data',part=>{bytes+=part.length;if(bytes>maximum){p.kill();return;}parts.push(part);});
   p.on('close',code=>code===0&&bytes>0&&bytes<=maximum?resolve(Buffer.concat(parts).toString('utf8')):reject(Error('发布方传输失败 '+(code??'超时')+' / '+bytes+' 字节')));
 });
}
async function fetchPage(input){
 const signal=AbortSignal.timeout(45000);
 try{
   let url=input,r;
   for(let i=0;i<4;i++){
     r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10500)]),redirect:'manual',headers:{accept:'text/html,application/json;q=0.9,*/*;q=0.5'}});
     if(![301,302,303,307,308].includes(r.status))break;
     const next=new URL(r.headers.get('location')||'',url);await r.body?.cancel();
     if(next.protocol!=='https:'||!hosts.has(next.hostname)||next.port||next.username||next.password||next.href===url)throw Error('不支持的跳转');
     url=next.href;
   }
   if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
   const blocks=[];let bytes=0;
   for await(const block of r.body){bytes+=block.length;if(bytes>maximum)throw Error('页面过大');blocks.push(block);}
   return Buffer.concat(blocks).toString('utf8');
 }catch(err){if(/HTTP |页面过大/.test(err.message)||signal.aborted)throw err;
   try{return await nativePage(input,signal);}catch(second){
     if(!signal.aborted&&process.platform==='win32')return nativePage(input,signal,true);
     throw second;
   }}
}
const folder=resolve(process.env.DATA_DIR||'.artifacts/hot-monitor-preview','public-search-cache');
let cleanupAt=0;
async function purge(){
 if(cleanupAt>Date.now()-3600000)return;
 cleanupAt=Date.now();
 const files=await readdir(folder);const entries=await Promise.all(files.filter(n=>/^[0-9a-f]{64}\\.html$/.test(n)).map(async n=>({n,t:(await stat(join(folder,n)).catch(()=>({mtimeMs:0}))).mtimeMs})));
 await Promise.all(entries.sort((a,b)=>b.t-a.t).filter((r,i)=>i>=240||r.t<Date.now()-14*86400000).map(r=>unlink(join(folder,r.n)).catch(()=>{})));
}
async function resilientPage(input){
 const u=new URL(input),dict=u.hostname==='dict.youdao.com';
 const durable=dict||u.hostname==='sou.chinanews.com.cn'||u.hostname==='www.ettoday.net'||u.hostname==='www.sogou.com'||u.hostname==='www.so.com'||u.hostname==='www.prnasia.com'||u.hostname==='www.prnewswire.com';
 if(!durable)return fetchPage(input);
 const fp=join(folder,createHash('sha256').update(input).digest('hex')+'.html'),mtime=(await stat(fp).catch(()=>({mtimeMs:0}))).mtimeMs;
 const age=Date.now()-mtime;
 if(age<(dict?86400000:180000)){
   const cached=await readFile(fp,'utf8').catch(()=>null);if(cached)return cached;
 }
 try{
   const page=await fetchPage(input);
   const valid=dict?/^\\s*\\{/.test(page):/newsCards|search-story-wrap|release-body|generalbody|var docArr|class="archive|class="vrwrap|data-mdurl=/.test(page);
   if(valid&&page.length<2200000){
     try{await mkdir(folder,{recursive:true});const temp=fp+'.'+randomUUID()+'.tmp';await writeFile(temp,page);await rename(temp,fp);void purge().catch(()=>{});}catch{}
   }
   return page;
 }catch(e){
   if(age<(dict?14:1)*86400000){const old=await readFile(fp,'utf8').catch(()=>null);if(old)return old;}
   throw e;
 }
}
export async function publicSearchPage(address){
 const u=new URL(address);if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.has(u.hostname))throw Error('未知发布方');
 const input=u.href,old=recent.get(input);if(old&&Date.now()-old.stamp<180000)return old.page;
 if(!pending.has(input)){
   const task=resilientPage(input).then(page=>{if(recent.size>=30)recent.delete(recent.keys().next().value);recent.set(input,{stamp:Date.now(),page});return page;}).finally(()=>pending.delete(input));
   pending.set(input,task);
 }
 return pending.get(input);
}
