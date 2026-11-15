import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import type { LoadedConfig } from './config.js';
import type { MacroContext, MacroRegistry } from './macros.js';
import type { LinkResolver } from './resolve.js';
import { assetHref, localizeHref } from './routes.js';

/**
 * 只声明我们真正用到的 token 字段。
 * @types/markdown-it 用 `export =` 导出，命名空间取不到 Token，
 * 与其和历史包袱搏斗，不如绑一个我们自己的最小契约。
 */
interface MdToken {
  type: string;
  tag: string;
  content: string;
  children: MdToken[] | null;
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
}

function asTokens(tokens: unknown): MdToken[] {
  return tokens as MdToken[];
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface LinkRef {
  href: string;
  external: boolean;
}

/** 术语提示：`<!-- hint: 标题 | 一句话 -->` */
export interface Hint {
  title: string;
  body: string;
  /** 归属到它上方最近的带锚点标题；文件开头则为 null */
  anchor: string | null;
}

/** 小节来源：`<!-- source: 站点 | 标题 | 修订号 | 许可证 | 许可证地址 | 改动 -->` */
export interface SectionSource {
  site: string;
  title: string;
  revid: string;
  license: string;
  licenseUrl: string;
  changes: string;
  anchor: string | null;
}

export interface UnresolvedRef {
  kind: 'wikilink' | 'macro';
  target: string;
  message: string;
}

export interface RenderEnv {
  lang: string;
  config: LoadedConfig;
  /** 内链解析器（`[[...]]`） */
  resolver?: LinkResolver;
  /** 宏注册表（`{{...}}`） */
  macros?: MacroRegistry;
  /** 当前页 frontmatter，供宏使用 */
  pageMeta?: Record<string, unknown>;
  /** 站点信息，供宏使用 */
  siteMeta?: Record<string, unknown>;
  /** 渲染期收集：未解析的内链与未定义的宏 */
  unresolved?: UnresolvedRef[];
  /** 渲染期收集：宏登记的分类 */
  categories?: Set<string>;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
  links: LinkRef[];
  hints: Hint[];
  sources: SectionSource[];
}

const HEADING_RE = /^(#{2,6})\s+(.*?)(?:\s*\{#([^}]+)\})?\s*$/;
const HINT_RE = /<!--\s*hint:\s*([\s\S]*?)-->/i;
const SOURCE_RE = /<!--\s*source:\s*([\s\S]*?)-->/i;

/** 按 | 切 n 刀，多的部分留在最后一段（改动说明里可以再出现 |） */
function splitPipes(raw: string, cuts: number): string[] {
  const parts: string[] = [];
  let rest = raw;
  for (let i = 0; i < cuts; i += 1) {
    const idx = rest.indexOf('|');
    if (idx === -1) break;
    parts.push(rest.slice(0, idx).trim());
    rest = rest.slice(idx + 1);
  }
  parts.push(rest.trim());
  return parts;
}

/**
 * 剥掉正文里的两个指令注释，并把它们结构化。
 *
 * 它们不会出现在产物里：`hint` 变成术语弹窗的数据，`source` 变成小节末尾的署名块。
 * 归属规则是「它上方最近的那个带锚点标题」，所以位置不必严格，但放在标题下面最稳。
 */
export function extractDirectives(src: string): {
  markdown: string;
  hints: Hint[];
  sources: SectionSource[];
} {
  const lines = src.split(/\r?\n/);
  const kept: string[] = [];
  const hints: Hint[] = [];
  const sources: SectionSource[] = [];
  let anchor: string | null = null;

  for (const line of lines) {
    const heading = HEADING_RE.exec(line);
    if (heading && heading[1]) anchor = heading[3]?.trim() ?? anchor;

    const hint = HINT_RE.exec(line);
    if (hint?.[1]) {
      const [title = '', body = ''] = splitPipes(hint[1], 1);
      hints.push({ title, body, anchor });
      continue;
    }

    const source = SOURCE_RE.exec(line);
    if (source?.[1]) {
      const [site = '', title = '', revid = '', license = '', licenseUrl = '', changes = ''] =
        splitPipes(source[1], 5);
      sources.push({ site, title, revid, license, licenseUrl, changes, anchor });
      continue;
    }

    kept.push(line);
  }

  return { markdown: kept.join('\n'), hints, sources };
}

export function createMarkdown(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  });
  md.use(attrs);

  // 两条自定义 inline 规则。必须在 `link` 之前注册，否则 `[[a|b]]` 会被当成普通链接吃掉。
  // state 的类型拿不到（@types/markdown-it 用 export = 导出），所以参数用 any。
  md.inline.ruler.before('link', 'lightwiki:wikilink', wikilinkRule);
  md.inline.ruler.before('link', 'lightwiki:macro', macroRule);
  // 整行只有一个宏时走块级，否则 `<div>` 会被包进 `<p>`
  md.block.ruler.before('paragraph', 'lightwiki:macro-block', macroBlockRule);

  // 站内链接按语言与 basePath 改写，外链统一加 nofollow。
  // 放在 core ruler 里做，而不是渲染后正则替换 —— token 结构是可靠的。
  // 注意：link_open / image 都在 inline 的 children 里，必须递归，否则静默不生效。
  md.core.ruler.push('lightwiki:urls', (state) => {
    const env = state.env as RenderEnv;
    const siteHost = safeHost(env.config.siteUrl);

    const walk = (tokens: MdToken[]): void => {
      for (const token of tokens) {
        if (token.type === 'link_open') {
          const href = token.attrGet('href');
          if (href) {
            const isExternal = /^https?:\/\//i.test(href);
            token.attrSet('href', isExternal ? href : localizeHref(href, env.lang, env.config));
            if (isExternal) {
              token.attrSet('rel', 'nofollow noopener');
              if (safeHost(href) !== siteHost) token.attrSet('target', '_blank');
            }
          }
        } else if (token.type === 'image') {
          const src = token.attrGet('src');
          if (src) token.attrSet('src', assetHref(src, env.config));
        }
        if (token.children) walk(token.children);
      }
    };

    walk(asTokens(state.tokens));
  });

  return md;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const WIKILINK_RE = /^\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/;

/**
 * `[[目标]]` 与 `[[目标|显示文字]]`。
 *
 * 目标是 slug 或页面标题，由 LinkResolver 决定先后（先 slug 再标题）。
 * 找不到时输出一个带 `wikilink-missing` 类的占位，**不是链接** ——
 * 这样它不会污染链接图，也不会在 check 里被误计为红链（它会被单独报告）。
 */
function wikilinkRule(state: any, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x5b || state.src.charCodeAt(state.pos + 1) !== 0x5b) {
    return false;
  }

  const rest: string = state.src.slice(state.pos);
  const match = WIKILINK_RE.exec(rest);
  if (!match) return false;

  const total = match[0].length;
  if (silent) {
    state.pos += total;
    return true;
  }

  const rawTarget = (match[1] ?? '').trim();
  const label = (match[2] ?? '').trim() || rawTarget;
  const hashAt = rawTarget.indexOf('#');
  const pagePart = hashAt === -1 ? rawTarget : rawTarget.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : rawTarget.slice(hashAt);

  const env = state.env as RenderEnv;
  const resolved = env.resolver?.resolve(pagePart, env.lang) ?? null;

  if (resolved) {
    const open = state.push('link_open', 'a', 1);
    open.attrSet('href', `${resolved.url}${hash}`);
    open.attrSet('data-link-via', resolved.via);
    const text = state.push('text', '', 0);
    text.content = label;
    state.push('link_close', 'a', -1);
  } else {
    (env.unresolved ??= []).push({
      kind: 'wikilink',
      target: rawTarget,
      message: env.resolver ? '找不到对应页面（slug 与标题都没有命中）' : '内链解析器未启用',
    });
    const span = state.push('html_inline', '', 0);
    span.content = `<span class="wikilink-missing" title="未找到：${escapeHtml(rawTarget)}">${escapeHtml(label)}</span>`;
  }

  state.pos += total;
  return true;
}

