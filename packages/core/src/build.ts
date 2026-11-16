import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { collectAssets, copyAssets } from './assets.js';
import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem } from './content.js';
import { createSiteInfo } from './context.js';
import { createInlineBundle, inlineHtml, type InlineBundle } from './inline.js';
import { buildLinkReport, type LinkReport } from './links.js';
import { createRenderer } from './render.js';
import { relativeUrl, rewriteRelativeLinks } from './relative.js';
import { categoryOutputPath, indexOutputPath, langPrefix, normalizeBasePath, urlToOutputPath } from './routes.js';
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
  /** 覆盖 config.inline：产物只留 HTML，CSS/JS/资源全部内联 */
  inline?: boolean;
}

export interface BuildResult {
  outputDir: string;
  pageCount: number;
  problems: ContentProblem[];
  warnings: ContentProblem[];
  report: LinkReport;
  written: string[];
  /** 是否内联模式（产物里没有 assets 目录） */
  inline: boolean;
  /** 内联命中数；非内联模式为 null */
  inlineStats: { css: number; scripts: number; media: number } | null;
  /** 产物总体积（字节） */
  bytes: number;
}

export async function buildSite(
  config: LoadedConfig,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const outputDir = resolve(config.root, options.outDir ?? config.outputDir);
  const inlineMode = options.inline ?? config.inline;
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
  let bytes = 0;

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const base = normalizeBasePath(config.basePath);

  // 内联模式先把资源读进内存：页面渲染时要拿它们填 <style> 与 data URI，
  // 而且一个字节都不能写到 assets/（否则「产物只有 .html」就不成立）。
  const bundle: InlineBundle | null = inlineMode
    ? createInlineBundle([
        { prefix: 'assets', files: await collectAssets(resolve(config.root, config.assetsDir)) },
        { prefix: 'assets/theme', files: await collectAssets(join(config.themeDir, 'assets')) },
      ])
    : null;

  const reportedMissing = new Set<string>();
  const inlineTotals = { css: 0, scripts: 0, media: 0 };
  // file 模式下站内链接一律相对：`file://` 下的 `/docs/a.html` 会指到盘符根
  const relativeMode = config.urlStyle === 'file';

  /**
   * 所有 HTML 的唯一出口：内联与相对化在这里改写，顺便统计体积。
   * `absolute` 用于 404.html —— 它可能在任意深度被打开，相对路径会错。
   */
  const emit = async (
    relative: string,
    html: string,
    options: { absolute?: boolean } = {},
  ): Promise<void> => {
    let content = html;

    if (bundle) {
      const inlined = inlineHtml(html, relative, bundle, base);
      content = inlined.html;
      inlineTotals.css += inlined.report.css;
      inlineTotals.scripts += inlined.report.scripts;
      inlineTotals.media += inlined.report.media;

      // 缺资源只报一次：同一张样式表会在每一页都复现
      for (const miss of inlined.report.missing) {
        if (reportedMissing.has(miss)) continue;
        reportedMissing.add(miss);
        warnings.push({
          file: relative,
          messages: [`内联时找不到资源，产物里仍是外链引用：${miss}`],
        });
      }
    }

    if (relativeMode && !options.absolute) {
      content = rewriteRelativeLinks(content, relative, config);
    }

    const target = join(outputDir, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
    written.push(relative);
    bytes += Buffer.byteLength(content, 'utf8');
  };

  // slug 为 404 的页面不按普通页面输出，它只负责生成根目录的 404.html
  const published = pages.filter((p) => !p.draft && p.slug !== NOT_FOUND_SLUG);
  // 全站信息只算一次：宏与布局看到的是同一个对象，而且 generatedAt 保持一致
  const siteInfo = createSiteInfo(config, published);

  for (const page of published) {
    const view = createPageView(config, pages, page, siteInfo) as unknown as Record<string, unknown>;
    const html = await renderer.renderLayout('doc', view);
    await emit(page.outputPath, html);
  }

  // 每种语言一个目录页：既是导航入口，也是孤页判定的基准
  for (const lang of Object.keys(config.content)) {
    const indexPath = indexOutputPath(config, lang);
    const view = createIndexView(config, pages, lang, siteInfo) as unknown as Record<string, unknown>;
    const html = await renderer.renderLayout('index', view);
    await emit(indexPath, html);
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
      await emit(relative, html);
    }
  }

  // 静态托管的 404 约定：根目录的 404.html。file:// 下没有这个概念，但其他托管都会用它。
  const notFound = createNotFoundRender(config, pages, siteInfo);
  const notFoundHtml = await renderer.renderLayout(notFound.layout, notFound.view);
  await emit('404.html', notFoundHtml, { absolute: true });

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

        // 跳转地址在 file 模式下要跟着相对化（meta refresh 与 JS 都要用）；
        // canonical 必须是绝对地址，否则对搜索引敬没有意义。
        const html = await renderer.renderLayout('redirect', {
          site: siteInfo,
          from: rule.from,
          to: rule.to,
          href: relativeMode ? relativeUrl(rule.to, relative, config) : rule.to,
          canonical: `${config.siteUrl.replace(/\/+$/, '')}${rule.to}`,
        });
        await emit(relative, html);
        taken.add(relative);
      }
    }

    if (config.redirectMode !== 'js') {
      const lines = config.redirects.map((rule) => `${rule.from}  ${rule.to}  ${rule.status}`);
      const body = `${lines.join('\n')}\n`;
      await writeFile(join(outputDir, '_redirects'), body, 'utf8');
      written.push('_redirects');
      bytes += Buffer.byteLength(body, 'utf8');
    }
  }

  // 根目录跳转到默认语言，方便 file:// 双击直接看。
  // file 模式下写相对路径（`docs.html`），否则双击时 `/docs/` 会指到盘符根。
  const homeHref =
    config.urlStyle === 'file'
      ? `${langPrefix(config, config.defaultLanguage).replace(/^\//, '')}docs.html`
      : `${base}${langPrefix(config, config.defaultLanguage)}/docs/`;
  const rootIndex = `<!doctype html><meta charset="utf-8"><title>${config.title}</title>` +
    `<meta http-equiv="refresh" content="0;url=${homeHref}">` +
    `<p><a href="${homeHref}">进入 ${config.title}</a></p>`;
  await emit('index.html', rootIndex);

  // 资源：内容仓库的 assets/ 与主题的 assets/。`.less` 在这里编译成同名 `.css`。
  // 内联模式已经把它们读进内存了，不再落盘。
  if (!bundle) {
    await copyAssets(resolve(config.root, config.assetsDir), join(outputDir, 'assets'));
    await copyAssets(join(config.themeDir, 'assets'), join(outputDir, 'assets', 'theme'));
  }

  // 归档追溯用：产物里要能看出它是用什么版本生成的。
  // 单文件产物连这一条也省掉——用户要的是「一个文件就能看」。
  if (!bundle) {
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
  }

  return {
    outputDir,
    pageCount: published.length,
    problems,
    warnings,
    report,
    written,
    inline: bundle !== null,
    inlineStats: bundle ? inlineTotals : null,
    bytes,
  };
}
