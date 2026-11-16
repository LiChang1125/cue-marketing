import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDouyinGate,RENDER_TIMEOUT_MS,waitForDouyinCards,douyinTimeoutMessage} from '../adapters/zhichao-sources/douyin-search.js';
import {cliFailure} from '../server/cli.js';

test('抖音图片验证与登录区分，营销正文的验证措辞不误判',()=>{
  assert.equal(detectDouyinGate('验证码中间页',''),'verification_required');
  assert.equal(detectDouyinGate('抖音搜索','点击两个形状相同的物体'),'verification_required');
  assert.equal(detectDouyinGate('抖音搜索','请先登录'),'login_wall');
  assert.equal(detectDouyinGate('品牌联名 - 抖音','品牌用实验验证产品效果，登录抖音'),null);
  assert.match(cliFailure({error:{code:'COMMAND_EXECUTION_ERROR',message:'Douyin verification_required: complete the platform verification in the administrator browser.'}}),/人工验证/);
  assert.ok(RENDER_TIMEOUT_MS<30000);
});

test('抖音加载超时不误报为需要重新登录',()=>{
  const message=cliFailure({error:{code:'COMMAND_EXECUTION_ERROR',message:douyinTimeoutMessage({readyState:'complete',resultLists:1,videoLinks:0,visibleFrames:0})}});
  assert.doesNotMatch(message,/登录|人工验证/);
  const diagnostic=douyinTimeoutMessage({readyState:'private-value',resultLists:'private-value',videoLinks:2,visibleFrames:0});
  assert.match(diagnostic,/videoLinks=2/);
  assert.doesNotMatch(diagnostic,/private-value/);
});

test('慢速页面只追加一次等待，验证与登录限制不重试',async()=>{
  let calls=0;
  const rendered={state:'rendered',cards:[{href:'/video/123'}]};
  assert.deepEqual(await waitForDouyinCards({evaluate:async()=>++calls===1?{state:'timeout'}:rendered}),rendered);
  assert.equal(calls,2);
  for(const state of ['login_wall','verification_required','empty']){
    calls=0;
    assert.deepEqual(await waitForDouyinCards({evaluate:async()=>{calls++;return {state};}}),{state});
    assert.equal(calls,1);
  }
  calls=0;
  assert.deepEqual(await waitForDouyinCards({evaluate:async()=>{calls++;return {state:'timeout'};}}),{state:'timeout'});
  assert.equal(calls,2);
});
