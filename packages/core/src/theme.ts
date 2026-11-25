import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { LoadedConfig } from './config.js';

/**
 * 主题文件的列举与「复制到本地」（`wiki theme list` / `wiki theme eject`）。
 *
 * 三类文件在构建时的优先级完全一致：**内容仓库优先，主题兜底**。
 * - `layouts/` 与 `macros/`：查找顺序本身就是 `root/…` → `themeDir/…`；
 * - `assets/`：构建时主题先落盘、用户后落盘，同名文件由用户盖掉。
 *
 * 所以「复制一份到本地」就能生效，不需要配置。代价是**那份文件不再跟随
 * 工具升级** —— 这条只在文档里说，工具无法替用户判断。
 */

/** 主题目录 → 内容仓库里的落点 */
const AREAS = [
  { from: 'layouts', to: 'layouts' },
  { from: 'macros', to: 'macros' },
  // 主题资源在产物里固定落在 `assets/theme/`，所以副本也放这里才对得上
  { from: 'assets', to: 'assets/theme' },
] as const;

export interface ThemeFile {
  /** 主题里的相对路径，如 `layouts/doc.eta`、`assets/style.css` */
  path: string;
  /** 内容仓库里的落点（相对内容根），如 `assets/theme/style.css` */
  target: string;
  /** 内容仓库里已经有这个文件了 */
  overridden: boolean;
}

/** 递归列出目录下的文件（posix 相对路径） */
async function walk(dir: string, prefix = ''): Promise<string[]> {
  if (!existsSync(dir)) return [];

  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walk(join(dir, entry.name), rel)));
      continue;
    }
    out.push(rel);
  }
  return out.sort();
}

/** 主题提供了哪些文件、哪些已经被本地覆盖 */
export async function listThemeFiles(config: LoadedConfig): Promise<ThemeFile[]> {
  const files: ThemeFile[] = [];

  for (const area of AREAS) {
    for (const path of await walk(join(config.themeDir, area.from))) {
      const target = `${area.to}/${path}`;
      files.push({
        path: `${area.from}/${path}`,
        target,
        overridden: existsSync(join(config.root, target)),
      });
    }
  }

  return files;
}

export interface EjectOptions {
  /** 只复制这一个（相对主题根，如 `layouts/doc.eta`） */
  only?: string;
  /** 覆盖内容仓库里已有的同名文件 */
  force?: boolean;
}

export interface EjectResult {
  written: string[];
  skipped: string[];
  /** 主题里没有 `only` 指定的那个文件 */
  missing: string | null;
}

/**
 * 把主题文件复制到内容仓库。
 *
 * 默认跳过已存在的文件：它们可能已经被改过，覆盖掉就是丢工作。
 */
export async function ejectTheme(
  config: LoadedConfig,
  options: EjectOptions = {},
): Promise<EjectResult> {
  const all = await listThemeFiles(config);
  const picked = options.only ? all.filter((file) => file.path === options.only) : all;

  if (options.only && picked.length === 0) {
    return { written: [], skipped: [], missing: options.only };
  }

  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of picked) {
    if (file.overridden && !options.force) {
      skipped.push(file.target);
      continue;
    }

    const source = join(config.themeDir, file.path);
    const target = join(config.root, file.target);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    written.push(file.target);
  }

  return { written, skipped, missing: null };
}
