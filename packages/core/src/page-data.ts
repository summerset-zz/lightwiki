import { pageInfoOf, type PageInfoInput } from './context.js';

/**
 * 页面元数据注入（`wiki.config.ts` 的 `frontmatterInjection`）。
 *
 * 为什么走 HTML 后处理而不是模板：皮肤产出的是最终 HTML，作者可以整个覆盖
 * `layouts/doc.eta`，要求他们在模板里手写这段就漏了一半站点。这里和
 * `styles` / `scripts` / 搜索索引走同一条路，覆盖过皮肤也自动生效。
 *
 * 浏览器端读法：
 *
 * ```js
 * const data = JSON.parse(document.getElementById('lightwiki-page-data').textContent);
 * data.title;                 // 归一化后的字段
 * data.categories;            // 已经是数组
 * data.frontmatter.myOwnKey;  // frontmatter 原样，自定义键也在这里
 * ```
 */

/** 注入标签在 DOM 里的 id。主题的 JS 与这里要一致。 */
export const PAGE_DATA_ID = 'lightwiki-page-data';

/**
 * 交给浏览器的数据：`it.page` 减去 `markdown`。
 *
 * `markdown` 是整篇原文（含 frontmatter），每页几 KB，而它就是页面本身 ——
 * 想给读者看源码由皮肤的「查看源码」负责，不该每页都塞进一份 JSON。
 */
export function pageDataOf(page: PageInfoInput, lang: string): Record<string, unknown> {
  const { markdown: _markdown, ...rest } = pageInfoOf(page, lang);
  return rest;
}

/** 把元数据塞进页面。没有 `</body>` 时追加到末尾（和搜索索引一致）。 */
export function injectPageData(html: string, data: Record<string, unknown>): string {
  // `<` 一律转成 `\u003c`：frontmatter 里出现 `</script>` 会提前关掉标签。
  // JSON 里 `\u003c` 与 `<` 等价，JSON.parse 之后拿到的还是原字符。
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const tag = `<script type="application/json" id="${PAGE_DATA_ID}">${json}</script>`;

  return html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : `${html}\n${tag}`;
}
