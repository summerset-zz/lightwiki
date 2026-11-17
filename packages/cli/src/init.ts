import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `wiki init`：把随包发布的起始模板落到指定目录。
 *
 * 模板本身是**真实文件**，放在 `packages/cli/templates/starter/`，
 * 一来能直接在编辑器里改，二来它同时就是给人看的参考（模板里的 README 就是新仓库的 README），
 * 不存在「代码里一份、仓库里一份」的漂移。
 *
 * 代价是名字要绕开打包器：npm / yarn 打 tarball 时会跳过 `.gitignore`、`.github` 这类
 * 点开头的路径，所以模板里统一用 `__` 前缀，写到磁盘时再换回来。
 */
const TEMPLATE_DIR = fileURLToPath(new URL('../templates/starter/', import.meta.url));

/** 模板里的名字 → 实际写出的名字（路径的每一段都会过这张表） */
const RENAME: Record<string, string> = {
  __gitignore: '.gitignore',
  __github: '.github',
};

/** 模板里出现的占位符，init 时换成真实的站点名 */
const NAME_PLACEHOLDER = '__SITE_NAME__';

export interface InitOptions {
  /** 站点名；不给就用目录名 */
  name?: string;
  /** 覆盖已存在的文件（默认跳过，不碰用户已有内容） */
  force?: boolean;
}

export interface InitResult {
  dir: string;
  written: string[];
  skipped: string[];
}

/** 站名会进 TS 字符串与 markdown 标题，去掉引号与换行最省事 */
function cleanName(raw: string): string {
  const cleaned = raw.replace(/["'`\\\r\n]/g, '').trim();
  return cleaned.length > 0 ? cleaned : 'My Wiki';
}

interface TemplateFile {
  /** 相对模板根目录的路径 */
  source: string;
  /** 相对目标目录的路径 */
  target: string;
}

/** 目录段也要过一遍改名表 —— `__github/workflows/` 要变成 `.github/workflows/` */
function mapName(segment: string): string {
  return RENAME[segment] ?? segment;
}

function collect(sourceDir = '', targetDir = ''): TemplateFile[] {
  const files: TemplateFile[] = [];
  for (const entry of readdirSync(join(TEMPLATE_DIR, sourceDir), { withFileTypes: true })) {
    const source = sourceDir === '' ? entry.name : `${sourceDir}/${entry.name}`;
    const mapped = mapName(entry.name);
    const target = targetDir === '' ? mapped : `${targetDir}/${mapped}`;

    if (entry.isDirectory()) {
      files.push(...collect(source, target));
      continue;
    }
    files.push({ source, target });
  }
  return files;
}

export function initSite(dir: string, options: InitOptions = {}): InitResult {
  if (!existsSync(TEMPLATE_DIR)) {
    throw new Error(`starter template missing: ${TEMPLATE_DIR} (incomplete install?)`);
  }

  const name = cleanName(options.name ?? dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '');
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of collect()) {
    const destination = join(dir, file.target);
    if (existsSync(destination) && options.force !== true) {
      skipped.push(file.target);
      continue;
    }

    mkdirSync(join(destination, '..'), { recursive: true });
    const content = readFileSync(join(TEMPLATE_DIR, file.source), 'utf8').replaceAll(
      NAME_PLACEHOLDER,
      name,
    );
    writeFileSync(destination, content, 'utf8');
    written.push(file.target);
  }

  return { dir, written, skipped };
}
