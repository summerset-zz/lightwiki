# 从零开始

> **当前状态**：轻维基还是开发中，**没有发布到 npm**。所以"用起来"的唯一方式是把本仓库 clone 下来。
> 工具发布之后，这一页的第一节会换成 `yarn add -D @lightwiki/cli`，其余步骤不变。

---

## 1. 把仓库拉下来

```bash
git clone <本仓库地址> lightwiki
cd lightwiki
yarn install
```

`yarn install` 会装好工具链（TypeScript、markdown-it、highlight.js、less 等）。开发期不需要编译任何东西，TypeScript 源码直接被 `tsx` 执行。

## 2. 先看它能做什么

```bash
yarn wiki dev examples/mini
```

打开输出里的地址（默认 `http://127.0.0.1:5173`）。那是**用轻维基自己的语法写的语法手册**，16 页，每页演示它正在讲的那个语法。

看够了按 `Ctrl+C` 关掉。

## 3. 建你自己的内容仓库

### 方式 A：放在 lightwiki 目录里（最省事）

```bash
cp -r templates/starter sites/my-wiki
yarn wiki dev sites/my-wiki
```

适合先试试。缺点是和工具混在一个仓库里。

### 方式 B：独立仓库（长期用这个）

```bash
cp -r lightwiki/templates/starter ../my-wiki
cd ../my-wiki
git init
```

之后每次构建都要回到 lightwiki 目录、把内容目录作为参数传进去：

```bash
cd ../lightwiki
yarn wiki dev   ../my-wiki
yarn wiki build ../my-wiki
```

> ⚠️ **独立仓库时，`wiki.config.ts` 不要 `import` 类型。**
> 它解析不到 `@lightwiki/schema`（那个包没发布），会直接加载失败。起始模板里用的是纯对象写法，就是为了能搬来搬去。

## 4. 配 `wiki.config.ts`

最小可用：

```ts
export default {
  title: '我的知识库',
  siteUrl: 'https://example.com',
  defaultLanguage: 'zh',
  content: { zh: 'content/zh' },
};
```

全部字段：

| 字段 | 默认 | 说明 |
|---|---|---|
| `title` | **必填** | 站点名，进页面 `<title>` 与侧栏顶部 |
| `siteUrl` | **必填** | 站点完整地址，用于拼接绝对链接 |
| `defaultLanguage` | `zh` | 默认语言。**默认语言的地址不带语言前缀** |
| `content` | **必填** | 语言 → 内容目录，`{ zh: 'content/zh', en: 'content/en' }` |
| `sections` | `[]` | 分组顺序，就是侧栏的顺序；页面 `section` 不在列表里会报错 |
| `sectionLabels` | `{}` | 分组显示名，`{ syntax: '语法' }`；不写就显示 slug |
| `categories` | `{}` | 分类显示名，`{ syntax: '语法' }` |
| `assetsDir` | `assets` | 图片与样式所在目录 |
| `outputDir` | `dist` | 构建输出目录（相对内容根） |
| `basePath` | `/` | 部署基路径。放到 `example.com/wiki/` 就写 `/wiki/` |
| `urlStyle` | `directory` | `directory` → `/docs/a/`；`file` → `/docs/a.html`，且站内链接写成相对路径（给 `file://` 与 CHM 用） |
| `inline` | `false` | 单文件产物：CSS/JS/图片全部塞进页面，产物里只剩 `.html` |
| `theme` | `@lightwiki/theme-default` | 主题包名、git 地址或相对路径 |
| `highlight` | `{ enabled: true, languages: [] }` | 代码高亮；`languages` 里加 highlight.js 的语言名 |
| `markdown` | — | 函数，拿到 markdown-it 实例，见「扩展与样式」 |
| `redirects` | `[]` | 旧地址 → 新地址，`{ from, to, status }` |
| `redirectMode` | `js` | `js` / `server` / `both`，见「命令」里的重定向一节 |

## 5. 什么放哪

| 位置 | 放什么 | 必须吗 |
|---|---|---|
| `wiki.config.ts` | 站点配置 | **必须**，它所在目录就是内容根 |
| `content/<语言>/*.md` | 内容页面 | **必须** |
| `assets/` | 图片、字体、样式表 | 可选 |
| `layouts/*.eta` | 覆盖主题的布局 | 可选 |
| `macros/*.eta` | 内容里 `{{…}}` 调用的宏 | 可选 |

**没有**这些东西：没有 `package.json`（不需要）、没有构建脚本（工具负责）、没有配置文件散落在各处（就一个 `wiki.config.ts`）。

