---
title: 命令
keywords: 命令, cli, build, check, dev, 校验
description: wiki dev / check / build 三个子命令分别做什么。
section: reference
order: 1
updated: 2026-11-15
draft: false
categories: [official]
---

```bash
yarn wiki dev <目录> [-p 端口]        # 本地预览
yarn wiki check <目录> [--strict]     # 只校验，不产出
yarn wiki build <目录> [-o 输出目录]   # 产出静态站点
```

## dev {#dev}

在内存里渲染，**不写磁盘**。内容、布局、宏文件改动会自动重建并刷新页面。

默认 `127.0.0.1:5173`，端口被占会自动往上试。

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

产出是一组**可移植的静态文件**：`dist/` 里只有 html、`assets/` 和几个索引文件。没有服务器依赖、没有 SPA、没有外部 CDN——放任何静态托管、U 盘、光盘镜像里都能用。

每次构建会先清空输出目录，然后依次写内容页、目录页、分类页、`404.html`、重定向页，最后复制资源。

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
yarn install
yarn wiki check . --strict
yarn wiki build . -o dist
```

构建完成后 `dist/` 交给部署步骤即可（GitHub Pages 用 artifact 上传，或推到 `gh-pages` 分支）。
