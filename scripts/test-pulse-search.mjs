import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {build,preview} from 'vite';
import {chromium} from 'playwright';

// Test records stay in the browser context. The production bundle never imports this file.
const out=resolve('.artifacts/pulse-acceptance');
await mkdir(out,{recursive:true});
process.env.VITE_PUBLIC_DATA='true';
const base='/cue-marketing/';
await build({base,logLevel:'warn',build:{outDir:join(out,'site')}});
const server=await preview({base,logLevel:'error',build:{outDir:join(out,'site')},preview:{host:'127.0.0.1',port:0}});
const origin='http://127.0.0.1:'+server.httpServer.address().port;
const home=origin+base+'pulse/#/hot';
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:process.platform==='win32'?{channel:'chrome'}:{});
const roles=['media','official','creator','community'];
const names=['轻舟','杉野','珂露','沐蓝','杏仁屋','晴芽','暮光','沧海','木叶','红绒'];
const topics=['帆船装备','露营帐篷','香氛礼盒','骑行服装','植物饮品','抹茶甜点','独立漫画','无醇饮料','滑板街区','羊绒针织'];
const english=['Sailing','Campsite','Fragrant','Cycling','Botanic','Bakery','Manga','Brewery','Skating','Cashmere'];
const now=Date.now(),day=86400000;
const entries=Array.from({length:34},(_,i)=>{
 const k=i%10,model='MK'+(110+i),material='Leaf_'+(800+i),event='海岸企划';
 return {title:names[k]+'推出'+topics[k]+'限定系列 '+model,brand:names[k],tags:[event,english[k],material,'Q4_Brand_Campaign_2026','#'+english[k]+'-'+(2020+k)],publisher:'专栏'+(100+i),channel:'渠道'+(100+i),role:roles[i%4],content:'消费品牌在线下首店发售新品。',url:'https://publisher.example/events/'+i,publishedAt:new Date(now-(i%24+.4)*day).toISOString(),reports:i%2?[{url:'https://press.example/rewrites/'+i,publisher:'第二出处',title:'同一事件',publishedAt:new Date(now-day).toISOString()}]:[]};
});
const fixtures=[...entries,{...entries[0],url:'https://syndication.example/copy/0'},
 {...entries[0],title:'过期限定款首店发售',url:'https://old.example/feature',publishedAt:new Date(now-40*day).toISOString()},
 {...entries[0],title:'科技公司发布全新人工智能芯片',url:'https://tech.example/model'}];
