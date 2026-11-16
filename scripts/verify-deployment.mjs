const base=new URL(process.argv[2]||'http://127.0.0.1:4173');
if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw Error('请提供网站 HTTP(S) 地址，不要在地址中放密钥');
let failed=0;
const check=(ok,label)=>{console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++;};
const recent=value=>Number.isFinite(Date.parse(value))&&Date.now()-Date.parse(value)>=-60000&&Date.now()-Date.parse(value)<30*60000;
const platforms=['xiaohongshu','douyin','bilibili-cli','weibo','zhihu'];
async function read(path){const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`接口 ${path} 返回 ${r.status}`);return r.json();}
try{
  const [health,feed,reports,attention]=await Promise.all(['/api/health','/api/feed','/api/reports','/api/attention?query=品牌联名'].map(read));
  check(health.ok,'服务运行');
  check(feed.editorial?.length>0,'首页有真实新闻');
  for(const id of ['socialbeta','brandstar',...platforms]){
    const source=feed.sources.find(s=>s.id===id);
    check(source?.state==='ok'&&recent(source.lastSuccess),`${id} 最近 30 分钟采集成功`);
    if(platforms.includes(id))check(source?.supportsSearch===true&&recent(source.lastSearchSuccess)&&source.count>0,`${id} 最近关键词搜索返回真实内容（只有热榜不算完成）`);
    if(['xiaohongshu','douyin'].includes(id)){
      check(feed.editorialCandidates?.some(i=>i.source===id&&i.imageLocal),`${id} 有合格带图新闻`);
      check(attention.platforms?.some(p=>p.source===id&&p.series.some(s=>!s.stale)),`${id} 有可核实的近期互动数据`);
    }
  }
  check(reports.schedule?.time==='08:00'&&reports.schedule?.timezone==='Asia/Shanghai','北京时间 08:00 日报排程');
  if(reports.schedule?.ready)check(reports.reports.some(r=>r.date===reports.schedule.day&&r.status==='ready'),'今日昨日新闻日报已完整生成');
  console.log('此检查不能替代关闭开发电脑后的持续采集、重启持久化和次日 08:00 线上验收。');
}catch(e){console.error(e.message);failed++;}
process.exitCode=failed?1:0;
