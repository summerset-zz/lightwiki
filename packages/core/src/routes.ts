import type { LoadedConfig } from './config.js';

/** basePath 规范化：`/` 与 `''` 都视为无前缀，其余统一成 `/sub` 形式 */
export function normalizeBasePath(basePath: string): string {
  if (!basePath || basePath === '/') return '';
  const trimmed = basePath.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** 默认语言不带前缀，其余语言是 `/<lang>` */
export function langPrefix(config: LoadedConfig, lang: string): string {
  return lang === config.defaultLanguage ? '' : `/${lang}`;
}

/** 页面在站点里的 URL（不含站点域名） */
export function pageUrl(config: LoadedConfig, lang: string, slug: string): string {
  const base = normalizeBasePath(config.basePath);
  const suffix = config.urlStyle === 'file' ? '.html' : '/';
  return `${base}${langPrefix(config, lang)}/docs/${slug}${suffix}`;
}

/** 输出文件相对 outputDir 的路径 */
export function outputPathFor(config: LoadedConfig, lang: string, slug: string): string {
  const dir = `${langPrefix(config, lang)}/docs`.replace(/^\//, '');
  return config.urlStyle === 'file' ? `${dir}/${slug}.html` : `${dir}/${slug}/index.html`;
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
 * 作者写的是「默认语言视角」的路径：`/docs/gsub-gpos`。
 * 非默认语言的页面需要补上语言前缀，否则中文站会跳到英文页。
 * 只处理 `/docs` 这一棵路径 —— 其他入口（工具页、字体页）与语言无关。
 */
export function localizeHref(href: string, lang: string, config: LoadedConfig): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;

  const { path, hash } = splitHash(href);
  let next = path;

  if (path === '/docs' || path.startsWith('/docs/')) {
    next = `${langPrefix(config, lang)}${path}`;
  }

  if (config.urlStyle === 'file') {
    if (next === '/docs' || next.endsWith('/docs')) {
      next = `${next}.html`;
    } else if (next.startsWith('/docs/') && !/\.[a-z0-9]+$/i.test(next)) {
      next = `${next.replace(/\/+$/, '')}.html`;
    }
  }

  return `${normalizeBasePath(config.basePath)}${next}${hash}`;
}

/** 资源路径（图片等）只加 basePath，不改语言、不改扩展名 */
export function assetHref(src: string, config: LoadedConfig): string {
  if (!src.startsWith('/') || src.startsWith('//')) return src;
  return `${normalizeBasePath(config.basePath)}${src}`;
}
