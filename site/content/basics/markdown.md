---
title: Markdown 与扩展语法
keywords: markdown, 语法, 双链, wikilink, 红链, redlink, 锚点, anchor, 行内 HTML, html, 属性, attrs
description: 正文就是标准 markdown，在此之上还有双链、红链判定、显式锚点、行内 HTML、给元素加 class，以及两条写在注释里的指令。
section: basics
order: 1
updated: 2026-11-25
draft: false
---

轻维基的`md`文件是一个包含`frontmatter`文件头的markdown文件。
- `frontmatter`是文件开头、由一组`---`包围的`yaml`格式内容，用来定义这一段是什么、搜索关键词、描述和出现在边栏中的类别和顺序等。详情请阅读[frontmatter语法](/basics/frontmatter)。
- frontmatter之后是markdown正文。我们使用的是标准的CommonMark语法 + markdown-it-attrs的扩展语法。本文将着重介绍markdown部分。

## 什么是markdown {#whatismd}
<strong>markdown</strong>是一种易于阅读和撰写的文本格式，它的优势主要有以下两点：
- 写作者不需要理解`html`，不需要理解标签、闭合等概念，已于排版、且专注于内容本身。
- 原始内容也具有足够的可读性。

我们在此列举一些常见的markdown语法：
- 段落：连续两个回车，生成html的`<p>`标签。
- 标题：行首的一个或多个`#`。`#`越多则目录层级越深。生成html的`<h1>~<h6>`标签。
- 链接：`[显示文本](链接)`。生成html的`<a>`标签。
- 图片：`![图片占位文本](图片资源地址)`。生成html的`<img>`标签，占位文本会成为`<img>`标签的`alt`属性。
- 列表：在行首使用`-``*`等符号生成无序列表(html`ul`)，`1.``a.`等符号生成有序列表(html`ol`)，标签后加一个空格。列表前使用`tab`表示层级关系。
- 引用块：在行首使用`>`后跟一个空格表示引用块。
- 行内代码：使用一对反引号 `` ` `` 包裹代码，生成html`<code>`标签。
- 代码块：在行首使用三个反引号 ```` ``` ````，换行，写上内容，再换行加三个反引号。生成html`<pre>`标签。

````md
#### 四个井号的标题
我是第一段文字。

