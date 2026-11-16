import {attentionTrends} from '../server/attention.js';
let loaded;
export function createPreviewFetch(data){
  const topics=data.feed.topics.map(t=>({...t,state:'done'}));
  const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  return async(path,options={})=>{
    const url=new URL(path,'https://preview.invalid'),method=options.method||'GET';
    if(method==='POST'&&url.pathname==='/api/topics'){
      const query=JSON.parse(options.body||'{}').query?.trim();
      if(!query||query.length>40)return response({error:'主题请输入 1—40 个字'},400);
      let topic=topics.find(t=>t.query.toLowerCase()===query.toLowerCase());
      if(!topic){topic={id:'preview-'+topics.length,query,state:'done',items:[]};topics.push(topic);}
      return response({id:topic.id});
    }
    if(method!=='GET')return response({error:'预览版不执行采集操作'},405);
    if(url.pathname==='/api/feed')return response({...data.feed,topics});
    if(url.pathname==='/api/reports')return response(data.reports);
    if(url.pathname==='/api/attention')return response(attentionTrends(data.feed.items,id=>data.histories[id]||[],{query:url.searchParams.get('query')||'',sector:url.searchParams.get('sector')||null,days:url.searchParams.get('days')==='30'?30:7,now:Date.parse(data.generatedAt),sources:data.feed.sources}));
    if(url.pathname==='/api/curated'){
      const kind=url.searchParams.get('kind')||'all',page=Math.max(1,Number(url.searchParams.get('page'))||1),all=data.curated[kind]||[],start=(page-1)*24;
      return response({items:all.slice(start,start+24),kind,page,hasMore:start+24<all.length});
    }
    const match=url.pathname.match(/^\/api\/items\/([^/]+)\/history$/);
    if(match)return response({points:data.histories[decodeURIComponent(match[1])]||[]});
    return response({error:'此接口不提供预览'},404);
  };
}
export async function previewFetch(path,options,assetUrl){
  if(!loaded)loaded=fetch(assetUrl('preview-data.json'),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('预览内容读取失败');return r.json();}).then(createPreviewFetch).catch(e=>{loaded=null;throw e;});
  return (await loaded)(path,options);
}
