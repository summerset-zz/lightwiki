# 写法约定（v0.1 已实现部分）

这份文档只描述**当前代码真正支持**的东西。后续扩展（自定义布局、组件插入等）会继续补在这一页。

---

## 1. 目录与文件

内容仓库的根目录就是 `wiki.config.ts` 所在目录。每种语言一个内容目录，在配置里声明：

```ts
// wiki.config.ts
export default {
  title: '站点名',
  siteUrl: 'https://example.com',
  defaultLanguage: 'zh',
  content: { zh: 'content/zh', en: 'content/en' },
  sections: ['guide', 'reference'],
};
```

- **slug = 文件相对路径去掉 `.md`**。`content/zh/second.md` → slug `second`；子目录会保留（`content/zh/api/v1.md` → `api/v1`）。
- **URL 由 slug 推出**，不能单独指定：默认语言是 `/docs/<slug>/`，其他语言是 `/<lang>/docs/<slug>/`。
- **文件名即身份**。改文件名等于删一篇加一篇，站内所有链接都会断。
- 一个 slug 在多种语言里各有一份是最理想的，但**只有一种语言也能构建**（缺译只是提示）。

---

## 2. frontmatter

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | 必填 | 页面标题 |
| `description` | 字符串 | 一句话摘要，同时用于 `<meta name="description">` |
| `keywords` | 字符串或数组 | 逗号分隔即可；中英混写能扩大命中面 |
| `section` | 字符串 | 分组，取值由配置的 `sections` 决定；不在列表里会报错 |
| `order` | 数字 | 组内排序，小的在前 |
| `updated` | `YYYY-MM-DD` | 只认这个格式，别写别的 |
| `draft` | 布尔 | `true` = 不进导航、不参与孤页判定、构建时跳过；`wiki dev` 下仍可按地址打开 |
| `categories` | 字符串或数组 | 分类的键（ASCII slug），见 §3.8 |
| `sidebarCategory` | 字符串 | 用哪个分类的页面列表充当侧栏；不填则用全站导航 |
| `sourceSite` `sourceTitle` `sourceUrl` `sourceRevid` `sourceLicense` `sourceLicenseUrl` `sourceChanges` | 字符串 | 整篇改编自他处时使用，见 §3.5 |
| `license` `licenseUrl` `authors` | 字符串 / 数组 | 站点自有的内容许可，可选 |

未知字段不会报错，会被原样保留。

---

## 3. 正文写法

### 3.1 锚点

```md
## 三种长度 {#counts}
```

- 中文标题自动生成的 id 会是 `h2-3` 这类没有意义的名字，**显式写锚点**才能长期稳定；
- 多语言站点建议两侧用同一个锚点，`/docs/x#counts` 与 `/en/docs/x#counts` 才能都跳得过去；
- 没写锚点的标题会得到一个兜底 id（形如 `h2-5`），可以跳但不要依赖。

### 3.2 站内链接

```md
见 [GSUB / GPOS](/docs/gsub-gpos)。
```

- 写 `/docs/<slug>` 就够了，**不要手写语言前缀**：非默认语言的页面会自动补成 `/<lang>/docs/<slug>`；
- 锚点跟着一起走：`/docs/x#counts` 在中文页会变成 `/zh/docs/x#counts`；
- 只有 `/docs` 这一棵路径会被改写。其他站内路径（工具页、字体页之类）原样输出；
- 链接目标不存在不会报错，但 `wiki check` 会把它列为**红链**。

#### 另一种写法：双链 `[[…]]`

从 MediaWiki 过来的用户可以写：

```md
[[gsub-gpos]]                ← 按 slug
[[GSUB / GPOS 详解]]          ← 按标题
[[gsub-gpos|换个说法]]         ← 自定义显示文字
[[gsub-gpos#substitution]]    ← 带锚点
```

- 解析顺序是**先 slug、再标题**。slug 来自文件名，最稳；标题来自 frontmatter，**改标题就会断链**；
- 同一语言内**标题不能重复**：重复会让 `wiki check` 直接失败，因为 `[[同名]]` 指向哪一页不明确；
- 找不到目标时输出一个占位（`<span class="wikilink-missing">`），并在 check 里列为「未解析的内链」；
- `[[/子页面]]` 这种相对引用**不支持**：我们的 slug 里只有目录分隔，没有「父页面」概念。

### 3.3 外链

写完整的 `https://…`。构建时会自动加 `rel="nofollow noopener"`；指向其他域名的还会加 `target="_blank"`。

### 3.4 术语提示

```md
## 区块是行政分区 {#not-a-category}

<!-- hint: Unicode 区块 | 区块是 Unicode 给码位划的行政区间，只说这段码位归谁管。 -->
```

- `|` 左边是弹窗标题，右边是正文；
- 归属**它上方最近的那个带锚点标题**，所以位置不严格，但放在标题下面最稳；
- 构建时这条注释会被**剥掉**，产物里看不到；数据以 JSON 形式留在页面里：

```html
<script type="application/json" id="lightwiki-hints">[{"title":"…","body":"…","anchor":"…"}]</script>
```

