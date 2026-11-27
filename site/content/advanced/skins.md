---
title: 皮肤
keywords: 皮肤, layout, layouts, eta, 模板覆盖, doc.eta, html 骨架
description: 皮肤是整页的 HTML 骨架，一个文件一页。这一页讲皮肤放在哪、怎么换、里面能拿到哪些数据，以及资源路径为什么必须自己拼。
section: advanced
order: 5
updated: 2026-11-22
draft: false
---

皮肤（layout）是一整页的 HTML 骨架，一个 `.eta` 文件就是一个皮肤。主题提供默认外观，你把同名文件放进内容仓库的 `layouts/` 就把那一层顶掉。

它不处理 markdown，只负责把渲染好的正文装进页面。`<head>` 里放什么、侧栏在哪、正文插在哪，都写在它里面。

皮肤写的是 Eta 模板。这一页只讲「皮肤能用什么」，标签与转义规则本身见 [Eta 语法](/reference/eta)。

## 默认的 doc {#doc}

frontmatter 不写 `layout` 时用 `doc`。所有普通内容页都是 `doc`，首页也一样。

> 0.3 起没有 `index` 皮肤。首页就是内容里的 `index.md`，跟别的页一样走 `doc`。想让它长得不一样，写 `layout: landing` 之类的自定义皮肤。旧文档里提到的首页专用皮肤已经不存在。

## 主题自带的四个皮肤 {#builtin}

| 文件名 | 什么时候用 |
|---|---|
| `doc.eta` | 普通内容页，默认 |
| `category.eta` | 分类页 `/categories/<slug>/`，构建时自动生成 |
| `not-found.eta` | 内容目录里没有 `404.md` 时，根目录 `404.html` 用它 |
| `redirect.eta` | 旧地址跳转页，构建时自动生成 |

后三个不是给内容页选的，是构建过程自己挑的。覆盖它们等于改这三类页面的样子。

## 换皮肤 {#switch}

frontmatter 写 `layout: 名字`，名字是 `layouts/` 下的文件名去掉 `.eta`：

```yaml
---
title: 关于
layout: landing
---
```

皮肤名只能是一段文件名：字母、数字、点、下划线、短横线。带了斜杠或路径会被拒绝，这是为了防止把模板解析到仓库外面去。

文件不存在时构建直接报错，并在错误里列出找过的位置。`wiki check` 也会提前点名。

## 查找顺序 {#lookup}

查找顺序固定两步：

1. 内容仓库的 `layouts/<名字>.eta`
2. 主题包 `@lightwiki/theme-default` 的 `layouts/<名字>.eta`

先找到的赢，都找不到报错。所以只覆盖你要改的那几个文件，其余继续用主题的，升级工具时不会被冲掉。

这两个目录各是干什么的，见 [目录结构](/start/structure)。

## 皮肤里的数据 {#context}

模板里的一切都在 `it` 上。

| 字段 | 是什么 |
|---|---|
| `it.page` | 当前页 |
| `it.site` | 全站信息 |
| `it.nav` | 全站导航，按分组排好 |
| `it.sidebar` | 侧栏，默认等于 `nav`；页面写了 `sidebarCategory` 就换成那个分类的页面 |
| `it.index` | 只有一个 `url`，指向首页 |
| `it.partials` | 内容仓库里提供了哪些可选片段，目前只有 `nav`，见下面那节 |
| `it.shared` | 模板之间传过的东西（一页一个）。皮肤渲染时整页模板都跑完了，所以这里是最终状态 |

`it.page` 在普通内容页里有这些：

| 字段 | 是什么 |
|---|---|
| `title` `description` `keywords` `updated` `section` `order` `categories` `draft` | 来自 frontmatter，`keywords` 已经拆成数组 |
| `lang` `slug` `url` `outputPath` `relativePath` | 位置信息 |
| `frontmatter` | frontmatter 原样对象 |
| `markdown` | 整篇 markdown 原文（含 frontmatter），用来做查看源码 |
| `html` | 已经渲染好的正文 HTML |
| `headings` | 页内标题，进目录用 |
| `citations` | 本页的参考文献，元素有 `number` `id` `name` `count` `html` |
| `meta` | 站点插件写进 `state.env.data` 的数据，核心不规定里面有什么 |
| `source` | frontmatter 里 `source*` 一组的整理版：`site` `title` `url` `revid` `license` `licenseUrl` `changes` |
| `license` `licenseUrl` `authors` | frontmatter 对应字段 |

`it.site` 里有 `title`、`siteUrl`、`base`、`lang`、`urlStyle`、`sections`、`sectionLabels`、`categories`、`categoryList`、`generatedAt`、`pageCount`、`pages`、`search`、`config`。其中四项值得单独说：

