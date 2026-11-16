import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDouyinTrial} from '../server/douyin-trial.js';

const path='/api/v1/douyin/search/fetch_video_search_v2',url='https://api.tikhub.io'+path;
const init={method:'POST',headers:{Authorization:'Bearer fixture-secret'}};
test('one-time 20-request trial survives restart and competing workers; failures consume budget',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'cue-trial-'));let paid=0;
  const fetcher=async(u,options)=>{
    if(u.pathname!==path){assert.equal(options.headers,undefined);return Response.json({data:{endpoint_uri:path,endpoint_cost:0.01}});}
    paid++;return new Response(null,{status:503});
  };
  const first=createDouyinTrial({directory,fetcher});
  try{
    for(let i=0;i<3;i++)await first.fetcher(url,init);
    first.close();
    const a=createDouyinTrial({directory,fetcher}),b=createDouyinTrial({directory,fetcher});
    try{
      const attempts=await Promise.allSettled(Array.from({length:25},(_,i)=>(i%2?a:b).fetcher(url,init)));
      assert.equal(attempts.filter(r=>r.status==='fulfilled').length,17);
      assert.equal(paid,20);assert.equal(a.attempts(),20);assert.equal(b.attempts(),20);
    }finally{a.close();b.close();}
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('unapproved URLs, price increases and unavailable pricing never make paid calls',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'cue-trial-'));let price=0.02,paid=0;
  const trial=createDouyinTrial({directory,fetcher:async u=>{
    if(u.pathname===path){paid++;return Response.json({});}
    return Response.json({data:{endpoint_uri:path,endpoint_cost:price}});
  }});
  try{
    await assert.rejects(trial.fetcher('https://example.com'+path,init),/仅允许/);
    await assert.rejects(trial.fetcher(url,init),/价格超出/);
    price=null;
    await assert.rejects(trial.fetcher(url,init),/价格超出/);
    assert.equal(paid,0);assert.equal(trial.attempts(),0);
  }finally{trial.close();rmSync(directory,{recursive:true,force:true});}
});
