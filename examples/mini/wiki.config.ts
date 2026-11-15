import type { SiteConfigInput } from '@lightwiki/schema';

/** 仓库自带的最小样例：三篇内容、两种语言，CI 冒烟构建用它。 */
const config: SiteConfigInput = {
  title: 'Mini Wiki',
  siteUrl: 'https://example.com',
  defaultLanguage: 'zh',
  content: {
    zh: 'content/zh',
    en: 'content/en',
  },
  sections: ['guide'],
  outputDir: 'dist',
};

export default config;
