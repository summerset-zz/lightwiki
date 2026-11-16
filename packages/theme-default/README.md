# @lightwiki/theme-default

轻维基的默认主题：布局（Eta）、样式、站内搜索与「查看源码」面板。

由 `@lightwiki/core` 作为依赖引入，**一般不用手动安装**。

## 覆盖而不 fork

主题是可以升级的：只在内容仓库里放你要改的那几个文件，其余跟随主题。

```
my-wiki/
└── layouts/
    └── doc.eta        # 只覆盖内容页布局，其它布局仍用主题的
```

查找顺序是「内容仓库 → 主题包 → 报错」。想看某个布局现在长什么样，直接读 `layouts/*.eta`。

## 布局

| 名字 | 用于 |
|---|---|
| `doc` | 内容页 |
| `index` | 目录页 |
| `category` | 分类页 |
| `not-found` | 没有 `404.md` 时的兜底 |
| `redirect` | 重定向跳转页 |

`assets/search.js` 是搜索框的行为（打分、键盘、跳转），UI 结构在布局里 —— 想改长相改布局与 `style.css`，想改匹配策略改这个脚本。

## 文档

- [上手指南](https://github.com/summerset-zz/lightwiki/blob/main/docs/getting-started.md)
- [语法手册（在线）](https://summerset-zz.github.io/lightwiki/)

## 许可

MIT
