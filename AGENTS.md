# AGENTS.md

给 AI 编码助手（Copilot / Cursor / Codex 等）的项目约定与阅读顺序。

## 这是什么

轻维基：把 markdown + frontmatter 写的内容仓库编译成一组可移植的静态文件。
本仓库是**工具**（monorepo），内容仓库是被编译的输入，两者分开。

## 阅读顺序

按任务挑，不要一次性全读：

| 任务 | 先读这些 |
|---|---|
| 写内容、改配置、建站 | `docs/getting-started.md` → `examples/mini/content/zh/*.md` |
| 改主题或布局 | `packages/theme-default/layouts/*.eta` → 手册里的「布局」一页 |
| 改核心（解析、路由、构建） | `PROJECT_PLAN.md` → `docs/template-language.md` → `packages/core/src/` |
| 想知道某个语法为什么这么定 | `docs/template-language.md`（需求原文 + 评估 + 决定） |

**`examples/mini` 读源文件**，不要先构建再读产物——源文件才是语法本身。

## 约定

- 开发期不编译：包的 `exports` 指向 `src/*.ts`，用 `tsx` 直接跑，没有 build 步骤。
- **页面身份是文件名（slug）**，不是标题。标题只用于双链 `[[标题]]` 的便利解析，改标题会断链。
- 内容语法以 `examples/mini` 为准，它是唯一维护的用户文档；`docs/` 里放的是设计决策，不是用法。
- 给用户新增配置项时，必须同时更新 `docs/getting-started.md` 的字段表。
- 渲染分三段：扫描 → 建索引（slug / 标题）→ 渲染。改其中一段要考虑另外两段。

## 命令

能跑什么、dev server 怎么起停，见 `.github/copilot-instructions.md`。
