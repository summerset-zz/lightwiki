---
title: 快速上手（纯新人）
keywords: 快速上手, 入门, 不会代码, AI, Copilot, Cursor, ChatGPT, node, 模板仓库, GitHub Pages, quickstart
description: 不用碰命令行也能建站：让 AI 帮你搭好，或者下载压缩包直接改字。
section: start
order: 2
updated: 2026-11-17
draft: false
---

## 你需要什么 {#need}

你需要至少一个能够操作你电脑的AI Harness，常见的Qcode、DSH、workbuddy等都可以。但是：
- 为了方便你进行内容编辑，我们推荐你额外安装一个IDE（集成开发环境），例如vscode等。
- 如果你的Harness自带编辑器（例如DSH Desktop）则更省事。

## 请AI搭建项目 {#route-a}

首先，在你想要管理内容的地方创建一个文件夹，例如`d:\mywiki`。

然后，告诉你的AI：
```
按照 https://summerset-zz.github.io/lightwiki/assets/agents.md 的指导，在 d:\mywiki 处开一个新仓库。
```

这篇指导文档会告诉你的AI：
- 怎么准备环境依赖(nodejs)
  - 如果你是第一次安装nodejs，你可能需要重启一次harness。
- 怎么初始化工作区
- 怎么进行配置
- 怎么验证配置结果
- 怎么获取近一步的指示
  - 工作区初始化后，根目录会额外创建另一个`AGENTS.md`用来指导它进行进一步协作。

AI通常会在这一步同时帮你安装`git`以进行版本管理。理解git对你可能有一定难度。

如果完全不想接触git，你也可以试试：

### 备选方案：使用压缩包 {#route-b}

你可以访问<https://github.com/summerset-zz/lightwiki-starter>，点击右上角的绿色`Code`按钮，并在下拉菜单中选择`Download ZIP`。

下载完成后，将其解压到你的项目目录中，然后告诉你的AI“参考该目录中的AGENTS.md”即可。



## 启动开发服务器 {#preview}

准备工作完成后，在该目录下打开终端。
- windows11下，在该目录中右键，然后选择`在终端中打开`即可。

然后输入以下内容：
```bash
npx --yes @lightwiki/cli dev .
```
- 这里的`--yes`是为了自动确认执行`npx`脚本。如果你希望自己确认一次则可以去掉。

此时开发服务器就会启动。
- 复制终端中的地址(如`http://127.0.0.1:5173`)到浏览器即可看到效果。
- 在该终端运行期间，你的工作区中的大多数改动均会实时体现到浏览器中。
- 关闭终端、在终端中<kbd>ctrl+c</kbd>均可关闭开发服务器。

如果此时提示`找不到node`或`找不到npx`，则表示nodejs没有正常安装、或者缺少重启步骤。

如果你的Harness或IDE自己带一个`终端`，则可以在这个终端里执行该命令。

## 编辑 {#editing}

初始仓库的目录结构参考[这里](/start/structure)。你可以编辑一下`/content/zh`下的`md`文件看看效果。


## 生成产物 {#generating}
你目前看到的效果是由开发服务器模拟的。想要真正拿到生成结果，你可以运行：
```bash
npx @lightwiki/cli build .
```
产物会生成到`dist/`文件夹。

如果想提前检查一下有没有写错，你可以：
```bash
npx @lightwiki/cli check .
```
相关警告会显示在终端中。
> 由于之前的终端被开发服务器占用，你可能需要新开一个终端。

## 接下来 {#next}

- 学习markdown语法和轻维基的扩展语法 → [markdown语法文档](/basics/markdown)
- 学习模板语法 → [模板语法文档](/basics/templates)
- 学习皮肤语法 → [皮肤语法文档](/basics/skins)
- 继续熟悉工作区 → [目录结构](/start/structure)
- 熟悉产物结构 → [产物结构](/start/dist)