const MACRO_HEAD_RE = /^\{\{\s*([A-Za-z][A-Za-z0-9_.-]*)/;

interface ParsedMacro {
  name: string;
  args: Array<string | number>;
  named: Record<string, string>;
  length: number;
}

/** 从字符串开头解析一个完整宏调用；`{{` 之后必须能在同一段内闭合 */
function parseMacroCall(src: string): ParsedMacro | null {
  const head = MACRO_HEAD_RE.exec(src);
  if (!head || !head[1]) return null;

  const name = head[1];
  let cursor = head[0].length;
  let args: Array<string | number> = [];
  let named: Record<string, string> = {};

  if (src[cursor] === '(') {
    const parsed = parseMacroArgs(src, cursor);
    if (!parsed) return null;
    args = parsed.args;
    named = parsed.named;
    cursor = parsed.end;
  }

  if (!src.startsWith('}}', cursor)) return null;
  return { name, args, named, length: cursor + 2 };
}

/** 渲染宏；失败返回 null，并把原因记进 env.unresolved */
function renderMacro(
  env: RenderEnv,
  name: string,
  args: Array<string | number>,
  named: Record<string, string>,
): string | null {
  const registry = env.macros;
  if (!registry || !registry.has(name)) {
    (env.unresolved ??= []).push({
      kind: 'macro',
      target: name,
      message: registry ? `未定义的宏：${name}` : '宏未启用',
    });
    return null;
  }

  const context: MacroContext = {
    args,
    named,
    page: env.pageMeta ?? {},
    site: env.siteMeta ?? {},
    lang: env.lang,
    addCategory: (category: string) => {
      (env.categories ??= new Set<string>()).add(category);
    },
  };

  try {
    return registry.render(name, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    (env.unresolved ??= []).push({ kind: 'macro', target: name, message });
    return null;
  }
}

/**
 * `{{名字}}` / `{{名字(参数, "参数")}}` / ``{{名字(`原样`)}}``（行内形态）。
 *
 * MDN 的宏有三种形态：无参的 `{{Specifications}}`、位置参数的
 * `{{glossary("a", "b")}}`、反引号原样字符串的 ``{{CSSSyntaxRaw(`x = y`)}}``。
 * 命名参数写成 `键: 值`，会解析但 v1 不强制使用。
 */
function macroRule(state: any, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x7b || state.src.charCodeAt(state.pos + 1) !== 0x7b) {
    return false;
  }

  const rest: string = state.src.slice(state.pos);
  const call = parseMacroCall(rest);
  if (!call) return false;

  if (silent) {
    state.pos += call.length;
    return true;
  }

  const env = state.env as RenderEnv;
  const html = renderMacro(env, call.name, call.args, call.named);

  if (html === null) {
    const text = state.push('text', '', 0);
    text.content = rest.slice(0, call.length);
  } else {
    const token = state.push('html_inline', '', 0);
    token.content = html;
  }

  state.pos += call.length;
  return true;
}

/**
 * 整行只有一个宏时走块级，避免 `<div>` 被塞进 `<p>`。
 * 这也是 `{{Specifications}}` / `{{Compat}}` 这类会生成表格的宏的正确形态。
 */
function macroBlockRule(state: any, startLine: number, _endLine: number, silent: boolean): boolean {
  const begin = state.bMarks[startLine] + state.tShift[startLine];
  const end = state.eMarks[startLine];
  const line: string = state.src.slice(begin, end).trim();

  if (!line.startsWith('{{')) return false;

  const call = parseMacroCall(line);
  if (!call || call.length !== line.length) return false;

  if (silent) return true;

  const env = state.env as RenderEnv;
  // 未定义的宏交给段落 + 行内规则去处理，这样错误信息与行内形态一致
  if (!env.macros || !env.macros.has(call.name)) return false;

  const html = renderMacro(env, call.name, call.args, call.named);
  if (html === null) return false;

  const token = state.push('html_block', '', 0);
  token.map = [startLine, startLine + 1];
  token.content = html;
  state.line = startLine + 1;
  return true;
}

interface ParsedArgs {
  args: Array<string | number>;
  named: Record<string, string>;
  /** `)` 之后的位置 */
  end: number;
}

/** 从 `(` 开始找配对的 `)`，跳过引号与反引号内部 */
function findClosingParen(src: string, openAt: number): number {
  let depth = 0;
  for (let i = openAt; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '"' || ch === '`' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\' && quote === '"') i += 1;
        i += 1;
      }
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseMacroArgs(src: string, openAt: number): ParsedArgs | null {
  const closeAt = findClosingParen(src, openAt);
  if (closeAt === -1) return null;

  const inner = src.slice(openAt + 1, closeAt);
  const args: Array<string | number> = [];
  const named: Record<string, string> = {};

  let token = '';
  let quote: string | null = null;

  const flush = (): void => {
    const piece = token.trim();
    token = '';
    if (!piece) return;

    const namedMatch = /^([A-Za-z_][\w-]*)\s*:\s*([\s\S]*)$/.exec(piece);
    if (namedMatch && namedMatch[1]) {
      named[namedMatch[1]] = unquote(namedMatch[2] ?? '');
      return;
    }
    args.push(coerceArg(piece));
  };

  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i] ?? '';
    if (quote) {
      if (ch === '\\' && quote === '"') {
        token += ch + (inner[i + 1] ?? '');
        i += 1;
        continue;
      }
      token += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '`' || ch === "'") {
      quote = ch;
      token += ch;
      continue;
    }
    if (ch === ',') {
      flush();
      continue;
    }
    token += ch;
  }
  flush();

  return { args, named, end: closeAt + 1 };
}

function unquote(input: string): string {
  const value = input.trim();
  const quoted = /^(["'`])([\s\S]*)\1$/.exec(value);
  if (!quoted) return value;
  const body = quoted[2] ?? '';
  return quoted[1] === '"' ? body.replace(/\\"/g, '"') : body;
}

function coerceArg(piece: string): string | number {
  const unquoted = unquote(piece);
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted);
  return unquoted;
}

function inlineText(token: MdToken | undefined): string {
  if (!token) return '';
  if (token.type !== 'inline') return '';
  const children = token.children ?? [];
  return children.map((child) => (child.type === 'text' || child.type === 'code_inline' ? child.content : '')).join('');
}

function collectHeadings(tokens: MdToken[]): Heading[] {
  const out: Heading[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t || t.type !== 'heading_open') continue;
    const level = Number(t.tag.slice(1));
    const id = t.attrGet('id') ?? `h${level}-${out.length + 1}`;
    out.push({ level, text: inlineText(tokens[i + 1]), id });
  }
  return out;
}

function collectLinks(tokens: MdToken[]): LinkRef[] {
  const out: LinkRef[] = [];
  for (const token of tokens) {
    if (token.type !== 'inline') continue;
    for (const child of token.children ?? []) {
      if (child.type !== 'link_open') continue;
      const href = child.attrGet('href');
      if (!href) continue;
      const external = /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:');
      out.push({ href, external });
    }
  }
  return out;
}

export function renderMarkdown(
  md: MarkdownIt,
  src: string,
  env: RenderEnv,
): RenderResult {
  const { markdown, hints, sources } = extractDirectives(src);
  const raw = md.parse(markdown, env);
  const tokens = asTokens(raw);
  const headings = collectHeadings(tokens);
  const links = collectLinks(tokens);
  const html = md.renderer.render(raw, md.options, env);
  return { html, headings, links, hints, sources };
}