我是第二段文字，我还有一个[指向markdown官网的链接](https://markdown.org/)。

这里，我引用了一个指向`assets/md-favicon.png`的图片：![就是这张](/assets/md-favicon.png)

- 列表项1里再插一张图，但只有24px大：![就是这张](/assets/md-favicon.png){width=24}
- 列表项2
  1. 二级列表1
  2. 二级列表2
- 回到一级列表

> 这是一个blockquote。
>
> 而这是blockquote的第二行。

```html
<div>而这是一个html代码围栏。</div>
```

````
<div class="md-render-example" data-no-toc>

#### 四个井号的标题
我是第一段文字。

我是第二段文字，我还有一个[指向markdown官网的链接](https://markdown.org/)。

这里，我引用了一个指向`assets/md-favicon.png`的图片：![就是这张](/assets/md-favicon.png)

- 列表项1里再插一张图，但只有24px大：![就是这张](/assets/md-favicon.png){width=24}
- 列表项2
  1. 二级列表1
  2. 二级列表2
- 回到一级列表

> 这是一个blockquote。
>
> 而这是blockquote的第二行。

```html
<div>而这是一个html代码围栏。</div>
```

</div>



## 特有语法和限制 {#lightwiki-excluded}

在上文中，除了`![就是这张](/assets/md-favicon.png){width=24}`这种给图片加其他属性的语法属于`markdown-it-attrs`之外，使用的都是标准CommonMark语法。本章会介绍轻维基和`markdown-it-attrs`的额外支持和限制。

### 显式锚点 {#anchors}
在标题语法后空格、并增加`{#anchorname}`可以为这一节增加一个锚点。锚点可以使页面被访问时自动滚动到这一节，该功能由`markdown-it-attrs`提供。

例如，本小节的标题是这么写的：
```md
### 标题的anchor {#anchor}
```
当你点击右侧目录中本小节标题时，浏览器的标题栏会变为：
```
.../basics/markdown/#anchor
```
复制该地址，下次再访问时就会自动跳转到本小节。
- 鼠标悬停时，标题后会出现一个`#`，点击这个符号也会更新标题栏中的锚点。
- 如果不写显式锚点，这个符号就不会出现。

### 内链 {#interlink}
markdown本身支持内链，所以这不算轻维基的独有功能；但轻维基将根据配置预判编译后的内链可到达性。因此，我们约定：
- 内链以`/`开头（html标准，代表编译后从域名后出发）
- 内链的根目录即为`content`目录（或你在wiki.config.ts中指定的其他目录）。

以本页为例，本页相对于`content`目录的文件为`/basics/markdown.md`，所以指向本页的内链应当写作`[显示文本](/basics/markdown)`，效果：[显示文本](/basics/markdown)。

> 你也可以使用`./`或`../`来表示<strong>相对路径</strong>。但其行为与配置中的`urlStyle`相关，所以不建议使用。

> 如果你希望部署后的链接不从域名根开始（比如`https://mysite.com/doc/`），则可以在wiki.config.ts中配置`basePath`，内链书写方式不变。basePath会在编译时自动加上。

### mediawiki式内链 {#wikilink}
如果你之前对mediawiki的语法（`wikitext`）比较熟悉，你也可以使用双方括号的方式处理内链。内链的目标可以是页面标题或者slug。例如：
- 按 slug：`[[start/structure]]`。slug就是相对于`content`目录的文件路径，并去掉扩展名`.md`。
- 按标题：`[[目录结构]]`。标题是在`md`文件的`frontmatter`中定义的。
- 带显示文字：`[[start/structure|看目录]]`
- 带锚点：`[[basics/frontmatter#fields]]`

编译器在判断时，会优先按slug判断：如果对应的文件不存在，才会按照标题来处理。如果仍找不到，轻维基会将其视为一个<strong>死链</strong>。

### 死链检查 {#redlink}

在编译阶段（包括开发服务器运行中），轻维基会对链接进行检查，并提前告知潜在的死链。具体情况如下：

- 对于markdown源生链接 `[文本](slug)`，仅在slug指向站内时：
  - 如果`slug`无匹配文本，则输出为一个带有`class="redlink"`的链接。默认皮肤中显示为红色。
- 对于mediawiki式链接 `[[标题|外显文本]]`：
  - 如果`标题`不存在，则输出一个带有`class="wikilink-missing"`的`span`标签（不可点），默认皮肤中显示为带有点的下划线。

两种情况均会在`wiki check`阶段报警，但不会阻止编译。

此外，以下情况会跳过死链检查：
| 链接写法                                               | 为什么会跳过               |
| ------------------------------------------------------ | -------------------------- |
| 仅包含`#anchor`、`?queryparam=value`                   | 指向的是当前页             |
| `https://…`、`mailto:`                                 | 站外地址，无法确认可到达性 |
| 结尾带有扩展名 `/x.css`、`/x.png`                      | 指向的是静态文件           |
| 配置为`urlStyle: 'file'` 时，后缀名不为 `.html` 的路径 | 视为静态文件               |

## 外链 {#external-link}

外链可以用标准markdown链接（如`[显示文本](https://example.com)`）、尖括号链接（如`<https://example.com>`）实现。正文中的裸写地址（如直接写https://example.com）不会被识别为链接。这可能与你的IDE的语言服务不一致。


## 直接写HTML {#html}

在正文中直接写html标签会被原样保留。如果你碰到了markdown无法实现的排版样式时可以使用此方案。例如以下代码会直接绘制svg图形：

```html
<figure style="margin: 1.75rem 0">
  <svg viewBox="0 0 240 64" width="100%" role="img" aria-label="三段文字共用一条基线">
    <text x="4" y="34" font-size="20" fill="currentColor">Aa</text>
    <text x="64" y="34" font-size="20" font-family="serif" fill="currentColor">Aa</text>
    <text x="124" y="34" font-size="20" font-style="italic" fill="currentColor">Aa</text>
    <line x1="4" y1="38" x2="236" y2="38" stroke="currentColor" stroke-dasharray="4 4" />
  </svg>
</figure>
```
<figure style="margin: 1.75rem 0">
  <svg viewBox="0 0 240 64" width="100%" role="img" aria-label="三段文字共用一条基线">
    <text x="4" y="34" font-size="20" fill="currentColor">Aa</text>
    <text x="64" y="34" font-size="20" font-family="serif" fill="currentColor">Aa</text>
    <text x="124" y="34" font-size="20" font-style="italic" fill="currentColor">Aa</text>
    <line x1="4" y1="38" x2="236" y2="38" stroke="currentColor" stroke-dasharray="4 4" />
  </svg>
</figure>

请注意。如果你在html内写了markdown，则这一部分markdown也会被解析。

```md
<div class="md-render-example" data-no-toc>

#### 虚假的标题
虚假的内容
</div>
```
<div class="md-render-example" data-no-toc>

#### 虚假的标题
虚假的内容
</div>
不加`data-no-toc`的情况下，html内的标题会被右侧TOC收录。

## markdown-it-attrs {#attrs}
本节的功能由[markdown-it-attrs](https://www.npmjs.com/package/markdown-it-attrs)插件提供。

你可以在markdown标记结尾增加花括号、并在花括号中添加`attr`和`class`等属性。我们之前用到的[显式锚点](#anchors)功能也是由此插件提供的。例如：
````md
## 标题 {.h2-class}
段落 {data-toggle=modal}
<!-- 这一段会输出为 -->
<h1 class="h2-class">标题</h1>
<p data-toggle="modal">段落</p>

<!-- 对于一些行内标记也有效-->
普通文本，*我是em标签*{.red}普通文本
<!-- 这一段会输出为 -->
<p>普通文本，<em class="red">我是em标签</em>普通文本</p>

<!-- 对于代码围栏也有效-->
```python {data=asdf}
nums = [x for x in range(10)]
```
<!-- 代码围栏会被解析为-->
<pre data="asdf"><code class="language-python">nums = [x for x in range(10)]
</code></pre>
````




## 页面身份是文件名 {#next}

一页的地址来自文件名，不是标题。`content/basics/markdown.md` 就是 `/basics/markdown/`，标题只出现在导航、搜索和双链里。改文件名等于换地址，外部链接和双链都会断。

目录怎么摆、首页是哪一页，见 [目录结构](/start/structure)。开头那段 YAML 写什么，见 [frontmatter](/basics/frontmatter)。

正文里想插入一段由站内数据算出来的列表或表格，那是另一套机制，见 [模板](/basics/templates)。代码块怎么上色、支持哪些语言，见 [代码高亮](/advanced/code-highlight)。
