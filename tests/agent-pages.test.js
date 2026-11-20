import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('the public connector negotiates stdio, validates calls, and searches the published feed',()=>{
  const feed={generatedAt:'2026-11-20T00:00:00Z',items:[{title:'露营品牌推出新帐篷',publishedAt:new Date().toISOString(),publisher:'测试',url:'https://example.org/camp'},{title:'咖啡快闪',url:'https://example.org/coffee'}]};
  const script='globalThis.fetch=async()=>Response.json('+JSON.stringify(feed)+');await import("./public/agent/cue-agent.mjs")';
  const calls=[['initialize',{protocolVersion:'2025-06-18'}],['tools/list',{}],['tools/call',{name:'search_articles',arguments:{query:'帐篷'}}],['tools/call',{name:'latest_articles',arguments:{limit:0}}]];
  const input=calls.map(([method,params],id)=>JSON.stringify({jsonrpc:'2.0',id,method,params})).join('\n')+'\n';
  const run=spawnSync(process.execPath,['--input-type=module','-e',script],{input,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const replies=run.stdout.trim().split('\n').map(JSON.parse).sort((a,b)=>a.id-b.id);
  assert.equal(replies[0].result.protocolVersion,'2025-06-18');
  assert.equal(replies[1].result.tools.length,3);
  assert.equal(JSON.parse(replies[2].result.content[0].text).items[0].url,feed.items[0].url);
  assert.equal(replies[3].error.code,-32602);
});
