# 轻维基（lightwiki）

版本化的静态知识库。内容用 markdown + frontmatter 写，git 管版本，编译成**一组可移植的静态文件**——没有服务器依赖、没有 SPA、没有外部 CDN。

## 快速开始

```bash
git clone <本仓库地址> lightwiki
cd lightwiki && yarn install
yarn wiki dev examples/mini
```

打开输出里的地址（默认 `http://127.0.0.1:5173`）。`examples/mini` 是用轻维基自己的语法写的**语法手册**，16 页，每页演示它正在讲的那个语法。

想建自己的站：

```bash
cp -r templates/starter sites/my-wiki
yarn wiki dev sites/my-wiki
```

完整步骤——配 `wiki.config.ts`、目录约定、构建产物、发布、怎么让 AI 帮忙——见 **`docs/getting-started.md`**。

> 工具还没发布到 npm，所以现在只能 clone 本仓库使用。

## 仓库结构

```
packages/
  schema/           frontmatter 与站点配置的 zod schema
  core/             扫描 → 解析 → 渲染 → 链接图 → 输出（不认识任何托管平台）
  dev/              本地预览服务器（node:http + SSE，不写盘）
  cli/              wiki dev / check / build
  theme-default/    默认主题（layouts / macros / assets）
examples/mini/      语法手册，同时是冒烟测试
templates/starter/  可复制的起始内容仓库
docs/               上手文档与设计决策
```

## 开发

开发期不编译：包的 `exports` 直接指向 TypeScript 源码，`tsx` 直接执行。

```bash
yarn type:check                     # 类型检查，不产出文件
yarn wiki check examples/mini       # 校验 frontmatter / 红链 / 孤页 / 缺译
yarn wiki build examples/mini       # 构建，产物在 examples/mini/dist
yarn wiki dev examples/mini         # 本地预览，改内容或模板自动刷新
```

## 文档

| 文件 | 讲什么 | 谁该看 |
|---|---|---|
| `docs/getting-started.md` | 上手：配置、目录、构建、发布 | 新用户 |
| `examples/mini/` | 语法手册（用轻维基自己写） | 内容作者 |
| `ARCHITECTURE.md` | 开发文档：实现规格、已实现/未实现、改动指引 | 改代码的人 |
| `AGENTS.md` | AI 的阅读顺序与项目约定 | AI / 贡献者 |
