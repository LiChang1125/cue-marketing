import test from 'node:test';
import assert from 'node:assert/strict';
import {detectDouyinGate,RENDER_TIMEOUT_MS} from '../adapters/zhichao-sources/douyin-search.js';
import {cliFailure} from '../server/cli.js';

test('抖音图片验证与登录区分，营销正文的验证措辞不误判',()=>{
  assert.equal(detectDouyinGate('验证码中间页',''),'verification_required');
  assert.equal(detectDouyinGate('抖音搜索','点击两个形状相同的物体'),'verification_required');
  assert.equal(detectDouyinGate('抖音搜索','请先登录'),'login_wall');
  assert.equal(detectDouyinGate('品牌联名 - 抖音','品牌用实验验证产品效果，登录抖音'),null);
  assert.match(cliFailure({error:{code:'COMMAND_EXECUTION_ERROR',message:'Douyin verification_required: complete the platform verification in the administrator browser.'}}),/人工验证/);
  assert.ok(RENDER_TIMEOUT_MS<30000);
});
