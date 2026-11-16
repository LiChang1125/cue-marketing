// Derived from OpenCLI (Apache-2.0); see LICENSE.opencli.
/**
 * Douyin search — keyword video search on www.douyin.com.
 *
 * Strategy: DOM extraction from the server-rendered search results page.
 *
 * Why not XHR interception:
 *   The `www.douyin.com/search/<q>?type=video` page renders results into
 *   `<ul data-e2e="scroll-list">` server-side during initial navigation
 *   and (for the OpenCLI-bridged browser context) does NOT fire a
 *   subsequent `/aweme/v1/web/general/search/single/` XHR — we confirmed
 *   this by `wait xhr "general/search/single"` timing out at 20s on a
 *   logged-in profile that has visible result cards in the DOM. Direct
 *   synthesis of the XHR from page context returns
 *   `status_code: 0, data: [], search_nil_info: { search_nil_type:
 *   "verify_check" }` because the bare URL lacks the SPA-computed
 *   `a_bogus` / `msToken` signature.
 *
 *   DOM extraction sidesteps both blockers: the data is already in the
 *   rendered HTML at the moment of navigation, signature-free.
 *
 * Selector approach:
 *   Douyin obfuscates card classnames (e.g. `.ckopQfVu`, `.cIiU4Muu`)
 *   and they churn between builds. We pin only the stable hooks:
 *     - container:   `[data-e2e="scroll-list"]`
 *     - row:         `li` inside the container
 *     - url:         `a[href*="/video/"]`
 *     - other fields are extracted from the row's leaf text nodes by
 *       SHAPE (digit+万/亿 → likes; HH:MM or MM:SS → duration; text after
 *       `@` → author nickname; longest remaining → desc).
 *
 * Output fields mirror `tiktok search` (rank, desc, author, url, plays,
 * likes, comments, shares) so downstream tools that already normalize
 * tiktok rows can consume douyin rows without per-adapter glue. The
 * search results page only surfaces the like count — plays/comments/
 * shares are not in the card markup and we expose them as 0 rather
 * than fabricate values; clients that need them should fetch
 * /aweme/v1/web/aweme/detail/?aweme_id=... for the relevant id.
 *
 * Prerequisite: the bound Chrome profile must be logged in to
 * https://www.douyin.com. The search results page renders an empty
 * skeleton for anonymous visitors, which we surface as AuthRequiredError.
 */
import { cli, Strategy } from '@jackwener/opencli/registry';
import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

export const MAX_SEARCH_LIMIT = 30;
// Time budget for the SPA's initial DOM commit. Empirically the
// scroll-list `<li>` rows appear within 2-4s of navigation when logged
// in; 15s covers slow networks without blocking on a permanently-empty
// page (anonymous gate, network error).
// Keep below OpenCLI's 30-second CDP command deadline so an empty/blocked
// page returns a useful state instead of a generic transport timeout.
export const RENDER_TIMEOUT_MS = 20000;

export function detectDouyinGate(title, text) {
    if (/验证码中间页|安全验证|安全校验/.test(title || '') ||
        /点击两个形状相同的物体|请完成下方验证|拖动滑块完成拼图|verify_check/.test(text || '')) return 'verification_required';
    if (/登录后查看|请先登录|登录后查看更多/.test(text || '')) return 'login_wall';
    return null;
}

export function parseSearchLimit(raw) {
    const parsed = Number(raw ?? 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new ArgumentError(`--limit must be an integer between 1 and ${MAX_SEARCH_LIMIT}, got ${JSON.stringify(raw)}`);
    }
    if (parsed < 1 || parsed > MAX_SEARCH_LIMIT) {
        throw new ArgumentError(`--limit must be between 1 and ${MAX_SEARCH_LIMIT}, got ${parsed}`);
    }
    return parsed;
}

/**
 * Parse a Douyin display count like "1.9万", "3.1万", "4702", "1.2亿"
 * into a plain integer. Returns 0 for unparseable input rather than
 * throwing — the CLI promises numeric columns and missing data is
 * common enough on real result rows that a soft fallback is the right
 * choice.
 */
export function parseDouyinCount(text) {
    if (typeof text !== 'string') return 0;
    const m = text.replace(/\s/g, '').match(/^(\d+(?:\.\d+)?)([万亿])?$/);
    if (!m) {
        const plain = Number(text.replace(/[,\s]/g, ''));
        return Number.isFinite(plain) ? Math.round(plain) : 0;
    }
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return 0;
    if (m[2] === '万') return Math.round(n * 10_000);
    if (m[2] === '亿') return Math.round(n * 100_000_000);
    return Math.round(n);
}

