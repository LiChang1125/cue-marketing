import {publicSearchPage} from './public-search-fetch.mjs';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

const separator=/[\s\p{P}\p{S}]+/gu;
const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
const stop=new Set(['な','に','で','を','の','と','は','が','も','及び','the','的','和','与','和有','品牌','主题','营销','and','for','the','of','a','with']);
const cache=new Map(),segments=new Map();
export function subjectOf(input){
 const text=input.normalize('NFKC').trim();
 const subject=text.replace(/^(?:(?:请帮我|帮我|请|我想|我想要|能否|可以)?(?:查(?:找|一下)?|搜(?:索|一下)?|看看|了解)(?:一下)?|(?:最近|近期)?有哪些关于|关于)\s*/u,'')
   .replace(/(?:近期|最近|相关|这个主题下|这一领域)(?:有哪些|有什么|的)?(?:品牌(?:动作|动向)?|市场营销|营销|市场)?(?:报道|文章|案例|活动|新闻|动向|动态|趋势)[呢吗？?。 ]*$/u,'')
   .replace(/(?:的(?:近期|最近)?(?:品牌动作|营销案例|相关新闻)|有哪些(?:营销案例|品牌动态|案例|报道))[呢吗？?。 ]*$/u,'').trim();
 return subject||text;
}
function tokens(text){
 if(segments.has(text))return segments.get(text);
 const parts=Array.from(segmenter.segment(text.normalize('NFKC').toLowerCase()),p=>p.isWordLike?p.segment:'').filter(x=>x&&!stop.has(x));
 if(segments.size>512)segments.delete(segments.keys().next().value);segments.set(text,parts);return parts;
}
export function probeFragments(text){
 const parts=tokens(text).filter(p=>p.length>=2);
 if(parts.length<2)return [];
 return [...new Set([parts.slice(0,-1).join(/[a-z]/i.test(text)?' ':''),parts.at(-1)])].filter(p=>p.length>=2&&p!==text);
}
// Candidate retrieval can be broader than evidence selection. Search all constituent words in the
// same indexed article, then let the caller inspect the headline, source and passage.
export function topicWhere(terms){
 const clauses=[],params=[],cell="instr(lower(title||' '||coalesce(content,'')),lower(?))>0";
 for(const term of [...new Set(terms.filter(Boolean))].slice(0,20)){
   clauses.push(cell);params.push(term);
   const parts=[...new Set(tokens(term))];
   if(parts.length<2||parts.length>5||parts.some(x=>x.length<2))continue;
   clauses.push('('+parts.map(()=>cell).join(' AND ')+')');params.push(...parts);
 }
 return {sql:clauses.length?clauses.join(' OR '):'0',params};
}
function nearby(parts,text,range){
 const matches=parts.map(p=>{const indices=[];let i=-1;while((i=text.indexOf(p,i+1))!==-1)indices.push(i);return indices;});
 return matches.every(list=>list.length)&&matches.some(list=>list.some(start=>matches.every(group=>group.some(index=>index>=start&&index<start+range))));
}
export function phraseMatches(text,term){
 const hay=String(text||'').normalize('NFKC').toLowerCase(),needle=String(term||'').normalize('NFKC').trim().toLowerCase();
 if(!needle)return false;
 if(needle==='コスプレ')return /コスプレ(?!ート)/u.test(hay);
 if(/^[a-z\d][a-z\d\s&'-]*$/.test(needle)){
   const parts=needle.split(separator).filter(Boolean);
   if(!parts.length)return false;
   const words=parts.map(x=>x.length>3?x+'(?:s|es)?':x);
   if(new RegExp('\\b'+words.join("[\\s‐‑–—'&-]+")+'\\b','i').test(hay))return true;
   const keys=parts.filter(p=>!stop.has(p));if(keys.some(p=>!hay.includes(p.replace(/s$/,'')))||keys.length<2||keys.some(p=>p.length<3))return false;
   return hay.split(/[.!?。！？\n]/).some(sentence=>{const tokens=sentence.split(separator).filter(Boolean).map(w=>w.length>4?w.replace(/s$/,''):w);const stems=keys.map(w=>w.length>4?w.replace(/s$/,''):w);return tokens.some((_,i)=>stems.every(w=>tokens.slice(i,i+keys.length+3).includes(w)));});
 }
 if(hay.includes(needle))return true;
 // Keep every substantive part in the same short passage. One generic noun is insufficient.
 const parts=tokens(needle);
 if(parts.length<2||parts.length>6||parts.some(p=>p.length<2))return false;
 return hay.split(/[。！？!?\n；;]/u).some(sentence=>nearby(parts,sentence,Math.min(40,needle.length+12)));
}
// A feature can be described in the launch paragraph even when the headline only names the product.
export function subjectPassage(passage,term){
 if(phraseMatches(passage,term))return true;
 const parts=tokens(term).filter(p=>!stop.has(p));
 if(parts.length<2||parts.length>6||parts.some(p=>p.length<2))return false;
 const text=String(passage||'').normalize('NFKC').toLowerCase();
 if(/^[a-z\\s-]+$/i.test(term)){
   const words=text.split(separator).filter(Boolean).map(w=>w.replace(/s$/,''));
   const keys=parts.map(w=>w.replace(/s$/,''));
   return words.some((_,i)=>keys.every(k=>words.slice(i,i+26).includes(k)));
 }
 return nearby(parts,text,64);
}
function translate(query){
 const exe=process.env.CUE_TRANSLATION_PYTHON||(existsSync('.tools/python/Scripts/python.exe')?resolve('.tools/python/Scripts/python.exe'):'python3');
 return new Promise(done=>{
   const p=spawn(exe,['-I',resolve('integrations/hot-monitor/query-language.py')],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1'}});
   let data='';const timeout=setTimeout(()=>p.kill(),14000);
   p.on('error',()=>{clearTimeout(timeout);done({});});p.stdout.setEncoding('utf8');p.stdout.on('data',s=>{data+=s;});
   p.on('close',()=>{clearTimeout(timeout);try{done(JSON.parse(data));}catch{done({});}});p.stdin.on('error',()=>{});p.stdin.end(query);
 });
}
// Dictionaries supply search labels only. Result cards always need a dated publication.
export function dictionaryLabels(data,subject,lang){
 if(data?.input!==subject)return {labels:[],aliases:[]};
 const labels=[],aliases=[],word=(lang==='en'?data.ce:data.cj)?.word||[];
 for(const entry of word){
   if(entry['return-phrase']?.l?.i!==subject)continue;
   for(const group of entry.trs||[])for(const tr of group.tr||[]){
     const pieces=tr.l?.i;
     if(Array.isArray(pieces))labels.push(pieces.map(p=>typeof p==='string'?p:p?.['#text']||'').join(''));
     const alt=tr.l?.['#tran']?.match(/^([\p{Script=Han}]{2,12})[：:]/u);if(alt)aliases.push(alt[1]);
   }
 }
 for(const e of data.web_trans?.['web-translation']||[]){
   if(e.key!==subject||e['@same']!=='true')continue;
   for(const t of e.trans||[])if(t.support>=30)labels.push(t.value);
 }
 const valid=lang==='en'?/^[a-z][a-z\d &’',-]{1,48}$/i:/^[\p{Script=Han}ぁ-ヿーA-Za-z\d・ ]{2,35}$/u;
 const seen=new Set();
 return {labels:labels.map(s=>s.trim()).filter(s=>valid.test(s)&&!seen.has(s.toLowerCase())&&seen.add(s.toLowerCase())).slice(0,3),aliases};
}
async function dictionary(subject,lang){
 try{
   const u=new URL('https://dict.youdao.com/jsonapi');u.search=new URLSearchParams({q:subject,le:lang});
   return dictionaryLabels(JSON.parse(await publicSearchPage(u)),subject,lang);
 }catch{}
 return {labels:[],aliases:[]};
}
async function makeLabels(subject){
 if(!/[\p{Script=Han}]/u.test(subject))return translate(subject);
 const [en,ja,machine]=await Promise.all([dictionary(subject,'en'),dictionary(subject,'ja'),translate(subject)]);
 const english=en.labels[0]||machine.en?.replace(/^(?:the|an?) /i,'');
 // Re-translate the attested English industry term when the literal translation is different.
 const bridge=en.labels.length&&!ja.labels.length?await translate(english):{};
 return {en:english,ja:ja.labels[0]||bridge.ja||machine.ja,variants:[...en.labels,...ja.labels,...new Set(en.aliases)].filter(v=>v!==subject)};
}
export async function translatedSubject(subject){
 const old=cache.get(subject);if(old?.until>Date.now())return old.value;
 const value=makeLabels(subject);cache.set(subject,{until:Date.now()+60000,value});
 const labels=await value;
 if(labels.en||labels.ja){if(cache.size>256)cache.delete(cache.keys().next().value);cache.set(subject,{until:Date.now()+86400000,value:labels});}
 return labels;
}
