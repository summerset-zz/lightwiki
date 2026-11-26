import { readFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import {
  frontmatterSchema,
  describeIssues,
  type Frontmatter,
} from '@lightwiki/schema';
import type { LoadedConfig } from './config.js';
import {
  createMarkdown,
  renderMarkdown,
  type Heading,
  type LinkRef,
  type RenderEnv,
  type UnresolvedRef,
} from './markdown.js';
import { createSiteInfo, pageInfoOf, type PageInfo } from './context.js';
import { createHighlighter, type Highlighter } from './highlight.js';
import { normUrl } from './links.js';
import { loadMacros } from './macros.js';
import { LinkResolver, type TitleConflict } from './resolve.js';
import { outputPathFor, pageUrl } from './routes.js';

export interface Page {
  slug: string;
  /** 源文件绝对路径 */
  file: string;
  /** 相对内容目录的路径，用于报错 */
  relativePath: string;
  data: Frontmatter;
  /** 整篇原文（含 frontmatter）。「查看源码」用的就是它 */
  raw: string;
  html: string;
  headings: Heading[];
  links: LinkRef[];
  /** 站点插件写进 `env.data` 的数据，原样交给布局的 `it.page.meta` */
  meta: Record<string, unknown>;
  url: string;
  outputPath: string;
  draft: boolean;
  /** 正文里没解析出来的内链 / 没定义的宏 */
  unresolved: UnresolvedRef[];
  /** 由宏登记的分类（frontmatter 里的分类不在这里） */
  categories: string[];
}

export interface ContentProblem {
  file: string;
  messages: string[];
}

export interface LoadedContent {
  pages: Page[];
  problems: ContentProblem[];
  warnings: ContentProblem[];
  /** 同一语言内标题撞车的情况；撞了内链就是不明确的 */
  conflicts: TitleConflict[];
  /**
   * 正文渲染用的高亮器。构建时交给 HTML 出口，给皮肤里手写的
   * `<pre lang="x">` / `<code lang="x">` 染色，两处用的是同一份语言注册表。
   */
  highlight: Highlighter;
}

function stripQuotes(value: string): string {
  return value.replace(/^["']/, '').replace(/["']$/, '').trim();
}

function coerceScalar(raw: string): unknown {
  const value = raw.trim();
  if (!value) return '';
  const quoted = /^(["'])([\s\S]*)\1$/.exec(value);
  if (quoted) return quoted[2] ?? '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => stripQuotes(item))
      .filter(Boolean);
  }
  return value;
}

/**
 * 逐行回退解析器。
 *
 * 真实内容里确实存在 `keywords: "@font-face", src, local` 这种非法 YAML ——
 * 它明显是「作者想写一个列表，但漏了方括号」。因为一处引号没闭合就让整个站点构建失败
 * 不合理，所以这里宽容地把它读成字符串，并明确告知作者「这行不是合法 YAML」。
 */
function lenientFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const block = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!block) return { data: {}, content: raw };
  const data: Record<string, unknown> = {};
  for (const line of (block[1] ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*([\s\S]*)$/.exec(line);
    if (!kv || !kv[1]) continue;
    data[kv[1]] = coerceScalar(kv[2] ?? '');
  }
  return { data, content: raw.slice(block[0].length) };
}

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
  lenient: boolean;
  /** YAML 解析器说的第一句人话（通常带行号与哪一行） */
  reason?: string;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  if (!/^\uFEFF?---\r?\n/.test(raw)) {
    return { data: {}, content: raw, lenient: false };
  }
  try {
    const parsed = matter(raw);
    return { data: parsed.data as Record<string, unknown>, content: parsed.content, lenient: false };
  } catch (error) {
    const fallback = lenientFrontmatter(raw);
    return { ...fallback, lenient: true, reason: yamlReason(error) };
  }
}

/**
 * 把 YAML 库的异常压缩成一行。
 *
 * 典型原因就两种，而且都很好改：
 * - 值里有 `: `（冒号+空格）→ 被当成了嵌套键，加引号即可；
 * - `keywords: "a", b, c` → 引号只包住了第一个，后面抸在外面。
 */
function yamlReason(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const first = error.message.split('\n')[0] ?? error.message;
  return first.replace(/^YAMLException:\s*/, '').trim();
}

/**
 * YAML 会把不带引号的 `2026-11-07` 解析成 Date 对象，
 * 而 schema 要求原始字符串。这里在校验前统一降级成 YYYY-MM-DD。
 */
function normalizeDates(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      out[key] = value.toISOString().slice(0, 10);
    }
  }
  return out;
}

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

