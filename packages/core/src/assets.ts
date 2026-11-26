import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import less from 'less';

/** 编译一个 .less 文件，`filename` 用于解析相对的 `@import` */
export async function compileLess(file: string): Promise<string> {
  const source = await readFile(file, 'utf8');
  const result = await less.render(source, { filename: file });
  return result.css;
}

/** 一个待输出的资源文件。`path` 用 posix 分隔符，`.less` 已编译成 `.css`。 */
export interface AssetFile {
  path: string;
  data: Buffer;
}

/**
 * 扫描资源目录，把结果**留在内存里**（不写盘）。
 *
 * 约定：`assets/x/style.less` → `assets/x/style.css`，模板里照常引用 `.css`。
 * 这样用户不需要在模板里区分源文件和产物，也避免产物里混进 `.less`。
 *
 * inline 模式靠它拿到内容做 data URI —— 那条路径下一个字节都不能落盘，
 * 否则「产物里只有 .html」就不成立了。
 */
export async function collectAssets(srcDir: string): Promise<AssetFile[]> {
  if (!existsSync(srcDir)) return [];

  // 以产物路径为键：`x.less` 与 `x.css` 都会落到 `x.css`，所以必须定好谁赢。
  // **`.less` 优先** —— 它是源文件，同名的 `.css` 多半是手写或早先编译留下的旧货。
  // 不能用「后写的覆盖先写的」：那取决于 readdir 的顺序，不同文件系统结果不同。
  const byPath = new Map<string, { data: Buffer; fromLess: boolean }>();

  const put = (path: string, data: Buffer, fromLess: boolean): void => {
    const prev = byPath.get(path);
    if (prev?.fromLess && !fromLess) return;
    byPath.set(path, { data, fromLess });
  };

  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const src = join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(src, rel);
        continue;
      }

      if (entry.name.endsWith('.less')) {
        const css = await compileLess(src);
        put(`${rel.slice(0, -'.less'.length)}.css`, Buffer.from(css, 'utf8'), true);
        continue;
      }

      put(rel, await readFile(src), false);
    }
  };

  await walk(srcDir, '');
  return [...byPath].map(([path, entry]) => ({ path, data: entry.data }));
}

/** 拷贝结果：产物里的资源文件数与总字节数（`.less` 已编译成 `.css`） */
export interface CopiedAssets {
  files: number;
  bytes: number;
}

/** 复制资源目录到产物（非 inline 模式）：`.less` 编译成同名 `.css`，其余原样。 */
export async function copyAssets(srcDir: string, destDir: string): Promise<CopiedAssets> {
  const files = await collectAssets(srcDir);

  let bytes = 0;
  for (const file of files) {
    const target = join(destDir, ...file.path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.data);
    bytes += file.data.length;
  }

  return { files: files.length, bytes };
}
