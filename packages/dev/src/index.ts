import { watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import {
  createCategoryView,
  createIndexView,
  createPageView,
  createRenderer,
  createSiteInfo,
  langPrefix,
  loadContent,
  normalizeBasePath,
  normUrl,
  type LoadedConfig,
  type Page,
  type SiteInfo,
} from '@lightwiki/core';

export interface DevServerOptions {
  port?: number;
  host?: string;
  /** 端口被占用时向上尝试多少个，默认 10 */
  portRange?: number;
  /** 每次重建后的回调，CLI 用它打印状态 */
  onRebuild?: (info: { pages: number; ms: number }) => void;
}

export interface DevServerHandle {
  url: string;
  port: number;
  close(): Promise<void>;
}

export interface DevState {
  pages: Page[];
  byUrl: Map<string, Page>;
  siteInfo: SiteInfo;
}

export type DevRoute =
  | { kind: 'page'; page: Page }
  | { kind: 'index'; lang: string }
  | { kind: 'category'; lang: string; slug: string }
  | { kind: 'asset'; file: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'notfound' };

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const EVENTS_PATH = '/__lightwiki/events';

function reloadSnippet(base: string): string {
  return `<script>(function(){var es=new EventSource(${JSON.stringify(base + EVENTS_PATH)});es.onmessage=function(){location.reload()};})();</script>`;
}

async function loadState(config: LoadedConfig): Promise<DevState> {
  const { pages } = await loadContent(config);
  const byUrl = new Map<string, Page>();
  // 草稿也在索引里：草稿不进导航，但在 dev 下应该能按地址打开
  for (const page of pages) byUrl.set(normUrl(page.url, config), page);
  return { pages, byUrl, siteInfo: createSiteInfo(config, pages) };
}

function indexUrlOf(config: LoadedConfig, lang: string): string {
  const base = normalizeBasePath(config.basePath);
  return `${base}${langPrefix(config, lang)}/docs/`;
}

/**
 * 把传入的 pathname 映射到「页面 / 目录页 / 资源 / 重定向」。
 * 抽成纯函数是为了能脱离 HTTP 单独验证（dev server 不便于在 CI 里跑）。
 */
export function resolveDevRoute(
  config: LoadedConfig,
  state: DevState,
  pathname: string,
): DevRoute {
  const key = normUrl(pathname, config);

  if (key === '/') {
    return { kind: 'redirect', location: indexUrlOf(config, config.defaultLanguage) };
  }

  for (const lang of Object.keys(config.content)) {
    if (key === normUrl(indexUrlOf(config, lang), config)) {
      return { kind: 'index', lang };
    }
  }

  const page = state.byUrl.get(key);
  if (page) return { kind: 'page', page };

  // 分类页：`/categories/<slug>`（默认语言）或 `/<lang>/categories/<slug>`
  for (const lang of Object.keys(config.content)) {
    const prefix = normUrl(
      `${normalizeBasePath(config.basePath)}${langPrefix(config, lang)}/categories/`,
      config,
    );
    if (!key.startsWith(`${prefix}/`)) continue;

    const slug = key.slice(prefix.length + 1);
    const exists = state.pages.some(
      (p) => p.lang === lang && !p.draft && p.categories.includes(slug),
    );
    if (exists) return { kind: 'category', lang, slug };
  }

  if (key.startsWith('/assets/')) {
    const rest = key.slice('/assets/'.length);
    if (rest.startsWith('theme/')) {
      return { kind: 'asset', file: safeJoin(join(config.themeDir, 'assets'), rest.slice('theme/'.length)) };
    }
    return { kind: 'asset', file: safeJoin(resolve(config.root, config.assetsDir), rest) };
  }

  return { kind: 'notfound' };
}

/** 阻止 `../` 逃出根目录 */
function safeJoin(rootDir: string, rest: string): string {
  const target = resolve(rootDir, rest);
  const prefix = rootDir.endsWith(sep) ? rootDir : rootDir + sep;
  return target.startsWith(prefix) ? target : join(rootDir, '\u0000invalid');
}

function collectWatchTargets(config: LoadedConfig): string[] {
  const targets = Object.values(config.content).map((dir) => resolve(config.root, dir));
  targets.push(resolve(config.root, 'layouts'));
  targets.push(config.themeDir);
  return targets;
}

export async function startDevServer(
  config: LoadedConfig,
  options: DevServerOptions = {},
): Promise<DevServerHandle> {
  const renderer = createRenderer(config);
  const base = normalizeBasePath(config.basePath);
  let state = await loadState(config);

  const clients = new Set<ServerResponse>();
  const watchers: FSWatcher[] = [];

  let timer: NodeJS.Timeout | undefined;
  function scheduleRebuild(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        const started = Date.now();
        try {
          state = await loadState(config);
          if (options.onRebuild) {
            options.onRebuild({ pages: state.pages.length, ms: Date.now() - started });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(`重建失败：${message}\n`);
        }
        for (const client of clients) client.write('data: reload\n\n');
      })();
    }, 200);
  }

  for (const target of collectWatchTargets(config)) {
    try {
      watchers.push(watch(target, { recursive: true }, () => scheduleRebuild()));
    } catch {
      // 目录不存在就跳过：内容是可有可无的，不该让 dev 起不来
    }
  }

  async function render(route: DevRoute): Promise<string | null> {
    const inject = (html: string): string =>
      html.includes('</body>')
        ? html.replace('</body>', `${reloadSnippet(base)}</body>`)
        : html + reloadSnippet(base);

    if (route.kind === 'page') {
      const html = await renderer.renderLayout(
        'doc',
        createPageView(config, state.pages, route.page, state.siteInfo) as unknown as Record<string, unknown>,
      );
      return inject(html);
    }

    if (route.kind === 'index') {
      const html = await renderer.renderLayout(
        'index',
        createIndexView(config, state.pages, route.lang, state.siteInfo) as unknown as Record<string, unknown>,
      );
      return inject(html);
    }

    if (route.kind === 'category') {
      const html = await renderer.renderLayout(
        'category',
        createCategoryView(
          config,
          state.pages,
          route.lang,
          route.slug,
          state.siteInfo,
        ) as unknown as Record<string, unknown>,
      );
      return inject(html);
    }

    return null;
  }

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const requestUrl = new URL(req.url ?? '/', 'http://localhost');
        const pathname = decodeURIComponent(requestUrl.pathname);

        if (pathname === `${base}${EVENTS_PATH}` || pathname === EVENTS_PATH) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          });
          res.write(': connected\n\n');
          clients.add(res);
          req.on('close', () => clients.delete(res));
          return;
        }

        const route = resolveDevRoute(config, state, pathname);

        if (route.kind === 'redirect') {
          res.writeHead(302, { Location: route.location });
          res.end();
          return;
        }

        if (route.kind === 'asset') {
          const info = await stat(route.file).catch(() => null);
          if (!info || !info.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404');
            return;
          }
          const body = await readFile(route.file);
          res.writeHead(200, {
            'Content-Type': MIME[extname(route.file).toLowerCase()] ?? 'application/octet-stream',
            'Content-Length': body.byteLength,
            'Cache-Control': 'no-store',
          });
          res.end(body);
          return;
        }

        const html = await render(route);
        if (!html) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!doctype html><meta charset="utf-8"><h1>404</h1><p>${pathname}</p>`);
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(html);
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`渲染失败\n\n${message}`);
      }
    })();
  });

  const startPort = options.port ?? 5173;
  const range = options.portRange ?? 10;
  const host = options.host ?? '127.0.0.1';

  let port = startPort;
  for (let attempt = 0; attempt < range; attempt += 1) {
    const candidate = startPort + attempt;
    const ok = await new Promise<boolean>((done) => {
      const onError = (error: NodeJS.ErrnoException): void => {
        server.removeListener('error', onError);
        if (error.code === 'EADDRINUSE') done(false);
        else done(false);
      };
      server.once('error', onError);
      server.listen(candidate, host, () => {
        server.removeListener('error', onError);
        done(true);
      });
    });
    if (ok) {
      port = candidate;
      break;
    }
    if (attempt === range - 1) {
      throw new Error(
        `端口 ${startPort}–${startPort + range - 1} 都被占用，请用 --port 指定一个空闲端口`,
      );
    }
  }

  return {
    url: `http://${host}:${port}${base || '/'}`,
    port,
    async close() {
      if (timer) clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      for (const client of clients) client.end();
      clients.clear();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

export type { IncomingMessage, ServerResponse };
