# 起始模板

复制这个目录，就得到一个最小可用的内容仓库。

```
wiki.config.ts        站点配置
content/zh/index.md   第一篇内容
```

## 用法

```bash
# 复制到别处
cp -r templates/starter ~/my-wiki

# 在 lightwiki 仓库里构建它
yarn wiki dev   ~/my-wiki
yarn wiki build ~/my-wiki -o ~/my-wiki/dist
```

也可以直接原地试：

```bash
yarn wiki dev templates/starter
```

## 往里加东西

| 想加什么 | 放哪 |
|---|---|
| 页面 | `content/zh/<slug>.md` |
| 第二种语言 | 建 `content/en/`，然后在配置的 `content` 里加一行 |
| 图片 | `assets/`，正文写 `![说明](/assets/图.png)` |
| 自定义样式 | `assets/*.less` 或 `assets/*.css` |
| 覆盖主题布局 | `layouts/*.eta`（文件名见 `examples/mini` 的布局一页） |
| 自定义宏 | `macros/*.eta` |
