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
| 孤页 | 没有任何页面链向它 |
| 未定义宏 | 产物里会露出原文，算失败 |
| 未解析内链 | 双链的 slug 与标题都没命中 |
| 缺译 | 只提示，不算失败 |
| 分类 | 未声明显示名、`sidebarCategory` 没有成员 |

`--strict` 让红链与孤页也算失败，适合放进 CI。

## build {#build}

产出是一组**可移植的静态文件**：`dist/` 里只有 html、`assets/` 和几个索引文件。没有服务器依赖、没有 SPA、没有外部 CDN——放任何静态托管、U 盘、光盘镜像里都能用。

每次构建会先清空输出目录，然后依次写内容页、目录页、分类页，最后复制资源。

## 放进 CI 的最小写法 {#ci}

```bash
yarn install
yarn wiki check . --strict
yarn wiki build . -o dist
```

构建完成后 `dist/` 交给部署步骤即可（GitHub Pages 用 artifact 上传，或推到 `gh-pages` 分支）。
