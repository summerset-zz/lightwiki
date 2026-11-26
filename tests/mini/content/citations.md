---
title: 引用
keywords: 引用, citation, ref, references, 参考文献, 上标, name
description: ref 与 references 标签的编号、复用与插入位置，以及几种不生效的写法。
section: syntax
order: 10
updated: 2026-11-26
draft: false
categories: [syntax]
---

正文里写 `<ref>内容</ref>`，当前位置出一个上标，内容排进参考文献列表。列表位置由单独一行的 `<references/>` 决定，不写就排到正文末尾。

## 基本引用 {#basic}

```md
轻维基把正文编译成一组静态文件<ref>编译与产物的关系见别页说明。</ref>。
```

效果：轻维基把正文编译成一组静态文件<ref>编译与产物的关系见别页说明。</ref>。

## name 复用 {#reuse}

```md
<ref name="spec">CommonMark 是 markdown 的公开规范。</ref>后面复用一次<ref name="spec" />。
```

效果：<ref name="spec">CommonMark 是 markdown 的公开规范。</ref>后面复用一次<ref name="spec" />。

两条同号，列表里只有一条，它的 `count` 是 2。自闭合的那条不带内容，只出上标。

## 引用里的双链 {#wikilink}

```md
<ref>目标页是 [[macros]]，带显示文字的写法见 [[links|链接]]。</ref>
```

效果：<ref>目标页是 [[macros]]，带显示文字的写法见 [[links|链接]]。</ref>

引用内容按行内 markdown 解析，双链、普通链接、行内代码都能用。链接照常进链接图，死链照样被标出来。这一页不摆真死链。

## 表格单元格里 {#table}

表格单元格里也能写，编号与段落里的引用共用一套：

| 位置 | 写法与效果 |
|---|---|
| 段落 | 见上一节 |
| 表格单元格 | `<ref>表格里的引用。</ref>`<ref>表格里的引用。</ref> |

## 指定插入位置 {#position}

单独一行写 `<references/>`：

```md
<references/>
```

本页把标记放在这里，所以上面几条都排到下面。标记之后才出现的引用也归到同一个列表，编号仍按首次出现的顺序。

不写标记时会怎样，见 [引用·末尾回退](/citations-tail)。

<references/>

## 未闭合 {#unclosed}

```md
没有闭合的 <ref>这一句不会变成引用
```

没闭合的标签不会被当成引用，后面的文字照常显示，标签原样留在产物里：没有闭合的 <ref>这一句不会变成引用

## 嵌套 {#nested}

```md
<ref>外层<ref>内层</ref></ref>
```

内层标签被摘掉，只得到一条内容为 `外层内层` 的引用。它排在标记处，也就是本节上方：

<ref>外层<ref>内层</ref></ref>

## 空标签 {#empty}

```md
<ref />
```

不带 `name` 的自闭合标签不生效，标签原样留在产物里：<ref />

## 各种写法对照 {#summary}

| 写法 | 结果 |
|---|---|
| `<ref>内容</ref>` | 上标，新增一条列表项 |
| `<ref name="x">内容</ref>` | 命名定义，编号按首次出现 |
| `<ref name="x" />` | 复用同号，不新增列表项 |
| `<ref />` | 不生效，标签原样留在产物里 |
| 未闭合 `<ref>` | 不生效，标签原样留在产物里 |
| 嵌套 `<ref>` | 内层标签摘掉，内容合并 |
| `<references/>` | 列表插在此处；缺省排到正文末尾 |
