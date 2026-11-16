import {build} from 'vite';
import {writeFile,mkdir,readFile,cp} from 'node:fs/promises';
import {createUrls} from '../src/urls.js';
const apiOrigin=process.env.VITE_API_ORIGIN;
const base=process.env.PAGES_BASE||'/cue-marketing/';
const preview=process.env.VITE_PREVIEW==='true';
if(!apiOrigin&&!preview)throw Error('请设置公开 HTTPS 后台地址 VITE_API_ORIGIN；Pages 不能运行采集后台');
if(preview){const data=JSON.parse(await readFile('.artifacts/preview-export/preview-data.json','utf8'));process.env.VITE_PREVIEW_AT=String(Date.parse(data.generatedAt));}
createUrls({apiOrigin,base});
const outDir='.artifacts/pages-site';
await build({base,build:{outDir,emptyOutDir:true,sourcemap:false}});
await mkdir(outDir,{recursive:true});
await writeFile(outDir+'/.nojekyll','');
if(preview){await cp('.artifacts/preview-export/preview-data.json',outDir+'/preview-data.json');await cp('.artifacts/preview-export/media',outDir+'/media',{recursive:true});}
console.log(preview?`预览文件已生成：${outDir}，不启动自动采集。`:`Pages 文件已生成：${outDir}；发布前须确认 ${apiOrigin}/api/health 及跨域访问可用。`);
