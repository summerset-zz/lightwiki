import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { LoadedConfig } from './config.js';
import { normalizeBasePath } from './routes.js';

/**
 * 页面级样式表与脚本（frontmatter 的 `styles` / `scripts`）。
 *
 * 两件事在这里定：
 * 1. **引用怎么写**：相对 `assets/`（`theme/hero.css`），也可以写 `/assets/theme/hero.css`。
 * 2. **.less 怎么算**：沿用 assets 目录的约定 —— `hero.less` 编译成 `hero.css`，
 *    产物里只有后者，所以引用一律写 `.css`。作者真写了 `.less` 也认，内部换成 `.css` 再找。
 *
 * 注入走 HTML 后处理（和 inline / 相对化 / 搜索索引同一套），
 * 所以用户覆盖过的布局也自动获得这两个字段的能力，不用在 `.eta` 里写额外代码。
 */

/** frontmatter 里的字符串或数组统一成干净的字符串数组 */
export function assetList(value: unknown): string[] {
  const raw = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export interface ResolvedAsset {
  /** 产物里的相对路径（相对 assets/），如 `theme/hero.css` */
  rel: string;
  /** 磁盘上的真实文件（可能是同名的 `.less`） */
  file: string;
}

/**
 * 把一条引用解析成真实文件。找不到返回 null（由调用方决定报到哪去）。
 * `../` 之类一律拒绝：内容里的路径不该有机会跑出 assets 目录。
 */
export function resolvePageAsset(config: LoadedConfig, reference: string): ResolvedAsset | null {
  let rel = reference.trim().replace(/^~?\/+/, '');
  if (rel.startsWith('assets/')) rel = rel.slice('assets/'.length);
  if (!rel || rel.split('/').includes('..')) return null;

  const dir = resolve(config.root, config.assetsDir);

  // 写 .css 就同时接受同名 .less（编译产物就是它）；写别的扩展名原样找
  const candidates = rel.endsWith('.css')
    ? [rel, `${rel.slice(0, -'.css'.length)}.less`]
    : [rel];

  const found = candidates.find((name) => existsSync(join(dir, name)));
  if (!found) return null;

  return {
    rel: found.endsWith('.less') ? `${found.slice(0, -'.less'.length)}.css` : found,
    file: join(dir, found),
  };
}

/** 站内地址（含 basePath）；资源不分语言，所以不需要 localizeHref */
export function pageAssetUrl(config: LoadedConfig, rel: string): string {
  return `${normalizeBasePath(config.basePath)}/assets/${rel}`;
}

/**
 * 把样式表塞进 `</head>` 前、脚本塞进 `</body>` 前。
 *
 * 放在 inline 之前执行，所以 `inline: true` 时这两个字段也被一起内联，
 * 产物仍然只有 `.html`。
 */
export function injectPageAssets(html: string, styles: string[], scripts: string[]): string {
  if (styles.length === 0 && scripts.length === 0) return html;

  let next = html;

  if (styles.length > 0) {
    const tags = styles
      .map((href) => `<link rel="stylesheet" href="${href.replace(/"/g, '&quot;')}">`)
      .join('\n');
    next = next.includes('</head>')
      ? next.replace('</head>', `${tags}\n</head>`)
      : `${tags}\n${next}`;
  }

  if (scripts.length > 0) {
    const tags = scripts
      .map((src) => `<script src="${src.replace(/"/g, '&quot;')}" defer></script>`)
      .join('\n');
    next = next.includes('</body>')
      ? next.replace('</body>', `${tags}\n</body>`)
      : `${next}\n${tags}`;
  }

  return next;
}
