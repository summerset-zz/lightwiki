# @lightwiki/dev

轻维基的本地预览服务器：`node:http` + SSE 热刷新，**不写磁盘**。

**通常不需要单独安装** —— 装 `@lightwiki/cli` 就够了（`wiki dev`）。

```ts
import { loadConfig } from '@lightwiki/core';
import { startDevServer } from '@lightwiki/dev';

const server = await startDevServer(await loadConfig('./my-wiki'));
console.log(server.url);
```

内容、布局、宏文件改动会自动重建并刷新页面；`.less` 请求会即时编译。

## 文档

- [上手指南](https://github.com/summerset-zz/lightwiki/blob/main/docs/getting-started.md)

## 许可

MIT
