# @lightwiki/core

轻维基的核心：扫描 → 解析 → 渲染 → 链接图 → 写盘。

它不认识任何托管平台，也不做本地预览（那是 `@lightwiki/dev`）。**通常不需要直接安装** —— 装 `@lightwiki/cli` 就够了。

```ts
import { buildSite, checkSite, loadConfig } from '@lightwiki/core';

const config = await loadConfig('./my-wiki');
const result = await buildSite(config);
```

## 要点

- 三阶段：扫描 → 建索引 → 渲染（`[[标题]]` 要能看见后面才扫到的页面）
- 双链、宏、分类、404、重定向、代码高亮、Less、站内搜索索引
- 产物是一组可移植静态文件；`inline` 可产出单文件 HTML，`urlStyle: 'file'` 产出可双击浏览的相对链接版本

## 文档

- [上手指南](https://github.com/summerset-zz/lightwiki/blob/main/docs/getting-started.md)
- [语法手册（在线）](https://summerset-zz.github.io/lightwiki/)

## 许可

MIT
