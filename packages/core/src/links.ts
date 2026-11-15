import type { LoadedConfig } from './config.js';
import type { Page } from './content.js';
import { NOT_FOUND_SLUG } from './context.js';
import { categoryUrl, normalizeBasePath } from './routes.js';

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

function hrefToKey(href: string, config: LoadedConfig): string {
  const withoutHash = href.split('#')[0] ?? href;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  return normUrl(withoutQuery, config);
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
      if (!link.href.startsWith('/')) continue;
      const key = hrefToKey(link.href, config);
      if (!known.has(key)) {
        redLinks.push({ from: page.url, href: link.href });
        continue;
      }
      inbound.set(key, (inbound.get(key) ?? 0) + 1);
    }
  }

  // 索引页（/docs、/zh/docs）由构建器生成，天然会链向所有页面，不计入孤页判定
  const indexKeys = new Set(
    Object.keys(config.content).map((lang) => hrefToKey(`/${lang === config.defaultLanguage ? '' : lang + '/'}docs`.replace('//', '/'), config)),
  );

  // 入口页：每种语言排序第一的那页。它靠导航到达，没人用正文链接指向它是正常的。
  for (const key of entryPageKeys(config, published)) indexKeys.add(key);

  const orphans = published
    .filter((p) => {
      const key = normUrl(p.url, config);
      if (indexKeys.has(key)) return false;
      return (inbound.get(key) ?? 0) === 0;
    })
    .map((p) => `${p.lang}/${p.slug}`)
    .sort();

  const inboundCount: Record<string, number> = {};
  for (const [key, count] of inbound) inboundCount[key] = count;

  return { redLinks, orphans, inboundCount };
}

/** 每种语言按「section 顺序 → order → slug」排序后的第一页 */
function entryPageKeys(config: LoadedConfig, pages: Page[]): string[] {
  const keys: string[] = [];
  for (const lang of Object.keys(config.content)) {
    const list = pages
      .filter((p) => p.lang === lang)
      .sort((a, b) => {
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
    const first = list[0];
    if (first) keys.push(normUrl(first.url, config));
  }
  return keys;
}
