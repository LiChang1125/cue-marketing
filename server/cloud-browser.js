import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createSourcePageRouter} from './source-pages.js';
let context=null,starting=null,sourcePages=null;
export async function ensureCloudBrowser(env=process.env){
  if(context)return 'http://127.0.0.1:9222';
  if(starting)return starting;
  starting=(async()=>{
    const {chromium}=await import('playwright');
    const profile=resolve(env.DATA_DIR||'data','browser-profile');mkdirSync(profile,{recursive:true});
    context=await chromium.launchPersistentContext(profile,{
      headless:env.CLOUD_BROWSER_HEADLESS!=='false',
      ...(env.CLOUD_BROWSER_CHANNEL?{channel:env.CLOUD_BROWSER_CHANNEL}:{}),
      ...(env.CLOUD_BROWSER_EXECUTABLE?{executablePath:env.CLOUD_BROWSER_EXECUTABLE}:{}),
      viewport:{width:1440,height:1000},timeout:30000,
      args:['--remote-debugging-port=9222','--remote-debugging-address=127.0.0.1','--disable-dev-shm-usage']
    });
    sourcePages=createSourcePageRouter(context);
    context.on('close',()=>{context=null;sourcePages=null;});
    if(!context.pages().length)await context.newPage();
    return 'http://127.0.0.1:9222';
  })().catch(error=>{
    console.error('云端浏览器启动失败：',error.message);
    throw Error('云端浏览器暂不可用，请管理员检查运行环境');
  }).finally(()=>{starting=null;});
  return starting;
}
export async function closeCloudBrowser(){await context?.close();context=null;}
export async function cloudEndpointForSource(id){await ensureCloudBrowser();return sourcePages.endpointFor(id);}
