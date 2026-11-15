import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import type { LoadedConfig } from './config.js';
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

export interface RenderEnv {
  lang: string;
  config: LoadedConfig;
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
