import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Eta } from 'eta';
import type { LoadedConfig } from './config.js';

export interface Renderer {
  renderLayout(name: string, data: Record<string, unknown>): Promise<string>;
  /** 模板实际来自哪里，用于诊断「为什么我的覆盖没生效」 */
  resolveLayout(name: string): string;
}

/** 布局名只能是一段文件名：带了路径就能把模板解析到仓库外面去 */
const LAYOUT_NAME = /^[A-Za-z0-9._-]+$/;

/** 某个布局会去哪些地方找（顺序即优先级）；`check` 也用它判断布局存不存在 */
export function layoutCandidates(config: LoadedConfig, name: string): string[] {
  return [
    join(config.root, 'layouts', `${name}.eta`),
    join(config.themeDir, 'layouts', `${name}.eta`),
  ];
}

/**
 * 布局查找顺序（§3.1）：内容仓库 layouts/ → 主题包 layouts/ → 报错。
 * 这一层是主题可升级的全部机制 —— 用户只对自己覆盖的文件负责。
 */
export function createRenderer(config: LoadedConfig): Renderer {
  // `views` 指向内容仓库的 layouts/：让皮肤能 include 同目录下的片段
  // （比如所有页面共用的顶栏 `nav.eta`），不用把同一段 HTML 抄进每个皮肤。
  //
  // 只设内容仓库这一处，主题包不参与解析：主题的皮肤不能假设用户仓库里
  // 一定有某个文件，否则一个空站点连页面都渲染不出来。
  const eta = new Eta({
    autoEscape: true,
    cache: false,
    views: join(config.root, 'layouts'),
  });

  function resolveLayout(name: string): string {
    if (!LAYOUT_NAME.test(name)) {
      throw new Error(`invalid layout name: ${name} (must be a single file name, e.g. landing)`);
    }
    const candidates = layoutCandidates(config, name);
    const found = candidates.find(existsSync);
    if (!found) {
      throw new Error(`layout ${name}.eta not found. Looked in:\n  ${candidates.join('\n  ')}`);
    }
    return found;
  }

  return {
    resolveLayout,
    async renderLayout(name, data) {
      const file = resolveLayout(name);
      const source = await readFile(file, 'utf8');
      return eta.renderString(source, data);
    },
  };
}
