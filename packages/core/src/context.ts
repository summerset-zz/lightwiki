import type { LoadedConfig } from './config.js';
import { normalizeBasePath, searchIndexUrl, shouldInlineSearch } from './routes.js';

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
  /**
   * 整篇 markdown 原文（含 frontmatter），供布局做「查看源码」。
   * 注意它**不是** `source` —— 那个是「改编来源」。
   */
  markdown: string;
}

/** 约定：slug 为 `404` 的页面不进导航，也不按普通页面输出，只负责生成根目录的 404.html */
export const NOT_FOUND_SLUG = '404';

/** 分类：键是 ASCII slug，显示名在站点配置里 */
export interface CategoryInfo {
  slug: string;
  label: string;
  count: number;
}

/** 搜索索引对模板暴露的部分：只要位置，不要数据（数据在页面里或 json 里） */
export interface SearchInfo {
  /** 索引 json 的站点路径；索引内联进页面时为 null */
  url: string | null;
}

export interface SiteInfo {
  title: string;
  siteUrl: string;
  base: string;
  defaultLanguage: string;
  languages: string[];
  urlStyle: string;
  sections: string[];
  /** section slug → 显示名 */
  sectionLabels: Record<string, string>;
  /** 分类 slug → 显示名，原样来自配置 */
  categories: Record<string, string>;
  /** 实际被页面使用的分类，按配置声明的顺序排，未声明的排在后面 */
  categoryList: CategoryInfo[];
  /** 构建时间（ISO 8601）。注意它会让产物每次都不同 */
  generatedAt: string;
  /** 已发布页面数（不含草稿） */
  pageCount: number;
  pageCounts: Record<string, number>;
  /** 所有已发布页面的摘要，按语言 + section + order 排好 */
  pages: PageSummary[];
  /** 站内搜索；配置里关掉就是 null，模板据此决定要不要渲染搜索框 */
  search: SearchInfo | null;
  /**
   * `wiki.config.ts` 的原始配置，只读。
   * 里面有绝对路径（root / themeDir），打印出来时注意别泄露本机路径。
   */
  config: LoadedConfig;
}

/** pageInfoOf 需要的输入：Page 与 PageSeed 都满足 */
export interface PageInfoInput {
  lang: string;
  slug: string;
  url: string;
  outputPath: string;
  relativePath: string;
  draft: boolean;
  raw: string;
  data: {
    title: string;
    description?: string | undefined;
    keywords?: unknown;
    updated?: string | undefined;
    section?: string | undefined;
    order?: number | undefined;
    categories?: unknown;
  };
}

/**
 * 构造 `it.page`。
 *
 * **宏与布局必须用同一个构造器**：曾经布局那边是手写的字段子集，
 * 导致 `it.page.slug` 在宏里能拿到、在布局里是 undefined。
 * 布局额外拥有的只有渲染产物（`html` / `headings` / `hints` / `sources`）。
 */
export function pageInfoOf(input: PageInfoInput): PageInfo {
  return {
    ...(input.data as unknown as Record<string, unknown>),
    lang: input.lang,
    slug: input.slug,
    url: input.url,
    outputPath: input.outputPath,
    relativePath: input.relativePath,
    draft: input.draft,
    title: input.data.title,
    description: input.data.description ?? '',
    keywords: keywordsOf(input.data.keywords),
    updated: input.data.updated ?? '',
    section: input.data.section ?? '',
    order: input.data.order ?? null,
    categories: categoriesOf(input.data.categories),
    frontmatter: input.data as unknown as Record<string, unknown>,
    markdown: input.raw,
  };
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
    categories?: unknown;
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

export function categoriesOf(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const slug = item.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
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
    categories: categoriesOf(page.data.categories),
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

  const summaries = published.map(summarize).sort(order);

  const categoryCounts = new Map<string, number>();
  for (const summary of summaries) {
    for (const slug of summary.categories) {
      categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1);
    }
  }

  const declared = Object.keys(config.categories);
  const undeclared = [...categoryCounts.keys()].filter((slug) => !declared.includes(slug)).sort();
  const categoryList: CategoryInfo[] = [...declared.filter((slug) => categoryCounts.has(slug)), ...undeclared].map(
    (slug) => ({
      slug,
      label: config.categories[slug] ?? slug,
      count: categoryCounts.get(slug) ?? 0,
    }),
  );

  return {
    title: config.title,
    siteUrl: config.siteUrl,
    base: normalizeBasePath(config.basePath),
    defaultLanguage: config.defaultLanguage,
    languages: Object.keys(config.content),
    urlStyle: config.urlStyle,
    sections: config.sections,
    sectionLabels: config.sectionLabels,
    categories: config.categories,
    categoryList,
    generatedAt: generatedAt.toISOString(),
    pageCount: published.length,
    pageCounts,
    pages: summaries,
    search: config.search.enabled
      ? { url: shouldInlineSearch(config) ? null : searchIndexUrl(config) }
      : null,
    config,
  };
}
