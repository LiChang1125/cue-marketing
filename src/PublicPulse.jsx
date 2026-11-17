import React,{useEffect,useState} from 'react';
import {apiFetch,assetUrl} from './urls.js';
import {SearchBox} from './TopicExplorer.jsx';
import {researchTopics} from '../shared/research.js';
import OriginalLink from './OriginalLink.jsx';
import './pulse.css';
export default function PublicPulse({query='',onQuery,onOpen}){
 const [draft,setDraft]=useState(query),[submitted,setSubmitted]=useState(query),[days,setDays]=useState(90),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[hover,setHover]=useState(null);
 useEffect(()=>{if(query!==submitted){setDraft(query);setSubmitted(query);}},[query]);
 useEffect(()=>{if(!submitted){setResult(null);return;}const ctl=new AbortController();setBusy(true);setError('');apiFetch('/api/research?query='+encodeURIComponent(submitted)+'&days='+days,{signal:ctl.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'搜索暂不可用');return data;}).then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!ctl.signal.aborted)setBusy(false);});const refresh=setInterval(()=>apiFetch('/api/research?query='+encodeURIComponent(submitted)+'&days='+days,{signal:ctl.signal}).then(r=>r.ok?r.json():Promise.reject()).then(setResult).catch(()=>{}),60000);return()=>{ctl.abort();clearInterval(refresh);};},[submitted,days]);
 const search=word=>{word=word.trim();if(!word)return;setSubmitted(word);setDraft(word);onQuery?.(word);setHover(null);};
 const points=result?.series||[],max=Math.max(1,...points.map(p=>p.count));
 return <section className="public-pulse research-search"><SearchBox value={draft} onChange={setDraft} onSearch={search} busy={busy}/>
 {!submitted?<div className="research-start"><span>RESEARCH & PERSPECTIVES</span><h2>从一个主题，找到新的视角。</h2><p>市场研究、消费洞察与品牌策略</p><div className="research-suggestions">{researchTopics.slice(0,8).map(t=><button key={t.name} onClick={()=>search(t.name)}>{t.name} ↗</button>)}</div></div>:<>
 <div className="pulse-heading"><h2>{submitted} <span className="research-count">{result?.articles.length||0} 篇报告与深度报道</span></h2><div className="pulse-toggle" aria-label="报告时间范围">{[30,90,180].map(n=><button key={n} aria-pressed={days===n} onClick={()=>setDays(n)}>近 {n} 天</button>)}</div></div>
 {error&&<p className="error-box" role="alert">{error}</p>}{busy&&<p role="status" className="quiet-empty">正在查找相关报告…</p>}
 {!busy&&result&&<><div className="research-results">{result.articles.map((i,n)=><article key={i.id}><span className="research-number">{String(n+1).padStart(2,'0')}</span><div><div className="research-meta">{i.publisher||i.sourceName} · {new Date(i.publishedAt).toLocaleDateString('zh-CN')}</div><button className="research-title" onClick={()=>onOpen(i)}>{i.title}</button>{i.excerpt&&<p>{i.excerpt}</p>}<OriginalLink item={i}>阅读报告 ↗</OriginalLink></div></article>)}</div>{!result.articles.length&&<p className="quiet-empty">这个时间范围内暂无相关报告，可扩大时间范围或换一个主题。</p>}
 {result.articles.length>0&&<details className="research-chart"><summary>报告发布趋势 <span>{result.total} 篇 · {result.mediaCount} 家来源</span></summary><svg viewBox="0 0 720 150" role="img" aria-label="相关报告按原始发布日期的数量变化">{points.map((p,n)=><g key={p.date}><rect x={28+n*660/Math.max(1,points.length)} y={115-p.count/max*90} width={Math.max(8,500/points.length)} height={Math.max(2,p.count/max*90)} fill={hover===n?'#344a3e':'#9aa99b'} tabIndex="0" role="button" aria-label={p.date+'之前的时间段：'+p.count+'篇'} onMouseEnter={()=>setHover(n)} onFocus={()=>setHover(n)}><title>{p.date} · {p.count} 篇</title></rect>{n%3===0&&<text x={28+n*660/points.length} y="140">{p.date.slice(5)}</text>}</g>)}</svg><p>{hover==null?'按报告发布日期统计':points[hover].date+' · '+points[hover].count+' 篇'}{result.reportUrl&&<> · <a href={assetUrl(result.reportUrl)} target="_blank" rel="noreferrer">TrendRadar 汇总 ↗</a></>}</p></details>}</>}
 </>}
 </section>;
}
