---
title: 产物结构
keywords: 简介, 轻维基, lightwiki, 静态站点, static site, markdown, 知识库, 入门, intro
description: 查看轻维基生成内容的结构
section: start
order: 5
updated: 2026-11-17
draft: false
---


## dist 里有什么 {#output}

一个只有两页的站，`npx @lightwiki/cli build .` 之后：

```
dist/
├── index.html                 一行跳转，进默认语言首页
├── 404.html                   静态托管约定的 404 页
├── meta.json                  这份产物是哪个版本、几页、什么时候构建的
├── search-index.json          站内搜索的索引
├── docs/
│   ├── index.html             首页，来自 content/zh/index.md
│   └── start/
│       └── index.html         一页一个目录，来自 content/zh/start.md
├── categories/
│   └── guide/index.html       页面写了 categories 才有这一层
└── assets/
    ├── …                      你放进 assets/ 的图片、样式
    └── theme/                 主题自带的样式与脚本
```

三件事值得记：

- **首页就是 `docs/index.html`**，它来自 `content/zh/index.md`，不是自动生成的目录页。
- **一页一个目录**：`content/zh/start.md` → `/docs/start/` → `docs/start/index.html`。
- **`assets/` 放样式和图片**：你自己的在 `assets/` 下，主题的单独归到 `assets/theme/`。
