---
title: 简介
keywords: 简介, 轻维基, lightwiki, 静态站点, static site, markdown, 知识库, 入门, intro
description: 轻维基把 markdown 和 frontmatter 编译成一组可移植的静态文件，你只需要写内容。
section: start
order: 1
updated: 2026-11-17
draft: false
---

## 什么是轻维基 {#what}

<strong>轻维基</strong>(lightwiki)是一个使用上世代工具链的静态站点构建工具。
- <strong>为什么是上世代？</strong>因为我们抛弃了主流前端框架、抛弃了后端业务。你只需要会打字，加上一些简单的语法知识，即可生成整个站点。

轻维基的产物会生成在工作目录的`/dist`文件夹下以供发布。


## 与Mediawiki对比 {#compare}

轻维基的想法脱胎于mediawiki的缺陷：如果一个站点的大多数贡献都是由同一个用户完成的，那么用户系统、多人协作、繁重的后端业务和底层设施支持是否还有必要？

为此，轻维基的设想由此诞生：用户系统、多人协作功能由外部工具（例如`git`）实现，抛弃后端业务，抛弃底层设施，页面变更后进行一次构建即可重新生成页面。

|           | MediaWiki                      | 轻维基                              |
| --------- | ------------------------------ | ----------------------------------- |
| 用户系统  | 完善的权限系统                 | 无，依赖外部工具                    |
| 多人协作  | 有                             | 无，依赖外部工具                    |
| 版本控制  | 有                             | 无，依赖外部工具                    |
| 页面生成  | 服务端生成                     | 构建工具生成                        |
| 后端业务  | 有，复杂的php                  | 无                                  |
| 底层支持  | php,SQL等                      | 仅在构建时需要`nodejs`              |
| 数据库    | 有                             | 无                                  |
| 运维成本  | 高                             | 无                                  |
| 编辑器GUI | 有                             | 无，依赖本地IDE                     |
| 内容      | wikitext                       | markdown+frontmatter                |
| 模板      | wikitext+LUA                   | eta(略高于wikitext，需要一点JS知识) |
| 皮肤      | 仅CSS/JS，其他功能需服务器知识 | eta+css+js                          |

综上所述，如果你想创建一个站点：
- 只有你一人，或者仅需要可信用户参与
- 不需要后端业务（不需要数据库、不需要在线编辑）
- 不想依赖网络或其他平台服务

那么我建议你试试<strong>轻维基</strong>。

## 准备工作 {#preparation}

我们强烈建议您使用一个带有代码高亮功能的IDE（集成开发环境），例如[VSCode](https://code.visualstudio.com)/[Jetbrains](https://www.jetbrains.com/zh-cn/)。
- 如果您习惯使用偏向自动化的harness，我们也建议您同时开一个IDE用于手动检查内容。
- 或者您也可以使用自带IDE的harness，例如[TRAE](https://www.trae.cn)和[DSH Desktop](https://www.dshdesktop.cn)。
- 大多数IDE都带有BYOK功能（使用自己的AI、而不是IDE自带的AI）。

你的设备还应当安装`nodejs`，版本大于或等于`20`。

如果你需要版本控制、多用户协作和[发布到github pages](/advanced/deploy-pages)功能，你还应当安装`git`。

> 不知道怎么安装nodejs和git？没关系。我们准备了[纯新人用的指导](/start/quickstart-ai)。
> 
> 如果你已是代码大佬，可以从[开发者指导](/start/quickstart-dev)开始。

此外，轻维基的文档站点是用轻维基的默认皮肤生成的。在每一页的底部，你可以点击展开`查看源码`来对比我们是怎么写的。

## 先看看效果 {#try}

除了本站之外，我们还准备了一个用于演示的站点[lightwiki-demo-fontcover](https://summerset-zz.github.io/lightwiki-demo-fontcover/)，仓库位于[这里](https://github.com/summerset-zz/lightwiki-demo-fontcover)。
- 这是我的另一个项目[fontcover.com](https://fontcover.com)的文档中心的镜像。fontcover的文档也是markdown+frontmatter写的，因此与lightwiki的适配性极强。

## 接下来读什么 {#next}

- 不写代码、想让 AI 代劳 → [快速上手（纯新人）](/start/quickstart-ai)
- 已经是代码大佬 → [快速上手（开发者）](/start/quickstart-dev)
- 想先弄清文件放哪 → [目录结构](/start/structure)
