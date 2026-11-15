import type { LoadedConfig } from './config.js';
import { normalizeBasePath } from './routes.js';

/**
 * 模板上下文（布局与宏共用）。
 *
 * 设计参照 MediaWiki 的「魔术字」，但不需要单独的语法：
 * 模板里直接写 `it.page.slug`、`it.site.pageCount`，
 * 因为 Eta 里的 `it` 就是一个普通对象，能跑任意表达式。
 *
 * 两条约定：
 * - `it.page` 描述**当前页**，但不包含 `html` / `headings` —— 宏执行时它们还没生成；
 * - `it.site` 是全站信息，宏与布局看到的是同一个对象。
 */

/** 页面摘要：用于 `it.site.pages`，只有定位信息，不含正文 */
export interface PageSummary {
  lang: string;
  slug: string;
  url: string;
  title: string;
  section: string;
  order: number | null;
  updated: string;
  categories: string[];
}

/**
 * 当前页信息。
 *
 * frontmatter 的字段会**平铺**到这一层（`it.page.title` 能直接拿到），
 * 同时保留 `frontmatter` 原对象。结构化字段（lang/slug/url…）优先，
 * 避免内容里恰好写了同名键时把位置信息覆盖掉。
 */
export interface PageInfo {
  lang: string;
  slug: string;
  url: string;
  outputPath: string;
  /** 相对内容目录的路径，比如 `zh/typographic-anatomy.md` 的 `typographic-anatomy.md` */
  relativePath: string;
  draft: boolean;
  title: string;
  description: string;
  keywords: string[];
  updated: string;
  section: string;
  order: number | null;
  /** 由宏登记的、目前已收集到的分类 */
  categories: string[];
  /** frontmatter 原样 */
  frontmatter: Record<string, unknown>;
}

export interface SiteInfo {
  title: string;
  siteUrl: string;
  base: string;
  defaultLanguage: string;
  languages: string[];
  urlStyle: string;
  sections: string[];
  /** 构建时间（ISO 8601）。注意它会让产物每次都不同 */
  generatedAt: string;
  /** 已发布页面数（不含草稿） */
  pageCount: number;
  pageCounts: Record<string, number>;
  /** 所有已发布页面的摘要，按语言 + section + order 排好 */
  pages: PageSummary[];
  /**
   * `wiki.config.ts` 的原始配置，只读。
   * 里面有绝对路径（root / themeDir），打印出来时注意别泄露本机路径。
   */
  config: LoadedConfig;
}

/** createSiteInfo 需要的最小页面形状：Page 与 PageSeed 都满足 */
export interface Summarizable {
  lang: string;
  slug: string;
  url: string;
  draft: boolean;
  data: {
    title: string;
    section?: string | undefined;
    order?: number | undefined;
    updated?: string | undefined;
    keywords?: unknown;
  };
}

export function keywordsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((k) => k.trim().replace(/^["']/, '').replace(/["']$/, ''))
      .filter(Boolean);
  }
  return [];
}

export function summarize(page: Summarizable): PageSummary {
  return {
    lang: page.lang,
    slug: page.slug,
    url: page.url,
    title: page.data.title,
    section: page.data.section ?? '',
    order: page.data.order ?? null,
    updated: page.data.updated ?? '',
    // 分类目前只可能来自 frontmatter；宏登记的分类属于渲染期信息，不在这里
    categories: [],
  };
}

export function createSiteInfo(
  config: LoadedConfig,
  pages: Summarizable[],
  generatedAt: Date = new Date(),
): SiteInfo {
  const published = pages.filter((page) => !page.draft);
  const pageCounts: Record<string, number> = {};
  for (const lang of Object.keys(config.content)) pageCounts[lang] = 0;
  for (const page of published) {
    pageCounts[page.lang] = (pageCounts[page.lang] ?? 0) + 1;
  }

  const order = (a: PageSummary, b: PageSummary): number => {
    if (a.section !== b.section) return a.section.localeCompare(b.section, 'zh');
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.slug.localeCompare(b.slug, 'zh');
  };

  return {
    title: config.title,
    siteUrl: config.siteUrl,
    base: normalizeBasePath(config.basePath),
    defaultLanguage: config.defaultLanguage,
    languages: Object.keys(config.content),
    urlStyle: config.urlStyle,
    sections: config.sections,
    generatedAt: generatedAt.toISOString(),
    pageCount: published.length,
    pageCounts,
    pages: published.map(summarize).sort(order),
    config,
  };
}
