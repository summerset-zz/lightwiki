---
title: 命令行
keywords: cli, 命令, init, dev, check, build, 退出码
description: 四个命令、它们的参数、退出码，以及 wiki check 会检查哪些东西。
section: advanced
order: 2
updated: 2026-11-17
draft: false
---

命令行工具是 `@lightwiki/cli`。用 `npx @lightwiki/cli` 直接跑，或装成开发依赖后叫 `wiki`。

## 四个命令 {#commands}

```
wiki init [dir]                       scaffold a new site
wiki dev [dir] [-p port]              preview server with live reload
wiki check [dir]                      validate
wiki build [dir] [-o out] [--inline]  build a static site
```

`[dir]` 是内容仓库根，也就是含 `wiki.config.ts` 的那个目录。省略时用当前目录。

## 参数全表 {#flags}

| 参数 | 用于 | 默认 | 说明 |
|---|---|---|---|
| `-p, --port` | `dev` | `5173` | 端口，必须是 1 到 65535 的整数 |
| `--host` | `dev` | `127.0.0.1` | 监听地址 |
| `--no-watch` | `dev` | 关 | 关掉源码监护层 |
| `--watch` | `dev` | 关 | 把默认值写明白，等价于不写 |
| `-o, --out` | `build` | 配置的 `outputDir` | 输出目录 |
| `--inline` | `build` | `false` | 单文件产物 |
| `--strict` | `check` | `false` | 红链与孤页也算失败 |
| `--name` | `init` | 目录名 | 站点名 |
| `--force` | `init` | `false` | 覆盖已存在的文件，默认跳过 |

常改的几个参数：

```bash
npx @lightwiki/cli dev . -p 3000        # 换端口
npx @lightwiki/cli check . --strict     # 红链与孤页也算失败
npx @lightwiki/cli build . -o public    # 产物写到 public/
```

`-p` 收到非整数、`0` 或超过 `65535` 的值时直接退出，退出码是 `2`。

## 退出码 {#exit-codes}

| 码 | 含义 |
|---|---|
| `0` | 正常 |
| `1` | 发现问题 |
| `2` | 命令本身用错（未知命令、端口非法） |

`check` 有问题就返回 `1`。`build` 只在有页面因 frontmatter 错误被跳过时返回 `1`，红链与孤页只提示，仍然是 `0`。

## init 铺一份起始模板 {#init}

`wiki init <目录>` 把内置模板铺到目标目录，产出 6 个文件：

| 文件 | 是什么 |
|---|---|
| `wiki.config.ts` | 站点配置 |
| `content/zh/index.md` | 首页 |
| `AGENTS.md` | 给 AI 助手的写作说明 |
| `README.md` | 使用说明 |
| `.gitignore` | 忽略 `node_modules/`、`dist/`、`.DS_Store` |
| `.github/workflows/pages.yml` | push 到 `main` 时构建并发布到 GitHub Pages |

目录已存在时只补缺失的文件，不覆盖；要覆盖加 `--force`。`--name` 决定配置里的站点名，不写就用目录名。

## dev 起本地预览 {#dev}

`wiki dev <目录>` 启动预览服务，默认地址 `http://127.0.0.1:5173`。端口被占用会自动往上试，以启动输出里的地址为准。`Ctrl+C` 停止。

改内容、模板（`macros/`）与皮肤会自动重建并刷新页面；改 `assets/` 里的静态资源只刷新，不重建（资源是请求时现读的，`.less` 也是现编译）。改 `wiki.config.ts` 需要重启。

命令行工具直接从工具仓库源码里跑时（安装位置在 `packages/` 下），会额外开一层源码监护：`packages/*/src` 一有改动就把 dev 子进程换掉，端口不变。从 npm 装的版本没有这一层，`--no-watch` 用来关掉它。

监护层开着时，还可以 `POST /__lightwiki/restart` 手动触发重启。

## build 产出静态文件 {#build}

`wiki build <目录>` 构建到配置里的 `outputDir`，默认是 `dist/`。构建会先清空输出目录。

产物里有哪些文件，见 [目录结构](/docs/start/structure)。

加 `--inline`（或配置里写 `inline: true`）时产物只剩 `.html`，样式、脚本、图片与搜索索引都内联进页面。体积代价见 [站点配置](/docs/advanced/config)。

## check 检查什么 {#check}

`wiki check <目录>` 只读不写盘，有问题才输出对应的一节。

| 节标题 | 含义 | 算失败 |
|---|---|---|
| `frontmatter error(s)` | YAML 写坏、必填字段缺失 | 是 |
| `warning(s)` | 构建期的警告 | 否 |
| `section value(s) not in the allowed list` | `section` 不在配置里 | 是 |
| `layout file(s) missing` | `layout` 指的皮肤文件不存在 | 是 |
| `missing style/script file(s)` | `styles` / `scripts` 指向的文件不存在 | 是 |
| `language(s) without a home page` | 某个语言缺 `index.md` | 是 |
| `duplicate title(s)` | 同一语言里标题撞车，`[[标题]]` 会歧义 | 是 |
| `undefined macro(s)` | 模板没定义 | 取决于 `macros.undefined`，默认算失败 |
| `unresolved wikilink(s)` | 双链的目标既不是 slug 也不是标题 | 否，`--strict` 也不升级 |
| `red link(s)` | 站内链接指向不存在的页 | 否，`--strict` 时算 |
| `orphan page(s)` | 没有任何页面链到它 | 否，`--strict` 时算 |
| `category note(s)` | 分类没在配置里声明，或 `sidebarCategory` 没有成员 | 否 |
| `missing translation(s)` | 某页在别的语言里没有对应页 | 否，纯提示 |

「链到它」只算**正文链接**：markdown 渲染出来的 `[]()`、双链、以及模板展开后落进正文的链接。导航、侧栏、皮肤里直接写的 `<a>` 都不算入链，也不算红链。所以把首页内容整块写在皮肤里时，它链过去的那几页仍会被报成孤页。原因与取舍见 [皮肤](/docs/basics/skins#content-links)。

`--strict` 只把红链与孤页这两项升级为失败，其它提示项不受影响。

> 判断一次检查算不算失败，看最后那行 `result: ok` 或 `result: problems found`，不要靠有没有输出。

## 再往下 {#next}

每个字段的作用与默认值见 [站点配置](/docs/advanced/config)。内容怎么写见 [frontmatter](/docs/basics/frontmatter)。
