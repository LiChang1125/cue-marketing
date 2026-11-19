import {load} from 'cheerio';
import {topicKey} from '../shared/community.js';

const aliases = new Map(Object.entries({
  '耐克':'nike','阿迪达斯':'adidas','乐高':'lego','亚瑟士':'asics','亚历山大王':'alexander-wang',
  '拉夫劳伦':'ralph-lauren','丝芙兰':'sephora','优衣库':'uniqlo','迪士尼':'disney','苹果':'apple'
}));
export function brandSlug(query) {
  const key = topicKey(query);
  const name = aliases.get(key) || key;
  return /^[a-z0-9][a-z0-9 -]{0,48}$/i.test(name) ? name.replace(/[ -]+/g,'-') : null;
}
function count(value) {
  return /^\d+(?:,\d{3})*$/.test(value) ? Number(value.replaceAll(',','')) : null;
}
function postTitle(brand, author, caption) {
  const product = caption.match(/\b[A-Z]{2,}(?:-[A-Z][A-Z0-9]+)+\b/)?.[0] || brand;
  if (/\bcollab(?:oration)?\b|联名/i.test(caption)) return author+' 分享了 '+product+' 的联名合作';
  if (/\bcolorways?\b/i.test(caption)) return author+' 展示了 '+product+' 的产品配色';
  if (/\bcollections?\b/i.test(caption) && /#\w*collection|collectors?|vintage/i.test(caption)) return author+' 展示了 '+product+' 的收藏';
  return brand+' · '+author+' 的品牌帖';
}
export function parseMentions(html, slug, now = Date.now()) {
  const $ = load(html);
  const brand = $('h1').first().text().split(/\s+Instagram\b/i)[0].trim();
  if (!brand || brandSlug(brand) !== slug || !/instagram/i.test($('h1').first().text())) throw Error('Unexpected brand page');
  const source = 'https://www.monitormentions.com/brand/' + slug + '/instagram';
  const posts = new Map();
  $('tr').each((_, row) => {
    const tr = $(row), link = tr.find('a.ml-post').first();
    const url = link.attr('href') || '';
    const field = label => tr.find('[data-label="' + label + '"]').text().trim();
    const author = field('Author'), day = field('Date');
    if (!/^https:\/\/www\.instagram\.com\/(?:p|reel)\/[\w-]+\/?$/.test(url) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(day) || !(Date.parse(day) <= now)) return;
    const originalTitle=link.find('.ml-caption').text().trim();
    posts.set(url, {platform:'Instagram', kind:'brand-post', entity:brand,
      title:postTitle(brand,author,originalTitle), originalTitle,
      url, day, author, likes:count(field('Likes')), likesLabel:field('Likes'), replies:count(field('Comments')), source});
  });
  if (!posts.size && !$('body').text().match(/no (?:recent )?mentions/i)) throw Error('No readable mention table');
  return [...posts.values()];
}
export async function instagramPosts(query, now = Date.now()) {
  const slug = brandSlug(query);
  if (!slug) return [];
  const r = await fetch('https://www.monitormentions.com/brand/' + slug + '/instagram', {signal:AbortSignal.timeout(9000)});
  if (r.status === 404) return [];
  if (!r.ok) throw Error('Monitor Mentions HTTP ' + r.status);
  return parseMentions(await r.text(), slug, now);
}
export function comparePosts(fresh, prior) {
  const previous = new Map((prior?.items || []).map(post => [post.url, post]));
  return fresh.map(post => {
    const old = previous.get(post.url);
    if (!old || ![post.likes, old.likes, post.replies, old.replies].every(Number.isFinite)) return post;
    return {...post, likeChange:post.likes-old.likes, replyChange:post.replies-old.replies, since:prior.checkedAt};
  });
}
export async function refreshInstagram(previous = {}, topics, now = Date.now()) {
  const out = Object.create(null);
  for (const slug of [...new Set(topics.map(brandSlug).filter(Boolean))].slice(0,10)) {
    const old = Object.hasOwn(previous,slug) ? previous[slug] : undefined;
    if (old && Date.parse(old.checkedAt) > now-86400000) { out[slug]=old; continue; }
    try {
      const posts = await instagramPosts(slug, now);
      out[slug] = {checkedAt:new Date(now).toISOString(),items:comparePosts(posts,old)};
    } catch {
      if (old && Date.parse(old.checkedAt) > now-7*86400000) out[slug]=old;
    }
  }
  return out;
}
