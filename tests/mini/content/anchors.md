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

## 锚点可以自己取名 {#same}

`{#...}` 里写什么都行，只要求页内唯一。写 `#why` 比让构建从中文标题生成 `h2-3` 好记，也不会因为改标题而断。

试试跳到 [[anchors#why|本页的「为什么」]]。
