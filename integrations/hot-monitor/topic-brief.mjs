import {topicTerms} from '../../shared/public-topic-search.js';
import {localizeSearchHeadlines,brokenCopy} from './search-headline.mjs';
import {regionalTerms,searchRegionalNews} from './regional-search.mjs';
import {subjectOf,phraseMatches,translatedSubject,probeFragments,subjectPassage} from './query-language.mjs';
import {searchNewswire,searchAsiaNewswire} from './newswire-search.mjs';
import {editorialBeat} from './subject-publications.mjs';
import {readArticleMetadata} from '../../server/media-metadata.js';
import {publisherText} from './open-news.mjs';
import {leadsFor,japaneseNews,relatedCampaigns,campaignMatch} from './search-leads.mjs';
import {consumerContent,excludedTopic} from './consumer-market.mjs';
import {searchMarketingNews} from './marketing-news.mjs';
import {webNews,webPages,publicWebArticles,internationalNews,worldNews} from './open-news.mjs';
import {eventCards} from './brand-events.mjs';
import {reviewEvidence} from './evidence-review.mjs';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {load} from 'cheerio';
import {biliTopic} from '../../server/community-topics.js';
import {publicMarketingPress} from '../../server/topic-search.js';
import {instagramPosts,brandSlug} from '../../server/instagram-mentions.js';
import {originalHref} from '../../shared/original.js';
import {topicKey} from '../../shared/community.js';
import {marketingWeight} from './marketing.mjs';

