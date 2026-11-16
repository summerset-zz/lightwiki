# 轻维基（lightwiki）

[![CI](https://github.com/summerset-zz/lightwiki/actions/workflows/ci.yml/badge.svg)](https://github.com/summerset-zz/lightwiki/actions/workflows/ci.yml)
[![Pages](https://github.com/summerset-zz/lightwiki/actions/workflows/pages.yml/badge.svg)](https://github.com/summerset-zz/lightwiki/actions/workflows/pages.yml)

版本化的静态知识库。内容用 markdown + frontmatter 写，git 管版本，编译成**一组可移植的静态文件**——没有服务器依赖、没有 SPA、没有外部 CDN。

在线预览：**https://summerset-zz.github.io/lightwiki/**（就是 `examples/mini` 这份语法手册）

部署示例：**[字体百科](https://summerset-zz.github.io/lightwiki-demo-fontcover/)** —— [fontcover.com](https://fontcover.com) 的文档快照，110 页中英双语；内容仓库独立、CI 零凭据构建、部署在子路径下。

## 快速开始

最快的方式是**一条命令生成一个站点**：

```bash
npx @lightwiki/cli init my-wiki
cd my-wiki && npx @lightwiki/cli dev .
```

生成的是配置 + 一页示例内容 + 给 AI 看的 `AGENTS.md` + 开箱能用的 Pages workflow，不需要 `npm install`。

不想用命令行就在 GitHub 上用模板仓库：[lightwiki-starter](https://github.com/summerset-zz/lightwiki-starter) → **Use this template**。

手上已经有内容目录的话，在里面跑（要有 `wiki.config.ts` 和 `content/`）：

```bash
npx @lightwiki/cli dev .      # 本地预览，默认 http://127.0.0.1:5173
npx @lightwiki/cli build .    # 产物在 ./dist
```

第一次运行会下载工具，之后走 npm 缓存。想固定在项目里：

```bash
npm i -D @lightwiki/cli
npx wiki dev .                # 装完之后的命令名是 wiki
```

完整步骤（配置字段、目录约定、部署）见 **`docs/getting-started.md`**；`packages/cli/templates/starter` 就是 `wiki init` 复制的模板，也是模板仓库的来源。

`examples/mini` 是用轻维基自己的语法写的**语法手册**，17 页，每页演示它正在讲的那个语法 —— 在线版：https://summerset-zz.github.io/lightwiki/

## 仓库结构

```
packages/
  schema/           frontmatter 与站点配置的 zod schema
  core/             扫描 → 解析 → 渲染 → 链接图 → 输出（不认识任何托管平台）
  dev/              本地预览服务器（node:http + SSE，不写盘）
  cli/              wiki init / dev / check / build / deploy
  theme-default/    默认主题（layouts / macros / assets）
examples/mini/      语法手册，同时是冒烟测试
packages/cli/templates/starter/  wiki init 用的起始内容仓库
docs/               上手文档与设计决策
```

## 开发

开发期不编译：包的 `exports` 直接指向 TypeScript 源码，`tsx` 直接执行。

```bash
yarn type:check                     # 类型检查，不产出文件
yarn wiki check examples/mini       # 校验 frontmatter / 红链 / 孤页 / 缺译
yarn wiki build examples/mini       # 构建，产物在 examples/mini/dist
yarn wiki deploy examples/mini      # 为发布构建（目前只输出到本地目录；--inline 出单文件）
yarn wiki dev examples/mini         # 本地预览，改内容或模板自动刷新
```

## 文档

| 文件 | 讲什么 | 谁该看 |
|---|---|---|
| `docs/getting-started.md` | 上手：配置、目录、构建、发布 | 新用户 |
| `examples/mini/` | 语法手册（用轻维基自己写） | 内容作者 |
| `ARCHITECTURE.md` | 开发文档：实现规格、已实现/未实现、改动指引 | 改代码的人 |
| `AGENTS.md` | AI 的阅读顺序与项目约定 | AI / 贡献者 |
