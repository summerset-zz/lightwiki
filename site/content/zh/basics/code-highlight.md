---
title: 代码高亮
keywords: 高亮, highlight, 代码块, 语言, highlight.js, eta
description: 代码块围栏带上语言名就会上色。这一页讲内置了哪些语言、怎么加别的、怎么改配色。
section: basics
order: 9
updated: 2026-11-22
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

内置的 `eta` 自己定了这几条规则：

- 整块按 HTML 解析
- `<% ... %>` 里面按 JavaScript 解析
- `<%# ... %>` 认作注释
- 标记本身（`<%` / `<%=` / `<%~` / `%>`）用 `hljs-meta` 上色，和正文里模板调用的 `{{ }}` 同一个颜色

结果是 HTML 标签、模板里的 JS、注释、以及标记本身都有颜色。写 `eta` 才用上这个定义。

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

## 皮肤里的代码块 {#skin}

皮肤（`layouts/*.eta`）产出的是整页最终 HTML，不经过 markdown 解析器，正文围栏那套规则管不到它。手写 `<pre>` 或 `<code>` 时加一个 `lang` 属性，构建阶段会用同一个 highlight.js 再染一遍。

下面两段是要原样粘进 `.eta` 的 HTML。写在 `<pre>` 上：

```html
<pre lang="markdown"><code>## 小标题

- 一条列表</code></pre>
```

写在 `<code>` 上效果一样：

```html
<pre><code lang="ts">const n: number = 1;</code></pre>
```

两个都写 `lang` 时以 `<code>` 的为准。语言名跟围栏完全一致，别名表也照用：`js` `ts` `md` `yml` `eta` 都能认。

皮肤里写的是最终 HTML，代码内容要自己转义，用 `&lt;` 而不是 `<`，否则浏览器会先把尖括号当成标签：

```html
<pre lang="html"><code>&lt;div class="note"&gt;文字&lt;/div&gt;</code></pre>
```

几条边界：

| 写法 | 结果 |
|---|---|
| `<pre lang="yaml">` | 染色 |
| `<code lang="yaml">` | 染色 |
| `<pre><code class="language-yaml">` | 不染色，保持纯文本 |

只认 `lang` 是刻意的。markdown 已经染过的块上同样有 `class="language-xxx"`，按它判断会把同一段代码染第二遍。

染色后的 `<code>` 会被补上 `class="language-<语言名>"`，配色照旧走 `.hljs-*` 那套变量，跟正文代码块一致。

语言名写错（比如 `lang="nosuchlang"`）不会中断构建，那一块保持纯文本，`wiki build` 打一条警告：

```
code block: unknown highlight language "nosuchlang" (kept as plain text)
```

配置了 `highlight.enabled: false` 时整段不动，也不会报未知语言。

`lang="markdown"`（或 `md`）的块如果第一行就是 `---`，开头那段 frontmatter 按 YAML 染色，后面的正文仍按 markdown 染。整块都交给 markdown 的话，后面的 `---` 会被当成标题分隔线，frontmatter 反而是错的。

同一种块里的 `{{…}}` 模板调用会拆开上色（highlight.js 的 markdown 语法不认它）：`{{` 与 `}}` 用 `hljs-meta`，模板名用 `hljs-title function_`，位置参数用 `hljs-string`，命名参数的键（`键: 值` 的键）用 `hljs-attr`。调用里带反引号原样字符串时整段不拆 —— highlight.js 已经在那里面插了标记，硬拆会把标记弄坏。只影响颜色，不影响内容。

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
