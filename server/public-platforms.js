// Public, unauthenticated endpoints. Hot lists are discovery, not keyword search.
import {metricNumber} from './platform-api.js';
export const publicPlatforms=['weibo','zhihu'];
export const publicEndpoints={weibo:'https://weibo.com/ajax/side/hotSearch',zhihu:'https://api.zhihu.com/topstory/hot-lists/total?limit=50&reverse_order=0'};
export function publicRows(payload,source){
  if(source==='weibo'){
    if(payload?.ok!==1||!Array.isArray(payload.data?.realtime))throw Error('微博未返回有效热榜');
    return payload.data.realtime.filter(row=>!row.is_ad&&row.word).map((row,index)=>({
      id:'hot-'+row.word,title:row.word,url:'https://s.weibo.com/weibo?q='+encodeURIComponent(row.word_scheme||row.word),contentType:'hot-topic',rank:index+1,hot_value:row.num,
      author:'微博热搜',retrievalKind:'hotlist'
    }));
  }
  if(!Array.isArray(payload?.data))throw Error('知乎未返回有效热榜');
  return payload.data.flatMap((row,index)=>{
    const target=row.target;
    // JSON numbers cannot safely represent Zhihu's 19 digit question IDs.
    const id=target?.url?.match(/\/questions?\/(\d+)/)?.[1]||row.card_id?.match(/^Q_(\d+)$/)?.[1];
    if(!id||!target.title)return [];
    return [{title:target.title,url:`https://www.zhihu.com/question/${id}`,author:target.author?.name||'知乎热榜',contentType:'question',rank:index+1,
      image:row.children?.find(c=>c.thumbnail)?.thumbnail,excerpt:target.excerpt,pubdate_ts:target.created,
      comments:metricNumber(target.comment_count),answers:metricNumber(target.answer_count),followers:metricNumber(target.follower_count),hot_value:row.detail_text,retrievalKind:'hotlist'}];
  });
}
export function createPublicClient({fetcher=fetch,now=Date.now}={}){
  const cache=new Map(),jobs=new Map();
  return {async read(source){
    if(!publicPlatforms.includes(source))throw Error('该平台没有免登录热榜接入');
    const hit=cache.get(source);if(hit&&now()-hit.at<5*60000)return hit.rows;
    if(jobs.has(source))return jobs.get(source);
    const job=(async()=>{
      let response;try{response=await fetcher(publicEndpoints[source],{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',Referer:new URL(publicEndpoints[source]).origin}});}catch{throw Error('公开热榜连接失败');}
      if(!response.ok)throw Error(`公开热榜暂不可用（${response.status}）`);
      let payload;try{payload=await response.json();}catch{throw Error('公开热榜要求验证，已停止读取');}
      const observedAt=new Date(now()).toISOString();
      const rows=publicRows(payload,source).map(row=>({...row,observedAt,publicationVerified:!!row.pubdate_ts}));
      if(!rows.length)throw Error('公开热榜未返回有效内容');
      cache.set(source,{at:now(),rows});return rows;
    })().finally(()=>jobs.delete(source));
    jobs.set(source,job);return job;
  }};
}
