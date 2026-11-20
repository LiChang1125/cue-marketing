import {DatabaseSync} from 'node:sqlite';
import {sogouLinks} from '../integrations/hot-monitor/open-news.mjs';
import {chinaNewsRows,etTodayRows,regionalTerms} from '../integrations/hot-monitor/regional-search.mjs';
import {readableHeadline,brokenCopy} from '../integrations/hot-monitor/search-headline.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {phraseMatches,subjectOf,probeFragments,dictionaryLabels,subjectPassage,topicWhere} from '../integrations/hot-monitor/query-language.mjs';
import {wireReleases,asiaReleases} from '../integrations/hot-monitor/newswire-search.mjs';
import {leadsFor,relatedCampaigns,campaignMatch} from '../integrations/hot-monitor/search-leads.mjs';

test('compound subjects retain all constraints while allowing intervening words and different word order',()=>{
 assert.equal(subjectOf('请帮我查一下陶瓷餐具的营销案例'),'陶瓷餐具');
 assert.ok(phraseMatches('采购陶瓷制成的联名餐具','陶瓷餐具'));
 assert.equal(phraseMatches('首发陶瓷新品。另一家公司在卖餐具。','陶瓷餐具'),false);
 assert.ok(phraseMatches('Brand opens pop-up showcasing travel-size candles','travel size candle'));
 assert.ok(phraseMatches('candles in travel size packaging','travel-size candles'));
 assert.equal(phraseMatches('More candles and gifts for the holiday','travel-size candles'),false);
 assert.ok(!probeFragments('陶瓷餐具').includes('陶瓷餐具'));
});
test('publication searches keep original URLs and dates across languages and drop expired releases',()=>{
 const now=Date.parse('2026-11-20T10:00:00Z');
 const html='<div class="newsCards"><div class="card"><h3><small>Nov 18, 2026, 10:03 ET</small><a class="news-release" href="/news-releases/stone-1001.html">Stone introduces a ceramic collection</a></h3><p>Ceramics</p><p><a href="/news/stone/">Stone</a></p></div></div>';
 const [release]=wireReleases(html,now);
 assert.equal(release.publishedAt,'2026-11-18T15:03:00.000Z');assert.equal(release.publisher,'Stone');
 assert.deepEqual(wireReleases(html,now+32*86400000),[]);
 const cn='<div class="search-story-wrap"><div class="card"><h3><a href="https://www.prnasia.com/story/12345-1.shtml">山海推出陶瓷餐具</a></h3><p class="card-text-summary">新品发布</p><span class="datetime">2026-11-19 09:30</span></div></div>';
 assert.equal(asiaReleases(cn,now)[0].publishedAt,'2026-11-19T01:30:00.000Z');
 assert.equal(asiaReleases(cn.replace('/story/','/company/'),now).length,0);
});
test('unlisted issuers and a verified named product drive second-hop searches for any category',()=>{
 const release={title:'陌生品牌推出「星瀑餐盘」',role:'official',publisher:'陌生品牌',issuerChannel:'https://example.org/company/9',url:'https://example.org/news/22'};
 assert.ok(leadsFor([release],'餐具').includes('陌生品牌'));
 const campaigns=relatedCampaigns([release]);
 assert.ok(campaignMatch({title:'陌生品牌扩展星瀑餐盘的零售渠道',url:'https://example.net/a'},campaigns));
 assert.equal(campaignMatch({title:'陌生品牌赞助夏日音乐节',url:'https://example.net/b'},campaigns),undefined);
});

test('a web search exposes original links, and local dictionaries expose only exact lexical labels',()=>{
 const results=sogouLinks('<title>搜狗搜索</title><div class="vrwrap"><h3><a href="/link?url=xx">海风品牌首店</a></h3><span data-url="https://news.example.com/stories/22"></span></div>');
 assert.equal(results[0].url,'https://news.example.com/stories/22');assert.equal(results[0].publishedAt,undefined);
 assert.deepEqual(dictionaryLabels({input:'珠绣',web_trans:{'web-translation':[{key:'珠绣教程','@same':'true',trans:[{value:'lesson',support:100}]},{key:'珠绣','@same':'true',trans:[{value:'bead embroidery',support:65}]}]}},'珠绣','en').labels,['bead embroidery']);
 assert.ok(subjectPassage('Our candles now come in a compact travel size format.','travel size candles'));
 assert.ok(regionalTerms('联名').includes('聯名'));
});
test('archives retrieve compound words throughout the same article without treating one word as a hit',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec("CREATE TABLE stories(title,content); INSERT INTO stories VALUES('陶瓷联名','推出全套餐具'),('家居新品','陶瓷饰品');");
 const {sql,params}=topicWhere(['陶瓷餐具']);assert.deepEqual(db.prepare('SELECT title FROM stories WHERE '+sql).all(...params).map(r=>r.title),['陶瓷联名']);
 }finally{db.close();}
});
test('editorial news dates, publication paths and site identities are checked on both regional publishers',()=>{
 const ref=Date.parse('2026-11-20T08:00:00Z'),cn={url:'http://www.chinanews.com.cn/cj/2026/11-19/12345.shtml',pubtime:'2026-11-19 09:30',title:'海风推出新款',content_without_tag:'食品品牌'};
 const records=chinaNewsRows('var docArr = '+JSON.stringify([cn,{...cn,url:'https://example.org/x'},{...cn,pubtime:'2024-11-01 00:00'}])+';',ref);
 assert.equal(records.length,1);assert.equal(records[0].publishedAt,'2026-11-19T01:30:00.000Z');
 const html='<title>ETtoday</title><div class="archive"><h2><a href="https://fashion.ettoday.net/news/1234">品牌聯名</a></h2><p class="detail">新動向<span class="date">財經 / 2026-11-18 12:30</span></p></div>';
 assert.equal(etTodayRows(html,ref)[0].title,'品牌联名');
});
test('structured original headlines preserve unknown brands and the requested industry term',()=>{
 assert.equal(readableHeadline('Aster Launches Nimbus Ceramic Tableware','阿斯特','陶瓷餐具',['ceramic tableware']),'Aster 推出 Nimbus 陶瓷餐具');
 assert.ok(brokenCopy('新品\\fs18\\bord1'));assert.equal(brokenCopy('Aster 推出夏季新品'),false);
});