export function extractDouyinVideoId(href) {
    if (typeof href !== 'string' || !href) return '';
    let full = href;
    if (full.startsWith('//')) full = 'https:' + full;
    else if (full.startsWith('/')) full = 'https://www.douyin.com' + full;
    try {
        const parsed = new URL(full);
        if (!/(^|\.)douyin\.com$/.test(parsed.hostname)) return '';
        const match = parsed.pathname.match(/^\/video\/(\d+)$/);
        return match?.[1] ?? '';
    }
    catch {
        return '';
    }
}

/**
 * Resolve scheme-relative or absolute Douyin video links to the canonical
 * https://www.douyin.com/video/<id> shape. Returns '' for unparseable
 * input rather than throwing — callers expect a string column.
 */
export function normalizeDouyinVideoUrl(href) {
    const id = extractDouyinVideoId(href);
    return id ? `https://www.douyin.com/video/${id}` : '';
}

function isSearchCardMetadataText(text) {
    if (!text) return true;
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) return true;
    if (/^\d+(?:\.\d+)?[万亿]?$/.test(text)) return true;
    if (/^(合集|视频|作者)$/.test(text)) return true;
    if (/^(刚刚|今天|昨天|前天)$/.test(text)) return true;
    if (/^\d+\s*(秒|分钟|小时|天|周|个月|月|年)前$/.test(text)) return true;
    if (/^\d{4}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?$/.test(text)) return true;
    return false;
}

/**
 * Project a single rendered card into the canonical row shape. Operates
 * on a serialized card payload (the raw `{href, leafTexts}` we collect
 * via page.evaluate) so this function is unit-testable without a real
 * browser.
 *
 * `leafTexts` is the ordered list of `textContent.trim()` for every leaf
 * element inside the card (no children). The fields we want are
 * identified by shape:
 *   - duration: matches `HH:MM:SS` or `MM:SS`
 *   - likes:    matches `<digits>(.<digits>)?(万|亿)?` and ISN'T the duration
 *   - author:   the text node immediately following an `@` text node
 *   - desc:     the longest remaining leaf text
 */
export function projectCard(card, index) {
    const url = normalizeDouyinVideoUrl(card?.url ?? card?.href);
    const texts = Array.isArray(card?.leafTexts) ? card.leafTexts.map((t) => String(t ?? '').trim()).filter(Boolean) : [];

    const DURATION_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
    const COUNT_RE = /^\d+(?:\.\d+)?[万亿]?$/;

    let likes = null;
    let author = '';
    let longest = '';

    for (let i = 0; i < texts.length; i++) {
        const t = texts[i];
        if (DURATION_RE.test(t)) continue;
        if (!likes && COUNT_RE.test(t)) {
            likes = parseDouyinCount(t);
            continue;
        }
        if (t === '@' && !author) {
            author = (texts[i + 1] ?? '').trim();
            continue;
        }
        if (t === author) continue;
        if (isSearchCardMetadataText(t)) continue;
        if (t.length > longest.length) longest = t;
    }
    let desc = longest;
    // Strip a leading "@author" that some renders fuse into the desc text node.
    if (author && desc.startsWith('@' + author)) {
        desc = desc.slice(author.length + 1).trim();
    }
    return {
        rank: index + 1,
        desc,
        contentType:'video',
        image:card.image||null,
        time:texts.find(t=>/^(刚刚|今天|昨天|前天|\d+\s*(秒|分钟|小时|天|周|个月|月|年)前|\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)$/.test(t))||'',
        author:author||texts.find(t=>t.startsWith('@'))?.slice(1)||'',
        url,
        plays: null,
        likes,
        comments: null,
        shares: null,
    };
}

function isProjectedRowUsable(row) {
    return Boolean(row?.url && row?.desc);
}

export function projectSearchCards(cards, limit) {
    const window = Array.isArray(cards) ? cards.slice(0, limit) : [];
    const rows = window.map((card, index) => projectCard(card, index));
    const invalidCount = rows.filter((row) => !isProjectedRowUsable(row)).length;
    return { rows: rows.filter(isProjectedRowUsable), invalidCount };
}

