---
title: 代码高亮
keywords: 高亮, highlight, 代码块, 语言, highlight.js, eta
description: 代码块围栏带上语言名就会上色。这一页讲内置了哪些语言、怎么加别的、怎么改配色。
section: basics
order: 9
updated: 2026-11-17
draft: false
---

代码块围栏后面写语言名，构建时交给 highlight.js 做语法解析，产出一堆带 class 的 `<span>`。

## 围栏带语言名就上色 {#trigger}

````md
```js
const x = 1;
```
````

上面那样写，`js` 这一块就有了颜色。不写语言名时只有等宽字体，代码照常显示，只是没有颜色。

语言名大小写不敏感，`JS` 与 `js` 一样。

上过高亮的块上，`<code>` 会多一个 `language-<语言名>` 的 class，样式表可以拿它做选择器。

## 内置语言 {#builtin}

这些开箱可用，不用写任何配置：

`xml` `css` `javascript` `typescript` `markdown` `json` `bash` `yaml` `diff` `less` `scss` `ini` `plaintext`

另有一个自己定义的 `eta`，见下面单独一节。

> 内置得少是刻意的。highlight.js 的完整语言包接近 1MB，文档站常用的就这几种。

## 别名可以直接写 {#aliases}

围栏里写更顺手的写法也能认，构建时映射到真实语言：

| 写法 | 实际使用 |
|---|---|
| `html` `svg` `vue` `ejs` | `xml` |
| `js` `jsx` | `javascript` |
| `ts` `tsx` | `typescript` |
| `md` | `markdown` |
| `sh` `shell` `zsh` | `bash` |
| `yml` | `yaml` |
| `toml` `cfg` | `ini` |
| `text` `txt` | `plaintext` |

写了不认识的语言名不会报错，只是那一块不上色。`javscript` 这类拼错属于静默失败，写完看一眼页面颜色对不对。

## eta 是自定义的 {#eta}

highlight.js 没有 Eta。官方定义里最接近的是 `erb`，同样是 HTML 里夹 `<% %>`，但它按 Ruby 解析，用不上。

`erb` 只声明了 Ruby 子语言，没注册 ruby 时 `<% %>` 那段完全不工作。

内置的 `eta` 自己定了三条规则：

- 整块按 HTML 解析
- `<% ... %>` 里面按 JavaScript 解析
- `<%# ... %>` 认作注释

结果是 HTML 标签和模板里的 JS 都有颜色，注释也有。写 `eta` 才用上这个定义。

`ejs` 不指向它。按别名表，`ejs` 落到 `xml`，整块只按 HTML 解析，模板里的 JS 没有颜色。

## 加别的语言 {#more}

配置里的 `highlight.languages` 写 highlight.js 的语言名：

```ts
highlight: {
  languages: ['python', 'rust', 'go'],
},
```

一个语言只要在 highlight.js 里有定义，写上就能用，不用额外装包。字段的默认值和位置见 [站点配置](/docs/advanced/config)。

> 写名字时先按真名找。配 `vue` 会用 highlight.js 官方的 Vue 定义，不是别名表里的 `xml`。真名没注册时才退回别名。

配好之后围栏里直接写那个名字，比如 `python`。

## 关掉高亮 {#off}

```ts
highlight: { enabled: false },
```

全部代码块都不上色。`language-xxx` 这个 class 还会留在 `<code>` 上，CSS 里可能用得上，但里面没有 `hljs-*` 的 `<span>`。

## 配色从哪来 {#colors}

高亮结果是一堆带 class 的 `<span>`，本身不带颜色。颜色由主题样式表提供，用的变量有：

`--hl-keyword` `--hl-string` `--hl-number` `--hl-comment` `--hl-function` `--hl-variable` `--hl-tag` `--hl-attr` `--hl-meta`

浅色与深色两套，跟着 `prefers-color-scheme` 切换。主题里有几条规则把这些变量套到 `.hljs-*` 上。

改配色只要覆盖变量，不用碰 `.hljs-*` 规则：

```css
:root {
  --hl-keyword: #0a58ca;
  --hl-string: #2f7d32;
}
```

自己的样式表怎么挂到页面、跟主题谁盖谁，见 [样式与 Less](/docs/basics/styles)。

## 行内代码不上色 {#inline}

行内代码只等宽，不做语法解析：`const x = 1`。

这是 markdown 的常规行为，不是配置项。

## 代码块的外观 {#appearance}

`pre` 的背景、内边距、横向滚动都在主题样式表里，背景用 `--code-bg` 变量。想换底色覆盖这个变量即可。

代码块也能挂 class 之类的东西，写法见 [Markdown 与扩展语法](/docs/basics/markdown)。
