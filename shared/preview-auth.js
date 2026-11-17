// Presentation-only login for the explicitly approved GitHub Pages preview.
// Real access control lives in server/access.js; these records are not secrets.
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function previewLogin(records,username,password,cryptoApi=globalThis.crypto){
 const encode=new TextEncoder(),name=username.trim().toLowerCase();
 const id=[...new Uint8Array(await cryptoApi.subtle.digest('SHA-256',encode.encode(name)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const record=records.find(r=>r.id===id);if(!record)throw Error('账号或密码不正确');
 try{const material=await cryptoApi.subtle.importKey('raw',encode.encode(name+':'+password),'PBKDF2',false,['deriveKey']);
 const key=await cryptoApi.subtle.deriveKey({name:'PBKDF2',salt:bytes(record.salt),iterations:150000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
 return JSON.parse(new TextDecoder().decode(await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:bytes(record.iv)},key,bytes(record.data))));
 }catch{throw Error('账号或密码不正确');}
}
