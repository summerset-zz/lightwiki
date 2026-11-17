import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import type { LoadedConfig } from './config.js';
import type { PageInfo, SiteInfo } from './context.js';
import type { Highlighter } from './highlight.js';
import type { MacroRegistry } from './macros.js';
import type { LinkResolver } from './resolve.js';
import { pageLinkKey } from './links.js';
import { assetHref, langPrefix, localizeHref, pageBase } from './routes.js';

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
  attrJoin(name: string, value: string): void;
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
  /** 只是一个尚未定义的宏（区别于循环引用、模板抛错这类真错误） */
  undefinedMacro?: boolean;
}

export interface RenderEnv {
  lang: string;
  config: LoadedConfig;
  /** 内链解析器（`[[...]]`） */
  resolver?: LinkResolver;
  /** 宏注册表（`{{...}}`） */
  macros?: MacroRegistry;
  /** 当前页信息，即宏里的 `it.page` */
  pageInfo?: PageInfo;
  /** 全站信息，即宏里的 `it.site` */
  siteInfo?: SiteInfo;
  /**
   * 全站所有页面的 URL（含 basePath、语言前缀，不带尾斜杠）。
   * 判定红链用：链接指向的地址不在这张表里，就是还没写的页面。
   */
  knownUrls?: Set<string>;
  /** 渲染期收集：未解析的内链与未定义的宏 */
  unresolved?: UnresolvedRef[];
  /** 渲染期收集：宏登记的分类 */
  categories?: Set<string>;
  /**
   * 宏展开栈。跨「递归解析」传递，否则 A 展开出 `{{A}}` 时会无限循环。
   */
  macroStack?: string[];
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

export interface MarkdownOptions {
  /** 代码块高亮；不传则原样输出 */
  highlight?: Highlighter;
  /** 站点级插件入口，拿到的是 markdown-it 实例 */
  setup?: (md: unknown) => void;
}

export function createMarkdown(options: MarkdownOptions = {}): MarkdownIt {
  const highlighter = options.highlight;
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    highlight:
      highlighter && highlighter.enabled
        ? (code: string, lang: string): string => highlighter.highlight(code, lang) ?? ''
        : undefined,
  });
  md.use(attrs);

  // 两条自定义 inline 规则。必须在 `link` 之前注册，否则 `[[a|b]]` 会被当成普通链接吃掉。
  // state 的类型拿不到（@types/markdown-it 用 export = 导出），所以参数用 any。
  md.inline.ruler.before('link', 'lightwiki:wikilink', wikilinkRule);
  md.inline.ruler.before('link', 'lightwiki:macro', macroRule);
  // 整行只有一个宏时走块级，否则 `<div>` 会被包进 `<p>`
  md.block.ruler.before('paragraph', 'lightwiki:macro-block', macroBlockRule);

  // 站点自己的插件放在最后注册，方便覆盖或追加规则
  options.setup?.(md);

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
            token.attrSet(
              'href',
              isExternal
                ? href
                : localizeHref(href, env.lang, env.config, (slug) =>
                    env.resolver ? env.resolver.hasSlug(slug, env.lang) : false,
                  ),
            );
            if (isExternal) {
              token.attrSet('rel', 'nofollow noopener');
              if (safeHost(href) !== siteHost) token.attrSet('target', '_blank');
            } else if (isRedLink(href, env)) {
              // 指向还不存在的页面：标成红链，样式交给主题（同 MediaWiki 的 `.new`）
              token.attrJoin('class', 'redlink');
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

  // 站点自己的插件放在最后注册，方便覆盖或追加规则
  options.setup?.(md);

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
      message: env.resolver ? 'no matching page (neither slug nor title hit)' : 'wikilink resolver not enabled',
    });
    const span = state.push('html_inline', '', 0);
    span.content = `<span class="wikilink-missing" title="not found: ${escapeHtml(rawTarget)}">${escapeHtml(label)}</span>`;
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

/** 宏展开嵌套上限：宏是手工组合的，正常不会深过个位数 */
const MAX_MACRO_DEPTH = 20;

/**
 * 这条站内链接是不是「红链」—— 指向一个还不存在的页面。
 *
 * 判据是**真实 URL 集合**（构建时所有页面地址都已知），而不是猜前缀：从别处搬来的
 * 内容常留着原站的路径（`/credits/maker/google`），它们同样该被点名。
 * 资源、分类页、带扩展名的路径一律不算。
 *
 * 传进来的 `href` 应该已经过 `localizeHref()`，否则非默认语言的页面会把
 * `/docs/x` 与 `/zh/docs/x` 当成两个不同的东西。
 */
