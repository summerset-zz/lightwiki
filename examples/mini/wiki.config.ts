import type { SiteConfigInput } from '@lightwiki/schema';

/**
 * 这个样例站就是轻维基的语法手册：内容用轻维基的语法写，再由轻维基渲染。
 * 所以它同时也是冒烟测试——任何语法坏掉，这里第一眼就能看出来。
 */
const config: SiteConfigInput = {
  title: '轻维基 · 语法手册',
  siteUrl: 'https://example.com',
  defaultLanguage: 'zh',
  content: {
    zh: 'content/zh',
    en: 'content/en',
  },
  sections: ['syntax', 'reference'],
  sectionLabels: {
    syntax: '语法',
    reference: '参考',
  },
  redirects: [{ from: '/docs/old-macros', to: '/docs/macros' }],
  categories: {
    syntax: '语法',
    demo: '演示',
    official: '官方口径',
  },
  outputDir: 'dist',
};

export default config;
