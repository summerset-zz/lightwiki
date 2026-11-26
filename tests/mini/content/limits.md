---
title: 已知限制
keywords: 限制, limit, todo, 待办
description: v0.1 还不支持的东西，以及为什么。
section: reference
order: 3
updated: 2026-11-17
draft: false
categories: [official]
---

这些是当前明确的边界，不是 bug。

## 皮肤里的链接要自己拼前缀 {#prefix}

正文链接会补 `basePath` 与 directory 模式的尾斜杠，皮肤里手写的 `href` 不会。部署在子路径时，皮肤里的地址要自己拼 `it.site.base`。

## 换布局不换数据 {#layouts}

`layout:` 只能换骨架，布局里能拿到的数据还是 `doc` 那一套。想要「一组编辑手挑的卡片」，得在 `.eta` 里写死或用宏。

## 没有自定义排序 {#sort}

目录宏只能按 `section` / `category` 过滤，顺序固定为 section → order → slug。要「按这个顺序列这几页」，目前只能手写列表。

## 行内宏不能产出块级结构 {#inline}

句子中间的宏只能产出行内内容。要列表、表格就得整行独占——这是 markdown 的结构决定的，不是实现偷懒。

## 搜索是子串匹配 {#search}

没有分词、没有高亮、没有模糊匹配：输入什么就按子串找，标题命中排在正文命中前面。索引大小由 `search.excerpt` 控制，匹配策略见 [[search#ui]]。

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
