---
title: 目录与文件
keywords: 目录, 结构, slug, 文件名, 内容仓库, structure
description: 内容仓库的目录约定，以及 slug 与 URL 的推导关系。
section: syntax
order: 1
updated: 2026-11-15
draft: false
categories: [syntax]
---

## 内容仓库长什么样 {#layout}

```
my-wiki/
├── wiki.config.ts     站点配置
├── content/zh/*.md    中文内容
├── content/en/*.md    英文内容
├── layouts/*.eta      可选：覆盖主题的布局
├── macros/*.eta       可选：内容里调用的宏
└── assets/            图片等静态资源
```

`wiki.config.ts` 在哪，哪里就是内容根目录。

## slug 与 URL {#slug}

**slug 就是文件相对路径去掉 `.md`**：

| 文件 | slug | 默认语言的 URL |
|---|---|---|
| `content/zh/second.md` | `second` | `/docs/second/` |
| `content/zh/api/v1.md` | `api/v1` | `/docs/api/v1/` |

- 文件名就是身份，**改文件名等于删一篇加一篇**，站内所有链接都会断；
- 非默认语言加前缀：`/en/docs/second/`；
- 不能单独指定 URL，它完全由 slug 推导。

## 两种语言 {#i18n}

一个 slug 在两种语言各有一份最理想，但**只写一种也能构建**——缺译只会让 `wiki check` 提示一句。

中英两份建议用同一个锚点，这样 `#counts` 在两边都跳得到。

## 草稿 {#draft}

`draft: true` 的页面不进导航、不参与孤页判定、构建时跳过，但 `wiki dev` 下仍可按地址打开——适合写一半先看效果。
