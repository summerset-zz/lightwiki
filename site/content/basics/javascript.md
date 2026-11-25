---
title: JavaScript
keywords: 脚本, javascript, scripts, module, defer, esm
description: 页面级脚本由 frontmatter 的 scripts 字段挂载。这一页讲三种写法、module 与普通脚本的执行差别，以及主题自带的搜索脚本怎么用。
section: basics
order: 7
updated: 2026-11-17
draft: false
---

页面级脚本写在 `assets/` 里，由 frontmatter 的 `scripts` 字段挂到具体页面上。路径相对 `assets/`。

构建在渲染完成后把 `<script>` 插到 `</body>` 前。主题的脚本先输出，你声明的按顺序排在后面。

## 三种写法 {#forms}

最常见的是数组里写文件名：

```yaml
scripts: [app.js]
```

只有一个文件时可以省掉方括号：

```yaml
scripts: app.js
```

需要 ES module 时写成对象，两种可以混放在同一个数组里：

```yaml
scripts:
  - src: app.js
    module: true
  - plain.js
```

| 写法 | 意思 |
|---|---|
| `app.js` | 纯字符串，等于 `module: false` |
| `{ src: app.js, module: true }` | 这一条按 module 输出 |
| 上述两种混在数组里 | 按声明顺序注入 |

路径相对 `assets/`，写 `/assets/app.js` 也认，构建会剥掉这个前缀再找文件。

**站外地址直接写完整的 URL**，它会原样进产物：不查本地文件、不加站点前缀，`--inline` 也不会去内联它。

```yaml
scripts:
  - src: https://cdn.jsdelivr.net/npm/某个库/dist/x.min.js
    module: true
```

引外部库的完整例子（含 CDN 与本地各自的代价）见 [引用外部库](/advanced/external-libs)。

## module 与普通脚本 {#module}

两者的产物标签不一样：

| 写法 | 产物里的标签 |
|---|---|
| `app.js` | `<script src="/assets/app.js" defer></script>` |
| `{ src: app.js, module: true }` | `<script type="module" src="/assets/app.js"></script>` |

普通脚本自动带 `defer`。module 脚本不带，因为它本来就是延迟执行的，再加 `defer` 没有意义。

两种都在 DOM 解析完之后才跑。脚本里可以直接查元素，不需要等 `DOMContentLoaded`。

用 module 才能写 `import` / `export`。普通的 `<script>` 里写 `import` 会报语法错误。

## 一个最小的例子 {#example}

`assets/app.js`：

```js
document.querySelectorAll('.copy').forEach((button) => {
  button.addEventListener('click', () => {
    navigator.clipboard.writeText(button.dataset.text ?? '');
  });
});
```

frontmatter：

```yaml
scripts: [app.js]
```

页面正文里给按钮加上 `class="copy"` 和 `data-text` 就能点。

## 注入位置与顺序 {#order}

脚本插到 `</body>` 前，主题自带的排在你声明的之前：

1. 主题的 `assets/theme/search.js`，站内搜索开着时才有
2. 这一页 `scripts` 里声明的，按声明顺序

皮肤不需要为脚本留占位，正常写出 `</body>` 就行。皮肤里没有这个标签时，脚本附在文件末尾。皮肤本身怎么写见 [皮肤](/basics/skins)。

## 主题自带的搜索脚本 {#search}

主题的 `search.js` 去找带 `data-lightwiki-search` 属性的容器，在里面填搜索框和结果列表。要自己摆搜索框，照这个约定写：

```html
<div class="search" data-lightwiki-search data-index="/search-index.json">
  <input type="search" class="search-input" placeholder="搜索…">
  <ul class="search-results" hidden></ul>
</div>
```

容器、`input[type="search"]`、`.search-results` 三样缺一个，脚本就什么都不做，也不报错。

`data-index` 是索引地址。索引内联在页面里时（`file` 与 `inline` 模式），脚本直接读页面里那一份，不去请求这个地址。

> 配置里关掉搜索时索引不生成，主题的搜索脚本也不输出，这个容器就别写。

## 出错的表现 {#failures}

与样式表一致：`wiki build` 打警告继续，`wiki check` 算错误，退出码 1：

```
x zh/index -> scripts: nope.js
```

路径写错时页面照常生成，只是脚本没加载。页面上往往看不出任何区别，改完去浏览器控制台看一眼。

站外地址不在这项检查里：CDN 上的东西我们看不见，域名写错也不会报，只会在浏览器控制台里失败。

字段本身的位置与规则见 [frontmatter](/basics/frontmatter)。

## 内联模式 {#inline}

`wiki build --inline` 时脚本被内联成 `<script>`，产物里不再有独立的 js 文件。

module 脚本内联后仍然保留 `type="module"`，`import` / `export` 照常能跑。

搜索索引也会内联进页面，`data-index` 变成空值，搜索脚本直接读页面里那一份。这一条是为了让单个 html 拷走也能搜。

> 体积会明显变大：每页都带一份脚本、一份样式、一份全站搜索索引。100 页的站，光索引就是每页几十 KB。单文件产物适合把一页单独发出去，不适合做站时默认开着。

同一次构建里样式表也会一起内联。样式怎么编译见 [样式与 Less](/basics/styles)，图片等资源的路径规则见 [静态资源](/basics/assets)。
