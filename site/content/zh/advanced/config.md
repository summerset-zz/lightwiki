---
title: 站点配置
keywords: 配置, wiki.config.ts, siteUrl, basePath, urlStyle, redirects
description: wiki.config.ts 里每个字段的作用、默认值和容易配错的地方。
section: advanced
order: 1
updated: 2026-11-17
draft: false
---

站点配置写在内容仓库根的 `wiki.config.ts`，默认导出一个对象。`title`、`siteUrl`、`content` 三项必填，其余都有默认值。

它所在的目录就是内容根，配置里的路径都相对它算。目录怎么摆见 [目录结构](/docs/start/structure)。

## 配置对象的形状 {#shape}

```ts
export default {
  title: '我的知识库',
  siteUrl: 'https://example.com',
  content: { zh: 'content/zh' },
};
```

类型是 `SiteConfigInput`。运行时用 zod 校验，不合规的配置直接报错，报错文字形如 `字段路径 → 原因`。

配置里可以写函数（`markdown` 与 `macros.undefined` 都收函数），所以它是 TS 文件，不是 JSON。

## 必填三项 {#required}

| 字段 | 说明 |
|---|---|
| `title` | 站点名，非空字符串。进页面标题、侧栏标题 |
| `siteUrl` | 站点完整地址，必须带协议。重定向页的绝对地址与 canonical 用它拼 |
| `content` | 语言代码到内容目录的映射，如 `{ zh: 'content/zh', en: 'content/en' }` |

`siteUrl` 写成 `example.com` 不算完整地址，校验会拦下来。页面模板里也能拿到它。

## 全部字段与默认值 {#fields}

| 字段 | 默认值 | 作用 |
|---|---|---|
| `title` | 必填 | 站点名 |
| `siteUrl` | 必填 | 完整站点地址 |
| `content` | 必填 | 语言到内容目录 |
| `basePath` | `'/'` | 部署在子路径时的前缀，如 `'/wiki'` |
| `defaultLanguage` | `'zh'` | 默认语言，链接里不带语言前缀 |
| `assetsDir` | `'assets'` | 静态资源目录名，只改来源，产物里固定落 `assets/` |
| `outputDir` | `'dist'` | 构建输出目录 |
| `docsDir` | `'docs'` | 内容页的路径前缀 |
| `sections` | `[]` | 允许出现的 `section` 取值与顺序，空数组表示不校验 |
| `sectionLabels` | `{}` | `section` slug 到显示名 |
| `categories` | `{}` | 分类 slug 到显示名 |
| `theme` | `'@lightwiki/theme-default'` | 主题包名，或相对、绝对的目录路径 |
| `urlStyle` | `'directory'` | `'directory'` 生成 `a/b/`，`'file'` 生成 `a/b.html` |
| `inline` | `false` | 单文件产物，样式、脚本、图片、搜索索引全部塞进页面 |
| `redirects` | `[]` | 旧地址到新地址的映射，元素是 `{ from, to, status }`，`status` 默认 `301` |
| `redirectMode` | `'js'` | `'js'` 生成跳转页，`'server'` 只输出 `_redirects`，`'both'` 两者都做 |
| `highlight.enabled` | `true` | 代码块高亮开关 |
| `highlight.languages` | `[]` | 额外加载的 highlight.js 语言名，如 `'ruby'`、`'go'` |
| `search.enabled` | `true` | 站内搜索开关 |
| `search.excerpt` | `300` | 索引里保留的正文摘要长度（字符），`0` 表示只要标题 |
| `macros.undefined` | `'show'` | 未定义模板的处理方式 |
| `markdown` | 无 | 站点级 markdown-it 插件入口，签名 `(md) => void` |

除 `highlight`、`search`、`macros` 这三个嵌套对象，其余字段都写在根级。嵌套对象只写要改的那几项，没写的取默认值。

## basePath 与 GitHub Pages {#base-path}

项目站部署在 `https://用户名.github.io/仓库名/`，`basePath` 要写 `'/仓库名'`，末尾斜杠会被去掉。

它和实际部署位置不一致时，链接与资源全部 404。默认语言的页面挂在根上，前缀少一段就对不上。

## docsDir 只能是单段名字 {#docs-dir}

`docsDir` 决定内容页挂在哪一段路径下：`'docs'` 得到 `/docs/a/`，`'wiki'` 得到 `/wiki/a/`。

只接受一段名字，字符限于字母、数字、`_`、`-`，也允许空串。写 `'docs/v2'` 会被拒绝，那等于把内容塞进子目录，是另一件事。

空串时页面直接挂在 `/` 与 `/<语言>/` 下，会和 `assets/`、`categories/` 这些保留段抢位置，`wiki check` 会把这个情况点出来。

## urlStyle 的两种形态 {#url-style}

| 形态 | 页面地址 | 产物 | 适合 |
|---|---|---|---|
| `'directory'`（默认） | `/docs/a/` | `docs/a/index.html` | 静态托管 |
| `'file'` | `/docs/a.html` | `docs/a.html` | `file://` 双击、CHM |

`'file'` 模式下，构建会把产物里所有站内绝对链接改写成相对路径，这样双击打开时导航不会指到盘符根。

## redirects 的两个值都写最终地址 {#redirects}

`redirects` 的每一项是 `{ from, to, status }`。`from` 与 `to` 都写含语言前缀的完整路径（默认语言不带前缀），工具不做推断。

```ts
redirects: [{ from: '/docs/old/', to: '/docs/new/' }],
```

`status` 默认 `301`。`redirectMode` 决定这些规则变成什么产物：

| 取值 | 产物 |
|---|---|
| `'js'`（默认） | 每条规则生成一个跳转页，meta refresh 加 JS 兜底 |
| `'server'` | 只写一份 `_redirects` |
| `'both'` | 两者都做 |

`_redirects` 是 Netlify 与 Cloudflare Pages 认的格式，每行一条规则：来源地址、目标地址、状态码，中间用两个空格分隔。

## inline 的体积代价 {#inline}

`inline` 打开后，每页都带一份样式与一份全站搜索索引，产物里只剩 `.html`。配了服务端重定向时，外面还会多一份 `_redirects`。

体积按页数成倍放大。适合把一页单独发出去，不适合做站时默认开着。

## 未定义模板的三种处理 {#undefined-macro}

正文里的 `{{名字}}` 找不到对应模板时，输出什么看 `macros.undefined`：

| 取值 | 产物 | `wiki check` |
|---|---|---|
| `'show'`（默认） | 原样显示 `{{名字}}` | 算失败 |
| `'hide'` | 整段不显示 | 只提示 |
| 函数 `(name, raw) => string` | 返回值当纯文本 | 只提示 |

模板本身怎么写，见 [模板](/docs/basics/templates)。

## markdown 拿到 markdown-it 实例 {#markdown-hook}

`markdown` 是一个函数，参数就是 markdown-it 实例，可以直接挂插件：

```ts
markdown(md) {
  md.use(myPlugin);
},
```

它只在 `wiki.config.ts` 是真正的 TS 文件时可用。正文里的语法扩展见 [Markdown 与扩展语法](/docs/basics/markdown)。

## 再往下 {#next}

四个命令、参数与退出码见 [命令行](/docs/advanced/cli)。页面自己的字段见 [frontmatter](/docs/basics/frontmatter)。
