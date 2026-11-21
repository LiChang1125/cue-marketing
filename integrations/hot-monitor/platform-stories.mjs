import {createHash} from 'node:crypto';
import {platformNames} from '../../shared/platform-hot.js';
import {clusterStories} from './brand-stories.mjs';

const platformRef = {douyin: /抖音|巨量创意|巨量算数|巨量引擎|\bDouyin\b/i, xiaohongshu: /小红书|小紅書|小红书灵犀|\b(?:Xiaohongshu|RedNote)\b/i};
const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

export function platformEvidence(row, id, signals = []) {
  const host = new URL(row.url).hostname.toLowerCase();
  if (id === 'douyin' ? /(^|\.)(douyin|oceanengine)\.com$/.test(host) : /(^|\.)xiaohongshu\.com$/.test(host)) return true;
  const headline = [row.title,row.originalTitle].filter(Boolean).join(' ');
  if (platformRef[id].test(headline)) return true;
  const sentences = String(row.content || row.excerpt || '').slice(0,500).split(/[。！？!?；;\n]/);
  if (sentences.some(s => platformRef[id].test(s) && /联名|发售|代言|投放|营销|推广|直播|种草|首发|挑战赛|品牌活动|campaign|collab|launch|sponsor/i.test(s) && !/扫一扫|分享至|关注我们|转发至|扫码关注/i.test(s))) return true;
  const key = normalize(headline);
  return signals.some(s => {const term = normalize(s.title); return term.length >= 4 && key.includes(term);});
}

export async function platformStoryBoards(rows, charts, now, eventCards, localize) {
  const boards = {};
  for (const [id, name] of Object.entries(platformNames)) {
    const chart = charts[id] || null;
    const related = rows.filter(r => {
      try {return platformEvidence(r,id,chart?.rows);} catch {return false;}
    });
    const extraPatterns = [
      ['消费品牌的达人共创', /达人|博主|创作者|KOL/i, /共创|合作|联动|种草|推广|代言/],
      ['直播间里的品牌上新', /直播|自播/, /新品|首发|上新|限定|首秀/],
      ['品牌的内容种草', /种草|笔记|短视频/, /营销|推广|投放|共创|品牌活动/],
      ['品牌大促与平台营销', /双11|双十一|大促|购物节|年货节/, /消费品牌|户外品牌|美妆|商家|种草|营销|品牌专场|首发|投放/],
      ['美妆品牌的内容投放', /美妆|护肤|彩妆|化妆品/, /信息流|投放|达人|种草|自播/]
    ];
    const stories = clusterStories(eventCards(related,now),now,{trendsOnly:true,extraPatterns}).slice(0,10);
    for (const s of stories) {
      s.storyId = createHash('sha256').update(id + ':' + s.storyId).digest('hex').slice(0,20);
      s.platform = id;
    }
    const results = (await localize(stories)).filter(s => s.title && s.title !== '中文标题暂不可用');
    boards[id] = {platform: id,name,chart,results,reportingOutlets: new Set(results.flatMap(s => s.reports.map(r => r.identity))).size};
  }
  return boards;
}
