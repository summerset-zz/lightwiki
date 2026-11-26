---
title: frontmatter
keywords: frontmatter, 元数据, metadata, yaml, title, description, keywords, section, order, updated, draft, layout, styles, scripts, categories, sidebarCategory, frontmatterInjection, lightwiki-page-data, js
description: 页面开头两个 --- 之间的 YAML，决定这页叫什么、排在哪、用哪套皮肤，以及写坏了会怎样。
section: basics
order: 2
updated: 2026-11-26
draft: false
---

## 什么是frontmatter {#what}
frontmatter是`markdown`文件开头由两个`---`围成的yaml语句。该语句会为markdown文档增加meta信息。

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

在<strong>轻维基</strong>，一个合法的`md`文件至少需要包含`title`这个属性。如果没有`title`，该文件会在构建时被跳过。

## YAML的语法 {#yaml}
yaml 的基本语法只有两条：
- `key: value`式语法，英文冒号后跟一个空格；
- 层级关系由距离行首的缩进量计算。缩进可以用tab或空格，但同一份文件里不应当混用。

```yaml
title: 页面标题          # 普通字符串，不加引号
order: 1                 # 数字，不加引号
draft: false             # 布尔只有 true / false，不加引号
keywords: [语法, 参考]    # 数组，一行写完
updated: 2026-11-26      # 日期，不加引号
```
数组也可以用缩进的形式每行一条。注意这个`缩进 横杠 空格`的格式。

```yaml
scripts:
  - app.js
  - src: math.js
    module: true
```
```jsonc
// 等价JSON(编译结果)
{
  "scripts": [
    "app.js",
    {"src":"math.js","module":true}
  ]
}
```

以下几种字符串**必须加引号**，否则会被当成结构而不是文字：

| 特征                                | 如果不加引号                                 |
| ----------------------------------- | -------------------------------------------- |
| 字符串中含有冒号加空格 `时间: 12点` | 被当成嵌套键，整块解析失败                   |
| 以 `[` 或 `{` 开头                  | 被当成数组 / 对象                            |
| 以 `#` 开头                         | 被当成注释，值是 `null`，整页被跳过          |
| `#` 前面有空格                      | `#` 及之后的内容被当成注释（`a#b` 不受影响） |



## 轻维基中的frontmatter {#fields}

| 字段              | 类型                             | 功能                                                                                                                                                                                           |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`           | 字符串，必填                     | 决定页面的显示标题、`<title>`标签、mediawiki式内链的指向。                                                                                                                                     |
| `description`     | 字符串                           | 决定`<meta name="description">`，SEO会用到。                                                                                                                                                   |
| `keywords`        | 逗号分隔的字符串或数组           | 决定`<meta name="keywords">`，SEO和站内搜索会用到。                                                                                                                                            |
| `section`         | 字符串                           | 决定该页面在左侧边栏中分在哪一组。取值建议是`wiki.config.ts`中`sections`的值之一。如不在该范围则不会报错，页面仍会出现在边栏中，但被排到最后一组、组名直接用 slug；`wiki check` 会把这条点名。 |
| `order`           | 数字                             | 同一个组内的排序。不必连续。                                                                                                                                                                   |
| `updated`         | `YYYY-MM-DD`                     | 页面上显示的最后更新日期。格式**必须**是`YYYY-MM-DD`，如果写错了则整页会被跳过。                                                                                                               |
| `draft`           | 布尔，默认 `false`               | 在你编辑到一半但是要部署的时候写成`true`，编译就会跳过该文档，在开发服务器中可通过slug正常打开。                                                                                               |
| `layout`          | 字符串                           | 为该页面指定皮肤文件（`layouts/`下的文件名，不带`.eta`）。                                                                                                                                     |
| `styles`          | 字符串或数组                     | 为该页面挂载额外css，路径相对 `assets/`。                                                                                                                                                      |
| `scripts`         | 字符串、数组或 `{ src, module }` | 为该页面挂载额外js，路径相对 `assets/`。                                                                                                                                                       |
| `categories`      | 字符串或数组                     | 该页面的分类。构建时会自动生成`/categories/<slug>/`来显示该分类下的所有页面。                                                                                                                  |
| `sidebarCategory` | 字符串                           | 如果填写，则侧边栏会成为该分类的页面列表。不填写则是按section分组的所有页面列表。                                                                                                              |
| 其他自定义字段    | 任意                             | 会成为该页面元数据的一部分，在皮肤中使用`it.page`获取所有元数据。                                                                                                                              |
### title {#identity}
`title`字段是该页面的显示标题，影响页面在浏览器中的标题和正文中的标题；此外还会影响mediawiki式内链。
- 必填。
- 整站不能重复。

如果一个页面的`title`被修改了，则mediawiki式内链可能失效，但markdown式内链仍然有效，因为它使用的是文件路径。

### description / keywords {#seo}

`description`会应用于`<meta name="description">`中，主要用于SEO。

`keywords`不但会应用于`<meta name="keywords">`，还会在站内搜索中用到。

### section / order {#section}
`section`字段将决定该页面在左侧边栏中分到哪一组。

`wiki.config.ts`中的`sections`字段可以定义左侧边栏中会出现哪些section。如果一个页面使用了不在此范围内的section，则该页面会出现在边栏最底部、并且单独分一组，`wiki check`也会给出相应提示。

`order`决定这一页在section中的排序。
> 分类页的条目也按 `order` 排：跨 section 的扁平排序，详见 [分类](/basics/categories#order)。

### categories {#categories}
`categories`用于给这个页面添加分类信息，系统在编译时会自动生成`/categories/<slug>/`的分类列表页。

`sidebarCategory`用于替换这一页的左边栏。如果指定，则该分类的页面列表会取代sections放进左边栏。

`categories` 与 `sidebarCategory` 的完整用法见 [分类](/basics/categories)。


### styles {#less}
在frontmatter的`styles`字段里填写css/less文件名即可让本页加载额外的样式表。
- 填写的文件名是相对于`assets`目录的。
- less文件会被编译为同名的css文件：同名的 `style.less` 存在时，写 `style.css` 与 `style.less` 等价（指向同一份编译结果）。


```yaml
# 假设你的assets目录里有style1.css和style2.less两个样式表，则以下两个写法都可以用：
styles: ['style1.css','style2.css']
styles: ['style1.css','style2.less']
# 但是这种写法就不行，因为style1.less不存在。
styles: ['style1.less','style2.css']
```
如果存在同名的css和less文件，则less文件的编译结果会覆盖同名的css文件。此时你会在`wiki check`的结果中收到一条提示。
```yaml
# 假设你的assets目录里有duplicated.css和duplicated.less：
styles: ['duplicated.css']  # 实际上拿到的是duplicated.less的编译结果
styles: ['duplicated.less'] # 同上
```
关于更多样式表相关的知识，请参考 [样式与 Less](/advanced/styles#less)。

> `styles` 只对当前页生效。如果你想对整站生效，可以：
> - 在皮肤的`<head>`中增加一条`<link>`指向样式表，[皮肤](/advanced/skins)。该规则会追加到现有样式中。
> - 覆盖默认主题的样式表，参考[静态资源 → 覆盖主题资源](/basics/assets#theme)。该规则会覆盖皮肤的原始样式表。

### scripts {#esm}

`scripts`用于指定该页面需要额外加载哪些脚本。每一条都可以单独声明是不是ESModule，写成对象即可：

```yaml
scripts:
  - src: app.js
    module: true
  - plain.js
