export function createUrls({apiOrigin='',base='/'}={}) {
  if(apiOrigin){const url=new URL(apiOrigin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('API 地址必须是 HTTPS 来源地址');apiOrigin=url.origin;}
  if(!/^\/(?:[\w-]+\/)*$/.test(base))throw Error('网页路径无效');
  return {
    api(path){if(!path.startsWith('/api/'))throw Error('无效接口路径');return apiOrigin+path;},
    asset(path){return base+path.replace(/^\//,'');},
    media(path){return path?.startsWith('/media/')?apiOrigin+path:path;},
  };
}
const urls=createUrls({apiOrigin:import.meta.env?.VITE_API_ORIGIN||'',base:import.meta.env?.BASE_URL||'/'});
export const previewMode=import.meta.env?.VITE_PREVIEW==='true';
export const publicMode=import.meta.env?.VITE_PUBLIC_DATA==='true';
export const contentNow=()=>previewMode?Number(import.meta.env.VITE_PREVIEW_AT):Date.now();
export const assetUrl=urls.asset;
export const mediaUrl=path=>(previewMode||publicMode)&&path?.startsWith('/media/')?assetUrl(path):urls.media(path);
export async function apiFetch(path,options){
  if(publicMode){const {publicFetch}=await import('./public-data.js');return publicFetch(path,options,assetUrl);}
  if(previewMode){const {previewFetch}=await import('./preview.js');return previewFetch(path,options,assetUrl);}
  return fetch(urls.api(path),{...options,credentials:'omit'});
}
