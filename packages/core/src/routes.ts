import type { LoadedConfig } from './config.js';

/** basePath 规范化：`/` 与 `''` 都视为无前缀，其余统一成 `/sub` 形式 */
export function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/') return '';
  const trimmed = basePath.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** URL 前缀段（已含前导斜杠）：`/zh`，没配就是空串 */
export function prefixPath(config: LoadedConfig): string {
  return config.urlPrefix ? `/${config.urlPrefix}` : '';
}

/**
 * 内容页的路径前缀，已含前导斜杠：`/docs`、`/wiki`，或者空串（页面直接挂在语言根下）。
 * 所有路由都从这里取，不再各自写 `/docs`。
 */
export function pageBase(config: LoadedConfig): string {
  const dir = config.docsDir.replace(/^\/+|\/+$/g, '');
  return dir ? `/${dir}` : '';
}

/**
 * 首页的 slug：`index.md` 就是首页。
 *
 * 以前首页是构建器自动生成的目录页，现在这一页由作者提供 —— 想炫酷、想纯 HTML、
 * 想只是一句话，都是同一份 frontmatter 说了算。
 */
export const INDEX_SLUG = 'index';

/** 页面在站点里的 URL（不含站点域名） */
export function pageUrl(config: LoadedConfig, slug: string): string {
  const base = normalizeBasePath(config.basePath);
  const dir = `${prefixPath(config)}${pageBase(config)}`;

  if (slug === INDEX_SLUG) {
    // 根上的首页：directory 模式是 `/`，file 模式只能是 `/index.html`
    if (config.urlStyle === 'file') return `${base}${dir ? `${dir}.html` : '/index.html'}`;
    return `${base}${dir}/`;
  }

  return `${base}${dir}/${slug}${config.urlStyle === 'file' ? '.html' : '/'}`;
}

