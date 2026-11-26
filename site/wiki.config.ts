import type { SiteConfigInput } from '@lightwiki/schema';

/**
 * 主站（文档中心）的站点配置。
 *
 * 这里是**面向用户**的文档：按「开始 → 基础 → 高级 → 发布 → 配置指引」的
 * 读者任务顺序组织，与 `tests/mini`（语法回归测试）分开维护。
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
  sections: ['start', 'basics', 'advanced', 'deploy', 'reference'],
  sectionLabels: {
    start: '开始',
    basics: '基础',
    advanced: '高级',
    deploy: '发布',
    reference: '配置指引',
  },
  // 0.6 调整过一次目录：旧地址都留一条跳转，外部收藏不会断。
  redirects: [
    { from: '/basics/styles', to: '/advanced/styles' },
    { from: '/basics/javascript', to: '/advanced/javascript' },
    { from: '/basics/code-highlight', to: '/advanced/code-highlight' },
    { from: '/basics/skins', to: '/advanced/skins' },
    { from: '/advanced/config', to: '/reference/config' },
    { from: '/advanced/cli', to: '/reference/cli' },
    { from: '/advanced/deploy-pages', to: '/deploy/pages' },
    { from: '/advanced/deploy-chm', to: '/deploy/chm' },
    { from: '/advanced/deploy-server', to: '/deploy/server' },
  ],
  outputDir: 'dist',
};

export default config;
