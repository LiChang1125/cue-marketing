import {topicMatches} from './insights.js';
const synonyms=[
 ['耐克','Nike'],['阿迪达斯','adidas'],['拉夫劳伦','Ralph Lauren'],['丝芙兰','Sephora'],
 ['宝可梦','Pokémon','Pokemon'],['泡泡玛特','POP MART'],['乐高','LEGO'],['F1','Formula 1','一级方程式'],
 ['鲸鱼','鯨魚','鲸鱼娘','鲸鲸','whale'],['吉祥物','mascot'],['深度求索','DeepSeek'],
 ['高达','高達','鋼彈','Gundam'],['跑鞋','跑步鞋','running shoes','running shoe']
];
export function topicKey(q){
  const plain=String(q||'').normalize('NFKC').trim();
  return (plain.replace(/^(?:(?:请|帮我|我想|想要|搜索|查询|了解|看看|看一下|关于|最近的|近期的)\s*)+/,'')
    .replace(/(?:最近|近期|这周|本周)?(?:的)?(?:品牌动向|市场趋势|营销趋势|讨论度怎么样|讨论度如何|热度怎么样|有哪些联名|最近怎么样)[？?。 ]*$/,'')
    .replace(/([a-z0-9])([\u3400-\u9fff])/ig,'$1 $2').replace(/([\u3400-\u9fff])([a-z0-9])/ig,'$1 $2')
    .replace(/\s+/g,' ').trim()||plain).toLowerCase();
}
export function evidenceMatches(title,query){
  const text=String(title||'').normalize('NFKC').toLowerCase().replace(/高[达達](?=\s*(?:约|近|逾|数|超|[\d一二三四五六七八九十百千万億亿]))/g,'达到');
  const key=topicKey(query);
  if(!key)return false;
  const terms=key.split(/\s+|[＋+×、,，]/).map(t=>t.replace(/^[的与和及]+|[的与和及]+$/g,'')).filter(Boolean);
  if(/鲸鱼|吉祥物|mascot|whale/i.test(key)&&/官方api|token|零基础教程|终极教程|部署教程|模型限额/i.test(text))return false;
  if(topicMatches({title:text},key))return true;
  return terms.length>0&&terms.every(term=>{
    const alternatives=synonyms.find(group=>group.some(t=>t.toLowerCase()===term))||[term];
    return alternatives.some(t=>text.includes(t.toLowerCase()));
  });
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
  const cached=Object.entries(data.communityTopics||{}).find(([subject])=>topicKey(subject)===topicKey(query))?.[1];
  const stored=cached?.items||[];
  for(const r of [...external,...stored])if(r.matchedQuery===query||evidenceMatches([r.title,r.originalTitle].filter(Boolean).join(' '),query))add(r);
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
    if(g.platform==='B站')g.discussion=comparableDiscussion(cached?.snapshots,days,now);
    return g;
  }).sort((a,b)=>(b.posts.length+b.daily.length)-(a.posts.length+a.daily.length));
}
