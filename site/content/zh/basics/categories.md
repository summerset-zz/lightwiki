---
title: 分类
keywords: 分类, category, categories, sidebarCategory, catalog, pages
description: 分类是贴在页面上的 ASCII 标签，构建时据此生成分类页。这一页讲怎么声明、怎么用、以及未声明时会发生什么。
section: basics
order: 8
updated: 2026-11-17
draft: false
---

分类（category）是贴在页面上的 ASCII 标签。构建时据此生成分类页，页面也能用它换侧栏。标签写在 frontmatter 的 `categories` 里。

## 两个用途 {#uses}

分类本身不改地址，也不进正文。它的作用只有两个：

1. 构建时为每个被用到的分类生成一页列表页，地址 `/categories/<slug>/`。
2. 页面写 `sidebarCategory` 时，侧栏换成那个分类的页面列表。

页面归属哪个分类，只看这个标签，跟目录和文件名无关。

## 页面上怎么写 {#declare}

frontmatter 的 `categories` 可以写一个，也可以写多个：

```yaml
categories: typography
```

```yaml
categories: [typography, reference]
```

用逗号分隔的字符串也认：

```yaml
categories: typography, reference
```

构建时会去掉首尾空格、去掉重复项。这个字段的其它细节见 [frontmatter](/docs/basics/frontmatter)。

## 显示名放在配置里 {#config}

`wiki.config.ts` 的 `categories`，键是 ASCII slug，值是显示名：

```ts
categories: {
  typography: '排版',
  reference: '参考资料',
},
```

键用 ASCII 是刻意的：地址要稳定、要能翻译。中文写在值里。

slug 会出现在两处：分类页的地址，以及 `wiki check` 的提示文字。改 slug 等于改地址。

## 分类页是自动生成的 {#generated}

构建时，每种语言 × 每个实际被页面用到的分类，各生成一页。

| 情况 | 地址 |
|---|---|
| 默认语言 | `/categories/typography/` |
| 非默认语言 | `/en/categories/typography/` |
| `urlStyle: 'file'` | `/categories/typography.html` |

没被任何页面用到的分类不会生成页。所以在配置里先声明一堆分类，不会产生空页。

分类页没有正文，只有标题和页面列表。它用主题的 `category` 皮肤，想改样子就覆盖 `layouts/category.eta`。皮肤的写法见 [皮肤](/docs/basics/skins)。

## 没有分类总览页 {#catalog}

构建不生成分类总览页。要一个总览，自己找一页放模板：

```md
{{catalog}}
```

它列出所有分类，每行 `- [显示名](/categories/<slug>/)（N 篇）`，按配置里声明的顺序排，未声明的排在后面按 slug 排。

N 只算**当前语言**的篇数，与分类页列出的范围一致；当前语言里没有页面的分类不列。

## 列某个分类下的页面 {#list}

```md
{{pages(category: typography)}}
```

只列当前语言的页面，换语言不会串。参数写法与模板机制见 [模板](/docs/basics/templates)。

## 未声明的分类 {#undeclared}

页面写了一个配置里没声明的分类，构建照常生成分类页，显示名就用 slug 本身。`wiki check` 会提示，但不判失败：

```
category typography is not declared in config.categories; the slug will be used as the label
```

提示按页面报，同一个未声明的分类被几页用到，就出现在几行里。

## 用分类当侧栏 {#sidebar}

frontmatter 写 `sidebarCategory`：

```yaml
sidebarCategory: typography
```

这一页的侧栏就换成该分类下所有页面，按 `section` 分组。分类里只有这一页时，侧栏也只有这一项。

分类不存在、或者没有任何页面用这个分类时，侧栏退回全站导航，不会空掉。`wiki check` 同样只提示：

```
sidebarCategory "typography" has no pages; the sidebar falls back to site navigation
```

> 这两条都只是提示，不影响退出码。对比一下：`section` 写错了，`wiki check` 是判失败的。

## 分类页里能拿到什么 {#context}

分类页用 `category` 皮肤，数据在 `it.category`：

| 字段 | 是什么 |
|---|---|
| `slug` | 分类的 ASCII slug |
| `label` | 显示名，没声明时等于 `slug` |
| `url` | 分类页地址 |
| `pages` | 该分类下的页面，元素有 `title` 和 `url` |

语言在 `it.lang`。分类页没有 `it.page`，因为它不对应某个内容文件；`it.nav`、`it.site`、`it.index` 与普通页面一致。

皮肤怎么写，见 [皮肤](/docs/basics/skins)。
