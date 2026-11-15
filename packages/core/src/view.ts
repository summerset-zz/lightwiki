import type { LoadedConfig } from './config.js';
import type { Page } from './content.js';
import { keywordsOf, type SiteInfo } from './context.js';
import { categoryUrl, langPrefix, normalizeBasePath } from './routes.js';

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
export function buildNav(
  config: LoadedConfig,
  pages: Page[],
  lang: string,
  currentUrl: string,
): NavGroup[] {
  return toGroups(config, pages.filter((p) => p.lang === lang && !p.draft), currentUrl);
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

function pagesInCategory(pages: Page[], lang: string, slug: string): Page[] {
  return pages.filter(
    (p) => p.lang === lang && !p.draft && p.categories.includes(slug),
  );
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
  const nav = buildNav(config, pages, page.lang, page.url);

  if (!wanted) {
    return { kind: 'site', title: '', groups: nav };
  }

  const members = pagesInCategory(pages, page.lang, wanted);
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

export interface PageView {
  site: SiteInfo;
  page: Record<string, unknown>;
  nav: NavGroup[];
  sidebar: Sidebar;
  index: { url: string };
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
      lang: page.lang,
      title: page.data.title,
      description: page.data.description ?? '',
      keywords: keywordsOf(page.data.keywords),
      updated: page.data.updated ?? '',
      url: page.url,
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
    nav: buildNav(config, pages, page.lang, page.url),
    sidebar: buildSidebar(config, pages, page),
    index: { url: `${base}${langPrefix(config, page.lang)}/docs/` },
  };
}

export interface IndexView {
  site: SiteInfo;
  page: Record<string, unknown>;
  nav: NavGroup[];
  groups: NavGroup[];
  categories: Array<{ slug: string; label: string; url: string; count: number }>;
  index: { url: string };
}

export function createIndexView(
  config: LoadedConfig,
  pages: Page[],
  lang: string,
  site: SiteInfo,
): IndexView {
  const base = normalizeBasePath(config.basePath);
  const indexUrl = `${base}${langPrefix(config, lang)}/docs/`;
  const nav = buildNav(config, pages, lang, indexUrl);
  return {
    site,
    page: {
      lang,
      title: config.title,
      description: '',
      keywords: [],
      updated: '',
      url: indexUrl,
      html: '',
      headings: [],
      hints: [],
      sources: [],
      source: { site: '', title: '', url: '', revid: '', license: '', licenseUrl: '', changes: '' },
      license: '',
      licenseUrl: '',
      authors: '',
    },
    nav,
    groups: nav,
    categories: site.categoryList.map((c) => ({
      slug: c.slug,
      label: c.label,
      url: categoryUrl(config, lang, c.slug),
      count: c.count,
    })),
    index: { url: indexUrl },
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
}

export function createCategoryView(
  config: LoadedConfig,
  pages: Page[],
  lang: string,
  slug: string,
  site: SiteInfo,
): CategoryView {
  const url = categoryUrl(config, lang, slug);
  const base = normalizeBasePath(config.basePath);
  const members = pagesInCategory(pages, lang, slug).sort(sortPages);

  return {
    site,
    lang,
    category: {
      slug,
      label: config.categories[slug] ?? slug,
      url,
      pages: members.map((p) => ({ title: p.data.title, url: p.url, current: false })),
    },
    nav: buildNav(config, pages, lang, url),
    index: { url: `${base}${langPrefix(config, lang)}/docs/` },
  };
}
