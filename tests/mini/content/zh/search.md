---
title: 搜索与源码
keywords: 搜索, search, 索引, index, 源码, source, markdown, 查看源码
description: 搜索索引由工具生成、搜索框由主题实现；查看源码同理。这里说清两边的边界。
section: reference
order: 4
updated: 2026-11-16
draft: false
categories: [official]
---

这两个功能都遵守同一条线：**工具给数据，主题给界面**。想改长相就改布局或主题；想改数据就改配置。

## 搜索 {#search}

构建时会把每页的标题、关键词、section 与正文摘要打成一份索引。索引放哪取决于站点形态：

| 形态 | 索引在哪 |
|---|---|
| `directory` | 产物根的 `search-index.json`，页面里的搜索框去 fetch 它 |
| `file` / `inline` | 内联进每一页的 `<script type="application/json" id="lightwiki-search-index">` |

为什么要内联：`file://` 下浏览器不让 fetch，没有第二种办法让双击打开的页面能搜。

代价是每页都带一份全量索引，站点越大越明显。嫌大就缩摘要：

```ts
// wiki.config.ts
search: { enabled: true, excerpt: 160 },
```

完全不要搜索：

```ts
search: { enabled: false },
```

关掉以后 `it.site.search` 是 `null`，主题不会渲染搜索框，产物里也没有索引文件。

### 搜索框是谁画的 {#ui}

主题。`theme-default` 的布局里有 `<div data-lightwiki-search data-index="…">`，`assets/search.js` 负责输入防抖、打分排序、上下键选择与回车跳转。

所以你覆盖 `layouts/doc.eta` 时，要么保留这段结构，要么自己写——**工具不会注入搜索框**。它只保证「索引存在」，界面归你。

自己写的时候只需要两件事：

1. 容器带 `data-lightwiki-search`，`data-index` 填 `<%= it.site.search.url ?? '' %>`；
2. 里面有一个 `input[type="search"]` 和 `.search-results`。

`data-index` 为空（file / inline 模式）时就该去读页面里的内联索引。

## 查看源码 {#source}

每页底部有一个可折叠的「查看源码」，展开是本页的 markdown 原文（含 frontmatter）。

| 部分 | 谁给的 |
|---|---|
| 原文 | 工具，`it.page.markdown` |
| 折叠面板 | 主题，`<details>` + `<pre>`，**不需要 JS** |

在自己的布局里加一份：

```eta
<details>
  <summary>查看源码</summary>
  <pre><code><%= it.page.markdown %></code></pre>
</details>
```

`<%= %>` 会转义，所以原文里就算出现脚本标签也不会破坏页面。

它和 `it.page.source` 不是一回事——那个是「改编来源」，见 [行内指令](/directives)。
