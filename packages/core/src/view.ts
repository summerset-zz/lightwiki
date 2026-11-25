import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LoadedConfig } from './config.js';
import type { Page } from './content.js';
import { keywordsOf, NOT_FOUND_SLUG, pageInfoOf, type SiteInfo } from './context.js';
import { categoryUrl, INDEX_SLUG, normalizeBasePath, pageUrl } from './routes.js';

export interface NavPage {
  title: string;
  url: string;
  current: boolean;
}

export interface NavGroup {
  /** section 的 slug */
  section: string;
  /** 显示名：配置里声明过就用声明值，否则等于 slug */
  label: string;
  pages: NavPage[];
}

function sortPages(a: Page, b: Page): number {
  const orderA = a.data.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.data.order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return a.slug.localeCompare(b.slug, 'zh');
}

/**
 * 侧栏导航：先按配置里声明的 section 顺序，未声明的按出现顺序排在后面。
 * 草稿不进导航（但可以按地址直接打开）。
 */
/** 约定：slug 为 `404` 的页面不进导航，也不按普通页面输出 */
export { NOT_FOUND_SLUG };

function isVisible(page: Page): boolean {
  return !page.draft && page.slug !== NOT_FOUND_SLUG;
}

export function buildNav(
  config: LoadedConfig,
  pages: Page[],
  currentUrl: string,
): NavGroup[] {
  return toGroups(config, pages.filter(isVisible), currentUrl);
}

/** 把一批页面按 section 分组；section 顺序听配置的 */
function toGroups(config: LoadedConfig, list: Page[], currentUrl: string): NavGroup[] {
  const declared = config.sections;
  const groups = new Map<string, Page[]>();

  for (const page of [...list].sort(sortPages)) {
    const section = page.data.section ?? '';
    const bucket = groups.get(section) ?? [];
    bucket.push(page);
    groups.set(section, bucket);
  }

  const sections = [
    ...declared.filter((s) => groups.has(s)),
    ...[...groups.keys()].filter((s) => !declared.includes(s)),
  ];

  return sections.map((section) => ({
    section,
    label: config.sectionLabels[section] ?? section,
    pages: (groups.get(section) ?? []).map((p) => ({
      title: p.data.title,
      url: p.url,
      current: p.url === currentUrl,
    })),
  }));
}

function pagesInCategory(pages: Page[], slug: string): Page[] {
  return pages.filter((p) => isVisible(p) && p.categories.includes(slug));
}

/** 侧栏：默认是全站导航；页面声明了 `sidebarCategory` 就换成该分类的页面 */
export interface Sidebar {
  kind: 'site' | 'category';
  title: string;
  category?: string;
  groups: NavGroup[];
}

export function buildSidebar(
  config: LoadedConfig,
  pages: Page[],
  page: Page,
): Sidebar {
  const wanted = page.data.sidebarCategory;
  const nav = buildNav(config, pages, page.url);

  if (!wanted) {
    return { kind: 'site', title: '', groups: nav };
  }

  const members = pagesInCategory(pages, wanted);
  if (members.length === 0) {
    // 分类不存在或没成员：退回全站导航，至少侧栏不会空掉
    return { kind: 'site', title: '', groups: nav };
  }

  return {
    kind: 'category',
    title: config.categories[wanted] ?? wanted,
    category: wanted,
    groups: toGroups(config, members, page.url),
  };
}

/**
 * 内容仓库里提供了哪些可选片段。
 *
 * 主题的皮肤据此决定要不要 `include()` —— 文件不存在时 include 会报错，
 * 所以必须由数据层先告诉皮肤「有没有」。目前只有一个：顶栏。
 */
export interface Partials {
  /** `layouts/nav.eta` 是否存在；存在时主题会把它插在 `<body>` 开头 */
  nav: boolean;
}

function detectPartials(config: LoadedConfig): Partials {
  return { nav: existsSync(join(config.root, 'layouts', 'nav.eta')) };
}

export interface PageView {
  site: SiteInfo;
  page: Record<string, unknown>;
  nav: NavGroup[];
  sidebar: Sidebar;
  index: { url: string };
  partials: Partials;
}

