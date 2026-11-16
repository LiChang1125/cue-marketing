import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {createPlatformClient} from '../server/platform-api.js';
import {createDouyinTrial} from '../server/douyin-trial.js';
import {normalizeCli} from '../server/cli.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=process.env.DATA_DIR||resolve(root,'data');
const key=process.env.TIKHUB_API_KEY?.trim();
const mode=process.argv[2];
if(!key){console.error('未配置 TikHub Key；未调用账户或付费搜索接口');process.exit(1);}
if(!['--account','--search'].includes(mode)){console.error('使用 --account 查询额度，或 --search [主题] 执行已审核的限额试用');process.exit(1);}

let trial;
try{
  if(mode==='--account'){
    const response=await fetch('https://api.tikhub.io/api/v1/tikhub/user/get_user_info',{headers:{Authorization:`Bearer ${key}`},redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error(`账户查询失败（${response.status}）`);
    const payload=await response.json();
    if(Number(payload.code)!==200||!payload.user_data)throw Error('账户信息格式不符合预期');
    const u=payload.user_data;
    // Never print email, key metadata or the unrestricted provider response.
    console.log(JSON.stringify({paidBalance:u.balance,freeCredit:u.free_credit,active:u.is_active,disabled:u.account_disabled,emailVerified:u.email_verified}));
  }else{
    const query=process.argv[3]||'品牌联名';
    if(query.length>40)throw Error('主题最多 40 个字符');
    trial=createDouyinTrial({directory});
    const client=createPlatformClient({env:{TIKHUB_API_KEY:key,PLATFORM_DAILY_REQUEST_LIMIT:'20'},directory:resolve(directory,'douyin-trial-client'),fetcher:trial.fetcher});
    const items=normalizeCli(await client.search('douyin',query),'douyin',new Date().toISOString(),query);
    writeFileSync(resolve(directory,'douyin-trial-latest.json'),JSON.stringify({query,items},null,2),{mode:0o600});
    console.log(JSON.stringify({query,results:items.length,withCovers:items.filter(i=>i.image).length,withLikes:items.filter(i=>i.metrics.likes!==null).length,withComments:items.filter(i=>i.metrics.comments!==null).length,attemptsUsed:trial.attempts(),attemptLimit:20,maximumTotalUSD:0.20,examples:items.slice(0,3).map(i=>({title:i.title,url:i.url,publishedAt:i.publishedAt}))}));
    if(!items.length)process.exitCode=1;
  }
}catch(error){
  // Fixed application messages only; fetch/provider errors can include secrets.
  const safe=/^(账户|主题|试用|未配置|云端平台|平台接口|今日平台)/.test(error.message)?error.message:'试用检查未完成，请检查连接、账户及额度记录';
  console.error(safe.replaceAll(key,'[redacted]'));process.exitCode=1;
}finally{trial?.close();}
