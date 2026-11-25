import type { Highlighter } from './highlight.js';

/**
 * 皮肤里手写代码块的高亮。
 *
 * markdown 正文里的围栏由 markdown-it 处理；但 `layouts/*.eta` 产出的是**最终 HTML**，
 * 不经过 markdown 解析器，`<pre><code>` 会被原样写进产物。这里把这一步补上：
 * 带 `lang` 属性的 `<pre>` / `<code>` 交给同一个 highlighter 染色。
 *
 * 约定：
 * - `lang` 写在 `<code>` 上优先于 `<pre>`；取值与围栏的语言名一致（`js` / `ts` / `eta`…）。
 * - 内容要按 HTML 转义写（`&lt;` 而不是 `<`），否则浏览器先把它当标签解析掉了。
 * - 已经带 `hljs-` 的块跳过，所以同一份 HTML 过两遍不会二次染色。
 * - 语言不认识、或高亮被配置关掉时原样保留，只把语言名报给调用方。
 *
 * 为什么是后处理而不是给皮肤一个 `it.highlight()`：皮肤可能是用户自己覆盖的，
 * 他们没法在所有地方记得调它；属性驱动的话，写 HTML 的时候顺手加一个属性就够了，
 * 而且和 `inline` / 相对化 / 搜索索引共用同一个出口。
 */

const PRE_RE = /<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi;
/** 整个 `<pre>` 里只包了一个 `<code>` 时，取它的属性与内容 */
const CODE_WRAP_RE = /^\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*$/i;
const LANG_ATTR_RE = /(?:^|\s)lang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const CLASS_ATTR_RE = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

function langOf(attrs: string): string {
  const match = LANG_ATTR_RE.exec(attrs);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '').trim().toLowerCase() : '';
}

/**
 * 解实体。`&amp;` 必须最后解 —— 否则 `&amp;lt;` 会先变成 `&lt;`，再被当成 `<`。
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 给 `<code>` 补上 `language-x`，跟 markdown-it 的输出保持一致（CSS 只认这个类） */
function withLanguageClass(attrs: string, lang: string): string {
  const want = `language-${lang}`;
  const match = CLASS_ATTR_RE.exec(attrs);
  if (!match) return `${attrs} class="${want}"`;

  const current = (match[1] ?? match[2] ?? match[3] ?? '').split(/\s+/).filter(Boolean);
  if (current.includes(want)) return attrs;
  current.push(want);

  // 正则吃掉了 class 前面那个空白，重建时要补回去
  const sep = /^\s/.test(match[0]) ? match[0][0] : '';
  return `${attrs.slice(0, match.index)}${sep}class="${current.join(' ')}"${attrs.slice(match.index + match[0].length)}`;
}

/**
 * markdown 块里的模板调用 `{{…}}` 不是 markdown 语法，hljs 不认识，会原样留成白字。
 *
 * 在已经染好的 HTML 上把调用拆成几段，按「标点 / 函数名 / 字符串 / 属性」上色，
 * 复用主题现成的 `.hljs-*` 规则：
 *
 * - `{{` `}}` → `hljs-meta`（灰）
 * - 模板名 → `hljs-title function_`（蓝，和函数名同色）
 * - 位置参数 → `hljs-string`（绿）
 * - 命名参数的键 → `hljs-attr`（橙），值仍是 `hljs-string`
 *
 * 原文里除了 `,` 之外的分隔符与换行都原样保留，所以多行调用还是多行。
 *
 * 两个兜底：匹配里已经含 `<span>` 的跳过（hljs 在里面插了标记，硬拆会把标记拆坏）；
 * 形状认不出的调用整体包成一段 `hljs-template-tag`，至少和普通正文区分开。
 */
const MACRO_CALL_RE = /\{\{[\s\S]{0,400}?\}\}/g;
/** `{{` + 名字 + 可选的一对括号 + `}}`，两头必须对齐 */
const MACRO_SHAPE_RE = /^(\{\{)\s*([A-Za-z][A-Za-z0-9_.-]*)\s*(?:\(([\s\S]*)\)\s*)?(\}\})$/;
/** `键: 值` 的键只认 ASCII 标识符，避免把 URL 之类当成命名参数 */
const NAMED_ARG_RE = /^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*([\s\S]*)$/;

/** 和 hljs 一样的转义；调用里出现的 `<` 必须转义后才能当文本输出 */
function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function highlighted(cls: string, text: string): string {
  return `<span class="${cls}">${escapeText(text)}</span>`;
}

