---
title: 快速上手（不会代码）
keywords: 快速上手, 入门, 不会代码, AI, Copilot, Cursor, ChatGPT, node, 模板仓库, GitHub Pages, quickstart
description: 不用碰命令行也能建站：让 AI 帮你搭好，或者下载压缩包直接改字。
section: start
order: 2
updated: 2026-11-17
draft: false
---

## 你需要什么 {#need}

一个 AI 助手 —— Copilot、Cursor、ChatGPT 都行。路线 A 里它还会帮你装 Node.js。内容就是几个文本文件，没有数据库，也没有服务器。

## 路线 A：让 AI 帮你搭 {#route-a}

把这句话原样交给 AI：

```
从 https://github.com/summerset-zz/lightwiki-starter 读 AGENTS.md，帮我把仓库准备好
```

它一般会做这么几件事：装 Node.js、把仓库拉到你电脑上、告诉你文件在哪、怎么预览。做完它会自己说清楚，你照着点就行。

一个容易踩的坑：**Node.js 装完之后，AI 工具可能要重启一次**。新装的程序要写进环境变量，而正在运行的编辑器读的是启动那一刻的旧环境，不重启就找不到 `node`。装完发现「命令不存在」，先重启工具再试。

## 路线 B：下载压缩包 {#route-b}

不想碰 git 的话，只有三步：

1. 打开 <https://github.com/summerset-zz/lightwiki-starter>，点绿色的 **Code** → **Download ZIP**。
2. 解压到一个自己找得到的位置。
3. 用记事本或任何编辑器打开 `content/zh/index.md`，改里面的文字。

改的时候守两条：**不要改文件名**（文件名就是地址），**不要删 `wiki.config.ts`**（站点配置）。其余文件各是干什么的，见 [目录结构](/docs/start/structure)。

## 改完看效果 {#preview}

在解压出来的那个文件夹里打开终端（Windows 11 在文件夹空白处右键就有「在终端中打开」），跑：

```bash
npx @lightwiki/cli dev .
```

终端会打印一个地址，通常是 `http://127.0.0.1:5173`，在浏览器里打开它。改 `content/zh/index.md` 并保存，页面会自己刷新。

第一次运行要从 npm 下载工具，等一分钟左右是正常的；之后走缓存，几秒就起来。看完在终端里按 `Ctrl+C` 关掉。

这一步需要 Node.js。如果提示找不到 `node` 或 `npx`，回路线 A 让 AI 装。

## 改完怎么发出去 {#publish}

两条路都落在同一个地方：把文件放进一个 GitHub 仓库，它自带的 workflow 会在每次 push 到 `main` 时构建并发布。

- **路线 A**（AI 帮你 clone 了仓库）：跟它说「帮我提交并推送」，它们会处理。
- **路线 B**（你是从 ZIP 开始的）：在 GitHub 上新建一个仓库，进去后点 **uploading an existing file**，把解压出来的**文件夹里的东西**（不是文件夹本身）拖进去，提交。套成两层目录就会多出一层 `my-wiki/my-wiki/`，别弄错。

然后在仓库里做一次设置：**Settings → Pages → Source** 选 **GitHub Actions**。之后每次改内容并提交，几十秒后线上就跟着更新。

## AI 也搞不定的时候 {#fallback}

那就换人工。[快速上手（会用命令行）](/docs/start/quickstart-dev) 写的是同一套流程，只是写给了会开终端的人。把那页丢给一个会写代码的朋友，他十分钟能弄好。
