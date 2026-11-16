import test from 'node:test';
import assert from 'node:assert/strict';
import{isRelevant,scopedItems}from'../server/relevance.js';
import{trendStats}from'../server/stats.js';
test('截图中的无关娱乐和军事视频不能因为热度、动画分区或查询词进入营销趋势',()=>{
  for(const title of ['【伪纪录片】镜 化','美国野心滔天？把战火烧到鸭绿江？！那么 你将面对中朝军民合力反击！','“46块3，问清一条规则。”','命运让他们彼此对立，也让他们彼此靠近｜上','《立贤不立长》','术式反转久留美 【泛式】','用美式乡村讲中国故事（二）','《美队全家福VS灭霸全家福》灭霸的爸爸叫灭建国！']){
    const item={id:title,title,source:'bilibili-animation',tags:['品牌联名','潮玩'],categories:['culture','ip'],searchQuery:'品牌联名'};
    assert.equal(isRelevant(item),false,title);assert.equal(scopedItems([item]).length,0);assert.equal(trendStats([item],()=>[]).total,0);
  }
});
test('营销、商业IP和文化消费有明确内容证据时才纳入',()=>{
  for(const title of ['品牌联名款如何联名好？','原神与肯德基联名新品发布','泡泡玛特 LABUBU 新系列发售','2026年潮玩市场研究报告','谷子文化为什么兴起','Sony 发布复古耳机','IP授权市场观察'])assert.equal(isRelevant({title,source:'weibo'}),true,title);
  assert.equal(isRelevant({title:'原神日常游戏实况',source:'bilibili'}),false);
  assert.equal(isRelevant({title:'Mecanoo 改造荷兰央行，金库变身城市客厅',source:'brandstar'}),false);
  assert.equal(isRelevant({title:'字节内容运营实习生急招（手工潮玩）',source:'xiaohongshu'}),false);
});
