import React from 'react';
import {nextActions} from '../shared/next-actions.js';
export default function NextActions({query,rows}){
 const ideas=nextActions(query,rows);
 const evidence=items=><div className="next-evidence">{items.map(i=><a key={i.url} href={i.url} target="_blank" rel="noreferrer">{i.title} ↗</a>)}</div>;
 return <aside className="next-actions" aria-label="本次搜索的下一步建议"><span className="next-eyebrow">WHAT’S NEXT</span><h2>下一步</h2>{!query?<p className="next-empty">趋势方向 · 潜力 IP · 行动灵感</p>:<><p className="next-context">{query} <span>{ideas.count} 条相关线索</span></p><section><h3>潜力方向 <small>待验证</small></h3>{ideas.directions.length?ideas.directions.map(d=><article key={d.name}><h4>{d.name}</h4><p>{d.action}</p>{evidence(d.evidence)}</article>):<p className="next-empty">暂未出现足够的重复信号。先比较相关案例的受众、场景和消费动机。</p>}</section><section><h3>IP 观察</h3>{ideas.ips.length?ideas.ips.map(ip=><article key={ip.name}><h4>{ip.name} <small>{ip.count} 条线索</small></h4><p>{ip.risk?'相关报道出现风险信号，先核查争议背景与品牌适配度。':ip.sources>1?'多个来源已提及，可优先验证联名受众与合作窗口。':'已有相关提及，先观察后续作品、活动与用户反馈。'}</p>{evidence(ip.evidence)}</article>):<p className="next-empty">本次结果暂无明确 IP 信号。</p>}</section></>}</aside>;
}
