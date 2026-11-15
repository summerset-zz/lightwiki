import type { LoadedConfig } from './config.js';
import type { Page } from './content.js';
import { keywordsOf, type SiteInfo } from './context.js';
import { langPrefix, normalizeBasePath } from './routes.js';

export interface NavPage {
  title: string;
  url: string;
  current: boolean;
}

export interface NavGroup {
  section: string;
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
  const visible = pages.filter((p) => p.lang === lang && !p.draft).sort(sortPages);
  const declared = config.sections;
  const groups = new Map<string, Page[]>();

  for (const page of visible) {
    const section = page.data.section ?? '';
    const list = groups.get(section) ?? [];
    list.push(page);
    groups.set(section, list);
  }

  const sections = [
    ...declared.filter((s) => groups.has(s)),
    ...[...groups.keys()].filter((s) => !declared.includes(s)),
  ];

  return sections.map((section) => ({
    section,
    pages: (groups.get(section) ?? []).map((p) => ({
      title: p.data.title,
      url: p.url,
      current: p.url === currentUrl,
    })),
  }));
}

export interface PageView {
  site: SiteInfo;
  page: Record<string, unknown>;
  nav: NavGroup[];
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
    index: { url: `${base}${langPrefix(config, page.lang)}/docs/` },
  };
}

export interface IndexView {
  site: SiteInfo;
  page: Record<string, unknown>;
  nav: NavGroup[];
  groups: NavGroup[];
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
    index: { url: indexUrl },
  };
}