页面文件名的规则：`content/zh/api/v1.md` → slug `api/v1` → `/docs/api/v1/`。**文件名就是身份**，改名等于删一篇加一篇。

### 首页是自动生成的，别叫它 index.md {#home}

`/docs/` 是**目录页**，由工具自动生成（列出所有页面），**不是**某个 `.md` 文件。

所以不要把入口页写成 `index.md` —— 那会得到 `/docs/index/`，和目录页撞名，很难解释。给入口页起个正常名字（`start.md`、`home.md`），它的地址就是 `/docs/start/`。

唯一的例外是 **`404.md`**：slug 为 `404` 的页面会被输出成根目录的 `404.html`，不会生成 `/docs/404/`。

## 6. 本地构建

```bash
yarn wiki check <内容目录>     # 只校验，不写盘
yarn wiki build <内容目录>     # 产出到 <内容目录>/dist
yarn wiki deploy <内容目录>    # 同上，但走「为发布而构建」的入口（目前只输出到本地目录）
```

`build` 产物：

```
dist/
├── index.html                      跳转到默认语言
├── 404.html                        静态托管的 404 页
├── docs/<slug>/index.html          内容页
├── categories/<slug>/index.html    分类页
├── assets/                         图片与编译后的 CSS
└── meta.json                       构建时间与工具信息
```

加 `--inline`（或在配置里写 `inline: true`）会得到**单文件产物**：

```
dist/
├── index.html
├── 404.html
├── docs/<slug>/index.html          <style> 里带着样式，图片换成 data URI
└── categories/<slug>/index.html
```

只剩 `.html`，没有 `assets/` 也没有 `meta.json`，一个页面文件双击就能看。
代价是每页各带一份样式，全站体积随页数线性增长。

`dist/` 是**一组可移植的静态文件**：没有服务器依赖、没有 SPA、没有外部 CDN。扔到任何静态托管、U 盘、光盘镜像里都能用。

构建完会打印页面数、产物体积与形态；有警告会提示用 `check` 看详情。

## 7. 发布

把 `dist/` 交给托管方即可：

| 托管 | 怎么做 |
|---|---|
| GitHub Pages | 上传 `dist/` 作为 artifact 部署；`404.html` 会自动生效 |
| Netlify / Cloudflare Pages | 发布目录填 `dist`；想用真 301 就把 `redirectMode` 设成 `server` |
| 对象存储（S3 / OSS） | 开静态网站模式，错误文档指向 `404.html` |

> **还没有官方的 GitHub Action。** 在那之前，CI 里只能自己 clone 本仓库再构建：
>
> ```yaml
> - run: git clone --depth 1 <本仓库地址> lightwiki
> - run: cd lightwiki && yarn install
> - run: cd lightwiki && yarn wiki build ../my-wiki
> ```
>
> 这个写法能用但不优雅，等工具发布 npm 之后会换成一行 `uses:`。

## 8. 让 AI 帮你

如果用的是能读工作区的 AI（Copilot、Cursor、Codex 等），让它按这个顺序读：

1. **`AGENTS.md`** —— 项目约定与阅读顺序，从这儿开始
2. **`examples/mini/content/zh/*.md`** —— 语法手册的**源文件**（直接读 markdown，不需要构建；产物里的 HTML 反而不好读）
3. **`docs/getting-started.md`** —— 就是这一页，配置与目录约定

要改工具本身（不是内容）才需要读 `ARCHITECTURE.md`。

## 9. 文档地图

| 文件 | 讲什么 | 谁该看 |
|---|---|---|
| `README.md` | 是什么、快速开始 | 所有人 |
| `docs/getting-started.md` | 本文：上手与配置 | 新用户 |
| `examples/mini/` | 语法手册（16 页，用轻维基自己写） | 内容作者 |
| `templates/starter/` | 可复制的起始模板 | 新用户 |
| `AGENTS.md` | AI 的阅读顺序与项目约定 | AI / 贡献者 |
| `ARCHITECTURE.md` | 开发文档：实现规格与改动指引 | 开发者 |

## 10. 卡住了怎么办

- **`yarn wiki build` 说找不到配置** → 内容目录里没有 `wiki.config.ts`，或者目录传错了
- **页面地址不对** → 地址由 slug 推导，没有单独的配置项；非默认语言会带 `/<lang>` 前缀
- **样式没了** → 检查模板里的 CSS 路径是否带 `basePath`；主题样式在 `/assets/theme/`
- **代码块没颜色** → 语言名可能拼错，或不在 `highlight.languages` 里；`xml` 覆盖 html/svg/eta