| 字段 | 是什么 |
|---|---|
| `pages` | 全站页面摘要数组，元素有 `slug` `url` `title` `section` `order` `updated` `categories` |
| `categoryList` | 只含真正被页面用到的分类，元素有 `slug` `label` `count` |
| `search` | 配置里关掉搜索时是 `null`，主题据这个决定要不要渲染搜索框 |
| `config` | 配置原文，里面有本机绝对路径，不要打印出来 |

`it.nav` 是分组的数组，每组有 `section`、`label`、`pages`，`pages` 的元素有 `title`、`url`、`current`。

`it.sidebar` 有 `kind`（`'site'` 或 `'category'`）、`title`、`category`（只在分类侧栏时有）、`groups`（结构与 `nav` 相同）。

分类页与 404 兜底页的数据不一样，这两类页都没有 `it.page`：`category` 皮肤拿到 `it.category`（`slug` `label` `url` `pages`）和 `it.lang`；`not-found` 皮肤拿到 `it.lang`、`it.nav`、`it.index`。

## 一个最小的完整皮肤 {#skeleton}

`layouts/landing.eta`，只带标题和正文：

```eta
<!doctype html>
<html lang="<%= it.page.lang %>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><%= it.page.title %> · <%= it.site.title %></title>
<link rel="stylesheet" href="<%= it.site.base %>/assets/style.css">
</head>
<body>
<header><a href="<%= it.index.url %>"><%= it.site.title %></a></header>
<main class="prose">
<%~ it.page.html %>
</main>
</body>
</html>
```

frontmatter 写 `layout: landing`，这一页就用它。

## 侧栏与导航 {#nav}

侧栏数据在 `it.sidebar.groups`，结构与 `it.nav` 相同。遍历两层就能画出整套导航：

```eta
<aside>
<% for (const group of it.sidebar.groups) { %>
  <p><%= group.label %></p>
  <ul>
  <% for (const item of group.pages) { %>
    <li><a href="<%= item.url %>"<% if (item.current) { %> aria-current="page"<% } %>><%= item.title %></a></li>
  <% } %>
  </ul>
<% } %>
</aside>
```

`group.section` 为空时是一组没有分组的页面。`item.current` 标记当前页，`aria-current="page"` 靠它加。

## 所有页面共用的片段 {#partials}

想把同一段 HTML 放进每一个页面（比如顶栏），别抄进每个皮肤。在内容仓库的 `layouts/` 下建一个 `nav.eta`，主题就会替你插到 `<body>` 开头：

```eta
<header class="topnav">
  <a href="<%= it.index.url %>"><%= it.site.title %></a>
  <nav>
<% for (const group of it.nav) { %>
    <% if (group.section) { %><p><%= group.label %></p><% } %>
<% for (const item of group.pages) { %>
    <a href="<%= item.url %>"><%= item.title %></a>
<% } %>
<% } %>
  </nav>
</header>
```

放好就生效，`doc`、`category`、`not-found` 三个皮肤都会带上它，不需要覆盖任何一个。

为什么它能自动生效：只要 `layouts/nav.eta` 存在，`it.partials.nav` 就是 `true`，主题的皮肤据此决定要不要 `include`。文件不存在时是 `false`，主题不会去碰一个不存在的文件。

自己写皮肤时也能用同样的写法：

```eta
<% if (it.partials.nav) { %><%~ include('nav', it) %><% } %>
```

`include` 的第二个参数要显式传 `it`，不传的话片段里拿不到任何数据。路径相对内容仓库的 `layouts/` 解析，主题包不在这个查找范围内，所以主题的皮肤不会依赖你仓库里有什么文件。

`redirect` 皮肤不插这一层：它是跳转页，多一段导航没有意义。

## 正文要原样输出 {#html}

正文 HTML 已经渲染好了，要用不转义的输出：

```eta
<div class="prose">
<%~ it.page.html %>
</div>
```

用 `<%= it.page.html %>` 会把整篇正文转义成源码，页面上直接显示一堆尖括号。`<%~` 与 `<%=` 的区别在 [模板](/basics/templates) 一页讲过。

## 皮肤里的代码块要自己标语言 {#code-blocks}

正文里的围栏由 markdown 解析器上色，皮肤绕过了那一步，`<pre>` 里的代码默认是纯文本。给 `<pre>` 或 `<code>` 加 `lang` 属性，构建时会补上颜色：

```eta
<pre lang="ts"><code>const x: number = 1;</code></pre>
```

代码内容里有 `<` 时要写成 `&lt;`。语言名能写什么、写错会怎样，见 [代码高亮](/advanced/code-highlight)。

