---
title: 锚点
keywords: 锚点, anchor, id, 标题
description: 用 {#名字} 给标题指定稳定的 id，让链接不会因为改标题而断。
section: syntax
order: 3
updated: 2026-11-15
draft: false
categories: [syntax]
---

在标题末尾写 `{#名字}`，这个标题的 id 就固定下来了：

```md
## 三种长度 {#counts}
```

## 为什么必须显式写 {#why}

中文标题自动生成的 id 会变成 `h2-3` 这种没有意义的名字。一旦有人把它写进链接，改标题就会断。显式写锚点，等于给这一节取了一个不会变的名字。

## 中英共用同一个锚点 {#same}

同一篇文章的中英两份建议用同一个锚点，这样 `#why` 在两种语言下都跳得到。

试试跳到 [[anchors#why|本页的「为什么」]]。
