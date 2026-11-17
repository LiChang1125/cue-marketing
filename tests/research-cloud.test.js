import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {uniqueCases} from '../shared/insights.js';
import {readArticleMetadata} from '../server/media-metadata.js';
import {parseMediaHtml,collectMediaSource} from '../server/media-news.js';
import {mediaSource} from '../shared/media-sources.js';
import {chinaStory,curatedSelection} from '../shared/geography.js';
import {searchResearch,normalizeResearchItem} from '../shared/research.js';
import {createPreviewFetch} from '../src/preview.js';
import {createPublicWorker} from '../server/public-worker.js';
import {startPublicServer} from '../server/public-server.js';
import {createResearchService} from '../server/research-service.js';

test('source-specific article paths and publication dates retain distinct query-ID cases',()=>{
 const s=mediaSource('media-adguider'),html='<a href="/case?id=aaa">品牌案例一：新品短片发布</a><a href="/case?id=bbb">品牌案例二：线下消费者体验</a>';
 assert.equal(parseMediaHtml(html,s).length,2);
 assert.equal(uniqueCases([{title:'文章一',url:'https://a.test/case?id=1&utm_source=x'},{title:'文章二',url:'https://a.test/case?id=2'},{title:'重复文章',url:'https://a.test/case?id=1&utm_source=y'}]).length,2);
 assert.equal(readArticleMetadata('<meta property="og:release_date" content="2026年11月4日">',{key:'topys'}).publishedAt,'2026-11-03T16:00:00.000Z');
 assert.ok(readArticleMetadata('<script>{"caCreateTime":"Nov 16, 2026 12:00:00 AM"}</script>',{key:'adguider'}).publishedAt);
 assert.equal(readArticleMetadata('<meta property="article:modified_time" content="2026-11-17"><img src="/2026-11-17/photo.jpg">').publishedAt,null);
 assert.equal(readArticleMetadata('<div class="report_2_2">3小时前</div>',{key:'topmarketing'},Date.parse('2026-11-17T06:00:00Z')).publishedAt,'2026-11-17T03:00:00.000Z');
 assert.equal(parseMediaHtml('<a href="/info12345">消费者趋势与品牌营销洞察报告</a>',mediaSource('media-topmarketing')).length,1);
});
test('recurring collection reuses verified publication metadata without re-dating articles',async()=>{
 const source={...mediaSource('media-topys'),entries:[]},now='2026-11-17T06:00:00Z',html='<a href="/article/12345">消费者品牌营销案例研究</a>',prior=parseMediaHtml(html,source,now).map(i=>({...i,publishedAt:'2026-11-10T03:00:00.000Z'}));let requests=0;
 const result=await collectMediaSource(source,{now,previous:prior,fetcher:async url=>{requests++;assert.equal(url,source.url);return {ok:true,url,text:async()=>html};}});
 assert.equal(requests,1);assert.equal(result.items[0].publishedAt,prior[0].publishedAt);
});
test('cloud arbitrary-topic requests share native report generation and preserve source links',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cue-research-'));let calls=0;
 const data={generatedAt:new Date().toISOString(),feed:{publicPulse:{researchItems:[{id:'one',source:'independent',publisher:'研究机构',title:'小众香水品牌消费洞察报告',url:'https://a.test/report',publishedAt:new Date().toISOString(),contentType:'research-report'}]}}};
 const search=createResearchService({dataDir:dir,getData:()=>data,run:async(_bin,args)=>{calls++;const input=JSON.parse(await readFile(args[args.indexOf('--input')+1],'utf8'));assert.equal(input[0].articles[0].url,'https://a.test/report');await new Promise(r=>setTimeout(r,10));}});
 const [a,b]=await Promise.all([search('小众香水'),search('小众香水')]);assert.equal(calls,1);assert.equal(a.reportUrl,b.reportUrl);await search('小众香水');assert.equal(calls,1);await assert.rejects(search(' '));
});
test('China-only uses story geography across the complete curated collection before pagination',async()=>{
 assert.equal(chinaStory({title:'Nike在上海推出限时体验空间'}),true);
 assert.equal(chinaStory({title:'中国品牌安踏在纽约开设门店'}),false);
 assert.equal(chinaStory({title:'安踏在纽约开设门店',excerpt:'中国运动品牌的新动作'}),false);
 assert.equal(chinaStory({title:'品牌创意观察',publisher:'中国品牌日报'}),false);
 const domestic=Array.from({length:30},(_,i)=>({id:'cn'+i,title:'品牌在上海推出新空间 '+i,publishedAt:'2026-11-16'}));
 const data={feed:{topics:[]},curated:{all:[{id:'us',title:'美国品牌在纽约开店',publishedAt:'2026-11-17'}],spaces:domestic}};
 assert.equal(curatedSelection(data.curated,'all',true).length,30);
 const f=createPreviewFetch(data),r=await(await f('/api/curated?region=china&page=2')).json();assert.equal(r.items.length,6);assert.equal(r.hasMore,false);
});
test('research search returns ten dated market reports, excludes hotlist pointers and unrelated launches',()=>{
 const now=Date.parse('2026-11-17'),base={source:'research-iimedia',publisher:'艾媒咨询',contentType:'research-report'};
 const rows=Array.from({length:12},(_,n)=>({...base,id:String(n),title:'亚文化品牌消费研究报告 '+n,url:'https://a.test/'+n,publishedAt:new Date(now-n*86400000).toISOString()}));
 const result=searchResearch([...rows,{...base,id:'hot',title:'亚文化热搜',contentType:'hot-topic'},{...base,id:'unrelated',title:'农业机械行业报告',publishedAt:'2026-11-16',url:'https://a.test/other'}],{query:'亚文化',now});
 assert.equal(result.articles.length,10);assert.equal(result.total,12);assert.equal(result.articles[0].id,'0');assert.equal(searchResearch(rows,{query:'香水',now}).total,0);
 const business={id:'genz',source:'pulse-glossy',title:'How a retailer is using Gen Z shopping data',excerpt:'A holiday campaign based on shopping research.',url:'https://a.test/genz',publishedAt:'2026-11-16'};
 assert.equal(searchResearch([business],{query:'亚文化',now}).articles.length,1);
 const incidental={...business,id:'beauty',title:'Beauty Briefing: skin undertone analysis',excerpt:'This week also includes fragrance news.'};
 assert.equal(searchResearch([incidental],{query:'香水',now}).articles.length,0);
 assert.equal(normalizeResearchItem({origin:'trendradar-rss',publishedAt:'2026-11-16T05:00:00'}).publishedAt,'2026-11-16T05:00:00Z');
 assert.equal(normalizeResearchItem({origin:'publisher-report',publishedAt:'2026-11-16T05:00:00+08:00'}).publishedAt,'2026-11-16T05:00:00+08:00');
});
test('cloud collector runs without visitors, avoids overlap, retries failure and retains last successful data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cue-worker-'));await writeFile(join(dir,'content-data.json'),'previous');let calls=0,release;
 const worker=createPublicWorker({dataDir:dir,intervalMs:20,run:()=>{calls++;return new Promise((_,reject)=>{release=()=>reject(Error('source offline'));});}});
 const first=worker.start();await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);assert.equal(await worker.refresh(),false);release();await first;
 await new Promise(r=>setTimeout(r,45));assert.equal(calls,2);worker.stop();release();await new Promise(r=>setTimeout(r,10));assert.equal(await readFile(join(dir,'content-data.json'),'utf8'),'previous');assert.equal(worker.state.lastError,'source offline');
});
test('cloud serves persisted shared data and China filter without platform login',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cue-public-'));await writeFile(join(dir,'content-data.json'),JSON.stringify({generatedAt:'2026-11-17',feed:{items:[{id:'test'}],topics:[],publicPulse:{researchItems:[]}},reports:{reports:[]},curated:{all:[{id:'cn',title:'品牌在上海开店',publishedAt:'2026-11-16'}]}}));
 const r=await startPublicServer({dataDir:dir,port:0,collect:false,authRequired:false});try{const base='http://127.0.0.1:'+r.server.address().port;assert.equal((await(await fetch(base+'/api/health')).json()).ok,true);assert.equal((await(await fetch(base+'/api/curated?region=china')).json()).items.length,1);assert.equal((await fetch(base+'/api/refresh',{method:'POST'})).status,405);}finally{await r.close();}
});