### 3.5 小节来源

```md
## 数字排版 {#figures}

<!-- source: zh.wikipedia.org | 排版数字 | 1383441338 | CC BY-SA 4.0 | https://creativecommons.org/licenses/by-sa/4.0/ | 译自 Typesetting numbers 三节 -->
```

六段用 `|` 分隔，顺序固定：站点、上游标题、修订号、许可证、许可证地址（可空）、改动说明（可以再含 `|`，解析时只切前五刀）。

- 同样会被剥离，产物里以「小节来源」列表的形式出现在文末；
- 署名链接会指向 `https://<站点>/w/index.php?oldid=<修订号>`，所以**修订号必须是固定版本号**，不要写当前页面地址。

整篇都是改编的话，用 §2 里那组扁平的 `source*` 字段，产物里会在正文上方生成一个来源块。

### 3.6 HTML 与 SVG

正文里可以直接写 HTML/SVG（`<figure>`、`<svg>`、`style` 属性都会被保留）。约定：

- 颜色用 `currentColor` 或 CSS 变量，暗色主题才不会看不见；
- 文字排版本身是演示内容时用 HTML（`letter-spacing` 要真实生效），抽象线条用内联 SVG。

### 3.7 宏调用

```md
行内：这里提到 {{glossary("基线", "baseline")}} 这个词。

整行单独一个：

{{note("这一块是块级内容。")}}
```

- 宏定义放 `macros/<名字>.eta`，内容仓库优先、主题包次之；名字大小写不敏感；
- 参数支持位置参数（`"字符串"`、`` `原样` ``、数字）与命名参数（`键: 值`，解析了但 v1 不强制）；
- 宏里能拿到 `it.args`、`it.named`、`it.lang`，以及 `it.page` / `it.site`（完整字段见 §4.3）；
- 宏必须是**同步**的（模板里不能有 `await`）；
- 围栏代码块与行内代码里的 `{{…}}` 不会被展开。

#### 宏产出的是文本，不是成品 HTML

**展开结果会跟正文一样再过一遍解析器**。所以宏模板里可以直接写 markdown、双链、甚至再调别的宏：

```md
这一行是宏产出的 **粗体**，还有一个 [[second|去第二页]]。

- 列表项一
- 列表项二
```

三条后果：

1. **宏作者要像写正文那样注意 `*` `_` `[` 这些字符**。它们会被当成格式标记——这与 MediaWiki 一致。
2. **行内宏只能产出行内内容**。要产出列表、表格这类块级结构，必须让它**整行独占**（这时走块级解析）。
3. **宏的文本里可以再出现 `{{其他宏}}`**，会继续展开。循环引用与超过 20 层嵌套都会报错，页面上保留原文。

如果确实需要一段“已经成形、不要再被解析”的 HTML，用 `it.macro(名字, 参数…)` 拿到已渲染的字符串（HTML 标签会被当作 `html_inline` 原样保留）：

```html
<div class="card">
  <p class="card-title"><%~ it.macro("glossary", it.args[0] ?? "") %></p>
  <p><%= it.args[1] ?? "" %></p>
</div>
```

---

### 3.8 分类

```yaml
categories: [syntax, demo]
sidebarCategory: syntax
```

- 分类的**键是 ASCII slug**，显示名放站点配置：`categories: { syntax: '语法' }`。理由：URL 要稳定、要能翻译；中文名直接进 URL 会同时带来编码和改名两个问题；
- 没声明的分类会直接拿 slug 当显示名，`wiki check` 会提示；
- 构建时给每个**实际被用到**的分类生成一页：`/categories/<slug>/`；
- `sidebarCategory` 让这一页的侧栏换成该分类的页面列表（按 section 分组）；分类不存在或没成员时退回全站导航，侧栏不会空掉；
- 宏里调用 `it.addCategory("slug")` 也能加分，效果与写 frontmatter 一样。

---

## 4. 布局

> 两个词固定下来：**布局**（`layouts/*.eta`，整页骨架）与**宏**（`macros/*.eta`，正文里的 `{{…}}`）。不单独用「模板」二字，避免指代不清。

### 4.1 覆盖布局

布局查找顺序：

```
1. <内容仓库>/layouts/<name>.eta     ← 你覆盖的，优先
2. <主题包>/layouts/<name>.eta
3. 找不到就报错
```

当前只有两个布局名：

| 布局 | 用于 |
|---|---|
| `doc` | 每一篇内容页 |
| `index` | 每种语言的 `/docs/` 目录页 |
| `category` | 每个分类页 `/categories/<slug>/` |

覆盖方式就是建同名文件，只写你要改的部分（想全改就复制一份过来改）。**没覆盖的部分会随主题升级自动跟进**，这也是不要整份拷贝主题的原因。

### 4.2 语法

