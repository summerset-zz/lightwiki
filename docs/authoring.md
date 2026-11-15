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

整行单独一个（会走块级）：

{{note("这一块是块级内容。")}}
```

- 宏定义放 `macros/<名字>.eta`，内容仓库优先、主题包次之；名字大小写不敏感；
- 参数支持位置参数（`"字符串"`、`` `原样` ``、数字）与命名参数（`键: 值`，解析了但 v1 不强制）；
- **整行只有一个宏**时走块级，可以返回 `<div>`、`<table>`；混在句子中间时走行内，只能返回行内元素；
- 宏里能拿到：`it.args`、`it.named`、`it.page`（当前页 frontmatter）、`it.site`、`it.lang`；
- 宏必须是**同步**的（模板里不能有 `await`）；
- 围栏代码块与行内代码里的 `{{…}}` 不会被当成宏。

一个宏长这样：

```html
<span class="glossary" title="<%= it.args[0] ?? '' %>"><%= it.args[1] ?? it.args[0] ?? '' %></span>
```

宏可以调用另一个宏，用 `it.macro(名字, 参数…)`，返回值是已经渲染好的 HTML（所以用 `<%~ %>` 输出）：

```html
<div class="card">
  <p class="card-title"><%~ it.macro("glossary", it.args[0] ?? "") %></p>
  <p><%= it.args[1] ?? "" %></p>
</div>
```

- 不要在宏里写 `{{另一个宏}}` 指望它被展开：宏的产物不会再过一轮 markdown 解析；
- 循环引用和超过 20 层的嵌套都会被检测到，并在 `wiki check` 里报错，页面上保留原文。

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

`doc.eta`：

```
it.site    { title, siteUrl, base, defaultLanguage, languages[], urlStyle }
it.page    { lang, title, description, keywords[], updated, url,
             html,                    // 已渲染的正文，用 <%~ %> 输出
             headings[],              // { level, text, id }
             hints[],                 // { title, body, anchor }
             sources[],               // { site, title, revid, license, licenseUrl, changes, anchor }
             source,                  // 整篇来源：{ site, title, url, revid, license, licenseUrl, changes }
             license, licenseUrl, authors }
it.nav     [ { section, pages: [ { title, url, current } ] } ]
it.index   { url }                   // 该语言目录页地址
```

`index.eta` 额外有：

```
it.groups  同 it.nav（内容一样，名字不同而已）
```

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
- **布局名固定为 `doc` / `index`**，还不能「按 section 选不同布局」。
- **分类系统还没有**：宏可以调用 `addCategory()` 登记，但 frontmatter 的 `categories`、分类页、分类边栏都还没实现，登记了也没人消费。
- **没有图片处理**：`assets/` 原样复制，不做缩放、不做哈希、不做 `<picture>`。
- **没有搜索**：`hints` 只是数据，检索能力还没接。
- **`basePath` 目前只适合部署在根路径**。要用 `file://` 直接打开产物，还需要等相对路径模式（`urlStyle: 'file'` 只实现了链接层）。
