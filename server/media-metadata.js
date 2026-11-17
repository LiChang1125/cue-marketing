import {load} from 'cheerio';

// Only read publication metadata, never image paths, crawl time or modification time.
export function publicationDate(raw){
 if(raw==null)return null;
 if(typeof raw==='number'||/^\d{10,13}$/.test(String(raw))){const n=Number(raw);return new Date(n<1e12?n*1000:n).toISOString();}
 let s=String(raw).trim().replace(/年|\//g,'-').replace(/月/g,'-').replace(/日/g,'').replace(/\s*(am|pm)/i,' $1');
 const chinese=s.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
 if(chinese)s=`${chinese[1]}-${chinese[2].padStart(2,'0')}-${chinese[3].padStart(2,'0')}T${(chinese[4]||'00').padStart(2,'0')}:${chinese[5]||'00'}:${chinese[6]||'00'}+08:00`;
 const n=Date.parse(s);return Number.isFinite(n)?new Date(n).toISOString():null;
}
const dateSelectors={topys:'meta[property="og:release_date"]',meihua:'.article-info .info-item, .article-header .info-item, .article-info, .info-item',media360:'.article_info, .article-info, .detail_time, .info_box .time, .news_info',topmarketing:'.info_time, .info-time, .article-time, .time',niaogebiji:'.writeTime3',opp2:'article time, .entry-header time',brain:'.article-date, .post-date, .news-date'};
export function readArticleMetadata(html,source={},now=Date.now()){
 const $=load(html);let date;
 if(source.key==='adguider')date=publicationDate(html.match(/"caCreateTime"\s*:\s*"([^"]+)"/)?.[1]);
 if(source.key==='media360'){const m=$('.time').first().text().match(/(\d{2})\.(\d{2})\.(\d{2})/);if(m)date=publicationDate(`20${m[3]}-${m[1]}-${m[2]}`);}
 if(source.key==='topmarketing'){const raw=$('.report_2_2').first().text().trim(),relative=raw.match(/^(\d+)\s*(分钟|小时|天)前$/);date=relative?new Date(now-Number(relative[1])*({'分钟':60000,'小时':3600000,'天':86400000}[relative[2]])).toISOString():publicationDate(raw);}
 for(const selector of ['meta[property="article:published_time"]','meta[name="pubdate"]','meta[name="publishdate"]','meta[name="PublishDate"]','meta[name="publication_date"]','meta[itemprop="datePublished"]','time[datetime]',dateSelectors[source.key]]){
  if(date)break;
  if(!selector)continue;const el=$(selector).first();const raw=el.attr('content')||el.attr('datetime')||el.text().trim();date=publicationDate(raw)||publicationDate(raw.match(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/)?.[0]);if(date)break;
 }
 $('script[type="application/ld+json"]').each((_,e)=>{try{const walk=v=>{if(!v||typeof v!=='object')return;if(!date&&/Article|Posting|NewsArticle/.test(v['@type']||''))date=publicationDate(v.datePublished);for(const child of Object.values(v))if(typeof child==='object')Array.isArray(child)?child.forEach(walk):walk(child);};walk(JSON.parse($(e).text()));}catch{}});
 // Public article headers from older CMSes use a named date span, not schema.org.
 if(!date){const h=$('h1').first();for(const el of [h.parent(),h.parent().parent()]){const candidate=el.find('[class*="time"],[class*="date"],[class*="Time"],[class*="Date"]').first().text().trim();date=publicationDate(candidate.match(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/)?.[0]);if(date)break;}}
 if(!date&&['meihua','warc'].includes(source.key)){const h=$('h1').first(),header=h.parent().parent().clone();header.find('script,style,img').remove();const headerText=header.text().replace(h.text(),'').trim().slice(0,140);date=publicationDate(headerText.match(/20\d{2}-\d{2}-\d{2}|\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d{2}/)?.[0]);}
 const title=$('meta[property="og:title"]').attr('content')||$('h1').first().text()||(source.key==='topmarketing'?$('.xiang_tit').first().text():'');
 const excerpt=$('meta[name="description"]').attr('content')||$('meta[property="og:description"]').attr('content')||$('article p,.article-content p,.article_content p').filter((_,e)=>$(e).text().trim().length>50).first().text();
 return {publishedAt:date,title:title?.replace(/\s*[-_|]\s*(广告门|数英|TOPYS).*$/,'').trim(),excerpt:excerpt?.trim().slice(0,280),image:$('meta[property="og:image"]').attr('content')};
}

const paths={topys:/^\/article\/\d+/,adguider:/^\/case\?id=/,meihua:/^\/(?:article|shots)\/\d+/,digitaling:/^\/(?:articles|projects)\/\d+/,topmarketing:/^\/info\d+/,brain:/^\/news\/articlecontent\?ID=/i,media360:/^\/article\/info\/\d+/,warc:/^\/(?:feed|content|newsandopinion)\//,niaogebiji:/^\/article-\d+/,shichangbu:/^\/know_info\/\d+/,adquan:/^\/article\/\d+/};
export function articlePath(url,source){const u=new URL(url);if(paths[source.key])return paths[source.key].test(u.pathname+u.search);return /\/(?:article|articles|posts?|news|detail|cases?|insights|marketing|branding|creativity|[a-z0-9]+-[a-z0-9-]+|\d{4,})/i.test(u.pathname)&&! /\/(?:tag|category|author|search|login|about|contact|page|product|company|people|user|jobs|services|newsletters)(?:\/|$)/.test(u.pathname);}
