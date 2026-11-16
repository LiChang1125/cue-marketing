import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
let context=null,starting=null;
export async function ensureCloudBrowser(env=process.env){
  if(context)return 'http://127.0.0.1:9222';
  if(starting)return starting;
  starting=(async()=>{
    const {chromium}=await import('playwright');
    const profile=resolve(env.DATA_DIR||'data','browser-profile');mkdirSync(profile,{recursive:true});
    context=await chromium.launchPersistentContext(profile,{
      headless:env.CLOUD_BROWSER_HEADLESS!=='false',
      ...(env.CLOUD_BROWSER_CHANNEL?{channel:env.CLOUD_BROWSER_CHANNEL}:{}),
      viewport:{width:1440,height:1000},timeout:30000,
      args:['--remote-debugging-port=9222','--remote-debugging-address=127.0.0.1','--disable-dev-shm-usage']
    });
    context.on('close',()=>{context=null;});
    if(!context.pages().length)await context.newPage();
    return 'http://127.0.0.1:9222';
  })().finally(()=>{starting=null;});
  return starting;
}
export async function closeCloudBrowser(){await context?.close();context=null;}
