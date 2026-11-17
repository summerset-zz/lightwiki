import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, watch, type FSWatcher } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `wiki dev` 的监护层。
 *
 * 起因：dev server 是在当前进程里 `import` core 的，改了 `packages/*\/src` 之后
 * ESM 模块缓存清不掉，只能重启进程。让用户每改一次代码就 Ctrl+C 再敲一遍不现实，
 * 所以这里套一层父进程：
 *
 *   父进程（本文件）  盯 packages/*\/src，一变就把子进程重新拉一遍
 *     └─ 子进程     真正的 dev server（stdio 直连终端，输出与原先完全一样）
 *
 * 重启一律走 `child.kill()`。进程一退，监听的 socket 由系统回收，下一任能立刻占回
 * 同一个端口（实测反复重启都在原端口）。让子进程自己 `server.close()` 反而更脆：
 * 浏览器的 SSE 会不断重连，close 的等待条件不稳。
 *
 * 用户也可以主动触发：`POST /__lightwiki/restart`，子进程以 RESTART_CODE 退出，
 * 父进程同样把它拉起来。
 */

/** 子进程环境变量：用来区分「被监护的那一层」和「监护者」，避免无限套娃 */
export const CHILD_ENV = 'LIGHTWIKI_DEV_CHILD';

/**
 * 子进程用这个退出码表示「请把我重启」。
 * 与 `packages/dev/src/index.ts` 的 RESTART_EXIT_CODE 保持一致。
 */
export const RESTART_CODE = 75;

const BIN = fileURLToPath(new URL('../bin/wiki.js', import.meta.url));
const PACKAGES_DIR = fileURLToPath(new URL('../..', import.meta.url));

/**
 * 值得盯的源码目录。
 *
 * 只在 monorepo 源码里成立：`@lightwiki/cli` 依赖 core / dev，所以从 npm 装下来时
 * `node_modules/@lightwiki/` 里同样有 `core/src`，光看目录存在会误判。
 * 差别在**父目录名**：源码里是 `packages/`，安装后是 `@lightwiki/`。
 */
export function sourceRoots(): string[] {
  if (basename(PACKAGES_DIR) !== 'packages') return [];
  if (!existsSync(PACKAGES_DIR)) return [];

  try {
    return readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(PACKAGES_DIR, entry.name, 'src'))
      .filter((dir) => existsSync(dir));
  } catch {
    return [];
  }
}

export interface SuperviseOptions {
  /** 原样转给子进程的参数，含 `dev` 本身 */
  argv: string[];
  /** 要盯的目录 */
  roots: string[];
  /** 变化后等多久再重启，默认 250ms（编辑器一次保存会触发好几个事件） */
  debounceMs?: number;
}

/**
 * 起监护层并一直跑到用户 Ctrl+C。返回值是应该退出的退出码。
 */
export function supervise(options: SuperviseOptions): Promise<number> {
  const debounceMs = options.debounceMs ?? 250;
  const watchers: FSWatcher[] = [];

  return new Promise<number>((done) => {
    let child: ChildProcess | null = null;
    let stopping = false;
    let restartPending = false;
    let timer: NodeJS.Timeout | undefined;
    let stopGuard: NodeJS.Timeout | undefined;

    const spawnChild = (): void => {
      child = spawn(process.execPath, [BIN, ...options.argv], {
        // 继承终端：子进程的日志直接打到当前终端，与不加监护时一模一样
        stdio: 'inherit',
        env: { ...process.env, [CHILD_ENV]: '1' },
      });

      child.on('exit', (code) => {
        child = null;
        if (stopping) {
          if (stopGuard) clearTimeout(stopGuard);
          done(0);
          return;
        }
        if (restartPending) {
          restartPending = false;
          spawnChild();
          return;
        }
        if (code === RESTART_CODE) {
          spawnChild();
          return;
        }
        // 子进程自己退了（配置加载失败、端口全占、真崩了）。
        // 不跟着退出：留在原地等下一次改动再拉起来，否则用户的终端就没了。
        process.stdout.write(
          `\ndev server exited (code ${code ?? 'unknown'}); it will start again when you touch a file, Ctrl+C to stop.\n`,
        );
      });
    };

    const restart = (reason: string): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!child) {
          process.stdout.write(`  ${reason}, restarting...\n`);
          spawnChild();
          return;
        }
        // 直接杀：进程一退，监听的 socket 由系统回收，下一任能立刻占回同一个端口。
        // 不先 close() 是为了不把「关得干不干净」的外部依赖算进重启路径里。
        restartPending = true;
        process.stdout.write(`  ${reason}, restarting...\n`);
        child.kill();
      }, debounceMs);
    };

    for (const root of options.roots) {
      try {
        watchers.push(watch(root, { recursive: true }, () => restart('source change detected')));
      } catch {
        // 目录被删了之类：少盯一个不影响用
      }
    }

    const stop = (): void => {
      stopping = true;
      for (const watcher of watchers) watcher.close();
      if (timer) clearTimeout(timer);
      if (!child) {
        done(0);
        return;
      }
      // Ctrl+C 在 Windows 上会同时发给子进程；这里只兜底，别把终端挂住
      stopGuard = setTimeout(() => {
        child?.kill();
        done(0);
      }, 3000);
    };

    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    process.stdout.write(
      `supervisor: changes under ${options.roots.length} source dir(s) restart the server (--no-watch to disable)\n`,
    );
    spawnChild();
  });
}