const expected=rows=>rows.map(r=>r.url).sort();
const ordered=rows=>rows.map(r=>r.url);
const field=p=>p.getByRole('searchbox');
const rows=p=>p.getByRole('list',{name:'匹配案例'}).locator('li h3 a');
const keyAt=i=>'MK'+(110+i);
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const labels=['精确关键词','连续子串','多词跨字段 AND','英文大小写','多语言与符号','组合筛选','结果排序','分页与重置','清空与重置','无匹配结果','空白查询','超长输入','特殊字符安全','连续输入','弱网竞态','历史与分享','键盘操作'];
const priority=['P0','P0','P1','P1','P1','P1','P2','P1','P1','P0','P1','P2','P0','P1','P1','P2','P2'];
const logs=[];
async function contextFor(i){
 const context=await browser.newContext({viewport:i%2?{width:393,height:852}:{width:1366,height:850}});
 await context.addInitScript(records=>{
  const realFetch=window.fetch.bind(window);
  window.__queryLog=[];
  window.fetch=async(resource,options)=>{
   const u=new URL(resource instanceof Request?resource.url:String(resource),location.href);
   const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
   if(u.origin===location.origin){
    if(u.pathname.endsWith('/pulse/events.json'))return json({results:[],patterns:[],reportingOutlets:0});
    if(u.pathname.endsWith('/pulse/cases.json'))return json({cases:[]});
    if(u.pathname.endsWith('/pulse/source-index.json'))return json({items:records,publishers:[]});
    return realFetch(resource,options);
   }
   window.__queryLog.push(u.href);
   if(u.hostname==='public-api.wordpress.com'){
    const term=u.searchParams.get('q');
    if(/^迟到专题[0-9]$/.test(term)){
     await new Promise(r=>setTimeout(r,350));
     return json({posts:[{URL:'https://late.example/posts/'+term.at(-1),title:term+'联名服装举行新品快闪',excerpt:'消费品牌正式发售',date:new Date().toISOString(),site_name:'延迟出版源'}]});
    }
    return json({posts:[]});
   }
   return json({},503);
  };
 },fixtures);
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage();
 page.setDefaultTimeout(45000);
 page.setDefaultNavigationTimeout(45000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 return {page,context,errors};
}
async function done(p,expected){
 await p.waitForFunction(query=>{
  const current=new URLSearchParams(location.hash.split('?')[1]).get('q');
  if(!current||(query!==undefined&&current!==query))return false;
  const section=document.querySelector('section[aria-label="近期营销案例"]');
  if(!section||section.querySelector('input')?.value!==current)return false;
  const paragraphs=[...section.querySelectorAll('p')].map(n=>n.textContent);
  const term=current.normalize('NFKC').trim().slice(0,100);
  const finished=paragraphs.some(t=>/共 \d+ 个案例/.test(t)&&!t.includes('正在联网检索'));
  return finished&&(!/[\p{L}\p{N}]/u.test(term)||/[<>]/u.test(term)||paragraphs.some(t=>t.startsWith('近期新闻 · '+term+' · ')));
 },expected);
}
async function submit(p,q){
 await field(p).fill(q);await field(p).press('Enter');await done(p,q.trim().slice(0,100));
}
async function links(p){return rows(p).evaluateAll(a=>a.map(n=>n.href));}
async function assertLinks(p,want){
 const urls=await links(p),next=p.getByRole('button',{name:'下一页'});
 while(await next.count()&&await next.isEnabled()){await next.click();urls.push(...await links(p));}
 assert.deepEqual(urls.sort(),expected(want));
}
async function atHome(p){
 await p.getByRole('heading',{name:'品牌热点榜'}).waitFor();assert.equal(await field(p).inputValue(),'');
 assert.equal(await p.getByLabel('来源类型').count(),0);assert.equal(new URL(p.url()).hash,'#/hot');
}
async function logSize(p){return p.evaluate(()=>window.__queryLog.length);}
function address(q){return '#/search?'+new URLSearchParams({q}).toString();}
const ids=entries.map((r,i)=>i);
const subset=(role,days)=>entries.filter((r,i)=>(!role||r.role===role)&&(i%24+.4)<days);
function spec(g,i){
 const r=entries[i],model=keyAt(i),s=(input,steps,want,run,pre='有近期消费品牌样本、过期样本和无关科技样本')=>({input,steps,want,run,pre});
 if(g===1){
  const q=[r.title,model,r.publisher,r.channel,r.brand,r.tags[2],topics[i],r.tags[1],topics[i],r.title][i];
  const hit=[0,1,2,3,5,9].includes(i)?[r]:entries.filter((_,n)=>n%10===i);
  return s(q,'输入完整值后回车，核对每一个结果的原文地址','精确返回 '+hit.map(x=>x.title).join('、'),async p=>{await submit(p,q);await assertLinks(p,hit);});
 }
 if(g===2){
  const q=['Campaign','Brand','Q4_','_2026','Leaf_80','K11','ailin','ashmer','杏仁','服装'][i];
  const sets=[ids,ids,ids,ids,ids.slice(0,10),ids.slice(0,10),ids.filter(n=>n%10===0),ids.filter(n=>n%10===9),ids.filter(n=>n%10===4),ids.filter(n=>n%10===3)];
  return s(q,'部分词检索，验证全部分页地址','只命中预置的 '+sets[i].length+' 条子串记录',async p=>{await submit(p,q);let matches=await links(p);while(await p.getByRole('button',{name:'下一页'}).isEnabled({timeout:250}).catch(()=>false)){await p.getByRole('button',{name:'下一页'}).click();matches.push(...await links(p));}assert.deepEqual(matches.sort(),expected(sets[i].map(n=>entries[n])));});
 }
 if(g===3){
  const q=[model+' '+r.channel,r.brand+' '+model,r.publisher+' '+model,r.tags[2]+' '+r.channel,r.brand+'   '+r.publisher,r.tags[1]+' '+r.tags[2],r.brand+' '+model+' '+r.publisher,r.channel+'　'+model,r.brand+' 不存在标识',r.tags[2]+' '+keyAt(i+1)][i];
  return s(q,'提交空格或全角空格分词，核对标题、品牌、渠道、标签交集',i<8?'仅返回 '+r.title:'无匹配',async p=>{await submit(p,q);await assertLinks(p,i<8?[r]:[]);});
 }
 if(g===4){
  const word=english[i],want=entries.filter((_,n)=>n%10===i);
  return s(word,'依次提交全小写、全大写、混合拼写','三种写法均返回 '+want.length+' 条相同原文',async p=>{for(const q of [word.toLowerCase(),word.toUpperCase(),word]){await submit(p,q);await assertLinks(p,want);}});
 }
 if(g===5){
  const q=[r.tags[4],r.tags[2],'ＭＫ１１２',r.channel+' '+model,r.brand+'　'+r.tags[1],'#Bakery-2025','Leaf_806','MK117','专栏108','＃Ｃａｓｈｍｅｒｅ－２０２９'][i];
  const want=[0,4,5,9].includes(i)?entries.filter((_,n)=>n%10===i):[r];
  return s(q,'提交混合字符，读取路由参数与原文','参数完整回填且返回 '+want.length+' 条',async p=>{await submit(p,q);assert.equal(new URLSearchParams(new URL(p.url()).hash.split('?')[1]).get('q'),q.trim());await assertLinks(p,want);});
 }
 if(g===6||g===7){
  const role=roles[i%4],days=[7,14,30][Math.floor(i/4)],sort=i%2?'证据评分':'最新',want=subset(role,days);
  return s('海岸企划 / '+role+' / '+days+(g===7?' / '+sort:''),g===6?'依次选择来源、时段，再单独清除'+(i%2?'时段':'来源'):'叠加来源和日期，切换排序，核对成员及顺序',g===6?'筛选交集 '+want.length+' 条；撤销后只保留另外一个筛选':'保持查询与两个筛选，按'+sort+'单调排列',async p=>{
   await submit(p,'海岸企划');await p.getByLabel('来源类型').selectOption(role);await p.getByLabel('时间范围').selectOption(String(days));await assertLinks(p,want);
   if(g===6){if(i%2){await p.getByLabel('时间范围').selectOption('30');await assertLinks(p,subset(role,30));}else{await p.getByLabel('来源类型').selectOption('');await assertLinks(p,subset('',days));}}
   else{await p.getByLabel('事件排序').selectOption(sort);await assertLinks(p,want);assert.equal(await field(p).inputValue(),'海岸企划');assert.equal(await p.getByLabel('来源类型').inputValue(),role);assert.equal(await p.getByLabel('时间范围').inputValue(),String(days));
    if(sort==='最新'){const dates=(await links(p)).map(url=>Date.parse(entries.find(x=>x.url===url).publishedAt));assert.deepEqual(dates,[...dates].sort((a,b)=>b-a));}
    else{const numbers=(await p.locator('ol li summary').allTextContents()).map(x=>Number(x.match(/评分 (\d+)/)[1]));assert.deepEqual(numbers,[...numbers].sort((a,b)=>b-a));}}
  });
 }
 if(g===8)return s('海岸企划 → '+(i%3===0?'再次搜索':model),'在 34 条结果翻到第二页，再提交相同或不同查询',i%3===0?'回到第一页，显示 24 条':'只显示新编号的唯一记录',async p=>{await submit(p,'海岸企划');const first=await links(p);await p.getByRole('button',{name:'下一页'}).click();const second=await links(p);assert.equal(second.length,10);assert.equal(new Set([...first,...second]).size,34);await submit(p,i%3===0?'海岸企划':model);if(i%3===0){assert.deepEqual(await links(p),first);assert.match(await p.getByLabel('案例分页').innerText(),/第 1 \/ 2 页/);}else await assertLinks(p,[r]);});
 if(g===9)return s(model,'选择筛选，再'+['点击 ×','删除内容后回车','按 Esc'][i%3],'返回热点榜，搜索框与筛选状态清空',async p=>{await submit(p,model);await p.getByLabel('来源类型').selectOption(roles[i%4]);if(i%3===0)await p.getByRole('button',{name:'清空搜索'}).click();else if(i%3===1){await field(p).fill('');await field(p).press('Enter');}else await field(p).press('Escape');await atHome(p);});
 if(g===10){const q=['nonexistent_xyz_999','零命中企划乙','MissingEdition123','no-such-MK77','#无此标签','不存在的气味编号','ZX-9977','NeverBrand_80','无对应品牌名字','emptyresult2026'][i];return s(q,'查询缺失记录，查看提示，再点击清空','0 个案例，有空状态并可恢复热点榜',async p=>{await submit(p,q);await assertLinks(p,[]);await p.getByText(/尚未核实近期案例|尚未找到可核实的案例/).waitFor();await p.getByRole('button',{name:'清空搜索'}).click();await atHome(p);});}
 if(g===11){const q=['',' ','   ','　','　　 ','\u00a0','\u2003','\u2002',' \u2009 ','\u3000\u00a0 '][i];return s(JSON.stringify(q)+' (U+'+[...q].map(c=>c.codePointAt(0).toString(16)).join(' ')+')','在热点榜输入空白后回车','保留热点榜，无外部检索请求',async p=>{const before=await logSize(p);await field(p).fill(q);await field(p).press('Enter');await atHome(p);assert.equal(await logSize(p),before);});}
 if(g===12){const token=['a','长','A9','旅x','代号_','#香-','Ｆ','00','品类','Mix'][i],q=token.repeat(201+i*101);
  return s(token+' 重复 '+(201+i*101)+' 次',i%2?'打开含超长参数的分享链接':'粘贴超长查询后回车','最多 100 个 UTF-16 单元；查询和渲染完成',async p=>{if(i%2){await p.goto(home.split('#')[0]+address(q));await done(p);}else{await field(p).fill(q);await field(p).press('Enter');await done(p);}assert.equal(await field(p).inputValue(),q.slice(0,100));assert.equal(new URLSearchParams(new URL(p.url()).hash.split('?')[1]).get('q'),q.slice(0,100));});}
 if(g===13){const q=['<script>alert(1)</script>',"'",'"','%','&','?','#','<mark>文本</mark>','CUE&A?B=1','品牌 \\ "Q4"'][i];
  return s(q,'提交输入，核对 URL、原样回填、弹窗与 DOM','安全显示，保留原始参数，无脚本对话框',async p=>{let dialogs=0;p.on('dialog',async d=>{dialogs++;await d.dismiss();});await submit(p,q);assert.equal(await field(p).inputValue(),q);assert.equal(new URLSearchParams(new URL(p.url()).hash.split('?')[1]).get('q'),q);assert.equal(dialogs,0);assert.equal(await p.locator('main script').count(),0);await assertLinks(p,[]);});}
 if(g===14)return s(model,'快速输入主题、退格改写成编号，回车前后检查网络','输入期间无外部请求；提交后仅按最后编号展示',async p=>{const before=await logSize(p);await field(p).pressSequentially(english[i]);await field(p).press('Backspace');await field(p).fill(model);assert.equal(await logSize(p),before);await field(p).press('Enter');await done(p);await assertLinks(p,[r]);assert.ok(await logSize(p)>before);});
 if(g===15){const slow='迟到专题'+i;return s(slow+' → '+model,'先提交慢请求，观察已发出后立即提交快请求，等待迟到响应','后发查询和唯一编号始终保留',async p=>{await field(p).fill(slow);await field(p).press('Enter');await p.waitForFunction(q=>window.__queryLog.some(v=>new URL(v).searchParams.get('q')===q),slow);await submit(p,model);await sleep(420);await assertLinks(p,[r]);assert.equal(await field(p).inputValue(),model);});}
 if(g===16)return s(model+' → '+keyAt(i+1),['验证后退','验证前进','在新标签直接打开分享链接'][i%3],'URL、搜索框和对应记录同步',async p=>{await submit(p,model);await submit(p,keyAt(i+1));if(i%3<2){await p.goBack();await done(p,model);await assertLinks(p,[r]);if(i%3){await p.goForward();await done(p,keyAt(i+1));await assertLinks(p,[entries[i+1]]);}}else{const t=await p.context().newPage();await t.goto(p.url());await done(t,keyAt(i+1));await assertLinks(t,[entries[i+1]]);assert.equal(await field(t).inputValue(),keyAt(i+1));await t.close();}const active=i%3?keyAt(i+1):model;assert.equal(await field(p).inputValue(),active);assert.equal(new URLSearchParams(new URL(p.url()).hash.split('?')[1]).get('q'),active);});
 return s(model,'通过 Tab 从导航移入搜索框，键入并用'+(i%2?' Enter':' Tab 到搜索按钮再 Enter')+'提交，再用 Esc 清空','无需鼠标可完成搜索与返回',async p=>{for(let n=0;n<15&&!await field(p).evaluate(el=>el===document.activeElement);n++)await p.keyboard.press('Tab');assert.ok(await field(p).evaluate(el=>el===document.activeElement));await p.keyboard.type(model);if(i%2===0){await p.keyboard.press('Tab');assert.ok(await p.getByRole('button',{name:'搜索',exact:true}).evaluate(el=>el===document.activeElement));}await p.keyboard.press('Enter');await done(p);await assertLinks(p,[r]);await field(p).focus();await p.keyboard.press('Escape');await atHome(p);});
}
let next=1;
async function worker(){
 while(next<=17){const g=next++;
 for(let i=0;i<10;i++){
 const {input,steps,want,run,pre}=spec(g,i),id='TC-'+String(g).padStart(2,'0')+'-'+String(i+1).padStart(2,'0');
 const {page,context,errors}=await contextFor(i);let status='通过',detail='';
 try{await page.goto(home,{waitUntil:'domcontentloaded'});await atHome(page);await run(page);assert.deepEqual(errors,[]);}
 catch(e){status='失败';detail=e.message.slice(0,450);console.error(id,detail);}
 finally{await context.close();}
 logs.push({id,priority:priority[g-1],group:labels[g-1],pre,input,steps,want,status,detail});
 }
 console.log(labels[g-1],logs.filter(r=>r.group===labels[g-1]&&r.status==='通过').length+'/10');
 }
}
try{await Promise.all([worker(),worker()]);}
finally{await browser.close();await server.close();}
logs.sort((a,b)=>a.id.localeCompare(b.id));
const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
const csv=[['编号','优先级','场景','前置条件','输入','操作步骤','预期结果','Chrome 实测','失败详情'],...logs.map(row=>Object.values(row))].map(row=>row.map(quote).join(',')).join('\r\n');
await writeFile(join(out,'search-acceptance.csv'),'\ufeff'+csv);
await writeFile(join(out,'search-acceptance.json'),JSON.stringify(logs,null,2));
console.log('通过',logs.filter(r=>r.status==='通过').length,'/',logs.length,'报告',out);
if(logs.some(r=>r.status!=='通过')||logs.length!==170)process.exitCode=1;
