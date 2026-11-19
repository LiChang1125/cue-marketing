import test from 'node:test';
import assert from 'node:assert/strict';
import {discovery} from '../shared/social-discovery.js';

const day='2026-11-18';
const now=Date.parse(day+'T10:00:00Z');
const url='https://example.com/article';
const row={day,platform:'微博',series:'微博热搜',rank:4,url,source:url};
const article=title=>({title,url,publishedAt:day});

test('requires both a named editorial subject and recent independent measurements',()=>{
  const rows=[
    {...row,title:'拼豆作画'},
    {...row,title:'EDG电竞赛事'},
    {...row,title:'Nike campaign',entity:'Nike',platform:'Instagram'},
    {...row,title:'其他品牌',entity:'其他品牌'}
  ];
  const editorialCases=[article('耐克推出新品'),article('New edge in advertising'),article('拼豆走红'),article('某香水品牌开店')];
  const {brands}=discovery({rows,editorialCases},[],now);
  assert.deepEqual(brands.map(e=>e.name),['耐克']);
  assert.equal(brands[0].story.title,'耐克推出新品');
});

test('connects an IP to its editorial story and drops out-of-window evidence',()=>{
  const rows=[{...row,title:'GTA6游戏测评'},{...row,title:'BLG夺冠',day:'2026-11-01'}];
  const articles=[article('品牌参与 GTA VI 发售活动'),article('BLG 联名活动')];
  const {brands}=discovery({rows},articles,now);
  assert.deepEqual(brands.map(e=>[e.name,e.isIP]),[['GTA 6',true]]);
});