/** 输出文件相对 outputDir 的路径 */
export function outputPathFor(config: LoadedConfig, slug: string): string {
  // `docsDir: ''` 与无 `urlPrefix` 时这里会是空串，拼路径不能直接 `${dir}/...`，否则得到前导斜杠，
  // 后续按相对路径算链接就会算飞（file 模式下会变成 `git repo/xxx/assets/...` 这种）
  const dir = `${prefixPath(config)}${pageBase(config)}`.replace(/^\//, '');
  const at = dir ? `${dir}/` : '';

  if (slug === INDEX_SLUG) {
    if (config.urlStyle === 'file') return dir ? `${dir}.html` : 'index.html';
    return `${at}index.html`;
  }

  return config.urlStyle === 'file' ? `${at}${slug}.html` : `${at}${slug}/index.html`;
}

/** 分类页 URL */
export function categoryUrl(config: LoadedConfig, slug: string): string {
  const base = normalizeBasePath(config.basePath);
  const suffix = config.urlStyle === 'file' ? '.html' : '/';
  return `${base}${prefixPath(config)}/categories/${slug}${suffix}`;
}

/** 分类页输出路径（相对 outputDir） */
export function categoryOutputPath(config: LoadedConfig, slug: string): string {
  const dir = `${prefixPath(config)}/categories`.replace(/^\//, '');
  return config.urlStyle === 'file' ? `${dir}/${slug}.html` : `${dir}/${slug}/index.html`;
}

/**
 * 首页（`<pageBase>/`）的输出路径。等于 slug 为 `index` 的那页的产物位置。
 *
 * 单独留一个函数是因为重定向与 file 模式的链接都拿它当中枢：
 * 以前这里是「构建器自动生成的目录页」，现在就是作者写的 `index.md`。
 */
export function indexOutputPath(config: LoadedConfig): string {
  return outputPathFor(config, INDEX_SLUG);
}

/** 把站内 URL 映射成产物里的相对文件路径（相对 outputDir） */
export function urlToOutputPath(config: LoadedConfig, url: string): string {
  const base = normalizeBasePath(config.basePath);
  let path = url.split('#')[0] ?? url;
  if (base && path.startsWith(base)) path = path.slice(base.length);
  path = path.replace(/^\/+/, '').replace(/\.html$/, '').replace(/\/+$/, '');
  if (!path) return 'index.html';
  return config.urlStyle === 'file' ? `${path}.html` : `${path}/index.html`;
}

/** 把一个站内绝对路径拆成 path / hash */
function splitHash(href: string): { path: string; hash: string } {
  const idx = href.indexOf('#');
  return idx === -1
    ? { path: href, hash: '' }
    : { path: href.slice(0, idx), hash: href.slice(idx) };
}

/**
 * 改写正文里的站内链接。
 *
 * 作者按「内容页根」写路径：`/gsub-gpos`、`/categories/syntax`。
 * 两件事在构建期补上：
 * - `urlPrefix` 非空时补前缀（多语言站靠它把两门语言分开）；
 * - directory 模式下补尾斜杠，静态托管不必依赖 301 重定向。
 *
 * **必须幂等**：双链解析出来的已经是带 basePath 的产物 URL（`page.url`），
 * 若再加一次 basePath 就会变成 `/wiki/wiki/docs/x`。部署在子路径时才会显形，
 * 以前一直是 `/` 所以没暴露过。
 */
export function localizeHref(
  href: string,
  config: LoadedConfig,
  isPageSlug?: (slug: string) => boolean,
): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  const base = normalizeBasePath(config.basePath);
  const { path, hash } = splitHash(href);

  // 先剥掉可能已经存在的 basePath，后面统一加回去
  let next = path;
  if (base && (next === base || next.startsWith(`${base}/`))) {
    next = next.slice(base.length);
  }
  if (!next.startsWith('/')) next = `/${next}`;

  // 再剥掉可能已经写了的 urlPrefix：作者多写一次也不会变成 `/zh/zh/a`
  const prefix = prefixPath(config);
  if (prefix && (next === prefix || next.startsWith(`${prefix}/`))) {
    next = next.slice(prefix.length) || '/';
  }

  // 页面挂在 `[urlPrefix][docsDir]` 下；`docsDir` 为空时只能问「这一页存不存在」——
  // 由调用方传入的 isPageSlug 回答。
  const pagesBase = pageBase(config);
  const firstSeg = next.split('/').filter(Boolean)[0] ?? '';

  const isCategory = next === '/categories' || next.startsWith('/categories/');
  const isPage = pagesBase
    ? next === pagesBase || next.startsWith(`${pagesBase}/`)
    : firstSeg !== '' && (isPageSlug?.(firstSeg) ?? false);

  const localized = isPage || isCategory;

  if (localized) {
    next = `${prefix}${next}`;
  }

  if (config.urlStyle === 'file') {
    if (localized && !/\.[a-z0-9]+$/i.test(next)) {
      next = `${next.replace(/\/+$/, '')}.html`;
    }
  } else if (localized && !next.endsWith('/')) {
    next = `${next}/`;
  }

  return `${base}${next}${hash}`;
}

/** 搜索索引文件名（产物根目录） */
export const SEARCH_INDEX_FILE = 'search-index.json';

/** 搜索索引的站点路径（已含 basePath） */
export function searchIndexUrl(config: LoadedConfig): string {
  return `${normalizeBasePath(config.basePath)}/${SEARCH_INDEX_FILE}`;
}

/**
 * 索引要不要内联进页面。
 *
 * 两种模式都必须内联：`file://` 下 fetch 不到 json，inline 模式下产物里根本没有别的文件。
 * 主题据此拿 `it.site.search.url`（null = 读页面里的内联索引）。
 */
export function shouldInlineSearch(config: LoadedConfig): boolean {
  return config.inline || config.urlStyle === 'file';
}

/**
 * 给站内绝对路径加上 basePath，**幂等**：已经带前缀时原样返回。
 *
 * 与 `assetHref` 的区别在这里：那个处理的是作者手写的 `/assets/x`（保证不含前缀），
 * 这里的输入可能来自配置（作者可能已经自己拼了前缀），所以要先判重。
 * 非站内地址（`https://`、`mailto:`、`//cdn`）原样返回。
 */
export function withBasePath(path: string, config: LoadedConfig): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;

  const base = normalizeBasePath(config.basePath);
  if (!base) return path;
  return path === base || path.startsWith(`${base}/`) ? path : `${base}${path}`;
}

/** 资源路径（图片等）只加 basePath，不改语言、不改扩展名 */
export function assetHref(src: string, config: LoadedConfig): string {
  if (!src.startsWith('/') || src.startsWith('//')) return src;
  return `${normalizeBasePath(config.basePath)}${src}`;
}
