import {load} from 'cheerio';

const archive='https://raw.githubusercontent.com/solarhell/hot-search-crawler/main/data/';
const latest='https://solarhell.github.io/hot-search-crawler/latest.json';
const ig='https://kabo.sh/tools/trending-instagram-audio';
const commerce='https://www.chanmama.com/open/';
export const dayKey=time=>new Date(Number(time)+8*3600000).toISOString().slice(0,10);
const dayMs=86400000;

async function read(url,json=true){
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  return json?response.json():response.text();
}

function boardRows(snapshot,url){
  const result=[];
  for(const board of snapshot.boards||[]){
    if(board.ok===false||!['weibo','douyin','xiaohongshu'].includes(board.platform))continue;
    for(const item of board.items||[]){
      const observed=Date.parse(item.last_seen||board.fetched_at);
      if(!Number.isFinite(observed)||!Number.isInteger(item.best_rank||item.rank)||!item.title)continue;
      result.push({platform:board.name,series:board.name+'热搜',title:item.title,rank:item.best_rank||item.rank,
        value:item.hot_text||item.hot,unit:'平台热度',day:dayKey(observed),url:item.url,source:url});
    }
  }
  return result;
}

async function sales(){
  const $=load(await read(commerce,false));
  const card=$('.rank-card').filter((_,e)=>$(e).find('h2').text().includes('品牌'));
  const day=card.find('.rank-date').text().trim();
  return card.find('a.rank-item').map((i,e)=>{
    const title=$(e).find('.item-name').text().trim();
    return {platform:'抖音',series:'蝉妈妈品牌销售榜',entity:title.split('/').at(-1),title,day,rank:i+1,
      value:$(e).find('.increment-value').text().trim(),unit:'日销售额',source:commerce,url:new URL($(e).attr('href'),commerce).href};
  }).get();
}

async function salesDay(day){
  const source=commerce+'brandRank.html?cat=-1&type=day&day='+day;
  const $=load(await read(source,false));
  if(!$('a[href*="type=day"]').toArray().some(e=>$(e).attr('href')?.endsWith('day='+day)))return [];
  const headings=$('tr').first().text().replace(/\s/g,'');
  if(!headings.includes('销量销售额商品数关联视频关联直播关联达人'))return [];
  return $('tr').slice(1).map((index,e)=>{
    const cells=$(e).find('td'),title=cells.eq(1).text().trim(),link=cells.eq(1).find('a').attr('href');
    if(!title||!link||cells.length!==8)return null;
    const count=i=>{const s=cells.eq(i).text().trim().replaceAll(',','');return /^\d+$/.test(s)?Number(s):null;};
    return {platform:'抖音',series:'蝉妈妈品牌销售榜',title,entity:title.split('/').at(-1),day,rank:index+1,
      value:cells.eq(3).text().trim(),unit:'预估日销售额',volume:cells.eq(2).text().trim(),videos:count(5),lives:count(6),creators:count(7),
      url:new URL(link,commerce).href,source};
  }).get();
}

async function reels(){
  const $=load(await read(ig,false));
  const stamp=Date.parse($('time[datetime]').first().attr('datetime'));
  if(!Number.isFinite(stamp))return [];
  return $('tr').map((_,e)=>{
    const row=$(e),sound=row.find('.audio-board__title').text().trim();
    if(!sound)return null;
    return {platform:'Instagram',series:'Kabo 配乐日增榜',title:sound,entity:sound,artist:row.find('.audio-board__artist').text().trim(),
      day:dayKey(stamp),rank:Number(row.find('.audio-board__rank').text()),value:row.find('.audio-board__growth').text().trim(),
      total:row.find('.audio-board__count').text().trim(),unit:'24小时使用增量',source:ig,url:row.find('.audio-board__link a').attr('href')};
  }).get();
}

export async function collectSocialTrends(previous={}, now=Date.now()){
  const cutoff=dayKey(now-6*dayMs),today=dayKey(now);
  const rows=new Map(),archives=new Set((previous.archives||[]).filter(d=>d>=cutoff));
  function merge(row){
    if(!row.title||!row.rank||!(row.day>=cutoff&&row.day<=today)||!/^https?:\/\//.test(row.url))return;
    const key=[row.series,row.day,row.title].join('|');
    const old=rows.get(key);
    if(!old||row.rank<old.rank||(row.rank===old.rank&&(old.volume==null||row.volume!=null)))rows.set(key,row);
  }
  for(const row of previous.rows||[])merge(row);
  const jobs=[async()=>boardRows(await read(latest),latest),sales,reels];
  for(let i=0;i<7;i++){
    const day=dayKey(now-i*dayMs);
    if(i>0&&!previous.rows?.some(r=>r.day===day&&r.volume&&r.rank===10))jobs.push(()=>salesDay(day));
    if(archives.has(day)&&i>1)continue;
    jobs.push(async()=>{
      const url=archive+day+'/summary.json';
      const result=boardRows(await read(url),url);
      if(result.length&&i>0)archives.add(day);
      return result;
    });
  }
  for(const job of await Promise.allSettled(jobs.map(load=>load()))){
    if(job.status==='fulfilled')job.value.forEach(merge);
    else console.warn('脉动公开数据源暂不可用',job.reason.message);
  }
  const cases=new Map((previous.cases||[]).filter(x=>dayKey(Date.parse(x.publishedAt))>=cutoff).map(x=>[x.url,x]));
  try{
    const $=load(await read('https://thedieline.com/feed/',false),{xmlMode:true});
    $('item').each((_,e)=>{
      const row=$(e),publishedAt=row.find('pubDate').text(),url=row.find('link').text();
      if(!Number.isFinite(Date.parse(publishedAt))||dayKey(Date.parse(publishedAt))<cutoff||!url.startsWith('https://thedieline.com/'))return;
      const title=row.find('title').text();
      cases.set(url,{title,originalTitle:title,url,publishedAt,sourceName:'DIELINE',excerpt:load(row.find('description').text()).text().trim().slice(0,220)});
    });
  }catch(e){console.warn('DIELINE:',e.message);}
  return {archives:[...archives],rows:[...rows.values()],cases:[...cases.values()]};
}
