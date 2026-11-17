---
title: Markdown 与扩展语法
keywords: markdown, 语法, 双链, wikilink, 红链, redlink, 锚点, anchor, 行内 HTML, html, 属性, attrs, 指令, hint, source
description: 正文就是标准 markdown，在此之上还有双链、红链判定、显式锚点、行内 HTML、给元素加 class，以及两条写在注释里的指令。
section: basics
order: 1
updated: 2026-11-17
draft: false
---

正文用标准 markdown 写，标题、列表、表格、代码块、脚注都按 CommonMark。在这之上，构建时还会处理五种写法：双链、红链判定、显式锚点、行内 HTML、给元素加 class。此外还有两条写在 HTML 注释里的指令。

## 双链 {#wikilink}

双链（wikilink）用两层方括号指到另一页，从 MediaWiki 过来的人会熟悉这个写法。目标可以是 slug，也可以是页面标题：

- 按 slug：`[[start/structure]]`
- 按标题：`[[目录结构]]`
- 带显示文字：`[[start/structure|看目录]]`
- 带锚点：`[[basics/frontmatter#fields]]`

构建时它们全部被解析成真实链接，产物里看不到方括号。上面第一条解析出来的就是 [目录结构](/docs/start/structure)。

解析顺序固定为先 slug、再标题。slug 来自文件名，最稳；标题来自 frontmatter，改标题就会断链。同一个写法如果正好是某页的 slug、又是另一页的标题，按 slug 那一页算。

目标找不到时，页面上留一段不带链接的占位文字，鼠标停上去会提示没找到，`wiki check` 把它列成未解析的内链。

本站自己的正文一般直接写 `[文字](/docs/start/structure)`，双链是给习惯 MediaWiki 的人留的写法。

## 红链 {#redlink}

指向还不存在的页面的站内链接会被标上 `class="redlink"`。主题给它的样式是红字加虚线下划线，一眼能看出这里还差一页。

判定依据是构建时已经知道的所有页面地址。不在地址表里的站内路径，只要不像资源（`/assets/` 下面、带 `.css` 这类扩展名），也不像分类页，就算红链。从别处搬来的内容留着原站路径，会一起被点名。

`wiki check` 会把这些链接列出来，`check --strict` 时它们算失败。

> 这一页不放真实例子。放一个修不好的红链，`wiki check` 就永远是红的。

## 显式锚点 {#anchors}

在标题末尾写 `{#名字}`，这一节的 id 就固定下来：

```md
## 三种长度 {#counts}
```

不写 id 的话，中文标题会拿到按序号编出来的 id，比如 `h2-3`。这个名字没有含义，改标题或调整顺序都会变，别人存下来的锚点就成了死链接。显式写等于给这一节取一个不会变的名字。锚点用于 `##` 到 `######`，页面大标题来自 frontmatter，不参与。

本页每个二级标题都这么写。这一节写的是 `{#anchors}`，所以 [点这里](#anchors) 能跳回来。

同一份内容的中英两版建议用同一个 id，这样 `#anchors` 在两种语言下都跳得到。

## 行内 HTML {#html}

正文里的 HTML 原样保留：`<figure>`、`<svg>`、`<style>`、`style` 属性都能用。markdown 表达不了精细排版时，用它最直接。

<figure style="margin: 1.75rem 0">
  <svg viewBox="0 0 240 64" width="100%" role="img" aria-label="三段文字共用一条基线">
    <text x="4" y="34" font-size="20" fill="currentColor">Aa</text>
    <text x="64" y="34" font-size="20" font-family="serif" fill="currentColor">Aa</text>
    <text x="124" y="34" font-size="20" font-style="italic" fill="currentColor">Aa</text>
    <line x1="4" y1="38" x2="236" y2="38" stroke="currentColor" stroke-dasharray="4 4" />
  </svg>
</figure>

上面这张图就是一段内联 SVG，没有对应的图片文件。

用的时候守两条：颜色写 `currentColor` 或主题的 CSS 变量，写死 `#333` 在暗色主题下会看不见；块级 HTML 前后留空行，否则会被当行内内容处理。

什么时候该用：文字排版本身就是你要展示的内容时，比如字距、基线、字形对比，markdown 表达不了这些。普通说明文字仍然用 markdown，HTML 混进正文会让源码难读。

## 给元素加 class {#attrs}

元素后面紧贴 `{.class}`，构建时会变成 class 属性：

```md
![示意](/assets/x.png){.wide}
```

除了 `{.class}`，还能写 `{#id}` 和 `key=value` 这样的属性，由 markdown-it-attrs 处理。

> 加了 class 不等于有样式。主题没有 `.wide` 这类预设，得先在 `assets/` 的样式表里写好它，或者覆盖皮肤的样式。

## 提示与来源指令 {#directives}

两条指令都写在 HTML 注释里。构建时注释被剥离，产物里看不到它们本身。

术语提示：

```md
<!-- hint: Unicode 区块 | 区块是 Unicode 给码位划的行政区间。 -->
```

它是标题的附属数据，归属上方最近的带锚点标题，所以写在标题下面最稳。产物里变成一段 JSON：

```html
<script type="application/json" id="lightwiki-hints">…</script>
```

默认主题只把这段数据放进页面，不负责显示。想让读者看见，得自己写脚本读它。

小节来源，只借了某几节时用：

```md
<!-- source: zh.wikipedia.org | 示例条目 | 12345678 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | 仅用于演示 -->
```

六段用 `|` 分隔，顺序固定：站点、标题、修订号、许可证、许可证地址、改动说明。站点写域名，不带协议；改动说明里可以再出现 `|`，只切前五刀。产物里会在文末生成一节来源列表。

修订号写固定的版本号（`oldid`），不要写页面地址：上游一改，署名就指到另一版了。

整篇都是改编的话，改用 frontmatter 的 `source*` 一组字段，见 [frontmatter](/docs/basics/frontmatter)。

## 页面身份是文件名 {#next}

一页的地址来自文件名，不是标题。`content/zh/basics/markdown.md` 就是 `/docs/basics/markdown/`，标题只出现在导航、搜索和双链里。改文件名等于换地址，外部链接和双链都会断。

目录怎么摆、首页是哪一页，见 [目录结构](/docs/start/structure)。开头那段 YAML 写什么，见 [frontmatter](/docs/basics/frontmatter)。

正文里想插入一段由站内数据算出来的列表或表格，那是另一套机制，见 [模板](/docs/basics/templates)。代码块怎么上色、支持哪些语言，见 [代码高亮](/docs/basics/code-highlight)。
