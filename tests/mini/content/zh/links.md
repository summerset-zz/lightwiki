---
title: 链接
keywords: 链接, link, 双链, wikilink, 内链
description: 站内链接写站内绝对路径，双链可以按 slug 或标题解析，外链自动加 nofollow。
section: syntax
order: 4
updated: 2026-11-17
draft: false
categories: [syntax]
---

## 普通站内链接 {#markdown-link}

写 `/macros` 这样的站内绝对路径就够了：

```md
见 [宏](/macros)。
```

效果：见 [宏](/macros)。

构建时会补上 `basePath`、`urlPrefix`、`docsDir` 与 directory 模式的尾斜杠，这些都不用自己写。

相对路径也能用，但基准是**当前页所在的目录**，与浏览器一致。这一页在 `/links/`，所以 `./macros` 落到 `/links/macros`（不存在），`../macros` 才回到 `/macros`。

效果：[用相对路径过去的宏](../macros)。

`urlStyle: 'file'` 下产物就是 `a.html`，所以只认以 `.html` 结尾的相对路径（后缀会去掉再比），其余相对路径当静态文件跳过。

## 红链 {#redlink}

指向**还不存在的页面**的站内链接会被标上 `class="redlink"`（同 MediaWiki 的 `.new`，只是换了个说得清的名字），主题给它的样式是红字 + 虚线下划线。

判定靠构建时已经知道的全部页面地址：不在表里、又不是资源（`/assets/`、带扩展名）与分类页，就算红链。所以从别处搬来的内容里那些原站路径（`/credits/maker/google`）也会一起被点名。

它不影响构建能不能过（`--strict` 时算失败），只是让你一眼看到「这里还差一页」。这一页不摆真例子——示例站对外发布，放一个永远修不好的红链只会让 CI 恒红。

## 双链 {#wikilink}

从 MediaWiki 过来的用户可以写双链。目标既可以是 slug，也可以是页面标题：

```md
[[macros]]
[[宏]]
[[macros|换个说法]]
[[anchors#why]]
```

效果：

- 按 slug：[[macros]]
- 按标题：[[宏]]
- 带文字：[[macros|换个说法]]
- 带锚点：[[anchors#why]]

解析顺序是**先 slug、再标题**。slug 来自文件名，最稳；标题来自 frontmatter，改标题就会断链。

标题不能重复，重复会让 `wiki check` 直接失败——因为 `[[同名]]` 指向哪一页不明确。找不到目标时页面上会留下一个灰色占位，`check` 里列为「未解析的内链」。

## 外链 {#external}

写完整的地址即可，构建时会自动加 `rel="nofollow noopener"`，指向其他域名的还会加 `target="_blank"`。

效果：[Eta 模板引擎](https://eta.js.org/)
