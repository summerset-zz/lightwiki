import { existsSync } from 'node:fs';
import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem } from './content.js';
import { buildLinkReport, type LinkReport } from './links.js';
import { assetList, isExternalUrl, resolvePageAsset, scriptList } from './page-assets.js';
import { layoutCandidates } from './render.js';
import { INDEX_SLUG } from './routes.js';
import type { TitleConflict } from './resolve.js';

export interface LayoutIssue {
  file: string;
  layout: string;
}

/** frontmatter 的 styles / scripts 指向了不存在的文件 */
export interface AssetIssue {
  file: string;
  field: 'styles' | 'scripts';
  reference: string;
}

export interface SectionIssue {
  file: string;
  section: string;
}

export interface MissingTranslation {
  slug: string;
  present: string[];
  missing: string[];
}

export interface UnresolvedIssue {
  file: string;
  kind: 'wikilink' | 'macro';
  target: string;
  message: string;
}

/** 语言 → 页数。口径与 `pageCount` 一致：含草稿。 */
function countByLanguage(
  config: LoadedConfig,
  pages: Array<{ lang: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const lang of Object.keys(config.content)) counts[lang] = 0;
  for (const page of pages) counts[page.lang] = (counts[page.lang] ?? 0) + 1;
  return counts;
}

export interface CategoryIssue {
  file: string;
  message: string;
}

export interface CheckResult {
  ok: boolean;
  pageCount: number;
  /** 语言 → 页数（含草稿，与 pageCount 同口径） */
  pageCounts: Record<string, number>;
  problems: ContentProblem[];
  warnings: ContentProblem[];
  report: LinkReport;
  sectionIssues: SectionIssue[];
  /**
   * 只写一种语言是允许的（页面会显示「暂无此语言」），
   * 所以这里只是提示，不算失败。
   */
  missingTranslations: MissingTranslation[];
  /** 同一语言内标题撞车：内链 `[[标题]]` 会变得不明确，算错误 */
  titleConflicts: TitleConflict[];
  /** 未解析的内链与未定义的宏 */
  unresolved: UnresolvedIssue[];
  /** 分类的疑点（未声明显示名、sidebarCategory 没成员） */
  categoryIssues: CategoryIssue[];
  /** frontmatter 指定的布局找不到文件：构建时必炋，所以算错误 */
  layoutIssues: LayoutIssue[];
  /** frontmatter 的 styles / scripts 找不到文件（构建时只警告，但仍然是写错了） */
  assetIssues: AssetIssue[];
  /** 缺首页的语言：`/docs/`（或 docsDir 指定的位置）会直接 404 */
  missingHomes: string[];
}

