---
title: 样式与 Less
keywords: 样式, css, less, styles, 覆盖主题, 编译
description: 样式写在 assets/ 里，.less 会自动编译成同名 .css。这一页讲页面级样式怎么挂、为什么页面样式能盖住主题、以及几个容易踩的编译细节。
section: advanced
order: 1
updated: 2026-11-17
draft: false
---

样式表放在内容仓库的 `assets/` 里，写 `.css` 或 `.less` 都行。`.less` 在构建时被编译成同名 `.css`，产物里只留编译结果。

主题的样式来自主题包，你的样式与它并存。这一页讲页面级样式怎么挂、注入顺序，以及 Less 编译时的几个坑。

## 写在哪 {#where}

按名引用的样式表放 `assets/` 根上，`assets/style.css` 这种。想分目录也可以，层级会保留到产物。

```
assets/
├── style.less
└── sub/
    └── theme.less
```

用 `.less` 除了能写变量和嵌套，还能把公共部分拆成单独文件再 `@import` 进来。

## Less 的编译规则 {#less}

构建扫描 `assets/` 时把每个 `.less` 编译成同名 `.css`：

| 源文件 | 产物 |
|---|---|
| `assets/style.less` | `assets/style.css` |
| `assets/sub/theme.less` | `assets/sub/theme.css` |

产物里不会出现 `.less`。引用时一律写 `.css`，不用关心源文件的扩展名。

`@import "vars.less"` 相对当前文件解析，不用写完整路径。

**被 `@import` 进来的文件也会被单独编译一份。**`vars.less` 里只有变量、没有任何输出规则时，产物里会多一个内容为空的 `vars.css`。

文件能建，功能不受影响，只是多几个没用的空文件。暂时没有跳过编译的写法，接受它，或者把变量和规则合到一个文件里。

## 页面级样式 {#page-styles}

只给某几页挂的样式写在 frontmatter 的 `styles` 里，路径相对 `assets/`：

```yaml
styles: [site.css]
```

单个文件时写字符串也行：

```yaml
styles: site.css
```

写 `.css` 或 `.less` 都认，构建会自己找到对应的源文件。字段本身的位置与规则见 [frontmatter](/basics/frontmatter)。

## 注入顺序 {#order}

构建在渲染完成后把样式表插到 `</head>` 前。顺序固定：

1. 主题的 `assets/theme/style.css`
2. 主题的 `assets/theme/theme-extra.css`
3. 这一页 `styles` 里声明的，按声明顺序

页面级样式排在主题之后。同一个选择器优先级相同时，后写的赢。

想微调主题观感，直接写同名选择器覆盖就够了，不需要 `!important`。`!important` 一旦加上，后面想再改就得继续加。

皮肤要正常写出 `</head>`。缺这个标签时样式表会被塞到文件最前面，跑到 `<!doctype html>` 之前，浏览器会因此进入怪异模式。皮肤的写法见 [皮肤](/advanced/skins)。

## 主题自带的样式 {#theme-extra}

`theme-extra.css` 里有四个现成的 class，自己写模板时套用同名 class 就能拿到样式：

| class | 长相 |
|---|---|
| `.note` | 左侧一条竖线的提示块 |
| `.card` | 带边框的卡片，内部 `p` 没有外边距 |
| `.glossary` | 虚线下划线，`help` 光标 |
| `.wikilink-missing` | 双链没解析成功时的灰字占位 |

要改它们，在自己的样式表里写同名选择器，注入顺序保证你排在后面。

模板本身怎么写见 [模板](/basics/templates)。

## 出错的表现 {#failures}

**找不到文件**：`wiki build` 打一条警告，页面照常生成，只是少了那个样式表。`wiki check` 算错误，退出码 1：

```
x zh/index -> styles: nope.css
```

**Less 语法错误**：`wiki build` 直接失败，退出码 1，终端打出 Less 自己的报错文本，形如 `Unrecognised input. Possibly missing opening '{'`。

注意这条信息里**不带文件名**。一个仓库有多个 `.less` 时，得自己逐个看。

`wiki check` 不编译 Less，只检查路径存在，所以 Less 写错时校验照样通过。

> 少了样式表不影响页面结构，只影响外观，很容易漏看。提交前跑一次 `wiki check`。

## 内联模式 {#inline}

`wiki build --inline` 时样式表被塞成 `<style>`，产物里不再有独立的 css 文件。

引用路径不用改，构建会把对应的 `<link>` 换成内联的 `<style>`。

> 体积会明显变大：每页都带一份完整样式，站内搜索的索引也跟着内联，总量按页数成倍放大。单文件产物适合把一页单独发出去，不适合做站时默认开着。

脚本的挂法见 [JavaScript](/advanced/javascript)，图片等资源的路径规则见 [静态资源](/basics/assets)。
