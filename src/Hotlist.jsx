import React from 'react';
import Cover from './Cover.jsx';
export default function Hotlist({items=[],onOpen,onBoard}){
  return <section className="marketing-hotlist" aria-label="营销热榜"><div className="hotlist-heading"><div><span>THE MARKETING EDIT</span><h2>营销热榜 <i title="近 7 天营销新闻，综合来源内互动排名、报道新近程度及多来源提及排序。不是全网官方热榜。">↗</i></h2></div><small>近 7 天</small></div>
    {items.length?<ol>{items.map((item,i)=><li key={item.id}><button onClick={()=>onOpen(item)}><b className={i<3?'top-rank':''}>{String(i+1).padStart(2,'0')}</b><span className="hotlist-copy"><strong>{item.title}</strong><small>{item.platformCount} 个来源 · {item.mentions} 篇内容</small></span><Cover item={item}/></button></li>)}</ol>:<p className="quiet-empty">近期新闻正在汇入</p>}
    {onBoard&&<button className="hotlist-more" onClick={onBoard}>打开营销看板 <span>↗</span></button>}
  </section>;
}
