import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { collectAssets, copyAssets } from './assets.js';
import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem, type Page } from './content.js';
import { createSiteInfo } from './context.js';
import { createInlineBundle, inlineHtml, type InlineBundle } from './inline.js';
import { buildLinkReport, normUrl, type LinkReport } from './links.js';
import { assetList, injectPageAssets, isExternalUrl, pageAssetUrl, resolvePageAsset, scriptList } from './page-assets.js';
import { createRenderer } from './render.js';
import { relativeUrl, rewriteRelativeLinks } from './relative.js';
import { categoryOutputPath, INDEX_SLUG, indexOutputPath, langPrefix, normalizeBasePath, pageUrl, SEARCH_INDEX_FILE, shouldInlineSearch, urlToOutputPath, withBasePath } from './routes.js';
import { buildSearchIndex, injectSearchIndex } from './search.js';
import {
  createCategoryView,
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
  /** 未定义的宏有几处（产物里保留原文 / 隐藏 / 自定义，看配置） */
  undefinedMacros: number;
  /** 当前对未定义宏的处理方式，CLI 据此拼提示文案 */
  undefinedMacroMode: 'show' | 'hide' | 'custom';
}

export async function buildSite(
  rawConfig: LoadedConfig,
  options: BuildOptions = {},
): Promise<BuildResult> {
  // `--inline` 与配置里的 `inline: true` 等价，但对内只能是同一个值：
  // 搜索索引内联（`shouldInlineSearch`）读的是 `config.inline`，如果只把命令行参数
  // 当作局部变量，资源内联了、`search-index.json` 却仍会单独落盘，
  // 「产物只有 .html」就不成立。所以这里先算出生效值，下游一律看它。
  const inlineMode = options.inline ?? rawConfig.inline;
  const config: LoadedConfig =
    inlineMode === rawConfig.inline ? rawConfig : { ...rawConfig, inline: inlineMode };

  const outputDir = resolve(config.root, options.outDir ?? config.outputDir);
  const { pages, problems, warnings } = await loadContent(config);

  // 未解析的内链/未定义的宏进 build 的警告列表，否则产物里会静默露出占位或原文
  for (const page of pages) {
    for (const item of page.unresolved) {
      warnings.push({
        file: `${page.lang}/${page.slug}`,
        messages: [`${item.kind === 'macro' ? 'macro' : 'wikilink'} ${item.target}: ${item.message}`],
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

  /**
   * 页面级样式/脚本：解析成站内地址。
   *
   * 找不到不算构建失败 —— 页面本身是好的，少一个样式表不该让整站出不来；
   * 但会记成警告，`wiki check` 里则是错误。
   */
  const pageAssetsOf = (page: Page): { styles: string[]; scripts: Array<{ src: string; module: boolean }> } => {
    const resolveOne = (ref: string, field: string): string | null => {
      // 站外地址（CDN）原样透传：不查本地文件，也不加 basePath
      if (isExternalUrl(ref)) return ref.trim();
      const hit = resolvePageAsset(config, ref);
      if (!hit) {
        warnings.push({
          file: `${page.lang}/${page.slug}`,
          messages: [`${field}: file not found: ${ref} (resolved against ${config.assetsDir}/)`],
        });
        return null;
      }
      return pageAssetUrl(config, hit.rel);
    };

    return {
      styles: assetList(page.data.styles)
        .map((ref) => resolveOne(ref, 'styles'))
        .filter((url): url is string => url !== null),
      scripts: scriptList(page.data.scripts)
        .map((entry) => {
          const url = resolveOne(entry.src, 'scripts');
          return url === null ? null : { src: url, module: entry.module };
        })
        .filter((entry): entry is { src: string; module: boolean } => entry !== null),
    };
  };
  // file 模式下站内链接一律相对：`file://` 下的 `/docs/a.html` 会指到盘符根
  const relativeMode = config.urlStyle === 'file';
  // 索引内联（file / inline 模式）：每页一份，url 相对当前页
  const searchInline = config.search.enabled && shouldInlineSearch(config);

  /**
   * 所有 HTML 的唯一出口：内联与相对化在这里改写，顺便统计体积。
   * `absolute` 用于 404.html —— 它可能在任意深度被打开，相对路径会错。
   */
  const emit = async (
    relative: string,
    html: string,
    options: { absolute?: boolean; page?: Page } = {},
  ): Promise<void> => {
    let content = html;

    // 页面级样式/脚本先插：后面 inline 才能把它们一起内联进去
    if (options.page) {
      const resolved = pageAssetsOf(options.page);
      content = injectPageAssets(content, resolved.styles, resolved.scripts);
    }

    if (bundle) {
      // 注意传 content 而不是 html：页面级 styles / scripts 是刚插进去的，
      // 拿原始 html 去内联会把它们整个丢掉（曾经就是这样，单文件产物里少样式）
      const inlined = inlineHtml(content, relative, bundle, base);
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
          messages: [`asset not found while inlining, kept as an external reference: ${miss}`],
        });
      }
    }

    if (relativeMode && !options.absolute) {
      content = rewriteRelativeLinks(content, relative, config, pageKeys);
    }

    // 索引最后注入：不参与内联与相对化，它自己已经按页面算好了地址
    if (searchInline) {
      content = injectSearchIndex(
        content,
        buildSearchIndex(config, published, { fromPath: relative }),
      );
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

  // 相对化时用它判断「这不是资源而是页面」：比猜前缀可靠，docsDir 配成空串也不怕
  const pageKeys = new Set(published.map((page) => normUrl(page.url, config)));

  for (const page of published) {
    const view = createPageView(config, pages, page, siteInfo) as unknown as Record<string, unknown>;
    // 页面可以自己挑布局（frontmatter 的 layout），不写就用主题的 doc
    const html = await renderer.renderLayout(page.data.layout ?? 'doc', view);
    await emit(page.outputPath, html, { page });
  }

  // 首页（`/docs/` 或 docsDir 指定的位置）就是内容里的 `index.md`，走上面的普通页面循环。
  // 以前这里会额外生成一张目录页，现在那一页由作者提供 —— 想列全站就用 {{catalog}} / {{pages}}。

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
            messages: [`redirect would overwrite an existing page, skipped: ${relative}`],
          });
          continue;
        }

        // 跳转地址在 file 模式下要跟着相对化（meta refresh 与 JS 都要用）；
        // canonical 必须是绝对地址，否则对搜索引擎没有意义。
        //
        // `rule.to` 是作者写的站内路径，不含 basePath。两条路径都要补上：
        // 少了它，项目站点（`/<repo>/`）上 meta refresh 会跳到域名根，canonical 也会指错。
        const html = await renderer.renderLayout('redirect', {
          site: siteInfo,
          from: rule.from,
          to: rule.to,
          href: relativeMode ? relativeUrl(rule.to, relative, config) : withBasePath(rule.to, config),
          canonical: `${config.siteUrl.replace(/\/+$/, '')}${withBasePath(rule.to, config)}`,
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

  // 根目录跳转到默认语言首页，方便 file:// 双击直接看。
  // 若首页本身就在根上（`docsDir: ''`），产物已经是 index.html，不再多写一张跳转页。
  const homeHref = pageUrl(config, config.defaultLanguage, INDEX_SLUG);
  if (indexOutputPath(config, config.defaultLanguage) !== 'index.html') {
    const href =
      config.urlStyle === 'file' ? relativeUrl(homeHref, 'index.html', config, pageKeys) : homeHref;
    const rootIndex = `<!doctype html><meta charset="utf-8"><title>${config.title}</title>` +
      `<meta http-equiv="refresh" content="0;url=${href}">` +
      `<p><a href="${href}">Enter ${config.title}</a></p>`;
    await emit('index.html', rootIndex);
  }

  // 资源：内容仓库的 assets/ 与主题的 assets/。`.less` 在这里编译成同名 `.css`。
  // 内联模式已经把它们读进内存了，不再落盘。
  if (!bundle) {
    await copyAssets(resolve(config.root, config.assetsDir), join(outputDir, 'assets'));
    await copyAssets(join(config.themeDir, 'assets'), join(outputDir, 'assets', 'theme'));
  }

  // 搜索索引：能 fetch 就写 json，不能（file / inline）就跟着页面走，已在 emit 里注入。
  if (config.search.enabled && !searchInline) {
    const body = `${JSON.stringify(buildSearchIndex(config, published))}\n`;
    await writeFile(join(outputDir, SEARCH_INDEX_FILE), body, 'utf8');
    written.push(SEARCH_INDEX_FILE);
    bytes += Buffer.byteLength(body, 'utf8');
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

  const undefinedMacroList = pages.flatMap((page) =>
    page.unresolved.filter((item) => item.undefinedMacro).map((item) => item.target),
  );
  const rawMacroMode = config.macros?.undefined ?? 'show';
  const undefinedMacroMode =
    typeof rawMacroMode === 'function' ? 'custom' : rawMacroMode;

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
    undefinedMacros: undefinedMacroList.length,
    undefinedMacroMode,
  };
}
