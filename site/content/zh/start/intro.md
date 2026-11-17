---
title: 简介
keywords: 简介, 轻维基, lightwiki, 静态站点, static site, markdown, 知识库, 入门, intro
description: 轻维基把 markdown 和 frontmatter 编译成一组可移植的静态文件，你只需要写内容。
section: start
order: 1
updated: 2026-11-17
draft: false
---

## 它是什么 {#what}

你用 markdown 写页面，开头加一小段 frontmatter：标题、分组、排序之类的几行声明。跑一条命令，得到一个 `dist/`。

`dist/` 里是纯静态文件：没有服务器、没有数据库、没有 SPA、没有外部 CDN。扔到任何静态托管、U 盘、甚至光盘镜像里，双击就能看。

## 和 MediaWiki 比一下 {#compare}

提到维基，多数人想到的是 MediaWiki：要一台服务器，装 PHP 和 MySQL，每看一次页面就现查一次数据库。

轻维基走另一头。页面在构建的时候就已经变成文件了，之后谁来看都不需要程序参与。代价是它不适合几百人同时在线编辑；好处是，你只需要写 markdown，剩下的活交给编译。

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

## 想立刻看一眼 {#try}

三个入口，按动手程度从少到多：

1. 线上语法示例站：<https://summerset-zz.github.io/lightwiki/>。每一页都在演示它自己讲的那个语法。
2. 模板仓库：<https://github.com/summerset-zz/lightwiki-starter>，点 **Use this template** 就有了自己的站。
3. 一条命令：

```bash
npx @lightwiki/cli init my-wiki
```

第三条要电脑上装了 Node.js，前两条不用。

## 接下来读什么 {#next}

- 不写代码、想让 AI 代劳 → [快速上手（不会代码）](/docs/start/quickstart-ai)
- 会用命令行 → [快速上手（会用命令行）](/docs/start/quickstart-dev)
- 想先弄清文件放哪 → [目录结构](/docs/start/structure)
