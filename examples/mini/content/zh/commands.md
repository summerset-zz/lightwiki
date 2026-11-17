---
title: 命令
keywords: 命令, cli, init, build, check, dev, deploy, inline, 校验, 自动重启
description: wiki init / dev / check / build / deploy 五个子命令分别做什么。
section: reference
order: 1
updated: 2026-11-17
draft: false
categories: [official]
---

```bash
npx @lightwiki/cli init   <目录>                 # 生成新站点
npx @lightwiki/cli dev    <目录> [-p 端口]       # 本地预览
npx @lightwiki/cli check  <目录> [--strict]      # 只校验，不产出
npx @lightwiki/cli build  <目录> [-o 输出目录]    # 产出静态站点
npx @lightwiki/cli deploy <目录> [-o 输出目录]    # 为发布产出（目前只到本地目录）
```

工具还没装的话 `npx` 会自动下载。装了开发依赖（`npm i -D @lightwiki/cli`）之后，`npx wiki` 就是同一组命令。

## init {#init}

把起始模板（配置、示例内容、`AGENTS.md`、Pages workflow）落到目录里，`--name` 指定站点名，默认取目录名。

已有文件不会被覆盖，除非加 `--force`。

## dev {#dev}

在内存里渲染，**不写磁盘**。内容、布局、宏文件改动会自动重建并刷新页面。

默认 `127.0.0.1:5173`，端口被占会自动往上试。

### 改工具本身的代码时 {#dev-supervise}

在工具仓库里跑 `yarn wiki dev <目录>` 时，`wiki dev` 会额外套一层**监护进程**：

```
监护进程   盯 packages/*/src，一变就把子进程重新拉起来
  └─ 子进程   真正的 dev server
```

因为 dev server 是在进程内 `import` core 的，ESM 模块缓存清不掉，改了包代码只能换进程。有了这一层，**改完代码不用重启，刷新一下就生效**（浏览器也会自己刷新）。

- 重启一律直接结束子进程：进程一退，监听的 socket 由系统回收，下一任占回同一个端口，地址不会变
- 子进程自己崩了（语法错误之类）不会把终端一起关掉，改完文件会自动再拉起来
- 手动触发：`curl -X POST http://127.0.0.1:5173/__lightwiki/restart`
- `--no-watch` 关掉这层；从 npm 装下来的包里没有 `packages/`，不会启用

## check {#check}

| 检查项 | 说明 |
|---|---|
| frontmatter | 字段类型与格式 |
| section | 是否在配置允许的列表里 |
| 标题重复 | 同一语言内重名会让双链不明确，算失败 |
| 红链 | 站内链接指向不存在的页面 |
| 孤页 | 没有任何正文链接指向它（每语言的入口页除外） |
| 未定义宏 | 产物里会露出原文，算失败 |
| 未解析内链 | 双链的 slug 与标题都没命中 |
| 缺译 | 只提示，不算失败 |
| 分类 | 未声明显示名、`sidebarCategory` 没有成员 |

`--strict` 让红链与孤页也算失败，适合放进 CI。

## build {#build}

产出是一组**可移植的静态文件**：`dist/` 里只有 html、`assets/` 和几个索引文件（`meta.json`、`search-index.json`）。没有服务器依赖、没有 SPA、没有外部 CDN——放任何静态托管、U 盘、光盘镜像里都能用。

每次构建会先清空输出目录，然后依次写内容页、目录页、分类页、`404.html`、重定向页，最后复制资源。

### 单文件产物 {#inline}

加 `--inline`（或在配置里写 `inline: true`），产物就只剩 `.html`：

| 原本 | 变成 |
|---|---|
| `<link rel="stylesheet" href="/assets/theme/style.css">` | `<style>` 内联 |
| `<script src="/assets/app.js">` | `<script>` 内联 |
| `<img src="/assets/a.png">`、CSS 里的 `url()` | `data:` URI |

所以没有 `assets/`、也没有 `meta.json`——**一个页面文件就是完整的页面**，能单独发出去、当邮件附件、打进 CHM。

