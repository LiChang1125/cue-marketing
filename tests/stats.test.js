import test from 'node:test';
import assert from 'node:assert/strict';
import {trendStats} from '../server/stats.js';
const now=Date.parse('2026-11-16T08:00:00Z');
const item={id:'one',title:'品牌联名',url:'https://example.com/1',source:'bilibili',firstSeen:'2026-11-16T06:00:00Z'};
test('趋势图只使用真实观测，不把单次读数变成涨幅',()=>{
  const stats=trendStats([item],()=>[{at:'2026-11-16T07:00:00Z',views:100}],now);
  assert.equal(stats.new24h,1);assert.equal(stats.previous24h,null);assert.equal(stats.changePercent,null);assert.equal(stats.changes.length,0);assert.equal(stats.hourly.reduce((sum,p)=>sum+p.count,0),1);
});
test('同指标变化使用实际区间；零基数不生成百分比',()=>{
  const stats=trendStats([item],()=>[{at:'2026-11-16T07:00:00Z',views:0},{at:'2026-11-16T07:30:00Z',views:500}],now);
  assert.equal(stats.changes[0].delta,500);assert.equal(stats.changes[0].percent,null);assert.equal(stats.changes[0].start,'2026-11-16T07:00:00Z');
});
test('主题新增按首次加入主题的时间，变化为负时保留真实结果',()=>{
  const old={...item,firstSeen:'2026-11-10T00:00:00Z'};
  const stats=trendStats([old],()=>[{at:'2026-11-16T07:00:00Z',likes:200},{at:'2026-11-16T07:30:00Z',likes:150}],now,[{id:'one',discoveredAt:'2026-11-16T07:00:00Z'}]);
  assert.equal(stats.new24h,1);assert.equal(stats.previous24h,null);assert.equal(stats.changes[0].percent,-25);assert.equal(stats.changes[0].delta,-50);
});
