import test from 'node:test';
import assert from 'node:assert/strict';
import {qualify,planTopic,metricText,marketVoice} from '../integrations/hot-monitor/topic-brief.mjs';

const now=Date.parse('2026-11-19T08:00:00Z');
const base={title:'原神与麦当劳推出二次元主题联名',source:'bilibili',url:'https://www.bilibili.com/video/example',publishedAt:'2026-11-09'};
const match=(row,query='亚文化')=>qualify(row,query,planTopic(query),now);

test('a recent partnership can match a culture even without its umbrella term',()=>{
  assert.equal(match(base).angle,'联名合作');
  assert.equal(match(base,'香水'),null);
});
test('definitions and undated or expired evidence cannot enter the case list',()=>{
  for(const date of ['2026-01-01','2026-12-01',null])assert.equal(match({...base,publishedAt:date}),null);
  assert.equal(match({...base,title:'亚文化是什么意思：联名案例百科'}),null);
  assert.equal(match({...base,title:'二次元剪辑合集'}),null);
});
test('distinguishes zero observed comments from an unpublished count',()=>{
  assert.equal(metricText({viewCount:'2.4万',commentCount:0,likeCount:null}),'播放 2.4万 · 评论 0');
});
test('a renovation cannot turn an incidental amenity into a product launch',()=>{
  const row={...base,source:'editorial',title:'海湾酒店推出全新度假体验',originalRead:true,
    content:'酒店设有日落泳池、手工烘焙坊和健身房。'};
  assert.equal(match(row,'手工烘焙'),null);
  assert.ok(match({...row,content:'酒店与本地品牌携手推出手工烘焙体验。'},'手工烘焙'));
});
test('community quotes must refer to a product, a campaign or a consumer response',()=>{
  assert.equal(marketVoice('低血糖犯了就听一遍这个'),false);
  assert.equal(marketVoice('一直想入手这个联名配色，可惜门店已经售罄。'),true);
});
test('an unfamiliar topic admits a dated brand action and excludes unrelated or explanatory hits',()=>{
  const cafe={...base,title:'海潮咖啡携手本地烘焙坊推出低因咖啡系列',source:'editorial'};
  assert.ok(match(cafe,'低因咖啡'));
  assert.equal(match(cafe,'低温酸奶'),null);
  assert.equal(match({...cafe,title:'低因咖啡是什么意思？品牌联名百科'},'低因咖啡'),null);
  assert.equal(match({...cafe,publishedAt:'2026-10-01'},'低因咖啡'),null);
});