export function createPageView(
  config: LoadedConfig,
  pages: Page[],
  page: Page,
  site: SiteInfo,
): PageView {
  const base = normalizeBasePath(config.basePath);
  return {
    site,
    page: {
      // 与宏共用的那套字段（含 slug / section / order / categories / frontmatter）
      ...pageInfoOf(page, config.lang),
      // 布局额外拥有的：渲染产物
      html: page.html,
      headings: page.headings,
      hints: page.hints,
      sources: page.sources,
      source: {
        site: page.data.sourceSite ?? '',
        title: page.data.sourceTitle ?? '',
        url: page.data.sourceUrl ?? '',
        revid: page.data.sourceRevid ?? '',
        license: page.data.sourceLicense ?? '',
        licenseUrl: page.data.sourceLicenseUrl ?? '',
        changes: page.data.sourceChanges ?? '',
      },
      license: page.data.license ?? '',
      licenseUrl: page.data.licenseUrl ?? '',
      authors: page.data.authors ?? '',
    },
    nav: buildNav(config, pages, page.url),
    sidebar: buildSidebar(config, pages, page),
    index: { url: pageUrl(config, INDEX_SLUG) },
    partials: detectPartials(config),
  };
}

export interface NotFoundView {
  site: SiteInfo;
  lang: string;
  nav: NavGroup[];
  index: { url: string };
  partials: Partials;
}

/**
 * 404 页。
 *
 * 静态托管只有一条约定：根目录的 `404.html`。GitHub Pages / Netlify /
 * Cloudflare Pages / S3 / OSS 都会在未命中时返回它（带真实 404 状态码）。
 * 因此这一页会在任意深度被打开，里面的资源必须是绝对路径。
 */
export function createNotFoundView(
  config: LoadedConfig,
  pages: Page[],
  site: SiteInfo,
): NotFoundView {
  const lang = config.lang;
  const base = normalizeBasePath(config.basePath);
  return {
    site,
    lang,
    nav: buildNav(config, pages, ''),
    index: { url: pageUrl(config, INDEX_SLUG) },
    partials: detectPartials(config),
  };
}

export interface NotFoundRender {
  layout: 'doc' | 'not-found';
  view: Record<string, unknown>;
}

/**
 * 404 页的渲染方案。
 *
 * 有内容页就优先用它（走 `doc` 布局，于是侧栏、TOC、样式都跟其他页一致），
 * 否则退回主题自带的 `not-found` 布局。两者的产物都是 `/404.html`。
 */
export function createNotFoundRender(
  config: LoadedConfig,
  pages: Page[],
  site: SiteInfo,
): NotFoundRender {
  const url = `${normalizeBasePath(config.basePath)}/404.html`;
  const page = pages.find((p) => p.slug === NOT_FOUND_SLUG && !p.draft);

  if (page) {
    return {
      layout: 'doc',
      view: createPageView(config, pages, { ...page, url }, site) as unknown as Record<string, unknown>,
    };
  }

  return {
    layout: 'not-found',
    view: createNotFoundView(config, pages, site) as unknown as Record<string, unknown>,
  };
}

export interface CategoryView {
  site: SiteInfo;
  lang: string;
  category: {
    slug: string;
    label: string;
    url: string;
    pages: NavPage[];
  };
  nav: NavGroup[];
  index: { url: string };
  partials: Partials;
}

export function createCategoryView(
  config: LoadedConfig,
  pages: Page[],
  slug: string,
  site: SiteInfo,
): CategoryView {
  const url = categoryUrl(config, slug);
  const base = normalizeBasePath(config.basePath);
  const members = pagesInCategory(pages, slug).sort(sortPages);

  return {
    site,
    lang: config.lang,
    category: {
      slug,
      label: config.categories[slug] ?? slug,
      url,
      pages: members.map((p) => ({ title: p.data.title, url: p.url, current: false })),
    },
    nav: buildNav(config, pages, url),
    index: { url: pageUrl(config, INDEX_SLUG) },
    partials: detectPartials(config),
  };
}
