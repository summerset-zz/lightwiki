import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import type { LoadedConfig } from './config.js';
import type { PageInfo, SiteInfo } from './context.js';
import type { Highlighter } from './highlight.js';
import type { MacroRegistry } from './macros.js';
import type { LinkResolver } from './resolve.js';
import { pageLinkKey } from './links.js';
import { assetHref, localizeHref, pageBase } from './routes.js';

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
   * 全站所有页面的 URL（含 basePath 与 urlPrefix，不带尾斜杠）。
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
  /**
   * 站点插件的出口：每页新开一个空对象，插件在 core rule 里往里写什么都可以。
   * 渲染完会挂到 `it.page.meta`，也会进 `lightwiki-page-data`。
   */
  data?: Record<string, unknown>;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
  links: LinkRef[];
  /** 站点插件写进 `env.data` 的东西，原样交给布局 */
  data: Record<string, unknown>;
}

export interface MarkdownOptions {
  /** 代码块高亮；不传则原样输出 */
  highlight?: Highlighter;
  /**
   * 站点级插件入口，拿到的是 markdown-it 实例。
   *
   * 想输出结构化数据的插件写 `state.env.data`（每页一个新对象），
   * 渲染完会作为 `it.page.meta` 交给布局。写到 `env.data` 里的东西
   * 不需要清理 —— 每页重新初始化。
   */
  setup?: (md: unknown) => void;
}

export function createMarkdown(options: MarkdownOptions = {}): MarkdownIt {
  const highlighter = options.highlight;
  const md = new MarkdownIt({
    html: true,
    // 不开 linkify：它会用模糊匹配把裸写的文件名当域名，`index.md` 的 `.md`
    // 是摩尔多瓦的顶级域名，结果补成 `http://index.md/`。要链接就写
    // `[文字](地址)` 或 `<https://…>`，两者都由 CommonMark 原生支持。
    linkify: false,
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
                : localizeHref(href, env.config, (slug) =>
                    env.resolver ? env.resolver.hasSlug(slug) : false,
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

  // 显式锚点的标题末尾挂一个悬停可见的 `#`，点了把 `#id` 写进地址栏。
  // 只处理写了 `{#...}` 的标题 —— 没写 id 的标题本来就没有稳定地址，挂上去也没意义。
  // 用 html_inline 追加到 inline 的 children 里，所以 `collectHeadings` 的取文不受影响。
  md.core.ruler.push('lightwiki:heading-anchor', (state: any) => {
    const tokens = asTokens(state.tokens);
    for (let i = 0; i < tokens.length; i += 1) {
      const open = tokens[i];
      if (!open || open.type !== 'heading_open') continue;
      const id = open.attrGet('id');
      if (!id) continue;
      const inline = tokens[i + 1];
      if (!inline || inline.type !== 'inline') continue;

      const link = new state.Token('html_inline', '', 0);
      link.content =
        `<a class="header-anchor" href="#${escapeHtml(id)}" aria-hidden="true">#</a>`;
      (inline.children ??= []).push(link);
    }
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
  const resolved = env.resolver?.resolve(pagePart) ?? null;

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
 * 传进来的 `href` 应该已经过 `localizeHref()`，否则写了两遍 `urlPrefix` 的页面会把
 * `/a` 与 `/zh/a` 当成两个不同的东西。
 *
 * 相对路径也在这里判：基准是**当前页的 URL**（`it.page.url`），与浏览器一致。
 * 判不出来（file 模式、没有 pageInfo）时 `pageLinkKey()` 返回 null，不算红链。
 */
function isRedLink(href: string, env: RenderEnv): boolean {
  const known = env.knownUrls;
  if (!known) return false;
  // 与 `buildLinkReport` 共用同一份判据：资源、分类页、外链都不算页面
  const key = pageLinkKey(href, env.config, env.pageInfo?.url);
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

/**
 * 块级 HTML 容器。只认 `<div>`：它在正文里最常用，配对规则也简单。
 */
const DIV_TAG_RE = /<div\b([^>]*)>|<\/div\s*>/gi;

/**
 * 按出现顺序啃一块 HTML，维护 div 栈。
 *
 * 入栈的是「这个 div 带不带 `data-no-toc`」。带标记的容器里，标题照常渲染，
 * 但不进「本页」目录 —— 示例里演示的标题不该出现在目录里，何况不写 `{#}`
 * 时那个 id 只是按序号编的，点了也跳不过去。
 */
function trackDivs(html: string, stack: boolean[]): void {
  for (const match of html.matchAll(DIV_TAG_RE)) {
    if (match[1] === undefined) {
      stack.pop();
      continue;
    }
    stack.push(/\bdata-no-toc\b/i.test(match[1]));
  }
}

function collectHeadings(tokens: MdToken[]): Heading[] {
  const out: Heading[] = [];
  /** 当前所在的 div：true 表示带 `data-no-toc` */
  const containers: boolean[] = [];
  // 编号按「第几个标题」算，与是否进了目录无关，跳过示例标题不会让后面的 id 整体前移
  let seen = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t) continue;
    if (t.type === 'html_block') {
      trackDivs(t.content, containers);
      continue;
    }
    if (t.type !== 'heading_open') continue;
    seen += 1;
    if (containers.includes(true)) continue;
    const level = Number(t.tag.slice(1));
    const id = t.attrGet('id') ?? `h${level}-${seen}`;
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
  // 每页一个新对象：站点插件（`options.setup` 注册的规则）往里写结构化数据，
  // 渲染完原样交给布局的 `it.page.meta`。核心不规定里面有什么。
  env.data = {};
  const raw = md.parse(src, env);
  const tokens = asTokens(raw);
  const headings = collectHeadings(tokens);
  const links = collectLinks(tokens);
  const html = md.renderer.render(raw, md.options, env);
  return { html, headings, links, data: env.data };
}
