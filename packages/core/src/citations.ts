import type MarkdownIt from 'markdown-it';

/**
 * 一条参考文献。
 *
 * 正文里的 `<ref>…</ref>` 只出一个上标，内容排到 `<references/>` 所在处；
 * 没写 `<references/>` 就排到正文末尾。行为对齐 MediaWiki 的 `<ref>` / `<references/>`。
 */
export interface Citation {
  /** 文档顺序的编号，从 1 开始；同名引用共用一个号 */
  number: number;
  /** 列表项的 id，正文上标的 `href` 指向它 */
  id: string;
  /** `<ref name="…">` 的名字；没写名字就没有这个字段 */
  name?: string;
  /** 正文里引用了几次（同名复用时 > 1） */
  count: number;
  /** 引用内容的 HTML。内链已按 basePath 改写、红链已标出 */
  html: string;
}

/** 渲染期在 `env` 上攒的内部状态；`Citation` 只是最后交出去的那一份 */
export interface CitationState {
  /** 按出现顺序记下的每一条 `<ref>`（含同名复用） */
  items?: CiteItem[];
  /** 去重后的笔记，按编号顺序，交给 `citations` 用 */
  records?: CiteItem[];
  /** 解析引用内容时的嵌套深度，用来挡掉 `<ref>` 套 `<ref>` */
  depth?: number;
  citations?: Citation[];
  /** 没配对上 `</ref>` 的标签：报给作者，别让它默默坏掉 */
  problems?: Set<string>;
}

const UNCLOSED_REF =
  '`<ref>` 与 `</ref>` 没在同一块内配对：标签会原样留在产物里。' +
  '检查是否漏写 `</ref>`，或引用内容跨了空行、列表、代码块、表格。';

/** 把渲染期记下的问题交给调用方（`content.ts` 会把它们转成 warning） */
export function citationProblems(env: unknown): string[] {
  return [...((env as CitationState).problems ?? [])];
}

interface CiteItem {
  name: string;
  raw: string;
  /** 内容解析出的行内 token：放进列表里渲染，内链改写与红链检测才能生效 */
  tokens: any[];
  /** 正文里的上标占位（`html_inline`），编号定了以后往里填 */
  token: any;
  /** 列表项里的那个 `inline` token，`renderInline` 用它取最终 HTML */
  inlineToken?: any;
  number: number;
  id: string;
  count: number;
}

/** `<ref>`、`<ref name="x">`、`<ref name="x" />`；`<reference>` 之类不匹配 */
const REF_HEAD_RE = /^<ref(\s[^>]*?)?(\/?)>/i;
const NAME_ATTR_RE = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
/** 插入区标记，必须单独一行（markdown-it 会把它收成一个 `html_block`） */
const REFERENCES_RE = /^<references\s*\/?>$/i;

/** 引用内容里不该出现的标签：嵌套 `<ref>` 不支持，摘掉比留一截坏 HTML 好 */
const INNER_REF_RE = /<ref\b[^>]*?\/?>|<\/ref\s*>/gi;

/**
 * 从 `from` 开始找与本条 `<ref>` 配对的 `</ref>`。
 *
 * 要数嵌套深度，否则 `<ref>a<ref>b</ref></ref>` 会在内层就断开，外面剩一个野 `</ref>`。
 */
function findRefClose(src: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const open = src.indexOf('<ref', i);
    const close = src.indexOf('</ref>', i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      if (REF_HEAD_RE.test(src.slice(open))) depth += 1;
      i = open + 4;
      continue;
    }
    if (depth === 0) return close;
    depth -= 1;
    i = close + '</ref>'.length;
  }
  return -1;
}

/**
 * 行内规则：认 `<ref>`，把内容摘出来留到列表里，原位置只放一个上标占位。
 *
 * 注册在 `html_inline` 之前 —— 否则 `<ref>` 会被当成普通 HTML 原样输出。
 */
export function citationRule(state: any, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x3c /* < */) return false;

  const env = state.env as CitationState;
  // 引用内容里面不再认 `<ref>`：嵌套引用编号说不清，内层当普通 HTML 处理
  if (env.depth) return false;

  const rest: string = state.src.slice(state.pos);
  const head = REF_HEAD_RE.exec(rest);
  if (!head) return false;

  const attrText = head[1] ?? '';
  const nameMatch = NAME_ATTR_RE.exec(attrText);
  const name = (nameMatch?.[1] ?? nameMatch?.[2] ?? nameMatch?.[3] ?? '').trim();
  const selfClosing = head[2] === '/';

  let content = '';
  let total = head[0].length;
  if (selfClosing) {
    // `<ref name="x" />` 是复用写法，不带内容；没有名字就既没内容也没号
    if (!name) return false;
  } else {
    const closeAt = findRefClose(rest, head[0].length);
    // 没闭合：留给 `html_inline` 原样输出，同时记一条，交给 check 报出来
    if (closeAt === -1) {
      (env.problems ??= new Set()).add(UNCLOSED_REF);
      return false;
    }
    // 嵌套不支持，内层的标签摘掉，只留文字
    content = rest.slice(head[0].length, closeAt).replace(INNER_REF_RE, '');
    total = closeAt + '</ref>'.length;
  }
  if (!content.trim() && !name) return false;

  if (silent) {
    state.pos += total;
    return true;
  }

  const tokens: any[] = [];
  if (content.trim()) {
    env.depth = (env.depth ?? 0) + 1;
    try {
      state.md.inline.parse(content, state.md, state.env, tokens);
    } finally {
      env.depth -= 1;
    }
  }

  const token = state.push('html_inline', '', 0);
  token.meta = { cite: true };
  (env.items ??= []).push({ name, raw: content, tokens, token, number: 0, id: '', count: 0 });

  state.pos += total;
  return true;
}

