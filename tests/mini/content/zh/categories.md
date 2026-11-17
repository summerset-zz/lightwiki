---
title: 分类
keywords: 分类, category, 侧栏, sidebar
description: 分类的键是 ASCII slug，显示名放配置；分类页在构建时静态生成。
section: syntax
order: 7
updated: 2026-11-15
draft: false
categories: [syntax]
sidebarCategory: syntax
---

这一页的侧栏是「语法」分类的页面列表，因为它的 frontmatter 里写了 `sidebarCategory: syntax`。其他页面没有这一项，侧栏就是全站导航。

## 怎么标 {#mark}

在 frontmatter 里写分类的 slug：

```yaml
categories: [syntax, demo]
```

slug 用 ASCII，显示名放在站点配置里：

```ts
categories: { syntax: '语法', demo: '演示' }
```

这样做的理由是 URL 要稳定、也要能翻译。中文分类名直接进 URL 会同时带来编码和改名两个问题。没声明的分类会直接拿 slug 当显示名，`wiki check` 会提示。

## 分类页 {#page}

构建时为每个「实际被用到」的分类生成一页：`/categories/<slug>/`。

看这个：[语法分类页](/categories/syntax)。

没有自动生成的分类总览页。要总览就在某一页放 `{{catalog}}`，它会列出全部分类与计数。

## 从宏加分类 {#macro}

宏里调用 `it.addCategory("slug")` 就能给当前页加分，效果与写 frontmatter 一样。分类页在所有页面渲染完之后才生成，所以宏加的也能被收集到。
