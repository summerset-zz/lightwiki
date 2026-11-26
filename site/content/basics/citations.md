---
title: 引用
keywords: 引用, citation, ref, references, 参考文献, mediawiki, 上标, 脚注
description: 正文里的 ref 标签会变成上标编号，内容排进文末的参考文献列表。这一页讲写法、内容限制、产出的 HTML、样式覆盖与皮肤里能拿到的数据。
section: basics
order: 2
updated: 2026-11-26
draft: false
---

引用（citation）是正文里的一个上标编号，加上文末列表里的一条对应内容。写法对齐 MediaWiki 的 `<ref>` 与 `<references/>` 两个标签。

正文里的其他语法见 [Markdown 与扩展语法](/basics/markdown)。

> 引用只处理行内内容。要放列表、代码块或好几段说明时，拆成几条引用，或者写进正文。

## 怎么写 {#syntax}

正文里写 `<ref>内容</ref>`，这个位置出一个上标，内容排到参考文献列表。下面这段是真的，上标能点：

站点产物是纯静态文件<ref>产物结构见 [本地打包](/deploy/build)。</ref>，不需要服务端<ref>扔进任意静态目录就能访问。</ref>。

```md
站点产物是纯静态文件<ref>产物结构见 [本地打包](/deploy/build)。</ref>，不需要服务端<ref>扔进任意静态目录就能访问。</ref>。
```

第一次定义时带上名字，同页后面只写自闭合标签复用。下面两次提到同一件事，共用一个编号：

关键词字段带了一条具名引用<ref name="kw">`keywords` 的说明见 [frontmatter](/basics/frontmatter)。</ref>，后面再提一次<ref name="kw" />。

```md
关键词字段带了一条具名引用<ref name="kw">`keywords` 的说明见 [frontmatter](/basics/frontmatter)。</ref>，后面再提一次<ref name="kw" />。
```

复用的那条只出一个同号上标，不新增列表项。每次出现的上标各有自己的 id，列表项的回链统一指向第一次出现的位置。

四种写法：

| 写法 | 作用 |
|---|---|
| `<ref>内容</ref>` | 定义一条引用 |
| `<ref name="名字">内容</ref>` | 定义一条带名字的引用 |
| `<ref name="名字" />` | 复用同名的已有引用，不带内容 |
| `<references/>` | 指定列表插入的位置 |

