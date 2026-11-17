import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {withDailyReport,createPublicationStore} from '../server/publication-store.js';
const data=()=>({feed:{items:[{id:'a',source:'socialbeta',title:'品牌推出香水联名新品',url:'https://socialbeta.com/campaign/12345',publishedAt:'2026-11-16T08:00:00Z'}]},reports:{reports:[]},generatedAt:'2026-11-16T23:55:00Z'});
test('daily report becomes due at Shanghai 08:00, uses yesterday and is idempotent',()=>{
 const original=data();assert.equal(withDailyReport(original,new Date('2026-11-16T23:59:59Z')),original);
 const result=withDailyReport(original,new Date('2026-11-17T00:00:00Z'));assert.equal(result.reports.reports[0].date,'2026-11-17');assert.equal(result.reports.reports[0].newsDate,'2026-11-16');assert.equal(result.reports.reports[0].entries.length,1);
 assert.equal(withDailyReport(result,new Date('2026-11-17T01:00:00Z')),result);
 const empty=withDailyReport({feed:{items:[]}},new Date('2026-11-17T01:00:00Z'));assert.equal(empty.reports.reports[0].status,'insufficient');assert.equal(withDailyReport(empty,new Date('2026-11-17T01:01:00Z')),empty);
 const recovered=withDailyReport({...empty,feed:data().feed},new Date('2026-11-17T01:02:00Z'));assert.equal(recovered.reports.reports[0].status,'ready');assert.equal(recovered.reports.reports.length,1);
});
test('autonomous report survives a concurrent collection carrying an older archive and restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cue-publication-')),path=join(dir,'data.json');
 try{const store=createPublicationStore({initial:data(),path,now:()=>new Date('2026-11-17T00:00:00Z')});
 await Promise.all([store.publish(),store.publish({...data(),generatedAt:'2026-11-17T00:01:00Z'})]);
 const saved=JSON.parse(await readFile(path,'utf8'));assert.equal(saved.reports.reports.length,1);assert.equal(saved.generatedAt,'2026-11-17T00:01:00Z');
 const restored=createPublicationStore({initial:saved,path,now:()=>new Date('2026-11-17T02:00:00Z')});assert.equal(await restored.publish(),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
