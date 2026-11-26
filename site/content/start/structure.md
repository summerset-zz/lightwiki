---
title: 目录结构
keywords: 目录, 结构, content, assets, layouts, macros, index.md, 内容根, 首页, structure
description: 哪些文件必须有、哪些可选，以及文件名怎么变成地址。
section: start
order: 4
updated: 2026-11-25
draft: false
---

## 初始目录结构 {#tree}

在完成初始模板安装后，你的工作目录会出现如下目录结构：

```
my-wiki/
├── wiki.config.ts                站点配置
├── content/                      内容，一个文件一页
│   └── index.md                  首页，就是 /
├── AGENTS.md                     给 AI 助手的写作说明
├── README.md                     起步说明
├── .github/workflows/pages.yml   推到 main 就构建并发布到 GitHub Pages
├── assets/                       可选：图片、字体、样式表
├── layouts/*.eta                 可选：皮肤
└── macros/*.eta                  可选：模板
```

| 位置                          | 功能                     | 必须吗         |
| ----------------------------- | ------------------------ | -------------- |
| `wiki.config.ts`              | 站点配置                 | **必须**       |
| `content/index.md`            | 首页                     | **必须**       |
| `content/` 下的其他 `.md`     | 一个`md`文件对应一个页面 | 有其他页面时   |
| `assets/`                     | 图片、字体、样式表       | 可选           |
| `layouts/`                    | 皮肤                     | 可选           |
| `macros/`                     | 模板                     | 可选           |
| `AGENTS.md`                   | 给 AI 助手的写作说明     | 可选，模板自带 |
| `.github/workflows/pages.yml` | GitHub Pages 自动构建    | 可选，模板自带 |

### 三个可选目录 {#optional}

| 目录       | 放什么                                               | 不建会怎样       |
| ---------- | ---------------------------------------------------- | ---------------- |
| `assets/`  | 图片、字体、样式表，正文写 `![说明](/assets/图.png)` | 没有图可放       |
| `layouts/` | 皮肤：整页骨架，`doc.eta` 就是一份完整的 HTML        | 用主题自带的皮肤 |
| `macros/`  | 模板：正文里 `{{…}}` 调用的片段                      | 用主题自带的模板 |

如果不创建这三个目录，你的站点将会使用默认皮肤自带的三个目录中的相应资源。

### 添加内容 {#add-content}
在`content/`目录下添加、编辑文档，文件后缀名为`.md`，即可生成对应页面。
- 默认情况下只有 `content/index.md` 一页，他会生成`index.html`，从而成为站点的默认首页。
- 如果再创建一个 `content/start/intro.md`，就多出 `/start/intro/` 这个地址。
- `md`（markdown）是一种简单的、用于直接查看或生成html页面的语法。参考[markdown语法帮助](/basics/markdown)
- `frontmatter`是附加在md文件头部的元数据。轻维基至少需要元数据中包含`title`才会生成页面。参考[frontmatter语法帮助](/basics/frontmatter)。

### 调整模板 {#edit-macro}
在`macros/`目录下添加、编辑模板，文件后缀名为`.eta`。请参考[模板语法帮助](/basics/templates)。
- `eta`是一种扩展html语法，他会在生成页面时通过传入的参数生成markdown片段或html片段。你可以在md文档中以这种方式使用模板：
- `{{模板名}}`
- `{{模板名(参数1,参数2)}}`
- `{{模板名(参数名:参数值)}}`

> 模板的`.eta`文件生成的是<strong>markdown片段</strong>，会被再次解析。


### 自定义皮肤 {#edit-skin}
在`layouts/`目录中编辑皮肤，文件后缀名也是`.eta`。请参考[皮肤语法帮助](/advanced/skins)。
- 皮肤文件也是`eta`格式。与模板不同之处在于他控制的是整个页面的渲染方式。轻维基主站点的首页就是一个独立的皮肤。
- 在`frontmatter`部分指定`layout`以切换该文档使用的皮肤。

> 皮肤的`.eta`文件生成的是<strong>原始html</strong>，不会被markdown解析器解析。

### 管理静态资源 {#edit-assets}
在`assets/`目录里管理静态资源，如图片、额外js脚本、额外css等。请参考[静态资源指南](/basics/assets/)。

### 站点配置 {#edit-config}
在`wiki.config.ts`里调整配置。请参考[调整站点配置](/reference/config/)。
所有的CLI命令都以`wiki.config.ts`为根目录（即命令中的`.`）。

## 站点首页 {#home}

`content/index.md` 就是 `/`。

初始情况下，他是个普通的内容页。我们提供了内置的目录模板：

```md
<!-- 列出所有分类 -->
{{catalog}} 

<!-- 列出section为start的页面 -->
{{pages(section: start)}}
```
内容目录里必须有 `index.md`，缺了首页 `wiki check` 直接报错。

> 如果你想让首页长得跟内容页不一样，可以在`index.md`的frontmatter里指定`layout`参数以选择`skin`目录里另一个模板。

## content目录的子目录 {#subdir}

在`content`目录中创建子目录、并在子目录中维护`md`文件影响的是最终产物的URL。例如：
- `content/start/intro.md`对应`/start/intro/`。多出来的目录只是 URL 里的一段，**不参与分组**：侧栏分到哪一组看 frontmatter 的 `section`。所以 `content/` 下面怎么摆由你决定，按主题分、按年份分都行。

反过来也成立：改文件名就是改地址。已经发出去的链接、别人存的书签都会断。


## 404 页 {#notfound}

根目录的 `404.html` 默认会自动生成.如果你想自己写，可以创建就建 `content/404.md`。
- 该文件的url是`/404.html`，不受slug式导航的影响。

## 再往下 {#next}

- [学习markdown](/basics/markdown)
- [学习frontmatter](/basics/frontmatter)
- [学习模板语法](/basics/templates)
- [学习皮肤语法](/advanced/skins)