export interface PageSeed {
  slug: string;
  file: string;
  relativePath: string;
  data: Frontmatter;
  /** 去掉 frontmatter 之后的 markdown 正文 */
  body: string;
  /** 整篇原文（含 frontmatter） */
  raw: string;
  url: string;
  outputPath: string;
  draft: boolean;
}

export async function loadContent(config: LoadedConfig): Promise<LoadedContent> {
  const highlighter = await createHighlighter(config);
  const md = createMarkdown({ highlight: highlighter, setup: config.markdown });
  const macros = await loadMacros(config);
  const seeds: PageSeed[] = [];
  const problems: ContentProblem[] = [];
  const warnings: ContentProblem[] = [];

  const dir = config.content;
  const absDir = resolve(config.root, dir);
  let files: string[] = [];
  try {
    files = await fg('**/*.md', { cwd: absDir, absolute: true });
  } catch {
    problems.push({ file: absDir, messages: [`content directory not found: ${dir}`] });
  }

  for (const file of files.sort()) {
    const raw = await readFile(file, 'utf8');
    const relativePath = toPosix(relative(absDir, file));
    const parsed = parseFrontmatter(raw);
    if (parsed.lenient) {
      warnings.push({
        file: `${dir}/${relativePath}`,
        messages: [
          `frontmatter is not valid YAML, read line by line in lenient mode${parsed.reason ? `: ${parsed.reason}` : ''}`,
        ],
      });
    }

    const result = frontmatterSchema.safeParse(normalizeDates(parsed.data));
    if (!result.success) {
      problems.push({
        file: `${dir}/${relativePath}`,
        messages: describeIssues(result.error.issues),
      });
      continue;
    }

    const data = result.data;
    const slug = toPosix(relative(absDir, file)).replace(/\.md$/, '');

    seeds.push({
      slug,
      file,
      relativePath,
      data,
      body: parsed.content,
      raw,
      url: pageUrl(config, slug),
      outputPath: outputPathFor(config, slug),
      draft: data.draft,
    });
  }

  // 阶段 2：先把全站的 slug / 标题登记进索引，再渲染。
  // 内链 `[[标题]]` 必须能看到「扫描顺序在后面」的页面，所以不能边扫边渲染。
  const resolver = new LinkResolver();
  for (const seed of seeds) {
    resolver.add({ slug: seed.slug, url: seed.url, title: seed.data.title });
  }
  resolver.finalize();

  const siteInfo = createSiteInfo(config, seeds);

  // 红链判定用：所有已登记页面的地址，与 `pageLinkKey()` 的归一化完全一致
  // （去 basePath、去尾斜杠与 .html）。两边必须同源，否则部署到子路径时
  // 渲染层会把每一条站内链接都染成红链。
  const knownUrls = new Set(seeds.map((seed) => normUrl(seed.url, config)));

  // 阶段 3：渲染
  const pages: Page[] = seeds.map((seed) => {
    const pageInfo = buildPageInfo(seed, config);
    const env: RenderEnv = {
      lang: config.lang,
      config,
      resolver,
      macros,
      pageInfo,
      siteInfo,
      knownUrls,
      unresolved: [],
      categories: new Set<string>(),
    };
    const rendered = renderMarkdown(md, seed.body, env);

    return {
      slug: seed.slug,
      file: seed.file,
      relativePath: seed.relativePath,
      data: seed.data,
      raw: seed.raw,
      html: rendered.html,
      headings: rendered.headings,
      links: rendered.links,
      meta: rendered.data,
      url: seed.url,
      outputPath: seed.outputPath,
      draft: seed.draft,
      unresolved: env.unresolved ?? [],
      categories: pageInfo.categories,
    };
  });

  return { pages, problems, warnings, conflicts: resolver.conflicts, highlight: highlighter };
}

/**
 * 构造宏与布局看到的 `it.page`。
 *
 * 统一走 `context.ts` 的 `pageInfoOf`，避免布局与宏拿到不同的字段集。
 */
function buildPageInfo(seed: PageSeed, config: LoadedConfig): PageInfo {
  return pageInfoOf(seed, config.lang);
}

/** 文件名（不含扩展名），用于提示「你可能想要的是 xxx」 */
export function suggestSlug(file: string): string {
  return basename(file).replace(/\.md$/, '');
}
