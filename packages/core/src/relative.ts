import { posix } from 'node:path';
import type { LoadedConfig } from './config.js';
import { normalizeBasePath, urlToOutputPath } from './routes.js';

/**
 * 是不是页面 URL（而非资源路径）。
 *
 * 只靠扩展名判断会误伤：slug 可以写成 `v1.2`。所以照 `localizeHref()` 的老规矩来——
 * 只有 `/docs` 与 `/categories` 两棵路径（含语言前缀）以及站点根是页面。
 */
function isPageUrl(path: string, config: LoadedConfig): boolean {
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return true;
  if (segs[0] === 'docs' || segs[0] === 'categories') return true;
  return (
    config.content[segs[0] ?? ''] !== undefined &&
    (segs[1] === 'docs' || segs[1] === 'categories')
  );
}

/**
 * 把一个站内绝对 URL 改写成相对 `pagePath` 的路径；不该改写的情况原样返回。
 * 单独导出是为了重定向页也能复用 —— 它的 meta refresh 与 JS 也要拿到可用地址。
 */
export function relativeUrl(url: string, pagePath: string, config: LoadedConfig): string {
  if (!url.startsWith('/') || url.startsWith('//')) return url;

  const hashAt = url.indexOf('#');
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  const noHash = hashAt === -1 ? url : url.slice(0, hashAt);

  const queryAt = noHash.indexOf('?');
  const query = queryAt === -1 ? '' : noHash.slice(queryAt);
  const path = queryAt === -1 ? noHash : noHash.slice(0, queryAt);
  if (!path) return url;

  const base = normalizeBasePath(config.basePath);
  let afterBase = path;
  if (base && (afterBase === base || afterBase.startsWith(`${base}/`))) {
    afterBase = afterBase.slice(base.length);
  }
  if (!afterBase.startsWith('/')) afterBase = `/${afterBase}`;

  // 页面 URL 要按 urlStyle 映射成产物路径（directory → index.html，file → .html）；
  // 资源（css / 图片 / 字体）路径是什么就指什么，别给它补 .html。
  const target = isPageUrl(afterBase, config)
    ? urlToOutputPath(config, afterBase)
    : afterBase.replace(/^\/+/, '');

  return `${posix.relative(posix.dirname(pagePath), target)}${query}${hash}`;
}

/**
 * 把站内绝对链接改写成相对路径（`urlStyle: 'file'` 专用）。
 *
 * 原因只有一个：`file://` 打开时 `/docs/a.html` 指向的是盘符根，
 * 双击产物就是全站导航全废 —— 而 file 模式存在的唯一理由就是「双击能看」。
 * 相对路径在 file:// 与静态托管下都成立，所以可以无脑改写。
 *
 * 和 inline 一样是 HTML 后处理：布局、宏、markdown 都照常产出绝对路径，
 * 改写集中在这一处，用户覆盖的布局也能享受。
 *
 * 不处理的东西（有意为之）：
 * - `<script>` / `<style>` 里的内容（比如重定向页的 `location.replace("…")`）；
 * - `srcset` / `action` 等少见属性；
 * - `<meta http-equiv="refresh">` 的 URL。这三种在 file:// 下不保证，见文档。
 */
export function rewriteRelativeLinks(
  html: string,
  pagePath: string,
  config: LoadedConfig,
): string {
  const rewriteAttrs = (chunk: string): string =>
    // 逐个标签处理：canonical / alternate 是给爬虫的绝对地址，不能相对化
    chunk.replace(/<[a-z][^>]*>/gi, (tag) => {
      if (/^<link\b/i.test(tag) && /\brel\s*=\s*["']?(canonical|alternate)/i.test(tag)) return tag;

      return tag.replace(
        /\b(href|src|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi,
        (match, name: string, _quoted: string, dq?: string, sq?: string) => {
          const url = dq ?? sq ?? '';
          const next = relativeUrl(url, pagePath, config);
          return next === url ? match : `${name}="${next}"`;
        },
      );
    });

  // 只改写普通 HTML 片段：`<script>` 与 `<style>` 的正文原样保留
  return html
    .split(/(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/i)
    .map((chunk, index) => (index % 2 === 1 ? chunk : rewriteAttrs(chunk)))
    .join('');
}
