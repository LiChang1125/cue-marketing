import {biliTopic} from './community-topics.js';
import {instagramPosts} from './instagram-mentions.js';
import {evidenceMatches,topicKey} from '../shared/community.js';
import {load} from 'cheerio';

const definitions=[
  {id:'socialbeta',name:'SocialBeta',url:q=>'https://socialbeta.com/search/'+encodeURIComponent(q),selector:'.con .tit a',row:a=>a.closest('.con'),date:r=>r.find('.date').text(),excerpt:r=>r.find('.meta').text(),pattern:/^https:\/\/socialbeta\.com\/(?:campaign|article)\/\d+$/},
  {id:'digitaling',name:'数英',url:q=>'https://www.digitaling.com/search/articles/?kw='+encodeURIComponent(q),selector:'h5 a',row:a=>a.parent().parent(),date:r=>r.find('span.color_969').text(),excerpt:r=>r.find('p.desc').text(),pattern:/^https:\/\/www\.digitaling\.com\/articles\/\d+\.html$/}
];
async function lookup(def,query,since){
  const res=await fetch(def.url(query),{signal:AbortSignal.timeout(9000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const $=load(await res.text());
  const rows=[];
  $(def.selector).each((_,e)=>{
    const a=$(e),r=def.row(a),url=a.attr('href'),title=a.text().trim();
    const date=def.date(r).trim().match(/(\d{4}-\d\d-\d\d)(?:\s+(\d\d:\d\d))?/);
    if(!date||!title||!def.pattern.test(url))return;
    const publishedAt=new Date(date[1]+'T'+(date[2]||'00:00')+':00+08:00').toISOString();
    if(Date.parse(publishedAt)<since||Date.parse(publishedAt)>Date.now())return;
    rows.push({id:url,url,title,excerpt:def.excerpt(r).trim(),source:def.id,sourceName:def.name,publishedAt,matchedQuery:query,contentType:'article'});
  });
  return rows;
}
async function toutiao(query,days){
  const endpoint=new URL('https://www.toutiao.com/search/');
  endpoint.searchParams.set('keyword',topicKey(query));
  const res=await fetch(endpoint,{signal:AbortSignal.timeout(9000)});
  if(!res.ok)throw Error('HTTP '+res.status);
  const $=load(await res.text()),items=[],community=[];
  const scripts=$('script[type="application/json"]');
  if(!scripts.length)throw Error('搜索结果暂不可读');
  for(const script of scripts){
    let row;
    try{row=JSON.parse($(script).text()).data;}catch{continue;}
    const title=row?.display?.title?.text,excerpt=row?.display?.summary?.text||'';
    const at=Number(row?.display?.self_info?.timestamp)*1000;
    if(!title||!evidenceMatches(title+' '+excerpt,query)||!Number.isFinite(at)||at>Date.now()||at<Date.now()-days*86400000)continue;
    const url=row.article_url||row.share_url;
    if(!/^https?:\/\//i.test(url||''))continue;
    const publishedAt=new Date(at).toISOString();
    items.push({id:url,url,title,excerpt,publishedAt,source:'toutiao-search',sourceName:'头条搜索',publisher:row.source,contentType:'article',matchedQuery:query});
    const group=row.display.self_info.group_id;
    if(/^\d+$/.test(String(group))&&Number.isInteger(row.comment_count)&&evidenceMatches(title,query))
      community.push({platform:'今日头条',day:publishedAt.slice(0,10),title,url:'https://www.toutiao.com/article/'+group+'/',replies:row.comment_count});
  }
  return {name:'头条搜索',ok:true,items,community};
}
export function installTopicSearch(app){
  const cache=new Map(),pending=new Map();
  app.get('/api/topic-search',async(req,res)=>{
    const query=String(req.query.q||'').trim(),days=Number(req.query.days)===7?7:30;
    if(!query||query.length>40)return res.status(400).json({error:'主题请输入 1—40 个字'});
    const key=JSON.stringify([query,days]),entry=cache.get(key);
    if(entry&&entry.expires>Date.now())return res.json(entry.result);
    if(!pending.has(key)){
      if(pending.size>=6)return res.status(429).json({error:'搜索繁忙，请稍后重试'});
      const media=definitions.map(async def=>{
        try{return {name:def.name,ok:true,items:await lookup(def,query,Date.now()-days*86400000)};}
        catch{return {name:def.name,ok:false,items:[]};}
      });
      const community=biliTopic(query).then(d=>({name:'B站',ok:true,items:[],community:d.items})).catch(()=>({name:'B站',ok:false,items:[],community:[]}));
      const news=toutiao(query,days).catch(()=>({name:'头条搜索',ok:false,items:[],community:[]}));
      const instagram=instagramPosts(query).then(posts=>({name:'Instagram 品牌帖索引',ok:true,items:[],community:posts.map(p=>({...p,matchedQuery:query}))})).catch(()=>({name:'Instagram 品牌帖索引',ok:false,items:[]}));
      const work=Promise.all([...media,community,news,instagram]).then(result=>{
        if(result.every(r=>r.ok)){
          if(cache.size>=96)cache.delete(cache.keys().next().value);
          cache.set(key,{result,expires:Date.now()+5*60000});
        }
        return result;
      }).finally(()=>pending.delete(key));
      pending.set(key,work);
    }
    res.json(await pending.get(key));
  });
}
