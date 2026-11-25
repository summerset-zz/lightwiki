# @lightwiki/schema

轻维基的 frontmatter 与站点配置 schema（zod）。

它是 [轻维基（lightwiki）](https://github.com/summerset-zz/lightwiki) 的一部分。**通常不需要单独安装** —— 装 `@lightwiki/cli` 就够了。

```ts
import type { SiteConfigInput } from '@lightwiki/schema';

const config: SiteConfigInput = {
  title: '我的知识库',
  siteUrl: 'https://example.com',
  content: 'content/zh',
};

export default config;
```

## 文档

- [上手指南](https://github.com/summerset-zz/lightwiki/blob/main/docs/getting-started.md)
- [语法手册（在线）](https://summerset-zz.github.io/lightwiki/)

## 许可

MIT
