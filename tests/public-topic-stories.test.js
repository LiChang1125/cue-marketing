import test from 'node:test';
import assert from 'node:assert/strict';
import {publicTopicSearch} from '../shared/public-topic-search.js';
import {clusterStories} from '../integrations/hot-monitor/brand-stories.mjs';

test('a new topic retrieves a recent public article even with an empty local index',async t=>{
  const now=new Date(),title='乌龙茶品牌推出春季茶香快闪';
  const seen=[];
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);seen.push(url);
    if(url.hostname==='api.rss2json.com')return Response.json({status:'ok',items:[{link:'https://example.org/campaign',title,description:title,pubDate:now.toISOString().slice(0,19).replace('T',' ')}]});
    return Response.json([]);
  });
  const result=await publicTopicSearch('乌龙茶');
  assert.ok(seen.some(u=>decodeURIComponent(u.searchParams.get('rss_url')||'').includes('乌龙茶')));
  assert.equal(result.results.length,1);
  assert.equal(result.results[0].url,'https://example.org/campaign');
  assert.equal(result.brief.reach.liveCases,1);
});

test('a campaign, a review and a syndicated release have two independent origins and a dated story',()=>{
  const now=Date.now();
  const item=(domain,title,hours)=>{const publishedAt=new Date(now-hours*3600000).toISOString(),url='https://'+domain+'/news';
    return {title,url,publishedAt,parties:['耐克'],reports:[{url,title,publishedAt,publisher:domain}]};};
  const launch=item('one.test','耐克发布「冬日跑步计划」系列新品',12);
  const mirror=item('two.test',launch.title,10);
  const review=item('three.test','到店实测耐克「冬日跑步计划」系列',2);
  assert.equal(clusterStories([launch,mirror],now).length,0);
  assert.equal(clusterStories([launch,item('three.test',review.title,73)],now).length,0);
  const [story]=clusterStories([launch,mirror,review],now);
  assert.equal(story.outlets,2);
  assert.equal(story.trend.length,24);
  assert.equal(story.reports.at(-1).stage,'体验与测评');
  assert.equal(story.lastAt,review.publishedAt);
});

test('a crop release containing a fragrance keyword is distinct from a perfume release',async t=>{
  const date=new Date().toISOString().slice(0,19).replace('T',' ');
  const items=['品牌推出香水百合种花新品','香氛品牌推出旅行香水新品'].map((title,i)=>({title,description:title,link:'https://example.org/launch/'+i,pubDate:date}));
  t.mock.method(globalThis,'fetch',async url=>Response.json(new URL(url).hostname==='api.rss2json.com'?{status:'ok',items}:[]));
  const result=await publicTopicSearch('香水');
  assert.deepEqual(result.results.map(r=>r.title),[items[1].title]);
});

test('search keeps every qualified case and discards excluded issuers and their copies',async t=>{
 const date=new Date().toISOString(),title=i=>'乌龙茶品牌第'+i+'款限定新品首发';
 t.mock.method(globalThis,'fetch',async()=>Response.json([]));
 const index=Array.from({length:18},(_,i)=>({title:title(i),url:'https://tea.example/'+i,publishedAt:date,publisher:'茶饮观察'}));
 index[0].reports=[{title:title(0),url:'https://prtimes.jp/copy'}];
 const rejected=[{...index[1],url:'https://sub.prtimes.jp/1'},{...index[1],url:'https://other.example/2',author:'㍿茶饮'}];
 const result=await publicTopicSearch('乌龙茶',{index:[...index,...rejected]});
 assert.equal(result.results.length,18);
 assert.ok(result.results.every(r=>r.reports.length===1));
});

test('the trend leaderboard needs different campaigns and independent reporting',()=>{
 const now=Date.now(),publishedAt=new Date(now-3600000).toISOString();
 const item=(domain,title)=>{const url='https://'+domain+'/report';return {title,url,publishedAt,parties:[],reports:[{title,url,publishedAt,publisher:domain}]};};
 const one=item('a.example','麦当劳联名迪士尼推出限定套餐'),mirror=item('c.example',one.title);
 assert.deepEqual(clusterStories([one,mirror],now,{trendsOnly:true}),[]);
 const another=item('b.example','瑞幸联名宝可梦推出限定咖啡');
 const trends=clusterStories([one,mirror,another],now,{trendsOnly:true});
 assert.ok(trends.some(r=>r.title==='品牌与 IP 的联名合作'&&r.outlets===2));
 assert.ok(trends.every(r=>r.kind==='专题趋势'&&r.eventCount===r.cases.length&&r.eventCount>=2));
});
