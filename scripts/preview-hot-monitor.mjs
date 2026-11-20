import {access,mkdir,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {startPublicServer} from '../server/public-server.js';
import {createChineseDisplay} from '../integrations/hot-monitor/chinese.mjs';
import {editorialMatches,marketingWeight} from '../integrations/hot-monitor/marketing.mjs';
import {createTopicBrief} from '../integrations/hot-monitor/topic-brief.mjs';

const serverDir=resolve('.tools/hot-monitor/cd48b0885bfa8ae9c8043cf78ef6cfd045530bdb/server');
const dataDir=resolve('.artifacts/hot-monitor-preview');
const accountsFile=process.env.CUE_ACCOUNTS_FILE||resolve('.artifacts/accounts/cloud-accounts.json');
await access(accountsFile);
await access(join(serverDir,'cue.mjs'));
await mkdir(dataDir,{recursive:true});
const database=join(dataDir,'monitor.db');
await (await open(database,'a')).close();
process.env.DATABASE_URL='file:'+database.replaceAll('\\','/');
// Run the local review with no paid integrations or outbound email, including
// when credentials for unrelated projects exist in the invoking shell.
for(const key of ['OPENROUTER_API_KEY','TWITTER_API_KEY','SMTP_HOST','SMTP_USER','SMTP_PASS','NOTIFY_EMAIL'])delete process.env[key];
const migrate=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{
  cwd:serverDir,env:process.env,stdio:'inherit',windowsHide:true
});
if(migrate.status!==0)throw Error('Cannot migrate the monitoring database');
const {mount}=await import(pathToFileURL(join(serverDir,'cue.mjs')));
const localize=createChineseDisplay(dataDir);
const port=Number(process.env.CUE_MONITOR_PORT||4387);
const runtime=await startPublicServer({host:'127.0.0.1',port,dataDir,accountsFile,authRequired:true,
  staticDir:resolve('.artifacts/hot-monitor-site'),collect:false,
  mountMonitor:(app,httpServer,authorize,feed)=>mount(app,httpServer,authorize,
    {localize,marketingWeight,topicBrief:createTopicBrief(feed,localize),editorialFor:query=>editorialMatches(feed(),query)})});
console.log('CUE local preview http://127.0.0.1:'+port+'/#pulse');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await runtime.close();process.exit(0);});
