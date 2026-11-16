import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { curatedKind } from '../shared/curated.js';

export const sourceDefinitions = [
  { id: 'bilibili', name: 'B站综合热门', url: 'https://www.bilibili.com/v/popular/all', description: '公开热门视频及原始播放、点赞数据。' },
  { id: 'socialbeta', name: 'SocialBeta 品牌快讯', url: 'https://socialbeta.com/campaign', description: '品牌营销案例与快讯。' },
  { id: 'brandstar', name: '品牌星球', url: 'https://radar.brandstar.com.cn/', description: '品牌、消费与营销资讯。' }
];

const ipWords = ['原神', '崩坏', '星穹铁道', '绝区零', '宝可梦', '精灵宝可梦', '三丽鸥', '蜡笔小新', '迪士尼', '哈利波特', '哪吒', '名侦探柯南', '海贼王', '火影', '高达', '初音', 'chiikawa', 'labubu', 'molly', '英雄联盟', '王者荣耀', '第五人格', '吉伊卡哇', '罗小黑', '喜羊羊', '蛋仔', '恋与深空', '鸣潮', '明日方舟'];
export function classify({ title, tags = [], source }) {
  const text = `${title} ${tags.join(' ')}`;
  const topics = ipWords.filter(w => text.toLowerCase().includes(w.toLowerCase()));
  const categories = new Set(['socialbeta','brandstar'].includes(source) ? ['brand'] : ['content']);
  if (topics.length || /IP联名|IP合作|动漫IP|热门IP/i.test(text)) categories.add('ip');
  if (/跨界联名|品牌联名|新品发布|新品营销|品牌营销/.test(text)) categories.add('brand');
  if (source === 'bilibili-animation' || /二次元|同人|手书|谷子|痛包|cosplay|亚文化|虚拟偶像|鬼畜|宅舞|国风|说唱|潮玩|解构|玩梗/i.test(text)) categories.add('culture');
  return { categories: [...categories], topics };
}

export function parseBilibili(payload, source, now) {
  if (payload.code !== 0 || !Array.isArray(payload.data?.list)) throw new Error(`来源未返回有效榜单（${payload.code??'格式变化'}）`);
  return payload.data.list.slice(0, source === 'bilibili' ? 50 : 30).filter(v => v.bvid && v.title).map((v, i) => {
    const tags = [v.tname || '视频'];
    return { id: `bili-${v.bvid}`, title: v.title, url: `https://www.bilibili.com/video/${v.bvid}`, image: safeImage(v.pic), source,
      creator: v.owner?.name || '创作者', creatorId: String(v.owner?.mid || ''), tags,
      publishedAt: v.pubdate ? new Date(v.pubdate * 1000).toISOString() : null, publishedLabel: null, fetchedAt: now,
      rank: i + 1, metrics: { views: v.stat?.view ?? null, likes: v.stat?.like ?? null },
      ...classify({ title: v.title, tags, source }) };
  });
}

export function safeImage(value) {
  if (!value) return null;
  try { const url = new URL(value.replace(/^http:/, 'https:')); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}

export function parseDate(label, now, heading = '') {
  const shanghaiDay=new Date(now).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
  if(/刚刚/.test(label))return new Date(now).toISOString();
  const relativeDay=label.match(/(今天|昨天|前天)\s*(\d{1,2}):(\d{2})/);
  if(relativeDay){const day=new Date(Date.parse(shanghaiDay+'T00:00:00+08:00')-({'今天':0,'昨天':1,'前天':2}[relativeDay[1]])*86400000+Number(relativeDay[2])*3600000+Number(relativeDay[3])*60000);return day.toISOString();}
  const monthDay=label.match(/(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?/);
  if(monthDay){let year=Number(monthDay[1]||shanghaiDay.slice(0,4));const value=()=>new Date(`${year}-${monthDay[2].padStart(2,'0')}-${monthDay[3].padStart(2,'0')}T${(monthDay[4]||'00').padStart(2,'0')}:${monthDay[5]||'00'}:00+08:00`);if(!monthDay[1]&&+value()>Date.parse(now)+86400000)year--;return value().toISOString();}
  const n = label.match(/(\d+)\s*(分钟|小时|天)前/);
  if (n) return new Date(new Date(now).getTime() - Number(n[1]) * ({ '分钟': 60000, '小时': 3600000, '天': 86400000 }[n[2]])).toISOString();
  const full = label.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (full) return new Date(`${full[1]}-${full[2].padStart(2,'0')}-${full[3].padStart(2,'0')}T00:00:00+08:00`).toISOString();
  const day = heading.match(/(\d{1,2})月(\d{1,2})日/);
  if (day) {
    let year = Number(new Date(now).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}).slice(0,4));
    let date = new Date(`${year}-${day[1].padStart(2,'0')}-${day[2].padStart(2,'0')}T00:00:00+08:00`);
    if (date.getTime() > new Date(now).getTime() + 86400000) date.setUTCFullYear(year - 1);
    return date.toISOString();
  }
  return null;
}

