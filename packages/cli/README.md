# @lightwiki/cli

轻维基的命令行：把 markdown + frontmatter 编译成一组可移植的静态文件。

```bash
npx @lightwiki/cli dev      # 本地预览，改内容自动刷新
npx @lightwiki/cli check    # 校验 frontmatter、红链、孤页
npx @lightwiki/cli build    # 构建静态站点
npx @lightwiki/cli build .  # 产出到 ./dist
```

参数：`[目录]` 是含 `wiki.config.ts` 的内容仓库根目录，默认当前目录；`-o` 指定输出目录；`--inline` 产出单文件 HTML（样式、脚本、图片全塞进页面）。

```bash
mkdir my-wiki && cd my-wiki
echo "export default { title: '我的知识库', siteUrl: 'https://example.com', content: 'content' }" > wiki.config.ts
npx @lightwiki/cli dev .
```

## 文档

- [上手指南](https://github.com/summerset-zz/lightwiki/blob/main/docs/getting-started.md)
- [语法手册（在线）](https://summerset-zz.github.io/lightwiki/)

## 许可

MIT
