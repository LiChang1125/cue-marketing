import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { classify, safeImage, parseDate } from './sources.js';
import {createPlatformClient,metricNumber,platformMode} from './platform-api.js';
import {createPublicClient,publicPlatforms} from './public-platforms.js';
import {ensureCloudBrowser} from './cloud-browser.js';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let cloudClient;
const publicClient=createPublicClient();
const cloudFailures=new Map();
let resumedAt=0;
const opencli = resolve(root, 'node_modules/@jackwener/opencli/dist/src/main.js');
const xhs = resolve(root, '.tools/python', process.platform === 'win32' ? 'Scripts/xhs.exe' : 'bin/xhs');
const bridgeGuide = '① 在 Chrome 安装 OpenCLI 扩展（下方开源项目内有官方安装入口）。② 保持 Chrome 打开，并登录对应网站；抖音需要登录 creator.douyin.com。③ 回到这里点击「检查连接」。工具只读取内容，不会发帖或互动。';
export const cliSources = [
  {id:'bilibili-cli',name:'B站搜索',url:'https://github.com/jackwener/OpenCLI',description:'OpenCLI · 围绕关键词查找公开视频，补充热门榜单之外的内容。',setup:bridgeGuide,command:'npx opencli bilibili search 潮玩 --limit 10'},
  {id:'xiaohongshu',name:'小红书',url:'https://github.com/jackwener/OpenCLI',description:'OpenCLI（可选 xiaohongshu-cli）· 关键词搜索、推荐笔记；推荐内容不代表全站热榜。',setup:'① 安装下方 OpenCLI 官方扩展。② 保持 Chrome 打开，在 xiaohongshu.com 用小红书 App 扫码登录。③ 点击检查连接。只有采集电脑需要登录，浏览网站的员工不用登录。可选的独立 xiaohongshu-cli 安装说明见项目 README。',command:'npx opencli xiaohongshu feed --limit 20'},
  {id:'douyin',name:'抖音',url:'https://github.com/jackwener/OpenCLI',description:'OpenCLI · 抖音创作者中心热点词与话题搜索；不是全站视频搜索或完整涨粉榜。',setup:bridgeGuide,command:'npx opencli douyin hashtag hot --limit 20'},
  {id:'weibo',name:'微博',url:'https://github.com/jackwener/OpenCLI',description:'OpenCLI + 本项目修复适配器 · 微博公开热搜词及来源热度。',setup:bridgeGuide,command:'npx opencli zhichao weibo-hot --limit 20'},
  {id:'zhihu',name:'知乎',url:'https://github.com/jackwener/OpenCLI',description:'OpenCLI · 热门问题与原始热度标注。',setup:bridgeGuide,command:'npx opencli zhihu hot --limit 20'}
];

export function cliFailure(payload) {
  const code=String(payload?.error?.code || '');
  const msg=String(payload?.error?.message || '');
  if(/NOT_FOUND|EMPTY_RESULT/.test(code))return '未找到相关结果';
  if(/AUTH|not_authenticated|LOGIN|SESSION/i.test(code+' '+msg))return '请在采集电脑登录对应平台，再检查连接';
  if(/captcha|verification|blocked|风控|验证码/i.test(code+' '+msg))return '平台要求人工验证，已停止本次采集；请在浏览器完成验证';
  if(/filter chip|filter layout/i.test(msg))return '平台筛选界面发生变化，当前筛选条件未能生效';
  if(/bridge|extension|browser|daemon/i.test(code+' '+msg))return 'Chrome 的 OpenCLI 扩展尚未连接；请按下方步骤连接';
  return 'CLI 暂未返回有效数据，请检查平台连接状态';
}
async function run(file,args,timeout=90000,extraEnv={}){
  let result;
  try {result=await exec(file,args,{cwd:root,windowsHide:true,timeout,maxBuffer:6*1024*1024,env:{...process.env,NO_COLOR:'1',OUTPUT:'json',OPENCLI_SITE_SESSION:'persistent',...extraEnv}});}
  catch(e){if(e.stdout){try{const p=JSON.parse(e.stdout);throw new Error(cliFailure(p));}catch(parseError){if(!(parseError instanceof SyntaxError))throw parseError;}}throw new Error(e.code==='ENOENT'?'CLI 尚未安装':e.killed?'连接超时，请检查浏览器和登录状态':'CLI 执行未完成，请检查连接');}
  let payload;try{payload=JSON.parse(result.stdout);}catch{throw new Error('CLI 输出格式与当前适配器不匹配');}
  if(payload.ok===false)throw new Error(cliFailure(payload));
  return payload.data??payload;
}
let bridgeState=null, bridgeAt=0;
async function requireBridge(){
  if(!bridgeState||Date.now()-bridgeAt>60000){bridgeState=await run(process.execPath,[opencli,'doctor'],25000);bridgeAt=Date.now();}
  if(!bridgeState.extensionConnected)throw new Error('Chrome 的 OpenCLI 扩展尚未连接；请按下方步骤连接');
}

