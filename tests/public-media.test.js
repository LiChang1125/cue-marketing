import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMediaFeed,parseMediaHtml,marketingArticle,selectMediaNews} from '../server/media-news.js';
import {mediaSource} from '../shared/media-sources.js';
import {mergeRankHistory,topicPulse} from '../shared/pulse.js';
import {buildPulseItems} from '../shared/pulse-content.js';
const now=Date.parse('2026-11-17T04:00:00Z');
test('脉动独立来源排除首页媒体与重复原文；热榜时间不冒充新闻发布时间',()=>{
 const base={title:'香水品牌开设全新体验店',source:'pulse-glossy',sourceName:'Glossy',url:'https://www.glossy.co/beauty/fragrance',publishedAt:'2026-11-16T02:00:00Z'};
 const raw={articles:[base,{...base,url:'https://socialbeta.com/article/1'},{...base,url:'https://retaildive.com/news/home-article'}],items:[{title:'香水品牌成为消费热点',source:'weibo',url:'https://s.weibo.com/weibo?q=perfume',at:'2026-11-17T02:00:00Z'}]};
 const items=buildPulseItems(raw,[],[{url:'https://retaildive.com/news/home-article'}],now);
 assert.equal(items.length,2);const hot=items.find(i=>i.contentType==='hot-topic');assert.equal(hot.publishedAt,undefined);assert.equal(hot.firstSeenAt,raw.items[0].at);
 const later=buildPulseItems({...raw,items:[{...raw.items[0],at:'2026-11-17T03:00:00Z'}]},items,[],now);assert.equal(later.find(i=>i.contentType==='hot-topic').firstSeenAt,hot.firstSeenAt);
 assert.equal(topicPulse(items,[],{query:'香水',now}).series.reduce((n,p)=>n+p.count,0),1);
});
test('媒体入口拒绝公司主页、购物补货、非白名单和未知日期，保留 RSS 原始发布日期',()=>{
 const source=mediaSource('media-adweek');
 const xml='<rss><channel><item><title>Brand launches fragrance campaign</title><link>https://www.adweek.com/brand-launch/</link><pubDate>Mon, 16 Nov 2026 12:00:00 GMT</pubDate></item><item><title>Brand news without a date</title><link>https://www.adweek.com/brand-news/</link></item></channel></rss>';
 const parsed=parseMediaFeed(xml,source,new Date(now).toISOString());
 assert.equal(selectMediaNews(parsed,now).length,1);assert.equal(parsed[0].publishedAt,'2026-11-16T12:00:00.000Z');
 for(const item of [{...parsed[0],url:'https://www.digitaling.com/company/123',source:'media-digitaling'},{...parsed[0],title:'Brand restock tracker: where to buy'},{...parsed[0],source:'weibo'}])assert.equal(marketingArticle(item,source),false);
 const html='<a href="https://evil.example/article/123">品牌营销案例文章</a>';
 assert.equal(parseMediaHtml(html,source).length,0);
});
test('TrendRadar 缓存的同一时间点不能制造增长，未知和未来时间不进入历史',()=>{
 const base={title:'香水新品',url:'https://www.douyin.com/hot/1',source:'douyin',rank:9,at:'2026-11-17T03:00:00Z'};
 assert.equal(mergeRankHistory([base],[{...base,observedAt:'2026-11-17T04:00:00Z'},{...base,at:null},{...base,at:'2026-11-18T04:00:00Z'}],now).length,1);
 const next={...base,at:'2026-11-17T03:30:00Z',rank:5};const merged=mergeRankHistory([base],[next],now);assert.equal(merged.length,2);assert.deepEqual(topicPulse([],merged,{query:'香水',now}).trajectories[0].points.map(p=>p.rank),[9,5]);
 assert.equal(topicPulse([],merged,{query:'香水',platform:'weibo',now}).trajectories.length,0);
 assert.equal(topicPulse([], [{...base,title:'美国发布AI芯片远程访问新规'}],{now}).trajectories.length,0);
});
test('关键词返回最近十篇真实报道，同义词扩展，不将搜索词或热榜排名算成讨论人数',()=>{
 const items=Array.from({length:14},(_,i)=>({id:String(i),title:'香氛品牌案例 '+i,url:'https://socialbeta.com/article/'+i,source:'socialbeta',publishedAt:new Date(now-(i+1)*3600000).toISOString()}));
 const result=topicPulse([...items,{...items[0],id:'future',title:'香水未来新闻',publishedAt:'2026-12-01'}],[],{query:'香水',now});
 assert.equal(result.articles.length,10);assert.equal(result.articles[0].id,'0');assert.equal(result.total,14);assert.equal(result.series.reduce((n,p)=>n+p.count,0),14);assert.equal(result.hotTopics,0);
 assert.equal(topicPulse(items,[],{query:'亚文化',now}).articles.length,0);
});
