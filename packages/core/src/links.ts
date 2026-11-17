import type { LoadedConfig } from './config.js';
import type { Page } from './content.js';
import { NOT_FOUND_SLUG } from './context.js';
import { categoryUrl, INDEX_SLUG, normalizeBasePath } from './routes.js';

export interface RedLink {
  from: string;
  href: string;
}

export interface LinkReport {
  /** 指向不存在页面的站内链接 */
  redLinks: RedLink[];
  /** 没有任何页面链向它的页面（入口页除外） */
  orphans: string[];
  inboundCount: Record<string, number>;
}

/**
 * URL 归一化：去掉 basePath 前缀、末尾斜杠与 .html，
 * 这样 `a/b/`、`a/b`、`a/b.html` 会落到同一个键上。
 */
export function normUrl(url: string, config: LoadedConfig): string {
  let next = url;
  const base = normalizeBasePath(config.basePath);
  if (base && next.startsWith(base)) next = next.slice(base.length);
  next = next.replace(/\.html$/, '').replace(/\/+$/, '');
  return next === '' ? '/' : next;
}

/**
 * 把一条站内链接归一化成「页面键」；不该拿去做存在性比对的返回 null。
 *
 * 三类不算页面：
 * - 站外地址（`//cdn…`，外链本来就不检查可达性）
 * - 资源：`/assets/…`、以及带扩展名的 `/style.css`、`/search-index.json`
 * - 分类页：它们由分类列表决定，不来自 `content/`
 *
 * **渲染层与 check 必须共用这一份判据。** 曾经两边各写一套，结果页面上的红链
 * 样式跳过了资源，而 `wiki check` 照样把 `/assets/agents.md` 报成红链。
 */
export function pageLinkKey(href: string, config: LoadedConfig): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) return null;

  let path = href.split('#')[0]?.split('?')[0] ?? '';
  const base = normalizeBasePath(config.basePath);
  if (base && path.startsWith(base)) path = path.slice(base.length) || '/';
  if (!path) return null;

  if (path === '/assets' || path.startsWith('/assets/')) return null;

  // 分类页：`/categories/x/` 或 `/<语言>/categories/x/`。
  // **只有已配置的语言代码才算那一段** —— 用「任意一段」会误伤 `/docs/categories/`
  // 这种内容页（`docs` 是内容前缀，不是语言）。
  const segs = path.split('/').filter(Boolean);
  const langAt = segs[0] !== undefined && config.content[segs[0]] !== undefined ? 1 : 0;
  if (segs[langAt] === 'categories') return null;

  // 带扩展名的当资源（`/style.css`、`/search-index.json`）
  if (/\.[a-z0-9]{1,5}$/i.test(path)) return null;

  return path.replace(/\/+$/, '') || '/';
}

/**
 * 链接图的三项副产品：红链、孤页、入链计数。
 *
 * - 红链只看站内链接。外部链接不做可达性检查（那是另一个成本量级的事情）。
 * - 草稿不参与孤页判定，也不作为红链目标 —— 它本来就还没公开。
 */
export function buildLinkReport(config: LoadedConfig, pages: Page[]): LinkReport {
  const published = pages.filter((p) => !p.draft && p.slug !== NOT_FOUND_SLUG);
  const known = new Set(published.map((p) => normUrl(p.url, config)));

  // 分类页是构建时生成的，也要算作已知目标，否则指向它们的链接会被误判为红链
  for (const page of published) {
    for (const category of page.categories) {
      known.add(normUrl(categoryUrl(config, page.lang, category), config));
    }
  }

  const inbound = new Map<string, number>();

  const redLinks: RedLink[] = [];
  for (const page of published) {
    for (const link of page.links) {
      if (link.external) continue;
      const key = pageLinkKey(link.href, config);
      if (key === null) continue;
      if (!known.has(key)) {
        redLinks.push({ from: page.url, href: link.href });
        continue;
      }
      inbound.set(key, (inbound.get(key) ?? 0) + 1);
    }
  }

  // 入口页：每种语言的首页（slug 为 index），它天然会链向全站，不计入孤页判定。
  // 没写首页时退回「排序第一的那页」—— 它靠导航到达，没人用正文链接指向它也正常。
  const entryKeys = new Set(entryPageKeys(config, published));

  const orphans = published
    .filter((p) => {
      const key = normUrl(p.url, config);
      if (entryKeys.has(key)) return false;
      return (inbound.get(key) ?? 0) === 0;
    })
    .map((p) => `${p.lang}/${p.slug}`)
    .sort();

  const inboundCount: Record<string, number> = {};
  for (const [key, count] of inbound) inboundCount[key] = count;

  return { redLinks, orphans, inboundCount };
}

/** 每种语言的入口页：优先首页（slug 为 index），否则按 section → order → slug 排序取第一页 */
function entryPageKeys(config: LoadedConfig, pages: Page[]): string[] {
  const keys: string[] = [];
  for (const lang of Object.keys(config.content)) {
    const list = pages.filter((p) => p.lang === lang);
    const home = list.find((p) => p.slug === INDEX_SLUG);
    if (home) {
      keys.push(normUrl(home.url, config));
      continue;
    }

    const sorted = [...list].sort((a, b) => {
        const sa = config.sections.indexOf(a.data.section ?? '');
        const sb = config.sections.indexOf(b.data.section ?? '');
        const na = sa === -1 ? Number.MAX_SAFE_INTEGER : sa;
        const nb = sb === -1 ? Number.MAX_SAFE_INTEGER : sb;
        if (na !== nb) return na - nb;
        const oa = a.data.order ?? Number.MAX_SAFE_INTEGER;
        const ob = b.data.order ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return a.slug.localeCompare(b.slug, 'zh');
      });
    const first = sorted[0];
    if (first) keys.push(normUrl(first.url, config));
  }
  return keys;
}
