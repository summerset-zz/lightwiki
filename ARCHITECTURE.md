# 架构（开发文档）

> 面向改代码的人。**用户文档**见 [`docs/getting-started.md`](./docs/getting-started.md)，**语法**见 [`examples/mini`](./examples/mini)（那是唯一维护的语法手册）。

## 1. 定位与硬约束

版本化的静态知识库：markdown + frontmatter 进，一组可移植静态文件出。

四条不可协商的约束，改动时先过一遍：

1. **产物可移植** —— `dist/` 是自包含的静态文件，`file://` 打开、扔进任意托管、打成 CHM 都得能用。不许引入服务器依赖、SPA、外部 CDN。
2. **构建不需要跨仓库凭据** —— 内容仓库用自带 `GITHUB_TOKEN` 就能部署，工具来自公开包。
3. **主题可升级** —— 用户只覆盖要改的文件，其余跟随主题。不存在"拷一份主题"的用法。
4. **内容与工具分离** —— 页面身份是文件名（slug）。标题只用于双链的便利解析。

## 2. 包与职责

| 包 | 职责 | 不做什么 |
|---|---|---|
| `packages/schema` | frontmatter 与站点配置的 zod schema | 不含业务逻辑 |
| `packages/core` | 扫描 → 解析 → 渲染 → 链接图 → 写盘 | **不认识任何托管平台** |
| `packages/dev` | 本地预览服务器（`node:http` + SSE） | 不写盘 |
| `packages/cli` | `wiki dev/check/build` 的参数解析与输出 | 不含业务逻辑 |
| `packages/theme-default` | 布局、资源、配色 | 不含逻辑 |

开发期不编译：各包 `exports` 指向 `src/*.ts`，由 `tsx` 直接执行。**没有 build 步骤**。

## 3. 渲染管线（改任何一段都要看另外两段）

```
阶段 1  扫描   读文件 → 解析 frontmatter → 校验 → PageSeed[]
阶段 2  建索引  LinkResolver.add() 全站登记 slug 与标题 → finalize() 找撞名
阶段 3  渲染   PageSeed → renderMarkdown → Page[]
```

`content.ts` 的 `loadContent()` 是唯一入口。

**为什么必须分三段**：`[[标题]]` 解析第 1 页时要能看见第 200 页的标题；分类页要等所有页渲染完才能生成。边扫边渲染做不到这两件事。

## 4. 关键数据结构

| 类型 | 位置 | 说明 |
|---|---|---|
| `PageSeed` | `content.ts` | 扫描结果，含未渲染的 `body` |
| `Page` | `content.ts` | 渲染结果，含 `html` / `headings` / `links` / `hints` / `sources` / `categories` |
| `PageInfo` | `context.ts` | 宏与布局看到的 `it.page` |
| `SiteInfo` | `context.ts` | `it.site`，含 `pages[]` / `categoryList` / `generatedAt` |
| `LinkResolver` | `resolve.ts` | slug 与标题索引，`resolve(target, lang)` |
| `MacroRegistry` | `macros.ts` | 宏的加载与同步渲染，内部维护展开栈 |

`it.page` 由 `context.ts` 的 `pageInfoOf()` **唯一构造**：布局与宏拿到的是同一套字段。差别只有一处——布局 `doc` 额外有渲染产物（`html` / `headings` / `hints` / `sources`），因为宏执行时这些还在生成。`it.site` 两边是同一个对象。

曾踩过的坑：这块以前是布局、宏各写一份字段集，导致 `it.page.slug` 在宏里能用、在布局里是 `undefined`。**新增字段只改 `pageInfoOf` 一处。**

## 5. 路由

全部集中在 `routes.ts`。**改动必须同步三处**：`routes.ts` + `build.ts` + `dev/src/index.ts` 的 `resolveDevRoute`，否则预览与产物会不一致。

