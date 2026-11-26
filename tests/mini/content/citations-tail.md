---
title: 引用·末尾回退
keywords: 引用, citation, ref, references, 文末
description: 页面里不写 references 标记时，参考文献列表自动排到正文末尾。
section: syntax
order: 11
updated: 2026-11-26
draft: false
categories: [syntax]
---

这一页**不写** `<references/>`，用来验证列表会自己排到正文末尾。

第一条引用<ref>没有标记时，列表排到正文末尾。</ref>，第二条<ref name="tail">带名字的那条，`count` 为 2。</ref>，再复用一次<ref name="tail" />。

## 最后一段 {#last}

列表应该出现在这一段之后，而不是插在中间。
