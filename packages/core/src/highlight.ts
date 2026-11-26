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
 * 标记本身（`<%` / `<%=` / `%>`）用 `beginScope` / `endScope` 单独染成 `hljs-meta`：
 * 它们会落到 xml 子语言里当普通文本，看着和正文一样。注意 hljs 不允许这两个选项
 * 与 `excludeBegin` / `excludeEnd` 同时出现（会直接抛错），所以这里是「不排除 + 单独标注」。
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
      beginScope: 'meta',
      endScope: 'meta',
      subLanguage: 'javascript',
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

/**
 * `const|let|var` 后面紧跟的那个标识符。
 *
 * highlight.js 的 JS 语法**没有「声明名字」这条规则**（它是纯正则，没有作用域概念），
 * 所以 `const look = {}` 里 `look` 是纯文本 —— 这是和 VS Code 观感差得最明显的一处。
 * 用 lookbehind 限定位置，解构（`const {…}` / `const […]`）、字符串与注释里的同名片段
 * 都不会被误伤。
 */
const DECLARED_NAME_RE = /(?<=(?:const|let|var)\s+)[A-Za-z_$][\w$]*/;

/**
 * 重注册一个内置语法，在它的 `contains` 最前面插一条「声明名字」规则。
 *
 * 从语言包重新拿一份**原始定义**再包一层，不要在 `getLanguage()` 拿到的已编译对象上改 ——
 * 那里面是编译过的 mode，再编译一次会重复处理。
 */
function addDeclaredNames(name: string): void {
  try {
    const factory = requireLang(`highlight.js/lib/languages/${name}`) as (
      h: typeof hljs,
    ) => Record<string, unknown>;
    hljs.registerLanguage(name, ((h: typeof hljs) => {
      const base = factory(h);
      const contains = Array.isArray(base.contains) ? base.contains : [];
      return {
        ...base,
        contains: [{ className: 'variable', match: DECLARED_NAME_RE }, ...contains],
      };
    }) as never);
  } catch {
    // 拿不到原始定义就保持原样：只是少一种颜色，不该让高亮整个失效
  }
}

/**
 * markdown 语法的缺口。
 *
 * highlight.js 的 markdown 只认标题、列表、强调、行内代码与链接。我们的正文里
 * 大量在 ```md 块里演示三条**自家**写法 —— 指令注释 `<!-- source: … -->`、
 * 宏调用 `{{catalog}}`、双链 `[[页面]]` —— 原生一条都不匹配，整块看着和纯文本
 * 没区别（`start/structure` 当时就是这个现象）。
 *
 * 和 addDeclaredNames 一样，从语言包重新拿原始定义再包一层。依赖 `xml` 已注册
 * 的是官方定义本身，这里不涉及。
 */
const MARKDOWN_EXTRA_CONTAINS = [
  { className: 'comment', begin: /<!--/, end: /-->/ },
  {
    className: 'template-variable',
    variants: [{ begin: /\{\{/, end: /\}\}/ }, { begin: /\[\[/, end: /\]\]/ }],
  },
];

function addMarkdownExtras(): void {
  try {
    const factory = requireLang('highlight.js/lib/languages/markdown') as (
      h: typeof hljs,
    ) => Record<string, unknown>;
    hljs.registerLanguage('markdown', ((h: typeof hljs) => {
      const base = factory(h);
      const contains = Array.isArray(base.contains) ? base.contains : [];
      return { ...base, contains: [...MARKDOWN_EXTRA_CONTAINS, ...contains] };
    }) as never);
  } catch {
    // 拿不到原始定义就保持原样：只是少两种颜色，不该让高亮整个失效
  }
}

export async function createHighlighter(config: LoadedConfig): Promise<Highlighter> {
  const enabled = config.highlight.enabled;
  const registered = new Set<string>();

  if (enabled) {
    for (const name of BUILTIN) {
      if (loadLanguage(name)) registered.add(name);
    }
    // 声明名字本来不上色，这里给 JS / TS 补上（见 DECLARED_NAME_RE）
    addDeclaredNames('javascript');
    addDeclaredNames('typescript');
    // markdown 块里也要能看出 `{{宏}}` 与 `[[双链]]`，见 MARKDOWN_EXTRA_CONTAINS
    addMarkdownExtras();
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
