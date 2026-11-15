import { existsSync } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { LoadedConfig } from './config.js';
import { loadContent, type ContentProblem } from './content.js';
import { buildLinkReport, type LinkReport } from './links.js';
import { createRenderer } from './render.js';
import { langPrefix, normalizeBasePath } from './routes.js';
import { createIndexView, createPageView } from './view.js';

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

  const published = pages.filter((p) => !p.draft);

  for (const page of published) {
    const html = await renderer.renderLayout('doc', createPageView(config, pages, page) as unknown as Record<string, unknown>);
    const target = join(outputDir, page.outputPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html, 'utf8');
    written.push(page.outputPath);
  }

  // 每种语言一个目录页：既是导航入口，也是孤页判定的基准
  for (const lang of Object.keys(config.content)) {
    const indexPath = `${langPrefix(config, lang)}/docs/index.html`.replace(/^\//, '');
    const view = createIndexView(config, pages, lang) as unknown as Record<string, unknown>;
    const html = await renderer.renderLayout('index', view);
    const target = join(outputDir, indexPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html, 'utf8');
    written.push(indexPath);
  }

  // 根目录跳转到默认语言，方便 file:// 双击直接看
  const rootIndex = `<!doctype html><meta charset="utf-8"><title>${config.title}</title>` +
    `<meta http-equiv="refresh" content="0;url=${base}${langPrefix(config, config.defaultLanguage)}/docs/">` +
    `<p><a href="${base}${langPrefix(config, config.defaultLanguage)}/docs/">进入 ${config.title}</a></p>`;
  await writeFile(join(outputDir, 'index.html'), rootIndex, 'utf8');
  written.push('index.html');

  // 资源：内容仓库的 assets/ 与主题的 assets/
  const siteAssets = resolve(config.root, config.assetsDir);
  if (existsSync(siteAssets)) {
    await cp(siteAssets, join(outputDir, 'assets'), { recursive: true });
  }
  const themeAssets = join(config.themeDir, 'assets');
  if (existsSync(themeAssets)) {
    await cp(themeAssets, join(outputDir, 'assets', 'theme'), { recursive: true });
  }

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