要和 `urlStyle: 'file'` 一起用才有「双击就能全站导航」的效果：两个开关都开，产物是一堆相对链接的单文件页面，不需要服务器也不需要同目录的 `assets/`。

代价是每页都带一份样式，全站体积随页数线性增长。要发给别人一个页面时用它，做站时不要用。

内联是在 HTML 生成之后做的，所以你覆盖的布局照常写 `<link>` 就行，不需要为它改模板。找不到的资源（比如布局引用了不存在的脚本）会在构建时警告，并在产物里保持原样。

### 404 页 {#not-found}

静态托管没有服务端路由，但有一条通用约定：**根目录的 `404.html`**。

GitHub Pages、Netlify、Cloudflare Pages、S3、OSS 都会在未命中时返回它，并把 HTTP 状态码设为 404。要做的事只有两件：

1. 产物里存在 `404.html`（构建会自动生成）；
2. 页里的资源用**绝对路径**——因为这一页可能在任意深度被打开，相对路径会失效。

它只有一份，不能按语言拆。唯一的例外是 `file://` 直接打开时没有 404 这个概念。

### 由内容驱动 {#not-found-content}

在内容里放一个 slug 为 `404` 的页面（比如 `content/zh/404.md`），它会被渲染成根目录的 `404.html`，走的是普通的 `doc` 布局——侧栏、目录、样式都跟其他页一样。

它不会：

- 在 `/docs/404/` 生成副本；
- 出现在导航、孤页、缺译统计里。

只有**默认语言**的那份参与产物，因为 `404.html` 只能有一个。没有这个文件时，主题的 `not-found` 布局兜底。

## deploy {#deploy}

产物和 `build` 一字不差，差别在语义：`build` 是「我想看看产物」，`deploy` 是「这个要发出去」。

现在只做本地这一段：构建到 `dist/` 就停下，**不推送任何东西**。远端形态（push 到仓库、生成 GitHub Pages）要等 remote 接入——它们九成的复杂度在认证与远端状态，跟编译链无关。

```bash
npx @lightwiki/cli deploy <目录> --inline    # 给「一个文件就能看」的场景
```

远端做完之后，两者会变成：`build` 留在本地，`deploy` 负责发出去。

## 重定向 {#redirects}

内容改名后旧链接会失效。要么让 404 页兜底，要么做重定向。

```ts
// wiki.config.ts
redirects: [
  { from: '/docs/old-macros', to: '/docs/macros' },
],
redirectMode: 'js',
```

`from` 与 `to` 都写**最终 URL**（含语言前缀），工具不做推断。

两种输出：

| `redirectMode` | 产物 | 适用 |
|---|---|---|
| `js`（默认） | 在 `from` 的位置生成一个跳转页 | 任何静态托管，包括 GitHub Pages |
| `server` | 根目录 `_redirects`（Netlify / Cloudflare Pages 格式） | 托管方支持服务端重定向 |
| `both` | 两者都生成 | 迁移期 |

**默认为什么是 JS**：静态托管通常不给你服务端路由控制权，JS 跳转是唯一通用的办法。代价是搜索引擎看到的是 200 而不是 301，所以跳转页里带了 `<link rel="canonical">` 与 `noindex`。

跳转页不靠 JS 也能工作——它有 `<meta http-equiv="refresh">` 和可点击链接兜底，锚点与查询串会被保留。

`from` 撞到真实页面时会被跳过并给出警告。`wiki dev` 下直接返回 302，不生成跳转页。

## 放进 CI 的最小写法 {#ci}

```bash
npx @lightwiki/cli check . --strict
npx @lightwiki/cli build . -o dist
```

不需要 `install` 步骤 —— 内容仓库没有依赖，工具由 `npx` 现取。想固定版本就在内容仓库 `npm i -D @lightwiki/cli`，CI 里改成 `npm ci` + `npx wiki`。

构建完成后 `dist/` 交给部署步骤即可（GitHub Pages 用 artifact 上传，或推到 `gh-pages` 分支）。
