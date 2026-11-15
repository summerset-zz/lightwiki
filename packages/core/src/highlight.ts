import { createRequire } from 'node:module';
import hljs from 'highlight.js/lib/core';
import type { LoadedConfig } from './config.js';

// highlight.js 的语言包是 CJS，且 package.json 对子路径的 ESM 解析不稳。
// 直接用 createRequire 同步加载，既没有 deprecation 警告，也不用担心解析失败。
const requireLang = createRequire(import.meta.url);

/**
 * 内置语言。
 *
 * 只注册这些是为了控制体积——highlight.js 全量语言包接近 1MB，
 * 而文档站真正用得上的就那么几种。要加别的写在配置的 `highlight.languages` 里。
 */
const BUILTIN = [
  'xml',
  'css',
  'javascript',
  'typescript',
  'markdown',
  'json',
  'bash',
  'yaml',
  'diff',
  'less',
  'scss',
  'ini',
  'plaintext',
];

/** 作者可能写别名；也包含那些「没有官方定义、用最接近的语法凑合」的语言 */
const ALIASES: Record<string, string> = {
  html: 'xml',
  svg: 'xml',
  vue: 'xml',
  // Eta 就是 HTML 里嵌 JS 片段，用 xml 的结果比不染色好得多
  eta: 'xml',
  ejs: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  toml: 'ini',
  cfg: 'ini',
  text: 'plaintext',
  txt: 'plaintext',
};

export interface Highlighter {
  enabled: boolean;
  /** 实际注册成功的语言名，用于 `wiki check` 提示 */
  languages: string[];
  /** 返回高亮后的 HTML；返回 null 表示交给 markdown-it 自己转义 */
  highlight(code: string, lang: string): string | null;
}

function loadLanguage(name: string): boolean {
  if (hljs.getLanguage(name)) return true;
  try {
    const definition = requireLang(`highlight.js/lib/languages/${name}`) as unknown;
    hljs.registerLanguage(name, definition as never);
    return true;
  } catch {
    return false;
  }
}

export async function createHighlighter(config: LoadedConfig): Promise<Highlighter> {
  const enabled = config.highlight.enabled;
  const registered = new Set<string>();

  if (enabled) {
    for (const name of BUILTIN) {
      if (loadLanguage(name)) registered.add(name);
    }
    for (const name of config.highlight.languages) {
      const real = ALIASES[name.toLowerCase()] ?? name.toLowerCase();
      if (loadLanguage(real)) registered.add(real);
    }
  }

  return {
    enabled,
    languages: [...registered].sort(),
    highlight(code, lang) {
      if (!enabled || !lang) return null;
      const key = lang.toLowerCase();
      const real = ALIASES[key] ?? key;
      if (!hljs.getLanguage(real)) return null;
      try {
        return hljs.highlight(code, { language: real, ignoreIllegals: true }).value;
      } catch {
        return null;
      }
    },
  };
}
