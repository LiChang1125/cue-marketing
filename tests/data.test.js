import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { parseBilibili, parseDate, parseSocialBeta, parseBrandstar, classify } from '../server/sources.js';
import { normalizeCli, cliFailure } from '../server/cli.js';
import { openStore } from '../server/store.js';
const now='2026-11-16T06:00:00.000Z';
test('超过一千条收录后，较早主题仍可统计，不被全局列表截断',()=>{
  const directory=mkdtempSync(join(tmpdir(),'cue-cap-')),store=openStore(directory);
  try{store.saveItems([{id:'first',title:'香水新品',metrics:{}}],now);store.saveTopicRun('scent','weibo',[{id:'first'}],now,'ok');
    store.saveItems(Array.from({length:1005},(_,i)=>({id:'other-'+i,title:'品牌新闻 '+i,metrics:{}})),'2026-11-16T07:00:00.000Z');
    assert.equal(store.items().length,1006);assert.ok(store.items().some(i=>i.id===store.topicItems('scent')[0].id));
  }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('品牌资讯按原站自然日收录，正文摘要与营销分类均来自来源',()=>{
  const html='<section class="bs-curated-day"><h2 class="bs-curated-day-head"><span>15</span><span>2026.11 · 周日</span></h2><li><h2><a href="https://www.brandstar.com.cn/select/9804/">品牌推出新品</a></h2><p class="bs-curated-card-summary">品牌正式推出全新产品。</p><div class="bs-curated-card-meta"><strong>原始媒体</strong><span>资讯</span></div></li></section>';
  const [item]=parseBrandstar(html,now);assert.equal(item.publishedAt,'2026-11-14T16:00:00.000Z');assert.equal(item.excerpt,'品牌正式推出全新产品。');assert.ok(item.categories.includes('brand'));assert.throws(()=>parseBrandstar('<html/>',now));
});

test('来源错误与缺失数据不能变成虚构热度',()=>{
  assert.throws(()=>parseBilibili({code:-412},'bilibili',now));
  const [row]=parseBilibili({code:0,data:{list:[{bvid:'BVtest',title:'测试',owner:{name:'测试作者'},stat:{}}]}},'bilibili',now);
  assert.equal(row.metrics.views,null);assert.equal(row.publishedAt,null);
});
test('保留原始发布时间，相对时间按采集时刻解析',()=>{
  assert.equal(parseDate('2小时前',now),'2026-11-16T04:00:00.000Z');
  assert.equal(parseDate('',now,'今天 11月16日'),'2026-11-15T16:00:00.000Z');
  assert.equal(parseDate('未注明',now),null);
  assert.equal(parseDate('', '2026-01-01T06:00:00Z', '12月31日'),'2025-12-30T16:00:00.000Z');
});
test('品牌来源只提取合法原文链接和可验证字段',()=>{
  const html='<div class="hdtitle">11月16日</div><div class="list"><li><div class="tit"><a href="https://socialbeta.com/campaign/12">品牌与原神联名</a></div><div class="date">2小时前</div><div class="tag"><a>IP联名</a></div></li><li><div class="tit"><a href="javascript:alert(1)">错误</a></div></li></div>';
  const items=parseSocialBeta(html,now);assert.equal(items.length,1);assert.equal(items[0].metrics.views,undefined);assert.ok(items[0].categories.includes('ip'));assert.throws(()=>parseSocialBeta('<html/>',now));
});
test('CLI 抖音热点值不当作视频播放量，缺失发布时间不补今天',()=>{
  const [item]=normalizeCli([{name:'原神联名',id:'123',view_count:500}], 'douyin',now);
  assert.equal(item.metrics.views,null);assert.equal(item.publishedAt,null);assert.match(item.rawHeat,/非视频播放量/);assert.ok(item.categories.includes('ip'));
  const [topic]=normalizeCli([{name:'原神',id:'123',view_count:500}],'douyin',now,'原神');assert.equal(topic.metrics.topicViews,500);assert.equal(topic.metrics.views,null);assert.match(topic.rawHeat,/话题累计播放/);
});
test('CLI URL 域名白名单与错误状态',()=>{
  assert.equal(normalizeCli([{title:'伪链接',url:'https://evil.example/a'}],'zhihu',now).length,0);
  assert.throws(()=>normalizeCli({unexpected:1},'zhihu',now));
  assert.match(cliFailure({error:{code:'BROWSER_CONNECT'}}),/扩展/);
  assert.match(cliFailure({error:{code:'verification_required'}}),/人工验证/);
});
test('去重保留历史快照与首次发现时间，重启后可读取',()=>{
  const path=mkdtempSync(join(tmpdir(),'zhichao-test-'));let db=openStore(path);
  const row={id:'test1',title:'test',metrics:{views:10,likes:1}};db.saveItems([row],now);
  const later='2026-11-16T06:05:00.000Z';db.saveItems([{...row,metrics:{views:20,likes:2}}],later);
  assert.equal(db.items().length,1);assert.equal(db.items()[0].firstSeen,now);assert.equal(db.history('test1').length,2);db.close();db=openStore(path);assert.equal(db.items()[0].metrics.views,20);db.close();assert.ok(!relative(resolve(tmpdir()),resolve(path)).startsWith('..'));rmSync(path,{recursive:true});
});
test('主题跟进区分每轮结果和首次新增，不伪造增长',()=>{
  const path=mkdtempSync(join(tmpdir(),'zhichao-topic-test-'));const db=openStore(path);
  db.saveTopic({id:'topic',query:'潮玩',paused:false});
  const items=[{id:'a',title:'潮玩',tags:['潮玩'],categories:['culture'],metrics:{likes:3}}];
  db.saveItems(items,now);assert.equal(db.saveTopicRun('topic','xiaohongshu',items,now,'ok'),1);
  const next='2026-11-16T06:30:00.000Z';db.saveItems([{...items[0],tags:['品牌联名'],metrics:{likes:4}}],next);
  assert.equal(db.saveTopicRun('topic','xiaohongshu',items,next,'ok'),0);
  assert.equal(db.topicItems('topic').length,1);assert.equal(db.topicHistory('topic').length,2);assert.deepEqual(db.items()[0].tags,['潮玩','品牌联名']);assert.equal(db.history('a')[1].likes,4);
  db.close();assert.ok(!relative(resolve(tmpdir()),resolve(path)).startsWith('..'));rmSync(path,{recursive:true});
});

test('微博月日及昨天格式按北京时间解析，标明年份的日期不猜测',()=>{
  assert.equal(parseDate('11月13日 19:28',now),'2026-11-13T11:28:00.000Z');
  assert.equal(parseDate('昨天 09:30',now),'2026-11-15T01:30:00.000Z');
  assert.equal(parseDate('2025年12月01日 08:15',now),'2025-12-01T00:15:00.000Z');
  assert.equal(parseDate('12月31日 08:15','2026-01-02T00:00:00Z'),'2025-12-31T00:15:00.000Z');
});

test('小红书搜索 ID 推算日期不作为已核实发布日期，知乎保留原始创建时间',()=>{
  const [xhs]=normalizeCli([{title:'香水新品',url:'https://www.xiaohongshu.com/explore/123',published_at:'2026-11-15'}],'xiaohongshu',now,'香水');
  assert.equal(xhs.publishedAt,null);
  const [zhihu]=normalizeCli([{title:'香水品牌市场',url:'https://zhuanlan.zhihu.com/p/1',votes:20,pubdate_ts:1794700800}],'zhihu',now,'香水');
  assert.ok(zhihu.publishedAt);assert.equal(zhihu.metrics.likes,20);
});

test('品牌星球原创和外部精选保留原站分类及来源，不漏掉 articles 路径',()=>{
  const html='<section class="bs-curated-day"><div class="bs-curated-day-head">162026.11 · 周一</div><ul><li><h2><a href="https://www.brandstar.com.cn/articles/test-brand/">品牌开设新店</a></h2><div class="bs-curated-card-meta"><span class="bs-curated-origin">资讯</span><strong>品牌星球</strong><span>空间</span></div><p class="bs-curated-card-summary">品牌店铺空间。</p></li></ul></section>';
  const [item]=parseBrandstar(html,now);assert.equal(item.brandstarOriginal,true);assert.equal(item.curatedKind,'spaces');assert.equal(item.publisher,'品牌星球');assert.ok(item.id.startsWith('bs-'));
});