列表的插入位置单独一行写 `<references/>`，写 `<references />` 也行；不写就排到正文末尾。本页把它放在 [参考](#refs) 一节，边界情况也在那里说明。

## 内容里能写什么 {#content}

一条引用里可以写双链、行内代码和站内链接<ref>[[模板]]、`title`、[站点配置](/reference/config)。</ref>，展开列表对照一下。

```md
一条引用里可以写双链、行内代码和站内链接<ref>[[模板]]、`title`、[站点配置](/reference/config)。</ref>，展开列表对照一下。
```

表格单元格里也能写，编号与段落里的引用连着一套排：

| 位置 | 示例 |
|---|---|
| 段落 | 见上面 |
| 表格单元格 | 单元格里也能引用<ref>表格单元格里的这条，编号接在段落后面。</ref> |

链接照常进链接图，`wiki check` 的红链检测对引用里的链接一样生效，`[[…]]` 双链也能用。站内搜索会索引引用内容，因为它就在正文 HTML 里。

三条限制：

- 只支持行内。引用内容里不能放列表、代码块、多个段落。内容长就拆成几条引用。
- 不支持嵌套。`<ref>外层<ref>内层</ref></ref>` 得到一条内容为 `外层内层` 的引用，内层标签被摘掉。
- 内容为空、又没写 `name` 的 `<ref></ref>` 不生效，标签原样留在产物里。

## 参考 {#refs}

下面这一行就是 `<references/>`，本页把列表钉在这里；不写的话它会落到页面末尾：

<references/>

标记必须单独一行。夹在段落中间（跟别的文字混在一段里）不生效，列表仍然排到文末。写了多个只认第一个，其余摘掉。

```md
## 参考

<references/>
```

## 产出的 HTML 与编号 {#output}

一条引用产出两块 HTML。正文里的上标：

```html
<sup class="cite" id="cite-ref-1"><a href="#cite-note-1">1</a></sup>
```

文末的列表：

```html
<section class="citations">
<ol>
<li id="cite-note-1"><a class="cite-back" href="#cite-ref-1" aria-label="back to reference">↑</a>引用内容</li>
</ol>
</section>
```

编号按首次出现的文档顺序，从 1 开始。`name` 相同的共用一个号。同一个号出现多次时，每次的上标各有自己的 id：

| 第几次出现 | 上标 id |
|---|---|
| 第一次 | `cite-ref-2` |
| 第二次 | `cite-ref-2-2` |
| 第三次 | `cite-ref-2-3` |

列表项的 id 固定为 `cite-note-<编号>`。

> 方括号不在 HTML 里，由主题的 CSS 生成（`sup.cite a::before` 与 `::after`）。所以选中正文复制出来只有数字，没有方括号。这是有意的取舍。

## 样式 {#style}

主题自带样式写在 `assets/theme/theme-extra.less`：

- 上标小一号，编号用强调色；
- 方括号由 CSS 生成；
- 列表上方一条分隔线，字号略小、颜色弱化；
- 从正文点到某一条、或从列表点回正文时，目标高亮（`:target`）。

要改这些，先把主题的这份文件复制出来，再改自己那份：

```bash
npx @lightwiki/cli theme eject . --only assets/theme-extra.less
```

覆盖规则与产物见 [静态资源](/basics/assets)。只补一点全站样式时，新建自己的 `assets/extra.less`，不要占用主题的三个文件名。

给某几页挂样式用 frontmatter 的 `styles`，写法见 [frontmatter](/basics/frontmatter)。

## 皮肤里读引用数据 {#it-page}

皮肤里能拿到 `it.page.citations`，一项对应一条引用：

```ts
{
  number: number;   // 编号
  id: string;       // 列表项 id，如 cite-note-1
  name?: string;    // 写了 name 才有这个字段
  count: number;    // 正文里引用了几次
  html: string;     // 引用内容的 HTML，内链已按 basePath 改写、红链已带 class
}[]
```

没写过 `<ref>` 的页面是空数组。自己排一个列表：

```eta
<% if (it.page.citations.length) { %>
<section class="citations">
  <ol>
    <% for (const c of it.page.citations) { %>
      <li id="<%= c.id %>"><%~ c.html %></li>
    <% } %>
  </ol>
</section>
<% } %>
```

`<%~ 值 %>` 原样输出，`<%= 值 %>` 会转义，这里必须用前者，否则 HTML 会变成源码。默认不用动皮肤，核心已经把 `<section class="citations">` 注入正文。皮肤怎么写见 [皮肤](/advanced/skins)，标签规则见 [Eta 语法](/reference/eta)。

## 出错时会怎样 {#failures}

| 写法 | 结果 |
|---|---|
| 没闭合的 `<ref>` | 不当作引用，后面的文字照常显示，标签原样留在产物里 |
| `<ref />`，不带 `name` | 不生效，标签原样留在产物里 |
| `<ref></ref>`，无内容、无 `name` | 不生效，标签原样留在产物里 |
| `<references/>` 没有独立成行 | 标记不生效，列表排到文末 |
| 写了多个 `<references/>` | 只认第一个，其余摘掉 |
| `<ref>` 互相嵌套 | 内层标签摘掉，内容合并成一条 |
| `<ref>` 里放列表或代码块 | 引用跨了块，不会被当成引用；`check` 会报一条 warning |

标签“原样留在产物里”的意思是：`<ref>` 不是 HTML 的元素，浏览器会把它当陌生标签忽略，页面上看不到它，只能在后端产物或“查看源码”里看见。它不报错，但 HTML 不干净。

`wiki check` 不会因为引用本身报错。引用里的链接是死链时，与普通正文一样报红链。`<ref>` 没配对（漏写 `</ref>`，或内容跨了空行、列表、代码块）时，`check` 与 `build` 都会报一条 warning。
