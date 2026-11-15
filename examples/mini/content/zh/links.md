---
title: 链接
keywords: 链接, link, 双链, wikilink, 内链
description: 站内链接会自动补语言前缀，双链可以按 slug 或标题解析，外链自动加 nofollow。
section: syntax
order: 2
updated: 2026-11-15
draft: false
categories: [syntax]
---

## 普通站内链接 {#markdown-link}

写 `/docs/<slug>` 就够了，**不要手写语言前缀**：

```md
见 [宏](/docs/macros)。
```

效果：见 [宏](/docs/macros)。

在英文页里，同一个写法会自动变成 `/en/docs/macros`。跳转逻辑只处理 `/docs` 这一棵路径，其他站内路径（比如工具页）原样输出。

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

同一语言里标题不能重复，重复会让 `wiki check` 直接失败——因为 `[[同名]]` 指向哪一页不明确。找不到目标时页面上会留下一个灰色占位，`check` 里列为「未解析的内链」。

## 外链 {#external}

写完整的地址即可，构建时会自动加 `rel="nofollow noopener"`，指向其他域名的还会加 `target="_blank"`。

效果：[Eta 模板引擎](https://eta.js.org/)