| 用途 | 形态 |
|---|---|
| 内容页 | `/{lang}/docs/{slug}/`（默认语言无 `{lang}`） |
| 目录页 | `/{lang}/docs/` |
| 分类页 | `/{lang}/categories/{slug}/` |
| 404 | `/404.html`（根目录，只有一份） |
| 重定向 | 在 `from` 的位置生成跳转页，或输出 `_redirects` |

规则：

- `urlStyle: 'directory'` → `a/b/`；`'file'` → `a/b.html`（给 `file://` 与 CHM）。
- **file 模式下目录页是 `{lang}/docs.html`**，不是 `docs/index.html` —— 必须与 `urlToOutputPath()` / `localizeHref()` 算出来的一致，否则链接指向不存在的文件（踩过）。产物路径统一由 `indexOutputPath()` / `categoryOutputPath()` / `outputPathFor()` 给出。
- `localizeHref()` 只改写 `/docs` 与 `/categories` 两棵路径（补语言前缀 + 尾斜杠），其余站内路径原样。
- **file 模式下链接是相对的**：`relative.ts` 在 HTML 生成后把站内绝对路径改写成相对当前页面的路径。理由：`file://` 下 `/docs/a.html` 指到盘符根，双击产物等于全站导航全废。相对路径在托管下同样成立，所以两种环境共用一套产物。
- **slug 为 `404` 的页面**不按普通页面输出，只生成 `/404.html`。
- dev 额外接受产物里的真实文件路径（`/docs/x/index.html`），但 `/docs/index` 这种**不带 `.html`** 的不能剥。

## 6. markdown 管线

`markdown.ts` 的 `createMarkdown(options)`：

```
markdown-it (html, linkify)
  + markdown-it-attrs            {#anchor} / .class
  + inline ruler: wikilink       [[目标]] / [[目标|文字]]
  + inline ruler: macro          {{宏}} / {{宏(a, "b")}}
  + block ruler: macro-block     整行一个宏 → 块级解析
  + core ruler: urls             链接改写 + 外链 nofollow
  + options.setup(md)            站点插件（最后注册，可覆盖）
```

两条硬规矩：

1. **宏产出文本，不是 HTML token**。展开结果用 `md.block.parse` / `md.inline.parse` 递归解析，所以宏里能写 markdown、双链、别的宏。代价是宏作者要像写正文一样注意 `*` `_` `[`。
2. **代码块免疫**来自"踩在解析器规则边界上"（fence 与 backticks 先消费），不是文本扫描。不要改成正则预替换。

展开栈（`env.macroStack`）必须**跨子解析传递**，否则 `A → {{A}}` 会无限循环。

## 7. 主题契约

`render.ts` 按顺序找布局：`<内容根>/layouts/<name>.eta` → `<主题>/layouts/<name>.eta` → 报错。

现有布局名：`doc`（内容页）、`index`（目录页）、`category`（分类页）、`not-found`（无 `404.md` 时的兜底）、`redirect`（重定向页）。

引擎是 Eta。**`autoTrim` 必须关闭**——宏产出的是 markdown，标签后的换行是语义的一部分。

**内联模式由后处理完成，不靠布局判断**：`inline: true` 时，`inline.ts` 在 HTML 生成后把 `<link rel="stylesheet">` 换成 `<style>`、`<script src>` 换成内联脚本、其余资源换成 data URI。布局照常写 `<link>`——用户覆盖的布局也能享受内联，不需要主题配合。

### 7.1 搜索与「查看源码」的边界

这两个功能只有一条线：**数据在 core，UI 在主题**。

| 谁 | 负责什么 |
|---|---|
| `core` 的 `search.ts` | 生成索引（`u`/`t`/`s`/`k`/`x`），决定它放哪里 |
| `core` 的 `context.ts` | `it.site.search` 只给**位置**（`url` 或 `null`）；`it.page.markdown` 给整篇原文 |
| `theme-default` | 搜索框、结果列表、键盘交互（`assets/search.js`）、源码折叠面板（`<details>`）、样式 |
| 内容仓库 | `search.enabled` 开关；**覆盖了布局就要自己写 UI** |

