---
title: 本地打包
keywords: build, 打包, 产物, outputDir, urlStyle, basePath, inline, 离线, 静态文件
description: 把站点打成一个可以拷走的静态包：产物长什么样、几个开关怎么影响产物、单文件模式，以及打完怎么验。
section: deploy
order: 1
updated: 2026-11-26
draft: false
---

`wiki dev` 是给自己看的，`wiki build` 是给别人看的：它把内容编成一组静态文件，之后既不需要 Node.js，也不需要这个工具链，扔到任何能发静态文件的地方就能跑。

```bash
npx @lightwiki/cli build .
```

产物写到配置里的 `outputDir`（默认 `dist/`）。**构建会先清空这个目录**，所以 `-o` 不要指向放着别的东西的文件夹。

## 产物长什么样 {#output}

默认 `urlStyle: 'directory'` 时：

```text
dist/
  index.html                 首页 /
  404.html                   没匹配到任何页面时用
  start/
    intro/index.html         /start/intro/
    quickstart-ai/index.html
  basics/…
  assets/
    theme/style.css          主题自带的
    theme/theme-extra.css    主题的补充样式（`.less` 已编译）
    img/cover.jpg            你放进 assets/ 的
  search-index.json          站内搜索的数据
  meta.json                  这次构建的版本信息
```

三件容易忽略的事：

- **页面地址就是目录名**：`/start/intro/` 对应 `start/intro/index.html`，靠服务器「把目录当索引」的默认行为生效。改成 `urlStyle: 'file'` 后产物是 `start/intro.html`，不再依赖这个行为（也就能直接双击打开）。
- `404.html` 用固定文件名，托管方会自动拿它当兜底页。
- `search-index.json` 和 `meta.json` 是页面上运行的脚本要读的，别单独删其中一个。

`build` 的最后一行会报页数与体积，`meta.json` 里也能看到这些信息，归档时够用了。

## 几个开关会改变产物 {#switches}

| 配置 | 默认 | 什么时候改 |
|---|---|---|
| `outputDir` | `'dist'` | 想换个输出目录名 |
| `urlStyle` | `'directory'` | 目标环境不认目录式 URL（`file://`、CHM）→ `'file'` |
| `basePath` | `'/'` | 站点不挂在域名根上，比如 `'/wiki'` |
| `inline` | `false` | 要「一个 HTML 就能打开」，见下节 |
| `redirectMode` | `'js'` | 托管方支持 `_redirects` 时，可以省掉跳转页 |

字段的完整说明在 [站点配置](/reference/config)，这里只强调两点：

- 命令行的 `-o` 只是临时覆盖 `outputDir`；`--inline` 与配置里写 `inline: true` 等价，两者取同一个值。
- `urlStyle: 'file'` 连搜索索引的形态也变了 —— `fetch` 不到 json，索引直接内联进每页，产物里不再有 `search-index.json`。

## 单文件模式 {#inline}

```bash
npx @lightwiki/cli build . --inline
```

CSS、JS、图片、搜索索引全部内联进每个 HTML，产物里只剩页面文件（没有 `assets/`，没有 `meta.json`）。适合发给别人「就这一个文件，打开看」的场景。

代价是每一页都带一份相同的样式与索引，页数一多体积涨得很快。页数超过十几页，或者资源里有几 MB 的字体、图片，就别开它。

## 打包前先校验 {#check}

```bash
npx @lightwiki/cli check .
```

它点名的问题 `build` 不会拦（红链、孤页、frontmatter 写错导致整页被跳过），但上线后就是死链。放进 CI 时加 `--strict`，红链与孤页按失败算。

## 打完怎么验 {#verify}

不要直接双击 `dist/index.html` 看 —— 默认的目录式 URL 在 `file://` 下不工作。起一个本地静态服务器，随便哪种都行，见 [部署到自有服务器](/deploy/server)。

上线目标的专门说明：

| 目标 | 看这篇 |
|---|---|
| GitHub Pages | [发布到 GitHub Pages](/deploy/pages) |
| 自有服务器（IIS / nginx / 一个命令起服务） | [部署到自有服务器](/deploy/server) |
| 打包成 CHM | [打包成 CHM](/deploy/chm) |
