import test from 'node:test';
import assert from 'node:assert/strict';
import {readPlatformChart} from '../shared/platform-hot.js';
import {platformStoryBoards,platformEvidence} from '../integrations/hot-monitor/platform-stories.mjs';
import {eventCards} from '../integrations/hot-monitor/brand-events.mjs';

const now=Date.parse('2026-11-21T04:00:00Z'),publishedAt=new Date(now-3600000).toISOString();
test('公开榜单保留原名次与零热度，拒绝失效快照和站外链接',()=>{
  const item={rank:4,title:'品牌快闪活动',url:'https://www.douyin.com/search/demo',hot:0};
  const board={platform:'douyin',ok:true,fetched_at:publishedAt,items:[item,{...item,title:'无热度',rank:7,hot:null},{...item,title:'站外',url:'https://douyin.com.example.org/'}]};
  const snap={boards:[board]};
  assert.deepEqual(readPlatformChart(snap,'douyin',now).rows.map(r=>[r.rank,r.value]),[[4,0],[7,null]]);
  assert.equal(readPlatformChart(snap,'xiaohongshu',now),null);
  assert.equal(readPlatformChart(snap,'douyin',now+86400000),null);
  assert.equal(readPlatformChart({boards:[{...board,ok:false}]},'douyin',now),null);
});
test('平台按独立来源聚类，单篇转载和另一个平台的案例不进入同一榜',async()=>{
  const rows=['抖音','小红书'].flatMap((p,i)=>[
    {url:'https://one.example/'+i,title:'瑞幸在'+p+'推出咖啡品牌与迪士尼的联名饮品',publishedAt},
    {url:'https://two.example/'+i,title:'喜茶在'+p+'推出三丽鸥主题联名新品',publishedAt}
  ]);
  const boards=await platformStoryBoards(rows,{},now,eventCards,async r=>r);
  const a=boards.douyin.results.find(s=>s.title==='品牌与 IP 的联名合作'),b=boards.xiaohongshu.results.find(s=>s.title==='品牌与 IP 的联名合作');
  assert.ok(a&&b);assert.notEqual(a.storyId,b.storyId);
  assert.equal(a.outlets,2);assert.equal(a.trend.length,24);assert.ok(a.reports.every(r=>r.title.includes('抖音')));
  const one=await platformStoryBoards([rows[0],{...rows[0],url:'https://copy.example/a'}],{},now,eventCards,async r=>r);
  assert.equal(one.douyin.results.length,0);
  const sample={...rows[0],title:'本周咖啡品牌新品',content:'扫码关注小红书。'};
  assert.equal(platformEvidence(sample,'xiaohongshu',[]),false);
  assert.equal(platformEvidence(sample,'douyin',[{title:'咖啡品牌新品'}]),true);
});
