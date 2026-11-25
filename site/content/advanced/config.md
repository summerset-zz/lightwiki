---
title: 站点配置
keywords: 配置, wiki.config.ts, siteUrl, basePath, content, urlPrefix, docsDir, lang, urlStyle, redirects
description: wiki.config.ts 里每个字段的作用、默认值和容易配错的地方。
section: advanced
order: 1
updated: 2026-11-25
draft: false
---

站点配置写在内容仓库根的 `wiki.config.ts`，默认导出一个对象。`title`、`siteUrl`、`content` 三项必填，其余都有默认值。

它所在的目录就是内容根，配置里的路径都相对它算。目录怎么摆见 [目录结构](/start/structure)。

## 配置对象的形状 {#shape}

```ts
export default {
  title: '我的知识库',
  siteUrl: 'https://example.com',
  content: 'content',
};
```

类型是 `SiteConfigInput`。运行时用 zod 校验，不合规的配置直接报错，报错文字形如 `字段路径 → 原因`。

配置里可以写函数（`markdown` 与 `macros.undefined` 都收函数），所以它是 TS 文件，不是 JSON。

## 必填三项 {#required}

| 字段 | 说明 |
|---|---|
| `title` | 站点名，非空字符串。进页面标题、侧栏标题 |
| `siteUrl` | 站点完整地址，必须带协议。重定向页的绝对地址与 canonical 用它拼 |
| `content` | 单个内容目录，如 `'content'`，相对内容根 |

`siteUrl` 写成 `example.com` 不算完整地址，校验会拦下来。页面模板里也能拿到它。

## 语言只是一个标签 {#lang}

`lang` 默认 `'zh'`，只影响产物的 `<html lang>` 与模板里的 `it.page.lang`、`it.site.lang`。它不改变地址，也不决定读哪个目录。

读哪个目录由 `content` 决定。写纯英文站就两处一起改：

```ts
content: 'content/en',
lang: 'en',
```

## 地址怎么拼 {#url}

页面地址的公式：

```text
[basePath][urlPrefix][docsDir]/<slug>/
```

三个前缀默认都为空，默认地址就是 `/<slug>/`。`content/index.md` 的 slug 是 `index`，产物是前缀根上的 `index.html`，也就是首页。

`404.md` 例外：产物固定在根目录的 `404.html`，不生成 `/404/` 这一页。

## 多语言 {#i18n}

一门语言一份配置，各跑一次构建：

```bash
npx @lightwiki/cli build . -c wiki.config.zh.ts -o dist-zh
npx @lightwiki/cli build . -c wiki.config.en.ts -o dist-en
```

| 参数 | 作用 |
|---|---|
| `-c` / `--config` | 配置文件名，相对内容根。不写就用 `wiki.config.ts` |
| `-o` | 输出目录，相对内容根，不是当前工作目录。不写就用配置里的 `outputDir` |

两份产物各是一个完整的站，合并由你自己做。`search-index.json`、`404.html`、`meta.json` 每份各一，放到同一目录时后放的会盖掉先放的。

每次构建只认自己配置里的页面。zh 构建里写 `/en/a` 会被 `wiki check` 报成红链。跨语言链接要么写完整 URL，要么忽略这条提示。

## 全部字段与默认值 {#fields}

