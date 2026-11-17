import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,cp} from 'node:fs/promises';
import {join} from 'node:path';

export function command(bin,args,env=process.env){return new Promise((resolve,reject)=>{const p=spawn(bin,args,{env,stdio:'inherit',windowsHide:true});const timer=setTimeout(()=>p.kill('SIGTERM'),22*60000);p.once('error',e=>{clearTimeout(timer);reject(e);});p.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(bin+' exited '+code));});});}
export function createPublicWorker({dataDir,intervalMs=10*60000,run=command,onPublish=()=>{}}){
 let running=false,stopped=false,timer;const state={running:false,lastSuccess:null,lastAttempt:null,lastError:null};
 const active=join(dataDir,'content-data.json'),working=join(dataDir,'next-content-data.json');
 async function refresh(){if(running||stopped)return false;running=true;state.running=true;state.lastAttempt=new Date().toISOString();
  try{await mkdir(dataDir,{recursive:true});const env={...process.env,PUBLIC_DATA_OUTPUT:working,PUBLIC_DATA_PREVIOUS:active,TRENDRADAR_STATE_DIR:join(dataDir,'trendradar-state')};
   await run(process.env.PYTHON||'python',['scripts/run-trendradar-native.py'],env);
   await run(process.execPath,['scripts/refresh-public-data.mjs'],env);
   await run(process.env.PYTHON||'python',['scripts/localize-public-data.py','--input',working],env);
   const data=JSON.parse(await readFile(working,'utf8'));if(!data.feed?.items?.length||!data.generatedAt)throw Error('Empty refresh rejected');
   await cp('.artifacts/public-articles/media',join(dataDir,'media'),{recursive:true,force:true});
   await cp('.artifacts/public-data/trendradar',join(dataDir,'trendradar'),{recursive:true,force:true});
   await rename(working,active);state.lastSuccess=data.generatedAt;state.lastError=null;await onPublish(data);return true;
  }catch(e){state.lastError=e.message;console.error('Public collector:',e.message);return false;}
  finally{running=false;state.running=false;if(!stopped){timer=setTimeout(refresh,intervalMs);timer.unref?.();}}
 }
 return {state,refresh,start(){stopped=false;return refresh();},stop(){stopped=true;clearTimeout(timer);}};
}