/** 把参数按顶层逗号切开；引号与反引号里的逗号不算分隔符 */
function renderArgs(source: string): string {
  const out: string[] = [];
  let buffer = '';
  let quote = '';

  const flush = (): void => {
    if (!buffer) return;
    const arg = buffer;
    buffer = '';

    // 逗号两侧的空白留在 span 外面，免得颜色块把空格也吃掉
    const core = arg.trim();
    if (!core) {
      out.push(escapeText(arg));
      return;
    }
    const at = arg.indexOf(core);
    const lead = escapeText(arg.slice(0, at));
    const trail = escapeText(arg.slice(at + core.length));

    const named = NAMED_ARG_RE.exec(core);
    out.push(
      lead +
        (named
          ? `${highlighted('hljs-attr', named[1] ?? '')}${escapeText(': ')}${highlighted('hljs-string', named[2] ?? '')}`
          : highlighted('hljs-string', core)) +
        trail,
    );
  };

  for (const ch of source) {
    if (quote) {
      buffer += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      buffer += ch;
      continue;
    }
    if (ch === ',') {
      flush();
      out.push(escapeText(','));
      continue;
    }
    buffer += ch;
  }
  flush();

  return out.join('');
}

function renderMacroCall(raw: string): string {
  const shape = MACRO_SHAPE_RE.exec(raw);
  if (!shape) return highlighted('hljs-template-tag', raw);

  const [, open = '{{', name = '', args, close = '}}'] = shape;
  return [
    highlighted('hljs-meta', open),
    highlighted('hljs-title function_', name),
    args === undefined ? '' : `${escapeText('(')}${renderArgs(args)}${escapeText(')')}`,
    highlighted('hljs-meta', close),
  ].join('');
}

function colorMacroCalls(html: string): string {
  return html.replace(MACRO_CALL_RE, (match) =>
    match.includes('<span') ? match : renderMacroCall(decodeEntities(match)),
  );
}

/**
 * `---` 开头的 markdown：frontmatter 段按 YAML 染，其余按 markdown 染。
 *
 * highlight.js 的 markdown 语法不认识 frontmatter —— 它会把第二、三个 `---`
 * 当成 setext 标题（第一个 `---` 又什么都没染）。整段改用 `yaml` 也不行：
 * 正文会被当成一串字符串。所以切开各染各的，拼回去。
 */
function highlightFrontmatterDoc(source: string, highlighter: Highlighter): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/.exec(source);
  if (!match) return null;

  const head = highlighter.highlight(match[0], 'yaml');
  if (head === null) return null;

  const body = source.slice(match[0].length);
  if (!body.trim()) return head;

  const rest = highlighter.highlight(body, 'markdown');
  return rest === null ? null : head + rest;
}

export interface CodeBlockResult {
  html: string;
  /** 真正染了色的块数 */
  highlighted: number;
  /** 写了 `lang` 但 highlighter 不认识的（含高亮被关闭），去重后的语言名 */
  unknown: string[];
}

export function highlightCodeBlocks(
  html: string,
  highlighter: Highlighter | undefined,
): CodeBlockResult {
  if (!highlighter || !highlighter.enabled) return { html, highlighted: 0, unknown: [] };

  let highlighted = 0;
  const unknown: string[] = [];

  const out = html.replace(PRE_RE, (whole, preAttrs: string, inner: string) => {
    const wrapped = CODE_WRAP_RE.exec(inner);
    const codeAttrs = wrapped ? (wrapped[1] ?? '') : '';
    const source = wrapped ? (wrapped[2] ?? '') : inner;
    const lang = langOf(codeAttrs) || langOf(preAttrs);
    if (!lang) return whole;
    // 已经染过（比如 markdown 那一遍刚生成的）就别再走一次
    if (source.includes('hljs-')) return whole;

    const text = decodeEntities(source);
    let value: string | null;
    if (lang === 'markdown' || lang === 'md') {
      value = highlightFrontmatterDoc(text, highlighter) ?? highlighter.highlight(text, lang);
      if (value !== null) value = colorMacroCalls(value);
    } else {
      value = highlighter.highlight(text, lang);
    }
    if (value === null) {
      if (!unknown.includes(lang)) unknown.push(lang);
      return whole;
    }

    highlighted += 1;
    return `<pre${preAttrs}><code${withLanguageClass(codeAttrs, lang)}>${value}</code></pre>`;
  });

  return { html: out, highlighted, unknown };
}
