import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Eta } from 'eta';
import type { LoadedConfig } from './config.js';

export interface MacroContext {
  /** 位置参数，已解析成字符串或数字 */
  args: Array<string | number>;
  /** 命名参数（`k: v`）；v1 只解析不使用，留给后续 */
  named: Record<string, string>;
  page: Record<string, unknown>;
  site: Record<string, unknown>;
  lang: string;
  /** 让宏可以给当前页登记分类 */
  addCategory: (name: string) => void;
}

export interface MacroProblem {
  macro: string;
  message: string;
}

export interface MacroRegistry {
  /** 宏名大小写不敏感 */
  has(name: string): boolean;
  /** 同步渲染，返回 HTML 片段 */
  render(name: string, context: MacroContext): string;
  names(): string[];
  problems: MacroProblem[];
}

/** 宏是同步的：markdown-it 的渲染管线不允许 await */
const NOT_SYNC = Symbol('not-sync');

/**
 * 载入宏。
 *
 * 查找顺序与布局一致：内容仓库 `macros/` → 主题包 `macros/`。
 * 全部预读到内存，因为 markdown-it 的 inline rule 只能同步执行。
 */
export async function loadMacros(config: LoadedConfig): Promise<MacroRegistry> {
  const sources = new Map<string, string>();
  const problems: MacroProblem[] = [];

  const dirs = [join(config.root, 'macros'), join(config.themeDir, 'macros')];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.eta')) continue;
      const name = entry.name.slice(0, -'.eta'.length);
      // 先找到的（内容仓库）优先，后找到的不覆盖
      if (sources.has(name.toLowerCase())) continue;
      sources.set(name.toLowerCase(), await readFile(join(dir, entry.name), 'utf8'));
    }
  }

  const eta = new Eta({ autoEscape: true, cache: false });

  return {
    problems,
    has: (name) => sources.has(name.toLowerCase()),
    names: () => [...sources.keys()].sort(),
    render(name, context) {
      const source = sources.get(name.toLowerCase());
      if (source === undefined) {
        throw new Error(`未定义的宏：${name}`);
      }
      const result: unknown = eta.renderString(source, context);
      if (result === NOT_SYNC || typeof result !== 'string') {
        throw new Error(`宏 ${name} 必须是同步的（模板里不能有 await）`);
      }
      return result;
    },
  };
}

/** 预扫描用：列出所有可用的宏名，供 `wiki check` 提示 */
export function listMacroNames(registry: MacroRegistry): string[] {
  return registry.names();
}
