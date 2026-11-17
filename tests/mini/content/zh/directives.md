---
title: 行内指令
keywords: 指令, hint, source, 术语, 来源, directive
description: 两种写在 HTML 注释里的指令：术语提示与小节来源。
section: syntax
order: 6
updated: 2026-11-15
draft: false
categories: [syntax]
---

指令写在 HTML 注释里，构建时会被剥离，产物里看不到注释本身。

## 术语提示 {#hint}

<!-- hint: 术语提示 | 就是你现在看到的这种注释，构建时会被剥掉，只留下结构化数据。 -->

在带锚点的标题下面写一行：

```md
<!-- hint: Unicode 区块 | 区块是 Unicode 给码位划的行政区间。 -->
```

它归属**上方最近的带锚点标题**，所以位置不必严格，但放在标题下面最稳。

产物里它以 JSON 形式留在页面中，供前端做弹窗：

```html
<script type="application/json" id="lightwiki-hints">[…]</script>
```

## 小节来源 {#source}

只借了某几节时，写在那一节里：

<!-- source: zh.wikipedia.org | 示例条目 | 12345678 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | 仅用于演示，删去了原文全部内容 -->

```md
<!-- source: 站点 | 上游标题 | 修订号 | 许可证 | 许可证地址 | 改动说明 -->
```

六段用 `|` 分隔，顺序固定。改动说明可以再含 `|`（解析时只切前五刀）。产物里会以「小节来源」列表出现在文末。

整篇都是改编的话，改用 frontmatter 的 `sourceSite` / `sourceTitle` / `sourceUrl` / `sourceRevid` / `sourceLicense` / `sourceLicenseUrl` / `sourceChanges`，产物里会在正文上方生成来源块。

修订号必须是固定版本号，不要写当前页面地址——上游一改，署名就指到另一版了。
