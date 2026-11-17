# 从零开始

## 1. 装工具

不用装 —— 直接用 `npx`：

```bash
npx @lightwiki/cli --help
```

第一次运行会从 npm 下载，之后走缓存。想固定在项目里（版本可复现）：

```bash
npm i -D @lightwiki/cli
npx wiki --help
```

> 装了依赖之后，`wiki.config.ts` 里可以 `import type { SiteConfigInput } from '@lightwiki/schema'` 拿到补全；只用 `npx` 时写纯对象就行（起始模板就是纯对象写法，能直接搬来搬去）。

## 2. 先看它能做什么

在线语法手册：**https://summerset-zz.github.io/lightwiki/** —— 17 页，每页演示它正在讲的那个语法。

本仓库里也能本地跑（这是开发者视角，要 clone 工具本身）：

```bash
git clone https://github.com/summerset-zz/lightwiki.git
cd lightwiki && yarn install
yarn wiki dev examples/mini
```

打开输出里的地址（默认 `http://127.0.0.1:5173`），看够了按 `Ctrl+C` 关掉。

在工具仓库里跑 `wiki dev` 会额外套一层监护进程：改 `packages/*/src` 会自动换掉 dev 子进程（端口不变，浏览器自动刷新），所以改工具代码不需要手动重启。

## 3. 建你自己的内容仓库

内容仓库只需要两样东西：`wiki.config.ts` 和 `content/<语言>/*.md`。不需要 `package.json`，也没有构建脚本。

### 方式 A：一条命令生成（推荐）

```bash
npx @lightwiki/cli init my-wiki
cd my-wiki
npx @lightwiki/cli dev .
```

生成的内容：配置、一页示例内容、`AGENTS.md`（给 AI 助手看的写作说明）、`.gitignore`，以及**开箱能用的 Pages workflow** —— 改内容就能部署。

目录已存在也不会覆盖你的文件，只补缺的；加 `--force` 才覆盖。

不想用命令行的话，同样的东西还有两处拿法：

