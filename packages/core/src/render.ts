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

/**
 * 布局查找顺序（§3.1）：内容仓库 layouts/ → 主题包 layouts/ → 报错。
 * 这一层是主题可升级的全部机制 —— 用户只对自己覆盖的文件负责。
 */
export function createRenderer(config: LoadedConfig): Renderer {
  const eta = new Eta({ autoEscape: true, cache: false });

  function candidates(name: string): string[] {
    return [
      join(config.root, 'layouts', `${name}.eta`),
      join(config.themeDir, 'layouts', `${name}.eta`),
    ];
  }

  function resolveLayout(name: string): string {
    const found = candidates(name).find(existsSync);
    if (!found) {
      throw new Error(
        `找不到布局 ${name}.eta。找过：\n  ${candidates(name).join('\n  ')}`,
      );
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
