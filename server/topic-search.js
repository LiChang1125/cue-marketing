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
export function installTopicSearch(app){
  const cache=new Map(),pending=new Map();
  app.get('/api/topic-search',async(req,res)=>{
    const query=String(req.query.q||'').trim(),days=Number(req.query.days)===7?7:30;
    if(!query||query.length>40)return res.status(400).json({error:'主题请输入 1—40 个字'});
    const key=JSON.stringify([query,days]),entry=cache.get(key);
    if(entry&&entry.expires>Date.now())return res.json(entry.result);
    if(!pending.has(key)){
      if(pending.size>=6)return res.status(429).json({error:'搜索繁忙，请稍后重试'});
      const work=Promise.all(definitions.map(async def=>{
        try{return {name:def.name,ok:true,items:await lookup(def,query,Date.now()-days*86400000)};}
        catch{return {name:def.name,ok:false,items:[]};}
      })).then(result=>{
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