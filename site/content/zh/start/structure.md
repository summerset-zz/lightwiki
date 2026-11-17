---
title: 目录结构
keywords: 目录, 结构, content, assets, layouts, macros, index.md, 内容根, 首页, structure
description: 哪些文件必须有、哪些可选，以及文件名怎么变成地址。
section: start
order: 4
updated: 2026-11-17
draft: false
---

## 长什么样 {#tree}

```
my-wiki/
├── wiki.config.ts            站点配置
├── content/
│   ├── zh/
│   │   ├── index.md          首页，就是 /docs/
│   │   └── start/
│   │       └── intro.md      → /docs/start/intro/
│   └── en/                   可选：第二种语言
├── assets/                   可选：图片、样式
├── layouts/*.eta             可选：皮肤
└── macros/*.eta              可选：模板
```

| 位置 | 放什么 | 必须吗 |
|---|---|---|
| `wiki.config.ts` | 站点配置 | **必须** |
| `content/<语言>/index.md` | 该语言的首页 | **必须** |
| `content/<语言>/` 下的其他 `.md` | 页面，一个文件一页 | 有内容就要 |
| `assets/` | 图片、字体、样式表 | 可选 |
| `layouts/` | 皮肤 | 可选 |
| `macros/` | 模板 | 可选 |
| `content/en/` | 第二种语言 | 可选 |

表外没有别的东西：没有 `package.json`，没有构建脚本，没有一堆散落各处的配置。

## 内容根就是 wiki.config.ts 所在的目录 {#root}

`content`、`assets`、`outputDir` 这些路径都相对它算。所以打开哪个目录比在哪台机器上重要。整个目录拷走，换台电脑照样构建。

**`wiki.config.ts` 所在的目录就是内容根**，没有例外。

## 首页就是 index.md {#home}

`content/zh/index.md` 就是 `/docs/`。**没有自动生成的目录页**。那页写什么由你决定，想列全站就自己排：

```md
{{catalog}}
```

```md
{{pages(section: start)}}
```

**每种语言都必须有 `index.md`**。缺了那个语言的首页会 404，`wiki check` 也直接报错。

## 子目录只影响地址 {#subdir}

`content/zh/start/intro.md` → `/docs/start/intro/`。多出来的目录只是 URL 里的一段，**不参与分组**：侧栏分到哪一组看 frontmatter 的 `section`。所以 `content/zh/` 下面怎么摆由你决定，按主题分、按年份分都行。

反过来也成立：改文件名就是改地址。已经发出去的链接、别人存的书签都会断。

## 三个可选目录 {#optional}

| 目录 | 放什么 | 不建会怎样 |
|---|---|---|
| `assets/` | 图片、字体、样式表，正文写 `![说明](/assets/图.png)` | 没有图可放 |
| `layouts/` | 皮肤：整页骨架，`doc.eta` 就是一份完整的 HTML | 用主题自带的皮肤 |
| `macros/` | 模板：正文里 `{{…}}` 调用的片段 | 用主题自带的模板 |

三个都是建了才用。覆盖时只写你要改的那个同名文件，没写的部分跟着主题升级走。

一句历史遗留：`macros` 和 `layouts` 这两个目录名是早期定下的，你现在把它们看成模板目录和皮肤目录就行，名字不会改。

## 404 页 {#notfound}

根目录的 `404.html` 一直会自动生成。想自己写就建 `content/zh/404.md`：slug 为 `404` 的页面输出成根目录的 `404.html`，不会变成 `/docs/404/`。

## 再往下 {#next}

- [快速上手（不会代码）](/docs/start/quickstart-ai)
- [快速上手（会用命令行）](/docs/start/quickstart-dev)