## 资源路径要自己拼 {#assets}

皮肤里写 `/assets/style.css`，本地看着没问题，部署到 GitHub Pages 的项目站就 404，因为站点根不在域名根上。

正确写法是拿 `it.site.base` 当前缀：

```eta
<link rel="stylesheet" href="<%= it.site.base %>/assets/style.css">
```

`it.site.base` 在站点部署于域名根时是空串，在 `https://用户.github.io/仓库名/` 这种项目站时是 `/仓库名`。它不带末尾斜杠，所以拼接时要自己加 `/`。

主题自带的资源也走同一个前缀：

```eta
<link rel="stylesheet" href="<%= it.site.base %>/assets/theme/style.css">
```

对比一下：正文里写 `![](/assets/x.png)` 会被构建自动加上前缀，皮肤里不会，两者规则不同。

## 皮肤里的链接不算内容链接 {#content-links}

皮肤里写的 `<a href="/a">` 在页面上能点、能跳转，但它不参与正文那套链接检查。`wiki check` 的红链与孤页判定只看**正文**里被 markdown 渲染出来的链接，导航、侧栏、皮肤里直接写的 `<a>` 一律不计 —— 既不算入链，也不会被标红链。

最直接的后果：把首页内容整块写在皮肤里，皮肤链过去的页面仍会被报成孤页。几种做法，按省事程度排：

| 做法 | 效果 |
|---|---|
| 在首页正文里也链一次目标页 | 孤页消失，最省事 |
| 把首页那几条链接改成正文里的 `{{pages}}` 或 `[](...)` | 链接由 markdown 产出，照常计入 |
| 忽略这条提示 | 孤页不是失败项，`--strict` 时才算 |

另外，皮肤里的 `href` 不会被加上 `basePath`，也不会被补 `directory` 模式的尾斜杠，这两道改写只作用于正文。部署在子路径时，皮肤里的链接要自己拼 `it.site.base`。

## 页面级样式与脚本 {#page-assets}

frontmatter 的 `styles` / `scripts` 由构建在渲染之后统一注入：样式插到 `</head>` 前，脚本插到 `</body>` 前。

皮肤不需要为此留任何占位，只要正常写出 `</head>` 和 `</body>`。皮肤里缺这两个标签时，样式会被塞到文件最前面，脚本附在末尾。

这条同样说明：覆盖皮肤不会丢掉页面级资源。字段本身的写法见 [frontmatter](/basics/frontmatter)。

## 从 doc 改起 {#copy}

想改哪一份就让工具把它复制过来，再在原文件上改：

```bash
npx @lightwiki/cli theme list .                    # 主题提供哪些文件、哪些已经被你覆盖
npx @lightwiki/cli theme eject .                   # 全部复制到本地
npx @lightwiki/cli theme eject . --only layouts/doc.eta   # 只复制一份
```

复制到的位置：

| 主题里 | 复制到 |
|---|---|
| `layouts/*.eta` | `layouts/*.eta` |
| `macros/*.eta` | `macros/*.eta` |
| `assets/*` | `assets/theme/*` |

前两类靠查找顺序生效（内容仓库优先），第三类靠构建时的复制顺序（主题先落盘、你的后落盘），所以放在 `assets/theme/` 里的同名文件直接盖掉主题的那份。

`eject` 默认**跳过已存在的文件**，不会覆盖你改过的东西；确实要覆盖就加 `--force`。

> 复制出来的文件**不再跟随工具升级**。想保留升级能力，就别整份复制 —— 只 `--only` 拿你要改的那一个，剩下的继续用主题原件。升级后用 `theme list` 看哪几个还挂着，用主题原件对比差异。

自己从头写也不是不行，但很容易漏细节：`<html lang>`、`<title>` 的拼法、搜索框的 `data-index`、当前项上的 `aria-current`。漏了不会报错，只是某个功能悄悄不工作。

## 写坏了会怎样 {#failures}

| 情况 | 结果 |
|---|---|
| 皮肤名带路径 | 报 `invalid layout name` |
| 文件不存在 | 报 `layout xxx.eta not found`，并列出找过的位置 |
| Eta 语法错误 | 构建中断，报错里带文件名 |
| 皮肤里读一个不存在的字段 | 单层访问不报错，输出空；`it.a.b` 里 `a` 不存在时抛 `TypeError`，构建中断 |

第一、二种会在 `wiki check` 里提前点名。最后一条最容易浪费时间：单层属性读空了只是页面上少一块内容，没有任何提示。改完记得看页面对不对。

正文写法见 [Markdown 与扩展语法](/basics/markdown)，页面开头的字段见 [frontmatter](/basics/frontmatter)。
