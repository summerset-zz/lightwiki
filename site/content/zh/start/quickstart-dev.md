---
title: 快速上手（开发者）
keywords: 快速上手, 命令行, CLI, npx, init, dev, build, check, 版本, pin, npm install, package.json, degit, quickstart
description: 一条命令生成站点，三条命令预览、校验、构建。
section: start
order: 3
updated: 2026-11-17
draft: false
---

## 环境依赖 {#env}

| 需要                  | 说明                                         |
| --------------------- | -------------------------------------------- |
| Node.js **20 或更高** | 唯一的硬依赖。`node -v` 确认                 |
| `git`                 | 可选。要版本控制或发布到 GitHub Pages 时再装 |


## 初始化仓库 {#init}

我们提供两种初始化仓库和后续cli的执行方式，两种方式各有优劣。

- 包执行器(npx)
  - √ 调用时自动下载，调用结束时清理
  - √ 项目目录干净，没有`package.json`、没有`node_modules`
  - × 依赖网络，因为包是现场下载的
  - × 不适合高频使用，因为每次都要下载
  - × 默认使用最新版本，可能会造成版本冲突
  - × 缺少快捷的CLI执行入口
- 包管理器(npm/yarn等)
  - √ 包保存到本地，可以锁定版本
  - √ 使用`package.json`管理版本、易于迁移
  - √ 便捷保存常用命令，并随着`package.json`一并迁移
  - × 项目目录会多出`package.json`或`node_modules`，不够优雅

### 方式一：npx {#init-npx}

在当前目录下创建`my-wiki`目录、初始化工作区，并启动开发服务器：
```bash
npx @lightwiki/cli init my-wiki
cd my-wiki
npx @lightwiki/cli dev .
```
如果想要锁定`@lightwiki/cli`的版本，可以这么写：
```bash
npx @lightwiki/cli@0.3.0 init my-wiki
```

如果你使用的是`yarn`或`pnpm`，则可按如下方式执行，以下不再赘述。
```bash
yarn dlx @lightwiki/cli init my-wiki
pnpm dlx @lightwiki/cli init my-wiki
```

`dev` 会打印一个地址（默认 `http://127.0.0.1:5173`，端口被占就往上试），打开就是刚生成的首页。改 `content/zh/index.md` 保存，浏览器自动刷新；`Ctrl+C` 结束。

适合：只写内容、不想在仓库里维护依赖。代价是每条命令都要打全名，版本只能用 `@x.y.z` 跟在命令后面。

### 方式二：package.json {#init-local}
使用`package.json`在初期配置相对繁琐，但之后可以更便捷地进行操作。

这种方式会把`@lightwiki/cli`安装到本地，因此开发过程不依赖网络。


接下来执行以下命令：在当前目录下创建`my-wiki`目录，初始化npm，安装cli依赖，初始化lightwiki。
```bash
mkdir my-wiki
cd my-wiki
npm init -y
npm i -D @lightwiki/cli
npx wiki init . --name "我的知识库"
```
其中，`npx wiki init`命令会将干净的模板仓库复制到工作区，不会带有历史版本的提交信息；之后你可以自行`git init`。

依赖安装完成后，`npm wiki`命令即会指向`node_modules/.bin/wiki`。

你也可以使用`npx degit`命令获取无git的版本：
```bash
npx degit summerset-zz/lightwiki-starter my-wiki
```

#### package.json的配置 {#init-local-scripts}

```jsonc
{
  "name": "my-wiki",
  "private": true,
  "scripts": {
    "dev": "wiki dev .", // 启动开发服务器（默认127.0.0.1:5173）
    "check": "wiki check .", // 检查内容完整性
    "build": "wiki build ." // 根据wiki.config.ts的配置生成站点
  },
  "devDependencies": {
    "@lightwiki/cli": "0.3.0" // 依赖版本。建议锁死，不要用`^0.3.0
  }
}
```

> 使用`package.json`需要在升级版本时额外调整CI配置。参考[发布到 GitHub Pages](/advanced/deploy-pages#cli-version)。

## 两种方式对比 {#init-compare}

|                | npx                                                | package.json                                                  |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| 工作区整洁度   | 整洁，只有内容、模板、皮肤等                       | 还包括`package.json`和`node_modules`                          |
| 执行命令       | `npx @lightwiki/cli build .`<br>每次运行都依赖网络 | `npm run build`<br>可自定义其他快捷入口<br>并且IDE通常带有GUI |
| 编译器版本控制 | 执行`npx`时加版本号(不加就会总是最新)              | `package.json`中锁定版本                                      |
| 网络依赖       | 每次执行`npx`时                                    | 仅依赖安装时                                                  |
| CI             | 命令直接可用                                       | 使用`npm ci`初始化一次                                        |
| 升级           | 改命令里的版本号                                   | 改 `package.json`后执行`npm install`                          |

## 初始文件 {#files}

| 文件                          | 是什么                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `wiki.config.ts`              | 站点配置：站点名、地址、语言、分组                                                 |
| `assets/agents.md`            | 给AI的、用于初始化项目的使用说明。安装完成后不必再使用。                           |
| `content/zh/index.md`         | 首页，对应链接`/`                                                                 |
| `AGENTS.md`                   | 给AI的使用说明（用于日常维护、开发等）                                             |
| `README.md`                   | 给你的使用说明                                                                     |
| `.gitignore`                  | git版本控制忽略列表                                                                |
| `.github/workflows/pages.yml` | 自动构建脚本。请参考[发布到 GitHub Pages](/advanced/deploy-pages#cli-version) |
| `package.json`                | 如果使用方式2，则会新增此文件                                                      |

### 三条命令 {#commands}

| 功能                             | npx                               | package.json    |
| -------------------------------- | --------------------------------- | --------------- |
| 启动开发服务器，文件改动后热更新 | `npx @lightwiki/cli dev <目录>`   | `npm run dev`   |
| 校验红链、孤页、frontmatter等    | `npx @lightwiki/cli check <目录>` | `npm run check` |
| 构件产出到 `<目录>/dist/`        | `npx @lightwiki/cli build <目录>` | `npm run build` |

### 三个目录 {#optional}

| 目录       | 放什么                                                          |
| ---------- | --------------------------------------------------------------- |
| `assets/`  | 静态资源：额外的图片、字体、样式表                              |
| `layouts/` | [自定义皮肤](/basics/skins)。默认使用的皮肤是主题自带的。  |
| `macros/`  | [自定义模板](/basics/templates)。`eta`文件名对应模板名称。 |


## 继续阅读 {#next}

文件放在哪、子目录怎么变成地址、`404.md` 怎么写，都在[目录结构](/start/structure)。
