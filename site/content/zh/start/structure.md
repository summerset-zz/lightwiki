---
title: 目录结构
keywords: 目录, 结构, content, assets, layouts, macros, index.md, 内容根, 首页, structure
description: 哪些文件必须有、哪些可选，以及文件名怎么变成地址。
section: start
order: 4
updated: 2026-11-17
draft: false
---

## 初始目录结构 {#tree}

```
my-wiki/
├── wiki.config.ts            站点配置
├── content/
│   ├── zh/
│   │   ├── index.md          首页，就是 /docs/
│   │   └── start/
│   │       └── intro.md      → /docs/start/intro/
│   └── en/                   可选：第二种语言。请参考站点配置中关于多语言的信息
├── assets/                   可选：静态资源目录，图片、样式
├── layouts/*.eta             可选：皮肤
└── macros/*.eta              可选：模板
```

| 位置                             | 放什么             | 必须吗       |
| -------------------------------- | ------------------ | ------------ |
| `wiki.config.ts`                 | 站点配置           | **必须**     |
| `content/<语言>/index.md`        | 该语言的首页       | **必须**     |
| `content/<语言>/` 下的其他 `.md` | 页面，一个文件一页 | 有其他页面时 |
| `assets/`                        | 图片、字体、样式表 | 可选         |
| `layouts/`                       | 皮肤               | 可选         |
| `macros/`                        | 模板               | 可选         |
| `content/en/`                    | 第二种语言         | 可选         |


- 在`content/zh/`目录下添加、编辑文档，文件后缀名为`.md`，即可生成对应页面。
  - `md`（markdown）是一种简单的、用于直接查看或生成html页面的语法。参考[markdown语法帮助](/docs/basics/markdown)
  - `frontmatter`是附加在md文件头部的元数据。轻维基至少需要元数据中包含`title`才会生成页面。参考[frontmatter语法帮助](/docs/basics/frontmatter)。
- 在`macros/`目录下添加、编辑模板，文件后缀名为`.eta`。请参考[模板语法帮助](/docs/basics/templates)。
  - `eta`是一种扩展html语法，他会在生成页面时通过传入的参数生成markdown片段或html片段。你可以在md文档中以这种方式使用模板：
  - `{{模板名}}`
  - `{{模板名(参数1,参数2)}}`
  - `{{模板名(参数名:参数值)}}`
- 在`layouts/`目录中编辑皮肤，文件后缀名也是`.eta`。请参考[皮肤语法帮助](/docs/basics/skins)。
  - 皮肤文件也是`eta`格式。与模板不同之处在于他控制的是整个页面的渲染方式。轻维基主站点的首页就是一个独立的模板。
  - 在`frontmatter`部分指定`layout`以切换该文档使用的皮肤。
- 在`assets/`目录里管理静态资源，如图片、额外js脚本、额外css等。请参考[静态资源指南](/docs/basics/assets/)。
- 在`wiki.config.ts`里调整配置。请参考[调整站点配置](/docs/advanced/config/)。
- 所有的CLI命令都以`wiki.config.ts`为根目录（即命令中的`.`）。

## index.md：站点首页 {#home}

`content/zh/index.md` 就是 `/docs/`。**没有自动生成的目录页**，但是我们提供了内置的目录模板：

```md
<!-- 列出所有分类 -->
{{catalog}} 

<!-- 列出section为start的页面 -->
{{pages(section: start)}}
```
如果你配置了多语言，则**每种语言都必须有`index.md`**。缺了那个语言的首页会404，`wiki check` 也直接报错。

## 子目录只影响地址 {#subdir}

`content/zh/start/intro.md` → `/docs/start/intro/`。多出来的目录只是 URL 里的一段，**不参与分组**：侧栏分到哪一组看 frontmatter 的 `section`。所以 `content/zh/` 下面怎么摆由你决定，按主题分、按年份分都行。

反过来也成立：改文件名就是改地址。已经发出去的链接、别人存的书签都会断。

## 三个可选目录 {#optional}

| 目录       | 放什么                                               | 不建会怎样       |
| ---------- | ---------------------------------------------------- | ---------------- |
| `assets/`  | 图片、字体、样式表，正文写 `![说明](/assets/图.png)` | 没有图可放       |
| `layouts/` | 皮肤：整页骨架，`doc.eta` 就是一份完整的 HTML        | 用主题自带的皮肤 |
| `macros/`  | 模板：正文里 `{{…}}` 调用的片段                      | 用主题自带的模板 |

三个都是建了才用。覆盖时只写你要改的那个同名文件，没写的部分跟着主题升级走。

一句历史遗留：`macros` 和 `layouts` 这两个目录名是早期定下的，你现在把它们看成模板目录和皮肤目录就行，名字不会改。

## 404 页 {#notfound}

根目录的 `404.html` 一直会自动生成。想自己写就建 `content/zh/404.md`：slug 为 `404` 的页面输出成根目录的 `404.html`，不会变成 `/docs/404/`。

## 再往下 {#next}

- [快速上手（不会代码）](/docs/start/quickstart-ai)
- [快速上手（会用命令行）](/docs/start/quickstart-dev)
