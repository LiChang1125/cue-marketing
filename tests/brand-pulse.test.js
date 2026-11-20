import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';
import {installBrandPulse} from '../server/brand-pulse.js';

test('the third tab opens the native homepage inside the signed-in site',async t=>{
  async function serve(app){
    const server=app.listen(0,'127.0.0.1');
    await once(server,'listening');
    t.after(()=>new Promise(done=>server.close(done)));
    return 'http://127.0.0.1:'+server.address().port;
  }
  const reader=express();
  reader.get('/',(_,res)=>res.send('reader home'));
  reader.get('/_.data',(req,res)=>res.json(req.query));
  reader.get('/items/example',(_,res)=>res.send('reader story'));
  reader.get('/feed.xml',(_,res)=>res.type('xml').send('<rss/>'));
  reader.post('/api/mcp',express.json(),(req,res)=>res.json({method:req.body.method}));
  const origin=await serve(reader);
  const cue=express();
  cue.use(express.json());
  installBrandPulse(cue,{feed:()=>({items:[]}),dataDir:'.',origin,allowed:req=>req.headers['x-fixture-session']==='member'});
  cue.get('/',(_,res)=>res.send('CUE home'));
  const base=await serve(cue),headers={'x-fixture-session':'member'};
  assert.equal(await (await fetch(base)).text(),'CUE home');
  assert.equal((await fetch(base+'/?cueReader=pulse')).status,401);
  assert.equal(await (await fetch(base+'/?cueReader=pulse',{headers})).text(),'reader home');
  assert.equal(await (await fetch(base,{headers:{...headers,'sec-fetch-dest':'iframe'}})).text(),'reader home');
  assert.equal(await (await fetch(base+'/items/example',{headers})).text(),'reader story');
  assert.equal(await (await fetch(base+'/feed.xml',{headers})).text(),'<rss/>');
  for(const filter of ['channel=firstParty','category=collab']){
    const path='/_.data?cueReader=pulse&'+filter+'&_routes=routes%2Fhome';
    assert.equal((await fetch(base+path)).status,401);
    const data=await (await fetch(base+path,{headers})).json();
    assert.equal(data._routes,'routes/home');
    assert.equal(data[filter.split('=')[0]],filter.split('=')[1]);
  }
  const handshake=await fetch(base+'/api/mcp',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({method:'initialize'})});
  assert.deepEqual(await handshake.json(),{method:'initialize'});
  assert.equal((await fetch(base+'/admin',{headers})).status,404);
});