function htmlBlock(state: any, content: string): any {
  const token = new state.Token('html_block', '', 0);
  token.content = content;
  token.block = true;
  return token;
}

/** 夹在段落里的 `<references/>`（不是独立成块）没有位置可插，抹掉即可 */
function stripInlineMarkers(tokens: any[]): void {
  for (const token of tokens) {
    const children = token.children as any[] | null;
    if (!Array.isArray(children)) continue;
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i];
      if (child?.type === 'html_inline' && REFERENCES_RE.test(String(child.content).trim())) {
        children.splice(i, 1);
      }
    }
  }
}

/**
 * 核心规则一：编号 + 上标 + 列表落位。
 *
 * 必须排在 `lightwiki:urls` 之前 —— 列表里的内容要以行内 token 的形式进主 token 流，
 * 后面的内链改写才会顺手处理它们（basePath、红链、nofollow）。
 */
export function citationCoreRule(state: any): void {
  const env = state.env as CitationState;
  const tokens: any[] = state.tokens;
  const items = env.items ?? [];

  stripInlineMarkers(tokens);

  // 插入区：单独一行的 `<references/>`。找不到就排到正文末尾；写了多个只认第一个。
  const markers: number[] = [];
  tokens.forEach((token, index) => {
    if (token.type === 'html_block' && REFERENCES_RE.test(String(token.content).trim())) {
      markers.push(index);
    }
  });
  const markerAt = markers[0] ?? -1;
  // 先摘掉所有标记（从后往前，免得下标错位），再从第一个标记原来的位置插入列表
  for (const index of [...markers].reverse()) tokens.splice(index, 1);

  if (!items.length) {
    // 只留了个空标记：已经摘掉了，什么也不插
    return;
  }

  // 1) 编号：按首次出现，`name` 相同的共用一个号
  const byName = new Map<string, CiteItem>();
  const notes: CiteItem[] = [];
  for (const item of items) {
    const known = item.name ? byName.get(item.name) : undefined;
    if (known) {
      known.count += 1;
      // 首次写的是空的复用标签、后面才补内容时，用后面那条填上
      if (!known.raw.trim() && item.raw.trim()) {
        known.raw = item.raw;
        known.tokens = item.tokens;
      }
      item.number = known.number;
      item.id = known.id;
      continue;
    }
    if (item.name) byName.set(item.name, item);
    item.number = notes.length + 1;
    item.id = `cite-note-${item.number}`;
    item.count = 1;
    notes.push(item);
  }

  // 2) 正文占位换成上标。同一号出现多次时各有自己的 id，回链统一指向第一次的位置。
  const occurrence = new Map<number, number>();
  for (const item of items) {
    const nth = (occurrence.get(item.number) ?? 0) + 1;
    occurrence.set(item.number, nth);
    const anchorId = nth === 1 ? `cite-ref-${item.number}` : `cite-ref-${item.number}-${nth}`;
    item.token.content =
      `<sup class="cite" id="${anchorId}">` +
      `<a href="#${item.id}">${item.number}</a></sup>`;
  }

  // 3) 列表：`<section>` 外壳由核心给，样式交给主题
  const block: any[] = [htmlBlock(state, '<section class="citations">\n<ol>\n')];
  for (const note of notes) {
    block.push(
      htmlBlock(
        state,
        `<li id="${note.id}">` +
          `<a class="cite-back" href="#cite-ref-${note.number}" aria-label="back to reference">↑</a>`,
      ),
    );
    const inline = new state.Token('inline', '', 0);
    inline.children = note.tokens;
    inline.content = note.raw;
    block.push(inline);
    block.push(htmlBlock(state, '</li>\n'));
    note.inlineToken = inline;
  }
  block.push(htmlBlock(state, '</ol>\n</section>\n'));

  if (markerAt === -1) tokens.push(...block);
  else tokens.splice(markerAt, 0, ...block);
  env.records = notes;
}

/**
 * 核心规则二：把最终 HTML 取出来交给布局。
 *
 * 排在 `lightwiki:urls` 之后，否则拿到的链接还没加 basePath。
 */
export function citationFinalizeRule(state: any): void {
  const env = state.env as CitationState;
  const notes = env.records;
  if (!notes?.length) return;

  const md: MarkdownIt = state.md;
  env.citations = notes.map((note) => ({
    number: note.number,
    id: note.id,
    ...(note.name ? { name: note.name } : {}),
    count: note.count,
    // `renderInline` 只认「渲染单元」，不认 `inline` 容器本身，得把 children 拆出来给它
    html: note.inlineToken
      ? md.renderer.renderInline(note.inlineToken.children ?? [], md.options, state.env)
      : '',
  }));
}
