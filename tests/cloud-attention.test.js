import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPlatformClient,metricNumber,platformRows,platformEnabled,platformMode} from '../server/platform-api.js';
import {attentionTrends} from '../server/attention.js';
import {normalizeCli} from '../server/cli.js';
import {meaningfulContent} from '../shared/quality.js';
import {editorialCandidates} from '../server/editorial.js';
const now=Date.parse('2026-11-16T08:00:00Z'),at=new Date(now).toISOString();
const response=()=>new Response(JSON.stringify({code:200,data:{business_data:[{data:{aweme_info:{aweme_id:'123',desc:'品牌推出联名香水系列',create_time:1794787200,author:{nickname:'品牌'},video:{cover:{url_list:['https://example.com/image.jpg']}},statistics:{digg_count:120,comment_count:30}}}}]}}));
test('云端不依赖 Chrome，密钥不足时不回退本地登录，缺失指标不变零',()=>{
  assert.equal(platformMode({NODE_ENV:'production'}),'disabled');
  assert.equal(platformEnabled('douyin',{PLATFORM_PROVIDER:'tikhub'}),false);
  assert.equal(platformEnabled('weibo',{PLATFORM_PROVIDER:'tikhub',TIKHUB_API_KEY:'key'}),false);
  assert.equal(metricNumber('1.2万'),12000);assert.equal(metricNumber('未知'),null);assert.equal(metricNumber(''),null);
  const data={code:200,data:{business_data:[{data:{aweme_info:{aweme_id:'123',desc:'品牌联名新品',statistics:{digg_count:0}}}}]}};
  const [item]=normalizeCli(platformRows(data,'douyin'),'douyin',at,'品牌');
  assert.equal(item.url,'https://www.douyin.com/video/123');assert.equal(item.metrics.likes,0);assert.equal(item.metrics.comments,null);assert.equal(item.metrics.views,null);assert.equal(item.metrics.topicViews,null);
  assert.throws(()=>platformRows({data:{}},'xiaohongshu'),/结构变化/);
});
test('云端请求合并及缓存不重复计费，重启保留每日额度，错误不泄露密钥',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'cue-platform-'));let calls=0,time=now;
  const env={TIKHUB_API_KEY:'secret-never-display',PLATFORM_DAILY_REQUEST_LIMIT:'1'};
  const fetcher=async(url,init)=>{calls++;assert.equal(url.hostname,'api.tikhub.io');assert.equal(init.redirect,'error');return response();};
  try{
    const client=createPlatformClient({env,directory,fetcher,now:()=>time});
    const [a,b]=await Promise.all([client.search('douyin','香水'),client.search('douyin','香水')]);assert.deepEqual(a,b);assert.equal(calls,1);
    time+=60000;assert.equal((await client.search('douyin','香水'))[0].observedAt,at);assert.equal(calls,1);
    await assert.rejects(createPlatformClient({env,directory,fetcher,now:()=>time}).search('douyin','潮玩'),/额度/);
    await assert.rejects(createPlatformClient({env,fetcher:async()=>new Response('secret-never-display',{status:401})}).search('douyin','香水'),e=>!e.message.includes(env.TIKHUB_API_KEY)&&/权限/.test(e.message));
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('固定内容样本画互动趋势，新加入的文章不能制造热度上涨',()=>{
  const item=(id,source='xiaohongshu')=>({id,title:'香水品牌发布联名新品',source,metrics:{likes:20}});
  const before=new Date(now-3600000).toISOString(),middle=new Date(now-1800000).toISOString();
  const history={a:[{at:before,likes:10},{at:middle,likes:15},{at,likes:20}],b:[{at:before,likes:20},{at,likes:25}],c:[{at:before,likes:30},{at,likes:40}],new:[{at,likes:100000}]};
  const d=attentionTrends(['a','b','c','new'].map(id=>item(id)),id=>history[id],{query:'香水',now});
  const s=d.platforms[0].series[0];assert.equal(s.sampleSize,3);assert.equal(s.value,85);assert.equal(s.delta,25);assert.equal(s.points.length,2);
  const once=attentionTrends([item('new')],id=>history[id],{query:'香水',now}).platforms[0].series[0];assert.equal(once.points.length,1);assert.equal(once.delta,null);
  const absent=attentionTrends([item('x')],()=>[],{now});assert.deepEqual(absent.platforms,[]);
});

test('抖音搜索有正互动却返回零播放时，不将占位值展示为真实播放量',()=>{
  const payload={data:{business_data:[{data:{aweme_info:{aweme_id:'123',desc:'香水品牌联名',statistics:{digg_count:400,comment_count:20,play_count:0}}}}]}};
  const rows=platformRows(payload,'douyin');assert.equal(rows[0].plays,null);
  const items=normalizeCli(rows,'douyin',at,'香水');
  const result=attentionTrends(items,()=>[{at,likes:400,comments:20,views:0}],{query:'香水',now});
  assert.equal(result.platforms[0].series.some(s=>s.metric==='views'),false);
  assert.equal(result.platforms[0].series.find(s=>s.metric==='likes').value,400);
  payload.data.business_data[0].data.aweme_info.statistics.play_count=1200;
  assert.equal(platformRows(payload,'douyin')[0].plays,1200);
});
test('话题累计播放不混入视频互动，不汇总重叠话题；失效数据标记未更新',()=>{
  const items=[{id:'exact',title:'香水',source:'douyin',contentType:'topic',metrics:{topicViews:900}},{id:'other',title:'香水新品',source:'douyin',metrics:{topicViews:100}}];
  const d=attentionTrends(items,()=>[{at,topicViews:900}],{query:'香水',now,sources:[{id:'douyin',state:'error'}]});
  assert.equal(d.platforms[0].series.length,1);assert.equal(d.platforms[0].series[0].value,900);assert.equal(d.platforms[0].series[0].stale,true);
});
test('有封面的未标日期平台线索可以阅读，但旧新闻和杂乱饭圈标题仍被排除',()=>{
  const item={id:'x',title:'Le Labo 推出城市限定香水系列',source:'xiaohongshu',imageLocal:'/media/x.jpg',fetchedAt:at,metrics:{likes:20}};
  assert.equal(editorialCandidates([item],now).length,1);
  assert.equal(editorialCandidates([{...item,publishedAt:'2020-01-01'}],now).length,0);
  assert.equal(meaningfulContent({title:'#品牌 #代言 #冲榜 #应援 #爱你'}),false);
  assert.equal(meaningfulContent({title:'品牌大使广告',creator:'粉丝后援会'}),false);
  assert.equal(meaningfulContent({title:'品牌邀请运动员共创公益运动系列'}),true);
});
