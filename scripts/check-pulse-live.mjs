import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const site=process.env.PULSE_SITE||'https://lichang1125.github.io/cue-marketing/pulse/';
const topics=process.argv.slice(2);
if(!topics.length)topics.push('小红书爆款','露营','香水联名','巧克力','马拉松');
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:process.platform==='win32'?{channel:'chrome'}:{});
const results=[];
let cursor=0;
async function worker(){
 while(cursor<topics.length){
  const topic=topics[cursor++],page=await browser.newPage();
  const row={topic,checkedAt:new Date().toISOString(),site,externalResponses:[],examples:[],errors:[]};
  const hosts=new Set();
  page.on('response',r=>{const u=new URL(r.url());if(r.ok()&&u.origin!==new URL(site).origin&&['fetch','xhr'].includes(r.request().resourceType()))hosts.add(u.hostname);});
  page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(site+'#/hot',{waitUntil:'domcontentloaded',timeout:65000});
   const field=page.getByRole('searchbox');
   await field.fill(topic);await field.press('Enter');
   await page.waitForFunction(()=>[...document.querySelectorAll('main p')].some(p=>/共 \d+ 个案例/.test(p.textContent)&&!p.textContent.includes('正在联网检索')),null,{timeout:270000});
   const region=page.getByLabel('近期营销案例');
   row.summary=await region.locator('p').filter({hasText:/共 \d+ 个案例/}).first().innerText();
   row.examples=await region.locator('ol li').evaluateAll(items=>items.slice(0,8).map(item=>({title:item.querySelector('h3 a').textContent,original:item.querySelector('h3 a').href,sources:[...item.querySelectorAll('details a')].map(a=>a.href)})));
   row.externalResponses=[...hosts].sort();
   if(!row.examples.length||!row.externalResponses.length)row.errors.push('未验证到案例或外部响应');
  }catch(e){row.errors.push(e.message);}
  finally{await page.close();}
  console.log(topic,row.summary||'',row.errors.join('；'));results.push(row);
 }
}
try{await Promise.all([worker(),worker()]);}finally{await browser.close();}
await mkdir('.artifacts/pulse-acceptance',{recursive:true});
await writeFile('.artifacts/pulse-acceptance/live-search.json',JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length))process.exitCode=1;
