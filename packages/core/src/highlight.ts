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

/**
 * `eta` 的自定义定义。
 *
 * highlight.js 没有 Eta。最接近的是 `erb`（同样是 HTML 里夹 `<% %>`），但它只声明了
 * `subLanguage: 'ruby'` —— 没注册 ruby 时那段完全不工作，实测还不如直接用 xml。
 *
 * 所以自己写一个：整块按 HTML 走，`<% ... %>` 里按 JS 走。实测收益：
 * 纯逻辑块从「只剩 tag/name 两类」变成「keyword/property/tag/name 四类」，
 * `<%# 注释 %>` 也有了颜色。
 *
 * 依赖 `xml` 与 `javascript` 已注册，所以必须在 BUILTIN 之后注册。
 */
const ETA_DEFINITION = (h: typeof hljs) => ({
  name: 'Eta',
  subLanguage: 'xml',
  contains: [
    h.COMMENT('<%#', '%>'),
    {
      begin: /<%[%~=-]?/,
      end: /[-%]?%>/,
      subLanguage: 'javascript',
      excludeBegin: true,
      excludeEnd: true,
    },
  ],
});

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
    // 排在 BUILTIN 之后：它把 `<% %>` 内部交给 javascript、其余交给 xml
    hljs.registerLanguage('eta', ETA_DEFINITION as never);
    registered.add('eta');

    for (const name of config.highlight.languages) {
      const key = name.toLowerCase();
      // 先当真名试：配 `vue` 就该用官方的 vue 定义，而不是别名表里的 xml
      if (loadLanguage(key)) {
        registered.add(key);
        continue;
      }
      const real = ALIASES[key] ?? key;
      if (loadLanguage(real)) registered.add(real);
    }
  }

  return {
    enabled,
    languages: [...registered].sort(),
    highlight(code, lang) {
      if (!enabled || !lang) return null;
      const key = lang.toLowerCase();
      // 真名优先：注册过 vue 就用 vue，没注册过才退回 xml
      const real = hljs.getLanguage(key) ? key : (ALIASES[key] ?? key);
      if (!hljs.getLanguage(real)) return null;
      try {
        return hljs.highlight(code, { language: real, ignoreIllegals: true }).value;
      } catch {
        return null;
      }
    },
  };
}
