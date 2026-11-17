// Hero stories require a downloaded publisher image, never a theme fallback.
export function featuredNews(items,now=Date.now(),excluded=[]){
 return items.filter(i=>!excluded.includes(i.id)&&/^\/media\/[\w.-]+$/.test(i.imageLocal||'')&&/^https?:\/\//.test(i.imageOrigin||i.image||'')&&Date.parse(i.publishedAt)<=now&&Date.parse(i.publishedAt)>=now-7*86400000).slice(0,3);
}
