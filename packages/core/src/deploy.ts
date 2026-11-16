import { buildSite, type BuildResult } from './build.js';
import type { LoadedConfig } from './config.js';

/**
 * 部署目标。目前只有 `dir` —— 把产物构建到本地目录，不碰任何远端。
 *
 * push 到仓库、生成 GitHub Pages 这些要在接入 remote 之后才做：它们 90% 的复杂度
 * 在认证与远端状态，不该跟编译链缠在一起。届时在这里加分支，`buildSite` 不用改。
 */
export type DeployTarget = 'dir';

export interface DeployOptions {
  target?: DeployTarget;
  /** 覆盖 config.outputDir */
  outDir?: string;
  /** 覆盖 config.inline */
  inline?: boolean;
}

export interface DeployResult extends BuildResult {
  target: DeployTarget;
}

/**
 * 准备可部署的产物。
 *
 * 与 `buildSite` 的差别只有一处：`deploy` 是「为发布而构建」的入口，
 * 将来 target 分支挂在这里；现在两者产出的字节完全一致。
 */
export async function deploySite(
  config: LoadedConfig,
  options: DeployOptions = {},
): Promise<DeployResult> {
  const target: DeployTarget = options.target ?? 'dir';
  const inline = options.inline ?? config.inline;

  const result = await buildSite(config, { outDir: options.outDir, inline });
  return { ...result, target };
}
