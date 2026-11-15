import type { LoadedConfig } from './config.js';
import type { Page } from './content.js';
import { normalizeBasePath } from './routes.js';

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
  const published = pages.filter((p) => !p.draft);
  const known = new Set(published.map((p) => normUrl(p.url, config)));
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
