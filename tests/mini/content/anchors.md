---
title: 锚点
keywords: 锚点, anchor, id, 标题
description: 用 {#名字} 给标题指定稳定的 id，让链接不会因为改标题而断；示例容器里的标题可以不进目录。
section: syntax
order: 3
updated: 2026-11-25
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

## 示例容器不进目录 {#no-toc}

块级容器加 `data-no-toc`，里面渲染出的标题照常显示，「本页」目录里没有它：

<div class="mini-demo" data-no-toc>

### 这一行不会出现在目录里

</div>

写法就是这样：

```html
<div data-no-toc>

### 这一行不会出现在目录里

</div>
```

只认 `<div>`，与 `class` 写在一起也行。示例里演示的标题本来就不该占目录的位置。

## 标题旁的 `#` {#header-anchor}

写 `{#...}` 的标题，末尾会被塞一个悬停才显示的链接：

```html
<h2 id="x">标题<a class="header-anchor" href="#x" aria-hidden="true">#</a></h2>
```

点它，地址栏就变成 `….html#x`。构建时生成，不依赖脚本。

没写 `{#}` 的标题没有 id，也就不会加这个 `#`。
