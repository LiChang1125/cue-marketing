import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createUrls} from '../src/urls.js';
import {publicCors} from '../server/cors.js';
import {createPreviewFetch} from '../src/preview.js';

test('预览搜索只索引快照，切换分类和历史不会调用采集后台',async()=>{
  const read=createPreviewFetch({generatedAt:'2026-11-16T14:00:00Z',feed:{items:[],topics:[],sources:[]},reports:{reports:[{date:'2026-11-16',entries:[]}]},histories:{one:[{at:'2026-11-16T14:00:00Z',likes:42}]},curated:{cases:Array.from({length:25},(_,id)=>({id}))}});
  const topic=await(await read('/api/topics',{method:'POST',body:JSON.stringify({query:'香水'})})).json();
  assert.equal((await(await read('/api/feed')).json()).topics[0].id,topic.id);
  assert.equal((await(await read('/api/topics',{method:'POST',body:JSON.stringify({query:'香水'})})).json()).id,topic.id);
  assert.equal((await(await read('/api/curated?kind=cases&page=1')).json()).hasMore,true);
  assert.equal((await(await read('/api/curated?kind=cases&page=2')).json()).items.length,1);
  assert.equal((await(await read('/api/items/one/history')).json()).points[0].likes,42);
  assert.equal((await(await read('/api/attention?query=香水')).json()).platforms.length,0);
  assert.equal((await read('/api/refresh',{method:'POST'})).status,405);
});

test('Pages 子路径静态资源与跨域 API、媒体正确分离',()=>{
  const urls=createUrls({apiOrigin:'https://cuefankeji.cn',base:'/cue-web/'});
  assert.equal(urls.asset('/covers/brand.png'),'/cue-web/covers/brand.png');
  assert.equal(urls.asset('/'),'/cue-web/');
  assert.equal(urls.api('/api/attention?query=%E9%A6%99%E6%B0%B4'),'https://cuefankeji.cn/api/attention?query=%E9%A6%99%E6%B0%B4');
  assert.equal(urls.media('/media/example.webp'),'https://cuefankeji.cn/media/example.webp');
  assert.equal(urls.media('https://example.com/cover.jpg'),'https://example.com/cover.jpg');
  assert.equal(createUrls().api('/api/feed'),'/api/feed');
  for(const value of ['http://localhost:4173','https://user:pass@example.com','https://example.com/api','https://example.com?key=secret'])assert.throws(()=>createUrls({apiOrigin:value}));
});

test('仅允许指定 Pages 来源读取和搜索，拒绝管理员预检权限',async()=>{
  const app=express(),cors=publicCors('https://lichang1125.github.io');
  app.use('/api',cors.middleware);
  app.get('/api/feed',(_,res)=>res.json({items:[]}));
  app.post('/api/topics',(_,res)=>res.json({id:'topic'}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const origin='https://lichang1125.github.io';
    let r=await fetch(base+'/api/feed',{headers:{Origin:origin}});
    assert.equal(r.headers.get('access-control-allow-origin'),origin);
    assert.equal(r.headers.get('access-control-allow-credentials'),null);
    r=await fetch(base+'/api/topics',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
    assert.equal(r.status,204);
    r=await fetch(base+'/api/topics',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
    assert.equal(r.headers.get('access-control-allow-origin'),origin);
    for(const [path,headers] of [['/api/feed',{Origin:'https://untrusted.example'}],['/api/refresh',{Origin:origin,'Access-Control-Request-Method':'POST'}],['/api/topics',{Origin:origin,'Access-Control-Request-Method':'PATCH'}]]){
      r=await fetch(base+path,{method:path==='/api/feed'?'GET':'OPTIONS',headers});
      assert.equal(r.headers.get('access-control-allow-origin'),null);
    }
    r=await fetch(base+'/api/topics',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization'}});
    assert.equal(r.status,403);
    assert.equal(cors.trusted('https://lichang1125.github.io.attacker.example'),false);
  }finally{await new Promise(r=>server.close(r));}
});
