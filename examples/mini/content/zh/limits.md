---
title: 已知限制
keywords: 限制, limit, todo, 待办
description: v0.1 还不支持的东西，以及为什么。
section: reference
order: 2
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

## basePath 只适合根路径 {#basepath}

要用 `file://` 直接打开产物，还需要等相对路径模式。
