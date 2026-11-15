#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildSite, checkSite, loadConfig } from '@lightwiki/core';

const USAGE = `轻维基 CLI

用法：
  wiki dev [目录] [-p 端口]   启动本地预览（改动自动刷新）
  wiki check [目录]            校验 frontmatter、section、红链、孤页、缺译
  wiki build [目录] [-o 目录]  构建静态站点

参数：
  [目录]        含 wiki.config.ts 的内容仓库根目录，默认当前目录
  -p, --port    dev 端口，默认 5173
  --host        dev 监听地址，默认 127.0.0.1
  -o, --out     构建输出目录，默认取配置里的 outputDir
  --strict      红链与孤页也视为失败

退出码：0 正常；1 有错误；2 用法错误`;

function line(text = ''): void {
  process.stdout.write(`${text}\n`);
}

function section(title: string): void {
  line('');
  line(title);
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
      strict: { type: 'boolean', default: false },
    },
  });

  const root = resolve(positionals[0] ?? '.');
  const started = Date.now();
  const config = await loadConfig(root);

  if (command === 'dev') {
    const { startDevServer } = await import('@lightwiki/dev');
    const port = values.port ? Number(values.port) : undefined;
    if (port !== undefined && (!Number.isInteger(port) || port <= 0 || port > 65535)) {
      line(`端口不合法：${values.port}`);
      return 2;
    }

    const server = await startDevServer(config, {
      port,
      host: values.host,
      onRebuild: (info) => line(`  重建 · ${info.pages} 篇 · ${info.ms} ms`),
    });

    line(`预览地址：${server.url}`);
    line(`  内容：${Object.entries(config.content).map(([lang, dir]) => `${lang}=${dir}`).join(' · ')}`);
    line('  改动内容或模板会自动刷新；按 Ctrl+C 退出。');

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
    line(`  页面 ${result.pageCount} 篇（${Object.keys(config.content)
      .map((lang) => `${lang} ${result.pageCount > 0 ? '' : ''}`.trim())
      .join(' / ')}）`);

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
    const result = await buildSite(config, { outDir: values.out });
    line(`构建完成 → ${result.outputDir}`);
    line(`  页面 ${result.pageCount} 篇 · 文件 ${result.written.length} 个 · 用时 ${Date.now() - started} ms`);

    if (result.warnings.length > 0) {
      line(`  警告 ${result.warnings.length} 处（wiki check 可看详情）`);
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
      line(`  提示：${result.report.redLinks.length} 处红链、${result.report.orphans.length} 篇孤页，用 wiki check 查看`);
    }
    return 0;
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