为什么不把索引塞进模板上下文：那会让每页的 `it.site` 多几百 KB，而布局实际只用 `search.url` 一个字段。

**索引的两种形态**（由 `shouldInlineSearch()` 决定，主题不用关心）：

| 模式 | 索引在哪 | 主题怎么拿 |
|---|---|---|
| directory | 产物根的 `search-index.json` | 容器的 `data-index` → `fetch` |
| file / inline | 内联进每页的 `<script type="application/json" id="lightwiki-search-index">` | 直接读 DOM |

`file://` 下 fetch 被浏览器挡掉，所以 file 模式必须内联；代价是每页都带一份全量索引，站点越大越明显（用 `search.excerpt` 缩摘要）。内联时索引里的 `u` 会按页面相对化 —— 与链接层同一套规则。

**源码**不分模式，一律内联进页面（`it.page.markdown`，含 frontmatter），用 `<details>` 展开，**不需要 JS**。

## 8. 产物

```
dist/
├── index.html                 跳转到默认语言
├── 404.html
├── docs/<slug>/index.html
├── categories/<slug>/index.html
├── assets/                    内容仓库资源 + 编译后的 CSS
│   └── theme/                 主题资源
├── _redirects                 仅 redirectMode 含 server 时
└── meta.json                  构建时间、工具版本
```

资源走 `assets.ts` 的 `collectAssets()` / `copyAssets()`：`.less` 编译成同名 `.css`，**产物里不留 `.less`**。

`outputDir` 每次构建前被 `rm -rf`。

**单文件产物（`inline: true`）**：产物里只有 `.html`（加上 `_redirects`，如果业务需要），没有 `assets/`、没有 `meta.json`。`collectAssets()` 把资源留在内存里供 `inline.ts` 使用，一个字节都不落盘 —— 「只有 .html」是硬约束，不是副作用。

已知边界（`relative.ts` 有意不处理的）：`404.html` 保持绝对路径（它要在任意深度被打开）、`srcset` / 表单 `action`、自定义布局里的 `<meta http-equiv="refresh">`。重定向页的跳转地址由构建器算出 `href` 字段传进模板，所以是相对化的。

## 9. 校验（`wiki check`）

| 项 | 级别 |
|---|---|
| frontmatter 字段/格式、`section` 不在允许列表、标题重复 | **失败** |
| 未定义的宏 | **失败**（产物里会露出 `{{…}}` 原文） |
| 红链、未解析的内链、孤页、分类提示、宽松解析警告 | 提示（`--strict` 时红链与孤页失败） |
| 缺译 | 提示 |

孤页 = 没有正文链接指向它，**排除每种语言的入口页**（排序第一的那页）。

## 10. 已实现 / 未实现

**已实现**：三阶段渲染、双链（slug/标题/锚点）、宏（三种形态、组合、循环检测、行内与块级）、`it.page`/`it.site`、分类与分类页、404、重定向（js/server/both）、代码高亮、Less、markdown 插件钩子、dev server（SSE 热刷新）、全部 check 项、可移植产物、单文件产物（`inline`）、`urlStyle: 'dir'` 与 `'file'` 两种形态（含相对链接）、站内搜索（索引 + 默认主题的搜索框）、查看源码、`deploy` 的本地目录目标。

**未实现**：

| 项 | 备注 |
|---|---|
| `deploy` 的 remote 目标 | 目前只有 `dir`（构建到本地目录）。push 到仓库 / 生成 Pages 等接入 remote 后做 |
| npm 发布 + 官方 GitHub Action | 现在只能 clone 本仓库用 |
| 搜索的分词与高亮 | 现在是子串匹配，命中词不标亮 |
| sitemap / RSS | 产物里没有 |
| 语言切换 UI | 模板里没有切换器 |
| 按 section 选布局 | 当前布局名固定 |
| 图片处理 | 不做缩放/哈希/`<picture>` |
| Electron 客户端 | 计划 v0.2 |
| 分类嵌套 | — |

