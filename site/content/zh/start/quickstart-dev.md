---
title: 快速上手（会用命令行）
keywords: 快速上手, 命令行, CLI, npx, init, dev, build, check, 版本, pin, quickstart
description: 一条命令生成站点，三条命令预览、校验、构建。
section: start
order: 3
updated: 2026-11-17
draft: false
---

## 生成一个站 {#init}

```bash
npx @lightwiki/cli init my-wiki
cd my-wiki
npx @lightwiki/cli dev .
```

用 yarn / pnpm 的话换成：

```bash
yarn dlx @lightwiki/cli init my-wiki
pnpm dlx @lightwiki/cli init my-wiki
```

目录已经存在也不要紧，它只补缺的文件，不覆盖你已有的内容；确实要覆盖就加 `--force`。

`dev` 会打印一个地址（默认 `http://127.0.0.1:5173`，端口被占就往上试），打开就是刚生成的首页。改 `content/zh/index.md` 保存，浏览器自动刷新；`Ctrl+C` 结束。

## 生成出来的六个文件 {#files}

| 文件 | 是什么 |
|---|---|
| `wiki.config.ts` | 站点配置：站点名、地址、语言、分组 |
| `content/zh/index.md` | 首页，就是 `/docs/` |
| `AGENTS.md` | 给 AI 助手的写作说明，Copilot / Cursor 这类工具会自动读 |
| `README.md` | 使用说明，也把这套结构解释了一遍 |
| `.gitignore` | 忽略 `node_modules/`、`dist/`、`.DS_Store` |
| `.github/workflows/pages.yml` | push 到 `main` 就构建并发布到 GitHub Pages |

**没有 `package.json`，也不用 `npm install`。** 内容仓库不装东西，工具在用的时候现取。

> 这六项、目录约定与常见坑也写成了一份可以整段喂给 AI 的说明：[assets/agents.md](/assets/agents.md)。它和上面这个 `AGENTS.md` 不是同一份：那份讲怎么从零把站搭起来，生成的 `AGENTS.md` 讲怎么往里写内容。

## 三条命令 {#commands}

| 命令 | 做什么 |
|---|---|
| `npx @lightwiki/cli dev <目录>` | 本地预览，改了自动刷新，不写盘 |
| `npx @lightwiki/cli check <目录>` | 只校验，不写盘：红链、孤页、frontmatter、缺译 |
| `npx @lightwiki/cli build <目录>` | 产出到 `<目录>/dist/` |

`<目录>` 就是 `wiki.config.ts` 所在的目录，站在里面就写 `.`。

`check` 值得在提交前跑一次。它点名的问题 `build` 不会拦你，但线上就是死链。

## 钉住版本 {#pin}

CI 里的版本号**写死**：

```bash
npx --yes @lightwiki/cli@0.3.0 build .
```

别写 `^0.3.0`：0.x 的 caret 只覆盖 `0.3.x`，出下一个 minor 就取不到了，构建会跟着漂。想本地也锁住，就装成开发依赖：

```bash
npm i -D @lightwiki/cli
npx wiki build .
```

装成依赖之后命令名是 `wiki`，不用再写一整串 `@lightwiki/cli`。

## 可以不建的三个目录 {#optional}

| 目录 | 放什么 | 不建会怎样 |
|---|---|---|
| `assets/` | 图片、字体、样式表 | 没有图可放 |
| `layouts/` | 皮肤 | 用主题自带的 |
| `macros/` | 模板 | 用主题自带的 |

三个都是建了才用：不建就用主题默认的，建了也只覆盖你写的那几个同名文件，升级工具时不会被冲掉。

## 再往下 {#next}

文件放在哪、子目录怎么变成地址、`404.md` 怎么写，都在 [目录结构](/docs/start/structure)。
