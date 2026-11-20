import {consumerContent} from './consumer-market.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

// Ordinal evidence examples for a small supervised logistic classifier. The outcome
// is "enough evidence to file for review", not the truth of the underlying claim.
// Features: identifiable origin, substantive excerpt, identified author, additional
// outlet, first-party channel, tentative wording and promotional clickbait.
const examples=[
 [1,1,1,1,1,0,0,1],[1,1,0,1,0,0,0,1],[1,1,1,0,1,0,0,1],[1,1,0,0,1,0,0,1],
 [1,1,0,0,0,0,0,1],[1,0,1,1,0,0,0,1],[1,1,1,0,0,0,0,1],[1,1,0,1,1,1,0,1],
 [0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0],[1,0,0,0,0,1,0,0],[0,1,0,0,0,1,0,0],
 [1,1,0,0,0,1,0,0],[1,1,0,0,0,0,1,0],[1,1,1,0,0,1,1,0],[0,1,1,0,0,0,1,0]
];
const w=Array(7).fill(0);let intercept=0;const sigmoid=x=>1/(1+Math.exp(-x));
for(let epoch=0;epoch<250;epoch++){
  const gradient=w.map(()=>0);let bias=0;
  for(const row of examples){const error=row[7]-sigmoid(w.reduce((s,v,i)=>s+v*row[i],intercept));bias+=error;w.forEach((_,i)=>gradient[i]+=error*row[i]);}
  w.forEach((v,i)=>w[i]=0.998*v+gradient[i]/examples.length);intercept+=bias/examples.length;
}
export function reviewEvidence(r){
  const text=[r.title,r.originalTitle,r.content].filter(Boolean).join(' ');
  const flags=[Boolean(r.publisherId||r.publisher||r.author||r.source==='bilibili'&&r.aid),String(r.content||'').length>=32&&r.content!==r.title,Boolean(r.author),new Set((r.reports||[]).map(x=>new URL(x.url).hostname.replace(/^www\./,''))).size>=2,r.role==='official'||r.firstPartyFeed===true,/网传|谣言|传言|传闻|爆料称|未经证实|rumou?r|unconfirmed|allegedly/i.test(text),/全网最低|震惊|惊呆|你绝对想不到|click here to win/i.test(text)];
  const score=Math.round(100*sigmoid(w.reduce((v,k,i)=>v+k*Number(flags[i]),intercept)));
  return {score,grounds:['来源可追溯','有报道摘要','有署名','多个出版域名报道','发布方直接供稿','含待证实表述','含夸张推广表述'].filter((_,i)=>flags[i]),accepted:score>=55&&!flags[6]&&!flags[5]};
}
export function caseArchive(dir){
  let db;
  function connection(){if(!db){mkdirSync(dir,{recursive:true});db=new DatabaseSync(join(dir,'pulse-research.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS cases(url TEXT PRIMARY KEY, published INTEGER NOT NULL, item TEXT NOT NULL)');}return db;}
  return {
    save(rows){if(!rows.length)return;const d=connection(),up=d.prepare('INSERT OR REPLACE INTO cases VALUES(?,?,?)');d.exec('BEGIN');try{d.prepare('DELETE FROM cases WHERE published < ?').run(Date.now()-30*86400000);for(const r of rows)if(r.review?.accepted&&consumerContent(r))up.run(r.url,Date.parse(r.publishedAt),JSON.stringify(r));d.exec('COMMIT');}catch(e){d.exec('ROLLBACK');throw e;}},
    recent(){return connection().prepare('SELECT item FROM cases WHERE published>=? ORDER BY published DESC LIMIT 4000').all(Date.now()-30*86400000).map(r=>JSON.parse(r.item)).filter(consumerContent);},
    close(){db?.close();}
  };
}
