import {load} from 'cheerio';
import {evidenceMatches,topicKey} from '../shared/community.js';
const dayMs=86400000;
function postedDay(label,now){
  const day=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
  const full=label.match(/(20\d\d)[年-](\d{1,2})[月-](\d{1,2})/);
  if(full)return [full[1],full[2].padStart(2,'0'),full[3].padStart(2,'0')].join('-');
  const relative=label.match(/(\d+)\s*(秒|分钟|小时|天)前/);
  if(relative)return day(now-relative[1]*({秒:1000,分钟:60000,小时:3600000,天:dayMs})[relative[2]]);
  if(label.includes('昨天'))return day(now-dayMs);
  if(/今天|刚刚/.test(label))return day(now);
  const parts=label.match(/(\d+)月(\d+)日/)||label.match(/(?:^|[·\s])(\d{1,2})-(\d{1,2})(?:$|\s)/);
  if(!parts)return null;
  const today=day(now),suffix=parts[1].padStart(2,'0')+'-'+parts[2].padStart(2,'0');
  return (Number(today.slice(0,4))-(suffix>today.slice(5)?1:0))+'-'+suffix;
}
export async function biliTopic(query,now=Date.now(),matches=evidenceMatches,order){
  const u=new URL('https://search.bilibili.com/all');
  u.searchParams.set('keyword',topicKey(query));
  if(order==='pubdate')u.searchParams.set('order','pubdate');
  const res=await fetch(u,{signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw Error('B站 HTTP '+res.status);
  const $=load(await res.text()),cards=$('.bili-video-card__wrap');
  if(!cards.length&&!/没有找到|暂无结果|啥都没搜到/.test($('main').text()))throw Error('B站搜索页暂不可读');
  const items=[];
  cards.each((_,el)=>{
    const card=$(el),title=card.find('h3').text().trim(),href=card.find('a[href*="/video/BV"]').first().attr('href')||'';
    const bv=href.match(/\/video\/(BV[a-zA-Z0-9]+)\/?(?:[?#].*)?$/)?.[1];
    const day=postedDay(card.find('.bili-video-card__info--date').text(),now);
    if(!bv||!day||!matches(title,query))return;
    const stats=card.find('.bili-video-card__stats--item').map((_,e)=>$(e).text().trim()).get();
    const author=card.find('.bili-video-card__info--author').first().text().trim();
    const raw=card.find('picture img,img').first().attr('src');
    const image=raw?.startsWith('//')?'https:'+raw:raw;
    items.push({platform:'B站',title,day,url:'https://www.bilibili.com/video/'+bv+'/',plays:stats[0]||null,danmaku:stats[1]||null,author,image});
  });
  return {checkedAt:new Date(now).toISOString(),items};
}
export async function refreshCommunityTopics(previous={},topics,now=Date.now()){
  const entries={};
  const queue=[...new Set(topics.map(topicKey))].slice(0,10);
  async function work(){
    while(queue.length){
      const topic=queue.shift(),old=previous[topic];
      if(old&&Date.parse(old.checkedAt)>now-6*3600000){entries[topic]=old;continue;}
      try{
        const fresh=await biliTopic(topic,now);
        const snapshots=(old?.snapshots||[]).filter(s=>Date.parse(s.at)>=now-30*dayMs);
        const counts=fresh.items.filter(i=>/^\d+$/.test(i.danmaku||'')).map(i=>({url:i.url,danmaku:Number(i.danmaku)}));
        entries[topic]={...fresh,snapshots:[...snapshots,{at:fresh.checkedAt,counts}]};
      }
      catch{if(old&&Date.parse(old.checkedAt)>now-7*dayMs)entries[topic]=old;}
    }
  }
  await Promise.all([work(),work()]);
  return entries;
}
