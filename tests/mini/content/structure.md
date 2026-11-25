---
title: 目录与文件
keywords: 目录, 结构, slug, 文件名, 内容仓库, structure
description: 内容仓库的目录约定，以及 slug 与 URL 的推导关系。
section: syntax
order: 1
updated: 2026-11-17
draft: false
categories: [syntax]
---

## 内容仓库长什么样 {#layout}

```
my-wiki/
├── wiki.config.ts     站点配置
├── content/*.md    内容，一个文件一页
├── layouts/*.eta      可选：覆盖主题的布局
├── macros/*.eta       可选：内容里调用的宏
└── assets/            图片等静态资源
```

`wiki.config.ts` 在哪，哪里就是内容根目录。

## slug 与 URL {#slug}

**slug 就是文件相对路径去掉 `.md`**：

| 文件 | slug | URL |
|---|---|---|
| `content/second.md` | `second` | `/second/` |
| `content/api/v1.md` | `api/v1` | `/api/v1/` |
| `content/index.md` | `index` | `/`（首页） |

- 文件名就是身份，**改文件名等于删一篇加一篇**，站内所有链接都会断；
- 不能单独指定 URL，它完全由 slug 推导。

前缀是可以改的，见下一节。

## 内容页放在哪个前缀下 {#docs-dir}

`wiki.config.ts` 的 `docsDir` 与 `urlPrefix` 决定内容页挂在哪里。默认都为空串，页面直接挂在 `/` 下：

| `urlPrefix` | `docsDir` | 页面地址 |
|---|---|---|
| `''`（默认） | `''`（默认） | `/second/` |
| `''` | `'docs'` | `/docs/second/` |
| `'/wiki'` | `''` | `/wiki/second/` |

页面的 slug 第一段叫 `assets` 或 `categories` 时，`wiki check` 直接判失败：`docsDir` 为空时它会和资源目录、分类页抢地址。

## 多语言 {#i18n}

一次构建只读 `content` 指向的那一个目录。多语言站每门语言一份配置，各跑一次 `build`，两份产物怎么合并由自己决定。

## 草稿 {#draft}

`draft: true` 的页面不进导航、不参与孤页判定、构建时跳过，但 `wiki dev` 下仍可按地址打开——适合写一半先看效果。

## 首页就是 index.md {#index}

`content/index.md` 就是首页 `/`（`docsDir` 非空时是那段前缀的根）。**没有自动生成的目录页**，想列全站就自己排：

```text
{{catalog}}
```

```text
{{pages(section: syntax)}}
```

两个宏的用法见 [[macros#catalog]]。

内容目录里必须有 `index.md`，没有的话首页会 404，`wiki check` 会报错。

`404.md` 是另一个例外：它会变成根目录的 `404.html`，见 [[commands#not-found]]。
