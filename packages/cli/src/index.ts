#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildSite, checkSite, deploySite, loadConfig, type BuildResult } from '@lightwiki/core';

const USAGE = `轻维基 CLI

用法：
  wiki init [目录]                     生成新站点（配置 + 示例内容 + Pages workflow）
  wiki dev [目录] [-p 端口]           启动本地预览（改动自动刷新）
  wiki check [目录]                    校验 frontmatter、section、红链、孤页、缺译
  wiki build [目录] [-o 目录] [--inline]   构建静态站点
  wiki deploy [目录] [-o 目录] [--inline]  构建可部署产物（目前只输出到本地目录）

参数：
  [目录]        含 wiki.config.ts 的内容仓库根目录，默认当前目录
  -p, --port    dev 端口，默认 5173
  --host        dev 监听地址，默认 127.0.0.1
  -o, --out     构建输出目录，默认取配置里的 outputDir
  --inline      内联 CSS/JS/图片，产物里只剩 .html（不产 assets/ 与 meta.json）
  --strict      红链与孤页也视为失败
  --name        init 时的站点名，默认取目录名
  --force       init 时覆盖已存在的文件（默认跳过）
  --no-watch    dev 时关掉「改了 packages/*/src 自动重启」的监护层

退出码：0 正常；1 有错误；2 用法错误`;

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

/** 产物统计：体积与形态用同一套口径，build 与 deploy 都打印它 */
function printArtifact(result: BuildResult, elapsed: number): void {
  line(
    `  页面 ${result.pageCount} 篇 · 文件 ${result.written.length} 个 · ${formatBytes(
      result.bytes,
    )} · 用时 ${elapsed} ms`,
  );

  if (result.inline) {
    const stats = result.inlineStats;
    line(
      `  形态：单文件 HTML（已内联 样式表 ${stats?.css ?? 0} 个 / 脚本 ${stats?.scripts ?? 0} 个 / 资源 ${stats?.media ?? 0} 处）`,
    );
  } else {
    line('  形态：HTML + assets/（加 --inline 可改成单文件）');
  }
}

