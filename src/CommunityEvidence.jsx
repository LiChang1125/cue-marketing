import React,{useMemo,useState} from 'react';
import {communityForTopic} from '../shared/community.js';

function ResponseLine({post}){
  if(post.kind==='brand-post')return <small>{post.likes??(post.likesLabel||'—')} 赞 · {post.replies??'—'} 条评论{post.since&&<> · 较 {post.since.slice(5,10)} {post.likeChange>=0?'+':''}{post.likeChange} 赞、{post.replyChange>=0?'+':''}{post.replyChange} 评论</>}</small>;
  if(post.platform==='Hacker News')return <small>{post.points} 积分 · {post.replies} 条评论</small>;
  if(post.platform==='B站')return <small>累计播放 {post.plays??'—'} · 弹幕 {post.danmaku??'—'}</small>;
  if(post.platform==='Instagram')return <small>七天新增赞评 {post.likesGain} · 累计 {post.total} · {post.author}</small>;
  if(Number.isFinite(post.replies))return <small>{post.replies} 条回复</small>;
  return <small>当日最高第 {post.rank} 名{post.value!=null?' · 平台热度 '+post.value:''}</small>;
}
const explanations=[
  [/二创|拟人|鲸鱼娘|鯨魚娘|皮肤|同人|表情包|立绘|翻画|fan art/i,'角色二创'],
  [/联名|聯名|联乘|聯乘|联合推出|合作系列|collab/i,'联名合作'],
  [/短片|拍摄|创作者|达人|穿搭|试妆/i,'创作者内容'],
  [/发布|发售|首发|开售|新品|開賣/i,'新品发售']
];
export default function CommunityEvidence({feed,query,days,extra,busy}){
  const [selected,setSelected]=useState('');
  const groups=useMemo(()=>communityForTopic(feed?.socialTrends,query,days,extra,Date.now(),feed?.radar?.items),[feed,query,days,extra]);
  const group=groups.find(g=>g.platform===selected)||groups[0];
  if(!group)return <section className="market-side"><h3>社区热度</h3><p>{busy?'正在查询相关讨论…':'本期公开样本暂无可核实的讨论或榜单记录。'}</p></section>;
  const {posts,daily,older}=group;
  const cases=posts.length?posts:daily.length?[...new Map([...daily].reverse().map(r=>[r.url,r])).values()]:older.slice(0,2);
  const examples=cases.slice(0,3);
  const signal=explanations.find(([pattern])=>cases.some(c=>pattern.test(c.title)));
  const proof=signal&&cases.find(c=>signal[0].test(c.title));
  const totalReplies=posts.reduce((n,r)=>n+(r.replies||0),0);
  return <section className="market-pulse community-panel"><header><h2>社区热度</h2><small>近 {days} 天</small></header>
    <div className="market-tabs" aria-label="讨论平台">{groups.map(g=><button key={g.platform} aria-pressed={g===group} onClick={()=>setSelected(g.platform)}>{g.platform}</button>)}</div>
    {daily.length>0&&<div className="community-history"><p>{daily.length} 天有上榜记录，最高第 {Math.min(...daily.map(r=>r.rank))} 名。</p>
      <div className="community-dates">{daily.map(r=><a href={r.source} target="_blank" rel="noreferrer" key={r.day} title={r.day+' 第 '+r.rank+' 名'}><i style={{height:(8+32/Math.sqrt(r.rank))+'px'}}/><b>#{r.rank}</b><small>{r.day.slice(5)}</small></a>)}</div></div>}
    {posts.length>0&&<p>{group.platform==='Instagram'?'公开品牌帖样本':group.platform==='B站'?'期内发布的视频样本':'期内发布的讨论样本'} {posts.length} 条{posts.every(p=>Number.isFinite(p.replies))?'，合计 '+totalReplies+' 条回复。':'。'}</p>}
    {group.discussion&&<p>同一批 {group.discussion.sample} 条视频，自 {new Date(group.discussion.start).toLocaleDateString('zh-CN')} 至 {new Date(group.discussion.end).toLocaleDateString('zh-CN')} 弹幕净变化 {group.discussion.change>0?'+':''}{group.discussion.change} 条。</p>}
    {!daily.length&&!posts.length&&<p>本期暂无匹配样本 · 往期案例</p>}
    {proof&&<p><b>{signal[1]}　</b><a href={proof.url} target="_blank" rel="noreferrer">{proof.title} ↗</a></p>}
    <div className="community-cases">{examples.map(p=><article key={p.url}><small>{p.day} · {group.platform}</small><a href={p.url} target="_blank" rel="noreferrer">{p.title} ↗</a><ResponseLine post={p}/>{p.originalTitle&&p.title!==p.originalTitle&&<details><summary>原帖摘录</summary><p>{p.originalTitle}</p></details>}</article>)}</div>
    {posts[0]?.platform==='Instagram'&&<p><a href={posts[0].source} target="_blank" rel="noreferrer">Monitor Mentions · 品牌帖样本 ↗</a></p>}
  </section>;
}
