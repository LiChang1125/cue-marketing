import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {articleMetadata,createArticleService,publicUrl} from '../server/articles.js';
import {editorialFeed} from '../server/editorial.js';
import {originalHref} from '../shared/original.js';
import {normalizeCli} from '../server/cli.js';
const now=Date.parse('2026-11-16T08:00:00Z');
const row=(id,source='socialbeta',extra={})=>({id,title:'品牌推出联名新品系列 '+id,source,url:'https://example.com/news/'+id,publishedAt:'2026-11-16T00:00:00Z',imageLocal:'/media/picture.jpg',metrics:{},...extra});
test('精选解出实际媒体链接，图片从原文元数据提取，忽略站点标志',()=>{
  const metadata=articleMetadata('<footer class="bs-curated-end"><a class="bs-read-link" href="https://hypebeast.com/story">阅读原文</a></footer><meta property="og:image" content="https://example.com/logo.png">','https://www.brandstar.com.cn/select/123/');
  assert.equal(metadata.originalUrl,'https://hypebeast.com/story');assert.deepEqual(metadata.images,[]);
  assert.equal(originalHref({url:'https://www.brandstar.com.cn/select/123/'}),null);
  assert.equal(originalHref({url:'https://www.brandstar.com.cn/articles/original/'}),'https://www.brandstar.com.cn/articles/original/');
  assert.equal(originalHref({url:'https://www.brandstar.com.cn/select/123/',originalUrl:metadata.originalUrl}),'https://hypebeast.com/story');
  assert.equal(publicUrl('javascript:alert(1)'),null);assert.equal(publicUrl('http://127.0.0.1/secret'),null);
  assert.equal(publicUrl(undefined,'https://example.com/story'),null);
});
test('平台正文原配图保留到内容记录，缺图不伪造封面地址',()=>{
  const at=new Date(now).toISOString();
  for(const [source,url] of [['weibo','https://weibo.com/123/abc'],['xiaohongshu','https://www.xiaohongshu.com/explore/abc']]){
    const [item]=normalizeCli([{title:'品牌联名新品',url,image:'https://images.example.com/news.jpg'}],source,at,'品牌联名');
    assert.equal(item.image,'https://images.example.com/news.jpg');
    assert.equal(normalizeCli([{title:'品牌联名新品',url}],source,at,'品牌联名')[0].image,null);
  }
});
test('首页选稿只接受有已缓存原图的相关近期案例，限制微博且排除促销碎片',()=>{
  const inputs=[...Array.from({length:20},(_,i)=>row('w'+i,'weibo')),...Array.from({length:8},(_,i)=>row('s'+i)),row('noimage','socialbeta',{imageLocal:null}),row('spam','weibo',{title:'品牌联名新品抽奖，转发抽优惠券'}),row('old','socialbeta',{publishedAt:'2025-01-01T00:00:00Z'}),row('random','bilibili-cli',{title:'军事战火'}),row('bs','brandstar')];
  const selected=editorialFeed(inputs,now);assert.ok(selected.length>=8);assert.ok(selected.every(i=>i.imageLocal));assert.equal(selected.filter(i=>i.source==='weibo').length,2);assert.ok(selected.slice(0,3).every(i=>i.source!=='weibo'));assert.ok(!selected.some(i=>['noimage','spam','old','random'].includes(i.id)));
});
test('原文配图写入持久缓存，后续读取与日报使用同一原文地址',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'cue-article-'));const picture=Buffer.alloc(1200);picture[0]=255;picture[1]=216;
  const fetcher=async url=>new Response(url.includes('photo.jpg')?picture:url.includes('/select/')?'<footer class="bs-curated-end"><a class="bs-read-link" href="https://media.example.com/story">原文</a></footer>':'<meta property="og:image" content="https://media.example.com/photo.jpg">');
  try{const service=createArticleService(dir,{fetcher}),item={id:'bs-123',url:'https://www.brandstar.com.cn/select/123/',metrics:{}};const result=await service.enrich(item);assert.equal(result.url,'https://media.example.com/story');assert.match(result.imageLocal,/^\/media\/[a-f0-9]+\.jpg$/);assert.equal(service.decorate({...item,section:'联名与 IP'}).url,result.url);await new Promise(r=>setTimeout(r,150));const restarted=createArticleService(dir,{fetcher});assert.equal(restarted.decorate(item).imageLocal,result.imageLocal);}finally{rmSync(dir,{recursive:true,force:true});}
});