function isRedLink(href: string, env: RenderEnv): boolean {
  const known = env.knownUrls;
  if (!known) return false;
  // 与 `buildLinkReport` 共用同一份判据：资源、分类页、外链都不算页面
  const key = pageLinkKey(href, env.config);
  if (key === null) return false;
  return !known.has(key);
}

function recordUnresolved(
  env: RenderEnv,
  target: string,
  message: string,
  undefinedMacro = false,
): void {
  (env.unresolved ??= []).push({ kind: 'macro', target, message, undefinedMacro });
}

/**
 * 未定义的宏在产物里留下什么。
 *
 * - `show`（默认）：保留原文，一眼能看出漏了什么
 * - `hide`：留空
 * - 函数：自己决定（返回值当纯文本插入，不会再走一遍 markdown 解析）
 *
 * 三种都在 `build` / `check` 里报提示 —— 沉默才是问题，不是花括号。
 */
function undefinedMacroText(env: RenderEnv, name: string, raw: string): string | null {
  const mode = env.config.macros?.undefined ?? 'show';
  if (mode === 'hide') return null;
  if (typeof mode === 'function') {
    try {
      return mode(name, raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** 宏展开失败时，把原文作为已转义的段落留在产物里 */
function emitRawBlock(state: any, startLine: number, line: string): void {
  const token = state.push('html_block', '', 0);
  token.map = [startLine, startLine + 1];
  token.content = `<p>${escapeHtml(line)}</p>`;
}

/**
 * 展开一个宏，返回要插回文本流的 markdown。
 *
 * 这里刻意**返回文本**而不是 HTML token：模板写的是 wikitext/markdown，
 * 展开后要跟页面其它部分一样过一遍解析器（这就是 MediaWiki 的心智模型）。
 * 代价是宏作者要像写正文那样注意 `*` `_` `[` 这些字符 —— 与 MediaWiki 一致。
 */
function expandMacro(
  env: RenderEnv,
  name: string,
  args: Array<string | number>,
  named: Record<string, string>,
  onFailure: () => void,
): string | null {
  const registry = env.macros;
  if (!registry || !registry.has(name)) {
    recordUnresolved(env, name, registry ? `undefined macro: ${name}` : 'macros are not enabled', true);
    onFailure();
    return null;
  }

  const stack = (env.macroStack ??= []);
  const key = name.toLowerCase();

  if (stack.includes(key)) {
    recordUnresolved(env, name, `macro cycle: ${[...stack, key].join(' -> ')}`);
    onFailure();
    return null;
  }
  if (stack.length >= MAX_MACRO_DEPTH) {
    recordUnresolved(env, name, `macro nesting deeper than ${MAX_MACRO_DEPTH}: ${[...stack, key].join(' -> ')}`);
    onFailure();
    return null;
  }

  stack.push(key);
  try {
    const text = registry.render(name, {
      args,
      named,
      page: (env.pageInfo ?? {}) as PageInfo,
      site: (env.siteInfo ?? {}) as SiteInfo,
      lang: env.lang,
      addCategory: (category: string) => {
        (env.categories ??= new Set<string>()).add(category);
        // 立刻反映到 `it.page.categories`，宏里后续读取能看到自己刚加的分类
        const list = env.pageInfo?.categories;
        if (list && !list.includes(category)) list.push(category);
      },
    });
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordUnresolved(env, name, message);
    onFailure();
    return null;
  } finally {
    // 栈在「子解析」期间必须保留，由调用方决定何时 pop
    stack.pop();
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
  const raw = rest.slice(0, call.length);

  const text = expandMacro(env, call.name, call.args, call.named, () => {
    const fallback = undefinedMacroText(env, call.name, raw);
    if (fallback === null) return;
    const token = state.push('text', '', 0);
    token.content = fallback;
  });

  if (text !== null) {
    // 展开结果再走一遍行内解析：`**粗体**`、`[[双链]]`、内嵌的 `{{宏}}` 都会生效
    const stack = env.macroStack ?? [];
    stack.push(call.name.toLowerCase());
    try {
      state.md.inline.parse(text, state.md, state.env, state.tokens);
    } finally {
      stack.pop();
    }
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
  // 未定义的宏交给段落 + 行内规则处理，避免同一条错误被记两次
  if (!env.macros || !env.macros.has(call.name)) return false;

  const text = expandMacro(env, call.name, call.args, call.named, () => {
    emitRawBlock(state, startLine, line);
  });

  if (text === null) {
    state.line = startLine + 1;
    return true;
  }

  // 展开结果走块级解析：宏可以产出段落、列表、表格这些结构
  const stack = env.macroStack ?? [];
  stack.push(call.name.toLowerCase());
  try {
    state.md.block.parse(text, state.md, state.env, state.tokens);
  } finally {
    stack.pop();
  }

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
