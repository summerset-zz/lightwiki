---
title: 布局
keywords: 布局, layout, 模板, 覆盖, override, 页面布局, landing
description: 布局是整页骨架，按「内容仓库 → 主题包」的顺序查找，可以只覆盖要改的部分。
section: reference
order: 0
updated: 2026-11-17
draft: false
categories: [official]
---

布局（`layouts/*.eta`）是整页骨架，宏（`macros/*.eta`）是正文里的片段。这两个词不混用。

## 查找顺序 {#order}

```
1. <内容仓库>/layouts/<name>.eta   ← 你覆盖的，优先
2. <主题包>/layouts/<name>.eta
3. 找不到就报错
```

当前主题提供的布局名：

| 布局 | 用于 |
|---|---|
| `doc` | 每一篇内容页（包括首页） |
| `category` | 分类页 |
| `not-found` | 没有 `404.md` 时的兜底页（见 [[commands#not-found]]） |
| `redirect` | 重定向跳转页，每条重定向生成一份（见 [[commands#redirects]]） |

不再有 `index` 布局：首页就是一篇普通内容页（`index.md`），它默认走 `doc`，想换就写 `layout:`。

覆盖就是建同名文件，只写要改的部分。**没覆盖的部分会随主题升级自动跟进**——这也是不要整份拷贝主题的原因。

## 指定某一页用哪个布局 {#per-page}

默认内容页全部用 `doc`。在 frontmatter 里写 `layout` 就能换掉这一页的骨架：

```yaml
---
title: 我的站点
layout: landing
---
```

它去 `layouts/landing.eta` 找模板（照上面的查找顺序），找不到就直接报错——不会默默退回 `doc`。`wiki check` 会先把「哪个文件、要哪个布局」点出来，不用等到构建。

几个要知道的地方：

- **名字只能是一段文件名**（字母、数字、`._-`），写 `../x` 这类会直接判为不合法。
- **换布局不换数据**：能用的还是 `doc` 那套 `site` / `page` / `nav` / `sidebar` / `index`。想做成完全不同的版式，就自己在 `.eta` 里写完整 HTML——包括 `<style>` 与 `<script>`，不必先建 `assets/`。
- **不限于首页**：任何一页都可以，也能多页共用同一个布局。

一个小例子，一个只有标题与正文、没有侧栏的落地页：

```html
<!doctype html>
<html lang="<%= it.page.lang %>">
  <head>
    <meta charset="utf-8" />
    <title><%= it.page.title %></title>
    <style>body{margin:0;display:grid;place-items:center;min-height:100vh}</style>
  </head>
  <body>
    <main>
      <h1><%= it.page.title %></h1>
      <%~ it.page.html %>
    </main>
  </body>
</html>
```

## 语法 {#syntax}

模板引擎是 Eta，就是带 JS 的 HTML：

| 写法 | 含义 |
|---|---|
| `<%= 表达式 %>` | 输出并转义 |
| `<%~ 表达式 %>` | 输出但不转义（渲染好的正文用它） |
| `<% 代码 %>` | 执行，不输出 |

## 上下文 {#context}

每个布局拿到的变量不一样，`it.` 后面能写什么以这张表为准：

| 布局 | 可用变量 |
|---|---|
| `doc` | `site`、`page`（含 `html`、`headings`、`hints`、`sources`）、`nav`、`sidebar`、`index` |
| `category` | `site`、`lang`、`category`、`nav`、`index` |
| `not-found` | `site`、`lang`、`nav`、`index` |
| `redirect` | `site`、`from`、`to` |

字段含义见 [[context]]。几点要注意：

- `category`、`not-found`、`redirect` 没有 `page`。`category` 与 `not-found` 用 `lang`，`redirect` 只有 `from` 和 `to`。
- 换布局不换数据：能用的还是 `doc` 那套 `site` / `page` / `nav` / `sidebar` / `index`。
- 宏执行时正文还在生成，所以宏里没有 `html` / `headings`——**这几个字段只有布局 `doc` 的 `page` 才有**。

## 为什么回避「模板」二字 {#naming}

MediaWiki 用户说「模板」指的是正文里 `{{…}}` 那个东西，而这里它已经被布局占了。所以文档里一律用「布局」和「宏」两个词，任何地方都不单独说「模板」。
