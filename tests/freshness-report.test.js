import test from 'node:test';
import assert from 'node:assert/strict';
import {freshness} from '../src/freshness.js';
import {reportSchedule,selectReportItems,buildReport,yesterdayWindow,extractReportExcerpt,marketingSection} from '../server/reports.js';
const now=new Date('2026-11-16T00:00:00Z');
const source={id:'socialbeta',state:'ok',name:'品牌快讯',lastSuccess:now.toISOString()};
const item={id:'one',title:'品牌联名推出新品',categories:['brand'],tags:['IP联名'],source:'socialbeta',url:'https://socialbeta.com/campaign/1',publishedAt:'2026-11-15T10:00:00Z',fetchedAt:now.toISOString()};
test('来源失败、过期和未来时间不能显示为实时；平台按各自周期判定',()=>{
  assert.equal(freshness('2026-11-15T23:55:00Z',source,+now),'fresh');
  assert.equal(freshness('2026-11-15T23:53:00Z',source,+now),'stale');
  assert.equal(freshness('2026-11-15T23:53:00Z',{...source,setup:'login'},+now),'fresh');
  assert.equal(freshness(item.fetchedAt,{...source,state:'error'},+now),'unavailable');
  assert.equal(freshness('2026-11-17T00:00:00Z',source,+now),'unknown');
  assert.equal(freshness(null,source,+now),'unknown');
});
test('日报每天北京时间八点到期，跨 UTC 日期仍按上海日期排程',()=>{
  assert.equal(reportSchedule(new Date('2026-11-15T23:59:59Z')).ready,false);
  assert.equal(reportSchedule(now).ready,true);
  assert.equal(reportSchedule(now).day,'2026-11-16');
  assert.equal(reportSchedule(now).next,'2026-11-17T00:00:00.000Z');
  assert.equal(reportSchedule(new Date('2026-11-16T18:00:00Z')).day,'2026-11-17');
});
test('日报排除旧闻、未来消息、日期缺失、来源故障和重复内容',()=>{
  const invalid=[{...item,id:'old',publishedAt:'2026-11-14T00:00:00Z'},{...item,id:'missing',publishedAt:null},{...item,id:'future',publishedAt:'2026-11-17T00:00:00Z'},{...item,id:'stale',fetchedAt:'2026-11-15T20:00:00Z'},{...item,id:'sport',title:'足球比赛结果',tags:[],categories:['content']}];
  assert.deepEqual(selectReportItems([item,{...item,id:'dup'},...invalid],[source],now).map(i=>i.id),['one']);
  assert.equal(selectReportItems([item],[{...source,state:'error'}],now).length,0);
});
test('日报保存来源与时间，读取失败不生成虚构摘要，缺少来源显示部分完成',async()=>{
  const report=await buildReport([item],[source,{id:'brandstar',name:'品牌星球',state:'setup'}],now,async()=>{throw Error('offline')});
  assert.equal(report.status,'partial');assert.equal(report.entries[0].excerpt,null);
  assert.equal(report.entries[0].url,item.url);assert.equal(report.entries[0].section,'联名与 IP');assert.equal(report.late,false);
  assert.equal((await buildReport([], [source],now)).status,'insufficient');
});
test('昨日新闻按上海自然日，不混入今天凌晨新闻或漏掉昨天凌晨',()=>{
  assert.deepEqual(yesterdayWindow(now),{start:Date.parse('2026-11-14T16:00:00Z'),end:Date.parse('2026-11-15T16:00:00Z'),newsDate:'2026-11-15'});
  const yesterday={...item,publishedAt:'2026-11-14T16:00:00Z'};
  const today={...item,id:'today',title:'今日新品',url:'https://socialbeta.com/campaign/2',publishedAt:'2026-11-15T16:00:00Z'};
  assert.deepEqual(selectReportItems([yesterday,today],[source],now).map(i=>i.id),['one']);
});
test('日报优先摘录事件句，过滤图注，不用宣传标语替代事件',()=>{
  const html='<meta name="description" content="让生活更美好"><div class="content">这是一段背景介绍。<br>某品牌昨日宣布推出联名系列，并于线下门店发售。<br>〇图源某用户</div>';
  assert.equal(extractReportExcerpt(html),'某品牌昨日宣布推出联名系列，并于线下门店发售。');
});

test('日报按新闻证据分组，历史标签不把新品误分为联名',()=>{
  assert.equal(marketingSection({title:'Sony「复活」1979 年的耳机',source:'socialbeta',tags:['IP联名']}),'新品与消费');
  assert.equal(marketingSection({title:'罗意威香氛推出《圣诞夜惊魂》限定系列',source:'brandstar'}),'联名与 IP');
});
