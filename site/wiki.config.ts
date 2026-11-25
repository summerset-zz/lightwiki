import type { SiteConfigInput } from '@lightwiki/schema';

/**
 * 主站（文档中心）的站点配置。
 *
 * 这里是**面向用户**的文档：按「开始 / 基础 / 高级」三类读者的顺序组织，
 * 与 `tests/mini`（语法回归测试）分开维护。
 *
 * `basePath` 由 CI 注入（GitHub Pages 的项目站点挂在 `/<仓库名>/` 下）；
 * 本地预览时是 `/`。
 */
const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const config: SiteConfigInput = {
  title: '轻维基',
  siteUrl: 'https://summerset-zz.github.io/lightwiki',
  basePath: env.LIGHTWIKI_BASE_PATH ?? '/',
  content: 'content',
  sections: ['start', 'basics', 'advanced'],
  sectionLabels: {
    start: '开始',
    basics: '基础',
    advanced: '高级',
  },
  outputDir: 'dist',
};

export default config;
