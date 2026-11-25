---
title: frontmatter
keywords: frontmatter, 元数据, metadata, yaml, title, description, keywords, section, order, updated, draft, layout, styles, scripts, categories, sidebarCategory, frontmatterInjection, lightwiki-page-data, js
description: 页面开头两个 --- 之间的 YAML，决定这页叫什么、排在哪、用哪套皮肤，以及写坏了会怎样。
section: basics
order: 2
updated: 2026-11-23
draft: false
---

## 是什么 {#what}

frontmatter 是文件开头两个 `---` 之间的 YAML。构建时先读它，再读正文。

```yaml
---
title: 页面标题
description: 一句话摘要
keywords: 关键词, keyword
section: basics
order: 1
updated: 2026-11-17
draft: false
---
```

它管的是这一页在站里的身份和位置：标题、摘要、归到哪一组、排第几、哪天更新的、要不要发布、用哪套皮肤。正文只负责内容。

## 最小写法 {#minimal}

只有 `title` 是必填的：

```yaml
---
title: 我的第一页
---
```

没写 `title` 或者写了空值的页面校验不通过，不会被收录。其余字段都可以省掉，用默认值。

## 常用字段 {#fields}

| 字段 | 类型 | 改了会怎样 |
|---|---|---|
| `title` | 字符串，必填 | 页面标题，进 `<title>`、侧栏、搜索和双链解析。不能重复。 |
| `description` | 字符串 | 一句话摘要，进 `<meta name="description">`，搜索结果的摘要一般取自这里。 |
| `keywords` | 逗号分隔的字符串或数组 | 进 `<meta name="keywords">`，也进站内搜索索引。中英都写能扩大命中面。 |
| `section` | 字符串 | 决定侧栏归到哪一组。取值必须在站点配置的 `sections` 里，否则 `wiki check` 报错。 |
| `order` | 数字 | 组内排序，小的在前。 |
| `updated` | `YYYY-MM-DD` | 页面上显示的最后更新日期。只认这个格式。 |
| `draft` | 布尔，默认 `false` | 改成 `true` 时构建不收录，导航和搜索里也没有；本地预览仍能按地址打开。 |
| `layout` | 字符串 | 换这一页的皮肤，写皮肤名（`layouts/` 下的文件名，不带 `.eta`）。不写就是 `doc`，文件不存在时构建报错。见 [皮肤](/basics/skins)。 |
| `styles` | 字符串或数组 | 只给这一页挂 css，路径相对 `assets/`。写 `.css` 就行，`.less` 会自动编译成同名 `.css`。 |
| `scripts` | 字符串、数组或 `{ src, module }` | 只给这一页挂 js，路径相对 `assets/`。要 ES module 就写成 `- src: x.js` 加 `module: true`。 |
| `categories` | 字符串或数组 | 归到哪些分类，写 ASCII slug。构建时为每个用到的分类生成 `/categories/<slug>/`。 |
| `sidebarCategory` | 字符串 | 用哪个分类的页面列表当这一页的侧栏。不写就是全站导航。 |

`categories` 与 `sidebarCategory` 的完整用法见 [分类](/basics/categories)。

另有一组 `source*` / `license*` 字段，用于整篇改编外部内容时标注出处与许可，一般用不上。整篇只有一个术语提示时，用 `hintTitle` / `hint`。

## 写坏了会怎样 {#pitfalls}

下面几种是实际踩过的。

**值里有冒号加空格。** YAML 会把它当成嵌套键，整块解析失败：

```yaml
description: 字体可以 travel in: a TTF or OTF file    # 坏
description: '字体可以 travel in: a TTF or OTF file'  # 好，整段加引号
```

**引号只包住一部分。** 引号后面还有裸露的值就不合法，改成数组：

```yaml
keywords: "@font-face", src, local      # 坏
keywords: ['@font-face', src, local]    # 好
```

**`updated` 格式写错。** `2026/11/07` 这种斜线写法校验不通过，这一页不会被收录，`wiki check` 会报 `expected YYYY-MM-DD`。

**字段名写错。** 未知字段是被放行的，不会报错。所以拼错的字段（比如把 `section` 写成 `sections`）不生效，也没有提示，改完记得看一眼页面上的效果。

**整块解析失败时构建不会中断。** 解析器退回逐行读取，构建继续，`wiki check` 里多一条警告，带解析器给的行列号，比如 line 3, column 53。前面几种写法是最常见的触发原因。

## 标题与地址 {#identity}

`title` 不能重复。双链 `[[标题]]` 靠它解析，重复就会让 `wiki check` 报 duplicate title 并失败。

反过来，改 `title` 只会让按标题写的双链断掉，页面地址不变：地址来自文件名。两种写法的取舍见 [Markdown 与扩展语法](/basics/markdown)。

## 在浏览器里读 {#browser}

页面里的 JS 可以通过一个 JSON 标签读到这一页的 frontmatter，不必自己解析源码。这个开关属于[站点配置](/advanced/config)，在 `wiki.config.ts` 里打开：

```ts
frontmatterInjection: true,
```

默认是 `false`，因为打开后每页的 frontmatter 都会交给浏览器。开启后，每个内容页的 `</body>` 前多出一个标签：

```html
<script type="application/json" id="lightwiki-page-data">{ ... }</script>
```

标签里是这一页的结构化元数据，不含整篇正文。读法：

```js
const data = JSON.parse(document.getElementById('lightwiki-page-data').textContent);
data.title;                // 页面标题
data.categories;           // ['syntax']
data.frontmatter.myOwnKey; // frontmatter 里自己写的键
```

脚本怎么挂到页面上，见 [JavaScript](/basics/javascript)。

标签里有哪些字段：

| 字段 | 内容 |
|---|---|
| `lang` / `slug` / `url` | 语言、文件名、站点地址 |
| `outputPath` / `relativePath` | 产物路径、源文件相对内容根的路径 |
| `title` | 页面标题，必填 |
| `description` / `section` / `updated` | frontmatter 里的同名值，没写的是空串 |
| `order` | 组内排序，没写是 `null` |
| `draft` | 是否草稿，没写是 `false` |
| `keywords` / `categories` | 数组。写成 `"a, b"` 也会拆成两项 |
| `frontmatter` | frontmatter 原样，值保持文件里的写法 |

frontmatter 里的自定义键同时平铺在顶层，`data.myOwnKey` 和 `data.frontmatter.myOwnKey` 都拿得到。自定义键与上面的结构化字段重名时（比如写了 `url:`、`lang:`），顶层保留结构化值，原值只在 `data.frontmatter` 里。

几条边界：

- 只有内容页有这个标签。分类页和 404 页没有。
- 里面的 `<` 一律写成 `\u003c`，frontmatter 里出现 `</script>` 也不会截断标签，`JSON.parse` 之后拿到的是原字符。
- 改过默认皮肤 `doc` 的站点同样有效，不需要在皮肤里另写代码。
- 默认关闭，只在页面确实要读的时候开。
