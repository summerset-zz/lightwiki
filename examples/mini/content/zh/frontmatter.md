---
title: frontmatter
keywords: frontmatter, 字段, 元数据, metadata, yaml, styles, scripts
description: 页面开头的 YAML 块能写哪些字段，以及写坏了会怎样。
section: syntax
order: 2
updated: 2026-11-17
draft: false
categories: [syntax]
---

页面开头两个 `---` 之间是 frontmatter：

```yaml
---
title: 页面标题
description: 一句话摘要
keywords: 关键词, keyword
section: syntax
order: 0
updated: 2026-11-15
draft: false
categories: [syntax]
sidebarCategory: syntax
---
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | 必填 | 页面标题，同时是双链 `[[标题]]` 的解析依据 |
| `description` | 字符串 | 一句话摘要，用于 `<meta name="description">` |
| `keywords` | 字符串或数组 | 逗号分隔即可，中英混写能扩大命中面 |
| `section` | 字符串 | 分组，取值由配置的 `sections` 决定 |
| `order` | 数字 | 组内排序，小的在前 |
| `updated` | `YYYY-MM-DD` | 只接受这个格式 |
| `draft` | 布尔 | 见 [[structure#draft]] |
| `layout` | 字符串 | 这一页用的布局名，不写就是 `doc`，见 [[layouts#per-page]] |
| `styles` | 字符串或数组 | 额外引入的样式表，注入 `</head>` 前 |
| `scripts` | 字符串或数组 | 额外引入的脚本，注入 `</body>` 前（带 `defer`） |
| `categories` | 字符串或数组 | 见 [[categories]] |
| `sidebarCategory` | 字符串 | 用哪个分类的页面列表充当侧栏 |
| `hintTitle` `hint` | 字符串 | 整篇只有一个术语提示时用 |
| `sourceSite` 等 | 字符串 | 整篇改编的来源，见 [[directives#source]] |
| `license` `licenseUrl` `authors` | 字符串 | 站点自有的内容许可 |

## 未知字段不会报错 {#unknown}

校验是**放行未知字段**的。内容仓库和工具版本会脱钩，多一个不认识的键不该让整站失败——校验未知字段是 lint 的事，不是 schema 的事。

## YAML 写坏了会降级 {#lenient}

真实内容里会出现 `keywords: "@font-face", src, local` 这种非法 YAML（漏了方括号）。严格解析会让整站失败，所以解析失败时会退回逐行读取，并在 `wiki check` 里报一条**警告**。

降级可以，静默吞掉不行。
