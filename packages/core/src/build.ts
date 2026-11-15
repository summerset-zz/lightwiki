import { existsSync } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem, type Page } from './content.js';
import { buildLinkReport, type LinkReport } from './links.js';
import { createRenderer } from './render.js';
import { langPrefix, normalizeBasePath, pageUrl } from './routes.js';

export interface NavPage {
  title: string;
  url: string;
  current: boolean;
}

export interface NavGroup {
  section: string;
  pages: NavPage[];
}

export interface BuildOptions {
  /** 覆盖 config.outputDir */
  outDir?: string;
}

export interface BuildResult {
  outputDir: string;
  pageCount: number;
  problems: ContentProblem[];
  warnings: ContentProblem[];
  report: LinkReport;
  written: string[];
}

function keywordsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((k) => k.trim().replace(/^["']/, '').replace(/["']$/, ''))
      .filter(Boolean);
  }
  return [];
}

function sortPages(a: Page, b: Page): number {
  const orderA = a.data.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.data.order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return a.slug.localeCompare(b.slug, 'zh');
}

function buildNav(config: LoadedConfig, pages: Page[], lang: string, currentUrl: string): NavGroup[] {
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

export async function buildSite(
  config: LoadedConfig,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const outputDir = resolve(config.root, options.outDir ?? config.outputDir);
  const { pages, problems, warnings } = await loadContent(config);
  const report = buildLinkReport(config, pages);
  const renderer = createRenderer(config);
  const written: string[] = [];

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const base = normalizeBasePath(config.basePath);
  const siteBase = {
    title: config.title,
    siteUrl: config.siteUrl,
    base,
    defaultLanguage: config.defaultLanguage,
    languages: Object.keys(config.content),
  };

  const published = pages.filter((p) => !p.draft);

  for (const page of published) {
    const view = {
      site: siteBase,
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

    const html = await renderer.renderLayout('doc', view);
    const target = join(outputDir, page.outputPath);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, html, 'utf8');
    written.push(page.outputPath);
  }

  // 每种语言一个目录页：既是导航入口，也是孤页判定的基准
  for (const lang of Object.keys(config.content)) {
    const indexUrl = `${base}${langPrefix(config, lang)}/docs/`;
    const indexPath = `${langPrefix(config, lang)}/docs/index.html`.replace(/^\//, '');
    const view = {
      site: siteBase,
      page: {
        lang,
        title: config.title,
        description: '',
        keywords: [] as string[],
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
      nav: buildNav(config, pages, lang, indexUrl),
      groups: buildNav(config, pages, lang, indexUrl),
      index: { url: indexUrl },
    };
    const html = await renderer.renderLayout('index', view);
    const target = join(outputDir, indexPath);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, html, 'utf8');
    written.push(indexPath);
  }

  // 根目录跳转到默认语言，方便 file:// 双击直接看
  const rootIndex = `<!doctype html><meta charset="utf-8"><title>${config.title}</title>` +
    `<meta http-equiv="refresh" content="0;url=${base}${langPrefix(config, config.defaultLanguage)}/docs/">` +
    `<p><a href="${base}${langPrefix(config, config.defaultLanguage)}/docs/">进入 ${config.title}</a></p>`;
  await writeFile(join(outputDir, 'index.html'), rootIndex, 'utf8');
  written.push('index.html');

  // 资源：内容仓库的 assets/ 与主题的 assets/
  const siteAssets = resolve(config.root, config.assetsDir);
  if (existsSync(siteAssets)) {
    await cp(siteAssets, join(outputDir, 'assets'), { recursive: true });
  }
  const themeAssets = join(config.themeDir, 'assets');
  if (existsSync(themeAssets)) {
    await cp(themeAssets, join(outputDir, 'assets', 'theme'), { recursive: true });
  }

  // 归档追溯用：产物里要能看出它是用什么版本生成的
  await writeFile(
    join(outputDir, 'meta.json'),
    JSON.stringify(
      {
        generator: 'lightwiki',
        builtAt: new Date().toISOString(),
        siteUrl: config.siteUrl,
        basePath: base,
        urlStyle: config.urlStyle,
        languages: Object.keys(config.content),
        pages: published.length,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  return { outputDir, pageCount: published.length, problems, warnings, report, written };
}

export { pageUrl };
