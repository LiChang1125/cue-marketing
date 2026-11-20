import test from 'node:test';
import assert from 'node:assert/strict';
import {editorialMatches,marketingWeight} from '../integrations/hot-monitor/marketing.mjs';

test('named brands require evidence even when another brand makes the same product',()=>{
  const publishedAt=new Date().toISOString();
  const feed={items:[
    {title:'其他品牌联名推出盲盒',url:'https://example.com/1',publishedAt},
    {title:'POP MART 携手设计师推出新品',url:'https://example.com/2',publishedAt},
    {title:'泡泡玛特历史联名展',url:'https://example.com/3',publishedAt:'2019-05-01'}
  ]};
  assert.deepEqual(editorialMatches(feed,'泡泡玛特').map(r=>r.url),['https://example.com/2']);
});
test('a reported campaign ranks ahead of generic shopping pages for the same theme',()=>{
  const campaign={source:'editorial',title:'香氛品牌官宣全新代言人',content:'分享新品合作'};
  const shopping={source:'bing',title:'香水优惠码'};
  assert.ok(marketingWeight(campaign,'香水')>marketingWeight(shopping,'香水'));
});
