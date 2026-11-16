import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicClient,publicRows} from '../server/public-platforms.js';
import {platformEnabled} from '../server/platform-api.js';
import {normalizeCli} from '../server/cli.js';
import {scopedItems} from '../server/relevance.js';
test('免费公开榜单不冒充关键词搜索，缺失互动不造零，广告不纳入',()=>{
  const rows=publicRows({ok:1,data:{realtime:[{word:'品牌联名新品',num:1234},{word:'广告',is_ad:1},{word:'外交新闻'}]}},'weibo');
  assert.equal(rows.length,2);assert.equal(rows[0].retrievalKind,'hotlist');
  const items=normalizeCli(rows,'weibo',new Date().toISOString());assert.equal(items[0].metrics.likes,null);assert.equal(items[0].publishedAt,null);assert.equal(items[0].searchQuery,null);assert.equal(scopedItems(items).length,1);
  assert.throws(()=>publicRows({ok:0},'weibo'),/有效热榜/);
  assert.equal(platformEnabled('weibo',{PLATFORM_PROVIDER:'public'}),true);assert.equal(platformEnabled('xiaohongshu',{PLATFORM_PROVIDER:'public'}),false);
  for(const id of ['weibo','zhihu','xiaohongshu','douyin'])assert.equal(platformEnabled(id,{PLATFORM_PROVIDER:'selfhosted'}),true);
});
test('知乎大整数 ID 从原始链接读取，问题关注与回答分别保留',()=>{
  const rows=publicRows({data:[{card_id:'Q_2105588251100700718',target:{id:2105588251100700700,title:'品牌联名如何影响消费？',url:'https://api.zhihu.com/questions/2105588251100700718',created:1794791359,answer_count:12,follower_count:80},detail_text:'23 万热度',children:[{thumbnail:'https://pic1.zhimg.com/a.jpg'}]}]},'zhihu');
  const [item]=normalizeCli(rows,'zhihu',new Date().toISOString());assert.equal(item.url,'https://www.zhihu.com/question/2105588251100700718');assert.equal(item.metrics.answers,12);assert.equal(item.metrics.questionFollowers,80);assert.equal(item.metrics.likes,null);assert.equal(item.rawHeat,'23 万热度');
});
test('公开端点合并并发、缓存使用原始观测时间，验证页不能算成功',async()=>{
  let calls=0,time=1000000;
  const client=createPublicClient({now:()=>time,fetcher:async()=>{calls++;return new Response(JSON.stringify({ok:1,data:{realtime:[{word:'品牌联名'}]}}));}});
  const [a,b]=await Promise.all([client.read('weibo'),client.read('weibo')]);assert.equal(calls,1);assert.deepEqual(a,b);time+=60000;assert.equal((await client.read('weibo'))[0].observedAt,a[0].observedAt);time+=300000;await client.read('weibo');assert.equal(calls,2);
  await assert.rejects(createPublicClient({fetcher:async()=>new Response('<html>login</html>')}).read('weibo'),/要求验证/);
});
