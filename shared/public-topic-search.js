import {consumerContent,excludedTopic,excludedSearchSource} from '../integrations/hot-monitor/consumer-market.mjs';
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
const concreteAction=/联[名动乘]|聯[名動乘]|快[闪閃]|推出|新品|发售|首[秀店发展]|发布|代言|開賣|限定|品牌大使|营销|贊助|赞助|上市|官宣|销量|首映|跨界|collection|launch|collab|partnership|merchandise|pop.up|campaign/i;
const action=/首发|宣布|签约|上新|预售|启幕|上市|首店|開售|開賣|贊助|贊助商|開店|联名|聯名|联动|聯動|联乘|聯乘|合作|发布|推出|快闪|快閃|代言|新品|限定|周边|周邊|授[权權]|首店|首发|展[覽览]|冠名|赞助|活动|品牌活动|发售|開幕|上市|销量|新品|打卡|collab|licens|launch|collection|pop.up|sponsor|campaign|partner|flagship|limited.edition|merchandise|コラボ|発売/i;
const noise=/停止开展|全保护区|封山|禁止露营|关闭通告|应急部门|硬科技|飞猪|新发展理念|加快建设|政府工作|调研座谈|产业协同新图景|产业规模创新高|示范单位|长征路|示范区|贯彻|贯彻落实|促进经济|提振消费举措|新能源汽车下乡|无人机|科创板|大疆|芯片|智能戒指|智能硬件|机器人|千问|经验交流会|干部|招商引资|行业大会召开|国民经济|股民|炒作|芯片|半导体|算力|行业研报|股票|涨停|股价|概念板块|个股|券商|盘前|基金净值|上市公司公告|AI硬件|智能硬件|大盘|AI漫剧|AI模型|大模型|概念股|科技公司|电竞显卡|political campaign|beginner.s guide|优惠攻略|是什么意思|百科|游戏下载|免费下载|金融产品|大疆.{0,12}涨价|军事|政党|电竞鼠标|OpenAI|科技股|炒股|点此购买|优惠券|coupon code|election campaign/i;
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
const channels=[
 {names:['小红书','小紅書','rednote','xiaohongshu'],hosts:['xiaohongshu.com','xhslink.com']},
 {names:['抖音','douyin'],hosts:['douyin.com']},
 {names:['哔哩哔哩','哔哩','b站','bilibili'],hosts:['bilibili.com']},
 {names:['微博','weibo'],hosts:['weibo.com','weibo.cn']},
 {names:['instagram'],hosts:['instagram.com']},
 {names:['tiktok'],hosts:['tiktok.com']}
];
const trendRequest=/爆款|爆品|热卖|热销|卖爆|走红|出圈|热门|人气|受欢迎|火爆|爆火|最火|很火|火了|viral/giu;
const traction=/爆款|爆品|热卖|热销|卖爆|走红|出圈|刷屏|爆单|售罄|售空|断货|卖断|疯抢|热搜|热议|人气飙升|登顶|冲上.{0,8}榜|销量.{0,8}(?:增长|翻倍|突破|过万)|[\d.]+\s*[万亿千百][+余多]?\s*(?:次?(?:浏览|点赞|收藏|播放)|条(?:讨论|笔记)|件售出)|(?:售出|卖出).{0,8}[万亿]|went viral|sold out|best.sell(?:er|ing)/iu;
export function describeTopic(query){
 const raw=norm(query),platforms=channels.filter(c=>c.names.some(n=>raw.includes(n)));
 const popular=Boolean(raw.match(trendRequest));
 if(!platforms.length&&!popular)return null;
 let subject=raw.replace(trendRequest,' ');
 for(const platform of platforms)for(const name of platform.names)subject=subject.replaceAll(name,' ');
 subject=subject.replace(/请(?:帮我)?|帮我|看看|查一下|搜索|最近|近期|有哪些|有什么|哪些|关于|平台上?|上面|品牌案例|营销案例|品牌动态|的(?:品牌|产品|商品|案例)(?=$|[？?\s])|^[\s上的]+|[\s的？?。]+$/gu,' ').trim();
 const subjects=subject.split(/\s+/u).map(w=>w.replace(/^的|的$/gu,'')).filter(w=>w&&!/^(?:在|上|的|品牌|商品|产品|案例|什么|比较|最)$/u.test(w));
 const facets=[];
 for(let word of subjects){
   for(const group of vocabulary){
     const alias=group.filter(t=>word.includes(norm(t))).sort((a,b)=>b.length-a.length)[0];
     if(alias){facets.push(group);word=word.replace(norm(alias),'');}
   }
   if(word)facets.push([word]);
 }
 const base=[...platforms.map(c=>c.names[0]),...subjects].join(' ');
 const probes=[...new Set((popular?['爆款','种草','售罄']:['品牌','新品']).map(w=>(base+' '+w).trim()))];
 return {platforms,facets,popular,probes,base};
}
export function descriptionMatches(plan,row){
 if(!plan)return true;
 const title=norm([row.title,row.originalTitle].join(' ')),body=norm(row.content||row.summary||row.excerpt);
 let host='';
 try{host=new URL(row.url).hostname;}catch{}
 // Headlines supply context for excerpts. Keep distant, unrelated body mentions apart.
 const sentences=body.split(/[。！？!?]|(?<=\.)\s+/u);
 const onPlatform=c=>c.hosts.some(h=>host===h||host.endsWith('.'+h));
 const positiveSignal=text=>traction.test(text.replace(/(?:如何|怎样|有望|有潜力|力争|争取|希望|尚未|并未|目标是)(?:做出|打造|成为|实现)?(?:一款|下一个)?(?:爆款|爆品|走红|出圈|售罄)/gu,''));
 return sentences.some((sentence,i)=>{
   const passage=title+' '+sentence+' '+(sentences[i+1]||'');
   if(!plan.facets.every(f=>f.some(term=>passage.includes(norm(term)))))return false;
   if(!plan.popular)return plan.platforms.every(c=>onPlatform(c)||c.names.some(n=>passage.includes(n)));
   if(!positiveSignal(passage))return false;
   return plan.platforms.every(c=>onPlatform(c)||[sentence,sentences[i+1]||''].some(line=>{
     const evidence=title+' '+line;
     return c.names.some(n=>evidence.includes(n))&&positiveSignal(evidence);
   }));
 });
}
function campaignLeads(title){
 const partners=[...title.matchAll(/([A-Za-z][A-Za-z0-9.'’ -]{1,22}?)\s+(?:x|×|✕)\s+([A-Za-z][A-Za-z0-9'.’-]{2,22})/gi)].flatMap(m=>[m[2],m[1].trim()]);
 const quoted=[...title.matchAll(/[《「“]([^》」”]{2,18})[》」”]/gu)].map(m=>m[1]);
 const brands=[...title.matchAll(/\b(?:[A-Z][A-Za-z0-9'.’-]{2,})(?: [A-Z][A-Za-z'.’-]+){0,2}\b/g)].map(m=>m[0]).filter(t=>!/^EP\d+|^IP$|^CEO$|^Special$/i.test(t));
 return [...new Set([...partners,...quoted,...brands])].filter(t=>!noise.test(t));
}
function titleKey(t){return norm(t).replace(/(?:\s*[|｜]\s*[^|｜]{2,20})$/u,'').replace(/[^\p{L}\p{N}]/gu,'');}
const defaults=[
 ['户外生活 OutSiDers','https://www.outsiders.com.tw','zh'],['电影与文化 Hypesphere','https://hypesphere.com','zh'],
 ['风格志 Style Master','https://www.stylemaster.com.tw','zh'],['明周时尚','https://www.mings.hk','zh'],
 ['户外生活 Camping with Style','https://campingwithstyle.co.uk','en'],
 ['潮流文化 COOL','https://www.cool-style.com.tw/wd2','zh'],['青木瓜 A Day','https://www.adaymag.com','zh'],
 ['日本生活 SoraNews24','https://soranews24.com','en'],['亚洲品牌传播','https://www.brandinginasia.com','en'],
 ['玩具行业 Toy Book','https://toybook.com','en'],['品牌传播 MarComm','https://marcommnews.com','en'],
 ['消费研究 Daxue','https://daxueconsulting.com','en'],['动漫产业 AnimeHunch','https://animehunch.com','en'],
 ['球鞋资讯','https://sneakerbardetroit.com','en'],['乐高社区 The Brick Fan','https://www.thebrickfan.com','en'],
 ['食品饮料资讯','https://fabnews.live','en'],['授权行业 Licensing Source','https://www.licensingsource.net','en']
];
// These are first-party, date-filterable publication searches, grouped by editorial beat.
const specialistDesks=[
 [/设计|設計|品牌形象|包装|包裝|标[志识]|視覺|视觉|吉祥物|design|packaging|identity|logo/i,[
  ['标志情报局','www.logonews.cn','cn'],['包装设计 Dieline','thedieline.com'],['Design Week','www.designweek.co.uk'],['DesignWanted','designwanted.com']]],
 [/美妆|美妝|护肤|香水|香氛|护发|化妆|美容|奢侈|免税|beauty|perfume|fragrance|cosmetic|luxury/i,[
  ['全球美妆行业新闻','www.globalcosmeticsnews.com'],['旅购行业 Moodie Davitt','www.moodiedavittreport.com'],['旅行零售 TRBusiness','www.trbusiness.com'],['生活风格 ZTYLEZ','ztylez.com','tw']]],
 [/服[饰装]|潮牌|街头|时[装尚]|穿搭|奢侈|箱包|fashion|apparel|luxury|streetwear/i,[
  ['时尚媒体 DSCENE','www.designscene.net'],['时装周日报','fashionweekdaily.com'],['Fashionotography','www.fashionotography.com'],['MILK X','www.milkx.com','tw']]],
 [/运动|運動|跑步|跑鞋|球鞋|户外|戶外|露营|足球|篮球|网球|匹克球|体育|运动员|sneaker|sport|outdoor|camping|running/i,[
  ['勘履者 KENLU','www.kenlu.net','tw'],['运动社区 Fitz','fitz.hk','tw'],['Sneaker News','sneakernews.com'],['SportsPro','www.sportspro.com'],['运动用品行业 SGB','sgbonline.com'],['球鞋文化 Modern Notoriety','modernnotoriety.com']]],
 [/食品|饮[料品]|咖啡|茶饮|茶|乳品|零食|巧克力|烘焙|啤酒|餐饮|coffee|snack|food|drink|beer/i,[
  ['小食代','www.foodinc.com.cn','cn'],['咖啡独立媒体 Sprudge','sprudge.com'],['消费品行业 FMCG CEO','www.fmcgceo.co.uk']]],
 [/营销|投放|社媒|内容策略|广告|消费者洞察|marketing|brand strategy|advertising|social media/i,[
  ['Digiday','digiday.com'],['赛斯·高汀','seths.blog'],['MarTech','martech.org'],['Hootsuite Blog','blog.hootsuite.com'],['Search Engine Journal','www.searchenginejournal.com']]],
 [/潮玩|二次元|动漫|动画|谷子|玩具|授权|联名|角色扮演|漫画|游戏|IP|cosplay|anime|toy|comic|licensing/i,[
  ['流行文化 Bleeding Cool','bleedingcool.com'],['球鞋文化 Modern Notoriety','modernnotoriety.com']]],
 [null,[['世界品牌论坛','brandingforum.org'],['广告周刊 Adweek','www.adweek.com'],['广告营销 B&T','www.bandt.com.au'],['亚洲零售观察','insideretail.asia'],['美国零售观察','insideretail.us'],['英国零售公报','www.retailgazette.co.uk']]]
];
const toPublisher=([name,host,lang])=>[name,'https://'+host,lang||'en'];
export const industryPublishers=[...new Map(specialistDesks.flatMap(([,rows])=>rows.map(r=>[r[1],toPublisher(r)]))).values()];
export function desksForTopic(terms){
 const subject=terms.join(' '),matching=specialistDesks.filter(([rule])=>rule&&rule.test(subject));
 const desks=(matching.length?[...matching,specialistDesks.at(-1)]:specialistDesks).flatMap(([,rows])=>rows);
 return [...new Map(desks.map(r=>[r[1],toPublisher(r)])).values()];
}
const regionalWords=[['包装','包裝'],['设计','設計'],['联名','聯名'],['球鞋','球鞋'],['越野跑','越野跑'],['户外','戶外'],['露营','露營'],['运动','運動'],['咖啡','咖啡'],['动漫','動漫'],['二次元','二次元'],['亚文化','次文化'],['玩具','玩具'],['护肤','護膚'],['美妆','美妝'],['品牌','品牌'],['时尚','時尚'],['快闪','快閃'],['网球','網球'],['匹克球','匹克球']];
function deskTerm(src,q,terms,en){
 if(src[2]==='cn')return q;
 if(src[2]==='tw'){
   const match=regionalWords.find(([word])=>q.includes(word));
   return match?q.replaceAll(match[0],match[1]):q;
 }
 return en||q;
}
// Limits simultaneous connections; a slow publication cannot block the first results from the others.
export async function visitIndustryDesks(desks,visit,signal){
 let next=0;
 async function worker(){while(next<desks.length&&!signal?.aborted)await visit(desks[next++]);}
 await Promise.all(Array.from({length:Math.min(5,desks.length)},worker));
}
export async function industryArticles(src,term,signal){return wordpress(src,term,signal);}
export async function searchIndustryArticles(query,terms,english){
 const rows=[];let answered=0;
 await visitIndustryDesks(desksForTopic(terms),async src=>{
   try{const batch=await wordpress(src,deskTerm(src,query,terms,english));answered++;rows.push(...batch.map(r=>({...r,source:'editorial',firstPartyFeed:true})));}catch{}
 });
 if(!answered)throw Error('行业出版方暂不可读');
 return rows;
}
export async function chinesePress(term,signal,page=1,sort='time'){
 const kind='cmsArticleWebOld',param={uid:'',keyword:term,type:[kind],client:'web',clientType:'web',clientVersion:'curr',
   param:{[kind]:{searchScope:'default',sort,pageIndex:page,pageSize:50,preTag:'',postTag:''}}};
 const url=new URL('https://search-api-web.eastmoney.com/search/jsonp');
 url.search=new URLSearchParams({cb:'cue',param:JSON.stringify(param)});
 const response=await fetch(url,{credentials:'omit',signal:AbortSignal.any([AbortSignal.timeout(12000),...(signal?[signal]:[])])});
 if(!response.ok)throw Error('中文报道索引 HTTP '+response.status);
 const envelope=(await response.text()).trim().match(/^cue\(([\s\S]+)\);?$/);
 if(!envelope)throw Error('中文报道格式不可读');
 const payload=JSON.parse(envelope[1]),rows=payload.result?.[kind];
 if(payload.code!==0||!Array.isArray(rows))throw Error('中文报道索引暂不可读');
 return rows.map(r=>({title:clear(r.title),content:clear(r.content),url:r.url?.replace(/^http:\/\//,'https://'),
    publisher:r.mediaName||'东方财富',attribution:r.mediaName,publishedAt:String(r.date).replace(' ','T')+'+08:00',image:r.image||undefined}));
}
async function readerSearch(term,signal){
 const u=new URL('https://public-api.wordpress.com/rest/v1.1/read/search');
 u.search=new URLSearchParams({q:term,number:'20'});
 const data=await getJson(u,signal);if(!Array.isArray(data.posts))throw Error('出版搜索暂不可用');
 return data.posts.map(p=>({url:p.URL,title:clear(p.title),content:clear(p.excerpt||p.content).slice(0,500),publishedAt:p.date,publisher:p.site_name||undefined}));
}
async function podcasts(term,signal){
 const u=new URL('https://itunes.apple.com/search');
 u.search=new URLSearchParams({term,media:'podcast',entity:'podcastEpisode',country:'cn',limit:'100'});
 const data=await getJson(u,signal);if(!Array.isArray(data.results))throw Error('节目目录暂不可用');
 return data.results.map(p=>({url:p.trackViewUrl,title:clear(p.trackName),content:clear(p.description).slice(0,650),publishedAt:p.releaseDate,publisher:p.collectionName}));
}
async function getJson(url,signal){
 const r=await fetch(url,{credentials:'omit',signal:AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])])});if(!r.ok)throw Error('HTTP '+r.status);return r.json();
}
export async function publicNews(term,signal,recent=false){
 const bing=new URL('https://www.bing.com/news/search');bing.search=new URLSearchParams({q:term,format:'rss',setlang:'zh-CN'});
 if(recent){bing.searchParams.set('qft','interval="9"');bing.searchParams.set('sortbydate','1');}
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
 try{const d=await getJson(u,signal);const result=(d[0]||[]).map(r=>r[0]).join('').trim();if(result)return result;}catch{}
 if(signal?.aborted)throw signal.reason;
 const from=to==='en'?'zh-CN':/[ぁ-ヿ]/.test(text)?'ja':'en';
 const backup=new URL('https://api.mymemory.translated.net/get');backup.search=new URLSearchParams({q:text,langpair:from+'|'+to});
 const result=await getJson(backup,signal);return Number(result.responseStatus)===200?clear(result.responseData?.translatedText):'';
}
export async function publicTopicSearch(q,{index=[],publishers=[],signal,limit=Infinity,onProgress,supplement}={}){
 q=q.trim().slice(0,100);if(!q)throw Error('请输入主题');
 const description=describeTopic(q);
 const terms=description?[...new Set([q,...description.platforms.flatMap(c=>c.names),...description.facets.flat()])]:topicTerms(q),now=Date.now(),coverage=[],found=new Map(),inspected=new Set(),origins=new Set();
 const indexByUrl=new Map(index.map(r=>[r.url,r]));
 const relevant=(r)=>{
   if(description)return descriptionMatches(description,r);
   let text=norm([r.title,r.originalTitle,r.content].join(' '));
   // Some flower and fruit cultivar names contain the fragrance keyword but refer to crops.
   if(terms.includes('perfume')&&!/百合|柠檬|檸檬|椰|月季|菠萝|菠蘿/.test(q)){
     text=text.replace(/香水(?:百合|[柠檸][檬檸]|椰[子青]?|月季|菠[萝蘿])/gu,' ');
   }
   return terms.some(t=>text.includes(norm(t)));
 };
 function accept(rows,name,live){
   let count=0;
   for(const row of rows){
     if(excludedSearchSource(row))continue;
     const url=urlOf(row.url);
     if(row.indexedDate){const dated=indexByUrl.get(url);if(!dated)continue;row.publishedAt=dated.publishedAt;}
     const at=Date.parse(row.publishedAt);if(!url||clear(row.title).length<7||!(at<=now&&now-at<=30*day))continue;
     const publisher=row.publisher||new URL(url).hostname.replace(/^www\./,'');inspected.add(url);origins.add(row.issuerChannel||new URL(url).hostname.replace(/^www\./,''));
     const titleHit=relevant({...row,content:''});
     const passages=clear(row.content).split(/[。！？!?]|(?<=\.)\s+/u);
     if(!relevant(row)||!consumerContent(row)||excludedTopic(row.title)||noise.test(row.title))continue;
     if(!action.test([row.title,row.content].join(' '))&&!(description?.popular&&traction.test([row.title,row.content].join(' '))))continue;
     if(!titleHit&&!description){
       if(!live&&row.source==='editorial'&&!row.originalTitle)continue;
       if(!concreteAction.test(row.title)&&!campaignLeads(row.title).length)continue;
       if(!concreteAction.test(row.title)&&!passages.some(line=>relevant({title:line})&&concreteAction.test(line)))continue;
       if(!passages.some(line=>relevant({title:line})&&action.test(line)))continue;
     }
     count++;const old=found.get(url);if(!old||live&&!old.live)found.set(url,{...row,url,publisher,source:'editorial',live,publishedAt:new Date(at).toISOString()});
   }
   coverage.push({name,read:rows.length,count,status:live?'本次联网':'近期索引'});
   if(onProgress&&count&&!signal?.aborted)void compose(false).then(onProgress);
 }
 const lane=async(name,task)=>{try{accept(await task,name,true)}catch(e){if(signal?.aborted)return;coverage.push({name,read:0,count:0,status:'暂不可用',reason:e.message||'连接失败'})}};
 const groups=terms.filter(t=>t!==norm(q)),cn=groups.filter(t=>han.test(t));
 const focus=cn.find(x=>norm(x)!==norm(q)&&/漫|露營|香氛/.test(x))||cn[0]||q;
 const probes=description?[q,...description.probes]:[q,q+' 联名',q+' 新品',focus+' 品牌',...(cn.length?[cn[0]+' 联名']:[])];
 const tasks=[lane('近期新闻 · '+q,publicNews(q,signal,true)),lane('独立作者与出版物',readerSearch(q,signal)),lane('播客公开访谈',podcasts(q,signal))];
 const pressTerms=description?[...new Set([q,...description.probes])]:[...new Set([q,...cn.filter(t=>q.includes(t)&&t!==q)])].slice(0,3);
 if(description?.popular){
   const signalTerm=(description.base+' 浏览量').trim();
   tasks.push(lane('中文媒体相关报道 · '+signalTerm,chinesePress(signalTerm,signal,1,'default')));
 }
 for(const term of pressTerms)tasks.push(lane('中文媒体 · '+term,(async()=>{
   const first=await chinesePress(term,signal);
   const last=Date.parse(first.at(-1)?.publishedAt);
   return first.length===50&&last>=now-30*day?[...first,...await chinesePress(term,signal,2).catch(()=>[])]:first;
 })()));
 const newsQueries=[...new Set(probes.slice(1).reverse())];
 tasks.push((async()=>{for(const t of newsQueries){if(signal?.aborted)break;await lane('公开新闻 · '+t,publicNews(t,signal));}})());
 let en=description?undefined:terms.find(x=>/^[a-z][a-z '’-]*$/i.test(x));
 if(!en&&han.test(q)){try{en=await translate(q,'en',signal);if(en)terms.push(en);}catch{}}
 if(en&&han.test(q))tasks.push(lane('海外独立出版',readerSearch(en,signal)));
 if(en&&han.test(q))tasks.push(lane('海外新闻 · '+en,publicNews(en+' collaboration',signal)));
 tasks.push(lane('国际新闻索引',international(en||q,signal)));
 const hash=Array.from(q).reduce((n,c)=>n*31+c.codePointAt(0)>>>0,0),queriedSites=new Set();
 function searchPublishers(list,max){
   const unique=new Map();
   for(const row of list||[]){
     if(!Array.isArray(row)||!/^https:\/\//.test(row[1]))continue;
     try{const host=new URL(row[1]).hostname;if(!queriedSites.has(host))unique.set(host,row);}catch{}
   }
   const rows=[...unique.entries()],rotation=max<rows.length?hash%rows.length:0;
   return [...rows.slice(rotation),...rows.slice(0,rotation)].slice(0,max).map(([site,src])=>{
     queriedSites.add(site);
     const term=src[2]==='zh'?(cn.find(x=>/[聯營動漫]/.test(x))||cn[0]||q):en||q;
     return lane(src[0],wordpress(src,term,signal));
   });
 }
 const specialist=desksForTopic([q,...terms]);
 for(const src of specialist)queriedSites.add(new URL(src[1]).hostname);
 tasks.push(visitIndustryDesks(specialist,src=>lane(src[0],wordpress(src,deskTerm(src,q,terms,en),signal)),signal));
 tasks.push(...searchPublishers(defaults,defaults.length),...searchPublishers(publishers,6));
 const addIndex=rows=>{
   if(!rows.length)return;
   for(const r of rows)indexByUrl.set(r.url,r);
   accept(rows.map(r=>({...r,content:r.content||r.summary||r.excerpt})), '已核验原文索引',false);
 };
 addIndex(index);
 if(supplement)tasks.push(supplement.then(async extra=>{if(signal?.aborted)return;addIndex(extra.items||[]);await Promise.all(searchPublishers(extra.publishers,6));}));
 await Promise.all(tasks);signal?.throwIfAborted();
 const leads=[...new Set([...found.values()].filter(r=>r.live&&relevant({...r,content:''})).sort((a,b)=>Number(action.test(b.title))-Number(action.test(a.title))).flatMap(r=>campaignLeads(r.title)).filter(t=>!terms.includes(norm(t))))].slice(0,3);
 await Promise.all(leads.flatMap(n=>[lane('中文媒体追踪 · '+n,chinesePress(n,signal)),lane('活动与 IP 后续 · '+n,publicNews(q+' '+n,signal))]));
 return compose(true);
 async function compose(final){
 const caseWeight=r=>(relevant({...r,content:''})?4:0)+(action.test(r.title)?4:0)+(r.live?3:0)+(r.content?1:0);
 const ranked=[...found.values()].sort((a,b)=>caseWeight(b)-caseWeight(a)||Number(b.live)-Number(a.live)||Number(han.test(b.title)&&!/[ぁ-ヿ]/u.test(b.title))-Number(han.test(a.title)&&!/[ぁ-ヿ]/u.test(a.title))||Number(relevant({...b,content:''}))-Number(relevant({...a,content:''}))||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 const grouped=new Map();
 for(const hit of ranked){
   const archived=indexByUrl.get(hit.url);
   const row=hit.live&&archived?.originalTitle===hit.title&&han.test(archived.title)?{...hit,originalTitle:hit.title,title:archived.title}:hit;
   const k=titleKey(row.originalTitle||row.title);if(!k)continue;const r={title:row.title,url:row.url,publisher:row.publisher,publishedAt:row.publishedAt};
   if(grouped.has(k))grouped.get(k).reports.push(r);else {
     const variants=row.title.match(/[《「“]([^》」”]{3,24})[》」”]/gu)||[];
     const initials=row.title.match(/(?:[A-Z][A-Za-z0-9]{2,})|[\u3400-\u9fff]{2,6}(?=联名|联动|携手)/gu)||[];
     const match=[...grouped.values()].find(v=>Math.abs(Date.parse(v.publishedAt)-Date.parse(row.publishedAt))<4*day&&variants.some(w=>v.title.includes(w))&&initials.some(w=>v.title.toLowerCase().includes(w.toLowerCase())));
     if(match)match.reports.push(r);else grouped.set(k,{...row,reports:[r,...(row.reports||[]).filter(report=>report.url!==r.url&&!excludedSearchSource(report))]});
   }}
 const picked=[...grouped.values()].slice(0,limit*2);
 if(final)await visitIndustryDesks(picked.filter(r=>!han.test(r.title)||/[ぁ-ヿ]/.test(r.title)),async r=>{try{const title=await translate(r.title,'zh-CN',signal);if(han.test(title)){r.originalTitle=r.title;r.title=title;}}catch{}if(!han.test(r.content))r.content='';},signal);
 const results=picked.filter(r=>han.test(r.title)&&!/[ぁ-ヿ]/u.test(r.title)).slice(0,limit);
 for(const r of results){
   const sources=new Set(r.reports.map(x=>new URL(x.url).hostname)).size;
   const grounds=['可回到原文','有明确发布日期',...(r.live?['本次联网命中']:[]),...(sources>1?['有其他报道可对读']:[])];
   r.review={score:Math.min(95,55+(r.live?10:0)+(r.content?8:0)+Math.min(3,sources)*5),grounds,accepted:true};
 }
 return {results,relatedArticles:[],brief:{searching:!final,coverage:[...coverage],reach:{readOrigins:origins.size,readArticles:inspected.size,liveCases:results.filter(r=>r.live).length}}};
}
}
