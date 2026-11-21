import {clusterStories} from './brand-stories.mjs';
import {platformStoryBoards} from './platform-stories.mjs';
import {readChartHistory} from './platform-history.mjs';
import {fetchPlatformCharts,platformNames} from '../../shared/platform-hot.js';
import {chinesePress,publicNews} from '../../shared/public-topic-search.js';
import {marketPatterns,patternCandidate} from './market-patterns.mjs';
import {createHash} from 'node:crypto';
import {consumerContent,excludedSearchSource} from './consumer-market.mjs';
import {brandScore,headlineParties} from '../aihot/overlay/apps/web/app/lib/brand-score.ts';
import {publisherIdentity} from './publisher-identity.mjs';
import {heatAt,consumerBrands} from './brand-attention.mjs';
import {webNews} from './open-news.mjs';
import {originalHref} from '../../shared/original.js';
import {publicMarketingPress} from '../../server/topic-search.js';
import topics from '../aihot/overlay/industry/topics.json' with {type:'json'};

const day=86400000;
const noise=/入门教程|股价|换手率|成交额|涨停|跌停|板块[涨跌]|[涨跌]\d+[.\d]*%|投资者提问|请关注官方|官网入口|官方入口|体育入口|公益课堂|普法|优惠券|品牌大全|盘点历年|是什么意思|招聘|培训报名|工作会议|讲话精神|周年回顾|股票|百科/;
const labels={bilibili:'哔哩哔哩',reddit:'红迪社区',instagram:'Instagram',xiaohongshu:'小红书',douyin:'抖音',hackernews:'黑客新闻社区'};
const titleKey=t=>t.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
// Pair a shared, concrete product or campaign identifier with a named participant.
function anchors(title){
  const models=title.match(/\b[a-z]{1,10}[- ]?\d{2,5}[a-z]?\b|\b\d{3,4}v\d+\b/ig)||[];
  const named=[...title.matchAll(/[「『《“‘]([^」』》”’]{3,45})[」』》”’]/g)].map(m=>m[1]);
  return new Set([...models,...named].filter(x=>!/^20\d{2}$/.test(x)).map(titleKey));
}
function occasion(title){
  const actions=[/召回|recall/i,/代言|大使|ambassador/i,/投资者大会|investor day/i,/开店|开业|store opening/i,/快闪|pop[- ]up/i,/联名|联乘|合作|collab|partnership|コラボ|別注|\s[x×]\s/i,/发售|新品|推出|首发|上市|launch|unveil|release|debut|発売/i];
  return actions.find(r=>r.test(title))?.source;
}
const editorialWords=new Set('air force low high star wars starwars galaxy jedi sith one piece studios studio chuck around watch line iconic thing about after again alongside already also another autumn baby back best black brand brings campaign capsule celebrates club collab collaboration collection coming debuts debut design down drop drops edition ever fall fashion first from have iconic info latest limited look makes menswear more official only opens partner partnership people pieces release released releases reveal reveals season series shoes sneaker sneakers some spring style summer takes their together unveiled unveils week what when where which winter with womenswear'.split(' '));
function distinctive(title){
 return new Set((title.match(/[A-Z][a-z]{2,}/g)||[]).map(w=>w.toLowerCase()).filter(w=>!editorialWords.has(w)&&!consumerBrands(w).length));
}
function tiedCase(a,b){
  if(!a.brandNames.some(x=>b.brandNames.includes(x)))return false;
  if(a.brandNames.some(n=>!b.brandNames.includes(n))&&b.brandNames.some(n=>!a.brandNames.includes(n)))return false;
  const shared=[...a.identifiers].filter(key=>b.identifiers.has(key));
  if(shared.length>=2&&Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt))<2*day){
    if((!a.occasion||!b.occasion||a.occasion===b.occasion||[a.occasion,b.occasion].every(x=>/collab|unveil/.test(x)))&&
       (!a.anchors.size||!b.anchors.size||[...a.anchors].some(k=>b.anchors.has(k))))return true;
  }
  if(!a.occasion||a.occasion!==b.occasion)return false;
  if(a.occasion.includes('investor day')&&Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt))<=86400000)return true;
  return [...a.anchors].some(x=>b.anchors.has(x));
}
function eventPassages(row){
  return String(row.content||'').split(/[。！？!?]|(?<=\.)\s+/u)
    .map(sentence=>sentence.trim()).filter(sentence=>sentence.length>=42&&/联名|推出|签售|发售|门店|联动|投资者大会|launch|partner|collab|campaign/i.test(sentence))
    .filter(sentence=>consumerBrands(sentence).length>0||/[《「“][^》」”]{3,}[》」”]|[0-9]{2,}.{0,6}(?:家|份|件|场|场次|店舗)/u.test(sentence)).map(titleKey).filter(text=>text.length>=32).slice(0,5);
}
// A named product in an article permalink can identify alternate headlines about the same launch.
function campaignKeys(row,url){
  const title=row.originalTitle||row.title;
  const text=[title,row.content?.slice(0,180),url.pathname.replace(/[-_]/g,' ')].join(' ');
  const keys=[];
  if(/下午茶|afternoon tea/i.test(title)){
    const partners=consumerBrands(text).sort();
    if(partners.length===2)keys.push('tea:'+partners.join('|'));
  }
  const tokens=title.match(/\b[A-Z][A-Za-z]{3,}\b/g)||[];
  const slug=new Set(url.pathname.toLowerCase().split(/[^a-z]+/));
  for(const brand of consumerBrands(text)){
    const slugs=[...slug].filter(w=>w.length>=4&&!editorialWords.has(w)&&!consumerBrands(w).length&&!/^(?:beauty|fragrance|perfume|lifestyle|celebrity|story|brands|launch|little|sister|news|industry|market|lands|announces|women)$/.test(w));
    for(const token of tokens){
      const lower=token.toLowerCase();
      if(!slugs.includes(lower))continue;
      for(const other of slugs)if(lower!==other)keys.push('pair:'+brand+'|'+[lower,other].sort().join('|'));
    }
    for(const token of tokens){
      const n=token.toLowerCase();
      if(slug.has(n)&&!editorialWords.has(n)&&!consumerBrands(token).length&&/^[A-Z][a-z]{3,}$/.test(token))keys.push(brand+'|'+n);
    }
  }
  return new Set(keys);
}
function matchesEvent(a,b){
  const apart=Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
  if(apart<=5*day){
    const shared=[...a.campaignKeys].filter(k=>b.campaignKeys.has(k));
    if(shared.some(k=>k.startsWith('tea:')||k.startsWith('pair:'))||shared.length>=2)return true;
  }
  if(apart>4*day)return false;
  const x=a.key,y=b.key;
  if(x===y||a.passages.some(p=>b.passages.includes(p))||tiedCase(a,b))return true;
  if(x.slice(0,4)!==y.slice(0,4)&&!a.brandNames.some(n=>b.brandNames.includes(n)))return false;
  if(Math.min(x.length,y.length)<10)return false;
  const grams=t=>new Set(Array.from({length:t.length-2},(_,i)=>t.slice(i,i+3)));
  const left=grams(x),right=grams(y),common=[...left].filter(g=>right.has(g)).length;
  return common/Math.min(left.size,right.size)>=0.76&&common/Math.max(left.size,right.size)>=0.45;
}
function participants(row){
  const headline=row.title.toLowerCase();
  const known=[...(row.subjects||[]),...topics.topics.filter(t=>t.group==='company'&&[t.name,...(t.aliases||[])].some(a=>headline.includes(a.toLowerCase()))).map(t=>t.name)];
  const names=headlineParties(row.title);
  return [...new Set([...known,...names].filter(n=>n&&n.length<18))].slice(0,5);
}
export function eventCards(rows,now=Date.now()){
  const events=[],seen=new Set(),buckets=new Map();
  for(const row of rows){
    const original=originalHref(row);if(!original)continue;
    let url;try{url=new URL(original);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)continue;}catch{continue;}
    url.hash='';for(const k of [...url.searchParams.keys()])if(/^utm_|^spm$/.test(k))url.searchParams.delete(k);
    if(excludedSearchSource(row)||!consumerContent(row)||seen.has(url.href)||!row.title||noise.test(row.title)||!(Date.parse(row.publishedAt)<=now&&Date.parse(row.publishedAt)>=now-30*day))continue;
    seen.add(url.href);
    const host=url.hostname.replace(/^www\./,'');
    const publisher=row.publisher==='品牌星球'?(/(^|\.)brandstar\.com\.cn$/.test(host)?'首发原文':host):row.publisher||labels[row.source]||host;
    const candidate={...row,brandNames:consumerBrands(row.title),anchors:anchors(row.title),identifiers:distinctive(row.title),occasion:occasion(row.title)};
    candidate.campaignKeys=campaignKeys(row,url);candidate.key=titleKey(row.title);candidate.passages=eventPassages(row);
    const keys=['prefix:'+candidate.key.slice(0,4),...candidate.brandNames.map(n=>'brand:'+n),...candidate.passages.map(p=>'detail:'+p),...candidate.campaignKeys];
    const shortlist=new Set(keys.flatMap(k=>buckets.get(k)||[]));
    let event=[...shortlist].find(e=>matchesEvent(e,candidate));
    if(!event){
      event={...candidate,publisher,url:url.href,parties:[],reports:[],score:brandScore(row.title,row.content||'')};
      events.push(event);
      for(const key of keys){if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(event);}
    }
    if(!event.image&&row.image)event.image=row.image;
    const copy=String(row.content||row.excerpt||'').normalize('NFKC').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,240);
    const copyId=copy.length>=80?createHash('sha256').update(copy).digest('hex').slice(0,24):null;
    event.reports.push({publisher,copyId,issuerChannel:row.issuerChannel,author:row.author,role:row.role,avatar:row.avatar,attribution:row.attribution,url:url.href,title:row.title,publishedAt:row.publishedAt});
    event.parties=[...new Set([...event.parties,...participants(row)])];
  }
  for(const e of events){
    delete e.campaignKeys;delete e.identifiers;delete e.anchors;delete e.brandNames;delete e.key;delete e.occasion;delete e.passages;
    const outlets=new Map();
    for(const r of e.reports){const key=r.publisher.toLowerCase();outlets.set(key,Math.max(outlets.get(key)||0,Date.parse(r.publishedAt)));}
    e.outlets=outlets.size;
    e.heat=Number([...outlets.values()].reduce((s,t)=>s+2**(-(now-t)/(3*day)),0).toFixed(2));
  }
  return events;
}
export function currentHotspots(feed,localize,desk,archive,{online=true}={}){
  let last,pending,platformCache;
  async function platformSources(now){
    if(!online)return {charts:{},articles:[]};
    if(platformCache?.until>now)return platformCache;
    const names=Object.values(platformNames);
    const terms=names.flatMap(name=>[name+' 品牌',name+' 品牌首发',name+' 双十一']);
    const news=names.map(name=>publicNews(name,AbortSignal.timeout(9000),true));
    const trade=names.map(name=>webNews([name+' 品牌联名',name+' 品牌营销',name+' 消费品牌 双十一'],[name,'品牌']));
    const hour=Math.floor(now/3600000);
    const [latest,history,...batches]=await Promise.all([fetchPlatformCharts().catch(()=>({})),platformCache?.hour===hour?platformCache.history:readChartHistory(now),...[...terms.map(term=>chinesePress(term)),...news,...trade].map(p=>p.catch(()=>[]))]);
    const charts={};
    for(const id of Object.keys(platformNames)){
      const chart=latest[id]||platformCache?.charts[id];
      if(chart&&now-Date.parse(chart.observedAt)<day)charts[id]=chart;
    }
    const leads=new Set(Object.values(charts).flatMap(chart=>chart.rows.filter(row=>row.consumer||consumerBrands(row.title).length).slice(0,3).map(row=>row.title)));
    const followups=await Promise.all([...leads].map(term=>chinesePress(term).catch(()=>[])));
    platformCache={until:now+600000,charts,history,hour,articles:[...batches,...followups].flat()};
    return platformCache;
  }
  return async()=>{
    if(last?.until>Date.now()&&last.version===desk?.version())return last.data;
    if(pending)return last?.data||pending;
    pending=(async()=>{
      const now=Date.now(),queries=['品牌 联名 官宣','品牌 快闪 首发','IP 授权 联动','品牌 代言人 发布','新品 限定 发售'];
      let available=true;
      const [platformInputs,[web,...trades]]=await Promise.all([platformSources(now),online?Promise.all([webNews(queries,['联名','品牌','首发','联动','营销']).catch(()=>{available=false;return [];}),...['联名','快闪','首发'].map(term=>publicMarketingPress(term,now-7*day).catch(()=>[]))]):[[]]]);
      const snapshot=feed(),local=(snapshot.items||[]).map(r=>({...r,url:originalHref(r),content:r.excerpt||r.content,source:'editorial'}));
      await desk?.ready;
      const live=desk?.summary().filter(s=>s.active)||[];
      const posts=archive?.recent()||[];
      const pool=[...(desk?.items()||[]),...(desk?.globalRecent?.()||[]),...posts,...web,...trades.flat().map(r=>({...r,publisher:r.sourceName,content:r.excerpt})),...local];
      const recent=pool.filter(r=>{
        if(now-Date.parse(r.publishedAt)>=14*day||!consumerContent(r)||!r.title)return false;
        if(/standout.{0,35}campaigns|campaigns so far|weekly roundup|best campaigns|裁员|营收|\bbest\b.{0,30}\b(?:weekly|this week|releases)\b|官方入口|传闻|回顾|折扣码|订阅|球赛比分|歌曲翻唱|\bstream\b|skyscraper|tower design|best.{0,20}gifts|明星街拍|gaming monitor|holiday cover|click here/i.test(r.title))return false;
        const names=consumerBrands(r.title);
        const concrete=/联名|联乘|联动|快闪|赞助商|新品|上新|代言|首店|销量|开业|上新|开售|限定|首发|発售|コラボ|首映|event activation|capsule collection|campaign|collab|ambassador|flagship|limited.edition|brand partnership|brand identity|launch|debut|collection|rebrand|sponsor|partnership|设计师|推出|合作系列|官宣|品牌大使|广告片|品牌焕新|主题店|快閃|聯名/i;
        return concrete.test(r.title)||(names.length>0&&concrete.test(String(r.content||'').slice(0,240)));
      });
      const candidates=pool.filter(r=>now-Date.parse(r.publishedAt)<14*day&&consumerContent(r)&&r.title);
      const related=candidates.filter(r=>/测评|实测|评测|开箱|复盘|解析|探访|销量|补货|review|hands.on|sold out/i.test(r.title));
      const events=clusterStories(eventCards([...recent,...related],now),now,{trendsOnly:true});
      const results=await localize(events.slice(0,10));
      const platformBoards=await platformStoryBoards([...pool,...platformInputs.articles].filter(r=>r.title&&now-Date.parse(r.publishedAt)<7*day&&consumerContent(r)),platformInputs.charts,now,eventCards,localize);
      for(const board of Object.values(platformBoards))board.history=platformInputs.history?.[board.platform]||{};
      const weekly=[...new Map([...pool,...(desk?.patternHistory?.()||[])].filter(r=>now-Date.parse(r.publishedAt)<7*day&&patternCandidate(r)).map(r=>[r.url,r])).values()];
      const patterns=marketPatterns(eventCards(weekly,now),now);
      const excerpts=await localize(patterns.flatMap(p=>p.examples.map(e=>({title:e.title,url:e.url}))));
      const cnTitles=new Map(excerpts.map(r=>[r.url,r.title]));
      for(const p of patterns)p.examples=p.examples.map(e=>({...e,title:cnTitles.get(e.url)})).filter(e=>e.title&&e.title!=='中文标题暂不可用');
      const data={patterns:patterns.filter(p=>p.examples.length),results:results.filter(r=>r.title&&r.title!=='中文标题暂不可用').slice(0,10),webAvailable:available,activeSources:live.length,reportingOutlets:new Set(results.filter(r=>r.title&&r.title!=='中文标题暂不可用').slice(0,10).flatMap(r=>r.reports.map(p=>p.identity))).size};
      data.platformBoards=platformBoards;
      last={data,version:desk?.version(),until:now+60000};return data;
    })().finally(()=>{pending=null;});
    if(last){pending.catch(()=>{});return last.data;}
    return pending;
  };
}
