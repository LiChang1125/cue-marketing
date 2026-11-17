import {readFile} from 'node:fs/promises';
import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function installAccess(app,{file=process.env.CUE_ACCOUNTS_FILE,required=true,secure=process.env.NODE_ENV==='production'}={}){
 let accounts=[];if(file)accounts=JSON.parse(await readFile(file,'utf8'));
 const sessions=new Map(),attempts=new Map(),cookie='cue_session',ttl=12*3600000;
 const token=req=>String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1);
 const user=req=>{const id=token(req),s=sessions.get(id);if(!s||s.expires<Date.now()){sessions.delete(id);return null;}return s.user;};
 const writeCookie=(res,value,maxAge)=>res.set('Set-Cookie',`${cookie}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`);
 app.get('/api/session',(req,res)=>res.set('Cache-Control','no-store').json({user:user(req),required}));
 // SameSite cookies plus same-origin validation protect login/logout and mutations.
 app.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'请求来源无效'});}catch{return res.status(403).json({error:'请求来源无效'});}}next();});
 app.post('/api/login',async(req,res)=>{
  const username=String(req.body?.username||'').trim().toLowerCase(),password=String(req.body?.password||'');
  if(username.length>40||password.length>128)return res.status(400).json({error:'账号或密码不正确'});
  const now=Date.now();for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
  for(const [k,v]of sessions)if(v.expires<now)sessions.delete(k);
  const keys=['ip:'+req.ip,'user:'+username];if(keys.some(k=>(attempts.get(k)?.count||0)>=10))return res.status(429).json({error:'尝试次数过多，请稍后再试'});
  const account=accounts.find(a=>a.username===username&&!a.disabled),salt=account?.salt||'unavailable-account';
  try{const actual=await derive(password,salt,64),expected=account?Buffer.from(account.hash,'base64'):Buffer.alloc(64);
   if(!account||expected.length!==64||!timingSafeEqual(actual,expected)){for(const k of keys){const a=attempts.get(k)||{count:0,until:now+15*60000};a.count++;attempts.set(k,a);}return res.status(401).json({error:'账号或密码不正确'});}
   attempts.delete('user:'+username);const person={username:account.username,name:account.name};const old=token(req);if(old)sessions.delete(old);
   const id=randomBytes(32).toString('base64url');sessions.set(id,{user:person,expires:now+ttl});writeCookie(res,id,ttl/1000);res.set('Cache-Control','no-store').json({user:person});
  }catch{res.status(503).json({error:'登录暂不可用'});}
 });
 app.post('/api/logout',(req,res)=>{sessions.delete(token(req));writeCookie(res,'',0);res.json({ok:true});});
 app.use((req,res,next)=>{
  const protectedPath=/^\/(api\/|content-data\.json|preview-data\.json|research(?:\/|$)|trendradar(?:\/|$)|media(?:\/|$))/.test(req.path);
  if(required&&protectedPath&&!user(req))return res.status(401).json({error:'请先登录'});
  if(protectedPath)res.set('Cache-Control','private, no-store');next();
 });
 return {required,accountCount:accounts.length};
}
