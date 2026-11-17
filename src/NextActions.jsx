import React from 'react';
import {nextActions} from '../shared/next-actions.js';
export default function NextActions({query,rows}){
 const ideas=nextActions(query,rows);
 const evidence=items=><div className="next-evidence">{items.map(i=><a key={i.url} href={i.url} target="_blank" rel="noreferrer">{i.title} ↗</a>)}</div>;
 return <aside className="next-actions" aria-label="本次搜索的下一步建议"><span className="next-eyebrow">WHAT’S NEXT</span><h2>下一步</h2><p className="next-context">{ideas.query} <span>{ideas.count?'基于本次内容推演':'探索假设 · 等待验证'}</span></p><section><h3>下一波方向 <small>{ideas.directions[0]?.hypothesis?'探索假设':'线索推演'}</small></h3>{ideas.directions.map(d=><article key={d.name}><h4>{d.name}</h4>{d.reason&&<p>{d.reason}</p>}<p className="next-action-line">{d.action}</p>{evidence(d.evidence)}</article>)}</section><section><h3>潜力 IP <small>{ideas.ips[0]?.hypothesis?'概念候选':'调研候选'}</small></h3>{ideas.ips.map(ip=><article key={ip.name}><h4>{ip.name}</h4><p>{ip.hypothesis?ip.reason:ip.risk?'相关报道出现风险信号，先核查争议背景与品牌适配度。':ip.sources>1?'多个来源已提及，下一步可验证联名受众与新的使用场景。':'可继续观察角色的新内容、活动和受众反馈，测试是否能延伸到品牌场景。'}</p>{evidence(ip.evidence)}</article>)}</section></aside>;
}
