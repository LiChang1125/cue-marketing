import {createHash} from 'node:crypto';
import {access,copyFile,cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {editorialUI} from '../integrations/hot-monitor/editorial-ui.mjs';
import {prepareLast30} from '../integrations/hot-monitor/setup-last30.mjs';

const revision='cd48b0885bfa8ae9c8043cf78ef6cfd045530bdb';
const checksum='2d303c03ebe37651e75b4dce301dc8a2fb00c621d4b9a0d6d6fbe771a6c1f96b';
const root=resolve('.tools','hot-monitor',revision), archive=join(root,'upstream.tgz');
const server=join(root,'server'),client=join(root,'client');
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(bin,args,cwd,env={}) {
  const result=spawnSync(bin,args,{cwd,stdio:'inherit',windowsHide:true,shell:bin==='npm.cmd',env:{...process.env,...env}});
  if(result.error||result.status!==0)throw Error('Hot Monitor build failed: '+bin+' '+args.join(' '));
}
async function exists(path){try{await access(path);return true;}catch{return false;}}
await mkdir(root,{recursive:true});
await prepareLast30();
if(!await exists(archive)){
  const res=await fetch('https://codeload.github.com/liyupi/yupi-hot-monitor/tar.gz/'+revision,{signal:AbortSignal.timeout(60000)});
  if(!res.ok)throw Error('Cannot download upstream '+res.status);
  const bytes=Buffer.from(await res.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==checksum)throw Error('Upstream checksum mismatch');
  await writeFile(archive,bytes);
}
if(createHash('sha256').update(await readFile(archive)).digest('hex')!==checksum)throw Error('Unexpected source archive');
run('tar',['-xzf',archive,'--strip-components=1','-C',root],root);
for(const cwd of [client,server]){
  const lock=join(cwd,'package-lock.json');
  await writeFile(lock,(await readFile(lock,'utf8')).replaceAll('https://registry.npmmirror.com/','https://registry.npmjs.org/'));
  if(!await exists(join(cwd,'.cue-installed'))){
    run(npm,['ci','--include=dev','--no-audit','--no-fund'],cwd,{PRISMA_SKIP_POSTINSTALL_GENERATE:'true'});
    await writeFile(join(cwd,'.cue-installed'),revision);
  }
}
const file=(name)=>join(client,'src',name);
async function edit(path,from,to){
  const text=await readFile(path,'utf8');
  if(!text.includes(from))throw Error('Unexpected pinned source: '+path);
  await writeFile(path,text.replace(from,to));
}
await edit(file('services/api.ts'),"const API_BASE = '/api';","const API_BASE = '/api/hot-monitor';");
await edit(file('services/socket.ts'),"path: '/socket.io'","path: '/api/hot-monitor/socket.io'");
await edit(file('App.tsx'),'HotPulse</h1>','脉动</h1>');
await edit(file('App.tsx'),'AI 热点雷达</p>','品牌与文化观察</p>');
const appSource=await readFile(file('App.tsx'),'utf8');
await writeFile(file('App.tsx'),appSource
  .replaceAll('>AI 摘要</span>',">{hotspot.relevanceReason?.includes('未配置 AI') ? '原文摘录' : 'AI 摘要'}</span>")
  .replace('AI 分析理由\n',"{hotspot.relevanceReason?.includes('未配置 AI') ? '匹配依据' : 'AI 分析理由'}\n"));
await edit(file('App.tsx'),'输入要监控的关键词，如：GPT-5、AI编程、Cursor...','输入品牌、IP 或营销主题');
await edit(file('App.tsx'),'onClick={() => setShowNotifications(!showNotifications)}','aria-label="通知" onClick={() => setShowNotifications(!showNotifications)}');
await edit(file('App.tsx'),'onClick={() => handleToggleKeyword(keyword.id)}','aria-label={keyword.isActive ? "暂停监控" : "恢复监控"} onClick={() => handleToggleKeyword(keyword.id)}');
await edit(file('App.tsx'),'onClick={() => handleDeleteKeyword(keyword.id)}','aria-label="删除监控词" onClick={() => handleDeleteKeyword(keyword.id)}');
await edit(file('App.tsx'),'      <BackgroundBeams className="z-0" />','');
await edit(file('App.tsx'),'      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="#3b82f6" />','');
await edit(file('App.tsx'),'<Meteors number={6} />','');
await edit(file('components/FilterSortBar.tsx'),'flex items-center gap-1 bg-white/[0.03]','cue-sort flex items-center gap-1 bg-white/[0.03]');
for(const path of [file('App.tsx'),file('components/FilterSortBar.tsx')])await writeFile(path,editorialUI(await readFile(path,'utf8')));
await copyFile('integrations/hot-monitor/theme.css',file('cue.css'));
await copyFile('integrations/hot-monitor/ResearchBrief.tsx',file('ResearchBrief.tsx'));
await edit(file('main.tsx'),"import './index.css'","import './index.css'\nimport './cue.css'");
await edit(join(client,'index.html'),'lang="en"','lang="zh-CN"');
await edit(join(client,'index.html'),'<title>client</title>','<title>脉动 · CUE</title>');
await edit(join(client,'index.html'),'href="/vite.svg"','href="../favicon.svg"');
run(process.execPath,['node_modules/vite/bin/vite.js','build','--base','./'],client);
const staticDir=resolve('.artifacts/hot-monitor-site');
run(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir','.artifacts/hot-monitor-site'],process.cwd(),{VITE_NATIVE_HOT_MONITOR:'true'});
await cp(join(client,'dist'),join(staticDir,'hot-monitor'),{recursive:true});
const prismaEnv={DATABASE_URL:'file:./preview.db'};
const generated=join(server,'node_modules/.prisma/client/index.js');
const marker=join(server,'.cue-prisma-generated');
if(!await exists(generated)||!await exists(marker)){
  run(process.execPath,['node_modules/prisma/build/index.js','generate'],server,prismaEnv);
  await writeFile(marker,revision);
}
await copyFile('integrations/hot-monitor/runtime.ts',join(server,'src/cue.ts'));
const {build}=await import(pathToFileURL(join(server,'node_modules/esbuild/lib/main.js')));
await build({entryPoints:[join(server,'src/cue.ts')],platform:'node',bundle:true,packages:'external',format:'esm',outfile:join(server,'cue.mjs')});
console.log('Hot Monitor ready at '+root);

