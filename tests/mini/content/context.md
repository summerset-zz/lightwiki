---
title: 模板上下文
keywords: 上下文, context, it.page, it.site, 魔术字, magic word
description: it.page 与 it.site 是布局与宏共用的对象，相当于 MediaWiki 的魔术字。
section: syntax
order: 8
updated: 2026-11-15
draft: false
categories: [syntax]
---

`it` 就是模板里的数据对象。MediaWiki 要专门的魔术字语法，这里直接访问属性就行——它本来就是代码。

## 本页 {#page}

{{meta}}

## it.page {#fields}

布局与宏拿到的 `it.page` 是**同一套字段**：

| 字段 | 说明 |
|---|---|
| `lang` `slug` `url` `outputPath` `relativePath` | 位置信息：语言、页面标识、地址、产物路径、相对内容目录的源文件路径 |
| `draft` | 是否草稿 |
| `title` `description` `keywords` `updated` `section` `order` | 常用元信息 |
| `categories` | 分类：frontmatter 声明的，加上宏通过 `addCategory` 登记的 |
| `frontmatter` | frontmatter 原对象 |
| `markdown` | 整篇 markdown 原文（含 frontmatter），「查看源码」用的就是它 |
| 其余 frontmatter 字段 | 平铺在同一层，`it.page.自定义键` 直接可用 |

结构化字段优先，frontmatter 里恰好写了同名键也不会盖掉它们。

差别只有一处：布局 `doc` 额外有渲染产物 `html` / `headings` / `hints` / `sources`，另外把出处字段整理成对象 `source`（`site` / `title` / `url` / `revid` / `license` / `licenseUrl` / `changes`）。宏执行时这些还没生成。

其余布局的情况见 [[layouts#context]]：`index` 的 `page` 只是占位对象，`category` / `not-found` / `redirect` 没有 `page`。

## it.site {#site}

| 字段 | 说明 |
|---|---|
| `title` `siteUrl` `base` `lang` | 站点信息 |
| `urlStyle` | `'directory'` 或 `'file'`，决定地址与产物路径的形态；`file` 下站内链接还会被写成相对路径 |
| `sections` `categories` `categoryList` | 分组与分类 |
| `sectionLabels` | section slug → 显示名，如 `{ syntax: '语法' }`；没声明的 section 直接用 slug 当显示名。侧栏与目录页的分组标题按它渲染 |
| `pageCount` | 页数 |
| `pages` | 全部页面摘要，可以在模板里 filter 出想要的部分 |
| `search` | 站内搜索：`{ url }` 或 `null`。`url` 为 `null` 表示索引已内联进页面；整个对象为 `null` 表示搜索被关掉了 |
| `generatedAt` | 构建时间 |
| `config` | `wiki.config.ts` 的原始配置对象。**含本机绝对路径**（`root`、`themeDir`），别原样打印出来 |

`pages` 让「自动索引」变成几行模板代码：

```html
<% for (const p of it.site.pages.filter(x => x.section === it.page.section)) { %>
- [<%= p.title %>](<%= p.url %>)
<% } %>
```

## 拿不到的东西 {#missing}

宏执行时，本页的 `html` / `headings` / `hints` / `sources` 还在生成中，所以**宏里读不到**。这是循环依赖，不是遗漏。要用这类数据得放在布局层做——布局模板里 `it.page.headings` 是有的。

## 魔术字对照 {#magic}

| MediaWiki | 这里怎么写 |
|---|---|
| `{{PAGENAME}}` | `<%= it.page.slug %>` |
| `{{FULLPAGENAME}}` | `<%= it.page.lang + "/" + it.page.slug %>` |
| `{{SITENAME}}` | `<%= it.site.title %>` |
| `{{NUMBEROFPAGES}}` | `<%= it.site.pageCount %>` |
| `{{#if: …}}` | `<% if (…) { %>…<% } %>` |

上表左列的 `{{…}}` 放在行内代码里才是字面量，否则会被当成宏执行。
