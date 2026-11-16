#!/usr/bin/env node
/**
 * 发布后的 `wiki` 入口。
 *
 * 各包的 `exports` 指向 `src/index.ts`（开发期不编译），而 Node 不会对
 * `node_modules` 里的 `.ts` 做类型擦除 —— 所以这里用 tsx 的编程式导入来加载。
 *
 * 不写成 `#!/usr/bin/env -S node --import tsx`：npm 在 Windows 生成的 `.cmd`
 * shim 只取解释器路径，不传附加参数，那样在 Windows 上跑不起来。
 */
import { tsImport } from 'tsx/esm/api';

await tsImport('../src/index.ts', import.meta.url);
