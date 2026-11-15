import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem } from './content.js';
import { buildLinkReport, type LinkReport } from './links.js';
import type { TitleConflict } from './resolve.js';

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

export interface CategoryIssue {
  file: string;
  message: string;
}

export interface CheckResult {
  ok: boolean;
  pageCount: number;
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
    const missing = allLangs.filter((lang) => !present.has(lang));
    if (missing.length > 0) {
      missingTranslations.push({ slug, present: [...present].sort(), missing });
    }
  }

  const unresolved: UnresolvedIssue[] = [];
  for (const page of pages) {
    for (const item of page.unresolved) {
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
          message: `分类 ${category} 没在配置的 categories 里声明，会直接拿 slug 当显示名`,
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
          message: `sidebarCategory「${sidebar}」下没有任何页面，侧栏会退回全站导航`,
        });
      }
    }
  }

  // 未定义的宏会让产物里直接露出 `{{...}}` 原文，算错误；
  // 未解析的内链与红链同级，是「目标还没写」的正常状态。
  const macroErrors = unresolved.filter((item) => item.kind === 'macro').length;

  return {
    ok:
      problems.length === 0 &&
      sectionIssues.length === 0 &&
      conflicts.length === 0 &&
      macroErrors === 0,
    pageCount: pages.length,
    problems,
    warnings,
    report,
    sectionIssues,
    missingTranslations,
    titleConflicts: conflicts,
    unresolved,
    categoryIssues,
  };
}