## 11. 常见改动指引

| 要做什么 | 改这些 |
|---|---|
| 加一个 frontmatter 字段 | `schema` → `content.ts` 的 `buildPageInfo` / `summarize` → `docs/getting-started.md` 的字段表 |
| 加一个校验项 | `check.ts` 的 `CheckResult` → `cli` 的打印 → `examples/mini/commands.md` |
| 加一种页面类型（新 URL） | `routes.ts` → `view.ts` 的 `create*View` → `build.ts` → `dev` 的 `resolveDevRoute` → 主题新布局 |
| 加一个模板变量 | `context.ts`（`PageInfo` / `SiteInfo` + `pageInfoOf`）→ `view.ts` 与 `macros.ts` 自动继承 |
| 加一种行内语法 | `markdown.ts` 的 ruler 注册 + 实现 → `examples/mini` 加一节 |
| 改资源管线 | `assets.ts` → `build.ts` 的调用处 → `dev` 的 asset 分支 |
| 改内联规则（哪些标签、哪种 data URI） | `inline.ts` 的 `inlineHtml` / `MIME` 表 |
| 改相对链接改写规则 | `relative.ts` 的 `relativeUrl` / `isPageUrl` |
| 改搜索命中策略或结果样式 | `theme-default/assets/search.js` 的 `score`、`style.css` 的 `.search-*` |
| 改索引里放什么 | `search.ts` 的 `buildSearchIndex` → `site.search.excerpt` 配置 |

改完至少跑：`yarn type:check`、`yarn wiki check examples/mini`、`yarn wiki build examples/mini`。

## 12. 许可与署名

**分层**：代码与主题用 MIT 或 Apache-2.0（与内容无关）；用户内容由用户自己定协议；工具不预设。

**工具只保证机制，不做法务判断**：

- 允许页面级标注（frontmatter 的 `license` / `licenseUrl` / `authors`，以及整篇改编的 `sourceSite` / `sourceTitle` / `sourceUrl` / `sourceRevid` / `sourceLicense` / `sourceLicenseUrl` / `sourceChanges`）；
- 标了来源就**自动生成署名块并写进产物 HTML**（不能只写在仓库 README 里——别人可能只分享某一页）；
- 站点级与页面级协议冲突时只提示，不阻断。

**不做**：判断内容是否合规、判定许可证组合是否合法。这个边界要在用户文档里讲清楚。

`license` 保持自由字符串不做枚举（GFDL、ODbL、专有授权都是合法场景）。

## 13. 版本与兼容

- 用 changesets 管版本；
- frontmatter **放行未知字段**（zod `passthrough`）：内容仓库与工具版本会脱钩，多一个不认识的键不该让整站失败；新增字段走弃用期；
- `examples/mini` 每次都必须构建成功——它是唯一的语法回归测试；
- 内容文件与产物都不带 tool 版本信息，`meta.json` 是唯一记录。

## 14. 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| v0.1 | 内容管线、双链、宏、分类、404、重定向、高亮、Less、dev、check | 完成 |
| v0.1 | `deploy` 本地目录目标 + 单文件产物（`inline`） | 完成 |
| v0.1 | `urlStyle: 'file'` 端到端（相对链接、目录页路径、重定向地址） | 完成 |
| v0.1 | 站内搜索（索引 + 主题搜索框）与查看源码 | 完成 |
| v0.1 | `deploy` 的 remote 目标（push、Pages） | 等 remote 接入 |
| v0.1 | npm 发布 + 官方 Action | 未开始 |
| v0.2 | Electron 客户端（连接仓库、编辑预览、commit + push） | 未开始 |
| v0.3+ | sitemap/RSS、语言切换、主题生态、按 section 分派布局 | 未开始 |

Electron 后置的理由：它 90% 的工作量在认证与 git 状态，与编译链无关，早做会拖慢核心迭代。
