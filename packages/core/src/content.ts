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
  type Hint,
  type LinkRef,
  type SectionSource,
} from './markdown.js';
import { outputPathFor, pageUrl } from './routes.js';

export interface Page {
  lang: string;
  slug: string;
  /** 源文件绝对路径 */
  file: string;
  /** 相对内容目录的路径，用于报错 */
  relativePath: string;
  data: Frontmatter;
  html: string;
  headings: Heading[];
  links: LinkRef[];
  hints: Hint[];
  sources: SectionSource[];
  url: string;
  outputPath: string;
  draft: boolean;
}

export interface ContentProblem {
  file: string;
  messages: string[];
}

export interface LoadedContent {
  pages: Page[];
  problems: ContentProblem[];
  warnings: ContentProblem[];
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
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  if (!/^\uFEFF?---\r?\n/.test(raw)) {
    return { data: {}, content: raw, lenient: false };
  }
  try {
    const parsed = matter(raw);
    return { data: parsed.data as Record<string, unknown>, content: parsed.content, lenient: false };
  } catch {
    const fallback = lenientFrontmatter(raw);
    return { ...fallback, lenient: true };
  }
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

export async function loadContent(config: LoadedConfig): Promise<LoadedContent> {
  const md = createMarkdown();
  const pages: Page[] = [];
  const problems: ContentProblem[] = [];
  const warnings: ContentProblem[] = [];

  for (const [lang, dir] of Object.entries(config.content)) {
    const absDir = resolve(config.root, dir);
    let files: string[];
    try {
      files = await fg('**/*.md', { cwd: absDir, absolute: true });
    } catch {
      problems.push({ file: absDir, messages: [`内容目录不存在：${dir}`] });
      continue;
    }

    for (const file of files.sort()) {
      const raw = await readFile(file, 'utf8');
      const relativePath = toPosix(relative(absDir, file));
      const parsed = parseFrontmatter(raw);
      if (parsed.lenient) {
        warnings.push({
          file: `${dir}/${relativePath}`,
          messages: ['frontmatter 不是合法 YAML，已按宽松模式逐行读取'],
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
      const rendered = renderMarkdown(md, parsed.content, { lang, config });

      pages.push({
        lang,
        slug,
        file,
        relativePath,
        data,
        html: rendered.html,
        headings: rendered.headings,
        links: rendered.links,
        hints: rendered.hints,
        sources: rendered.sources,
        url: pageUrl(config, lang, slug),
        outputPath: outputPathFor(config, lang, slug),
        draft: data.draft,
      });
    }
  }

  return { pages, problems, warnings };
}

/** 文件名（不含扩展名），用于提示「你可能想要的是 xxx」 */
export function suggestSlug(file: string): string {
  return basename(file).replace(/\.md$/, '');
}
