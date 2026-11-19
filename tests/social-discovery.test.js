import test from 'node:test';
import assert from 'node:assert/strict';
import {discovery} from '../shared/social-discovery.js';
import {communityForTopic,comparableDiscussion,evidenceMatches} from '../shared/community.js';

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

test('whale IP evidence excludes model news and separates historical discussions',()=>{
  assert.equal(evidenceMatches('DeepSeek 发布新模型','DeepSeek鲸鱼'),false);
  assert.equal(evidenceMatches('鲸鱼娘皮肤上榜 Awesome DeepSeek Harness','DeepSeek 鲸鱼'),true);
  const older={day:'2026-08-12',title:'DeepSeek logo 是鲸鱼还是海豚',url,platform:'V2EX',replies:1};
  const [group]=communityForTopic({},'DeepSeek 鲸鱼',7,[older],now);
  assert.equal(group.posts.length,0);
  assert.equal(group.older.length,1);
});

test('only compares discussion counts for the same videos at both observations',()=>{
  const snapshots=[
    {at:'2026-11-16T04:00:00Z',counts:[{url:'a',danmaku:7},{url:'b',danmaku:10}]},
    {at:'2026-11-18T04:00:00Z',counts:[{url:'b',danmaku:14},{url:'c',danmaku:50}]}
  ];
  const change=comparableDiscussion(snapshots,7,now);
  assert.equal(change.sample,1);
  assert.equal(change.change,4);
});

test('unlisted combination queries match both names in either title order',()=>{
  assert.equal(evidenceMatches('曙光工坊发布青槐手办','青槐 曙光工坊'),true);
  assert.equal(evidenceMatches('曙光工坊发布沙丘手办','青槐 曙光工坊'),false);
  assert.equal(evidenceMatches('乐高2027年F1赛车曝光','请帮我看看乐高 F1的市场趋势'),true);
});