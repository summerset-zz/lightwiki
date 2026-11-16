import type { LoadedConfig } from './config.js';
import type { Page } from './content.js';
import { keywordsOf, NOT_FOUND_SLUG } from './context.js';
import { relativeUrl } from './relative.js';

/**
 * 搜索索引。
 *
 * 边界：core 只负责**产出数据**，搜索框、结果列表、跳转全在主题里。
 * 这里没有任何 DOM、没有查询语法、没有排序策略 —— 那些是 UI 决定的事。
 *
 * 字段名故意短：file / inline 模式下整份索引要塞进每个页面，键名 × 页数是实打实的体积。
 */
export interface SearchEntry {
  /** url */
  u: string;
  /** title */
  t: string;
  /** section 显示名 */
  s: string;
  /** keywords */
  k: string[];
  /** 正文摘要（纯文本） */
  x: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** `&amp;` / `&#39;` / `&#x27;` 都要还原：否则摘要里会留下一串实体，搜 `'` 搜不到 */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith('#')) {
      const hex = name[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(hex ? name.slice(2) : name.slice(1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

/**
 * HTML → 纯文本。
 *
 * 搜索只需要字，不需要结构；代码块里的尖括号如果不剥掉会污染匹配结果。
 */
export function plainText(html: string): string {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

export interface SearchOptions {
  /**
   * 索引要挂在哪一页上。给了就把 `u` 改写成相对该页面的路径 ——
   * file / inline 模式下索引是内联的，绝对路径在 `file://` 下指不到盘符根以外。
   */
  fromPath?: string;
}

export function buildSearchIndex(
  config: LoadedConfig,
  pages: Page[],
  options: SearchOptions = {},
): SearchEntry[] {
  const limit = config.search.excerpt;

  return pages
    .filter((page) => !page.draft && page.slug !== NOT_FOUND_SLUG)
    .map((page) => {
      const section = page.data.section ?? '';
      return {
        u: options.fromPath ? relativeUrl(page.url, options.fromPath, config) : page.url,
        t: page.data.title,
        s: config.sectionLabels[section] ?? section,
        k: keywordsOf(page.data.keywords),
        x: limit > 0 ? plainText(page.html).slice(0, limit) : '',
      };
    });
}

/** 内联索引在 DOM 里的 id。主题的 JS 与这里要一致。 */
export const SEARCH_INDEX_ID = 'lightwiki-search-index';

/**
 * 把索引塞进页面。
 *
 * file / inline 模式下没有可 fetch 的 json，索引只能跟着页面走。
 * 用 `application/json` 而不是变量赋值：脚本不执行，不会被 CSP 或用户脚本干扰。
 */
export function injectSearchIndex(html: string, entries: SearchEntry[]): string {
  // `</script>` 出现在摘要里会提前关掉标签，所以 `<` 一律转成 \u003c（JSON 里合法）
  const data = JSON.stringify(entries).replace(/</g, '\\u003c');
  const tag = `<script type="application/json" id="${SEARCH_INDEX_ID}">${data}</script>`;

  return html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : `${html}\n${tag}`;
}
