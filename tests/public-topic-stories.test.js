import test from 'node:test';
import assert from 'node:assert/strict';
import {publicTopicSearch,describeTopic,descriptionMatches} from '../shared/public-topic-search.js';
import {planTopic,qualify} from '../integrations/hot-monitor/topic-brief.mjs';
import {clusterStories} from '../integrations/hot-monitor/brand-stories.mjs';
import {load} from 'cheerio';
import {communityNote,socialCase,issuerRelease} from '../scripts/public-case-sources.mjs';

test('an indexed seed finds a different publisher by product and merges that evidence without accepting unrelated launches',async t=>{
 const now=new Date().toISOString(),calls=[];
 const seed={title:'山海推出「雾岭」香水',content:'这款香水在微博售罄。',url:'https://consumer.example/launch',publishedAt:now,publisher:'消费观察',brands:['山海']};
 const date=now.slice(0,10)+' 00:00:00';
 t.mock.method(globalThis,'fetch',async input=>{
   const url=new URL(input);
   if(url.hostname==='search-api-web.eastmoney.com'){
     const p=JSON.parse(url.searchParams.get('param'));calls.push(p.keyword);
     const rows=p.keyword==='山海'?['山海公布「雾岭」香水追加发售计划','山海咖啡新店开业'].map((title,i)=>({url:'https://wire.example/'+i,title,content:title,date,mediaName:'市场报道'})):[];
     return new Response('cue('+JSON.stringify({code:0,result:{cmsArticleWebOld:rows}})+')');
   }
   return Response.json([]);
 });
 const result=await publicTopicSearch('微博热卖香水',{index:[seed,{...seed,title:'拾光香水在微博推出限定款',content:'品牌首发新品。',url:'https://consumer.example/different',brands:['拾光']}]});
 assert.ok(calls.includes('山海'));assert.equal(result.results.length,1);
 assert.deepEqual(new Set(result.results[0].reports.map(r=>r.url)),new Set([seed.url,'https://wire.example/0']));
 assert.deepEqual(result.relatedArticles.map(r=>r.title),['拾光香水在微博推出限定款']);
 assert.equal(descriptionMatches(describeTopic('香水联名'),{title:'户外品牌联名推出跑鞋'}),false);
});

test('public notes, media citations and issuer statements preserve their distinct authors and dates',()=>{
 const note=communityNote(load('<script type="application/ld+json">'+JSON.stringify({'@type':'Article',url:'https://post.smzdm.com/talk/p/demo/',headline:'露营品牌睡袋实测',datePublished:'2026-11-20T10:00:00+08:00',author:{name:'户外作者'},interactionStatistic:[{interactionType:'https://schema.org/LikeAction',userInteractionCount:22}]})+'</script>'));
 assert.equal(note.role,'creator');assert.equal(note.metricDisplay,'赞 22');assert.equal(note.publisher,'户外作者');
 const url='https://www.xiaohongshu.com/explore/'+'a'.repeat(24);
 const campaign=socialCase(load('<title>海风推出联名茶杯｜SocialBeta</title><p>编辑 · 2026-11-20 · <a href="'+url+'">案例原链接</a></p><div class="cont_cam"><div class="content">海风推出联名茶杯。</div></div>'),'https://socialbeta.com/campaign/12345');
 assert.deepEqual(campaign.citation,{platform:'小红书',url});assert.equal(campaign.role,'media');
 assert.equal(issuerRelease(load('<h1>山海推出陶瓷餐具</h1><div class="release-body"><p>山海发布新品</p></div><p>消息来源：山海</p>'),'https://www.prnasia.com/story/1-1.shtml',note.publishedAt).publisher,'山海');
});

test('descriptive searches use public query variants and require platform, category and popularity evidence',async t=>{
 const q='抖音上最近走红的咖啡',pubDate=new Date().toISOString().slice(0,19).replace('T',' ');
 const titles=['山海咖啡在抖音推出限定套装，首批售罄','山海咖啡在小红书推出限定套装，首批售罄','山海香水在抖音推出限定套装，首批售罄','山海咖啡在抖音推出限定套装','抖音发布咖啡爆款算法'];
 const items=titles.map((title,i)=>({title,description:title,pubDate,link:'https://consumer.example/report/'+i}));
 const calls=[];
 t.mock.method(globalThis,'fetch',async input=>{
   const url=new URL(input);
   if(url.hostname==='api.rss2json.com'){
     const term=new URL(url.searchParams.get('rss_url')).searchParams.get('q');calls.push(term);
     if(term==='抖音 咖啡 售罄')return Response.json({status:'ok',items});
   }
   return Response.json([]);
 });
 const {results}=await publicTopicSearch(q);
 assert.ok(calls.includes('抖音 咖啡 售罄'));assert.deepEqual(results.map(r=>r.title),[titles[0]]);
 const native=planTopic(q);
 for(const [i,title] of titles.entries())assert.equal(Boolean(qualify({title,content:title,publishedAt:new Date().toISOString(),source:'editorial',url:items[i].link},q,native)),i===0);
});

test('platform trend evidence can come from a dated report excerpt or original post',()=>{
 const plan=describeTopic('小红书爆款');
 const title='香氛品牌推出秋季限定礼盒';
 assert.ok(descriptionMatches(plan,{title,content:'小紅書相关话题已有十二款新品售罄。'}));
 assert.ok(descriptionMatches(plan,{title,summary:'RedNote 上已有 12 万次浏览。'}));
 assert.ok(descriptionMatches(plan,{title,content:'首批售罄。',url:'https://www.xiaohongshu.com/explore/one'}));
 assert.ok(!descriptionMatches(plan,{title,content:'在小红书上架。抖音首批售罄。'}));
 assert.ok(!descriptionMatches(plan,{title,content:'品牌希望成为小红书热词，力争打造爆款。'}));
 assert.ok(!descriptionMatches(plan,{title,content:'首批售罄。',url:'https://xiaohongshu.com.example.org/post'}));
 const category=describeTopic('最近热卖的陶瓷餐具');
 assert.ok(descriptionMatches(category,{title:'陶瓷餐具限定系列售罄'}));
 assert.ok(!descriptionMatches(category,{title:'联名陶瓷花瓶售罄'}));
});

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
