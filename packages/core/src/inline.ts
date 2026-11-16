import { posix } from 'node:path';
import type { AssetFile } from './assets.js';

/**
 * 单文件产物（`inline: true`）的 HTML 后处理。
 *
 * 为什么是后处理，而不是让布局判断开关：布局可能是用户自己覆盖的，
 * 他们照常写 `<link rel="stylesheet" href="/assets/theme/style.css">`，
 * 由工具负责替换成 `<style>`。这样「主题可升级」那条约束不用打补丁。
 */

/** 内联资源表：键是产物目录内的相对路径（posix，不含 basePath） */
export type InlineBundle = Map<string, { mime: string; data: Buffer }>;

export interface InlineReport {
  /** 内联掉的样式表数量 */
  css: number;
  /** 内联掉的外部脚本数量 */
  scripts: number;
  /** 转成 data URI 的媒体/字体等数量 */
  media: number;
  /** 引用了、但资源表里没有的样式表与脚本（原样保留，必须告诉用户） */
  missing: string[];
}

const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
};

export function mimeOf(file: string): string {
  const dot = file.lastIndexOf('.');
  const ext = dot === -1 ? '' : file.slice(dot).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

/**
 * 把「内容仓库 assets/」与「主题 assets/」两组文件合并成一张表。
 * `prefix` 是它们在产物里的目录（`assets` / `assets/theme`）。
 */
export function createInlineBundle(
  groups: Array<{ prefix: string; files: AssetFile[] }>,
): InlineBundle {
  const bundle: InlineBundle = new Map();
  for (const group of groups) {
    for (const file of group.files) {
      bundle.set(`${group.prefix}/${file.path}`, { mime: mimeOf(file.path), data: file.data });
    }
  }
  return bundle;
}

function dataUri(asset: { mime: string; data: Buffer }): string {
  return `data:${asset.mime};base64,${asset.data.toString('base64')}`;
}

/**
 * 把一个引用解析成产物内的相对路径。
 *
 * - 外链（`http:` `data:` `mailto:` `//`）返回 null，调用方原样保留；
 * - `/` 开头的按产物根解析（去掉 basePath）；
 * - 其余按「引用所在文件的目录」解析 —— CSS 里的相对 url() 与页面里的相对 src 都靠这条。
 */
function resolveTarget(url: string, fromFile: string, basePath: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.startsWith('//')) return null;

  const path = (raw.split('#')[0] ?? '').split('?')[0] ?? '';
  if (!path) return null;

  let rel: string;
  if (path.startsWith('/')) {
    let stripped = path;
    if (basePath && (stripped === basePath || stripped.startsWith(`${basePath}/`))) {
      stripped = stripped.slice(basePath.length);
    }
    rel = stripped.replace(/^\/+/, '');
  } else {
    const dir = posix.dirname(fromFile);
    rel = posix.join(dir === '.' ? '' : dir, path);
  }

  rel = posix.normalize(rel).replace(/^\/+/, '');
  if (!rel || rel.startsWith('..')) return null;
  return rel;
}

/** 读标签属性，支持 `a="x"` / `a='x'` / `a=x` */
function attr(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!match) return undefined;
  return match[2] ?? match[3] ?? match[4];
}

/** CSS 里的 url(...) 换成 data URI；以 CSS 文件自身的位置为基准解析相对路径 */
function inlineCssUrls(
  css: string,
  cssPath: string,
  bundle: InlineBundle,
  basePath: string,
  report: InlineReport,
): string {
  return css.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (match, _quote: string, url: string) => {
    const raw = url.trim();
    if (!raw || raw.toLowerCase().startsWith('data:')) return match;

    const rel = resolveTarget(raw, cssPath, basePath);
    const asset = rel ? bundle.get(rel) : undefined;
    if (!asset) return match;

    report.media += 1;
    return `url(${dataUri(asset)})`;
  });
}

/** 会带 src/href/poster 的标签；`a` 也算，指向 /assets/x.pdf 这种附件时要内联 */
const RESOURCE_TAG = /<(img|source|video|audio|iframe|embed|link|object|track|a|use|image)\b[^>]*>/gi;

export function inlineHtml(
  html: string,
  pagePath: string,
  bundle: InlineBundle,
  basePath: string,
): { html: string; report: InlineReport } {
  const report: InlineReport = { css: 0, scripts: 0, media: 0, missing: [] };

  // 1. 外部样式表 → <style>。顺序必须在属性替换之前，否则 href 会先变成 data URI。
  let out = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = attr(tag, 'rel');
    const href = attr(tag, 'href');
    if (!rel || !href || !/\bstylesheet\b/i.test(rel)) return tag;

    const key = resolveTarget(href, pagePath, basePath);
    const asset = key ? bundle.get(key) : undefined;
    if (!key || !asset) {
      report.missing.push(href);
      return tag;
    }

    const css = inlineCssUrls(asset.data.toString('utf8'), key, bundle, basePath, report);
    report.css += 1;
    return `<style>\n${css.trim()}\n</style>`;
  });

  // 2. 外部脚本 → 内联脚本（`defer` / `async` 对内联脚本没有意义，但留着无害）
  out = out.replace(
    /<script\b([^>]*)\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>\s*<\/script>/gi,
    (match, before: string, _quoted: string, dq?: string, sq?: string, bare?: string, after = '') => {
      const url = dq ?? sq ?? bare ?? '';
      const key = resolveTarget(url, pagePath, basePath);
      const asset = key ? bundle.get(key) : undefined;
      if (!key || !asset) {
        report.missing.push(url);
        return match;
      }

      const rest = `${before} ${after}`.replace(/\s+/g, ' ').trim();
      report.scripts += 1;
      return `<script${rest ? ` ${rest}` : ''}>\n${asset.data.toString('utf8').trim()}\n</script>`;
    },
  );

  // 3. 其余标签上的资源引用 → data URI。命中不了就原样保留（多半是页面链接）。
  out = out.replace(RESOURCE_TAG, (tag) => {
    if (/^<link\b/i.test(tag) && /\brel\s*=\s*["']?stylesheet/i.test(tag)) return tag;

    return tag.replace(
      /\b(src|href|poster)\s*=\s*("([^"]*)"|'([^']*)')/gi,
      (match, name: string, _quoted: string, dq?: string, sq?: string) => {
        const url = dq ?? sq ?? '';
        const key = resolveTarget(url, pagePath, basePath);
        const asset = key ? bundle.get(key) : undefined;
        if (!asset) return match;

        report.media += 1;
        return `${name}="${dataUri(asset)}"`;
      },
    );
  });

  return { html: out, report };
}
