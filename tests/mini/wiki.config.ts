import type { SiteConfigInput } from '@lightwiki/schema';

/**
 * 本地默认值。GitHub Pages 上项目站点挂在子路径（`/<repo>/`）下，
 * 由 workflow 用环境变量覆盖，本地开发不受影响。
 *
 * 这里不直接写 `process`：这个文件不属于工具链的 tsconfig，
 * 不该为了读两个环境变量去依赖 @types/node。
 */
const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const siteUrl = env.LIGHTWIKI_SITE_URL ?? 'https://example.com';
const basePath = env.LIGHTWIKI_BASE_PATH ?? '/';

/**
 * 这个样例站就是轻维基的语法手册：内容用轻维基的语法写，再由轻维基渲染。
 * 所以它同时也是冒烟测试——任何语法坏掉，这里第一眼就能看出来。
 */
const config: SiteConfigInput = {
  title: '轻维基 · 语法手册',
  siteUrl,
  basePath,
  content: 'content/zh',
  sections: ['syntax', 'reference'],
  sectionLabels: {
    syntax: '语法',
    reference: '参考',
  },
  redirects: [{ from: '/old-macros', to: '/macros' }],
  categories: {
    syntax: '语法',
    demo: '演示',
    official: '官方口径',
  },
  outputDir: 'dist',
};

export default config;