模板引擎是 [Eta](https://eta.js.org/)，就是带 JS 的 HTML：

| 写法 | 含义 |
|---|---|
| `<%= expr %>` | 输出并转义 |
| `<%~ expr %>` | 输出但不转义（渲染好的正文 HTML 用它） |
| `<% code %>` | 执行，不输出 |

数据都挂在 `it` 上，例如 `<%= it.page.title %>`。

### 4.3 模板上下文

**`it.site`：布局与宏拿到的是同一个对象**

| 字段 | 说明 |
|---|---|
| `title` `siteUrl` `base` | 站点名、站点地址、部署基路径（`basePath` 规范化后） |
| `defaultLanguage` `languages[]` | 默认语言与全部语言 |
| `urlStyle` `sections[]` | 链接形态、配置里声明的 section 顺序 |
| `generatedAt` | 构建时间（ISO 8601）。**它让产物每次都不同**，别拿它做「内容是否变化」的判断 |
| `pageCount` `pageCounts` | 已发布页数：总数与分语言 |
| `categories` `categoryList` | 分类显示名映射；实际被使用的分类与计数 |
| `pages[]` | 全部已发布页面的摘要：`{ lang, slug, url, title, section, order, updated, categories }` |
| `config` | `wiki.config.ts` 的原始配置。里面有本机绝对路径（`root` / `themeDir`），别原样打出来 |

**`it.page`：布局比宏多几项**

布局（`doc.eta` / `index.eta`）拿到完整页：

| 字段 | 说明 |
|---|---|
| `lang` `slug` `url` `outputPath` `relativePath` | 位置信息 |
| `title` `description` `keywords[]` `updated` `section` `order` | 常用元信息 |
| `categories[]` | 当前页所属分类（含宏登记的） |
| `html` | 已渲染的正文，用 `<%~ %>` 输出 |
| `headings[]` | `{ level, text, id }` |
| `hints[]` `sources[]` `source` | 术语提示、小节来源、整篇来源 |
| `license` `licenseUrl` `authors` | 站点自有许可 |
| 其余 frontmatter 字段 | **平铺**在同层，`it.page.自定义键` 直接可用 |
| `frontmatter` | frontmatter 原对象 |

宏拿到的元信息相同，但**没有 `html` / `headings` / `hints` / `sources`**——宏执行时这些还在生成中。所以宏里不要试图读本页正文，那是循环依赖。

**其他上下文**

```
it.nav     [ { section, pages: [ { title, url, current } ] } ]   // 侧栏（全站导航）
it.sidebar { kind: 'site' | 'category', title, category?, groups[] }
           // 实际侧栏：默认等于 it.nav；声明了 sidebarCategory 就是分类版
it.index   { url }                                              // 该语言目录页
it.groups  同 it.nav（只有 index.eta 有）
it.categories  同 it.site.categoryList（只有 index.eta 有）
it.args    宏的位置参数
it.named   宏的命名参数
it.lang    当前页语言
```

### 4.4 魔术字对照

MediaWiki 的魔术字在这里不需要单独语法——`it` 就是普通对象，能跑任意表达式：

| MediaWiki | 这里怎么写 |
|---|---|
| `{{PAGENAME}}` | `<%= it.page.slug %>` |
| `{{FULLPAGENAME}}` | `<%= it.page.lang + "/" + it.page.slug %>` |
| `{{SITENAME}}` | `<%= it.site.title %>` |
| `{{NUMBEROFPAGES}}` | `<%= it.site.pageCount %>` |
| `{{CURRENTYEAR}}` | `<%= it.site.generatedAt.slice(0, 4) %>` |
| `{{#if: 条件 \| 甲 \| 乙}}` | `<% if (条件) { %>甲<% } else { %>乙<% } %>` |
| `{{#expr: 1 + 2}}` | `<%= 1 + 2 %>` |
| `{{#ifeq: a \| b \| …}}` | `<% if (a === b) { %>…<% } %>` |

差别在于：魔术字是**语法层面的特例**，只能是有限的几种；这里是**模板里的普通代码**，能组合、能循环、能调 `it.site.pages.filter(...)`。

---

## 5. 命令

```bash
yarn wiki dev <目录> [-p 端口]      # 本地预览，改内容或模板自动刷新
yarn wiki check <目录> [--strict]   # 校验 frontmatter / section / 红链 / 孤页 / 缺译
yarn wiki build <目录> [-o 输出目录] # 产出静态站点
```

`dev` 不会写磁盘，全部在内存里渲染；`build` 会先清空输出目录再写。

---

## 6. 已知限制（v0.1）

- **缺译会导致红链**：英文页链到只有中文存在的页面时，目标页确实 404。暂时没有「回退到默认语言」的行为。
- **只有 `/docs` 会被补语言前缀**，其余站内路径原样输出。
- **布局名固定为 `doc` / `index` / `category`**，还不能「按 section 选不同布局」。
- **分类不能嵌套**，也没有「子分类」「分类的排序」这些能力；分类顺序跟站点配置里声明的顺序走。
- **没有图片处理**：`assets/` 原样复制，不做缩放、不做哈希、不做 `<picture>`。
- **没有搜索**：`hints` 只是数据，检索能力还没接。
- **`basePath` 目前只适合部署在根路径**。要用 `file://` 直接打开产物，还需要等相对路径模式（`urlStyle: 'file'` 只实现了链接层）。
