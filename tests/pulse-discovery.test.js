import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignMatch,relatedCampaigns} from '../integrations/hot-monitor/search-leads.mjs';
import {eventCards} from '../integrations/hot-monitor/brand-events.mjs';
import {issue,keywordIssues} from '../integrations/hot-monitor/brand-newsrooms.mjs';
import {coversTerm} from '../integrations/hot-monitor/topic-brief.mjs';
import {galRecord} from '../integrations/hot-monitor/press-index.mjs';
const now=Date.parse('2026-11-19T12:00Z');
const report=(title,id)=>({title,content:'A footwear collaboration and new brand campaign.',url:'https://'+id+'.example/news/story',publishedAt:new Date(now-3600000).toISOString()});
test('follow-up requires both an event identifier and a partner',()=>{
 const cases=relatedCampaigns([{title:'耐克发布「星光夜跑」限定跑鞋',url:'https://nike.example/story'}]);
 assert.ok(campaignMatch({title:'耐克「星光夜跑」开设体验店'},cases));
 assert.equal(campaignMatch({title:'耐克推出常规运动服'},cases),undefined);
});
test('different collaborations using the same sneaker or franchise stay separate',()=>{
 const rows=['Inter Milan Releases Their Nike Air Force 1 Collab','Inter Milan and Nike Drop the Club’s First-Ever Air Force 1','Travis Scott x Nike Air Force 1 Low GTA 6 Limited to 600 Pairs','Ronnie Fieg’s ASICS GEL-Lyte III Returns As Part Of KITH x Star Wars Collection','Five reasons to collect the LEGO Star Wars UCS Sail Barge'].map((t,i)=>report(t,'publisher'+i));
 const events=eventCards(rows,now);
 assert.equal(events.length,4);
 assert.equal(events[0].reports.length,2);
});
test('global archive needs dated consumer-marketing evidence and a matching publisher domain',()=>{
 const raw={title:'Coffee retailer opens flagship store',desc:'The coffee brand unveiled its first flagship store.',url:'https://paper.example/news/retail',domain:'paper.example',date:'2026-11-18T10:32:00Z'};
 assert.ok(galRecord(raw,now,now));
 for(const overrides of [{domain:'other.example'},{date:'2025-11-18T10:32:00Z'},{title:'Cosplay influencer dies unexpectedly aged 26'},{title:'Police seek suspect after sneaker shop theft'}])assert.equal(galRecord({...raw,...overrides},now,now),undefined);
});

test('topic words and attributed brand releases have independent evidence',()=>{
 assert.equal(coversTerm('a Christmas campaign','camp'),false);
 assert.equal(coversTerm('winter camping collection','camping'),true);
 assert.equal(coversTerm('タコスプレート','コスプレ'),false);
 assert.equal(coversTerm('公式コスプレイベント','コスプレ'),true);
 const release={url:'/main/html/rd/p/000000125.000014256.html',provider:{id:14256,name:'服飾企画'},title:'ブランドのコスプレ衣装を数量限定で発売',updated_at:{origin:'2026-11-18T12:00:00+09:00'}};
 assert.equal(issue(release,now).issuer,'14256');
 assert.equal(issue({...release,provider:{id:123,name:'異なる発表元'}},now),undefined);
 assert.equal(issue({...release,updated_at:{}},now),undefined);
});

test('alternative headlines with the same named product and campaign partner share a case',()=>{
 const a={...report('Rina Lipa Lands First Beauty Campaign for GCDS Morso Fragrance','consumer'),url:'https://wwd.example/beauty/rina-lipa-first-beauty-campaign-gcds-morso-fragrance'};
 const b={...report('Dua Lipa’s Little Sister Lands Her First Campaign','press'),url:'https://press.example/dua-lipa-little-sister-risa-first-campaign-gcds-morso'};
 assert.equal(eventCards([a,b],now).length,1);
});

test('official keyword pages use complete article titles, publisher identifiers and the stated date',()=>{
 const path='/main/html/rd/p/000000123.000017211.html';
 const full='限定キャンプ用品を発売、新しいテントが登場';
 const fields=[{_1:2,_3:4},'title',full,'releaseUrl',path];
 const stamp=new Date(Date.now()-86400000),date=stamp.toISOString().slice(0,10).split('-');
 const html='<article><a href="'+path+'"><h3>限定…</h3><time>'+date[0]+'年'+date[1]+'月'+date[2]+'日 10時00分</time></a><a href="/main/html/searchrlp/company_id/17211">テスト株式会社</a></article><script>window.__reactRouterContext.streamController.enqueue('+JSON.stringify(JSON.stringify(fields))+')</script>';
 const [result]=keywordIssues(html);
 assert.equal(result.title,full);
 assert.equal(result.issuer,'17211');
 assert.equal(result.at,Date.parse(date.join('-')+'T01:00:00Z'));
});

import {marketPatterns} from '../integrations/hot-monitor/market-patterns.mjs';
import {editorialBeat} from '../integrations/hot-monitor/subject-publications.mjs';
test('two different shoe collaborations form one cross-brand trend, repeated copies count once',()=>{
 const make=(title,slug,origins)=>({title,url:'https://source.example/'+slug,publishedAt:new Date(now).toISOString(),reports:origins.map(([host,copyId])=>({url:'https://'+host+'/'+slug,copyId,publishedAt:new Date(now).toISOString()}))});
 const a=make('耐克联名跑鞋新品上市','s1',[['editor-a.example','syndicated'],['editor-b.example','syndicated']]);
 const b=make('阿迪达斯跨界联名球鞋亮相','s2',[['editor-c.example','original']]);
 assert.deepEqual(marketPatterns([a,a],now),[]);
 const [g]=marketPatterns([a,b],now);assert.equal(g.count,2);assert.equal(g.origins,2);assert.equal(g.examples.length,2);
});
test('a camping journal can supply a named camping lantern case, but a sale or unrelated headline cannot',()=>{
 const row={url:'https://campreview.jp/lamplighter/',title:'新作 フィールドライト 登場'};
 assert.equal(editorialBeat('露营',row),true);
 assert.equal(editorialBeat('露营',{...row,title:'最大90%OFF セール開催'}),false);
 assert.equal(editorialBeat('香水',row),false);
});
