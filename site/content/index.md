---
title: 轻维基
keywords: 轻维基, lightwiki, markdown, 静态站点, 文档
description: 把 markdown + frontmatter 编译成一组可移植的静态文件。写一页，加一段配置，跑一条命令。
order: 0
layout: landing
styles: landing.css
updated: 2026-11-17
draft: false
---

本页面的大多数内容是直接写在皮肤`site/layouts/landing.eta`里的。本段是markdown正文的生成结果。点开下面的折叠区可以看到markdown原始内容。

我们在markdown中指定了`layout: landing`和`styles: landing.css`，表示使用`site/layouts/landing.eta`作为皮肤、额外加载`site/assets/landing.css`作为样式表。

一个合规页面至少要在frontmatter里包含`title`。关于frontmatter各字段的含义，请参考[此文档](/basics/frontmatter)