| 情况 | 怎么做 |
|---|---|
| 要用 GitHub 建仓 | 用**模板仓库**：[lightwiki-starter](https://github.com/summerset-zz/lightwiki-starter) → 点 **Use this template** → 起个名字 |
| 已经 clone 了工具仓库 | `cp -r lightwiki/packages/cli/templates/starter ../my-wiki` |

模板源文件就在 `packages/cli/templates/starter/` —— 它就是 `wiki init` 复制的那一份，不存在两份代码维护。

### 方式 B：手写最小配置

```bash
mkdir my-wiki && cd my-wiki
```

建一个 `wiki.config.ts`：

```ts
export default {
  title: '我的知识库',
  siteUrl: 'https://example.com',
  content: { zh: 'content/zh' },
};
```

再建 `content/zh/start.md`：

```md
---
title: 首页
---

你好，这是第一页。
```

然后 `npx @lightwiki/cli dev .`。

## 4. 配 `wiki.config.ts`

最小可用：

```ts
export default {
  title: '我的知识库',
  siteUrl: 'https://example.com',
  defaultLanguage: 'zh',
  content: { zh: 'content/zh' },
};
```

全部字段（新站通常只改 `title`、`siteUrl`、`content` 三个；`basePath` 只在部署到子路径时才动）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `title` | **必填** | 站点名，进页面 `<title>` 与侧栏顶部 |
| `siteUrl` | **必填** | 站点完整地址，用于拼接绝对链接 |
| `defaultLanguage` | `zh` | 默认语言。**默认语言的地址不带语言前缀** |
| `content` | **必填** | 语言 → 内容目录，`{ zh: 'content/zh', en: 'content/en' }` |
| `sections` | `[]` | 分组顺序，就是侧栏的顺序；页面 `section` 不在列表里会报错 |
| `sectionLabels` | `{}` | 分组显示名，`{ syntax: '语法' }`；不写就显示 slug |
| `categories` | `{}` | 分类显示名，`{ syntax: '语法' }` |
| `assetsDir` | `assets` | 图片与样式所在目录 |
| `outputDir` | `dist` | 构建输出目录（相对内容根） |
| `basePath` | `/` | 部署基路径。放到 `example.com/wiki/` 就写 `/wiki/` |
| `urlStyle` | `directory` | `directory` → `/docs/a/`；`file` → `/docs/a.html`，且站内链接写成相对路径（给 `file://` 与 CHM 用） |
| `docsDir` | `docs` | 内容页的路径前缀。`'wiki'` → `/wiki/a/`；`''` → `/a/`（直接挂在语言根下） |
| `inline` | `false` | 单文件产物：CSS/JS/图片全部塞进页面，产物里只剩 `.html` |
| `search` | `{ enabled: true, excerpt: 300 }` | 站内搜索。`excerpt` 是每页索引里的正文摘要长度（字符），`enabled: false` 连索引都不产出 |
| `macros` | `{ undefined: 'show' }` | 未定义的宏怎么处理：`'show'` 保留 `{{原文}}`、`'hide'` 删掉、或给个 `(name, raw) => string` 函数。三种都会在构建时提示 |
| `theme` | `@lightwiki/theme-default` | 主题包名、git 地址或相对路径 |
| `highlight` | `{ enabled: true, languages: [] }` | 代码高亮；`languages` 里加 highlight.js 的语言名 |
| `markdown` | — | 函数，拿到 markdown-it 实例，见「扩展与样式」 |
| `redirects` | `[]` | 旧地址 → 新地址，`{ from, to, status }` |
| `redirectMode` | `js` | `js` / `server` / `both`，见「命令」里的重定向一节 |

## 5. 什么放哪

| 位置 | 放什么 | 必须吗 |
|---|---|---|
| `wiki.config.ts` | 站点配置 | **必须**，它所在目录就是内容根 |
| `content/<语言>/*.md` | 内容页面 | **必须** |
| `assets/` | 图片、字体、样式表 | 可选 |
| `layouts/*.eta` | 覆盖主题的布局 | 可选 |
| `macros/*.eta` | 内容里 `{{…}}` 调用的宏 | 可选 |

**没有**这些东西：没有 `package.json`（不需要）、没有构建脚本（工具负责）、没有配置文件散落在各处（就一个 `wiki.config.ts`）。

页面文件名的规则：`content/zh/api/v1.md` → slug `api/v1` → `/docs/api/v1/`。**文件名就是身份**，改名等于删一篇加一篇。

### 首页就是 index.md {#home}

`content/<语言>/index.md` **就是该语言的首页**（`/docs/`），没有「自动生成的目录页」。

目录要列什么由你决定：正文里放 `{{catalog}}`（按分类）或 `{{pages(section: 分组名)}}`（按分组），不想列就写别的。想要纯 HTML 的封面，给它配 `layout: landing`，正文留空。

**每种语言都必须有 `index.md`**，缺了那个语言的首页会 404，`wiki check` 会报错。

唯一的例外是 **`404.md`**：slug 为 `404` 的页面会被输出成根目录的 `404.html`，不会生成 `/docs/404/`。

## 6. 构建

三种场景，区别只在「工具从哪来」：

| 场景 | 要准备什么 | 命令 |
|---|---|---|
| 本地看一眼 | 什么都不装 | `npx @lightwiki/cli dev .` |
| 在自己的仓库里构建 | 建议 `npm i -D @lightwiki/cli`（版本可复现、离线可用） | `npx wiki build .` |
| CI 里构建 | 一段 workflow（起始模板已带） | `npx @lightwiki/cli@^0.1.0 build .` |

四个子命令：

```bash
npx @lightwiki/cli init <目录>          # 生成新站点（配置 + 示例内容 + Pages workflow）
npx @lightwiki/cli check <内容目录>     # 只校验，不写盘
npx @lightwiki/cli build <内容目录>     # 产出到 <内容目录>/dist
npx @lightwiki/cli deploy <内容目录>    # 同上，但走「为发布而构建」的入口（目前只输出到本地目录）
```

（装了 `@lightwiki/cli` 作为开发依赖的话，把 `npx @lightwiki/cli` 换成 `npx wiki` 就行。）

`build` 产物：

```
dist/
├── index.html                      跳转到默认语言（docsDir 为空时这里就是首页）
├── 404.html                        静态托管的 404 页
├── docs/index.html                 首页（content/<语言>/index.md）
├── docs/<slug>/index.html          其余内容页
├── categories/<slug>/index.html    分类页
├── assets/                         图片与编译后的 CSS
└── meta.json                       构建时间与工具信息
```

加 `--inline`（或在配置里写 `inline: true`）会得到**单文件产物**：

```
dist/
├── index.html
├── 404.html
├── docs/<slug>/index.html          <style> 里带着样式，图片换成 data URI
└── categories/<slug>/index.html
```

只剩 `.html`，没有 `assets/` 也没有 `meta.json`，一个页面文件双击就能看。
代价是每页各带一份样式，全站体积随页数线性增长。

`dist/` 是**一组可移植的静态文件**：没有服务器依赖、没有 SPA、没有外部 CDN。扔到任何静态托管、U 盘、光盘镜像里都能用。

构建完会打印页面数、产物体积与形态；有警告会提示用 `check` 看详情。

## 7. 发布

把 `dist/` 交给托管方即可：

| 托管 | 怎么做 |
|---|---|
| GitHub Pages | 上传 `dist/` 作为 artifact 部署；`404.html` 会自动生效 |
| Netlify / Cloudflare Pages | 发布目录填 `dist`；想用真 301 就把 `redirectMode` 设成 `server` |
| 对象存储（S3 / OSS） | 开静态网站模式，错误文档指向 `404.html` |

### GitHub Pages

起始模板已经带了 `.github/workflows/pages.yml`，你只需要做一次设置：

1. 仓库 **Settings → Pages**
2. **Source** 选 **GitHub Actions**
3. push 到 `main`，等一分钟

地址是 `https://<用户名>.github.io/<仓库名>/`。

**这里唯一的坑是子路径**：项目站点挂在 `/<仓库名>/` 下，产物里的链接必须带这个前缀，否则整站 404。模板的做法是让 CI 把仓库名通过 `LIGHTWIKI_BASE_PATH` 注入给 `wiki.config.ts`，所以你不用手改配置。

如果你自己写的 `wiki.config.ts` 不读这个环境变量，那就把 `basePath` 写死成 `/<仓库名>/`。

> **还没有官方的 GitHub Action。** 但这不代表要自己搭——CI 里一行 `npx` 就够了：
>
> ```yaml
> - uses: actions/checkout@v4
> - uses: actions/setup-node@v4
>   with:
>     node-version: 22
> - run: npx --yes @lightwiki/cli build .
> - uses: actions/upload-pages-artifact@v3
>   with:
>     path: dist
> ```
>
> 完整能跑的例子：[​lightwiki-demo-fontcover](https://github.com/summerset-zz/lightwiki-demo-fontcover/blob/main/.github/workflows/pages.yml)。

## 8. 让 AI 帮你

如果用的是能读工作区的 AI（Copilot、Cursor、Codex 等），让它按这个顺序读：

1. **`AGENTS.md`** —— 项目约定与阅读顺序，从这儿开始
2. **`examples/mini/content/zh/*.md`** —— 语法手册的**源文件**（直接读 markdown，不需要构建；产物里的 HTML 反而不好读）
3. **`docs/getting-started.md`** —— 就是这一页，配置与目录约定

要改工具本身（不是内容）才需要读 `ARCHITECTURE.md`。

## 9. 文档地图

| 文件 | 讲什么 | 谁该看 |
|---|---|---|
| `README.md` | 是什么、快速开始 | 所有人 |
| `docs/getting-started.md` | 本文：上手与配置 | 新用户 |
| `examples/mini/` | 语法手册（16 页，用轻维基自己写） | 内容作者 |
| `packages/cli/templates/starter/` | `wiki init` 复制的起始模板 | 新用户 |
| `AGENTS.md` | AI 的阅读顺序与项目约定 | AI / 贡献者 |
| `ARCHITECTURE.md` | 开发文档：实现规格与改动指引 | 开发者 |

## 10. 卡住了怎么办

- **`npx @lightwiki/cli build` 说找不到配置** → 内容目录里没有 `wiki.config.ts`，或者目录传错了
- **页面地址不对** → 地址由 slug 推导，没有单独的配置项；非默认语言会带 `/<lang>` 前缀
- **样式没了** → 检查模板里的 CSS 路径是否带 `basePath`；主题样式在 `/assets/theme/`
- **代码块没颜色** → 语言名可能拼错，或不在 `highlight.languages` 里；`xml` 覆盖 html/svg/eta
