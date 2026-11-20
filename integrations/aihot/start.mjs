import {spawn} from 'node:child_process';
import {stat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
const cwd=resolve('.tools/aihot-upstream'),snapshot=resolve(process.env.DATA_DIR||'.artifacts/cloud-data','content-data.json');
if(!process.env.DATABASE_URL)throw Error('请配置脉动的 PostgreSQL DATABASE_URL');
const env={...process.env,API_HOST:'127.0.0.1',WEB_HOST:'127.0.0.1',API_PORT:process.env.API_PORT||'4389',WEB_PORT:process.env.WEB_PORT||'4390'};
env.API_BASE_URL='http://127.0.0.1:'+env.API_PORT;
env.SITE_URL=process.env.SITE_URL||'http://127.0.0.1:'+env.WEB_PORT;
const children=new Set();let closing=false;
function child(script,args=[]){const p=spawn(process.execPath,[script,...args],{cwd,env,windowsHide:true,stdio:'inherit'});children.add(p);p.once('exit',()=>children.delete(p));return p;}
function run(script,args=[]){return new Promise((ok,fail)=>{const p=child(script,args);p.once('error',fail);p.once('exit',code=>code===0?ok():fail(Error(script+' 退出 '+code)));});}
await run('scripts/migrate.ts');await run('scripts/seed.ts');
let pending=false,last='';
async function sync(){if(pending||closing)return;pending=true;try{const stamp=(await Promise.all([snapshot,join(dirname(snapshot),'pulse-wire.json'),join(dirname(snapshot),'pulse-publishers.json')].map(p=>stat(p).then(s=>s.mtimeMs).catch(()=>0)))).join(':');if(stamp!==last){await run('scripts/import-cue.ts',[snapshot]);last=stamp;}}catch(e){console.error('同步脉动',e.message);}finally{pending=false;}}
await sync();
const timer=setInterval(sync,60000);
function stop(){closing=true;clearInterval(timer);for(const p of children)p.kill();}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,stop);
for(const entry of ['apps/api/src/main.ts','apps/worker/src/main.ts','apps/web/server.ts']){const p=child(entry);p.on('exit',code=>{if(!closing){process.exitCode=code||1;stop();}});}

