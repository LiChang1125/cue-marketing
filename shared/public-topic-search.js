// Public GET endpoints only. The same transport runs in browsers and in the Agent connector.
const day=86400000;
const vocabulary=[
 ['二次元','亚文化','次文化','動漫','动漫','动漫IP','漫画','漫展','谷子','角色扮演','cosplay','anime'],
 ['露营','露營','camping','キャンプ'],['香水','香氛','perfume','fragrance'],['潮玩','盲盒','玩具','designer toy'],
 ['越野跑','trail running','越野賽'],['抹茶','matcha'],['咖啡','coffee'],['时尚','時尚','fashion'],
 ['无酒精啤酒','無酒精啤酒','non-alcoholic beer'],['烘焙','麵包','烘焙店','bakery'],['户外','戶外','outdoor'],
 ['联名','聯名','联乘','跨界','collaboration'],['快闪','快閃','pop-up'],['球鞋','运动鞋','sneaker']
];
const han=/[\u3400-\u9fff]/u;
const action=/首发|宣布|签约|上新|预售|启幕|上市|首店|開售|開賣|贊助|贊助商|開店|联名|聯名|联动|聯動|联乘|聯乘|合作|发布|推出|快闪|快閃|代言|新品|限定|周边|周邊|授[权權]|首店|首发|展[覽览]|冠名|赞助|活动|品牌|发售|開幕|上市|销量|新品|打卡|collab|licens|launch|collection|pop.up|sponsor|campaign|partner|flagship|limited.edition|merchandise|コラボ|発売/i;
const noise=/AI漫剧|AI模型|大模型|概念股|科技公司|电竞显卡|political campaign|beginner.s guide|优惠攻略|是什么意思|百科|游戏下载|免费下载|金融产品|大疆.{0,12}涨价|军事|政党|电竞鼠标|OpenAI|科技股|炒股|点此购买|优惠券|coupon code|election campaign/i;
const clear=t=>String(t||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#0?39;|&#8217;|&rsquo;/g,'’').replace(/&#8211;/g,'–').replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const norm=t=>clear(t).normalize('NFKC').toLowerCase();
function urlOf(raw){
 try{let u=new URL(raw);if(u.hostname.endsWith('.bing.com')&&u.pathname==='/news/apiclick.aspx')u=new URL(u.searchParams.get('url'));
 if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.pathname==='/')return;
 u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^spm$/i.test(k))u.searchParams.delete(k);return u.href;}catch{}
}
export function topicTerms(q){
 const text=norm(q),groups=vocabulary.filter(g=>g.some(w=>text.includes(w.toLowerCase())));
 return [...new Set([text,...groups.flat()])];
}
function titleKey(t){return norm(t).replace(/(?:\s*[|｜]\s*[^|｜]{2,20})$/u,'').replace(/[^\p{L}\p{N}]/gu,'');}
const defaults=[
 ['潮流文化 COOL','https://www.cool-style.com.tw/wd2','zh'],['青木瓜 A Day','https://www.adaymag.com','zh'],
 ['日本生活 SoraNews24','https://soranews24.com','en'],['亚洲品牌传播','https://www.brandinginasia.com','en'],
 ['玩具行业 Toy Book','https://toybook.com','en'],['品牌传播 MarComm','https://marcommnews.com','en'],
 ['消费研究 Daxue','https://daxueconsulting.com','en'],['动漫产业 AnimeHunch','https://animehunch.com','en'],
 ['球鞋资讯','https://sneakerbardetroit.com','en'],['乐高社区 The Brick Fan','https://www.thebrickfan.com','en'],
 ['食品饮料资讯','https://fabnews.live','en'],['授权行业 Licensing Source','https://www.licensingsource.net','en']
];
async function getJson(url,signal){
 const r=await fetch(url,{credentials:'omit',signal:AbortSignal.any([AbortSignal.timeout(9000),...(signal?[signal]:[])])});if(!r.ok)throw Error('HTTP '+r.status);return r.json();
}
export async function publicNews(term,signal){
 const bing=new URL('https://www.bing.com/news/search');bing.search=new URLSearchParams({q:term,format:'rss',setlang:'zh-CN'});
 const endpoint=new URL('https://api.rss2json.com/v1/api.json');endpoint.searchParams.set('rss_url',bing.href);
 const json=await getJson(endpoint,signal);if(json.status!=='ok'||!Array.isArray(json.items))throw Error('新闻索引暂不可读');
 return json.items.map(r=>({url:urlOf(r.link),title:clear(r.title),content:clear(r.description).slice(0,300),publishedAt:r.pubDate?.replace(' ','T')+'Z',image:r.thumbnail}));
}
async function international(term,signal){
 const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
 u.search=new URLSearchParams({query:term.replace(/["()]/g,' ')+' (campaign OR launch OR collaboration OR 联名 OR 新品)',mode:'artlist',format:'json',timespan:'30d',sort:'datedesc',maxrecords:'60'});
 const data=await getJson(u,signal);if(!Array.isArray(data.articles))throw Error('国际索引暂不可读');
 return data.articles.map(r=>({url:r.url,title:clear(r.title),publisher:r.domain,image:r.socialimage,publishedAt:r.seendate?.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/,'$1-$2-$3T$4:$5:$6Z'), indexedDate:true}));
}
async function wordpress([publisher,site],term,signal){
 const u=new URL(site.replace(/\/$/,'')+'/wp-json/wp/v2/posts');u.search=new URLSearchParams({search:term,after:new Date(Date.now()-30*day).toISOString(),per_page:'12',_fields:'link,title,excerpt,date_gmt'});
 const rows=await getJson(u,signal);if(!Array.isArray(rows))throw Error('来源未返回文章');
 return rows.map(r=>({url:urlOf(r.link),publisher,title:clear(r.title?.rendered),content:clear(r.excerpt?.rendered).slice(0,300),publishedAt:r.date_gmt+'Z'}));
}
async function translate(text,to,signal){
 const u=new URL('https://translate.googleapis.com/translate_a/single');u.search=new URLSearchParams({client:'gtx',sl:'auto',tl:to,dt:'t',q:text});
 const d=await getJson(u,signal);return (d[0]||[]).map(r=>r[0]).join('').trim();
}
export async function publicTopicSearch(q,{index=[],publishers=[],signal,limit=10}={}){
 q=q.trim().slice(0,100);if(!q)throw Error('请输入主题');
 const terms=topicTerms(q),now=Date.now(),coverage=[],found=new Map(),inspected=new Set(),origins=new Set();
 const indexByUrl=new Map(index.map(r=>[r.url,r]));
 const relevant=(r)=>terms.some(t=>norm([r.title,r.originalTitle,r.content].join(' ')).includes(norm(t)));
 function accept(rows,name,live){
   let count=0;
   for(const row of rows){
     const url=urlOf(row.url);
     if(row.indexedDate){const dated=indexByUrl.get(url);if(!dated)continue;row.publishedAt=dated.publishedAt;}
     const at=Date.parse(row.publishedAt);if(!url||!row.title||!(at<=now&&now-at<=30*day))continue;
     const publisher=row.publisher||new URL(url).hostname.replace(/^www\./,'');inspected.add(url);origins.add(row.issuerChannel||new URL(url).hostname.replace(/^www\./,''));
     if(!relevant(row)||noise.test(row.title)||!action.test([row.title,row.content].join(' ')))continue;
     count++;const old=found.get(url);if(!old||live&&!old.live)found.set(url,{...row,url,publisher,source:'editorial',live,publishedAt:new Date(at).toISOString()});
   }
   coverage.push({name,read:rows.length,count,status:live?'本次联网':'近期索引'});
 }
 const lane=async(name,task)=>{try{accept(await task,name,true)}catch(e){if(signal?.aborted)return;coverage.push({name,read:0,count:0,status:'暂不可用',reason:e.message||'连接失败'})}};
 const groups=terms.filter(t=>t!==norm(q)),cn=groups.filter(t=>han.test(t));
 const focus=cn.find(x=>norm(x)!==norm(q)&&/漫|露營|香氛/.test(x))||cn[0]||q;
 const probes=[q,q+' 联名',q+' 新品',focus+' 品牌',...(cn.length?[cn[0]+' 联名']:[])];
 const tasks=[...new Set(probes)].map(t=>lane('公开新闻 · '+t,publicNews(t,signal)));
 let en=terms.find(x=>/^[a-z][a-z '’-]*$/i.test(x));
 if(!en&&han.test(q)){try{en=await translate(q,'en',signal);if(en)terms.push(en);}catch{}}
 if(en&&han.test(q))tasks.push(lane('海外新闻 · '+en,publicNews(en+' collaboration',signal)));
 tasks.push(lane('国际新闻索引',international(en||q,signal)));
 const endpoints=[...new Map([...defaults,...publishers].filter(r=>Array.isArray(r)&&/^https:\/\//.test(r[1])).map(r=>[new URL(r[1]).hostname,r])).values()];
 const hash=Array.from(q).reduce((n,c)=>n*31+c.codePointAt(0)>>>0,0);
 const additional=endpoints.slice(defaults.length);
 const selected=[...endpoints.slice(0,defaults.length),...Array.from({length:Math.min(6,additional.length)},(_,i)=>additional[(hash+i)%additional.length])];
 for(const src of selected){const term=src[2]==='zh'?(cn.find(x=>/[聯營動漫]/.test(x))||cn[0]||q):en||q;tasks.push(lane(src[0],wordpress(src,term,signal)));}
 accept(index.map(r=>({...r,content:r.content||r.summary})), '已核验原文索引',false);
 await Promise.all(tasks);signal?.throwIfAborted();
 const anchors=[...found.values()].filter(r=>r.live).flatMap(r=>[...r.title.matchAll(/[《「“]([^》」”]{2,18})[》」”]/gu)].map(m=>m[1])).filter(t=>!terms.includes(t));
 const partners=[...found.values()].filter(r=>r.live).flatMap(r=>[...r.title.matchAll(/([\p{L}\d·]{2,14})\s*[×✕]\s*([\p{L}\d·]{2,14})/gu)].map(m=>m[1]+' '+m[2]));
 const leads=[...new Set([...partners,...anchors])].slice(0,2);
 await Promise.all(leads.map(n=>lane('活动与 IP 后续 · '+n,publicNews(q+' '+n,signal))));
 const ranked=[...found.values()].sort((a,b)=>Number(b.live)-Number(a.live)||Number(han.test(b.title)&&!/[ぁ-ヿ]/u.test(b.title))-Number(han.test(a.title)&&!/[ぁ-ヿ]/u.test(a.title))||Number(relevant({...b,content:''}))-Number(relevant({...a,content:''}))||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 const grouped=new Map();
 for(const row of ranked){const k=titleKey(row.originalTitle||row.title);if(!k)continue;const r={title:row.title,url:row.url,publisher:row.publisher,publishedAt:row.publishedAt};
   if(grouped.has(k))grouped.get(k).reports.push(r);else grouped.set(k,{...row,reports:row.reports?.length?row.reports:[r]});}
 const picked=[...grouped.values()].slice(0,limit*2);
 await Promise.all(picked.filter(r=>!han.test(r.title)||/[ぁ-ヿ]/.test(r.title)).map(async r=>{try{const title=await translate(r.title,'zh-CN',signal);if(han.test(title)){r.originalTitle=r.title;r.title=title;}}catch{}if(!han.test(r.content))r.content='';}));
 const results=picked.filter(r=>han.test(r.title)&&!/[ぁ-ヿ]/u.test(r.title)).slice(0,limit);
 for(const r of results){
   const sources=new Set(r.reports.map(x=>new URL(x.url).hostname)).size;
   const grounds=['可回到原文','有明确发布日期',...(r.live?['本次联网命中']:[]),...(sources>1?['有其他报道可对读']:[])];
   r.review={score:Math.min(95,55+(r.live?10:0)+(r.content?8:0)+Math.min(3,sources)*5),grounds,accepted:true};
 }
 return {results,relatedArticles:[],brief:{coverage,reach:{readOrigins:origins.size,readArticles:inspected.size,liveCases:results.filter(r=>r.live).length}}};
}