const number=metricNumber;
export function normalizeCli(data,source,at,query=''){
  const rows=Array.isArray(data)?data:data?.items??data?.notes??data?.feeds??data?.list;
  if(!Array.isArray(rows))throw new Error('CLI 数据结构已变化，请更新适配器');
  return rows.slice(0,60).flatMap((row,index)=>{
    const card=row.note_card||row.noteCard||row;
    let title=card.display_title||card.displayTitle||row.title||row.desc||row.word||row.name;
    if(typeof title!=='string'||!title.trim())return [];
    let url=row.url||card.url;
    const video=source==='douyin'&&(row.contentType==='video'||/\/video\/\d+/.test(url||''));
    const originalTitle=title;
    if(video){const prose=title.split('#')[0].trim();title=(prose.length>=12?prose:title.replaceAll('#',' ').replace(/@\S+/g,'')).replace(/\s+/g,' ').trim();if(title.length>110){const line=title.slice(0,105);title=(line.match(/^.*[。！？!？]/)?.[0]||line)+'…';}}
    if(source==='douyin'&&!video)url=row.id&&query?`https://www.douyin.com/hashtag/${encodeURIComponent(row.id)}`:`https://www.douyin.com/search/${encodeURIComponent(title)}`;
    if(source==='xiaohongshu'&&!url){const id=row.id||row.note_id; if(!id)return [];const u=new URL(`https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}`);if(row.xsec_token)u.searchParams.set('xsec_token',row.xsec_token);url=u.href;}
    const allowed={xiaohongshu:['www.xiaohongshu.com','xiaohongshu.com'],douyin:['www.douyin.com'],weibo:['s.weibo.com','weibo.com','www.weibo.com'],zhihu:['www.zhihu.com','zhuanlan.zhihu.com'],'bilibili-cli':['www.bilibili.com']}[source];
    try{const u=new URL(url);if(u.protocol!=='https:'||!allowed?.includes(u.hostname))return [];}catch{return [];}
    const tags=[({xiaohongshu:'平台笔记',douyin:'话题',weibo:'讨论',zhihu:'问答','bilibili-cli':'视频'}[source])];
    const likes=number(card.interact_info?.liked_count??card.interactInfo?.likedCount??row.likes??row.votes);
    const identity=row.id||row.note_id||(video?url.match(/\/video\/(\d+)/)?.[1]:null)||url.split('?')[0];
    const id=`${source}-${createHash('sha256').update(String(identity)).digest('hex').slice(0,20)}`;
    return [{id,title:title.trim().slice(0,180),originalTitle,excerpt:row.excerpt||null,retrievalKind:row.retrievalKind||'search',historical:/\d+\s*(周|个月|月|年)前/.test(row.time||''),url,image:safeImage(card.cover?.url_default||card.cover?.url||row.image||(typeof row.cover==='string'?row.cover:null)),source,contentType:video?'video':source==='douyin'?'topic':row.contentType,creator:card.user?.nickname||card.user?.nick_name||row.author||'话题动态',tags,searchQuery:query||null,
      publishedAt:Number.isFinite(row.pubdate_ts)&&row.pubdate_ts>0?new Date(row.pubdate_ts*(row.pubdate_ts>1e12?1:1000)).toISOString():source==='xiaohongshu'&&query?null:parseDate(String(row.published_at||row.time||''),at),publicationVerified:row.publicationVerified===true,publishedLabel:source==='xiaohongshu'&&query?'来源未提供可核实的发布时间':row.published_at||row.time||'来源未提供发布时间',fetchedAt:row.observedAt||at,metricAt:row.observedAt||at,rank:row.rank??index+1,metrics:{likes,comments:number(row.comments),saves:number(row.saves),shares:number(row.shares),answers:number(row.answers),questionFollowers:number(row.followers),views:source==='bilibili-cli'||video?number(row.plays??row.play):null,topicViews:source==='douyin'&&!video&&query?number(row.view_count):null},
      rawHeat:source==='douyin'?`${row.view_count??'未知'}（${query?'话题累计播放量，不是单条视频播放量':'来源热点值，非视频播放量'}）`:String(row.hot_value??row.heat??''),
      ...classify({title,tags,source})}];
  });
}