export async function checkSite(config: LoadedConfig): Promise<CheckResult> {
  const { pages, problems, warnings, conflicts } = await loadContent(config);
  const report = buildLinkReport(config, pages);

  const sectionIssues: SectionIssue[] = [];
  if (config.sections.length > 0) {
    for (const page of pages) {
      const section = page.data.section;
      if (section && !config.sections.includes(section)) {
        sectionIssues.push({ file: `${page.lang}/${page.slug}`, section });
      }
    }
  }

  const langsBySlug = new Map<string, Set<string>>();
  for (const page of pages) {
    const set = langsBySlug.get(page.slug) ?? new Set<string>();
    set.add(page.lang);
    langsBySlug.set(page.slug, set);
  }

  const allLangs = Object.keys(config.content);
  const missingTranslations: MissingTranslation[] = [];
  for (const [slug, present] of [...langsBySlug].sort(([a], [b]) => a.localeCompare(b))) {
    // 404 页只有默认语言一份（产物也只能有一个 404.html），不参与缺译提示
    if (slug === '404') continue;
    const missing = allLangs.filter((lang) => !present.has(lang));
    if (missing.length > 0) {
      missingTranslations.push({ slug, present: [...present].sort(), missing });
    }
  }

  const unresolved: UnresolvedIssue[] = [];
  let undefinedMacros = 0;
  for (const page of pages) {
    for (const item of page.unresolved) {
      if (item.undefinedMacro) undefinedMacros += 1;
      unresolved.push({
        file: `${page.lang}/${page.slug}`,
        kind: item.kind,
        target: item.target,
        message: item.message,
      });
    }
  }

  const categoryIssues: CategoryIssue[] = [];
  for (const page of pages) {
    for (const category of page.categories) {
      if (!(category in config.categories)) {
        categoryIssues.push({
          file: `${page.lang}/${page.slug}`,
          message: `category ${category} is not declared in config.categories; the slug will be used as the label`,
        });
      }
    }

    const sidebar = page.data.sidebarCategory;
    if (sidebar) {
      const hasMember = pages.some(
        (other) => other.lang === page.lang && other.categories.includes(sidebar),
      );
      if (!hasMember) {
        categoryIssues.push({
          file: `${page.lang}/${page.slug}`,
          message: `sidebarCategory "${sidebar}" has no pages; the sidebar falls back to site navigation`,
        });
      }
    }
  }

  // 未定义的宏会让产物里直接露 `{{...}}` 原文。这是不是错，取决于站点怎么选：
  // 默认（show）算错——露花括号通常是漏搬了宏；显式选 hide 或给了处理函数，
  // 说明作者清楚自己在做什么，那就只当提示。
  // 展开失败（循环引用、模板抛错）无论怎么配都是错。
  const macroFailures = pages.reduce(
    (sum, page) =>
      sum + page.unresolved.filter((item) => item.kind === 'macro' && !item.undefinedMacro).length,
    0,
  );
  const undefinedIsError = (config.macros?.undefined ?? 'show') === 'show';
  const macroErrors = macroFailures + (undefinedIsError ? undefinedMacros : 0);

  // 页面自己指定的布局：文件名不对或文件不在，构建都会直接抛错，不如先点出来
  const layoutIssues: LayoutIssue[] = [];
  for (const page of pages) {
    const layout = page.data.layout;
    if (!layout) continue;
    if (!layoutCandidates(config, layout).some(existsSync)) {
      layoutIssues.push({ file: `${page.lang}/${page.slug}`, layout });
    }
  }

  // styles / scripts：产物里会少一个引用，页面还能看，但那就是写错了
  const assetIssues: AssetIssue[] = [];
  for (const page of pages) {
    const file = `${page.lang}/${page.slug}`;
    for (const reference of assetList(page.data.styles)) {
      // 站外地址不查本地文件（CDN 上的东西我们看不见）
      if (isExternalUrl(reference)) continue;
      if (resolvePageAsset(config, reference)) continue;
      assetIssues.push({ file, field: 'styles', reference });
    }
    for (const entry of scriptList(page.data.scripts)) {
      if (isExternalUrl(entry.src)) continue;
      if (resolvePageAsset(config, entry.src)) continue;
      assetIssues.push({ file, field: 'scripts', reference: entry.src });
    }
  }

  // 每种语言都得有 index.md：它是 `/docs/`（或 docsDir 指定的位置）唯一的来源
  const missingHomes = Object.keys(config.content).filter(
    (lang) => !pages.some((page) => page.lang === lang && page.slug === INDEX_SLUG),
  );

  return {
    ok:
      problems.length === 0 &&
      sectionIssues.length === 0 &&
      conflicts.length === 0 &&
      macroErrors === 0 &&
      layoutIssues.length === 0 &&
      assetIssues.length === 0 &&
      missingHomes.length === 0,
    pageCount: pages.length,
    pageCounts: countByLanguage(config, pages),
    problems,
    warnings,
    report,
    sectionIssues,
    missingTranslations,
    titleConflicts: conflicts,
    unresolved,
    categoryIssues,
    layoutIssues,
    assetIssues,
    missingHomes,
  };
}
