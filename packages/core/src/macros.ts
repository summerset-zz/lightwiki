import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Eta } from 'eta';
import type { LoadedConfig } from './config.js';
import type { PageInfo, SiteInfo } from './context.js';

export interface MacroBase {
  /** 位置参数，已解析成字符串或数字 */
  args: Array<string | number>;
  /** 命名参数（`k: v`）；v1 只解析不使用，留给后续 */
  named: Record<string, string>;
  /** 当前页，与布局模板里的 `it.page` 是同一个对象 */
  page: PageInfo;
  /** 全站信息，与布局模板里的 `it.site` 是同一个对象 */
  site: SiteInfo;
  lang: string;
  /**
   * 模板之间的共享暂存区：一页一个，按文档顺序传递。
   *
   * 后面的宏能读到前面的宏写进去的值，反过来不行（渲染是顺序的）。
   * 皮肤里也有同一个对象（`it.shared`），且那时整页的宏都跑完了。
   */
  shared: Record<string, unknown>;
  /** 让宏可以给当前页登记分类 */
  addCategory: (name: string) => void;
}

export interface MacroContext extends MacroBase {
  /**
   * 在宏里调用另一个宏，返回已渲染的 HTML 片段。
   *
   * 为什么不写成 `{{另一个宏}}` 让引擎自己展开：宏的产物是待插入的 HTML 片段，
   * 再拿去跑一遍 markdown 解析会把已经成形的标签重新当成源码处理。
   * 显式调用能保证「已经渲染好的就是最终的」，也能做循环引用检测。
   */
  macro: (name: string, ...args: Array<string | number>) => string;
}

export interface MacroProblem {
  macro: string;
  message: string;
}

export interface MacroRegistry {
  /** 宏名大小写不敏感 */
  has(name: string): boolean;
  /** 同步渲染。返回值是**文本**（markdown / wikitext），会被再次解析 */
  render(name: string, base: MacroBase): string;
  names(): string[];
  problems: MacroProblem[];
}

/** 嵌套上限：宏是手动组合的，正常不会深过个位数 */
const MAX_MACRO_DEPTH = 20;

/** 宏是同步的：markdown-it 的渲染管线不允许 await */

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

  // autoTrim 必须关掉：Eta 默认会吃掉标签后面的换行，
  // 而宏产出的是 markdown —— 列表项、段落、表格全靠换行分组。
  const eta = new Eta({ autoEscape: true, cache: false, autoTrim: false });

  return {
    problems,
    has: (name) => sources.has(name.toLowerCase()),
    names: () => [...sources.keys()].sort(),
    render(name, base) {
      const stack: string[] = [];

      const run = (
        macroName: string,
        args: Array<string | number>,
        named: Record<string, string>,
      ): string => {
        const key = macroName.toLowerCase();
        const source = sources.get(key);
        if (source === undefined) {
          throw new Error(`undefined macro: ${macroName}`);
        }
        if (stack.includes(key)) {
          throw new Error(`macro cycle: ${[...stack, key].join(' -> ')}`);
        }
        if (stack.length >= MAX_MACRO_DEPTH) {
          throw new Error(`macro nesting deeper than ${MAX_MACRO_DEPTH}: ${[...stack, key].join(' -> ')}`);
        }

        stack.push(key);
        try {
          const context: MacroContext = {
            ...base,
            args,
            named,
            macro: (child, ...childArgs) => run(child, childArgs, {}),
          };
          const result: unknown = eta.renderString(source, context);
          if (typeof result !== 'string') {
            throw new Error(`macro ${macroName} must be synchronous (no await in the template)`);
          }
          return result;
        } finally {
          stack.pop();
        }
      };

      return run(name, base.args, base.named);
    },
  };
}

/** 预扫描用：列出所有可用的宏名，供 `wiki check` 提示 */
export function listMacroNames(registry: MacroRegistry): string[] {
  return registry.names();
}