| 字段 | 默认值 | 作用 |
|---|---|---|
| `title` | 必填 | 站点名 |
| `siteUrl` | 必填 | 完整站点地址 |
| `content` | 必填 | 内容目录，如 `'content'` |
| `basePath` | `'/'` | 部署在子路径时的前缀，如 `'/wiki'` |
| `urlPrefix` | `''` | 内容页地址的 URL 前缀，拼在 `docsDir` 前面 |
| `docsDir` | `''` | 内容页地址的额外路径段，如 `'docs'` |
| `lang` | `'zh'` | 只用于 `<html lang>` 与 `it.page.lang`，不影响地址 |
| `assetsDir` | `'assets'` | 静态资源目录名，只改来源，产物里固定落 `assets/` |
| `outputDir` | `'dist'` | 构建输出目录 |
| `sections` | `[]` | 允许出现的 `section` 取值与顺序，空数组表示不校验 |
| `sectionLabels` | `{}` | `section` slug 到显示名 |
| `categories` | `{}` | 分类 slug 到显示名 |
| `theme` | `'@lightwiki/theme-default'` | 主题包名，或相对、绝对的目录路径 |
| `urlStyle` | `'directory'` | `'directory'` 生成 `a/b/`，`'file'` 生成 `a/b.html` |
| `inline` | `false` | 单文件产物，样式、脚本、图片、搜索索引全部塞进页面 |
| `redirects` | `[]` | 旧地址到新地址的映射，元素是 `{ from, to, status }`，`status` 默认 `301` |
| `redirectMode` | `'js'` | `'js'` 生成跳转页，`'server'` 只输出 `_redirects`，`'both'` 两者都做 |
| `highlight.enabled` | `true` | 代码块高亮开关 |
| `highlight.languages` | `[]` | 额外加载的 highlight.js 语言名，如 `'ruby'`、`'go'`（用法见 [代码高亮](/basics/code-highlight)） |
| `search.enabled` | `true` | 站内搜索开关 |
| `search.excerpt` | `300` | 索引里保留的正文摘要长度（字符），`0` 表示只要标题 |
| `frontmatterInjection` | `false` | 把每页的元数据（模板里的 `it.page`，只去掉整篇原文）注入 `<script type="application/json" id="lightwiki-page-data">`，供页面里的 JS 读取。见 [frontmatter](/basics/frontmatter#browser) |
| `macros.undefined` | `'show'` | 未定义模板的处理方式 |
| `markdown` | 无 | 站点级 markdown-it 插件入口，签名 `(md) => void` |

除 `highlight`、`search`、`macros` 这三个嵌套对象，其余字段都写在根级。嵌套对象只写要改的那几项，没写的取默认值。

## basePath 与 GitHub Pages {#base-path}

项目站部署在 `https://用户名.github.io/仓库名/`，`basePath` 要写 `'/仓库名'`，末尾斜杠会被去掉。

它和实际部署位置不一致时，链接与资源全部 404。页面挂在根上，前缀少一段就对不上。

## docsDir 与 urlPrefix {#docs-dir}

两段前缀拼在 slug 前面，顺序是 `urlPrefix` 再 `docsDir`。默认都是空串，页面地址就是 `/a/`：

| `urlPrefix` | `docsDir` | 页面地址 |
|---|---|---|
| `''`（默认） | `''`（默认） | `/a/` |
| `''` | `'docs'` | `/docs/a/` |
| `'/wiki'` | `'docs'` | `/wiki/docs/a/` |

`docsDir` 只接受一段名字，字符限于字母、数字、`_`、`-`，也允许空串。写 `'docs/v2'` 会被拒绝，那等于把内容塞进子目录，是另一件事。

`docsDir` 为空时，slug 的第一段直接落在 `/` 下。这时第一段叫 `assets` 或 `categories`，会和资源目录、分类页抢地址，`wiki check` 直接判失败。

## urlStyle 的两种形态 {#url-style}

| 形态 | 页面地址 | 产物 | 适合 |
|---|---|---|---|
| `'directory'`（默认） | `/a/` | `a/index.html` | 静态托管 |
| `'file'` | `/a.html` | `a.html` | `file://` 双击、CHM |

`'file'` 模式下，构建会把产物里所有站内绝对链接改写成相对路径，这样双击打开时导航不会指到盘符根。

## redirects 的两个值都写最终地址 {#redirects}

`redirects` 的每一项是 `{ from, to, status }`。`from` 与 `to` 都写完整路径，工具不做推断。

```ts
redirects: [{ from: '/old/', to: '/new/' }],
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

模板本身怎么写，见 [模板](/basics/templates)。

## markdown 拿到 markdown-it 实例 {#markdown-hook}

`markdown` 是一个函数，参数就是 markdown-it 实例，可以直接挂插件：

```ts
markdown(md) {
  md.use(myPlugin);
},
```

它只在 `wiki.config.ts` 是真正的 TS 文件时可用。正文里的语法扩展见 [Markdown 与扩展语法](/basics/markdown)。

## 再往下 {#next}

四个命令、参数与退出码见 [命令行](/advanced/cli)。页面自己的字段见 [frontmatter](/basics/frontmatter)。
