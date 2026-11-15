# 轻维基（lightwiki）

版本化的静态知识库。内容用 markdown + frontmatter 写，git 管版本，编译成一组可移植的静态文件。

设计与决策记录见 [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)。

## 目录

```
packages/
  schema/           frontmatter 与站点配置的 zod schema
  core/             扫描 → 解析 → 渲染 → 链接图 → 输出
  cli/              wiki check / wiki build
  theme-default/    默认主题（layouts + assets）
```

## 开发

包之间通过 `exports` 直接指向 TypeScript 源码，开发期不需要编译步骤。

```bash
yarn install
yarn type:check                       # 只做类型检查，不产出文件
yarn wiki check <内容目录>             # 校验 frontmatter、红链、孤页
yarn wiki build <内容目录> -o dist     # 产出静态站点
```

`wiki check` 与 `wiki build` 都需要一个内容根目录，里面要有 `wiki.config.ts`。
