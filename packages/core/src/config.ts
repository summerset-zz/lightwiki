import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  siteConfigSchema,
  describeIssues,
  type SiteConfig,
  type SiteConfigInput,
} from '@lightwiki/schema';

export interface LoadedConfig extends SiteConfig {
  /** 内容仓库根目录的绝对路径 */
  root: string;
  /** 主题包的绝对路径（含 layouts/ 与 assets/） */
  themeDir: string;
}

/** monorepo 内自带的默认主题，作为包解析失败时的兜底 */
const BUNDLED_THEME = fileURLToPath(new URL('../../theme-default', import.meta.url));

const CONFIG_FILES = [
  'wiki.config.ts',
  'wiki.config.mts',
  'wiki.config.mjs',
  'wiki.config.js',
];

/**
 * 载入 `wiki.config.*`。
 *
 * 用动态 import 而不是读 JSON：配置里迟早要放函数（例如自定义 slug 规则），
 * 而 TS 配置在 tsx / Vite 下都能直接跑，不需要预编译。
 */
export async function loadConfig(root: string): Promise<LoadedConfig> {
  const absRoot = resolve(root);
  const configFile = CONFIG_FILES.map((name) => join(absRoot, name)).find((p) => existsSync(p));

  if (!configFile) {
    throw new Error(
      `在 ${absRoot} 找不到站点配置。请创建其一：${CONFIG_FILES.join(' / ')}`,
    );
  }

  const mod = (await import(pathToFileURL(configFile).href)) as {
    default?: SiteConfigInput;
  };
  const raw = mod.default;
  if (!raw) {
    throw new Error(`${configFile} 需要 export default 一个配置对象`);
  }

  const parsed = siteConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = describeIssues(parsed.error.issues).map((l) => `  - ${l}`);
    throw new Error(`站点配置有误（${configFile}）：\n${lines.join('\n')}`);
  }

  return {
    ...parsed.data,
    root: absRoot,
    themeDir: resolveTheme(parsed.data.theme, absRoot),
  };
}

/**
 * 主题既可以是包名，也可以是相对/绝对路径。
 * 顺序：先当路径试，再当包解析 —— 本地开发覆盖主题时更顺手。
 */
function resolveTheme(spec: string, root: string): string {
  if (isAbsolute(spec) || spec.startsWith('.')) {
    return resolve(root, spec);
  }

  try {
    // 从内容仓库根目录解析，才能找到它自己 node_modules 里的主题包
    const requireFromSite = createRequire(join(root, 'noop.cjs'));
    return dirname(requireFromSite.resolve(`${spec}/package.json`));
  } catch {
    return BUNDLED_THEME;
  }
}
