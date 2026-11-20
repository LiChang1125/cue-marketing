import {topicWhere} from './query-language.mjs';
import {publicSearchPage} from './public-search-fetch.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {load} from 'cheerio';
import {excludedTopic,retailActivation} from './consumer-market.mjs';

const day=86400000,base='https://prtimes.jp';
export const sections=['fashion','beauty','gourmet','lifestyle','entertainment'];
const sector=/キャンプ|アウトドア|ブランド|アパレル|ファッション|香水|コスメ|スニーカー|コーヒー|カフェ|お菓子|ビール|チョコ|菓子|食品|飲食|レストラン|パン屋|フード|バッグ|ジュエリー|テント|寝袋|キャンプシェード|焚き火|雑貨|キャラクター|コスプレ|コラボ|フィギュア|アニメ|グッズ|ファンイベント|腕時計|ホテル|化粧品|スキンケア|限定メニュー|アクセサリー|百貨店|スイーツ|ラーメン|玩具|コレクション|アパレル|スポーツ用品|アートトイ/u;
const action=/発売|新登場|オープン|開店|新店舗|リニューアル|周年|キャンペーン|フェア|ポップアップ|コラボ|数量限定|限定販売|アンバサダー|新作|販売開始|新商品|予約開始|開催|新発売|リリース|登場|初出店|販売|出店|発表|スタート|全国展開|提供開始|シリーズ/u;
const offbeat=/セミナー|参加者募集|求人|人事異動|株式市場|決算|営業支援|システム開発|補助金|ゲーム攻略|カジノ|生成AI|クラウド|ソフトウェア|アプリ開発|電子部品|大学院|医療機関|マーケティングツール|広告配信システム/u;
export function issue(a,now=Date.now()){
 const issuer=String(a.provider?.id||''),name=a.provider?.name_origin||a.provider?.name;
 const m=String(a.url||'').match(/^\/main\/html\/rd\/p\/\d+\.(\d+)\.html$/);
 if(!m||!name||String(Number(m[1]))!==issuer)return;
 const title=String(a.title||'').trim(),content=load(String(a.text||'').slice(0,12000),null,false).text().replace(/\s+/g,' ').trim().slice(0,600);
 if(!title||excludedTopic(title)||excludedTopic(name)||/ソニーグループ|サイバーエージェント|インターネット企業|ソフトバンク|サムスン電子|エヌビディア|テック企業/.test(name)||offbeat.test(title)||!(sector.test(title+' '+content.slice(0,180))||retailActivation.test(title+' '+content.slice(0,450)))||!action.test(title))return;
 const at=Date.parse(a.updated_at?.time_iso_8601||a.updated_at?.origin);
 if(!(at<=now&&at>=now-30*day))return;
 const image=a.images?.original?.file;
 return {issuer,name,title,content,at,url:base+a.url,image:image?.startsWith('/i/')?base+image:null,channel:base+'/main/html/searchrlp/company_id/'+issuer};
}
// Public keyword search has a separate HTML result list from the category feed.
function fullReleaseTitles($){
 const titles=new Map();
 for(const el of $('script').toArray()){
   const script=$(el).text();
   const part=script.match(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/);
   if(!part)continue;
   try{
     const fields=JSON.parse(JSON.parse(part[1]));if(!Array.isArray(fields))continue;
     for(const entry of fields){
       if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;
       const record=Object.fromEntries(Object.entries(entry).map(([key,i])=>[fields[Number(key.slice(1))],fields[i]]));
       if(typeof record.title==='string'&&typeof record.releaseUrl==='string')titles.set(record.releaseUrl,record.title);
     }
   }catch{}
 }
 return titles;
}
export function keywordIssues(html,observedAt=Date.now(),detail=new Map()){
 const $=load(html),rows=[],titles=fullReleaseTitles($);
 for(const article of $('article').toArray()){
   const card=$(article),link=card.find('a[href^="/main/html/rd/p/"]').first(),url=link.attr('href');
   const owner=card.find('a[href^="/main/html/searchrlp/company_id/"]').first();
   const title=titles.get(url)||detail.get(url)?.title||link.find('h3').text().trim(),label=link.find('time').text().trim();
   const exact=label.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})時(\d{1,2})分/);
   const relative=label.match(/^(\d+)(分|時間)前$/);
   const at=exact?Date.UTC(+exact[1],+exact[2]-1,+exact[3],+exact[4]-9,+exact[5]):relative?observedAt-Number(relative[1])*(relative[2]==='分'?60000:3600000):NaN;
   if(!Number.isFinite(at))continue;
   const entry=issue({url,title,text:detail.get(url)?.content,provider:{id:owner.attr('href')?.split('/').pop(),name:owner.text().trim()},updated_at:{origin:new Date(at).toISOString()}});
   if(!entry)continue;
   const image=link.find('img').attr('src');
   if(image?.startsWith('https://prcdn.freetls.fastly.net/'))entry.image=image;
   rows.push(entry);
 }
 return rows;
}
export function brandNewsrooms(dir){
 mkdirSync(dir,{recursive:true});
 const db=new DatabaseSync(join(dir,'pulse-official-newsrooms.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=7000; CREATE TABLE IF NOT EXISTS releases(url TEXT PRIMARY KEY,issuer TEXT,name TEXT,title TEXT,content TEXT,at INTEGER,image TEXT); CREATE INDEX IF NOT EXISTS issuer_dates ON releases(issuer,at)');
 const write=db.prepare('INSERT OR REPLACE INTO releases VALUES(?,?,?,?,?,?,?)');
 const controller=new AbortController();let timer,running=false,closed=false;
 const normalize=r=>({url:r.url,title:r.title,content:r.content,publishedAt:new Date(r.at).toISOString(),dateBasis:'publisherReleaseList',image:r.image,publisher:r.name,publisherId:'prtimes:'+r.issuer,author:r.name,role:'official',source:'editorial',firstPartyFeed:true,issuerChannel:base+'/main/html/searchrlp/company_id/'+r.issuer});
 async function page(type,v,page,signal=controller.signal){
   const u=new URL('/api/search_release.php',base);u.search=new URLSearchParams({page:String(page),type,v,sub:'',lv2:'',locate:'',limit:'40'});
   const response=await fetch(u,{signal:AbortSignal.any([signal,AbortSignal.timeout(75000)]),headers:{referer:base+'/fashion/'}});
   if(!response.ok)throw Error('发布平台 HTTP '+response.status);
   const chunks=[];let size=0;
   for await(const c of response.body){size+=c.length;if(size>12e6)throw Error('发布列表过大');chunks.push(c);}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(data.status?.code!==200||!Array.isArray(data.articles))throw Error('缺少公开发布列表');
   const rows=data.articles.map(a=>issue(a)).filter(Boolean);
   if(!closed){db.exec('BEGIN');try{for(const r of rows)write.run(r.url,r.issuer,r.name,r.title,r.content,r.at,r.image);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
   return rows.map(normalize);
 }
 async function keyword(term,signal){
   const u=new URL('/main/action.php',base);u.search=new URLSearchParams({run:'html',page:'searchkey',search_word:term});
   signal.throwIfAborted();const observed=Date.now(),html=await publicSearchPage(u);signal.throwIfAborted();
   const $=load(html),titles=fullReleaseTitles($),detail=new Map();
   const paths=[...titles].filter(([path,title])=>/^\/main\/html\/rd\/p\/\d+\.\d+\.html$/.test(path)&&!offbeat.test(title)&&action.test(title)).slice(0,12).map(([path])=>path);
   let next=0;
   const gather=async()=>{while(next<paths.length&&!signal.aborted){
     const path=paths[next++];try{
       const page=await fetch(new URL(path,base),{signal:AbortSignal.any([controller.signal,signal,AbortSignal.timeout(7000)])});
       if(!page.ok){await page.body?.cancel();continue;}
       const parts=[];let bytes=0;for await(const block of page.body){parts.push(block);bytes+=block.length;if(bytes>480000)break;}
       const doc=load(Buffer.concat(parts).toString('utf8'));
       const title=doc('meta[property="og:title"]').attr('content')?.split(' | ')[0];
       const body=doc('[itemprop="articleBody"],.release-body,.releaseBody,.rich-text').first().text().trim();
       const desc=doc('meta[property="og:description"]').attr('content')||'';
       detail.set(path,{title,content:(body||desc).slice(0,800)});
     }catch{}
   }};
   await Promise.all(Array.from({length:4},gather));
   const rows=keywordIssues(html,observed,detail);
   if(!closed){db.exec('BEGIN');try{
     for(const r of rows)db.prepare('INSERT INTO releases VALUES(?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,content=CASE WHEN length(excluded.content)>length(releases.content) THEN excluded.content ELSE releases.content END,image=coalesce(excluded.image,releases.image)').run(r.url,r.issuer,r.name,r.title,r.content,r.at,r.image);
     db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}}
   return rows.map(normalize);
 }
 function search(terms){
   const {sql,params}=topicWhere(terms);
   return db.prepare("SELECT * FROM releases WHERE at>=? AND ("+sql+") ORDER BY at DESC LIMIT 480").all(Date.now()-30*day,...params).map(normalize);
 }
 function channels(){return db.prepare('SELECT issuer,name,count(*) AS count,max(at) AS latest,url AS sample,title AS sampleTitle FROM releases WHERE at>? GROUP BY issuer').all(Date.now()-30*day).map(r=>({...r,url:base+'/main/html/searchrlp/company_id/'+r.issuer}));}
 db.exec('CREATE TABLE IF NOT EXISTS rotation(id INTEGER PRIMARY KEY,cursor INTEGER)');
 function tick(){if(running||closed)return;running=true;
 const cursor=db.prepare('SELECT cursor FROM rotation WHERE id=1').get()?.cursor||0;
 const batch=sections.map(s=>page('main_category',s,1));
 if(channels().length<1600){
   for(let i=0;i<3;i++){const n=cursor+i;batch.push(page('main_category',sections[n%sections.length],2+(Math.floor(n/sections.length)*17)%80));}
   db.prepare('INSERT OR REPLACE INTO rotation VALUES(1,?)').run(cursor+3);
 }
 void Promise.allSettled(batch).finally(()=>{running=false;if(closed)db.close();});}
 function recent(days=2,limit=300){return db.prepare('SELECT * FROM releases WHERE at>? ORDER BY at DESC LIMIT ?').all(Date.now()-days*day,limit).map(normalize);}
 return {page,keyword,search,recent,channels,start(){tick();timer=setInterval(tick,10*60000);timer.unref();},close(){if(closed)return;closed=true;controller.abort();clearInterval(timer);if(!running)db.close();}};
}
