import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { copyAssets } from './assets.js';
import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem } from './content.js';
import { createSiteInfo } from './context.js';
import { buildLinkReport, type LinkReport } from './links.js';
import { createRenderer } from './render.js';
import { categoryOutputPath, langPrefix, normalizeBasePath, urlToOutputPath } from './routes.js';
import {
  createCategoryView,
  createIndexView,
  createNotFoundRender,
  createPageView,
  NOT_FOUND_SLUG,
} from './view.js';

export interface BuildOptions {
  /** 覆盖 config.outputDir */
  outDir?: string;
}

export interface BuildResult {
  outputDir: string;
  pageCount: number;
  problems: ContentProblem[];
  warnings: ContentProblem[];
  report: LinkReport;
  written: string[];
}

export async function buildSite(
  config: LoadedConfig,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const outputDir = resolve(config.root, options.outDir ?? config.outputDir);
  const { pages, problems, warnings } = await loadContent(config);

  // 未解析的内链/未定义的宏进 build 的警告列表，否则产物里会静默露出占位或原文
  for (const page of pages) {
    for (const item of page.unresolved) {
      warnings.push({
        file: `${page.lang}/${page.slug}`,
        messages: [`${item.kind === 'macro' ? '宏' : '内链'} ${item.target}：${item.message}`],
      });
    }
  }
  const report = buildLinkReport(config, pages);
  const renderer = createRenderer(config);
  const written: string[] = [];

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const base = normalizeBasePath(config.basePath);

  // slug 为 404 的页面不按普通页面输出，它只负责生成根目录的 404.html
  const published = pages.filter((p) => !p.draft && p.slug !== NOT_FOUND_SLUG);
  // 全站信息只算一次：宏与布局看到的是同一个对象，而且 generatedAt 保持一致
  const siteInfo = createSiteInfo(config, published);

  for (const page of published) {
    const view = createPageView(config, pages, page, siteInfo) as unknown as Record<string, unknown>;
    const html = await renderer.renderLayout('doc', view);
    const target = join(outputDir, page.outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html, 'utf8');
    written.push(page.outputPath);
  }

  // 每种语言一个目录页：既是导航入口，也是孤页判定的基准
  for (const lang of Object.keys(config.content)) {
    const indexPath = `${langPrefix(config, lang)}/docs/index.html`.replace(/^\//, '');
    const view = createIndexView(config, pages, lang, siteInfo) as unknown as Record<string, unknown>;
    const html = await renderer.renderLayout('index', view);
    const target = join(outputDir, indexPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html, 'utf8');
    written.push(indexPath);
  }

  // 分类页：每种语言、每个实际被用到的分类各一页
  for (const lang of Object.keys(config.content)) {
    const used = new Set<string>();
    for (const page of published) {
      if (page.lang !== lang) continue;
      for (const category of page.categories) used.add(category);
    }

    for (const slug of [...used].sort()) {
      const relative = categoryOutputPath(config, lang, slug);
      const view = createCategoryView(config, pages, lang, slug, siteInfo) as unknown as Record<
        string,
        unknown
      >;
      const html = await renderer.renderLayout('category', view);
      const target = join(outputDir, relative);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, html, 'utf8');
      written.push(relative);
    }
  }

  // 静态托管的 404 约定：根目录的 404.html。file:// 下没有这个概念，但其他托管都会用它。
  const notFound = createNotFoundRender(config, pages, siteInfo);
  const notFoundHtml = await renderer.renderLayout(notFound.layout, notFound.view);
  await writeFile(join(outputDir, '404.html'), notFoundHtml, 'utf8');
  written.push('404.html');

  // 重定向：默认生成 JS 跳转页（用户可能只有 GitHub Pages 这类没有服务端的托管）
  if (config.redirects.length > 0) {
    const taken = new Set(written);

    if (config.redirectMode !== 'server') {
      for (const rule of config.redirects) {
        const relative = urlToOutputPath(config, rule.from);
        if (taken.has(relative)) {
          warnings.push({
            file: rule.from,
            messages: [`重定向会覆盖已有页面，已跳过：${relative}`],
          });
          continue;
        }

        const html = await renderer.renderLayout('redirect', {
          site: siteInfo,
          from: rule.from,
          to: rule.to,
        });
        const target = join(outputDir, relative);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, html, 'utf8');
        written.push(relative);
        taken.add(relative);
      }
    }

    if (config.redirectMode !== 'js') {
      const lines = config.redirects.map((rule) => `${rule.from}  ${rule.to}  ${rule.status}`);
      await writeFile(join(outputDir, '_redirects'), `${lines.join('\n')}\n`, 'utf8');
      written.push('_redirects');
    }
  }

  // 根目录跳转到默认语言，方便 file:// 双击直接看
  const rootIndex = `<!doctype html><meta charset="utf-8"><title>${config.title}</title>` +
    `<meta http-equiv="refresh" content="0;url=${base}${langPrefix(config, config.defaultLanguage)}/docs/">` +
    `<p><a href="${base}${langPrefix(config, config.defaultLanguage)}/docs/">进入 ${config.title}</a></p>`;
  await writeFile(join(outputDir, 'index.html'), rootIndex, 'utf8');
  written.push('index.html');

  // 资源：内容仓库的 assets/ 与主题的 assets/。`.less` 在这里编译成同名 `.css`。
  await copyAssets(resolve(config.root, config.assetsDir), join(outputDir, 'assets'));
  await copyAssets(join(config.themeDir, 'assets'), join(outputDir, 'assets', 'theme'));

  // 归档追溯用：产物里要能看出它是用什么版本生成的
  await writeFile(
    join(outputDir, 'meta.json'),
    JSON.stringify(
      {
        generator: 'lightwiki',
        builtAt: new Date().toISOString(),
        siteUrl: config.siteUrl,
        basePath: base,
        urlStyle: config.urlStyle,
        languages: Object.keys(config.content),
        pages: published.length,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  return { outputDir, pageCount: published.length, problems, warnings, report, written };
}
