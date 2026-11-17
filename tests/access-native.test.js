import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {startPublicServer} from '../server/public-server.js';
import {previewLogin} from '../shared/preview-auth.js';
import {featuredNews} from '../shared/featured.js';

test('preview account records reject unknown users and wrong passwords without publishing a roster',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cue-auth-')),roster=join(dir,'roster.json'),accounts=join(dir,'accounts.json'),preview=join(dir,'preview.json');
 await writeFile(roster,JSON.stringify([{username:'testmember',name:'测试成员',password:'sample-pass'}]));
 const run=spawnSync(process.execPath,['scripts/provision-accounts.mjs',roster,accounts,preview],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const text=await readFile(preview,'utf8');assert.ok(!text.includes('测试成员')&&!text.includes('testmember')&&!text.includes('sample-pass'));
 const records=JSON.parse(text);assert.equal((await previewLogin(records,' TestMember ','sample-pass')).name,'测试成员');await assert.rejects(previewLogin(records,'testmember','wrong'));await assert.rejects(previewLogin(records,'unknown','sample-pass'));
 const privateData=await readFile(accounts,'utf8');assert.ok(!privateData.includes('sample-pass'));
});

test('cloud requires server session for feeds, data, native reports and media; logout invalidates it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cue-private-')),roster=join(dir,'roster.json'),accounts=join(dir,'accounts.json');
 await writeFile(roster,JSON.stringify([{username:'tester',name:'测试',password:'sample-pass'}]));spawnSync(process.execPath,['scripts/provision-accounts.mjs',roster,accounts]);
 await writeFile(join(dir,'content-data.json'),JSON.stringify({generatedAt:'2026-11-17',feed:{items:[{id:'test'}],topics:[]},curated:{all:[]},reports:{reports:[]}}));
 const runtime=await startPublicServer({dataDir:dir,port:0,collect:false,accountsFile:accounts});
 try{const base='http://127.0.0.1:'+runtime.server.address().port;
 for(const path of ['/api/feed','/content-data.json','/trendradar/index.html','/research/test.html','/media/test.jpg'])assert.equal((await fetch(base+path)).status,401,path);
 const login=(username,password,origin)=>fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({username,password})});
 assert.equal((await login('tester','wrong')).status,401);assert.equal((await login('tester','sample-pass','https://evil.example')).status,403);
 const r=await login('tester','sample-pass');assert.equal(r.status,200);const header=r.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);const cookie=header.split(';')[0];
 assert.equal((await fetch(base+'/api/feed',{headers:{Cookie:cookie}})).status,200);assert.equal((await(await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json()).user.name,'测试');
 await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:cookie}});assert.equal((await fetch(base+'/api/feed',{headers:{Cookie:cookie}})).status,401);
 for(let i=0;i<10;i++)await login('missing','wrong');assert.equal((await login('missing','wrong')).status,429);
 }finally{await runtime.close();}
});

test('hero selects only recent verified original covers and replaces a failed image',()=>{
 const now=Date.parse('2026-11-17T12:00:00Z'),base={publishedAt:'2026-11-17T01:00:00Z',imageOrigin:'https://publisher.test/photo.jpg',imageLocal:'/media/photo.jpg'};
 const rows=[{...base,id:'theme',imageLocal:'/covers/brand.png'},{...base,id:'remote',imageLocal:null},...[1,2,3,4].map(n=>({...base,id:String(n)})),{...base,id:'old',publishedAt:'2025-01-01'}];
 assert.deepEqual(featuredNews(rows,now).map(i=>i.id),['1','2','3']);assert.deepEqual(featuredNews(rows,now,['1']).map(i=>i.id),['2','3','4']);
});