// JS snippet that waits for the scroll-list to populate, then returns
// `{state: 'rendered', cards}` or `{state: 'login_wall'}` /
// `{state: 'timeout'}`. Runs inside page.evaluate so we don't pay a
// round-trip per poll iteration.
const WAIT_AND_EXTRACT_JS = (timeoutMs) => `
  new Promise((resolve) => {
    const collectCards = () => {
      const cards = [];
      const lis = document.querySelectorAll('[data-e2e="scroll-list"] li');
      for (const li of lis) {
        const a = li.querySelector('a[href*="/video/"]');
        if (!a) continue;
        const leafTexts = [];
        for (const el of li.querySelectorAll('*')) {
          if (el.children.length > 0) continue;
          const t = (el.textContent || '').trim();
          if (t) leafTexts.push(t);
        }
        const img=Array.from(li.querySelectorAll('img')).find(img=>img.naturalWidth>100||img.getBoundingClientRect().width>100);
        cards.push({href:a.getAttribute('href')||'',leafTexts,image:img?.currentSrc||img?.src||null});
      }
      return cards;
    };
    const detectState = () => {
      const text = (document.body && document.body.innerText) || '';
      const gate = (${detectDouyinGate.toString()})(document.title, text);
      if (gate === 'verification_required') return { state: gate };
      const cards = collectCards();
      if (cards.length > 0) return { state: 'rendered', cards };
      // Anonymous gate: Douyin renders a centered "登录后查看更多内容"
      // overlay on /search/ for visitors without sessionid. Match either
      // the literal Chinese prompt or a visible login modal/mask.
      if (gate === 'login_wall') return { state: gate };
      if (/暂无相关搜索结果|没有找到相关结果|搜索结果为空|暂无结果/.test(text)) return { state: 'empty' };
      const modal = document.querySelector('[class*="login-mask"], [class*="LoginMask"], [class*="login-modal"], dialog[role="dialog"]');
      if (modal && modal instanceof HTMLElement) {
        const r = modal.getBoundingClientRect();
        const s = getComputedStyle(modal);
        if (r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden') {
          return { state: 'login_wall' };
        }
      }
      return null;
    };
    const found = detectState();
    if (found) return resolve(found);
    const observer = new MutationObserver(() => {
      const s = detectState();
      if (s) { observer.disconnect(); resolve(s); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      const fallback = detectState();
      resolve(fallback ?? { state: 'timeout' });
    }, ${timeoutMs});
  })
`;

function unwrapEvaluateResult(payload) {
    if (payload && !Array.isArray(payload) && typeof payload === 'object' && 'session' in payload && 'data' in payload) {
        return payload.data;
    }
    return payload;
}

export async function waitForDouyinCards(page) {
    let result = unwrapEvaluateResult(await page.evaluate(WAIT_AND_EXTRACT_JS(RENDER_TIMEOUT_MS)));
    // Allow one additional render window on a slow connection without another
    // navigation/request. An explicit platform gate stops immediately.
    if (result?.state === 'timeout') {
        result = unwrapEvaluateResult(await page.evaluate(WAIT_AND_EXTRACT_JS(RENDER_TIMEOUT_MS)));
    }
    return result;
}

cli({
    site: 'zhichao',
    name: 'douyin-search',
    access: 'read',
    description: '关键词搜索抖音视频',
    domain: 'www.douyin.com',
    strategy: Strategy.COOKIE,
    args: [
        { name: 'query', required: true, positional: true, help: '搜索关键词' },
        { name: 'limit', type: 'int', default: 10, help: `结果数量 (1-${MAX_SEARCH_LIMIT})` },
    ],
    columns: ['rank','desc','author','url','plays','likes','comments','shares','image','time','contentType'],
    func: async (page, kwargs) => {
        const limit = parseSearchLimit(kwargs.limit);
        const keyword = String(kwargs.query ?? '').trim();
        if (!keyword) {
            throw new ArgumentError('douyin search 需要 <query> 关键词');
        }
        await page.goto(`https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=video`);
        let result;
        try {
            result = await waitForDouyinCards(page);
        } catch (error) {
            throw new CommandExecutionError(`Douyin search extraction failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!result || typeof result !== 'object') {
            throw new CommandExecutionError('Douyin search: unexpected evaluator payload shape');
        }
        if (result.state === 'verification_required') {
            throw new CommandExecutionError('Douyin verification_required: complete the platform verification in the administrator browser.');
        }
        if (result.state === 'login_wall') {
            throw new AuthRequiredError(
                'www.douyin.com',
                'Douyin search results are blocked behind a login wall — log in at https://www.douyin.com in Chrome first.',
            );
        }
        if (result.state === 'empty') {
            throw new EmptyResultError('douyin search', `No Douyin videos matched "${keyword}".`);
        }
        if (result.state === 'timeout') {
            throw new CommandExecutionError('Douyin search timed out before result cards appeared. The administrator should inspect the collector page; this does not establish an authentication failure.');
        }
        if (!Array.isArray(result.cards)) {
            throw new CommandExecutionError('Douyin search: evaluator returned malformed cards payload');
        }
        if (result.cards.length === 0) {
            throw new EmptyResultError('douyin search', `No Douyin videos matched "${keyword}".`);
        }
        const projected = projectSearchCards(result.cards, limit);
        if (projected.invalidCount > 0) {
            throw new CommandExecutionError('Douyin search parser found result cards without stable video url or description');
        }
        if (projected.rows.length === 0) {
            throw new EmptyResultError('douyin search', `No Douyin videos matched "${keyword}".`);
        }
        return projected.rows;
    },
});
