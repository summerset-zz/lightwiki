---
title: 开始
keywords: 开始, intro, 入门
description: 最小样例的入口页，演示 frontmatter、锚点、术语提示与站内链接。
section: guide
order: 0
updated: 2026-11-15
draft: false
---

这一页用来验证构建链路：frontmatter 能被读到，锚点能落到 `<h2>` 上，站内链接会补语言前缀。

## 链接到另一页 {#another}

见 [第二页](/docs/second)。英文页里这个链接不需要前缀，中文页会自动变成 `/zh/docs/second`。

## 术语提示 {#hint}

<!-- hint: 术语提示 | 就是这种注释，构建时会被剥掉，只留下结构化数据。 -->

上面那一行在产物里看不到，但会以 JSON 形式留在页面里，供前端弹窗使用。

## 小节来源 {#source}

<!-- source: zh.wikipedia.org | 示例条目 | 12345678 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | 仅用于演示，删去了原文所有内容 -->

这一节演示小节级的来源标注：产物里会在文末列出来源。
