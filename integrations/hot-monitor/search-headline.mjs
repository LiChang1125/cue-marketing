// Preserve a query's attested terminology when a translation drops it or mangles a product name.
export function headlineParts(source,subject,terms){
 if(!/[\p{Script=Han}]/u.test(subject)||!source||source.length>350)return null;
 const normalized=source.normalize('NFKC');
 const matches=terms.filter(Boolean).sort((a,b)=>b.length-a.length)
   .flatMap(term=>{const t=term.normalize('NFKC');const i=normalized.toLowerCase().indexOf(t.toLowerCase());if(i<0)return [];
     if(/^[a-z]/i.test(t)&&/[a-z]/i.test(normalized[i-1]||''))return [];
     if(/^[a-z]/i.test(t)&&/[a-z]/i.test(normalized[i+t.length]||'')&&!/^s\b/i.test(normalized.slice(i+t.length)))return [];
     return [{i,t}];});
 const m=matches[0];if(!m)return null;
 const after=normalized.slice(m.i+m.t.length).replace(/^s\b/i,'');
 return {left:normalized.slice(0,m.i).trim(),right:after.trim(),subject};
}
export function readableHeadline(original,translated,subject,terms){
 const p=headlineParts(original,subject,terms);if(!p)return translated;
 const launch=p.left.match(/^(.{2,70}?)\s+(?:launches|introduces|debuts|unveils|releases)\s+([A-Z][\w’'-]*(?:\s+[A-Z][\w’'-]*){0,3})?$/i);
 if(launch&&!p.right&&launch[1].length<=65)return launch[1]+' 推出'+(launch[2]?' '+launch[2]+' ':'')+subject;
 return translated;
}

export async function localizeSearchHeadlines(rows,subject,terms,translate){
 const layouts=new Map(),pieces=new Set();
 for(const r of rows){
   const original=r.originalTitle||'';
   if(!original||r.title.includes(subject))continue;
   const explicit=readableHeadline(original,r.title,subject,terms);
   if(explicit!==r.title){r.title=explicit;continue;}
   const p=headlineParts(original,subject,terms);if(!p)continue;
   const chunks=[p.left,p.right].map(s=>s.replace(/^[\s:：、，,•‐–—-]+|[\s:：、，,•‐–—-]+$/gu,''));
   if(chunks.every(s=>!s)||!/[ぁ-ヿ]/u.test(original))continue;
   layouts.set(r,chunks);for(const chunk of chunks)if(chunk)pieces.add(chunk);
 }
 if(!pieces.size)return;
 const strings=[...pieces],localized=await translate(strings.map(title=>({title})));
 const names=new Map(strings.map((s,i)=>[s,localized[i]?.title]));
 for(const [row,chunks] of layouts){
   const rendered=chunks.map(s=>s?names.get(s):'');
   if(chunks.some((s,i)=>s&&(!rendered[i]||rendered[i]==='中文标题暂不可用'||brokenCopy(rendered[i]))))continue;
   const title=[rendered[0],subject,rendered[1]].filter(Boolean).join('').replace(/^[.。 ]+|[.。 ]+$/g,'');
   if(title.length>subject.length+3&&title.length<=160)row.title=title;
 }
}

export function brokenCopy(text){
 return /\\(?:fn|fs\d|bord|shad|blur|pos\(|an\d)|\bH[0-9A-F]{5,}\b|�|\?(?:\s*\?){2,}|<unk>|(.{3,8})\1{3}/iu.test(text||'');
}
