---
title: 扩展与样式
keywords: less, 样式, 高亮, highlight, 插件, plugin, markdown-it
description: 样式表能不能用 Less、代码块怎么染色、以及怎么往 markdown 管线上加东西。
section: reference
order: 2
updated: 2026-11-15
draft: false
categories: [official]
---

## 样式表可以用 Less {#less}

`assets/` 里的 `.less` 会被编译成同名 `.css`，模板里照常引用 `.css`：

```
assets/theme-extra.less   →   assets/theme-extra.css
```

```less
@radius: 8px;

.note {
  border-radius: @radius;
  p { margin: 0; }      // 嵌套也支持
}
```

产物里**不会出现 `.less` 文件**，所以不用在模板里区分源文件和编译结果。内容仓库的 `assets/` 和主题的 `assets/` 走同一套规则。

`wiki dev` 下请求 `xxx.css` 而只有 `xxx.less` 时会现场编译，所以改 Less 也是热更新的。

## 页面内联 `<style>` 不做 Less 处理 {#inline-style}

正文里写的 `<style>` 会原样输出，里面的内容**不会被 Less 编译**。

这是刻意的：内联样式通常只有几行，收益很低；而在构建期编译用户正文里的代码，行为不可预期（写着一个 CSS 例子，结果被当 Less 编译了）。需要变量和嵌套就放进 `assets/*.less`。

## 代码高亮 {#highlight}

内置这些语言：`xml`（含 html/svg/vue/eta）、`css`、`javascript`、`typescript`、`markdown`、`json`、`bash`、`yaml`、`diff`、`less`、`scss`、`ini`、`plaintext`。

常用别名会自动映射：`js`→javascript、`ts`→typescript、`md`→markdown、`yml`→yaml、`html`→xml、**`eta`→xml**。

要加别的语言，在配置里列 highlight.js 的**语言名**：

```ts
highlight: {
  languages: ['ruby', 'go', 'php'],
},
```

构建时按需加载，不用就不加载。写错的语言名不会报错，只是那个代码块不高亮。

关闭高亮：

```ts
highlight: { enabled: false },
```

配色在主题的 `style.css` 里，用 `--hl-*` 变量定义，跟随亮/暗色自动切换。想换配色就覆盖那些变量。

## markdown 插件钩子 {#markdown}

配置里可以拿到 markdown-it 实例：

```ts
import myPlugin from 'markdown-it-my-plugin';

export default {
  // ...
  markdown(md) {
    md.use(myPlugin, { /* 选项 */ });
  },
};
```

钩子在所有内置规则（锚点、双链、宏、链接改写）**之后**执行，所以你加的插件能覆盖前面的行为。

注意：`md` 的类型是 `unknown`，需要自己 `import type MarkdownIt from 'markdown-it'` 后断言。

## 布局覆盖 {#layouts}

样式之外还能换整页结构，见 [[layouts]]。
