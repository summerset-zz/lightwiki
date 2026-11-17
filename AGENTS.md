# AGENTS.md

给 AI 编码助手（Copilot / Cursor / Codex 等）的项目约定与阅读顺序。

## 这是什么

轻维基：把 markdown + frontmatter 写的内容仓库编译成一组可移植的静态文件。
本仓库是**工具**（monorepo），内容仓库是被编译的输入，两者分开。

## 阅读顺序

按任务挑，不要一次性全读：

| 任务 | 先读这些 |
|---|---|
| 写主站文档 | `site/content/zh/*.md` → `site/wiki.config.ts` |
| 写内容、改配置、建站 | `docs/getting-started.md` → `tests/mini/content/zh/*.md` |
| 改主题或皮肤 | `packages/theme-default/layouts/*.eta` → `site/` 里「皮肤」一页 |
| 改核心（解析、路由、构建） | `ARCHITECTURE.md` → `packages/core/src/` |
| 想知道某项设计为什么这么定 | `ARCHITECTURE.md` 的对应章节 |

**`tests/mini` 读源文件**，不要先构建再读产物——源文件才是语法本身。

## 两个内容仓库的分工

| 目录 | 角色 | 规矩 |
|---|---|---|
| `site/` | 主站文档中心（面向用户） | 按 开始/基础/高级 组织；写给人看 |
| `tests/mini/` | 语法回归测试 | 每加一个语法就在这里加一页；写全、写短 |

## 约定

- 开发期不编译：包的 `exports` 指向 `src/*.ts`，用 `tsx` 直接跑，没有 build 步骤。
- **页面身份是文件名（slug）**，不是标题。标题只用于双链 `[[标题]]` 的便利解析，改标题会断链。
- 改了语法 → `tests/mini` 必须加页或改页（它是回归测试）；面向用户怎么解释，写在 `site/`。
- 给用户新增配置项时，必须同时更新 `docs/getting-started.md` 的字段表。
- **发版后要同步模板的版本号**：`packages/cli/templates/starter/__github/workflows/pages.yml`
  里的 `@lightwiki/cli@x.y.z` 是写死的（CI 要可复现），`templates/starter/README.md` 里也有几处。
  忘了改，新用户建出来的站会一直跑旧版本 —— 0.x 的 caret（`^0.3.0`）只覆盖 `0.3.x`，别指望它自动升级。  `site/layouts/nav.eta` 顶部还有一个显示用的版本号常量，也要一起改。- 渲染分三段：扫描 → 建索引（slug / 标题）→ 渲染。改其中一段要考虑另外两段。
- 改路由、产物形态这类东西时，`routes.ts` / `build.ts` / `dev` 三处必须同步，否则预览与产物不一致。

## 命令

能跑什么、dev server 怎么起停，见 `.github/copilot-instructions.md`。