```

也可以整行写（flow 语法）：

```yaml
scripts: [{ src: app.js, module: true }, plain.js]
```

上面这种数组会输出两个 `<script>` 标签，顺序与声明一致：

```html
<script type="module" src="/assets/app.js"></script>
<script src="/assets/plain.js" defer></script>
```

`module` 后面必须是布尔值。写成 `module: "true"`时会校验失败，**整页会被跳过**。

执行时机与注入顺序见 [JavaScript](/advanced/javascript)。


## 在皮肤和模板中读取 {#page-data}

在皮肤和模板（`layouts/*.eta`、`macros/*.eta`）中，frontmatter 的字段平铺在 `it.page` 这一层，原对象在 `it.page.frontmatter`。

> `it.page` 里还有 `slug`、`url`、`keywords` 这类结构化字段。frontmatter 恰好写了同名键时（比如 `url:`），`it.page.url` 拿到的是结构化值，原值只在 `it.page.frontmatter.url` 里。
>
> 宏里读不到 `html` / `headings`（那时正文还在渲染），这两项只在布局里有。



## 在运行时JS读取 {#jsruntime}

运行时 JS 要先在 `wiki.config.ts` 里打开 `frontmatterInjection`（默认关闭，见 [站点配置](/reference/config)）：

```ts
frontmatterInjection: true,
```

打开后，每个内容页的 `<head>` 末尾多一段 JSON：

```html
<script type="application/json" id="lightwiki-page-data">{ … }</script>
```

此时，主题的 `doc` 皮肤会同时引入 `assets/theme/page-data.js`，提供一个 `pageMeta()`函数：

```js
pageMeta().title;                 // 第一次调用时才 JSON.parse
pageMeta().frontmatter.myOwnKey;  // 之后再调直接拿缓存
```

> 你也可以手动读取`script#lightwiki-page-data`元素的内容进行JSON.parse处理。

### 边界情况 {#eta-limits}

`script#lightwiki-page-data`的注入是构建时插入的，但`pageMeta()`函数则由默认皮肤`layouts/doc.eta`提供脚本引用。如果你决定自己写皮肤，别忘了增加：
```html
  <script src="<%= it.site.base %>/assets/theme/page-data.js"></script>
```

- 分类页和 404 页既没有标签，也没有 `pageMeta()` —— 它们没有 frontmatter。
- 用户脚本、站内搜索脚本都在 `</body>` 前且带 `defer`，执行时 `<head>` 里的数据早就就位了。因此在用户脚本里可以安全地使用注入数据。