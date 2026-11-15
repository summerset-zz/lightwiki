# 轻维基（lightwiki）

版本化的静态知识库。内容用 markdown + frontmatter 写，git 管版本，编译成一组可移植的静态文件。

设计与决策记录见 [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)；内容、模板与命令的写法见 **`examples/mini`**——那是一份用轻维基自己的语法写的手册，也是本仓库唯一的用户文档。

## 目录

```
packages/
  schema/           frontmatter 与站点配置的 zod schema
  core/             扫描 → 解析 → 渲染 → 链接图 → 输出（不认识任何托管平台）
  dev/              本地预览服务器（node:http + SSE，不改盘）
  cli/              wiki dev / check / build
  theme-default/    默认主题（layouts + assets）
```

## 开发

包之间通过 `exports` 直接指向 TypeScript 源码，开发期不需要编译步骤。

```bash
yarn install
yarn type:check                       # 只做类型检查，不产出文件
yarn wiki dev examples/mini           # 本地预览，默认 http://127.0.0.1:5173
yarn wiki check <内容目录>             # 校验 frontmatter、红链、孤页
yarn wiki build <内容目录> -o dist     # 产出静态站点
```

`wiki dev` / `check` / `build` 都需要一个内容根目录，里面要有 `wiki.config.ts`。

`examples/mini` 是仓库自带的**语法手册**：内容用轻维基自己的语法写，再由轻维基渲染。
它同时充当冒烟测试——语法坏了，这份手册第一眼就能看出来。
