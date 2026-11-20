import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {decodeHTML} from 'entities';

const han=/[\u3400-\u9fff]/;
const foreign=/[\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]/;
const fields=['title','content','summary','relevanceReason'];
const names=new Map([['Nintendo','任天堂'],['Apple','苹果'],['Nike','耐克'],['Lego','乐高']].map(([a,b])=>[a.toLowerCase(),b]));
const clean=text=>decodeHTML(String(text||'').replace(/<[^>]+>/g,' ')).replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
function chinese(text){
  if(!text||foreign.test(text)||!han.test(text))return false;
  if(/\b(?:from|with|was|were|this|their|on|and|of|are|into|has)\s+(?:the\s+|an?\s+)?[A-Za-z]+\s+[A-Za-z0-9]/.test(text))return false;
  return !/[a-z]{2,}(?:[ ,;:]+[a-z]{2,}){3,}/i.test(text)&&
    ((text.match(/[A-Za-z]/g)||[]).length<32||(text.match(/\p{Script=Han}/gu)||[]).length*4>text.replace(/[^A-Za-z]/g,'').length);
}
function translate(texts,dir){
  const local=process.platform==='win32'?'.tools/python/Scripts/python.exe':'.tools/python/bin/python';
  const python=process.env.CUE_TRANSLATION_PYTHON||(existsSync(local)?resolve(local):'python');
  return new Promise((done,fail)=>{
    const p=spawn(python,['integrations/hot-monitor/localize.py',join(dir,'translations.db')],{windowsHide:true,
      env:{...process.env,PYTHONIOENCODING:'utf-8'},stdio:['pipe','pipe','pipe']});
    let output='';const timer=setTimeout(()=>p.kill(),90000);
    p.stdout.setEncoding('utf8');p.stdout.on('data',s=>{output+=s;});p.stderr.resume();p.stdin.on('error',()=>{});
    p.on('error',fail);p.on('close',code=>{clearTimeout(timer);try{if(code!==0)throw Error('本机翻译暂不可用');done(JSON.parse(output));}catch(e){fail(e);}});
    p.stdin.end(JSON.stringify(texts));
  });
}
async function publicExcerpt(text){
  const lang=/[\u3040-\u30ff]/.test(text)?'ja':/[\uac00-\ud7af]/.test(text)?'ko':/[\u0400-\u04ff]/.test(text)?'ru':'en';
  let excerpt='';
  for(const c of text){if(Buffer.byteLength(excerpt+c)>480)break;excerpt+=c;}
  const url=new URL('https://api.mymemory.translated.net/get');
  url.search=new URLSearchParams({q:excerpt,langpair:lang+'|zh-CN'});
  const response=await fetch(url,{signal:AbortSignal.timeout(4500)});
  if(!response.ok)return '';
  const data=await response.json();
  const result=clean(data.responseData?.translatedText||'');
  return Number(data.responseStatus)===200&&!data.quotaFinished&&chinese(result)?result:'';
}
export function createChineseDisplay(dataDir){
  const glossary=JSON.parse(readFileSync(new URL('../../config/translations.zh-CN.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
  const reviewed=new Map(Object.entries(glossary).map(([k,v])=>[clean(k),v]));
  const cache=new Map();
  let queue=Promise.resolve();
  return async rows=>{
    const copies=rows.map(row=>({...row}));
    const inputs=new Set();
    for(const row of copies){
      if(row.relevanceReason?.includes('未配置 AI'))row.summary=null;
      for(const key of fields)if(row[key]){
        const value=clean(row[key]).replace(/^发现新热点[:：]\s*/,'');
        row[key]=(key==='title'&&reviewed.get(clean(row.originalTitle)))||reviewed.get(value)||value.slice(0,key==='content'?1400:440);
        if(!chinese(row[key]))inputs.add(row[key]);
      }
      if(row.authorName&&!han.test(row.authorName))row.authorName=null;
    }
    if(inputs.size){
      queue=queue.then(async()=>{
        const missing=[...inputs].filter(t=>!cache.has(t));
        if(!missing.length)return;
        const english=missing.filter(t=>!foreign.test(t)||/[\u3040-\u30ff]/u.test(t));
        const converted=english.length?await translate(english,dataDir).catch(()=>({})):{};
        for(let i=0;i<missing.length;i+=4){
          await Promise.all(missing.slice(i,i+4).map(async text=>{
            const value=chinese(converted[text])?converted[text]:await publicExcerpt(text).catch(()=>'');
            if(!value)return;
            if(cache.size>=6000)cache.delete(cache.keys().next().value);
            cache.set(text,value);
          }));
        }
      }).catch(e=>console.error('热点中文展示:',e.message));
      await queue;
    }
    for(const row of copies){
      for(const key of fields)if(row[key]&&!chinese(row[key])){
        row[key]=names.get(row[key].toLowerCase())||cache.get(row[key])||null;
      }
      if(!row.title)row.title=(row.content||row.summary||'中文标题暂不可用').slice(0,70);
    }
    return copies;
  };
}

