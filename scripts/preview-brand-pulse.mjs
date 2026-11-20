import {startPublicServer} from '../server/public-server.js';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const python=process.platform==='win32'?'.tools/python/Scripts/python.exe':'.tools/python/bin/python';
if(!process.env.PYTHON&&existsSync(python))process.env.PYTHON=resolve(python);
process.env.COLLECT_INTERVAL_MS||='300000';
const app=await startPublicServer({host:'127.0.0.1',port:4387,dataDir:'.artifacts/hot-monitor-preview',accountsFile:'.artifacts/accounts/cloud-accounts.json',collect:true,pollPublishers:true});
console.log('CUE 本机预览 http://127.0.0.1:4387/#pulse');
for(const s of ['SIGINT','SIGTERM'])process.once(s,async()=>{await app.close();process.exit(0);});
