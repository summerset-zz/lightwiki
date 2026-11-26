---
title: Eta 语法
keywords: eta, 模板, 皮肤, layouts, macros, include, 转义, autoTrim
description: 皮肤与模板用的模板语言 Eta 的速查：三种标签、转义规则、换行怎么处理、include 片段，以及这里实际用的配置。
section: reference
order: 3
updated: 2026-11-26
draft: false
---

皮肤（`layouts/*.eta`）和宏（`macros/*.eta`）都是 Eta 模板。语言本身很小：三种标签，表达式就是普通 JavaScript。

## 三种标签 {#tags}

| 写法 | 作用 |
|---|---|
| `<% 代码 %>` | 执行，不输出 |
| `<%= 值 %>` | 输出，**转义 HTML** |
| `<%~ 值 %>` | 输出，**不转义** |

`<%~ %>` 只该用在「它本来就是 HTML」的地方。最典型的是正文：

```eta
<%~ it.page.html %>
```

写成 `<%= it.page.html %>` 会把整篇 HTML 转义成源码显示出来。

## 换行怎么处理 {#trim}

皮肤和宏在这里**行为不一样**，写模板时最容易踩：

| | `autoTrim` | 效果 |
|---|---|---|
| 皮肤（`layouts/`） | `[false, 'nl']`（Eta 默认） | 标签前面不动，**标签后面紧跟的一个换行被删掉** |
| 宏（`macros/`） | `false` | 一个字符都不删，换行原样保留 |

所以皮肤里单独一行的 `<% if (x) { %>` 不会在产物里留空行；而同样的写法放到宏里，会多出一个空行（markdown 里空行是有意义的，会分段）。

要空行就自己写一个空行，别指望标签行。

## 注释 {#comments}

Eta 没有专门的注释标签，用 JS 注释：

```eta
<% /* 这一行不输出 */ %>
```

`<%# … %>` **不是** Eta 语法，写了会直接报 `Bad template syntax`。

## include 片段 {#include}

只有皮肤能用 `include`，查找根是**内容仓库的 `layouts/`**：

```eta
<%~ include('nav', it) %>
```

第二个参数 `it` 是传进片段的上下文，通常原样传。主题包的 `layouts/` 不参与查找 —— 主题不能假设用户仓库里一定有某个文件，否则空站点连页面都渲染不出来。所有页面共用的片段见 [皮肤](/advanced/skins#partials)。

宏没有 `views`，别在 `macros/*.eta` 里写 `include`。

## 这里设了什么 {#config}

`packages/core/src/render.ts` 建 Eta 时只显式设了三项：

| 选项 | 值 | 影响 |
|---|---|---|
| `autoEscape` | `true` | `<%= %>` 默认转义；要原样输出就用 `<%~ %>` |
| `cache` | `false` | 改了模板立即生效，不用重启 |
| `views` | `<内容仓库>/layouts` | `include` 只在这一层找 |

其余用 Eta 默认值：标签 `<% %>`、数据对象叫 `it`、模板后缀 `.eta`。

## 拿到哪些数据 {#data}

`it` 里有什么，按皮肤类型不同：内容页的 `doc` 皮肤有 `it.page` / `it.site` / `it.nav` / `it.sidebar` / `it.index` / `it.partials`，四个内置皮肤各有差异，逐项见 [皮肤 → 皮肤里的数据](/advanced/skins#context)。

宏里的 `it` 还多 `args`（位置参数）与 `named`（命名参数），见 [模板](/basics/templates)。
