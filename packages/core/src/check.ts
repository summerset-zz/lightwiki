import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem } from './content.js';
import { buildLinkReport, type LinkReport } from './links.js';

export interface SectionIssue {
  file: string;
  section: string;
}

export interface MissingTranslation {
  slug: string;
  present: string[];
  missing: string[];
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
}

export async function checkSite(config: LoadedConfig): Promise<CheckResult> {
  const { pages, problems, warnings } = await loadContent(config);
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

  return {
    ok: problems.length === 0 && sectionIssues.length === 0,
    pageCount: pages.length,
    problems,
    warnings,
    report,
    sectionIssues,
    missingTranslations,
  };
}
