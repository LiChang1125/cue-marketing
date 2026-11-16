import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourcePageRouter} from '../server/source-pages.js';

function fixture(initial=[]){
  let sequence=0;const pages=[];
  const add=url=>{const page={id:String(++sequence),closed:false,url:()=>url,isClosed(){return this.closed;}};pages.push(page);return page;};
  initial.forEach(add);
  const context={pages:()=>pages,newPage:async()=>add('about:blank'),newCDPSession:async page=>({send:async()=>({targetInfo:{targetId:page.id}}),detach:async()=>{}})};
  const fetcher=async()=>new Response(JSON.stringify(pages.filter(p=>!p.closed).map(p=>({id:p.id,type:'page',webSocketDebuggerUrl:`ws://127.0.0.1:9222/devtools/page/${p.id}`}))));
  return {pages,router:createSourcePageRouter(context,{fetcher}),context};
}
test('采集其他来源不复用抖音验证页，同一来源重复采集使用同一页',async()=>{
  const {router,pages}=fixture(['https://www.douyin.com/search/品牌联名']);
  const douyin=await router.endpointFor('douyin');
  const xhs=await router.endpointFor('xiaohongshu');
  assert.notEqual(douyin,xhs);assert.equal(pages.length,2);
  assert.equal(await router.endpointFor('douyin'),douyin);
  assert.equal(await router.endpointFor('xiaohongshu'),xhs);
  assert.equal(pages[0].url(),'https://www.douyin.com/search/品牌联名');
});
test('同来源并发合并，用户关闭采集页后自动补建',async()=>{
  const {router,pages}=fixture(['about:blank']);
  const [a,b]=await Promise.all([router.endpointFor('weibo'),router.endpointFor('weibo')]);
  assert.equal(a,b);assert.equal(pages.length,1);
  pages[0].closed=true;
  assert.notEqual(await router.endpointFor('weibo'),a);assert.equal(pages.length,2);
  await assert.rejects(router.endpointFor('unknown'),/未知/);
});
test('采集页连接只允许服务器本地调试端口，不接受外部目标',async()=>{
  const {context}=fixture(['about:blank']);
  const router=createSourcePageRouter(context,{fetcher:async()=>new Response(JSON.stringify([{id:'1',type:'page',webSocketDebuggerUrl:'ws://example.com:9222/devtools/page/1'}]))});
  await assert.rejects(router.endpointFor('douyin'),/地址无效/);
});
