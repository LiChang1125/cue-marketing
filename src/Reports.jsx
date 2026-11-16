import {apiFetch} from './urls.js';
import OriginalLink from './OriginalLink.jsx';
import React, {useEffect,useState} from 'react';
import Cover from './Cover.jsx';
import {ArrowUpRight,FileText} from 'lucide-react';
const time=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export default function Reports(){
  const [data,setData]=useState(null),[day,setDay]=useState(''),[error,setError]=useState('');
  async function load(){try{const r=await apiFetch('/api/reports',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();setData(await r.json());setError('');}catch{setError('暂时无法读取日报，服务恢复后会自动重试。');}}
  useEffect(()=>{load();const id=setInterval(load,10000);return()=>clearInterval(id);},[]);
  const report=data?.reports.find(r=>r.date===day)||data?.reports[0];
  const sections=['品牌与公司','联名与 IP','新品与消费','平台与营销','社交平台线索'];
  return <section className="reports-layout"><div className="report-paper"><div className="report-masthead"><span>CUE / THE MARKETING BRIEF</span><span>08:00 · 北京时间</span></div><div className="report-heading"><div><h2>CUE 早报</h2><p>{report?report.newsDate+' · 昨日营销新闻':'昨日营销新闻'}</p></div><FileText size={36} strokeWidth={1}/></div>
    {error&&<div className="error-box" role="alert">{error}</div>}
    {!data&&!error&&<p className="report-note">正在读取日报…</p>}
    {report?<>
      <p className="report-deck">{report.subtitle||'本期暂缺可核实的新消息'}</p>
      
      {report.status!=='ready'&&<p className="report-warning">{report.status==='insufficient'?'本期暂无新消息':'部分来源更新延迟'}</p>}
      {report.entries.length>0&&<div className="report-top"><h3>先看这 {Math.min(3,report.entries.length)} 条</h3>{report.entries.slice(0,3).map((item,i)=><a key={item.id} href={'#brief-'+item.id}><span>0{i+1}</span><Cover item={item}/>{item.title}<ArrowUpRight size={15}/></a>)}</div>}
      {sections.filter(section=>section!=='社交平台线索'||report.entries.some(e=>e.section===section)).map(section=>{const entries=report.entries.filter(e=>e.section===section);return <section className="report-section" key={section}><h3>{section}</h3>{!entries.length&&<p className="section-empty">暂无收录</p>}{entries.map(item=><article id={'brief-'+item.id} key={item.id}><Cover item={item} className="report-entry-cover"/><h4><OriginalLink item={item} keepText>{item.title} <ArrowUpRight size={16}/></OriginalLink></h4>{item.excerpt&&<p>{item.excerpt}</p>}<div className="report-entry-meta"><span>{item.source==='brandstar'||item.sourceName?.includes('品牌星球')?'精选资讯':item.sourceName} · {item.summaryKind==='edited'?'摘要':item.excerpt?'原文摘录':'原标题'} · 发布 {time(item.publishedAt)}</span><OriginalLink item={item}>查看原文 ↗</OriginalLink></div>{item.section==='社交平台线索'&&<small>{item.attribution}</small>}</article>)}</section>;})}
      
    </>:data&&<div className="empty"><h3>{data.generating?'正在整理本期早报':'第一期早报尚未生成'}</h3></div>}
  </div><aside className="report-aside"><section className="report-archive"><h3>往期日报</h3>{data?.reports.map(r=><button className={report?.date===r.date?'active':''} onClick={()=>setDay(r.date)} key={r.date}><span>{r.date}</span><small>{r.entries.length} 条</small></button>)}</section></aside></section>;
}
