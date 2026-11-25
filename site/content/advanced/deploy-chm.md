---
title: 打包成 CHM
keywords: chm, html help, 离线, 兼容性
description: 目前不直接生成 CHM。这一页列出要自己打包时必须满足的条件，以及主题在 CHM 里会退化成什么样。
section: advanced
order: 5
updated: 2026-11-17
draft: false
---

CHM 是 Windows 的离线帮助文件格式（HTML Help），由一组 HTML 页面打包而成。

轻维基只产出静态文件，不生成 CHM。要得到 `.chm`，得自己用 HTML Help Workshop 把 `dist/` 打进去。工具不生成 `.hhp` 与 `.hhc` 工程文件。

## 谁做什么 {#status}

| 事项 | 谁做 |
|---|---|
| 产出静态页面 | 工具，跑 `build` |
| `.hhp` 工程文件 | 自己建 |
| `.hhc` 目录树 | 自己建 |
| 编译成 `.chm` | HTML Help Workshop |

## 结论的依据 {#basis}

> 这一页是对产物与默认主题的静态分析，没有在真实的 CHM 查看器里逐项验证。结论用来预判哪里会出问题，不等于实测结果。

## 打包前要满足的四条 {#requirements}

| 配置 | 值 | 为什么 |
|---|---|---|
| `urlStyle` | `'file'` | 默认的 `directory` 会产出 `/a/` 这类路径，CHM 里会被解释成盘符根，全站导航直接失效。`'file'` 产出 `a.html`，并把产物里的站内链接改写成相对路径 |
| `basePath` | `'/'` | CHM 里没有域名，任何前缀都会让链接断掉 |
| `redirectMode` | `'js'` | `_redirects` 对 CHM 没有意义，跳转页才有用 |
| 文件名 | 全 ASCII | slug 来自文件名。CHM 编译器按系统代码页处理路径，中文或空格容易导致打包失败，或运行时找不到文件 |

这四项在 [站点配置](/advanced/config) 里都有说明。文件的路径规则见 [目录结构](/start/structure)。

四条之外还有一条：页面里不要用 `type="module"` 的脚本，原因见下一节。

## 产物形态 {#artifacts}

`urlStyle: 'file'` 下每页的产物是 `a.html`，站内链接在构建时被改写成相对路径。

这一点是 CHM 能用的前提。CHM 里的页面同样是本地文件，没有域名可以拼绝对地址。

## 先用本地文件验证路径 {#file-check}

按 `'file'` 构建后，直接双击 `dist/` 里的页面就能走一遍导航。

这一步只能确认链接与资源路径是通的。浏览器和 CHM 查看器不是同一个引擎，样式问题不会在这里暴露。

## CHM 查看器的能力上限 {#engine}

CHM 查看器用的是 Windows 自带的 Internet Explorer 排版组件（mshtml），具体行为跟着系统的 IE 版本走，旧系统上更差。

所以页面能用的 CSS 与 JS，上限就是 IE 的水平，比现代浏览器差很多。默认主题按现代浏览器写，落到 CHM 里会退化。

## 默认主题会退化成什么样 {#degradation}

| 依赖 | 主题里用了多少 | 在 CHM 里的后果 |
|---|---|---|
| CSS 自定义属性 `var(--x)` | 47 处 | 不认识 `var()`，所有用到它的声明整条失效。背景色、文字色、边框色、侧栏宽度全部丢失 |
| `display: grid` 与 `minmax()` | 布局骨架 | 三栏布局退化成普通块级流，侧栏与正文垂直堆叠 |
| `gap` | 2 处 | 被忽略，间距归零 |
| `position: sticky` | 2 处 | 被忽略，侧栏不再跟随滚动 |
| `prefers-color-scheme` | 2 处 | 不匹配，永远按浅色渲染 |
| `Promise` 与 `fetch` | 搜索脚本 | 旧引擎没有这两个 API，搜索框点了没反应 |
| `<details>` | 查看源码区块 | 不认识时内容一直展开，信息不丢但很占地方 |
| `type="module"` | 自己声明的脚本里可能有 | 未知的 `type` 值会让脚本整块不执行 |

## 脚本与搜索 {#scripts}

`'file'` 模式下搜索索引写在页面本身里，不需要额外请求。

但读索引与匹配都靠脚本。脚本不执行时，搜索框就只是一个输入框。

## 能读与不能保 {#conclusion}

功能层面能读：正文、标题、链接、代码块、表格都在，导航也能走。

但默认主题的外观基本不保，配色与布局都会退化。

## CHM 是主要目标时怎么办 {#custom-skin}

做法是覆盖一份只依赖基础 CSS 的皮肤：

- 不用 CSS 自定义属性，颜色直接写死
- 用 `float` 或简单的两栏 `table` 做布局，或者干脆单列
- 不用 `sticky`、`grid`、`gap`
- 不要依赖脚本，搜索这类功能直接不提供

具体怎么写皮肤见 [皮肤](/basics/skins)。

## 再往下 {#next}

- [发布到 GitHub Pages](/advanced/deploy-pages)
- [部署到自有服务器](/advanced/deploy-server)
