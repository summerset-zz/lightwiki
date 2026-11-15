import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import less from 'less';

/** 编译一个 .less 文件，`filename` 用于解析相对的 `@import` */
export async function compileLess(file: string): Promise<string> {
  const source = await readFile(file, 'utf8');
  const result = await less.render(source, { filename: file });
  return result.css;
}

/**
 * 复制资源目录，顺便把 `.less` 编译成同名 `.css`。
 *
 * 约定：`assets/x/style.less` → `assets/x/style.css`，模板里照常引用 `.css`。
 * 这样用户不需要在模板里区分源文件和产物，也避免产物里混进 `.less`。
 */
export async function copyAssets(srcDir: string, destDir: string): Promise<number> {
  if (!existsSync(srcDir)) return 0;

  let count = 0;
  const walk = async (dir: string, out: string): Promise<void> => {
    await mkdir(out, { recursive: true });
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const src = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(src, join(out, entry.name));
        continue;
      }

      if (entry.name.endsWith('.less')) {
        const css = await compileLess(src);
        await writeFile(join(out, `${entry.name.slice(0, -'.less'.length)}.css`), css, 'utf8');
        count += 1;
        continue;
      }

      await cp(src, join(out, entry.name));
      count += 1;
    }
  };

  await walk(srcDir, destDir);
  return count;
}
