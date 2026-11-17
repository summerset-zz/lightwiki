# 轻维基：从零开一个站

这份说明是给 AI 编码助手看的。人类读完也能照做。

如果你是被要求按这份说明在某个目录开一个新仓库，按下面的顺序执行。遇到不确定的地方，去文末的文档地址查，不要猜。

## 需要什么

- **Node.js 20 或更高**。CI 用 22。先跑 `node -v` 确认，没有就装 LTS。
- **`npx` 不用单独装**。它是 npm 的子命令（`npm exec` 的别名），装 Node.js 时一起就有。不确定就跑 `npx --version`，有版本号就行。
- **不需要 `npm install`**。工具从 npm 现取，内容仓库里没有 `package.json`，也没有 `node_modules`。
- **不需要构建配置**。没有 vite、webpack、tsc，没有 watch 进程。

## 四步建站

第 1 步，在目标目录初始化：

```bash
npx --yes @lightwiki/cli init . --name 站点名
```

目录不存在就先建。目录已有内容也可以，它只补缺失的文件、不覆盖，要覆盖加 `--force`。

产出六个文件：

| 文件 | 是什么 |
|---|---|
| `wiki.config.ts` | 站点配置：标题、地址、语言、分组 |
| `content/zh/index.md` | 首页 |
| `AGENTS.md` | 建完之后写内容用的说明（另一份，不是这一份） |
| `README.md` | 给人看的用法 |
| `.gitignore` | 忽略 `dist/`、`node_modules/` |
| `.github/workflows/pages.yml` | push 到 `main` 时构建并发布到 GitHub Pages |

第 2 步，改 `wiki.config.ts` 的 `title` 与 `siteUrl`。`siteUrl` 会被用来拼绝对地址。

第 3 步，改 `content/zh/index.md`。这一页就是首页，内容由你写。

第 4 步，跑一遍确认：

```bash
npx --yes @lightwiki/cli check .     # 校验：红链、缺字段、缺首页
npx --yes @lightwiki/cli build .     # 产物到 dist/
```

## 三个命令

```bash
npx --yes @lightwiki/cli dev .       # 本地预览，默认 http://127.0.0.1:5173
npx --yes @lightwiki/cli check .     # 只读校验，不写盘
npx --yes @lightwiki/cli build .     # 产出静态文件到 dist/
```

`dev` 会常驻，改内容自动刷新，`Ctrl+C` 停。`check` 有问题时退出码是 1，`build` 正常是 0。

## 什么算内容

```
wiki.config.ts      站点配置，只有这一个配置文件
content/zh/*.md     内容，一个文件一页
assets/             图片、字体、样式、脚本（可选）
layouts/            皮肤，覆盖主题的整页 HTML（可选）
macros/             模板，正文里的 {{名字}} 展开成什么（可选）
```

只有 `content/` 下的 `.md` 会被渲染成页面。其余目录是可选的，没有也照常构建。

## 内容怎么写

每个 `.md` 开头必须有一段 frontmatter：

```yaml
---
title: 页面标题
section: guide
---

正文从这行下面开始。
```

`title` 必填且同一语言内不能重复。`section` 是侧栏分组，取值必须是 `wiki.config.ts` 里 `sections` 列出的。

正文是标准 markdown，另外支持双链 `[[页面标题]]`、显式锚点 `## 小节 {#id}`、行内 HTML。

**文件名就是地址**：`content/zh/about.md` 就是 `/docs/about/`。改文件名等于改地址，外部链接会断。

**每种语言都必须有 `content/<语言>/index.md`**，它就是该语言的首页。缺了 `check` 直接失败。

## 发布到 GitHub Pages

1. 把目录推到一个 GitHub 仓库的 `main` 分支
2. 仓库 Settings → Pages → Source 选 **GitHub Actions**
3. 之后每次 push 都会自动构建发布

项目站的地址是 `https://<用户名>.github.io/<仓库名>/`，所以子路径要靠环境变量告诉构建。workflow 里已经写好：

```yaml
env:
  LIGHTWIKI_BASE_PATH: /${{ github.event.repository.name }}/
  LIGHTWIKI_SITE_URL: https://${{ github.repository_owner }}.github.io
```

这两行别删。少了 `BASE_PATH`，产物里的链接会指向域名根，全站 404。

## 常见坑

- `--inline` 只适合单页分享，做站别开：每页都会带一份完整样式与搜索索引
- 配 `content` 时，`defaultLanguage` 必须是 `content` 里的某个键，写错配置加载失败
- `urlStyle` 默认 `directory`（`a/b/`），要 `file://` 双击能看才改 `'file'`
- 工具版本要钉死时写成 `@lightwiki/cli@0.3.0`，别写 `^0.3.0`：0.x 的 caret 只覆盖 `0.3.x`

## 文档在哪

主站：<https://summerset-zz.github.io/lightwiki/>

这几个地址最常用，需要细节时按需读：

| 内容 | 地址 |
|---|---|
| 全部 frontmatter 字段 | <https://summerset-zz.github.io/lightwiki/docs/basics/frontmatter/> |
| 正文语法（双链、锚点、HTML、class） | <https://summerset-zz.github.io/lightwiki/docs/basics/markdown/> |
| 模板 | <https://summerset-zz.github.io/lightwiki/docs/basics/templates/> |
| 皮肤 | <https://summerset-zz.github.io/lightwiki/docs/basics/skins/> |
| 样式与脚本 | <https://summerset-zz.github.io/lightwiki/docs/basics/styles/> |
| 分类 | <https://summerset-zz.github.io/lightwiki/docs/basics/categories/> |
| 站点配置全字段 | <https://summerset-zz.github.io/lightwiki/docs/advanced/config/> |
| 命令行 | <https://summerset-zz.github.io/lightwiki/docs/advanced/cli/> |
| 发布到 GitHub Pages | <https://summerset-zz.github.io/lightwiki/docs/advanced/deploy-pages/> |
| 目录结构 | <https://summerset-zz.github.io/lightwiki/docs/start/structure/> |

源码：<https://github.com/summerset-zz/lightwiki>
