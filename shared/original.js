export function originalHref(item){
  const value=item.originalUrl||item.url;
  try{const url=new URL(value);if(!/^https?:$/.test(url.protocol))return null;if(/(^|\.)brandstar\.com\.cn$/.test(url.hostname)&&!/^\/articles\/[^/]+\/?$/.test(url.pathname))return null;return url.href;}catch{return null;}
}