export async function publicCollection(id,at,reason=null){
  const rows=await publicClient.read(id),items=normalizeCli(rows,id,at,'');
  items.collectionInfo={backend:'public-http',scope:'hotlist',supportsSearch:false,...(reason?{fallbackReason:reason}:{})};return items;
}
export async function collectCli(id,at,query='',options={}){
  const mode=platformMode();
  if(mode==='disabled')throw Error('平台采集尚未配置');
  if(mode==='public')return publicCollection(id,at);
  if(mode==='tikhub'){
    cloudClient??=createPlatformClient({directory:process.env.DATA_DIR||resolve(root,'data')});
    return normalizeCli(await cloudClient.search(id,query||'品牌联名'),id,at,query||'品牌联名');
  }
  if(!['browser','selfhosted'].includes(mode))throw Error('未知平台接入方式');
  if(mode==='selfhosted'){
    const directory=process.env.DATA_DIR||resolve(root,'data');
    const signal=resolve(directory,'collector-resume');
    if(existsSync(signal)&&statSync(signal).mtimeMs>resumedAt){resumedAt=statSync(signal).mtimeMs;cloudFailures.clear();}
    if(existsSync(resolve(directory,'collector.pause'))){
      if(publicPlatforms.includes(id))return publicCollection(id,at,'浏览器采集已暂停');
      throw Error('浏览器采集已暂停，等待管理员恢复');
    }
  }
  if(mode==='selfhosted'&&(!query||options.discovery)&&publicPlatforms.includes(id))return publicCollection(id,at);
  const previous=cloudFailures.get(id);
  if(mode==='selfhosted'&&previous&&previous.until>Date.now()){
    if(publicPlatforms.includes(id))return publicCollection(id,at,previous.message);
    throw Error(previous.message);
  }
  try{return await browserCollection(id,at,query,options,mode);}
  catch(error){
    if(mode!=='selfhosted')throw error;
    cloudFailures.set(id,{until:Date.now()+30*60000,message:error.message});
    if(publicPlatforms.includes(id))return publicCollection(id,at,error.message);
    throw error;
  }
}
async function browserCollection(id,at,query,options,mode){
  let data;
  const browserEnv=mode==='selfhosted'?{OPENCLI_CDP_ENDPOINT:await ensureCloudBrowser(),OPENCLI_SITE_SESSION:'ephemeral',OPENCLI_SITE_SLOTS:''}:{};
  const limit=String(Math.min(40,options.limit||20));
  if(mode==='browser'&&id==='xiaohongshu'&&existsSync(xhs)){
    const args=query?['search',query,'--sort','general','--json']:['feed','--json'];
    data=await run(xhs,args);
  }else{
    if(mode==='browser')await requireBridge();
    // The upstream "latest" filter currently fails to activate. Use the verified
    // default ranking and identify it as a platform search, not a latest-only feed.
    const args=id==='xiaohongshu'?(query?['zhichao','xiaohongshu-search',query,'--limit',limit]:['xiaohongshu','feed','--limit','20']):id==='douyin'?['zhichao','douyin-search',query||'品牌联名','--limit',String(Math.min(30,Number(limit)))]:[id,'hot','--limit','20'];
    const command=id==='weibo'?(query?['zhichao','weibo-search',query,'--limit',limit]:['zhichao','weibo-hot','--limit','20']):id==='zhihu'&&query?['zhichao','zhihu-search',query,'--limit',limit]:id==='bilibili-cli'?(query?['zhichao','bilibili-search',query,'--limit',limit,'--page',String(options.page||1),'--order','pubdate']:['bilibili','hot','--limit','20']):args;
    data=await run(process.execPath,[opencli,...command],90000,browserEnv);
  }
  const items=normalizeCli(data,id,at,query);
  items.collectionInfo={backend:mode==='selfhosted'?'cloud-chromium':'browser-bridge',scope:query?'search':'discovery',supportsSearch:!!query};
  return items;
}
