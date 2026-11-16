import {scopedItems} from './relevance.js';
import {isMarketingCase,recentPublication,uniqueCases,directionIds,sectorId} from '../shared/insights.js';

const trusted=new Set(['socialbeta','brandstar']);
const event=/联名|跨界|新品|新系列|发售|发布|推出|限定|快闪|开业|门店|创意|短片|广告|展览|品牌大使|代言|授权|潮玩|香氛|香水/;
const lowQuality=/转发微博|抽奖|转发抽|评论抽|粉丝福利|超话|打榜|应援|签到|求购|代购|私信|现货|优惠券|拼单|无广|测评|上身实拍|偶遇|自拍|直播间|福利价|好物分享|安利|求推荐|该买|值得买|多少钱|盘点|一次看完|避雷|从夯到拉|喜欢这款吗|你觉得|这么幸运|超可爱/;
export function isEditorialStory(item){
  if(!isMarketingCase(item))return false;
  if(lowQuality.test(item.title)||item.title.length<8||item.title.length>115)return false;
  if(trusted.has(item.source))return true;
  return event.test(item.title)&&item.title.length<=90&&(['weibo','bilibili','bilibili-cli','xiaohongshu'].includes(item.source)||item.source==='douyin'&&item.contentType==='video');
}
export function editorialCandidate(item,now=Date.now()){
  if(item.historical)return false;
  const recent=recentPublication(item,now,30)||!item.publishedAt&&['xiaohongshu','douyin'].includes(item.source)&&Date.parse(item.fetchedAt)<=now&&Date.parse(item.fetchedAt)>=now-86400000;
  return recent&&!!item.imageLocal&&isEditorialStory(item);
}
export function editorialCandidates(rawItems,now=Date.now()){return uniqueCases(scopedItems(rawItems).filter(i=>editorialCandidate(i,now)));}
export function editorialFeed(rawItems,now=Date.now()){
  const items=editorialCandidates(rawItems,now).map(item=>({...item,editorialScore:(trusted.has(item.source)?8:0)+Math.max(0,4-(now-Date.parse(item.publishedAt||item.fetchedAt))/86400000)+Math.min(2,directionIds(item).length)*.5+(item.excerpt?.length>=35?1:0)})).sort((a,b)=>b.editorialScore-a.editorialScore||Date.parse(b.publishedAt||b.fetchedAt)-Date.parse(a.publishedAt||a.fetchedAt));
  const selected=[],counts=new Map();
  while(items.length&&selected.length<60){
    // Reserve an early position for each available social source without
    // admitting low-quality or dateless old material just to fill a quota.
    if(selected.length===3||selected.length===6){const platform=selected.length===3?'xiaohongshu':'douyin';const at=items.findIndex(i=>i.source===platform);if(at>=0){const [item]=items.splice(at,1);selected.push(item);counts.set(platform,(counts.get(platform)||0)+1);continue;}}
    // Newsroom material leads; the first screen includes at most two Weibo posts.
    const index=items.findIndex(i=>(i.source!=='weibo'||(counts.get('weibo')||0)<2)&&!(selected.length<3&&i.source==='weibo')&&(selected.length<2||i.source!==selected.at(-1).source||i.source!==selected.at(-2).source));
    const fallback=items.findIndex(i=>i.source!=='weibo'||(counts.get('weibo')||0)<2);
    const chosen=index>=0?index:fallback;if(chosen<0)break;
    const [item]=items.splice(chosen,1);selected.push(item);counts.set(item.source,(counts.get(item.source)||0)+1);
  }
  return selected.map(({editorialScore,...item})=>({...item,editorialSector:sectorId(item)}));
}
