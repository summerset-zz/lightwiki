# 起始模板

复制这个目录，就得到一个最小可用的内容仓库。

```
wiki.config.ts        站点配置
content/zh/index.md   第一篇内容
```

## 用法

复制到你自己的目录，然后在这个目录里跑：

```bash
cp -r templates/starter ~/my-wiki
cd ~/my-wiki
npx @lightwiki/cli dev .      # 预览，默认 http://127.0.0.1:5173
npx @lightwiki/cli build .    # 产物在 ./dist
```

> 在 lightwiki 仓库里开发工具时，用 `yarn wiki dev <目录>` 效果一样 —— 跑的是仓库里的源码而不是 npm 上的版本。

## 往里加东西

| 想加什么 | 放哪 |
|---|---|
| 页面 | `content/zh/<slug>.md` |
| 第二种语言 | 建 `content/en/`，然后在配置的 `content` 里加一行 |
| 图片 | `assets/`，正文写 `![说明](/assets/图.png)` |
| 自定义样式 | `assets/*.less` 或 `assets/*.css` |
| 覆盖主题布局 | `layouts/*.eta`（文件名见 `examples/mini` 的布局一页） |
| 自定义宏 | `macros/*.eta` |
