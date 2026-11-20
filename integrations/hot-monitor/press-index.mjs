import {topicWhere} from './query-language.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createInflateRaw,gunzipSync} from 'node:zlib';
import {Readable} from 'node:stream';
import {createInterface} from 'node:readline';
import {publisherFeed} from './open-news.mjs';
import directory from '../../config/pulse-directory.json' with {type:'json'};
import {decodeHTML} from 'entities';
import {consumerBrands} from './brand-attention.mjs';
import {consumerContent,excludedTopic,retailActivation} from './consumer-market.mjs';

const day=86400000, quarter=900000;
const domain=host=>host.toLowerCase().replace(/^www\./,'');
function tag(text,name){return decodeHTML(text.match(new RegExp('<'+name+'>([^<]*)</'+name+'>'))?.[1]||'').trim();}
function stampDate(s){return /^\d{14}$/.test(s)?Date.parse(s.replace(/(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/,'$1-$2-$3T$4:$5:$6Z')):NaN;}
const unrelated=/police seek|police probe|armed robbery|suspect|arrested|shoplift|theft|shooting|homicide|recipe roundup|don't have (?:the|that) luxury|luxury of|openings? for jobs|campaign trail|election campaign|military campaign|business directory|coupon|gift guide|price prediction|black friday deals|best deals|ballot|retail sales (?:fell|rise|decline)|free shipping|horoscope|大盘走势|股市|个股|毎日クーポン|\b(?:obituary|obituaries|shooting|murder|lawsuit alert|class action|buy rating|coupon code|price target|recipe for|horoscope|was arrested)\b|讣告|刑事拘留|立案侦查|股票代码/i;
const business=/\b(?:brand|partnership|campaign|launch|launches|launched|collaboration|opened|opens|opening|store|restaurant|retailer|collection|festival|sponsor|merchandise|sales|licensing|popup|pop-up|debut|ambassador|cosplay|beauty|cosmetic|sneaker|fashion week|fragrance|streetwear|footwear|luxury)\b|品牌|联名|消费|零售|上市|门店|营销|快闪|限定|代言|授權|店舗|コラボ|ブランド|発売|매장|브랜드|marca|tienda|colección|coleção|boutique|magasin|lancement|modemarke|einzelhandel/i;
export function indexRecord(line,now=Date.now()){
 const fields=line.split('\t');if(fields.length<27||fields[2]!=='1')return;
 const meta=fields[26],title=tag(meta,'PAGE_TITLE').slice(0,350);
 if(!title||!business.test(title)||!indexedMarketing(title))return;
 const at=stampDate(tag(meta,'PAGE_PRECISEPUBTIMESTAMP'));if(!(at<=now&&at>=now-30*day))return;
 let url;try{url=new URL(fields[4]);}catch{return;}
 if(!/^https?:$/.test(url.protocol)||url.username||url.password||url.port||url.pathname==='/'||!/[a-z]\.[a-z]{2,}$/i.test(url.hostname))return;
 const host=domain(url.hostname),stated=domain(fields[3]);
 if(host!==stated&&!host.endsWith('.'+stated)&&!stated.endsWith('.'+host))return;
 url.hash='';return {title,url:url.href,host,at,author:tag(meta,'PAGE_AUTHORS').split(';')[0].slice(0,120),image:/^https:\/\//.test(fields[18])?fields[18].split(';')[0]:null};
}
const commercial=/联名|联动|代言|签约|快闪|营销|品牌|开业|新品|门店|限定|品牌大使|旗舰店|発売|コラボ|ブランド|開店|キャンペーン|新品|快閃|聯名|品牌|發售|旗艦店|partnership|launch|collaborat|opening|opens? (?:a |new |its |first |in |the )|reopen|capsule|expand|introduc|campaign|collection|ambassador|debuts?|unveil|sponsor|licens|collab|pop[- ]up|merchandise|new store|new restaurant|new line|new menu|limited.edition|sell[s ]? out|sold.out|rebrand|announc|flagship|rolls out|premiere|partenariat|colección|lanzamiento|inaugur|campagne|lancement|dévoile|collezione|lança|lanza|kollektion|브랜드/iu;
const localizedMarket=/parfum|moda|cosmétic|cosmét|chaussur|calzado|zapati|sneaker|ropa|cervej|cafeter[ií]a|restauran|restauraç|bijou|jouet|gastronom|vêtement|alimenta|deportivo|perfumer|퍼퓸|패션|화장품|카페/iu;
const sector=/香水|香氛|时装|时尚|零售|零食|服装|美妆|护肤|餐饮|茶饮|咖啡|门店|球鞋|运动鞋|潮玩|饮料|食品|乳品|动漫|手办|珠宝|百货|玩具|コスプレ|カフェ|アパレル|フィギュア|スニーカー|百貨店|化粧品|コーヒー|ファッション|飲料|お菓子|fashion|sneaker|fragrance|perfume|cosplay|footwear|coffee|grocery|grocer|fashion|sportswear|apparel|clothing|denim|cosmetic|skincare|makeup|lipstick|beauty brand|beauty line|retailer|streetwear|jewel(?:ry|lery)|handbags?|chocolat|beverages?|restaurant|sandwich|fast.food|pizzeria|bakery|brewery|ice cream|distillery|tequila|whisk[e]?y|wine brand|shoe brand|toy brand|action figure|collectible|designer toy|theme park|supermarket|accessor(?:y|ies) brand|furniture|couture|sneakers|luxury brand|pop[- ]up (?:shop|store)|theme café|coffeehouse|fashion house|gashapon|cosplayer/iu;
const reject=/shooting|murder|suspect|arrest|bombing|prison|manhunt|pleads|sentenced|death of|unlicensed|cyberattack|injured|war on|iGaming|casino|betting|annual report|stock news|stock market|investors?|interest rate|real estate|interest income|earnings|price target|share price|shares (?:fell|rose)|loans?|mortgage|into AI|\bAI (?:model|deal|startup|tool)|\bETF\b|realtor|football scores|官媒宣传|股价|党政|刑事|罰金|ゲーム攻略|株式市場/i;
export function indexedMarketing(title,content=''){
 if(unrelated.test(title)||reject.test(title)||excludedTopic(title)||!commercial.test(title+' '+content.slice(0,220)))return false;
 if(!consumerContent({title,content})&&!localizedMarket.test(title))return false;
 return retailActivation.test(title+' '+content.slice(0,350))||sector.test(title)||localizedMarket.test(title)||consumerBrands(title).length>0||commercial.test(title)&&(sector.test(content.slice(0,240))||localizedMarket.test(content.slice(0,240)));
}
export function galRecord(raw,batch,now=Date.now()){
 const title=String(raw.title||'').trim().slice(0,350),content=String(raw.desc||'').trim().slice(0,700),at=Date.parse(raw.date);
 if(title.length<8||!Number.isFinite(at)||at>now||at<now-30*day||at===batch||unrelated.test(title)||!commercial.test(title+' '+content.slice(0,200)))return;
 if(!indexedMarketing(title,content))return;
 let u;try{u=new URL(raw.url);}catch{return;}
 if(!/^https?:$/.test(u.protocol)||u.port||u.password||u.username||u.pathname.length<4||u.pathname==='/index.html'||!raw.domain||!/[a-z]\.[a-z]{2,}$/i.test(u.hostname)||domain(u.hostname)!==domain(raw.domain))return;
 u.hash='';return {title,url:u.href,host:domain(u.hostname),at,author:String(raw.author||'').split(';')[0].slice(0,100),image:/^https:\/\//.test(raw.image)?raw.image:null,content};
}
export function pressIndex(dir){
 mkdirSync(dir,{recursive:true});
 const db=new DatabaseSync(join(dir,'pulse-global-news.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=8000; CREATE TABLE IF NOT EXISTS articles(url TEXT PRIMARY KEY,host TEXT,title TEXT,at INTEGER,author TEXT,image TEXT); CREATE INDEX IF NOT EXISTS recent ON articles(at); CREATE INDEX IF NOT EXISTS domains ON articles(host,at); CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,checked INTEGER)');
 if(!db.prepare('PRAGMA table_info(articles)').all().some(c=>c.name==='content'))db.exec("ALTER TABLE articles ADD COLUMN content TEXT DEFAULT ''");
 db.exec('CREATE TABLE IF NOT EXISTS feed_receipts(url TEXT PRIMARY KEY,host TEXT,checked INTEGER,n INTEGER)');
 if(!db.prepare('PRAGMA table_info(articles)').all().some(c=>c.name==='origin'))db.exec("ALTER TABLE articles ADD COLUMN origin TEXT DEFAULT '公开新闻索引'");
 const insert=db.prepare('INSERT OR IGNORE INTO articles(url,host,title,at,author,image,content,origin) VALUES(?,?,?,?,?,?,?,?)');
 function save(rows){db.exec('BEGIN');try{for(const r of rows)insert.run(r.url,r.host,r.title,r.at,r.author,r.image,r.content||'',r.origin||'GDELT');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 async function pull(t,translated,signal){
  const id=new Date(t).toISOString().replace(/[-:T]/g,'').slice(0,14)+(translated?'.translation':'');
  if(db.prepare('SELECT 1 FROM batches WHERE id=?').get(id))return;
  const r=await fetch('https://data.gdeltproject.org/gdeltv2/'+id+'.gkg.csv.zip',{signal:AbortSignal.any([signal,AbortSignal.timeout(50000)])});
  if(!r.ok){await r.body?.cancel();throw Error('GDELT '+r.status);}
  const chunks=[];let bytes=0;for await(const c of r.body){bytes+=c.length;if(bytes>40e6)throw Error('index size');chunks.push(c);}
  const zip=Buffer.concat(chunks);
  if(zip.length<30||zip.readUInt32LE(0)!==0x04034b50||zip.readUInt16LE(8)!==8)throw Error('index format');
  const start=30+zip.readUInt16LE(26)+zip.readUInt16LE(28);
  const lines=createInterface({input:Readable.from([zip.subarray(start)]).pipe(createInflateRaw()),crlfDelay:Infinity});
  const rows=[];for await(const line of lines){const entry=indexRecord(line);if(entry)rows.push(entry);}
  save(rows);db.prepare('INSERT OR REPLACE INTO batches VALUES(?,?)').run(id,Date.now());
 }
 async function minute(t,signal){
  const id=new Date(t).toISOString().replace(/[-:T]/g,'').slice(0,14);
  if(db.prepare('SELECT 1 FROM batches WHERE id=?').get('gal'+id))return;
  const r=await fetch('https://data.gdeltproject.org/gdeltv3/gal/'+id+'.gal.json.gz',{signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
  if(!r.ok){await r.body?.cancel();throw Error('GAL '+r.status);}
  const chunks=[];let size=0;for await(const c of r.body){size+=c.length;if(size>8e6)throw Error('GAL size');chunks.push(c);}
  const rows=[];for(const line of gunzipSync(Buffer.concat(chunks),{maxOutputLength:55e6}).toString('utf8').split('\n')){if(!line.trim())continue;const rec=galRecord(JSON.parse(line),t);if(rec)rows.push(rec);}
  if(signal.aborted)return;
  save(rows);db.prepare('INSERT OR REPLACE INTO batches VALUES(?,?)').run('gal'+id,Date.now());
 }
 async function feeds(limit,workers,signal){
  const {parsePublisher}=await import('./publisher-desk.mjs'),checked=new Map(db.prepare('SELECT * FROM feed_receipts').all().map(r=>[r.url,r]));
  const due=directory.feeds.filter(url=>{const r=checked.get(url);return !r||Date.now()-r.checked>(r.n?60*60000:12*3600000);})
    .sort((a,b)=>(checked.get(b)?.n>0)-(checked.get(a)?.n>0)||(checked.get(a)?.checked||0)-(checked.get(b)?.checked||0)).slice(0,limit);
  async function scan(){while(due.length&&!signal.aborted){
   const url=due.shift(),host=domain(new URL(url).hostname);
   let n=0;try{
    const xml=await publisherFeed(url);if(!/<(?:rss|feed)(?:\s|>)/i.test(xml))throw Error('feed');
    const rows=parsePublisher(xml,{id:host,url},Date.now()).filter(r=>indexedMarketing(r.title,r.content));
    if(signal.aborted)return;
    save(rows.map(r=>({title:r.title,content:r.content,url:r.url,at:Date.parse(r.publishedAt),host,origin:'出版方订阅',author:r.author||'',image:r.image||null})));n=rows.length;
   }catch{}
   if(!signal.aborted)db.prepare('INSERT OR REPLACE INTO feed_receipts VALUES(?,?,?,?)').run(url,host,Date.now(),n);
  }}
  await Promise.all(Array.from({length:workers},scan));
 }
 function directFeeds(){return db.prepare('SELECT host AS domain,url,checked,n AS count FROM feed_receipts WHERE n>0 AND checked>?').all(Date.now()-86400000);}
 const map=r=>({title:r.title,content:r.content,url:r.url,publishedAt:new Date(r.at).toISOString(),publisher:r.host,publisherId:r.host,author:r.author,image:r.image,role:'media',source:'editorial',firstPartyFeed:r.origin==='出版方订阅',index:r.origin});
 function rows(days=2,max=1800){return db.prepare('SELECT * FROM articles WHERE at>=? ORDER BY at DESC LIMIT ?').all(Date.now()-days*day,max).map(map);}
 function search(terms){
   const {sql,params}=topicWhere(terms);
   return db.prepare("SELECT * FROM articles WHERE at>=? AND ("+sql+") ORDER BY at DESC LIMIT 900").all(Date.now()-30*day,...params).map(map);
 }
 function sources(){return db.prepare('SELECT host AS domain,count(*) AS count,max(at) AS latest,url AS sample,title AS sampleTitle FROM articles WHERE at>=? GROUP BY host').all(Date.now()-30*day);}
 db.exec('CREATE TABLE IF NOT EXISTS progress(name TEXT PRIMARY KEY,cursor INTEGER)');
 const controller=new AbortController();let busy=false,timer,closing=false;
 function start(){const tick=async()=>{if(busy)return;busy=true;try{const base=Math.floor(Date.now()/quarter)*quarter-quarter;
  await feeds(48,8,controller.signal);if(controller.signal.aborted)return;
  const counter=db.prepare("SELECT cursor FROM progress WHERE name='gal'").get()?.cursor||0;
  if(db.prepare('SELECT count(DISTINCT host) AS n FROM articles WHERE at>?').get(Date.now()-30*day).n<1500){
    await Promise.allSettled([0,1].map(i=>minute(base-(((counter+i)*173)%2773)*quarter+60000,controller.signal)));
    if(controller.signal.aborted)return;
    db.prepare("INSERT OR REPLACE INTO progress VALUES('gal',?)").run(counter+2);
  }
  await Promise.allSettled([1,2,3].map(offset=>minute(base+offset*60000,controller.signal)));
  for(const offset of [2,1,0]){if(controller.signal.aborted)return;await Promise.allSettled([false,true].map(tr=>pull(base-offset*quarter,tr,controller.signal)));}
  db.prepare('DELETE FROM articles WHERE at<?').run(Date.now()-30*day);db.prepare('DELETE FROM batches WHERE checked<?').run(Date.now()-32*day);
 }finally{busy=false;if(closing)db.close();}};void tick().catch(()=>{});timer=setInterval(()=>tick().catch(()=>{}),120000);timer.unref();}
 return {pull,minute,feeds,directFeeds,rows,search,sources,sourceCount:()=>db.prepare('SELECT COUNT(DISTINCT host) AS n FROM articles WHERE at>=?').get(Date.now()-30*day).n,start,close(){if(closing)return;closing=true;controller.abort();clearInterval(timer);if(!busy)db.close();}};
}
