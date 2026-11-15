---
title: 轻维基语法手册
keywords: 语法, syntax, 首页, 索引
description: 用轻维基自己写的语法手册，每一页都演示它正在讲的那个特性。
section: syntax
order: 0
updated: 2026-11-15
draft: false
categories: [demo]
---

这个站点本身就是文档：内容用轻维基的语法写成，再由轻维基渲染。所以你在页面上看到的每个效果，都能在对应的源文件里找到写法。

## 从哪开始 {#start}

- [[structure|目录与文件]]：slug 与 URL 怎么推导
- [[frontmatter|frontmatter]]：字段表与容错
- [[anchors|锚点]]：让标题能被稳定引用
- [[links|链接]]：站内链接与双链
- [[macros|宏]]：`{{…}}` 的三种形态
- [[directives|行内指令]]：术语提示与小节来源
- [[categories|分类]]：页面归类与分类侧栏
- [[context|模板上下文]]：`it.page` 与 `it.site`
- [[html|在正文里写 HTML]]：内联 SVG 与颜色约定
- [[layouts|布局]]：覆盖主题模板
- [[commands|命令]]：dev / check / build
- [[limits|已知限制]]

## 双链长什么样 {#wikilink}

上面那排链接用的不是 markdown 语法，而是双链。三种写法：

- `[[anchors]]`：按 slug
- `[[宏]]`：按标题
- `[[macros|自己起个名字]]`：自定义显示文字

它们在这个页面上都真实生效，效果就是上面那排链接。

## 宏 {#macro}

{{note("这段文字来自 note 宏，不是正文里手写的。")}}

站点与页面的元信息也能从宏里取：

{{meta}}

具体写法见 [[macros]] 与 [[context]]。
