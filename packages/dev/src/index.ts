import { watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import {
  buildSearchIndex,
  compileLess,
  createCategoryView,
  createIndexView,
  createNotFoundRender,
  createPageView,
  createRenderer,
  createSiteInfo,
  injectSearchIndex,
  langPrefix,
  loadContent,
  normalizeBasePath,
  normUrl,
  SEARCH_INDEX_FILE,
  shouldInlineSearch,
  type LoadedConfig,
  type Page,
  type SiteInfo,
} from '@lightwiki/core';

export interface DevServerOptions {
  port?: number;
  host?: string;
  /** 端口被占用时向上尝试多少个，默认 10 */
  portRange?: number;
  /** 是否由 `wiki dev` 的监护层拉起（决定了 `/__lightwiki/restart` 能不能用） */
  supervised?: boolean;
  /** 每次重建后的回调，CLI 用它打印状态 */
  onRebuild?: (info: { pages: number; ms: number }) => void;
}

/**
 * 请求重启时的退出码。监护层看到它就会重新拉起 dev server。
 * 与 `packages/cli/src/supervise.ts` 的 RESTART_CODE 保持一致。
 */
export const RESTART_EXIT_CODE = 75;

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
  | { kind: 'search-index' }
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

/**
 * 手动重启端点：POST 一下就让监护层换个新进程（改完 packages/*\/src 后想立刻生效时用）。
 * 不在监护模式下报 501，而不是偷偷退掉用户的服务器。
 */
const RESTART_PATH = '/__lightwiki/restart';

function reloadSnippet(base: string): string {
  // 两个触发条件：
  // - onmessage：内容变了，服务端推 reload
  // - onopen 且之前断过：进程被重启过，断开期间那条 reload 已经丢了，连上就补一次刷新
  return `<script>(function(){var es=new EventSource(${JSON.stringify(
    base + EVENTS_PATH,
  )});var down=false;es.onmessage=function(){location.reload()};es.onerror=function(){down=true};es.onopen=function(){if(down){down=false;location.reload()}};})();</script>`;
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
  const base = normalizeBasePath(config.basePath);
  const langs = Object.keys(config.content);

  // 从产物里复制来的真实文件路径也要能访问（`/docs/macros/index.html`）。
  // 托管上 `xx/index.html` 就是 `xx/`，所以剥掉 `/index` 的版本优先试。
  // 但 `/docs/index`（不带 .html）是真实页面的 slug，不能剥。
  const candidates =
    /\.html?$/i.test(pathname) && key.endsWith('/index')
      ? [key.slice(0, -'/index'.length) || '/', key]
      : [key];

  for (const candidate of candidates) {
    if (candidate === '/') {
      return { kind: 'redirect', location: indexUrlOf(config, config.defaultLanguage) };
    }

    for (const lang of langs) {
      if (candidate === normUrl(indexUrlOf(config, lang), config)) {
        return { kind: 'index', lang };
      }
    }

    const page = state.byUrl.get(candidate);
    if (page) return { kind: 'page', page };

    // 重定向规则：页面优先，真实页面不会被规则盖掉。
    // dev 下直接 302，比渲染一张 JS 跳转页更方便调试。
    for (const rule of config.redirects) {
      if (normUrl(rule.from, config) === candidate) {
        return { kind: 'redirect', location: rule.to };
      }
    }

    // 分类页：`/categories/<slug>`（默认语言）或 `/<lang>/categories/<slug>`
    for (const lang of langs) {
      const prefix = normUrl(
        `${base}${langPrefix(config, lang)}/categories/`,
        config,
      );
      if (!candidate.startsWith(`${prefix}/`)) continue;

      const slug = candidate.slice(prefix.length + 1);
      const exists = state.pages.some(
        (p) => p.lang === lang && !p.draft && p.categories.includes(slug),
      );
      if (exists) return { kind: 'category', lang, slug };
    }
  }

  if (key === `/${SEARCH_INDEX_FILE}`) return { kind: 'search-index' };

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
    const searchInline = config.search.enabled && shouldInlineSearch(config);

    const inject = (html: string): string => {
      // file / inline 模式下浏览器拿不到 json（fetch 被 file:// 挡），索引跟着页面走
      const withSearch = searchInline
        ? injectSearchIndex(html, buildSearchIndex(config, state.pages))
        : html;

      return withSearch.includes('</body>')
        ? withSearch.replace('</body>', `${reloadSnippet(base)}</body>`)
        : withSearch + reloadSnippet(base);
    };

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

    if (route.kind === 'notfound') {
      const notFound = createNotFoundRender(config, state.pages, state.siteInfo);
      return inject(await renderer.renderLayout(notFound.layout, notFound.view));
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

        if (pathname === `${base}${RESTART_PATH}` || pathname === RESTART_PATH) {
          if (options.supervised !== true) {
            res.writeHead(501, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('这个 dev server 不是被 wiki dev 监护启动的，没法自己重启；请手动重启它\n');
            return;
          }
          res.writeHead(202, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('restarting\n');
          process.stderr.write('  收到重启请求，重启中…\n');
          // 先把响应推出去再退，否则浏览器那边是「连接被重置」而不是一句 restarting
          setImmediate(() => process.exit(RESTART_EXIT_CODE));
          return;
        }

        const route = resolveDevRoute(config, state, pathname);

        if (route.kind === 'redirect') {
          res.writeHead(302, { Location: route.location });
          res.end();
          return;
        }

        if (route.kind === 'search-index') {
          const body = JSON.stringify(buildSearchIndex(config, state.pages));
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          res.end(body);
          return;
        }

        if (route.kind === 'asset') {
          const info = await stat(route.file).catch(() => null);

          if (info && info.isFile()) {
            const body = await readFile(route.file);
            res.writeHead(200, {
              'Content-Type': MIME[extname(route.file).toLowerCase()] ?? 'application/octet-stream',
              'Content-Length': body.byteLength,
              'Cache-Control': 'no-store',
            });
            res.end(body);
            return;
          }

          // 请求 `.css` 但只有同名 `.less`：现编译再返回，与构建产物保持一致
          if (route.file.endsWith('.css')) {
            const lessFile = `${route.file.slice(0, -'.css'.length)}.less`;
            const lessInfo = await stat(lessFile).catch(() => null);
            if (lessInfo && lessInfo.isFile()) {
              const css = await compileLess(lessFile);
              res.writeHead(200, {
                'Content-Type': 'text/css; charset=utf-8',
                'Cache-Control': 'no-store',
              });
              res.end(css);
              return;
            }
          }

          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404');
          return;
        }

        const html = await render(route);
        if (!html) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404');
          return;
        }

        res.writeHead(route.kind === 'notfound' ? 404 : 200, {
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

      // 先登记 close 的回调再断开连接：浏览器断开的 SSE 会立刻重连，
      // 慢一拍就有新连接挤进来把 close 拖住（表现就是「正在关闭监听…」之后再也不动）。
      const closed = new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      });

      for (const client of clients) client.end();
      clients.clear();
      await closed;
    },
  };
}

export type { IncomingMessage, ServerResponse };
