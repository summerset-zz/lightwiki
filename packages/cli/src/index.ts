#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildSite, checkSite, loadConfig, type BuildResult } from '@lightwiki/core';

const USAGE = `lightwiki CLI

Usage:
  wiki init [dir]                       scaffold a new site (config + sample content + Pages workflow)
  wiki dev [dir] [-p port]              start the preview server (live reload)
  wiki check [dir]                      validate frontmatter, sections, red links, orphans, translations
  wiki build [dir] [-o out] [--inline]  build a static site

Options:
  [dir]        content repo root containing wiki.config.ts (default: current directory)
  -p, --port   dev server port (default: 5173)
  --host       dev server host (default: 127.0.0.1)
  -o, --out    output directory (default: outputDir from config)
    --inline     inline CSS/JS/images/search index so the output is only .html
  --strict     treat red links and orphan pages as failures
  --name       site name for init (default: directory name)
  --force      init: overwrite existing files (default: skip)
  --no-watch   dev: disable the supervisor that restarts on packages/*/src changes

Exit codes: 0 ok, 1 problems found, 2 usage error`;

function line(text = ''): void {
  process.stdout.write(`${text}\n`);
}

function section(title: string): void {
  line('');
  line(title);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Artifact stats. Shared wording so the numbers mean the same thing everywhere.
 *
 * 体积分两行：第一行是总体积（含资源），第二行拆开写。
 * 资源可能是一个几 MB 的第三方库，混在一起会让「页面有多大」失去答案。
 */
function printArtifact(result: BuildResult, elapsed: number): void {
  const fileCount = result.written.length + result.assetFiles;
  const total = result.bytes + result.assetBytes;

  line(`  pages ${result.pageCount} | files ${fileCount} | ${formatBytes(total)} | ${elapsed} ms`);

  if (result.assetFiles > 0) {
    line(
      `  bytes: html+json ${formatBytes(result.bytes)} | assets ${formatBytes(
        result.assetBytes,
      )} (${result.assetFiles} file(s))`,
    );
  }

  if (result.inline) {
    const stats = result.inlineStats;
    line(
      `  output: single-file HTML (inlined ${stats?.css ?? 0} stylesheet(s), ${stats?.scripts ?? 0} script(s), ${stats?.media ?? 0} asset(s))`,
    );
  } else {
    line('  output: HTML + assets/ (add --inline for a single file)');
  }
}

function printOutcome(result: BuildResult): number {
  if (result.warnings.length > 0) {
    // 这些警告里有 build 阶段才会出现的（皮肤代码块的未知语言、内联时缺资源），
    // `wiki check` 看不到它们，所以直接把前几条打出来，别只说「去跑 check」。
    section(`${result.warnings.length} warning(s)`);
    for (const warning of result.warnings.slice(0, 10)) {
      line(`  ! ${warning.file}`);
      for (const message of warning.messages) line(`      - ${message}`);
    }
    if (result.warnings.length > 10) line(`  ... ${result.warnings.length - 10} more`);
  }

  if (result.undefinedMacros > 0) {
    const how =
      result.undefinedMacroMode === 'hide'
        ? "hidden (macros.undefined = 'hide')"
        : result.undefinedMacroMode === 'custom'
          ? 'handled by your own function'
          : "kept as-is in the output (macros.undefined = 'show')";
    line(`  note: ${result.undefinedMacros} undefined macro(s), ${how}`);
  }

  if (result.problems.length > 0) {
    section(`${result.problems.length} page(s) skipped because of frontmatter errors`);
    for (const problem of result.problems) {
      line(`  x ${problem.file}`);
      for (const message of problem.messages) line(`      - ${message}`);
    }
    return 1;
  }

  if (result.report.redLinks.length > 0) {
    line(
      `  note: ${result.report.redLinks.length} red link(s), ${result.report.orphans.length} orphan page(s) -- run wiki check`,
    );
  }
  return 0;
}

async function run(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (!command || command === '-h' || command === '--help') {
    line(USAGE);
    return 0;
  }

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      port: { type: 'string', short: 'p' },
      host: { type: 'string' },
      inline: { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      name: { type: 'string' },
      force: { type: 'boolean', default: false },
      watch: { type: 'boolean' },
      'no-watch': { type: 'boolean' },
    },
  });

  const root = resolve(positionals[0] ?? '.');
  const started = Date.now();

  // init 必须在读配置之前：这时候目录里还没有 wiki.config.ts
  if (command === 'init') {
    const { initSite } = await import('./init.js');
    const result = initSite(root, { name: values.name, force: values.force });

    line(`site created -> ${result.dir}`);
    for (const file of result.written) line(`  + ${file}`);
    for (const file of result.skipped) line(`  = ${file} (already exists, skipped)`);

    if (result.written.length > 0) {
      section('Next steps');
      line(`  cd ${positionals[0] ?? '.'}`);
      line(`  npx @lightwiki/cli dev .        # live preview`);
      line('  To publish on GitHub Pages, see the "Publishing" section in README.');
    }
    return 0;
  }

  const config = await loadConfig(root);

  if (command === 'dev') {
    const { CHILD_ENV, sourceRoots, supervise } = await import('./supervise.js');

    // 在 monorepo 源码里跑时默认开监护（改了包代码自动重启）；`--no-watch` 关掉。
    // `--watch` 只是把默认值写明白，方便脚本里读。
    const watchSetting =
      values.watch === true ? true : values['no-watch'] === true ? false : undefined;
    const roots = watchSetting === false ? [] : sourceRoots();
    const supervised = Boolean(process.env[CHILD_ENV]);

    if (roots.length > 0 && !supervised) {
      return supervise({ argv: ['dev', ...rest], roots });
    }

    const { startDevServer } = await import('@lightwiki/dev');
    const port = values.port ? Number(values.port) : undefined;
    if (port !== undefined && (!Number.isInteger(port) || port <= 0 || port > 65535)) {
      line(`invalid port: ${values.port}`);
      return 2;
    }

    const server = await startDevServer(config, {
      port,
      host: values.host,
      supervised,
      onRebuild: (info) => line(`  rebuilt | ${info.pages} page(s) | ${info.ms} ms`),
    });

    line(`preview: ${server.url}`);
    line(`  content: ${Object.entries(config.content).map(([lang, dir]) => `${lang}=${dir}`).join(' | ')}`);
    line('  Edits to content and layouts reload automatically. Press Ctrl+C to stop.');
    if (supervised) {
      line('  Changes under packages/*/src restart the server; you can also POST /__lightwiki/restart.');
    }

    await new Promise<void>((done) => {
      const stop = (): void => {
        void server.close().then(() => done());
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return 0;
  }

  if (command === 'check') {
    const result = await checkSite(config);

    line(`checking ${root}`);
    line(
      `  pages: ${result.pageCount} (${Object.keys(config.content)
        .map((lang) => `${lang} ${result.pageCounts[lang] ?? 0}`)
        .join(' / ')})`,
    );

    if (result.problems.length > 0) {
      section(`${result.problems.length} frontmatter error(s)`);
      for (const problem of result.problems) {
        line(`  x ${problem.file}`);
        for (const message of problem.messages) line(`      - ${message}`);
      }
    }

    if (result.warnings.length > 0) {
      section(`${result.warnings.length} warning(s)`);
      for (const warning of result.warnings.slice(0, 20)) {
        line(`  ! ${warning.file}`);
        for (const message of warning.messages) line(`      - ${message}`);
      }
      if (result.warnings.length > 20) line(`  ... ${result.warnings.length - 20} more`);
    }

    if (result.sectionIssues.length > 0) {
      section(`${result.sectionIssues.length} section value(s) not in the allowed list`);
      line(`  allowed: ${config.sections.join(' | ')}`);
      for (const issue of result.sectionIssues) {
        line(`  x ${issue.file} -> ${issue.section}`);
      }
    }

    if (result.layoutIssues.length > 0) {
      section(`${result.layoutIssues.length} layout file(s) missing`);
      line('  frontmatter says layout, but layouts/<name>.eta is in neither the content repo nor the theme');
      for (const issue of result.layoutIssues) {
        line(`  x ${issue.file} -> ${issue.layout}.eta`);
      }
    }

    if (result.assetIssues.length > 0) {
      section(`${result.assetIssues.length} missing style/script file(s)`);
      line('  frontmatter styles / scripts resolve against assets/ (.less compiles to a same-named .css)');
      for (const issue of result.assetIssues) {
        line(`  x ${issue.file} -> ${issue.field}: ${issue.reference}`);
      }
    }

    if (result.missingHomes.length > 0) {
      section(`${result.missingHomes.length} language(s) without a home page`);
      line('  every language needs content/<lang>/index.md -- that page IS /docs/');
      for (const lang of result.missingHomes) {
        line(`  x ${lang}: no index.md, so this language has no home page (404)`);
      }
    }

    if (result.categoryIssues.length > 0) {
      section(`${result.categoryIssues.length} category note(s)`);
      for (const issue of result.categoryIssues.slice(0, 20)) {
        line(`  - ${issue.file}: ${issue.message}`);
      }
      if (result.categoryIssues.length > 20) {
        line(`  ... ${result.categoryIssues.length - 20} more`);
      }
    }

    if (result.titleConflicts.length > 0) {
      section(`${result.titleConflicts.length} duplicate title(s) ([[]] links become ambiguous)`);
      for (const conflict of result.titleConflicts) {
        line(`  x [${conflict.lang}] "${conflict.title}" -> ${conflict.pages.join(', ')}`);
      }
    }

    const macroIssues = result.unresolved.filter((item) => item.kind === 'macro');
    const linkIssues = result.unresolved.filter((item) => item.kind === 'wikilink');

    if (macroIssues.length > 0) {
      section(`${macroIssues.length} undefined macro(s) (the raw {{...}} shows up in the output)`);
      for (const issue of macroIssues.slice(0, 30)) {
        line(`  x ${issue.file} -> {{${issue.target}}}: ${issue.message}`);
      }
      if (macroIssues.length > 30) line(`  ... ${macroIssues.length - 30} more`);
    }

    if (linkIssues.length > 0) {
      section(`${linkIssues.length} unresolved wikilink(s) (neither slug nor title matched)`);
      for (const issue of linkIssues.slice(0, 30)) {
        line(`  - ${issue.file} -> [[${issue.target}]]`);
      }
      if (linkIssues.length > 30) line(`  ... ${linkIssues.length - 30} more`);
    }

    if (result.report.redLinks.length > 0) {
      section(`${result.report.redLinks.length} red link(s) (target page does not exist)`);
      for (const red of result.report.redLinks.slice(0, 30)) {
        line(`  ${red.from} -> ${red.href}`);
      }
      if (result.report.redLinks.length > 30) {
        line(`  ... ${result.report.redLinks.length - 30} more`);
      }
    }

    if (result.report.orphans.length > 0) {
      section(`${result.report.orphans.length} orphan page(s) (nothing links to them)`);
      for (const orphan of result.report.orphans.slice(0, 30)) line(`  ${orphan}`);
      if (result.report.orphans.length > 30) {
        line(`  ... ${result.report.orphans.length - 30} more`);
      }
    }

    if (result.missingTranslations.length > 0) {
      section(`${result.missingTranslations.length} missing translation(s) (informational, not a failure)`);
      for (const item of result.missingTranslations.slice(0, 20)) {
        line(`  ${item.slug} -> missing ${item.missing.join(', ')}`);
      }
      if (result.missingTranslations.length > 20) {
        line(`  ... ${result.missingTranslations.length - 20} more`);
      }
    }

    const failed =
      !result.ok ||
      (values.strict === true &&
        (result.report.redLinks.length > 0 || result.report.orphans.length > 0));

    section(failed ? 'result: problems found' : 'result: ok');
    line(`  took ${Date.now() - started} ms`);
    return failed ? 1 : 0;
  }

  if (command === 'build') {
    const result = await buildSite(config, {
      outDir: values.out,
      // 没给 --inline 时不动配置里的值：站点可能本来就要单文件产物
      inline: values.inline ? true : undefined,
    });
    line(`build finished -> ${result.outputDir}`);
    printArtifact(result, Date.now() - started);
    return printOutcome(result);
  }

  line(`unknown command: ${command}`);
  line(USAGE);
  return 2;
}

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
