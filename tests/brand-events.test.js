import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newsHits} from '../integrations/hot-monitor/open-news.mjs';
import {eventCards} from '../integrations/hot-monitor/brand-events.mjs';
import {brandScore,headlineParties} from '../integrations/aihot/overlay/apps/web/app/lib/brand-score.ts';
import {qualify,planTopic} from '../integrations/hot-monitor/topic-brief.mjs';
import {buildBrandTools} from '../integrations/hot-monitor/brand-tools.mjs';

test('reporting heat deduplicates repeated links and outlets and decays with age',()=>{
  const now=Date.parse('2026-11-20T04:00:00Z');
  const row={title:'云雀携手月光推出限定茶具系列',publisher:'甲刊',publishedAt:new Date(now-3*86400000).toISOString(),url:'https://media.example/a'};
  const [event]=eventCards([row,{...row,url:row.url+'?utm_source=reader'},{...row,url:row.url+'/b'},{...row,url:'https://other.example/a',publisher:'乙刊'}],now);
  assert.equal(event.outlets,2);assert.equal(event.reports.length,3);assert.equal(event.heat,1);
  assert.deepEqual(event.parties,['云雀','月光']);assert.equal(eventCards([{...row,publishedAt:'2000-01-01'}],now).length,0);
});
test('brand tools use the event dates and comparative reporting windows',()=>{
  const now=Date.parse('2026-12-19T08:00:00Z');
  const card={title:'乐高推出冬季快闪店',url:'https://journal.example/winter',publisher:'行业刊物',publishedAt:'2026-12-18T06:00:00Z',content:'12 月 24 日至 1 月 3 日举办冬季快闪，会员到店可领取限量海报。'};
  const {ranking,calendar}=buildBrandTools([card,{...card,title:'乐高发布冬日系列',publishedAt:'2026-12-10T06:00:00Z',url:'https://journal.example/set',content:'周末将举办活动。'}],now);
  assert.deepEqual([ranking[0].current,ranking[0].previous],[1,1]);
  assert.deepEqual(calendar.map(c=>[c.start,c.end]),[['2026-12-24','2027-01-03']]);
});
test('news search dates use the result page date for relative dates and retain publisher links',()=>{
  const stamp=Date.parse('2026-11-19T10:00:00Z');
  const html='<body data-time="'+stamp/1000+'"><li class="res-list" data-url="https://journal.example/story"><h3>品牌新品发售</h3><cite>报道媒体</cite><span class="time">1天前</span></li></body>';
  const [hit]=newsHits(html,stamp+86400000);
  assert.equal(hit.publishedAt,'2026-11-18T10:00:00.000Z');assert.equal(hit.publisher,'报道媒体');
});
test('a streetwear collaboration alone is not evidence for cosplay',()=>{
  const row={title:'两家品牌联名推出街头服饰',source:'editorial',url:'https://news.example/item',publishedAt:new Date().toISOString()};
  assert.equal(qualify(row,'cosplay',planTopic('cosplay')),null);
  assert.ok(qualify({...row,content:'在 cosplay 漫展首发限定服饰'},'cosplay',planTopic('cosplay')));
  assert.deepEqual(headlineParties('蔡依林成为 DIESEL 香氛品牌代言人'),['蔡依林','DIESEL 香氛']);
  assert.ok(brandScore('服饰品牌携手漫画家首发限定系列')>brandScore('干货教程 品牌策划入门知识'));
});