export function parseSocialBeta(html, now) {
  const $ = load(html), records = new Map();
  $('.list li').each((_, el) => {
    const row = $(el), a = row.find('.tit a').first(), href = a.attr('href'), title = a.text().trim();
    if (!title || !/^https:\/\/socialbeta\.com\/(campaign|article)\/\d+$/.test(href || '')) return;
    const tags = row.find('.tag a').map((_, t) => $(t).text().trim()).get().filter(Boolean);
    const heading = row.closest('.list').prevAll('.hdtitle').first().text().trim();
    const label = row.find('.date').text().trim();
    const id = `sb-${href.split('/').slice(-2).join('-')}`;
    records.set(id, { id, title, url: href, source: 'socialbeta', creator: tags[0] || '品牌动态',
      image: safeImage(row.find('.pic img').attr('src')), tags,
      publishedAt: parseDate(label, now, heading), publishedLabel: label || heading || '原站未标注时间',
      fetchedAt: now, rank: null, metrics: {}, ...classify({ title, tags, source: 'socialbeta' }) });
  });
  if (!records.size) throw new Error('页面结构变化，暂未识别到快讯');
  return [...records.values()].slice(0, 60);
}

async function download(url, json = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: json ? 'application/json' : 'text/html' } });
  if (!response.ok) throw new Error(`来源暂不可用（HTTP ${response.status}）`);
  return json ? response.json() : response.text();
}

export function parseBrandstar(html,now){
  const $=load(html),items=[];
  $('.bs-curated-day').each((_,el)=>{
    const section=$(el),label=section.find('.bs-curated-day-head').first().text().replace(/\s/g,'');
    const match=label.match(/^(\d{1,2})(20\d{2})\.(\d{1,2})/);if(!match)return;
    const publishedAt=new Date(`${match[2]}-${match[3].padStart(2,'0')}-${match[1].padStart(2,'0')}T00:00:00+08:00`).toISOString();
    section.find('li').each((_,row)=>{
      const card=$(row),a=card.find('h2 a').first(),url=a.attr('href'),title=a.text().trim();
      if(!title||!/^https:\/\/www\.brandstar\.com\.cn\/(?:select\/\d+|articles\/[\w-]+)\/$/.test(url||''))return;
      const publisher=card.find('.bs-curated-card-meta strong').text().trim(),category=card.find('.bs-curated-card-meta>span').last().text().trim();
      const tags=category?[category]:[],excerpt=card.find('.bs-curated-card-summary').text().replace(/\s+/g,' ').trim();
      const numeric=url.match(/\/select\/(\d+)\/$/),key=numeric?numeric[1]:createHash('sha256').update(url).digest('hex').slice(0,16);
      items.push({id:'bs-'+key,title,url,source:'brandstar',publisher:publisher||'品牌星球',curatedKind:curatedKind(category),brandstarOriginal:publisher==='品牌星球'&&!card.find('.bs-curated-origin').hasClass('is-external'),editorialReason:card.find('.bs-curated-card-reason').text().trim(),creator:publisher?`品牌星球 / ${publisher}`:'品牌星球',image:safeImage(card.find('img').attr('src')),publishedAt,publishedPrecision:'day',publishedLabel:publishedAt.slice(0,10),fetchedAt:now,metrics:{},tags,excerpt:excerpt.slice(0,220),...classify({title,tags,source:'brandstar'})});
    });
  });
  if(!items.length)throw new Error('品牌资讯页面结构变化，未识别到内容');
  return items;
}

export async function collectSource(id, now) {
  if (id === 'socialbeta') return parseSocialBeta(await download('https://socialbeta.com/campaign'), now);
  if(id==='brandstar'){
    const records=new Map();
    for(let page=1;page<=6;page++)for(const item of parseBrandstar(await download(`https://radar.brandstar.com.cn/?pno=${page}`),now))records.set(item.id,item);
    // Category pages add specialist editorial paths beyond the mixed front page.
    for(const kind of ['trends','insights','brandstar']){try{for(const item of parseBrandstar(await download(`https://radar.brandstar.com.cn/?kind=${kind}`),now))records.set(item.id,item);}catch{/* A category delay does not discard successfully read pages. */}}
    return [...records.values()];
  }
  const url = id === 'bilibili' ? 'https://api.bilibili.com/x/web-interface/popular?ps=50&pn=1' : 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=1&type=all';
  return parseBilibili(await download(url, true), id, now);
}

export async function collectFollowers(mid) {
  if (!/^\d+$/.test(mid)) return null;
  const result = await download(`https://api.bilibili.com/x/relation/stat?vmid=${mid}`, true);
  if (result.code !== 0 || !Number.isFinite(result.data?.follower)) throw new Error('粉丝数暂不可用');
  return result.data.follower;
}
