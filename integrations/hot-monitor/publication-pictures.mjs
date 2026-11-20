import {createHash} from 'node:crypto';
import {mkdir,writeFile,access,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {publisherImage} from './open-news.mjs';
const signatures=[['jpg',b=>b[0]===255&&b[1]===216],['png',b=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))],['webp',b=>b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'],['gif',b=>/^GIF8[79]a/.test(b.toString('ascii',0,6))]];
export function publicationPictures(dataDir){
 const dir=join(dataDir,'media'),pending=new Map();
 async function cache(url){
   const key=createHash('sha256').update(url).digest('hex');
   for(const [ext] of signatures){try{await access(join(dir,key+'.'+ext));return '/media/'+key+'.'+ext;}catch{}}
   const data=await publisherImage(url);
   const ext=signatures.find(([,valid])=>data.length>1024&&valid(data))?.[0];
   if(!ext)return null;
   await mkdir(dir,{recursive:true});const name=key+'.'+ext;
   await writeFile(join(dir,name+'.tmp'),data);await rename(join(dir,name+'.tmp'),join(dir,name));
   return '/media/'+name;
 }
 return async rows=>{
   const queue=rows.filter(r=>!r.imageLocal&&/^https:\/\//.test(r.image||''));
   async function worker(){while(queue.length){
     const row=queue.shift(),url=row.image;
     if(!pending.has(url))pending.set(url,cache(url).catch(()=>null).finally(()=>pending.delete(url)));
     row.imageLocal=await pending.get(url);
   }}
   await Promise.all(Array.from({length:4},worker));return rows;
 };
}
