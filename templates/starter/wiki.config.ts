/**
 * 站点配置。每个字段的含义见 `docs/getting-started.md`。
 *
 * 注意：如果这个内容仓库**不在** lightwiki 仓库目录内，就不要 import 类型——
 * 那会解析不到 `@lightwiki/schema` 而直接加载失败。
 * 只有把内容放在 lightwiki 目录里时，才可以：
 *
 *   import type { SiteConfigInput } from '@lightwiki/schema';
 *   const config: SiteConfigInput = { ... };
 *   export default config;
 */
export default {
  /** 站点名，出现在页面标题与侧栏顶部 */
  title: '我的知识库',
  /** 站点地址，用于拼接绝对链接（sitemap、canonical） */
  siteUrl: 'https://example.com',
  /** 默认语言。默认语言的页面地址不带语言前缀 */
  defaultLanguage: 'zh',
  /** 语言 → 内容目录。加一门语言就在这里加一行 */
  content: {
    zh: 'content/zh',
  },
  /** 分组顺序，就是侧栏的顺序 */
  sections: ['guide'],
  /** 分组的显示名 */
  sectionLabels: {
    guide: '指南',
  },
};