const day=86400000;
const themes=[
 {match:/^(cosplay|角色扮演|coser)$/i,terms:['cosplay','coser','角色扮演','角色扮裝','角色扮装','コスプレ','角色扮演者'],probes:['coser 签售','coser 联动','漫展 品牌 快闪','Cosplay 展会'],subs:['cosplay'],communityTerms:['collaboration','brand']},
 {match:/^(?:二次元(?:[抱爆]款)?)$/i,terms:['二次元','动漫周边','谷子','痛包','动漫IP','初音未来','吉伊卡哇','宝可梦','原神','anime','manga','pokemon','pokémon','hatsune miku','アニメ','グッズ'],probes:['二次元 爆款','谷子 售罄','动漫周边 联名'],subs:['AnimeFigures'],communityTerms:['release']},
 {match:/^(亚文化|次文化|subculture)$/i,terms:['亚文化','次文化','二次元','谷子','街头文化','街头潮流','街头','朋克','哥特','滑板','洛丽塔','潮牌','球鞋','streetwear','skateboard','sneaker','goth','punk','anime'],probes:['二次元 联名','滑板 联名','潮牌 联名'],subs:['Sneakers','streetwear'],communityTerms:['collab','collection']},
 {match:/^(香水|香氛|fragrance|perfume)$/i,terms:['香水','香氛','香薰','perfume','fragrance'],probes:['香水 联名','香氛 新品'],subs:['fragrance','Perfumes'],communityTerms:['launch','release']},
 {match:/^(潮玩|盲盒|designer toys)$/i,terms:['潮玩','盲盒','手办','潮流玩具','labubu','designer toy','blind box','pop mart'],probes:['潮玩 联名','盲盒 新品'],subs:['PopMartCollectors','Labubu'],communityTerms:['collab','release']},
 {match:/^(跑鞋|球鞋|运动鞋|sneakers)$/i,terms:['跑鞋','球鞋','运动鞋','sneaker','running shoe'],probes:['球鞋 联名','跑鞋 首发'],subs:['Sneakers','RunningShoeGeeks'],communityTerms:['collab','release']}
];
const actions=[
 ['联名合作',/联名|聯名|联乘|联动|联办|コラボ|联袂|携手|合作系列|跨界合作|\bcollab(?:oration)?\b|\bpartnership\b|[\w\p{Script=Han}]\s+[x×]\s+[\w\p{Script=Han}]/iu],
 ['线下体验',/PRイベント|衣装展示|周遊型|コスプレフェスタ|ポップアップ|展示を実施|签售|打卡体验|快闪|快閃|ポップアップ|签售会|主题店|旗舰店|限时店|线下活动|试营业|开幕|首秀|参展|亮相|启幕|正式营业|開催|宿泊プラン|\bpop[- ]up\b|flagship store/i],
 ['品牌传播',/キャンペーン|代言|品牌大使|广告片|品牌活动|品牌营销|营销活动|广告战役|\bcampaign\b|\bsponsor(?:ship|ed|s)?\b|\bambassador\b|\brebrand/i],
 ['消费表现',/即完売|売り切れ|售罄|断货|补货|销量|销售额|售出|热卖|sold out|sold through|restock/i],
 ['新品发售',/フィギュア化|フィギュア.{0,18}登場|受付開始|リバイバル上映|初開催|PRイベント|別注|販売開始|限定登場|登場|リニューアル|限定モデル|発売開始|限定発売|新作|新商品|レンタル開始|新登場|販売開始|新品|発売|開業|新設|開設|新発売|予約受付|販売スタート|開幕|オープン|新メニュー|プランの販売|限定販売|开业|上新|发布新品|首店|上市|发售|首发|開賣|正式上市|重磅发布|发布.{0,12}(?:系列|新品|新款|产品|模型)|推出|限量版|\blaunch(?:es|ed)?\b|\brelease[ds]?\b|capsule collection|renovation|newly renovated|now open|grand opening|(?:unveil|debut|introduce|open|renovate|sponsor)(?:s|d|ed)?\b/i]
];
const noise=/買えるGO OUT|チェックしたい.{0,6}モデル|値引きランキング|寵愛自己清單|值得买清单|秋冬好物清單|消費清單|购物攻略|review of the|香水评测|百科|是什么意思|入门教程|品牌大全|优惠码|购物清单|抄底推荐|捡漏买鞋|全网最低价|热点小时报|热点速递|今日热搜汇总|definition of|official site|wikipedia/i;
const entities=/Nike|Adidas|Vans|Puma|Converse|ASICS|Levi.?s|Balenciaga|HUF|Supreme|Disney|Pokémon|Nintendo|UNIQLO|Sephora|LEGO|Sanrio|Dior|Chanel|Gucci|泡泡玛特|任天堂|耐克|阿迪达斯|迪士尼|宝可梦|三丽鸥|星巴克|瑞幸|喜茶|优衣库|初音未来|原神|明日方舟|吉伊卡哇|高达|万代|名创优品|罗森|麦当劳|肯德基|霸王茶姬|海底捞|卡皮巴拉|陈冠希|香奈儿|迪奥/ig;
// Translations broaden a literal search while the event and date gates apply to every hit.
const marketVocabulary=[
 ['露营','露營','户外露营','camping','campsite','campground','キャンプ','テント','寝袋','焚き火','キャンプ場','帐篷','天幕','睡袋','帐篷露营','camping tent','sleeping bag','camp stove'],['户外','戶外','outdoor gear','outdoor apparel','アウトドア'],
 ['咖啡','coffee','コーヒー'],['冷萃','冷萃咖啡','cold brew','水出しコーヒー'],['香水','perfume','fragrance','フレグランス'],['护发','护发护理','haircare','hair care','ヘアケア'],
 ['茶饮','奶茶','bubble tea','ミルクティー'],['巧克力','chocolate','チョコレート'],['滑板','skateboard','skateboarding','スケートボード'],
 ['骑行','cycling','サイクリング'],['跑步','running','ランニング'],['防晒','sunscreen','sun care','日焼け止め'],['口红','lipstick','リップ'],
 ['街舞','street dance','ストリートダンス'],['珠宝','珠寶','jewelry','jewellery','ジュエリー'],['宠物食品','pet food','ペットフード'],
 ['玩具','toys','おもちゃ'],['桌游','board game','ボードゲーム'],['冰淇淋','ice cream','アイスクリーム'],['婚礼','wedding','ウェディング']
];
export const coversTerm=phraseMatches;
export function planTopic(query){
 const aliases=topicTerms(query);
 const recipe=themes.find(t=>t.match.test(query))||themes.find(t=>aliases.some(a=>t.match.test(a)));
 const vocab=marketVocabulary.find(terms=>terms.some(t=>t.toLowerCase()===query.toLowerCase()));
 return recipe||{terms:vocab||aliases,probes:[query+' 联名',query+' 品牌活动'],subs:['advertising','marketing'],communityTerms:[query]};
}
export function qualify(row,query,plan,now=Date.now()){
 const at=Date.parse(row.publishedAt),title=row.title||'',text=[title,row.content,row.originalTitle].filter(Boolean).join(' ');
 const specialist=editorialBeat(query,row);
 if(excludedTopic(query)||excludedTopic(title)||excludedTopic(row.originalTitle||'')||(!specialist&&!consumerContent(row))||!(at<=now&&at>=now-30*day)||noise.test(title)||noise.test(row.originalTitle||'')||!/^https?:\/\//.test(row.url||''))return null;
 const headlines=[title,row.originalTitle].filter(Boolean).join(' ');
 if(/聯名卡.{0,20}(?:回饋|刷卡)|联名卡.{0,20}返现|AliExpress|アリエクスプレス|阿里速卖通|ネット反響|ネット騒然|超可愛|美容文摘|beauty digest|新品推薦|盤點必買/i.test(headlines))return null;
 if(plan.terms.includes('camping')){
   const unrelated=/採用|ブートキャンプ|研修|boot ?camp|训练营|集训营|野球キャンプ|どきどきキャンプ|ジェイソン|映画|車中泊ミニバン/i;
   if(unrelated.test(headlines))return null;
   const subject=/露[营營]|camping|campsite|campground|キャンプ(?!招待)|キャンピング|寝袋|テント|焚き火|帐篷|tent collection|sleeping bag/i;
   const equipment=/露[营營](?:地|季|节|系列|装备|用品)|camping (?:equipment|gear|brand|campaign)|キャンプ(?:場|用品|用具|ギア|道具|イベント)|テント|寝袋|焚き火/i;
   if(!specialist&&!subject.test(headlines)){
     const subjectMatter=/野外|アウトドア|outdoor|户外|戶外|camp|露[营營]|Snow Peak|Coleman|CAPTAIN STAG|NANGA/i.test(headlines);
     if(!subjectMatter||!equipment.test(String(row.content||'').slice(0,400)))return null;
   }
 }
 const ipContext=/二次元|原神|初音未来|明日方舟|洛天依|手办|哥斯拉|痛包|潮牌|永雏塔菲|斯普拉遁|潮流玩具|街舞|街头|嘻哈|滑板|铁拳|格斗游戏|tekken/i;
 const namedQuery=brandSlug(query);
 const topicText=plan.terms.includes('coser')?text.replace(/角色扮演(?:类|型)?(?:游戏|手游|网游)/g,''):text;
 const topic=plan.terms.some(t=>coversTerm(topicText,t)||row.originalRead&&subjectPassage(String(row.content||'').slice(0,900),t))||(namedQuery&&coversTerm(topicText,namedQuery.replaceAll('-',' ')))
   ||(plan.terms.includes('亚文化')&&ipContext.test(text));
 const scoped=specialist||row.source==='reddit'&&(plan.curated||themes.includes(plan))&&plan.subs.some(s=>s.toLowerCase()===row.community?.toLowerCase());
 if(!topic&&!scoped)return null;
 const actionText=text.replace(/(?:并非|未曾|否认|并未|没有)(?:与|和)?.{0,40}?(?:合作|联动|联名)/g,'');
 const signal=actions.find(([,re])=>re.test(title)&&actionText.includes(title))||actions.find(([,re])=>re.test(actionText.slice(0,650)));
 if(!signal)return null;
 // An amenity in a list cannot substantiate a campaign about that amenity.
 // Use the original headline, since a localized excerpt may have become the card title.
 if(row.originalRead&&!scoped&&!plan.terms.some(t=>coversTerm(row.originalTitle||title,t))){
   const sentences=String(row.content||'').split(/(?<=[。！？!?])|(?<=\.)\s+|\n/u);
   const connected=sentences.some(s=>plan.terms.some(t=>subjectPassage(s,t))&&actions.some(([,re])=>re.test(s)));
   if(!connected)return null;
 }
 if(/[抱爆]款/.test(query)&&!/(?:周边|谷子|商店|商品|限定|门店|餐饮|销量|售罄|快闪|联名|联乘|联动|手办|立牌|徽章|盲盒|グッズ|フィギュア|コラボ|merch|collectible|figurine|sold out|collab|pop.up|retail)/i.test(text))return null;
 if(/グラビア|胸元|美ボディ|水着姿|美脚|ショーパン|ミニスカ|かわいすぎる|肌見せ|脚線美|大反響|セクシー|プロポーション|プレイバック|ポージングにこだわり/i.test(title)&&!/(?:コラボキャンペーン|ブランド大使|公式アンバサダー)/.test(text))return null;
 if(/回顾|プレイバック|政治問題|外交|セクシー|かわいすぎる|称賛の嵐|軟体アイドル|コスプレ失敗|官宣离婚/.test(title))return null;
 const parties=text.match(entities)||[];
 const named=parties.length||(/[「『][^」』]{2,30}[」』]/u.test(title)&&/コラボ|グッズ|キャンペーン|発売|限定|ポップアップ|フィギュア|衣装展示|PRイベント|コスプレフェスタ|即完売/.test(text))||/[\w\p{Script=Han}]{2,}\s+[x×与和]\s*[^\s]{2,}|[\p{Script=Han}A-Za-z]{2,10}(?:与|携手)[\p{Script=Han}A-Za-z]{2,12}|\b[A-Z][a-z]+ [A-Z][a-z]+\b/u.test(title);
 if(!named&&row.source!=='editorial'&&!(!plan.curated&&!themes.includes(plan)&&title.includes(query)&&query.length>=2))return null;
 const sentences=String(row.content||'').split(/(?<=[。！？!?])|\n/u);
 const relevant=sentences.filter(s=>plan.terms.some(t=>coversTerm(s,t)));
 const passage=relevant.find(s=>actions.some(([,re])=>re.test(s)))||(signal[1].test(title)?relevant[0]:undefined);
 if(passage&&!signal[1].test(title)&&!/《|「|[A-Z][a-z]+\s+[A-Z]|品牌|游园会|联名|官宣|见面会|活动|快闪|商场|限定|发布|主办|实地|市集|周年|コラボ|キャンペーン|公式|発売|撮影会|フェスタ|開催|collab|pop.up|brand campaign/i.test(passage)&&!parties.length)return null;
 if(!scoped&&!plan.terms.some(t=>coversTerm([title,row.originalTitle].join(' '),t))&&plan.terms.includes('camping')){
    if(!relevant.some(s=>s.length<420&&/キャンプ場|キャンプ用|キャンプ用品|キャンプイベント|テント|寝袋|露营地|帐篷|camping gear|campground|camping equipment/i.test(s)))return null;
 }
 const dated=passage?.match(/(20\d{2})年(\d{1,2})月/);
 if(dated&&Date.UTC(+dated[1],+dated[2],0,23,59)<now-30*day)return null;
 return {...row,content:passage?.trim()||row.content,originalTitle:row.originalTitle||row.title,angle:signal[0],subjects:[...new Set(parties)].slice(0,4)};
}
const metricNames={viewCount:'播放',likeCount:'赞',commentCount:'评论',danmakuCount:'弹幕',points:'社区积分'};
function caseDirection(row){
 const t=[row.title,row.content,row.originalTitle].join(' ');
 if(/联名合作|线下体验/.test(row.angle)&&/原神|游戏|明日方舟|初音未来|宝可梦|动漫|二次元/.test(t)&&/麦当劳|肯德基|咖啡|奶茶|茶饮|餐厅|餐饮/.test(t))return '游戏与动漫 IP 进入餐饮场景';
 if(row.angle==='联名合作'&&/街头|滑板|丹宁|胶囊系列|streetwear|skateboard/i.test(t))return '街头品牌推出联名系列';
 if(row.angle==='联名合作'&&/游戏|铁拳|tekken/i.test(t)&&/跑鞋|球鞋|耐克|nike|sneaker/i.test(t))return '游戏 IP 延伸至球鞋';
 if(row.angle==='联名合作'&&/限定周边|限定周邊|挂件|立牌|徽章/.test(t))return '联名角色推出实体周边';
 if(row.angle==='品牌传播'&&/代言|大使|ambassador/i.test(t))return '品牌启用新代言人';
 return row.angle;
}
export function metricText(row){return Object.entries(metricNames).filter(([k])=>row[k]!=null&&row[k]!=='').map(([k,n])=>n+' '+row[k]).join(' · ');}
export function marketVoice(text){
 return typeof text==='string'&&text.length>=8&&text.length<=380&&!/@\S+|https?:\/\//i.test(text)&&
  /联名|联动|周边|限定|限量|补货|断货|售罄|入手|买了|想买|买不到|想要|预售|排队|打卡店|配色|包装|定价|门店|设计|用料|质感|\bcollab|\bdesign|\bprice|sold out|restock|preorder|packaging|bought|sizing|colorway/i.test(text);
}
async function bilingualPlan(query){
 const plan=planTopic(query),labels=await translatedSubject(query);
 const en=plan.terms.find(t=>/^[a-z]/i.test(t))||brandSlug(query)?.replaceAll('-',' ')||labels.en;
 const ja=plan.terms.find(t=>/[ァ-ヶぁ-ん]/u.test(t))||labels.ja;
 const terms=[...new Set([...plan.terms,en,ja,...(labels.variants||[]),...regionalTerms(query)].filter(Boolean))];
 return {...plan,terms,english:en,japanese:ja,curated:themes.includes(plan),communityTerms:en&&!themes.includes(plan)?[en]:plan.communityTerms};
}
async function readBili(path){
  const res=await fetch('https://api.bilibili.com'+path,{signal:AbortSignal.timeout(3500)});
  if(!res.ok)return;
  const json=await res.json();return json.code===0?json.data:undefined;
}
async function enrichVideo(post){
 const bv=new URL(post.url).pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1];
 if(!bv)return post;
 const v=await readBili('/x/web-interface/view?bvid='+bv).catch(()=>null);
 if(v?.bvid!==bv||!v.stat||!Number.isSafeInteger(v.pubdate))return post;
 const exact={...post,publishedAt:new Date(v.pubdate*1000).toISOString(),aid:v.aid,content:v.desc?.trim().slice(0,420),author:v.owner?.name||post.author,avatar:v.owner?.face,role:'creator',image:v.pic||post.image};
 for(const [key,field] of Object.entries({viewCount:'view',likeCount:'like',commentCount:'reply',danmakuCount:'danmaku'})){
  if(Number.isSafeInteger(v.stat[field])&&v.stat[field]>=0)exact[key]=v.stat[field];
 }
 return exact;
}
async function biliVoice(post,now){
 if(!Number.isSafeInteger(post.aid))return;
 const thread=await readBili('/x/v2/reply?type=1&sort=2&pn=1&ps=10&oid='+post.aid);
 const reply=(thread?.replies||[]).filter(r=>Number.isSafeInteger(r.ctime)&&r.ctime*1000>=now-30*day&&r.ctime*1000<=now&&
  marketVoice(r.content?.message)&&/^[0-9]+$/.test(r.rpid_str)).sort((a,b)=>b.like-a.like)[0];
 if(reply)return {text:reply.content.message.trim(),url:post.url.split('#')[0]+'#reply'+reply.rpid_str,
  kind:'B站评论摘录',day:new Date(reply.ctime*1000).toISOString().slice(0,10),likes:reply.like};
}
function native(task,dataDir){
 const python=process.env.CUE_TRANSLATION_PYTHON||(existsSync('.tools/python/Scripts/python.exe')?resolve('.tools/python/Scripts/python.exe'):'python3');
 return new Promise((done,fail)=>{
  const p=spawn(python,['-I','integrations/hot-monitor/last30-community.py'],{windowsHide:true,env:{...process.env,CUE_TOPIC_DATA_DIR:resolve(dataDir),PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1'},stdio:['pipe','pipe','pipe']});
  let output='';const timer=setTimeout(()=>p.kill(),24000);p.stdout.setEncoding('utf8');p.stdout.on('data',s=>{output+=s;});p.stderr.resume();p.on('error',fail);
  p.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw Error('社区档案暂不可用');done(JSON.parse(output));}catch(e){fail(e);}});
  p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(task));
 });
}
const indexHosts={xiaohongshu:['www.xiaohongshu.com',/^\/(?:explore|discovery\/item)\/[a-f0-9]{24}/i],douyin:['www.douyin.com',/^\/video\/\d+/],instagram:['www.instagram.com',/^\/(?:p|reel)\/[\w-]+/]};
async function indexedPosts(source,query,search){
 const [host,path]=indexHosts[source];
 const found=await search('site:'+host+' '+query);
 const urls=[];
 for(const hit of found){try{
   let u=new URL(hit.url);
   if(/^(?:www\.)?bing\.com$/.test(u.hostname)&&u.pathname==='/ck/a'){
     const encoded=u.searchParams.get('u')||'';
     if(encoded.startsWith('a1'))u=new URL(Buffer.from(encoded.slice(2),'base64url').toString('utf8'));
   }
   if(u.protocol==='https:'&&u.hostname===host&&path.test(u.pathname))urls.push(u.origin+u.pathname);
 }catch{}}
 const posts=await Promise.all([...new Set(urls)].slice(0,3).map(async url=>{
  try{const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)return;
   const $=load(await r.text());const title=$('meta[property="og:title"]').attr('content'),content=$('meta[property="og:description"]').attr('content');
   let publishedAt=$('meta[property="article:published_time"]').attr('content');
   if(!publishedAt){for(const el of $('script[type="application/ld+json"]').toArray()){try{const obj=JSON.parse($(el).text());publishedAt=obj.datePublished||obj.uploadDate;if(publishedAt)break;}catch{}}}
   if(title&&publishedAt)return {url,title,content,publishedAt,source};
  }catch{} 
 }));
 return posts.filter(Boolean);
}
export function createTopicBrief(feed,localize,{publicationSearch,desk,archive,dataDir='.artifacts/hot-monitor-preview'}={}){
 const cache=new Map(),pending=new Map();
 async function research(query,searchWeb){
  const now=Date.now(),plan=await bilingualPlan(query),f=feed(),coverage=[];
  const selected=[],reading=new Map(),examined=new Set(),readOrigins=new Set();let campaigns=[];
  const originOf=r=>{try{return r.issuerChannel||r.publisherId||new URL(r.url).hostname.replace(/^www\./,'');}catch{return null;}};
  function accept(name,rows,status,reason){
   for(const r of rows){if(r.url)examined.add(r.url);const id=originOf(r);if(id)readOrigins.add(id);}
   for(const r of rows){
     const date=Date.parse(r.publishedAt),headline=r.originalTitle||r.title||'';
     if(excludedTopic(query)||!consumerContent(r)||noise.test(headline)||!/^https:\/\//.test(r.url||'')||!(date<=now&&date>=now-30*day))continue;
     if(r.source==='editorial'&&plan.terms.some(t=>coversTerm(headline,t)||(r.originalRead||r.firstPartyFeed)&&subjectPassage(r.content,t)))reading.set(r.url,r);
   }
   const hits=rows.map(r=>{
    const direct=qualify(r,query,plan,now);if(direct)return direct;
    const link=campaignMatch(r,campaigns);if(!link)return null;
    const hit=qualify(r,query,{...plan,terms:[...plan.terms,...link.names]},now);
    return hit?{...hit,relatedVia:link.url}:null;
   }).filter(Boolean);
   const unique=new Map(hits.map(r=>[r.url,{...r,discovery:name}]));selected.push(...unique.values());coverage.push({name,count:unique.size,read:rows.length,status,reason});
  }
  const folder=resolve(dataDir,'topic-evidence'),file=resolve(folder,createHash('sha256').update(query.toLowerCase()).digest('hex')+'.json');
  const previous=await readFile(file,'utf8').then(JSON.parse).catch(()=>[]);
  if(Array.isArray(previous)&&previous.length)accept('已核验的主题原文',previous.filter(r=>Date.parse(r.publishedAt)>=now-30*day),'保留原始发表日期');
  const media=[...(f.items||[]),...(f.socialTrends?.editorialCases||[])].map(i=>({...i,url:originalHref(i),content:i.excerpt||'',source:'editorial'}));
  accept('行业媒体',media,'近期报道');
  if(archive)accept('已核查案例',archive.recent(),'近期案例');
  if(desk){
    await desk.ready;
    const indexed=desk.items();
    for(const [role,label] of [['media','出版方订阅'],['official','官方发布'],['creator','创作者专栏'],['community','开放创作社区']])accept(label,indexed.filter(r=>(r.role||'media')===role),'定期直连来源');
  }
  const tasks=[];
  async function lane(name,fetchRows,label){
   try{accept(name,await fetchRows(),label);}catch(e){
     const msg=e.cause?.code||e.message||'';
     if(process.env.CUE_SEARCH_DIAGNOSTICS==='1')console.warn('公开检索',name,e.name,msg);
     const reason=/timeout|timed out/i.test(msg)?'请求超时':/403|412|429/.test(msg)?'上游限制访问':/ECONN|ENOTFOUND|EAI_AGAIN/.test(msg)?'网络连接失败':/HTTP \d+/.exec(msg)?.[0]||'上游未返回可解析的内容';
     accept(name,[],'暂不可用',reason);
   }
  }
  const english=plan.english;
  // Finish independent original-publication lookups before dispatching the larger social/index fan-out.
  // All queries get these lanes, including subjects that have never appeared in the source catalogue.
  await Promise.all([
   lane('亚太企业新闻稿',()=>searchAsiaNewswire(query,probeFragments(query)),'中文企业新闻稿'),
   lane('搜狗公开网页',()=>publicWebArticles(query,plan.terms),'核查原文日期')
  ]);
  if(desk?.globalSearch)accept('全球出版物原文索引',desk.globalSearch(plan.terms),'按原文发表日期');
  const jp=plan.japanese;
  const overseas=plan.terms.includes('camping')?'キャンプ用品':jp||plan.terms.find(t=>/[ァ-ヶぁ-ん]/u.test(t))||english||query;
  if(desk?.issuerSearch)accept('企业发布室',desk.issuerSearch(plan.terms),'品牌公开发布');
  if(desk?.issuerLookup)tasks.push(lane('品牌发布室站内搜索',()=>desk.issuerLookup(overseas,AbortSignal.timeout(40000)),'按原文检索'));
  const compact=jp?.replace(/(?:の|な|と|に|で|を)(?=[\p{Script=Han}ァ-ヶ])/gu,'');
  const extraTerms=[...new Set([compact,...plan.terms.filter(t=>/[ァ-ヶぁ-ん]/u.test(t)),...(jp?probeFragments(jp).slice(0,1):[])].filter(t=>t&&t!==overseas))].slice(0,3);
  if(desk?.issuerLookup&&extraTerms.length)tasks.push(lane('相关产品与活动发布室',async()=>{
    const found=await Promise.allSettled(extraTerms.map(t=>desk.issuerLookup(t,AbortSignal.timeout(45000))));
    if(found.every(r=>r.status==='rejected'))throw Error('发布室暂不可用');
    return found.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  },'关联产品词检索'));
  tasks.push(lane('日本媒体与品牌通讯',async()=>{
    const parts=await Promise.allSettled([...new Set([overseas,jp||overseas,overseas+' コラボ',overseas+' キャンペーン',overseas+' 発売',overseas+' ポップアップ',...extraTerms.slice(0,2),...(jp&&jp!==overseas?[jp+' 発売',jp+' ブランド']:[])])].map(q=>japaneseNews(q,dataDir)));
    if(parts.every(p=>p.status==='rejected'))throw Error('上游未返回内容');
    return parts.flatMap(p=>p.status==='fulfilled'?p.value:[]);
  },'公开媒体检索'));
  for(const [provider,label] of [['ettoday','ETtoday 新闻云'],['chinanews','中国新闻网']]){
    tasks.push(lane(label,async()=>{
      const variants=[...new Set([query,...probeFragments(query).slice(0,1),...plan.terms.filter(t=>/[\p{Script=Han}]/u.test(t)&&!/[ぁ-ヿ]/u.test(t)&&!regionalTerms(query).includes(t)).slice(0,1)])].slice(0,3);
      const batches=await Promise.allSettled(variants.map(term=>searchRegionalNews(term,provider)));
      if(batches.every(b=>b.status==='rejected'))throw Error('媒体搜索未返回内容');
      return batches.flatMap(b=>b.status==='fulfilled'?b.value:[]);
    },'媒体站内全文搜索'));
  }
  tasks.push(lane('公众号公开文章',()=>webPages(query+' site:mp.weixin.qq.com',plan.terms).then(rows=>rows.filter(r=>new URL(r.url).hostname==='mp.weixin.qq.com')),'有原文日期的公众号文章'));
  if(desk)tasks.push(lane('出版方站内公开搜索',()=>desk.search(query,plan.terms),'按主题直查'));
  tasks.push(lane('公开网页新闻',()=>webNews([query,...plan.probes,query+' 品牌',query+' 快闪'],plan.terms),'按主题即时检索'));
  tasks.push(lane('网页搜索',()=>webPages(query,plan.terms),'按原文日期筛选'));
  if(english)tasks.push(lane('国际企业新闻稿',async()=>{
    const terms=[...new Set([english,...plan.terms.filter(t=>/^[a-z]/i.test(t))])].slice(0,3);
    const batches=await Promise.allSettled(terms.map(searchNewswire));if(batches.every(b=>b.status==='rejected'))throw Error('企业新闻稿暂不可用');
    return batches.flatMap(b=>b.status==='fulfilled'?b.value:[]);
  },'品牌原始新闻稿'));
  tasks.push(lane('国际出版社区',()=>internationalNews(english||query),'按主题即时检索'));
  tasks.push(lane('国际新闻索引',()=>worldNews(english||query,plan.terms),'按主题即时检索'));
  tasks.push(lane('公共新闻索引',async()=>{
    const queries=[searchMarketingNews(query+' 品牌','zh-CN')];
    if(english)queries.push(searchMarketingNews(english+' brand campaign','en'));
    const batches=await Promise.allSettled(queries);
    if(batches.every(b=>b.status==='rejected'))throw Error();
    return batches.flatMap(b=>b.status==='fulfilled'?b.value:[]);
  },'近期新闻'));
  if(publicationSearch)tasks.push(lane('脉动事件库',()=>publicationSearch(query),'已发布报道'));
  tasks.push(lane('数英与 SocialBeta',async()=>{
    const lookups=[...new Set([query,...plan.terms.slice(0,3)])].slice(0,3);
    const searched=await Promise.allSettled(lookups.map(term=>publicMarketingPress(term,now-30*day)));
    if(searched.every(batch=>batch.status==='rejected'))throw Error();
    const press=searched.flatMap(batch=>batch.status==='fulfilled'?batch.value:[]);
    return press.map(r=>({...r,source:'editorial',content:r.excerpt||r.title}));
  },'实时媒体检索'));
  tasks.push(lane('哔哩哔哩',async()=>{
   const batches=await Promise.allSettled([...plan.probes.map(q=>biliTopic(q,now,()=>true)),biliTopic(query+' 联动',now,()=>true,'pubdate')]);
   if(!batches.some(r=>r.status==='fulfilled'))throw Error();
   return batches.flatMap(r=>r.status==='fulfilled'?r.value.items:[]).map(p=>({source:'bilibili',url:p.url,title:p.title,publishedAt:p.day,viewCount:p.plays,danmakuCount:p.danmaku,author:p.author,image:p.image,role:'creator'}));
  },'公开视频'));
  const searches=plan.subs.flatMap(sub=>plan.communityTerms.map(term=>[sub,term]));
  tasks.push(lane('黑客新闻社区',async()=>{
   const term=plan.terms.find(t=>/^[a-z]/i.test(t))||query;
   const hits=await native({hn:term},dataDir);
   return hits.map(p=>({source:'hackernews',title:p.title,url:p.hn_url,publishedAt:p.date,points:p.engagement.points,commentCount:p.engagement.comments}));
  },'社区讨论'));
  tasks.push(lane('红迪社区',async()=>{
   const data=await native({searches},dataDir);if(!data.ok)throw Error();
   return data.rows.map(p=>({source:'reddit',url:p.url,title:p.title,content:p.selftext?.slice(0,480),publishedAt:new Date(p.created_utc*1000).toISOString(),points:p.score,commentCount:p.num_comments,community:p.subreddit,postId:p.postId,author:p.author,role:'community'}));
  },'公开档案'));
  const leadBrands=[...new Set(selected.flatMap(r=>r.subjects))].slice(0,3);
  tasks.push(lane('Instagram',async()=>{
   const names=[...new Set([query,...leadBrands].filter(brandSlug))].slice(0,3);
   const batches=await Promise.allSettled(names.map(name=>instagramPosts(name)));
   const indexed=await indexedPosts('instagram',plan.probes[0],searchWeb);
   return [...indexed,...[...batches.flatMap(b=>b.status==='fulfilled'?b.value:[]),...Object.values(f.socialTrends?.instagramTopics||{}).flatMap(b=>b.items||[])].map(p=>({source:'instagram',title:p.title,content:p.originalTitle,url:p.url,publishedAt:p.day,likeCount:p.likes,commentCount:p.replies}))];
  },'公开品牌帖索引'));
  for(const [id,label] of [['xiaohongshu','小红书'],['douyin','抖音']])tasks.push(lane(label,()=>indexedPosts(id,plan.probes[0],searchWeb),'公开原帖索引'));
  await Promise.all(tasks);
  campaigns=relatedCampaigns(selected);
  const cited=new Map();
  for(const r of selected)for(const url of r.citedUrls||[])if(!cited.has(url))cited.set(url,r);
  if(cited.size)await lane('报道所引品牌原站',async()=>{
    const fetched=await Promise.allSettled([...cited].slice(0,8).map(async([url,seed])=>{
      const html=await publisherText(url),m=readArticleMetadata(html,{},now);
      if(!m.title||!m.publishedAt)return null;
      return {url,title:m.title,content:m.excerpt,publishedAt:m.publishedAt,image:m.image,source:'editorial',publisher:new URL(url).hostname,citedBy:seed.url};
    }));
    return fetched.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
  },'原报道所引原文');
  const leads=leadsFor(selected,query);
  if(leads.length){
    await Promise.all([
      lane('品牌与活动追查',()=>webNews(leads.map(n=>query+' '+n),plan.terms),'按已发现的参与方继续检索'),
      ...leads.slice(0,2).map(n=>lane('活动原文 · '+n,()=>webPages(query+' '+n,plan.terms),'按原主题复核')),
      ...(desk?.officialSearch?[lane('品牌官网与活动页',()=>desk.officialSearch(leads,query),'首发与跟进')]:[]),
      ...(desk?.issuerSearch?[lane('品牌官方公告',async()=>desk.issuerSearch(leads),'追查发布主体')]:[]),
      ...(desk?.issuerLookup?leads.slice(0,2).map(n=>lane('发布室追查 · '+n,()=>desk.issuerLookup(n,AbortSignal.timeout(26000)),'复核参与者与活动')):[]),
      ...(desk?.globalSearch?[lane('延伸报道索引',()=>desk.globalSearch(leads),'按原主题复核')]:[])
    ]);
  }
  if(new Set(selected.map(r=>r.url)).size<10){
   const facets=probeFragments(query),alternate=facets.length?facets.join(' '):query;
   const direct=coverage.find(c=>c.name==='亚太企业新闻稿');
   const retry=[];
   if(!direct||direct.read<4)retry.push(lane('企业原文补查',()=>searchAsiaNewswire(query,[alternate,...facets]),'发布方全文复核'));
   if(!coverage.some(c=>c.name==='搜狗公开网页'&&c.count))retry.push(lane('相关网页补查',()=>publicWebArticles(alternate,plan.terms),'按词组重组检索'));
   if(retry.length)await Promise.all(retry);
  }
  const live=r=>['亚太企业新闻稿','国际企业新闻稿','企业发布室','品牌发布室站内搜索','出版方站内公开搜索','网页搜索','公开网页新闻','国际出版社区','公共新闻索引','国际新闻索引','全球出版物原文索引','日本媒体与品牌通讯','品牌与活动追查','延伸报道索引'].includes(r.discovery)?1:0;
  const headlineMatch=r=>plan.terms.some(t=>coversTerm(r.originalTitle||r.title,t))?1:0;
  const sorted=eventCards(selected.sort((a,b)=>headlineMatch(b)-headlineMatch(a)||live(b)-live(a)),now).sort((a,b)=>headlineMatch(b)-headlineMatch(a)||live(b)-live(a)||marketingWeight(b,query)-marketingWeight(a,query)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  // Compare like metrics only inside a platform. A view is not a vote or a like.
  const groups=new Map();
  for(const row of sorted){const key=row.publisherId|| (live(row)?row.discovery:row.source);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  function samePlatformValue(row){
    const raw=row.viewCount??row.points??row.likeCount;
    if(raw==null)return -1;
    return (Number.parseFloat(raw)||0)*(String(raw).includes('万')?10000:1);
  }
  for(const group of groups.values())if(group[0].source!=='editorial')group.sort((a,b)=>samePlatformValue(b)-samePlatformValue(a));
  const pool=[];
  for(let i=0;i<45;i++)for(const group of groups.values())if(group[i])pool.push(group[i]);
  const unique=new Map();
  for(const row of pool){if(!unique.has(row.url))unique.set(row.url,row);if(unique.size===40)break;}
  const enriched=await Promise.all([...unique.values()].map(r=>r.source==='bilibili'?enrichVideo(r):r));
  const candidates=enriched.filter(r=>qualify(r,query,plan,now)||r.relatedVia&&campaignMatch(r,campaigns)).map(r=>({...r,id:r.url,createdAt:r.publishedAt,importance:'low',isReal:true,relevance:50,keywordMentioned:true,relevanceReason:'未配置 AI，使用主题与营销事件筛选',summary:r.content||null,metricDisplay:metricText(r),content:r.content?.slice(0,480)}));
  const localizedEvents=new Map();
  for(let i=0;i<candidates.length&&localizedEvents.size<10;i+=8){
   const batch=await localize(candidates.slice(i,i+8));
   for(const r of batch){
    if(!r.title||r.title==='中文标题暂不可用'||brokenCopy(r.title))continue;
    if(brokenCopy(r.content))r.content=null;
    const key=r.title.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase(),existing=localizedEvents.get(key);
    if(existing){
      existing.reports=[...new Map([...existing.reports,...r.reports].map(v=>[v.url,v])).values()];
      existing.outlets=new Set(existing.reports.map(v=>v.publisher)).size;
    }else localizedEvents.set(key,r);
  }
  }
  const rows=[...localizedEvents.values()].slice(0,10).map(r=>({...r,review:reviewEvidence(r)}));
  let relatedArticles=[];
  if(rows.length<10&&reading.size){
   const covered=new Set(selected.map(r=>r.url));
   const more=eventCards([...reading.values()].filter(r=>!covered.has(r.url)),now)
      .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,16);
   const local=await localize(more.map(r=>({...r,originalTitle:r.originalTitle||r.title})));
   const titles=new Set(rows.map(r=>r.title));
   relatedArticles=local.filter(r=>r.title&&r.title!=='中文标题暂不可用'&&!brokenCopy(r.title)&&!titles.has(r.title)&&titles.add(r.title)).slice(0,10-rows.length);
  }
  await localizeSearchHeadlines([...rows,...relatedArticles],query,plan.terms,localize);
  archive?.save(rows.filter(r=>r.review.accepted));
  let voice;
  for(const post of rows.filter(r=>r.source==='bilibili').slice(0,2)){
   try{voice=await biliVoice(post,now);if(voice){const [cn]=await localize([{title:voice.text}]);if(!cn?.title||cn.title==='中文标题暂不可用'){voice=undefined;continue;}voice.text=cn.title;break;}}catch{}
  }
  for(const post of rows.filter(r=>r.postId&&r.commentCount>0).slice(0,2)){
   if(voice)break;
   try{const replies=await native({post:post.postId},dataDir);
    const reply=replies.find(c=>marketVoice(c.body)&&c.url?.startsWith('https://reddit.com/r/')&&Date.parse(c.date)>=now-30*day&&Date.parse(c.date)<=now);
    if(reply){const [cn]=await localize([{title:reply.body}]);if(cn.title!=='中文标题暂不可用'){voice={text:cn.title,url:reply.url,caseTitle:post.title,day:reply.date};break;}}
   }catch{}
  }
  if(!voice){
    const opinion=rows.find(r=>['bilibili','reddit','instagram'].includes(r.source)&&/我觉得|终于|期待|惊喜|值得买吗|好看吗|吐槽|失望|喜欢|值不值/.test(r.title));
    if(opinion)voice={text:opinion.title,url:opinion.url,day:opinion.publishedAt.slice(0,10),kind:'发帖者原意'};
  }
  const boards=[],seenBoards=new Set();
  for(const r of [...(f.socialTrends?.rows||[])].sort((a,b)=>String(b.day).localeCompare(String(a.day))||a.rank-b.rank)){
   if(!r.series?.includes('热搜')||!Number.isInteger(r.rank)||r.rank<1||seenBoards.has(r.title)||!/^https:\/\//i.test(r.source||''))continue;
   if(!qualify({...r,source:'board',publishedAt:r.day},query,plan,now))continue;
   seenBoards.add(r.title);boards.push({title:r.title,url:r.source,day:r.day,series:r.series,rank:r.rank});
   if(boards.length===3)break;
  }
  const directions=[...new Set(rows.map(caseDirection))].map(name=>{
   const examples=rows.filter(r=>caseDirection(r)===name),lead=examples.find(r=>r.metricDisplay)||examples[0];
   const detail=lead.content?.split(/[。！？\n]/u).find(s=>s.length>=12&&s!==lead.title);
   return {name,count:examples.length,title:lead.title,url:lead.url,source:lead.source,metrics:lead.metricDisplay,detail:detail?.length>125?detail.slice(0,125)+'…':detail};
  }).sort((a,b)=>Number(Boolean(b.metrics))-Number(Boolean(a.metrics))||b.count-a.count);
  const evidence=[...new Map([...reading.values(),...selected].map(r=>[r.url,r])).values()]
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,90);
  if(evidence.length){
    try{await mkdir(folder,{recursive:true});const temp=file+'.'+randomUUID();await writeFile(temp,JSON.stringify(evidence));await rename(temp,file);}catch(e){console.error('保存主题原文',e.code||e.name);}
  }
  return {results:rows,relatedArticles,brief:{reach:{scanned:desk?.scope?.()||null,readOrigins:readOrigins.size,readArticles:examined.size,matchedOrigins:new Set(selected.map(originOf).filter(Boolean)).size,matchedEvents:sorted.length,displayedOrigins:new Set(rows.flatMap(r=>r.reports.map(p=>p.issuerChannel||new URL(p.url).hostname.replace(/^www\./,'')))).size},boards,coverage:coverage.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),voice,directions:directions.slice(0,3)}};
 }
 return async(query,searchWeb)=>{
  query=subjectOf(topicKey(query));
  const key=query.toLowerCase(),dir=resolve(dataDir,'topic-results'),path=resolve(dir,createHash('sha256').update(key).digest('hex')+'.json');
  let old=cache.get(key);
  if(!old){
   const saved=await readFile(path,'utf8').then(JSON.parse).catch(()=>null);
   if(saved?.format===2&&saved.data?.brief&&Array.isArray(saved.data.results)&&Array.isArray(saved.data.relatedArticles)&&saved.checked>Date.now()-86400000){
    if([...saved.data.results,...saved.data.relatedArticles].every(r=>Date.parse(r.publishedAt)>=Date.now()-30*day))old=saved;
   }
  }
  if(old?.until>Date.now())return old.data;
  if(!pending.has(key)){
   if(pending.size>=4){if(old)return old.data;throw Error('主题检索繁忙，请稍后再试');}
   const work=research(query,searchWeb).then(async data=>{
    const found=data.results.length+data.relatedArticles.length;
    if(!found&&old&&data.brief.coverage.some(c=>c.reason))return old.data;
    const checked=Date.now(),entry={format:2,data,checked,until:checked+(found?5:1)*60000};
    if(cache.size>=40)cache.delete(cache.keys().next().value);cache.set(key,entry);
    if(found)try{await mkdir(dir,{recursive:true});const tmp=path+'.'+randomUUID();await writeFile(tmp,JSON.stringify(entry));await rename(tmp,path);}catch(e){console.error('保存检索结果',e.code||e.name);}
    return data;
   }).finally(()=>pending.delete(key));
   pending.set(key,work);
  }
  if(old?.checked>Date.now()-86400000&&(old.data.results.length||old.data.relatedArticles.length)){void pending.get(key).catch(()=>{});return old.data;}
  return pending.get(key);
 };
}

