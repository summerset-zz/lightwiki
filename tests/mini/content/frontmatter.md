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
| `scripts` | 字符串 / 数组 / `{ src, module }` | 额外引入的脚本，注入 `</body>` 前（普通脚本带 `defer`，`module: true` 则加 `type="module"`） |
| `categories` | 字符串或数组 | 见 [[category-page]] |
| `sidebarCategory` | 字符串 | 用哪个分类的页面列表充当侧栏 |
| `hintTitle` `hint` | 字符串 | 整篇只有一个术语提示时用 |
| `sourceSite` 等 | 字符串 | 整篇改编的来源，见 [[directives#source]] |
| `license` `licenseUrl` `authors` | 字符串 | 站点自有的内容许可 |

## 页面的样式与脚本 {#assets}

`styles` / `scripts` 相对 `assets/` 解析（也接受 `/assets/...`），`.less` 会认成同名 `.css`。

每条脚本可以单独声明是不是 ES module，两种写法能混用：

```yaml
scripts:
  - theme/analytics.js          # 普通脚本：<script src defer>
  - src: theme/app.js           # ESM：<script type="module">
    module: true
  - theme/widget.js
```

`module: true` 的脚本**不加** `defer` —— module 本来就是延迟执行的。单文件产物（`--inline`）里这个字段也会被保留，`import` / `export` 不会因为内联而报语法错。

## 未知字段不会报错 {#unknown}

校验是**放行未知字段**的。内容仓库和工具版本会脱钩，多一个不认识的键不该让整站失败——校验未知字段是 lint 的事，不是 schema 的事。

## YAML 写坏了会降级 {#lenient}

严格解析会让整站失败，所以解析失败时会退回逐行读取，并在 `wiki check` 里报一条**警告** —— 降级可以，静默吞掉不行。警告里会带上解析器给的行列号，比如「line 3, column 53」。

踩得最多的两种：

```yaml
# ① 值里有「冒号 + 空格」会被当成嵌套键
description: ... travel in: a TTF or OTF ...     # ✗
description: '... travel in: a TTF or OTF ...'   # ✓ 加引号

# ② 引号只包住了一部分
keywords: "@font-face", src, local               # ✗ 「, src」裸露在外面
keywords: ['@font-face', src, local]             # ✓
keywords: '@font-face, src, local'               # ✓
```

`updated` 写错（`2026/11/07`）也会被拦下，但那是 schema 的错，不是 YAML 的错 —— 两者会分别报。
