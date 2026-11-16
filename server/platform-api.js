// Cloud-only transport. API keys never enter a browser bundle or API response.
// Contracts: https://docs.tikhub.io/420136398e0 and /370212780e0.
import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';

export function metricNumber(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
  if(typeof value!=='string')return null;
  const match=value.trim().replace(/,/g,'').match(/^(\d+(?:\.\d+)?)\s*(万|亿|[kKmMwW])?$/);
  if(!match)return null;
  return Math.round(Number(match[1])*({万:1e4,亿:1e8,k:1e3,K:1e3,m:1e6,M:1e6,w:1e4,W:1e4}[match[2]]||1));
}
export const cloudPlatforms=['xiaohongshu','douyin'];
export function platformMode(env=process.env){return env.PLATFORM_PROVIDER||(env.NODE_ENV==='production'?'disabled':'browser');}
// An explicit Douyin override never changes the other four collectors.
export function platformProvider(id,env=process.env){return id==='douyin'&&env.DOUYIN_PROVIDER?env.DOUYIN_PROVIDER:platformMode(env);}
export function platformEnabled(id,env=process.env){const mode=platformProvider(id,env);return mode==='browser'||mode==='selfhosted'||mode==='public'&&['weibo','zhihu'].includes(id)||mode==='tikhub'&&cloudPlatforms.includes(id)&&!!env.TIKHUB_API_KEY||mode==='tikhub-trial'&&id==='douyin'&&!!env.TIKHUB_API_KEY;}

export function platformRows(payload,source){
  const data=payload?.data;
  if(!data||typeof data!=='object')throw Error('平台接口没有返回数据，保留上一版结果');
  if(source==='douyin'){
    const rows=data.business_data??data.data?.business_data;
    if(!Array.isArray(rows))throw Error('抖音接口结构变化，需要检查适配器');
    return rows.flatMap(entry=>{
      const video=entry.data?.aweme_info??entry.aweme_info;
      if(!video?.aweme_id||video.status?.is_delete||video.status?.is_private)return [];
      const stats=video.statistics||{};
      // Search responses can supply a zero placeholder for unavailable views,
      // even when likes/comments are positive. Do not display that as zero reach.
      const plays=metricNumber(stats.play_count)===0&&[stats.digg_count,stats.comment_count,stats.share_count,stats.collect_count].some(v=>metricNumber(v)>0)?null:stats.play_count;
      return [{id:String(video.aweme_id),title:video.desc,url:`https://www.douyin.com/video/${video.aweme_id}`,contentType:'video',author:video.author?.nickname,
        image:video.video?.origin_cover?.url_list?.[0]||video.video?.cover?.url_list?.[0],pubdate_ts:video.create_time,
        likes:stats.digg_count,comments:stats.comment_count,shares:stats.share_count,saves:stats.collect_count,plays}];
    });
  }
  const rows=data.items??data.notes??data.data?.items??data.data?.notes;
  if(!Array.isArray(rows))throw Error('小红书接口结构变化，需要检查适配器');
  return rows.flatMap(entry=>{
    const card=entry.note_card??entry.note??entry;
    const id=card.note_id??card.id??entry.id;
    if(!id||!(/^[a-zA-Z0-9]+$/).test(String(id)))return [];
    const url=new URL(`https://www.xiaohongshu.com/explore/${id}`);
    const token=entry.xsec_token??card.xsec_token;if(token)url.searchParams.set('xsec_token',token);
    const counts=card.interact_info??card;
    return [{id:String(id),title:card.display_title??card.title,url:url.href,contentType:'note',author:card.user?.nickname,
      image:card.cover?.url_default??card.cover?.url??card.images_list?.[0]?.url??card.image_list?.[0]?.url_default,
      pubdate_ts:typeof card.time==='number'?card.time:card.create_time,
      likes:counts.liked_count??counts.likes,comments:counts.comment_count??counts.comments,saves:counts.collected_count??counts.collects,shares:counts.share_count}];
  });
}

export function createPlatformClient({env=process.env,fetcher=fetch,now=Date.now,directory}={}){
  let ledger={day:'',count:0};
  const file=directory?resolve(directory,'platform-budget.json'):null;
  let ledgerError=false;
  if(file){mkdirSync(directory,{recursive:true});try{ledger=JSON.parse(readFileSync(file,'utf8'));if(typeof ledger.day!=='string'||!Number.isSafeInteger(ledger.count)||ledger.count<0)ledgerError=true;}catch(error){if(error.code!=='ENOENT')ledgerError=true;}}
  const jobs=new Map(),cache=new Map();
  const configured=Number(env.PLATFORM_DAILY_REQUEST_LIMIT??300);
  const limit=Number.isSafeInteger(configured)&&configured>=0?configured:0;
  function reserve(){
    if(ledgerError)throw Error('平台接口额度记录不可用，请管理员检查后恢复');
    const day=new Date(now()+8*3600000).toISOString().slice(0,10);
    if(ledger.day!==day)ledger={day,count:0};
    if(ledger.count>=limit)throw Error('今日平台接口请求额度已用完，保留已有内容');
    ledger.count++;
    if(file){writeFileSync(file+'.tmp',JSON.stringify(ledger));renameSync(file+'.tmp',file);}
  }
  async function search(source,query){
    if(!cloudPlatforms.includes(source))throw Error('此平台尚未配置云端接口');
    if(!env.TIKHUB_API_KEY)throw Error('云端平台接口尚未配置');
    const key=source+':'+query,hit=cache.get(key);
    if(hit&&now()-hit.at<15*60000)return hit.value;
    if(jobs.has(key))return jobs.get(key);
    const job=(async()=>{
      reserve();
      const url=new URL('https://api.tikhub.io'+(source==='xiaohongshu'?'/api/v1/xiaohongshu/app_v2/search_notes':'/api/v1/douyin/search/fetch_video_search_v2'));
      const init={headers:{Authorization:`Bearer ${env.TIKHUB_API_KEY}`},signal:AbortSignal.timeout(30000),redirect:'error'};
      if(source==='xiaohongshu')url.search=new URLSearchParams({keyword:query,page:'1',sort_type:'general',time_filter:'一周内',note_type:'不限',ai_mode:'0'});
      else{init.method='POST';init.headers['Content-Type']='application/json';init.body=JSON.stringify({keyword:query,cursor:0,sort_type:'0',publish_time:'7',filter_duration:'0',content_type:'1',search_id:'',backtrace:''});}
      let response;
      try{response=await fetcher(url,init);}catch{throw Error('云端平台接口连接失败，稍后重试');}
      if(!response.ok)throw Error([401,403].includes(response.status)?'平台接口密钥或权限不可用':response.status===429?'平台接口限流，稍后重试':`平台接口暂不可用（${response.status}）`);
      let payload;try{payload=await response.json();}catch{throw Error('平台接口返回格式错误');}
      if(Number(payload.code)!==200)throw Error('平台接口未成功返回数据，请检查账号额度及权限');
      const observedAt=new Date(now()).toISOString();
      const value=platformRows(payload,source).map(row=>({...row,observedAt,publicationVerified:!!row.pubdate_ts}));cache.set(key,{at:now(),value});
      for(const [k,v] of cache)if(now()-v.at>15*60000)cache.delete(k);
      return value;
    })().finally(()=>jobs.delete(key));
    jobs.set(key,job);return job;
  }
  return {search};
}
