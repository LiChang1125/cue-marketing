import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {platformProvider,platformEnabled,createPlatformClient} from '../server/platform-api.js';
import {collectCli} from '../server/cli.js';

test('Douyin paid routing preserves four browser sources and fails closed without a key',()=>{
  const env={PLATFORM_PROVIDER:'selfhosted',DOUYIN_PROVIDER:'tikhub'};
  assert.equal(platformProvider('douyin',env),'tikhub');
  assert.equal(platformEnabled('douyin',env),false);
  for(const source of ['xiaohongshu','bilibili-cli','weibo','zhihu']){
    assert.equal(platformProvider(source,env),'selfhosted');
    assert.equal(platformEnabled(source,env),true);
  }
  assert.equal(platformEnabled('douyin',{...env,TIKHUB_API_KEY:'test'}),true);
  assert.equal(platformEnabled('douyin',{...env,DOUYIN_PROVIDER:'typo'}),false);
  assert.equal(platformEnabled('douyin',{...env,DOUYIN_PROVIDER:'tikhub-trial',TIKHUB_API_KEY:'test'}),true);
  assert.equal(platformEnabled('xiaohongshu',{PLATFORM_PROVIDER:'tikhub-trial',TIKHUB_API_KEY:'test'}),false);
});

test('paid collector records searchable data, preserves observation age and never falls back to a browser',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'cue-hybrid-'));
  const names=['PLATFORM_PROVIDER','DOUYIN_PROVIDER','TIKHUB_API_KEY','DATA_DIR','PLATFORM_DAILY_REQUEST_LIMIT'];
  const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  const previousFetch=globalThis.fetch;let calls=0,fail=false;
  Object.assign(process.env,{PLATFORM_PROVIDER:'selfhosted',DOUYIN_PROVIDER:'tikhub',TIKHUB_API_KEY:'test-only-secret',DATA_DIR:directory,PLATFORM_DAILY_REQUEST_LIMIT:'3'});
  // Even a paused browser must not intercept API collection.
  writeFileSync(join(directory,'collector.pause'),'paused');
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(url.origin,'https://api.tikhub.io');
    assert.equal(init.headers.Authorization,'Bearer test-only-secret');
    assert.equal(JSON.parse(init.body).keyword,fail?'潮玩':'香水');
    if(fail)return new Response('test-only-secret',{status:401});
    return Response.json({code:200,data:{business_data:[{data:{aweme_info:{aweme_id:'123456',desc:'香水品牌推出联名系列',create_time:1794787200,statistics:{digg_count:42,comment_count:5}}}}]}});
  };
  try{
    const items=await collectCli('douyin',new Date().toISOString(),'香水');
    assert.deepEqual(items.collectionInfo,{backend:'tikhub',scope:'search',supportsSearch:true});
    assert.equal(items[0].metrics.likes,42);assert.equal(items[0].metrics.views,null);
    const cached=await collectCli('douyin','2099-01-01T00:00:00Z','香水');
    assert.equal(cached[0].metricAt,items[0].metricAt);assert.equal(calls,1);
    assert.ok(!JSON.stringify(items).includes('test-only-secret'));
    fail=true;
    await assert.rejects(collectCli('douyin',new Date().toISOString(),'潮玩'),e=>/密钥或权限/.test(e.message)&&!e.message.includes('test-only-secret'));
    assert.equal(calls,2);
  }finally{
    globalThis.fetch=previousFetch;
    for(const name of names)if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];
    rmSync(directory,{recursive:true,force:true});
  }
});

test('paid budget fails closed on invalid limits or damaged ledgers, and resets at Beijing midnight',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'cue-budget-'));let calls=0;
  const env={TIKHUB_API_KEY:'test',PLATFORM_DAILY_REQUEST_LIMIT:'1'};
  let time=Date.parse('2026-11-16T15:59:00Z');
  const fetcher=async()=>{calls++;return Response.json({code:200,data:{business_data:[]}});};
  try{
    for(const limit of ['0','bad','-1'])await assert.rejects(createPlatformClient({env:{...env,PLATFORM_DAILY_REQUEST_LIMIT:limit},fetcher}).search('douyin','香水'),/额度/);
    assert.equal(calls,0);
    await createPlatformClient({env,directory,fetcher,now:()=>time}).search('douyin','香水');
    await assert.rejects(createPlatformClient({env,directory,fetcher,now:()=>time}).search('douyin','潮玩'),/额度/);
    time+=120000;
    await createPlatformClient({env,directory,fetcher,now:()=>time}).search('douyin','潮玩');
    assert.equal(calls,2);
    assert.deepEqual(JSON.parse(readFileSync(join(directory,'platform-budget.json'),'utf8')),{day:'2026-11-17',count:1});
    writeFileSync(join(directory,'platform-budget.json'),'{damaged');
    await assert.rejects(createPlatformClient({env,directory,fetcher}).search('douyin','品牌'),/额度记录不可用/);
    assert.equal(calls,2);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
