import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fg from 'fast-glob';
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

/** 页面 slug 与产物里的保留段同名（`assets/`、`categories/`） */
export interface ReservedIssue {
  file: string;
  segment: string;
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
  /** slug 撞上了 `assets/` / `categories/` 这类保留段 */
  reservedIssues: ReservedIssue[];
  /** 标题撞车：内链 `[[标题]]` 会变得不明确，算错误 */
  titleConflicts: TitleConflict[];
  /** 未解析的内链与未定义的宏 */
  unresolved: UnresolvedIssue[];
  /** 分类的疑点（未声明显示名、sidebarCategory 没成员） */
  categoryIssues: CategoryIssue[];
  /** frontmatter 指定的布局找不到文件：构建时必炋，所以算错误 */
  layoutIssues: LayoutIssue[];
  /** frontmatter 的 styles / scripts 找不到文件（构建时只警告，但仍然是写错了） */
  assetIssues: AssetIssue[];
  /** 同名 `.css` 与 `.less`：构建会用 `.less` 编译出的那份覆盖手写的 `.css` */
  styleConflicts: string[];
  /** 缺首页：`index.md` 不在内容目录里，站点的入口页会直接 404 */
  missingHome: boolean;
}

export async function checkSite(config: LoadedConfig): Promise<CheckResult> {
  const { pages, problems, warnings, conflicts } = await loadContent(config);
  const report = buildLinkReport(config, pages);

  // `docsDir` 为空时内容页直接挂在根下，`assets.md` / `categories.md` 会和产物里的
  // 保留段抢同一个地址（`/assets/` 是资源目录，`/categories/` 是分类页）。
  const reserved = new Set(['assets', 'categories']);
  const reservedIssues: ReservedIssue[] = [];
  for (const page of pages) {
    const segment = page.slug.split('/')[0] ?? '';
    if (reserved.has(segment)) reservedIssues.push({ file: page.slug, segment });
  }

  const sectionIssues: SectionIssue[] = [];
  if (config.sections.length > 0) {
    for (const page of pages) {
      const section = page.data.section;
      if (section && !config.sections.includes(section)) {
        sectionIssues.push({ file: page.slug, section });
      }
    }
  }

  const unresolved: UnresolvedIssue[] = [];
  let undefinedMacros = 0;
  for (const page of pages) {
    for (const item of page.unresolved) {
      if (item.undefinedMacro) undefinedMacros += 1;
      unresolved.push({
        file: page.slug,
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
          file: page.slug,
          message: `category ${category} is not declared in config.categories; the slug will be used as the label`,
        });
      }
    }

    const sidebar = page.data.sidebarCategory;
    if (sidebar) {
      const hasMember = pages.some((other) => other.categories.includes(sidebar));
      if (!hasMember) {
        categoryIssues.push({
          file: page.slug,
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
      layoutIssues.push({ file: page.slug, layout });
    }
  }

  // styles / scripts：产物里会少一个引用，页面还能看，但那就是写错了
  const assetIssues: AssetIssue[] = [];
  for (const page of pages) {
    const file = page.slug;
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

  // 同名 `.css` 与 `.less`：构建时 `.less` 编译出来的那份会覆盖手写的 `.css`，
  // 预览也跟随这个规则。不是错，但作者多半不知道，得点名。
  const styleDir = resolve(config.root, config.assetsDir);
  const styleConflicts: string[] = [];
  for (const rel of await fg('**/*.less', { cwd: styleDir })) {
    const css = rel.replace(/\.less$/i, '.css');
    if (existsSync(join(styleDir, css))) styleConflicts.push(css);
  }
  styleConflicts.sort();

  // 内容目录里必须有 index.md：它是首页唯一的来源
  const missingHome = !pages.some((page) => page.slug === INDEX_SLUG);

  return {
    ok:
      problems.length === 0 &&
      sectionIssues.length === 0 &&
      reservedIssues.length === 0 &&
      conflicts.length === 0 &&
      macroErrors === 0 &&
      layoutIssues.length === 0 &&
      assetIssues.length === 0 &&
      !missingHome,
    pageCount: pages.length,
    problems,
    warnings,
    report,
    sectionIssues,
    reservedIssues,
    titleConflicts: conflicts,
    unresolved,
    categoryIssues,
    layoutIssues,
    assetIssues,
    styleConflicts,
    missingHome,
  };
}
