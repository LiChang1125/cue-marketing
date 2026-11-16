import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const origin='https://api.tikhub.io';
const endpoint='/api/v1/douyin/search/fetch_video_search_v2';
// User-approved one-time trial: at most 20 attempts at $0.01 each.
// This budget never resets at midnight or on process/container restart.
export function createDouyinTrial({directory,fetcher=fetch}={}){
  if(!directory)throw Error('试用必须使用持久化额度记录');
  mkdirSync(directory,{recursive:true});
  const db=new DatabaseSync(resolve(directory,'douyin-trial-budget.sqlite'));
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS trial (id INTEGER PRIMARY KEY CHECK(id=1), attempts INTEGER NOT NULL CHECK(attempts>=0)); INSERT OR IGNORE INTO trial VALUES (1,0)');
  const attempts=()=>db.prepare('SELECT attempts FROM trial WHERE id=1').get().attempts;
  async function guardedFetch(url,init){
    const target=new URL(url);
    if(target.origin!==origin||target.pathname!==endpoint||target.search||init?.method!=='POST')throw Error('试用仅允许已审核的抖音搜索接口');
    const pricingUrl=new URL('/api/v1/tikhub/user/get_endpoint_info',origin);
    pricingUrl.searchParams.set('endpoint',endpoint);
    let pricing;
    try{
      const response=await fetcher(pricingUrl,{signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!response.ok)throw Error();
      pricing=(await response.json()).data;
    }catch{throw Error('无法核实当前接口价格，未执行付费搜索');}
    if(pricing?.endpoint_uri!==endpoint||typeof pricing.endpoint_cost!=='number'||pricing.endpoint_cost<0||pricing.endpoint_cost>0.01)throw Error('接口价格超出已审核范围，未执行付费搜索');
    // SQLite's conditional UPDATE is atomic across concurrent test processes.
    const reserved=db.prepare('UPDATE trial SET attempts=attempts+1 WHERE id=1 AND attempts<20').run();
    if(reserved.changes!==1)throw Error('20 次试用额度已用完，累计费用上限为 0.20 美元');
    // Reserve before the network call: uncertain failures also consume a slot.
    return fetcher(target,init);
  }
  return {fetcher:guardedFetch,attempts,close:()=>db.close()};
}
