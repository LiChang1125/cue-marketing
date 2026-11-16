export function publicCors(origins='') {
  const allowed=new Set(origins.split(',').map(s=>s.trim()).filter(Boolean).map(value=>{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('PUBLIC_WEB_ORIGINS 必须为 HTTPS 来源地址');
    return url.origin;
  }));
  const trusted=origin=>allowed.has(origin);
  function middleware(req,res,next){
    const origin=req.get('origin');
    if(!origin)return next();
    res.vary('Origin');
    const method=req.method==='OPTIONS'?req.get('access-control-request-method'):req.method;
    // Public Pages can read data and submit a topic, never invoke maintenance.
    if(!trusted(origin)||!(method==='GET'||method==='POST'&&req.path==='/topics'))return next();
    if(req.method==='OPTIONS'){
      const headers=(req.get('access-control-request-headers')||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
      if(headers.some(h=>h!=='content-type'))return res.sendStatus(403);
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Access-Control-Allow-Methods','GET, POST');
      res.setHeader('Access-Control-Allow-Headers','Content-Type');
      return res.sendStatus(204);
    }
    res.setHeader('Access-Control-Allow-Origin',origin);
    next();
  }
  return {middleware,trusted};
}
