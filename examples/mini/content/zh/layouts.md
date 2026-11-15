---
title: 布局
keywords: 布局, layout, 模板, 覆盖, override
description: 布局是整页骨架，按「内容仓库 → 主题包」的顺序查找，可以只覆盖要改的部分。
section: reference
order: 0
updated: 2026-11-15
draft: false
categories: [official]
---

布局（`layouts/*.eta`）是整页骨架，宏（`macros/*.eta`）是正文里的片段。这两个词不混用。

## 查找顺序 {#order}

```
1. <内容仓库>/layouts/<name>.eta   ← 你覆盖的，优先
2. <主题包>/layouts/<name>.eta
3. 找不到就报错
```

当前有三个布局名：

| 布局 | 用于 |
|---|---|
| `doc` | 每一篇内容页 |
| `index` | 每种语言的目录页 |
| `category` | 分类页 |
| `not-found` | 没有 `404.md` 时的兜底页（见 [[commands#not-found]]） |

覆盖就是建同名文件，只写要改的部分。**没覆盖的部分会随主题升级自动跟进**——这也是不要整份拷贝主题的原因。

## 语法 {#syntax}

模板引擎是 Eta，就是带 JS 的 HTML：

| 写法 | 含义 |
|---|---|
| `<%= 表达式 %>` | 输出并转义 |
| `<%~ 表达式 %>` | 输出但不转义（渲染好的正文用它） |
| `<% 代码 %>` | 执行，不输出 |

## 上下文 {#context}

字段见 [[context]]。要点是：宏里没有 `html` / `headings`，布局里有。

## 为什么会话「模板」二字 {#naming}

MediaWiki 用户说「模板」指的是正文里 `{{…}}` 那个东西，而这里它已经被布局占了。所以文档里一律用「布局」和「宏」两个词，任何地方都不单独说「模板」。
