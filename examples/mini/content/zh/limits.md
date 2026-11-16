---
title: 已知限制
keywords: 限制, limit, todo, 待办
description: v0.1 还不支持的东西，以及为什么。
section: reference
order: 3
updated: 2026-11-15
draft: false
categories: [official]
---

这些是当前明确的边界，不是 bug。

## 缺译会产生红链 {#i18n}

英文页链到只有中文存在的页面时，目标页确实 404。暂时没有「回退到默认语言」的行为。

## 只有 /docs 补语言前缀 {#prefix}

其余站内路径原样输出。

## 布局名固定 {#layouts}

还不能「按 section 选不同布局」。

## 行内宏不能产出块级结构 {#inline}

句子中间的宏只能产出行内内容。要列表、表格就得整行独占——这是 markdown 的结构决定的，不是实现偷懒。

## 没有搜索 {#search}

术语提示的数据只是留在页面里，检索能力还没接。

## 没有图片处理 {#images}

`assets/` 原样复制，不做缩放、不做哈希、不做 `<picture>`。

## basePath 不适合 file:// {#basepath}

`basePath` 是给子目录托管用的；`file://` 下它没有意义，用 `urlStyle: 'file'` 时保持默认 `/`。

## file:// 下不处理的东西 {#file}

`urlStyle: 'file'` 会把站内链接写成相对路径，双击产物能全站导航。下面几类不在改写范围内：

| 不处理 | 理由 |
|---|---|
| `404.html` 里的链接 | 它需要在任意深度被打开，只能绝对路径 |
| `srcset`、表单 `action` | 少见，且部分场景需要绝对地址 |
| 自定义布局里手写的 `<meta http-equiv="refresh">` | 主题自带的 `redirect` 布局已经改用相对地址 |
| `<script>` 里的字符串 | 工具不去猜代码里哪些字符串是地址 |
