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
  const [story]=clusterStories([launch,mirror,review],now);
  assert.equal(story.outlets,2);
  assert.equal(story.trend.length,24);
  assert.equal(story.reports.at(-1).stage,'体验与测评');
  assert.equal(story.lastAt,review.publishedAt);
});
