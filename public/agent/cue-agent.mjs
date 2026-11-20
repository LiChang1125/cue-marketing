import { createInterface } from 'node:readline';

const site = 'https://lichang1125.github.io/cue-marketing/';
const definitions = [
  {name:'latest_articles',description:'读取最近发布的消费品牌与营销报道。'},
  {name:'search_articles',description:'在已发布文章中检索主题、品牌或 IP。'},
  {name:'hot_events',description:'获取当前发布的热点事件、热度指数和报道来源。'}
].map(tool => ({...tool,inputSchema:{type:'object',additionalProperties:false,
  properties:{limit:{type:'integer',minimum:1,maximum:20},...(tool.name==='search_articles'?{query:{type:'string',minLength:1,maxLength:100}}:{})},
  ...(tool.name==='search_articles'?{required:['query']}:{})}}));
async function data(file){
  const response=await fetch(new URL(file,site),{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('CUE 数据暂不可用（HTTP '+response.status+'）');
  return response.json();
}
const versions=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
async function handle(request){
  if(request.jsonrpc!=='2.0'||typeof request.method!=='string')throw {code:-32600,message:'无效请求'};
  if(request.method==='initialize')return {protocolVersion:versions.includes(request.params?.protocolVersion)?request.params.protocolVersion:versions[0],capabilities:{tools:{}},serverInfo:{name:'cue-marketing',version:'1.0.0'}};
  if(request.method==='ping')return {};
  if(request.method==='tools/list')return {tools:definitions};
  if(request.method!=='tools/call')throw {code:-32601,message:'未知方法'};
  const {name,arguments:args={}}=request.params||{};
  if(!definitions.some(t=>t.name===name)||!args||typeof args!=='object'||Array.isArray(args))throw {code:-32602,message:'无效工具或参数'};
  const limit=args.limit===undefined?10:args.limit;
  if(!Number.isInteger(limit)||limit<1||limit>20||Object.keys(args).some(k=>k!=='limit'&&(name!=='search_articles'||k!=='query')))throw {code:-32602,message:'无效参数'};
  const query=typeof args.query==='string'?args.query.trim():'';
  if(name==='search_articles'&&(!query||query.length>100))throw {code:-32602,message:'请输入 1 至 100 字的主题'};
  try{
    const feed=await data(name==='hot_events'?'pulse/events.json':'agent/articles.json');
    const items=name==='hot_events'?feed.results:feed.items;
    const words=query.toLowerCase().split(/\s+/);
    const hits=query?items.filter(r=>words.every(t=>[r.title,r.originalTitle,r.publisher,r.summary].join(' ').toLowerCase().includes(t))):items;
    return {content:[{type:'text',text:JSON.stringify({generatedAt:feed.generatedAt,total:hits.length,items:hits.slice(0,limit)})}]};
  }catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
}
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',async line=>{
  let msg;
  try{
    msg=JSON.parse(line);
    if(msg&&msg.id===undefined&&typeof msg.method==='string')return;
    const result=await handle(msg||{});
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result})+'\n');
  }catch(e){
    const error={code:e instanceof SyntaxError?-32700:e.code||-32603,message:e.message||'请求失败'};
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:msg?.id??null,error})+'\n');
  }
});
