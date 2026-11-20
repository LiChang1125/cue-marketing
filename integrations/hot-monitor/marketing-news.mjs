import {load} from 'cheerio';

export async function searchMarketingNews(term,language){
  const url=new URL('https://www.bing.com/news/search');
  url.search=new URLSearchParams({q:term,format:'rss',setlang:language,mkt:language==='en'?'en-US':'zh-CN'});
  const response=await fetch(url,{signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw Error('新闻检索不可用');
  const $=load(await response.text(),{xml:true});
  if(!$('channel').length)throw Error('新闻检索不可用');
  return $('item').slice(0,24).toArray().flatMap(el=>{
    const entry=$(el),title=entry.find('title').text().trim(),publishedAt=entry.find('pubDate').text();
    try {
      let target=new URL(entry.find('link').text());
      if(/(^|\.)bing\.com$/i.test(target.hostname))target=new URL(target.searchParams.get('url')||'');
      if(!/^https?:$/.test(target.protocol)||!title||!Number.isFinite(Date.parse(publishedAt)))return [];
      const content=load(entry.find('description').text()).text().slice(0,500);
      return [{source:'editorial',publisher:entry.find('News\\:Source').text()||target.hostname,title,content,url:target.href,publishedAt:new Date(publishedAt).toISOString()}];
    }catch{return [];}
  });
}

