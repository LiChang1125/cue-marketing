import {createPreviewFetch} from './preview.js';
let cached,inflight,loadedAt=0;
export async function publicFetch(path,options,assetUrl){
 if(!cached||Date.now()-loadedAt>60000){
   if(!inflight)inflight=fetch(assetUrl('content-data.json'),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('新闻暂时无法读取');const data=await r.json();cached=createPreviewFetch(data);loadedAt=Date.now();}).finally(()=>{inflight=null;});
   // Keep the last successful response during a temporary CDN/network failure.
   try{await inflight;}catch(e){if(!cached)throw e;}
 }
 return cached(path,options);
}
