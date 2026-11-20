import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consumerContent,excludedTopic} from '../integrations/hot-monitor/consumer-market.mjs';
import {brandAttention} from '../integrations/hot-monitor/brand-attention.mjs';
import {eventCards} from '../integrations/hot-monitor/brand-events.mjs';
import {buildBrandTools} from '../integrations/hot-monitor/brand-tools.mjs';
import {qualify,planTopic} from '../integrations/hot-monitor/topic-brief.mjs';
const now=Date.parse('2026-11-19T11:00:00Z');
const item=(title,domain='a.example')=>({title,publisher:domain,url:'https://'+domain+'/article',source:'editorial',publishedAt:'2026-11-18T04:00:00Z'});
test('the subject of coverage controls admission independently of the publisher or platform',()=>{
 for(const title of ['瑞幸携手设计师推出限定咖啡','库迪在小红书发布香氛联名','小众服装品牌在 Instagram 发布秋冬系列']){
   assert.ok(consumerContent({...item(title),publisher:'36氪'}));
 }
 for(const title of ['微软联名推出新电脑','小红书携手某时装周发布平台营销工具','OpenAI launches a retail agent','华为发布香水联名手机']){
   const rows=['a.cn','b.cn','c.cn','d.cn'].map(s=>item(title,s));
   assert.equal(consumerContent(rows[0]),false);assert.deepEqual(brandAttention(rows,now),[]);
   assert.deepEqual(buildBrandTools(rows,now).ranking,[]);assert.equal(qualify(rows[0],'联名',planTopic('联名'),now),null);
 }
 assert.ok(excludedTopic('小米'));
});
test('cross-language reports need a shared brand, action and distinctive product to merge',()=>{
 const a=item('耐克推出 991v1 限量鞋款','a.example');
 const b=item('Nike launches limited 991v1 sneaker','b.example');
 const c=item('Nike launches new 880v2 sneaker','c.example');
 const groups=eventCards([a,b,c],now);
 assert.deepEqual(groups.map(x=>x.reports.length).sort(),[1,2]);
 const brand=buildBrandTools([a,b,c],now).ranking.find(x=>x.name==='耐克');
 assert.equal(brand.outlets,3);assert.equal(brand.current,2);
});

test('sister publications retain both links and contribute a single publisher to coverage',()=>{
 const reports=['marketingdive.com','restaurantdive.com','independent.example'].map(domain=>item('麦当劳联名推出秋季咖啡',domain));
 const [brand]=buildBrandTools(reports,now).ranking;
 assert.equal(brand.outlets,2);assert.equal(brand.cases[0].outlets,2);assert.equal(brand.cases[0].reports.length,3);
});

test('a newly named consumer brand can enter the rankings from dated reporting across outlets',()=>{
 const reports=['a.cn','b.cn','c.cn','d.cn'].map(domain=>item('独立香氛品牌「海雾实验室」推出城市限定香水',domain));
 assert.equal(brandAttention(reports,now)[0].brand,'海雾实验室');
 assert.equal(buildBrandTools(reports,now).ranking[0].outlets,4);
});

test('an attributed reprint retains its link without adding an extra origin',()=>{
 const original=item('耐克推出城市限定球鞋','www.nbd.com.cn');
 const copy={...item(original.title,'www.dzwww.com'),attribution:'每日经济新闻'};
 const [brand]=buildBrandTools([original,copy],now).ranking;
 assert.equal(brand.outlets,1);assert.equal(brand.cases[0].reports.length,2);
});