function printOutcome(result: BuildResult): number {
  if (result.warnings.length > 0) {
    line(`  警告 ${result.warnings.length} 处（wiki check 可看详情）`);
  }

  if (result.undefinedMacros > 0) {
    const how =
      result.undefinedMacroMode === 'hide'
        ? "已隐藏（macros.undefined = 'hide'）"
        : result.undefinedMacroMode === 'custom'
          ? '已交给自定义函数处理'
          : "产物里保留原文（macros.undefined = 'show'）";
    line(`  提示：${result.undefinedMacros} 处未定义的宏，${how}`);
  }

  if (result.problems.length > 0) {
    section(`有 ${result.problems.length} 篇因 frontmatter 错误被跳过`);
    for (const problem of result.problems) {
      line(`  ✗ ${problem.file}`);
      for (const message of problem.messages) line(`      - ${message}`);
    }
    return 1;
  }

  if (result.report.redLinks.length > 0) {
    line(
      `  提示：${result.report.redLinks.length} 处红链、${result.report.orphans.length} 篇孤页，用 wiki check 查看`,
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

    line(`已生成站点 → ${result.dir}`);
    for (const file of result.written) line(`  + ${file}`);
    for (const file of result.skipped) line(`  = ${file}（已存在，跳过）`);

    if (result.written.length > 0) {
      section('下一步');
      line(`  cd ${positionals[0] ?? '.'}`);
      line('  npx @lightwiki/cli dev .        # 本地预览，改内容会自动刷新');
      line('  发布到 GitHub Pages：见 README 的「发布」一节');
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
      line(`端口不合法：${values.port}`);
      return 2;
    }

    const server = await startDevServer(config, {
      port,
      host: values.host,
      supervised,
      onRebuild: (info) => line(`  重建 · ${info.pages} 篇 · ${info.ms} ms`),
    });

    line(`预览地址：${server.url}`);
    line(`  内容：${Object.entries(config.content).map(([lang, dir]) => `${lang}=${dir}`).join(' · ')}`);
    line('  改动内容或模板会自动刷新；按 Ctrl+C 退出。');
    if (supervised) {
      line('  改了 packages/*/src 会自动重启；也可以 POST /__lightwiki/restart 手动触发。');
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

    line(`内容检查 · ${root}`);
    line(
      `  页面 ${result.pageCount} 篇（${Object.keys(config.content)
        .map((lang) => `${lang} ${result.pageCounts[lang] ?? 0}`)
        .join(' / ')}）`,
    );

    if (result.problems.length > 0) {
      section(`frontmatter 错误 ${result.problems.length} 处`);
      for (const problem of result.problems) {
        line(`  ✗ ${problem.file}`);
        for (const message of problem.messages) line(`      - ${message}`);
      }
    }

    if (result.warnings.length > 0) {
      section(`警告 ${result.warnings.length} 处`);
      for (const warning of result.warnings.slice(0, 20)) {
        line(`  ! ${warning.file}`);
        for (const message of warning.messages) line(`      - ${message}`);
      }
      if (result.warnings.length > 20) line(`  …另有 ${result.warnings.length - 20} 处`);
    }

    if (result.sectionIssues.length > 0) {
      section(`section 取值不在允许列表 ${result.sectionIssues.length} 处`);
      line(`  允许值：${config.sections.join(' · ')}`);
      for (const issue of result.sectionIssues) {
        line(`  ✗ ${issue.file} → ${issue.section}`);
      }
    }

    if (result.layoutIssues.length > 0) {
      section(`布局文件不存在 ${result.layoutIssues.length} 处`);
      line('  frontmatter 里写了 layout，但 layouts/<名字>.eta 在内容仓库和主题里都找不到');
      for (const issue of result.layoutIssues) {
        line(`  ✗ ${issue.file} → ${issue.layout}.eta`);
      }
    }

    if (result.assetIssues.length > 0) {
      section(`样式/脚本文件不存在 ${result.assetIssues.length} 处`);
      line('  frontmatter 的 styles / scripts 相对 assets/ 解析（.less 会编译成同名 .css）');
      for (const issue of result.assetIssues) {
        line(`  ✗ ${issue.file} → ${issue.field}: ${issue.reference}`);
      }
    }

    if (result.missingHomes.length > 0) {
      section(`缺首页 ${result.missingHomes.length} 处`);
      line('  每种语言都要有 content/<语言>/index.md —— 它就是该语言的首页（/docs/）');
      for (const lang of result.missingHomes) {
        line(`  ✗ ${lang}：没有 index.md，这个语言的首页会 404`);
      }
    }

    if (result.categoryIssues.length > 0) {
      section(`分类提示 ${result.categoryIssues.length} 处`);
      for (const issue of result.categoryIssues.slice(0, 20)) {
        line(`  · ${issue.file}：${issue.message}`);
      }
      if (result.categoryIssues.length > 20) {
        line(`  …另有 ${result.categoryIssues.length - 20} 处`);
      }
    }

    if (result.titleConflicts.length > 0) {
      section(`标题重复 ${result.titleConflicts.length} 组（[[标题]] 这种内链会变得不明确）`);
      for (const conflict of result.titleConflicts) {
        line(`  ✗ [${conflict.lang}] 「${conflict.title}」→ ${conflict.pages.join('、')}`);
      }
    }

    const macroIssues = result.unresolved.filter((item) => item.kind === 'macro');
    const linkIssues = result.unresolved.filter((item) => item.kind === 'wikilink');

    if (macroIssues.length > 0) {
      section(`未定义的宏 ${macroIssues.length} 处（产物里会露出 {{...}} 原文）`);
      for (const issue of macroIssues.slice(0, 30)) {
        line(`  ✗ ${issue.file} → {{${issue.target}}}：${issue.message}`);
      }
      if (macroIssues.length > 30) line(`  …另有 ${macroIssues.length - 30} 处`);
    }

    if (linkIssues.length > 0) {
      section(`未解析的内链 ${linkIssues.length} 处（slug 与标题都没命中）`);
      for (const issue of linkIssues.slice(0, 30)) {
        line(`  · ${issue.file} → [[${issue.target}]]`);
      }
      if (linkIssues.length > 30) line(`  …另有 ${linkIssues.length - 30} 处`);
    }

    if (result.report.redLinks.length > 0) {
      section(`红链 ${result.report.redLinks.length} 处（指向不存在的页面）`);
      for (const red of result.report.redLinks.slice(0, 30)) {
        line(`  ${red.from} → ${red.href}`);
      }
      if (result.report.redLinks.length > 30) {
        line(`  …另有 ${result.report.redLinks.length - 30} 处`);
      }
    }

    if (result.report.orphans.length > 0) {
      section(`孤页 ${result.report.orphans.length} 篇（没有任何页面链向它）`);
      for (const orphan of result.report.orphans.slice(0, 30)) line(`  ${orphan}`);
      if (result.report.orphans.length > 30) {
        line(`  …另有 ${result.report.orphans.length - 30} 篇`);
      }
    }

    if (result.missingTranslations.length > 0) {
      section(`缺译 ${result.missingTranslations.length} 处（只提示，不算失败）`);
      for (const item of result.missingTranslations.slice(0, 20)) {
        line(`  ${item.slug} → 缺 ${item.missing.join(', ')}`);
      }
      if (result.missingTranslations.length > 20) {
        line(`  …另有 ${result.missingTranslations.length - 20} 处`);
      }
    }

    const failed =
      !result.ok ||
      (values.strict === true &&
        (result.report.redLinks.length > 0 || result.report.orphans.length > 0));

    section(failed ? '结果：有问题' : '结果：通过');
    line(`  用时 ${Date.now() - started} ms`);
    return failed ? 1 : 0;
  }

  if (command === 'build') {
    const result = await buildSite(config, {
      outDir: values.out,
      // 没给 --inline 时不动配置里的值：站点可能本来就要单文件产物
      inline: values.inline ? true : undefined,
    });
    line(`构建完成 → ${result.outputDir}`);
    printArtifact(result, Date.now() - started);
    return printOutcome(result);
  }

  if (command === 'deploy') {
    const result = await deploySite(config, {
      outDir: values.out,
      inline: values.inline ? true : undefined,
    });
    line(`部署产物就绪 → ${result.outputDir}`);
    line('  目标：本地目录 · remote 未接入，没有推送任何东西');
    printArtifact(result, Date.now() - started);
    return printOutcome(result);
  }

  line(`未知命令：${command}`);
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
