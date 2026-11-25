---
title: 静态资源
keywords: 资源, assets, 图片, 路径, basePath, assetsDir
description: 图片、字体、下载文件都放在 assets/ 目录，构建时整体拷进产物。这一页讲目录怎么组织、正文与皮肤里引用路径为什么写法不同。
section: basics
order: 5
updated: 2026-11-17
draft: false
---

静态资源是页面正文之外的文件：图片、字体、图标、给人下载的文档。它们统一放在内容仓库根目录的 `assets/` 里。

构建时整个目录被搬进产物的 `assets/` 下，子目录层级不变。工具不改名、不压缩、不算哈希，只负责搬运。

## 目录位置 {#location}

`assets/` 和 `content/` 平级，都在 `wiki.config.ts` 旁边。目录名可以通过配置项 `assetsDir` 改，默认就是 `assets`。

改了配置项，磁盘上的目录名也要跟着改，两边对不上就找不到资源。

目录里可以随便建子目录，层级原样保留：

| 源文件 | 产物 |
|---|---|
| `assets/logo.png` | `assets/logo.png` |
| `assets/img/cover.jpg` | `assets/img/cover.jpg` |
| `assets/fonts/text.woff2` | `assets/fonts/text.woff2` |

没有 `assets/` 目录也完全正常，构建不报错。刚建站还没有图片时，不用先建一个空目录。

主题自己的资源落在另一个子目录 `assets/theme/`，所以 `assets/style.css` 不会和主题的 `assets/theme/style.css` 撞名。

> `.less` 是唯一会被改动的资源文件，构建时编译成同名 `.css`，产物里不会出现 `.less`。规则见 [样式与 Less](/basics/styles)。

## 正文里怎么引用 {#markdown}

写以 `/` 开头的绝对路径：

```md
![封面](/assets/img/cover.jpg)
```

开头的 `/` 会被加上站点前缀（`basePath`）。本地预览时站点在根上，产物里就是 `/assets/img/cover.jpg`。

部署到 GitHub Pages 的项目站时，同一个写法自动变成 `/仓库名/assets/img/cover.jpg`。

**永远写 `/assets/...`，不要自己拼前缀。**手写仓库名会让本地预览 404，改了站名还得全站替换。

`assets/` 是站点级的：每一页的 `/assets/x.png` 都指向同一份文件。多语言站每次构建都会把整个 `assets/` 复制一遍，两份产物合并后同名文件只会留一份 —— 要用两套图就建 `assets/zh/`、`assets/en/` 这类子目录，地址里带上那一段。

相对路径不会被改写。写 `img/cover.jpg` 时构建原样保留，浏览器按当前页面地址去解析，深层页面上基本指不到文件，一律用 `/` 开头。

> `wiki check` 不检查 `assets/` 下的文件是否存在。图片名写错不会有任何报错，页面上只显示一张裂图。

## 改目录名之后 {#rename}

`assetsDir` 只改磁盘上的来源目录。产物里的目录名固定是 `assets/`，正文里也照样写 `/assets/...`。

```ts
// wiki.config.ts
assetsDir: 'static',
```

把目录改名为 `static/` 后，构建从 `static/` 读文件，产物里仍落在 `assets/` 下。这样部署地址不随目录名变化，换回去也不用改正文。

## 皮肤里怎么引用 {#skin}

规则不同。皮肤里写 `/assets/style.css`，构建不会加前缀，部署到项目站就 404。

必须自己拼 `it.site.base`：

```eta
<link rel="stylesheet" href="<%= it.site.base %>/assets/style.css">
```

`it.site.base` 在站点部署于域名根时是空串，在 `https://用户.github.io/仓库名/` 这种项目站时是 `/仓库名`，不带末尾斜杠。

| 写在哪 | 写法 | 前缀 |
|---|---|---|
| 正文 markdown | `/assets/x.png` | 构建自动加 |
| 皮肤 `.eta` | `<%= it.site.base %>/assets/x.png` | 自己加 |

样式表里的 `url(...)` 同样不会加前缀，路径相对样式表文件本身解析，所以 `url(../img/x.png)` 是从 css 所在目录往回找。

皮肤里还能拿到哪些字段，见 [皮肤](/basics/skins)。

## 目录与命名建议 {#naming}

按类型分子目录，根上只留按名引用的样式表和脚本：

```
assets/
├── img/        正文配图
├── fonts/      自托管字体
└── style.css   页面样式
```

全堆在 `assets/` 根上时，图片、字体、css、js 混在一串里，frontmatter 里引用也难找。

文件名用 ASCII，不要中文和空格。产物里的路径要经过 URL 编码，出问题时不好排查；部分服务器区分大小写，`Logo.png` 与 `logo.png` 会被当成两个文件。

同一张图在一页里用多次就复用同一个文件。没有自动去重，放两份就是传两份。

## 没有优化 {#optimize}

工具只搬运，没有压缩、改名、加哈希这类处理。要优化就在提交前自己做完：图片压到合适尺寸，字体裁掉用不到的字形，体积大的下载文件别塞进仓库。

> 产物里的 `assets/` 与提交的目录一一对应，源目录多大，产物里就多大。

页面级样式与脚本的挂法见 [样式与 Less](/basics/styles) 和 [JavaScript](/basics/javascript)。
