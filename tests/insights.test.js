import test from 'node:test';
import assert from 'node:assert/strict';
import {trendInsights} from '../server/insights.js';
import {marketingHotlist} from '../server/hotlist.js';
import {topicMatches,marketingLogic,uniqueCases} from '../shared/insights.js';
import {searchPlan} from '../server/search-plan.js';
const now=Date.parse('2026-11-16T08:00:00Z');
const row=(id,title,extra={})=>({id,title,source:'socialbeta',url:`https://socialbeta.com/campaign/${id}`,publishedAt:'2026-11-15T00:00:00Z',firstSeen:'2026-11-16T06:00:00Z',fetchedAt:new Date(now).toISOString(),metrics:{},...extra});
const history=()=>[{at:'2026-11-16T07:00:00Z',likes:100},{at:'2026-11-16T07:30:00Z',likes:130}];

test('方向汇总按真实发布日期，初次批量导入不冒充升温或周增长',()=>{
  const items=[row('1','品牌香水新品推出'),row('2','品牌联名限定系列'),row('3','潮玩盲盒新品'),row('old','香氛旧闻',{publishedAt:'2025-01-01T00:00:00Z'}),row('unknown','香氛话题',{publishedAt:null}),row('future','品牌新品',{publishedAt:'2026-11-17T00:00:00Z'})];
  const data=trendInsights(items,()=>[],now);assert.equal(data.totalRecent,3);assert.deepEqual(data.groups.map(g=>g.recentCount),[1,1,1]);
  for(const group of data.groups){assert.equal(group.changePercent,null);assert.equal(group.status,'持续观察');}
  assert.equal(data.groups[0].directions.find(d=>d.id==='scent').recentCount,1);
});
test('互动升温由同来源同指标多个样本支撑，不跨平台拼热度',()=>{
  const items=[row('a','香水新品甲'),row('b','香水新品乙'),row('c','香水新品丙')];
  const group=trendInsights(items,history,now).groups[0];assert.equal(group.status,'互动升温');assert.equal(group.risingCount,3);assert.equal(group.cohorts[0].delta,90);
  const mixed=items.map((i,n)=>({...i,source:['xiaohongshu','weibo','bilibili-cli'][n]}));
  const limited=trendInsights(mixed,history,now).groups[0];assert.notEqual(limited.status,'互动升温');assert.equal(limited.cohorts.length,3);
});
test('失效来源的旧互动不能冒充当前升温，下降数据保留',()=>{
  const items=[row('a','品牌香水新品')];
  assert.equal(trendInsights(items,history,now,[{id:'socialbeta',state:'error'}]).groups[0].comparableCount,0);
  const g=trendInsights(items,()=>[{at:'2026-11-16T07:00:00Z',likes:200},{at:'2026-11-16T07:30:00Z',likes:180}],now).groups[0];assert.equal(g.risingCount,0);assert.equal(g.cohorts[0].delta,-20);
});
test('主题匹配支持香氛、圈层同义词，搜索标签不构成内容证据',()=>{
  assert.equal(topicMatches(row('a','香氛新品体验'),'香水'),true);
  assert.equal(topicMatches(row('b','哥特与朋克的文化表达'),'亚文化'),true);
  assert.equal(topicMatches({...row('c','篮球比赛'),tags:['香水'],searchQuery:'香水'},'香水'),false);
  assert.equal(topicMatches(row('d','香氛新品'),'快闪'),false);
});
test('公共热榜排除旧闻、未注明日期和无关新闻，合并重复事件',()=>{
  const items=[row('a','某品牌推出香氛新品'),row('b','某品牌推出香氛新品',{source:'weibo',url:'https://weibo.com/1/2'}),row('c','军事战火消息',{source:'weibo'}),row('old','品牌旧款',{publishedAt:'2026-10-01T00:00:00Z'}),row('no','品牌话题',{publishedAt:null})];
  const list=marketingHotlist(items,[],now);assert.equal(list.length,1);assert.equal(list[0].platformCount,2);assert.equal(list[0].mentions,2);assert.equal(list[0].hotRank,1);assert.equal('score' in list[0],false);
});
test('营销思路提供可借鉴角度，不虚构效果；统计案例去重',()=>{
  const item=row('a','某品牌与角色联名');assert.match(marketingLogic(item).idea,/可借鉴/);assert.doesNotMatch(marketingLogic(item).reason,/销量增长|转化率|成功/);
  assert.equal(uniqueCases([item,{...item,id:'b'}]).length,1);
});

test('主题趋势图按北京时间自然日计数，7/30 天切换不混入未知和未来日期',()=>{
  const items=[row('a','品牌香水新品',{publishedAt:'2026-11-15T16:00:00Z'}),row('b','品牌香水新品乙',{publishedAt:'2026-11-15T15:59:59Z'}),row('c','品牌香水新品丙',{publishedAt:'2026-10-30T00:00:00Z'}),row('no','品牌香氛',{publishedAt:null}),row('future','品牌香氛乙',{publishedAt:'2026-11-17T00:00:00Z'})];
  const seven=trendInsights(items,()=>[],now).activity,month=trendInsights(items,()=>[],now,[],30).activity;
  assert.equal(seven.daily.length,7);assert.equal(seven.recentCount,2);assert.equal(seven.daily.at(-1).count,1);assert.equal(seven.daily.at(-2).count,1);assert.equal(month.daily.length,30);assert.equal(month.recentCount,3);
  assert.equal(month.daily.reduce((sum,d)=>sum+d.count,0),month.recentCount);assert.equal(month.distribution.reduce((sum,d)=>sum+d.count,0),month.recentCount);
});
test('类别主题扩展关联词，普通品牌词保留原查询',()=>{
  assert.deepEqual(searchPlan('香水'),['香水','香氛','香水新品']);
  assert.equal(searchPlan('亚文化').length,3);assert.equal(searchPlan('某品牌')[0],'某品牌');
});
