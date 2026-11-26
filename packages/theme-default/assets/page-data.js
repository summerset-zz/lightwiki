/**
 * 页面元数据的懒解析封装。
 *
 * 构建时（`frontmatterInjection: true`）会把这一页的 frontmatter 以 JSON 形式
 * 放进 `<script type="application/json" id="lightwiki-page-data">`。JSON 标签不会被
 * 浏览器执行，所以不违反 CSP 的 `script-src`；代价是每个用它的脚本都得自己 parse 一次。
 *
 * 这里提供 `pageMeta()`：第一次调用时取标签、parse，之后直接返回缓存的对象。
 *
 * ```js
 * pageMeta().title;                 // 页面标题
 * pageMeta().frontmatter.myOwnKey;  // 自己写的键
 * ```
 *
 * 页面上没有这个标签（未开启注入、或分类页 / 404 页）时返回 `null`。
 * 解析失败也返回 `null`，不抛错 —— 数据坏了不该连累页面脚本。
 */
(function () {
  let cached;
  let loaded = false;

  window.pageMeta = function pageMeta() {
    if (loaded) return cached;
    loaded = true;

    const el = document.getElementById('lightwiki-page-data');
    if (!el) {
      cached = null;
      return cached;
    }

    try {
      cached = JSON.parse(el.textContent || '');
    } catch (error) {
      cached = null;
    }
    return cached;
  };
})();
