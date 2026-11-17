---
title: 在正文里写 HTML
keywords: html, svg, 内联, figure, inline
description: markdown 里可以直接写 HTML 与 SVG，以及几个注意点。
section: syntax
order: 9
updated: 2026-11-15
draft: false
categories: [syntax]
---

正文里的 HTML 会被原样保留：`<figure>`、`<svg>`、`style` 属性都能用。

## 什么时候用 {#when}

- **文字排版本身就是演示内容** → 用 HTML。`letter-spacing` 要真实生效，SVG 里的文本做不到；
- **抽象的线与框** → 用内联 SVG。

```html
<figure style="margin: 1.75rem 0">
  <svg viewBox="0 0 300 148" width="100%" role="img" aria-label="示意图">
    <line x1="16" y1="125" x2="216" y2="125" stroke="currentColor" />
  </svg>
</figure>
```

## 颜色用 currentColor {#color}

写死 `#333` 的话，暗色主题下会看不见。用 `currentColor` 或 CSS 变量。

## 花括号的坑 {#escape}

`{{…}}` 放在行内代码或围栏代码块里才是字面量，否则会被当成宏执行——见 [[macros#escape]]。上面那段 HTML 示例里的花括号同理。
