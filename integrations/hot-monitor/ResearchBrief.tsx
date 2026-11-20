import React from 'react';

export default function ResearchBrief({brief}){
  if(!brief)return null;
  return <section className="cue-research" aria-label="近三十天品牌洞察">
    <header><h2>近 30 天 · 品牌动向</h2></header>
    {brief.directions.length===0?<p>近 30 天暂无可核实的品牌案例。</p>:
      <div className="cue-directions">{brief.directions.map(d=><article key={d.name}>
        <small>{d.name} · {d.count} 条线索</small>
        <a href={d.url} target="_blank" rel="noreferrer">{d.title} ↗</a>
        {d.detail&&<p>{d.detail}</p>}
        {d.metrics&&<p>{d.metrics}</p>}
      </article>)}</div>}
    {brief.voice&&<aside><small>{brief.voice.kind||'社区评论摘录'} · {brief.voice.day}{Number.isFinite(brief.voice.likes)?' · '+brief.voice.likes+' 赞':''}</small>
      <p><a href={brief.voice.url} target="_blank" rel="noreferrer">{brief.voice.text} ↗</a></p></aside>}
    {brief.boards?.length>0&&<details><summary>同期榜单记录</summary><ul>{brief.boards.map(b=><li key={b.url+b.title}>
      <a href={b.url} target="_blank" rel="noreferrer">{b.title} ↗</a> · {b.series}第 {b.rank} 位 · {b.day}
    </li>)}</ul></details>}
    <details><summary>查看检索范围</summary><ul>{brief.coverage.map(p=><li key={p.name}>
      {p.name} · {p.status}{p.count?' · '+p.count+' 条线索':p.status==='暂不可用'?'':' · 暂无可核实案例'}
    </li>)}</ul></details>
  </section>;
}
