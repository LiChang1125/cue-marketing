import {topicMatches} from './insights.js';
export function isWhaleTopic(q){
  return /deep\s*seek|深度求索|深度求索鲸/i.test(q)&&/鲸|鯨|whale|吉祥物|拟人|鯨魚娘/i.test(q);
}
export function topicKey(q){
  return isWhaleTopic(q)?'DeepSeek 鲸鱼':q.trim().toLowerCase();
}
export function evidenceMatches(title,query){
  if(isWhaleTopic(query))return /deep\s*seek|深度求索/i.test(title)&&/鲸|鯨|whale|吉祥物|mascot/i.test(title)&&!/官方API|token|零基础教程|终极教程|部署教程|模型限额/i.test(title);
  for(const aliases of [['耐克','Nike'],['阿迪达斯','adidas'],['拉夫劳伦','Ralph Lauren'],['丝芙兰','Sephora'],['宝可梦','Pokémon','Pokemon'],['泡泡玛特','POP MART']]){
    if(aliases.some(n=>n.toLowerCase()===query.trim().toLowerCase()))return aliases.some(n=>title.toLowerCase().includes(n.toLowerCase()));
  }
  return topicMatches({title},query);
}
export function v2exItems(json,query){
  const rows=[];
  for(const hit of json.hits||[]){
    const s=hit._source;
    if(!s||!/^\d+$/.test(String(s.id))||!evidenceMatches(s.title,query)||!Number.isFinite(s.replies))continue;
    const time=/[Z+]\d*:?\d*$/.test(s.created)?s.created:s.created+'+08:00';
    if(!Number.isFinite(Date.parse(time)))continue;
    rows.push({platform:'V2EX',title:s.title,url:'https://www.v2ex.com/t/'+s.id,day:time.slice(0,10),replies:s.replies});
  }
  return rows;
}
export function comparableDiscussion(snapshots=[],days,now=Date.now()){
  const selected=snapshots.filter(s=>Date.parse(s.at)>=now-days*86400000&&Date.parse(s.at)<=now);
  if(selected.length<2)return null;
  const first=selected[0],last=selected.at(-1);
  const initial=new Map(first.counts.map(r=>[r.url,r.danmaku]));
  const matched=last.counts.filter(r=>initial.has(r.url));
  if(!matched.length)return null;
  return {sample:matched.length,change:matched.reduce((sum,r)=>sum+r.danmaku-initial.get(r.url),0),start:first.at,end:last.at};
}
export function communityForTopic(data={},query,days,external=[],now=Date.now(),native=[]){
  const until=new Date(now+8*3600000).toISOString().slice(0,10);
  const since=new Date(now+8*3600000-(days-1)*86400000).toISOString().slice(0,10);
  const byPlatform=new Map(),seen=new Set();
  const add=(r,board=false)=>{
    if(!r.day||r.day>until||!/^https?:\/\//i.test(r.url))return;
    const id=r.platform+'|'+r.url+(board?'|'+r.day:'');
    if(seen.has(id))return;seen.add(id);
    if(!byPlatform.has(r.platform))byPlatform.set(r.platform,{platform:r.platform,posts:[],ranks:[],older:[]});
    const group=byPlatform.get(r.platform);
    if(r.day<since){if(!board)group.older.push(r);return;}
    (board?group.ranks:group.posts).push(r);
  };
  const stored=data.communityTopics?.[topicKey(query)]?.items||[];
  for(const r of [...external,...stored])if(evidenceMatches([r.title,r.originalTitle].filter(Boolean).join(' '),query))add(r);
  for(const i of native){
    if(i.contentType!=='hot-topic'||!/bilibili|zhihu/.test(i.source)||!i.observedAt||!evidenceMatches(i.title,query))continue;
    const ranks=[i.rank,...(i.rankTimeline||[]).map(p=>p.rank)].filter(n=>Number.isInteger(n)&&n>0);
    if(ranks.length)add({platform:i.source.includes('zhihu')?'知乎':'B站',title:i.title,rank:Math.min(...ranks),url:i.url,source:i.url,day:i.observedAt.slice(0,10)},true);
  }
  for(const r of [...(data.rows||[])].sort((a,b)=>b.day.localeCompare(a.day))){
    if(!evidenceMatches([r.entity,r.title].filter(Boolean).join(' '),query))continue;
    if(r.platform==='Instagram')add({...r,likesGain:r.value});
    else if(r.series?.includes('热搜'))add(r,true);
  }
  return [...byPlatform.values()].map(g=>{
    g.posts.sort((a,b)=>b.day.localeCompare(a.day));g.older.sort((a,b)=>b.day.localeCompare(a.day));
    const best=new Map();
    for(const r of g.ranks){if(!best.has(r.day)||r.rank<best.get(r.day).rank)best.set(r.day,r);}
    g.daily=[...best.values()].sort((a,b)=>a.day.localeCompare(b.day));
    if(g.platform==='B站')g.discussion=comparableDiscussion(data.communityTopics?.[topicKey(query)]?.snapshots,days,now);
    return g;
  }).sort((a,b)=>(b.posts.length+b.daily.length)-(a.posts.length+a.daily.length));
}
