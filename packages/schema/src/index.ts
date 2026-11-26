import { z } from 'zod';

/**
 * 日期只接受 YYYY-MM-DD。
 * 理由：它同时用于页面上的「最后更新」与 sitemap 的 <lastmod>，
 * 一旦混入 `2026/11/7` 这类写法，两种输出都会坏掉。
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD, e.g. 2026-11-15');

/**
 * 修订号写成字符串最稳（前导零不会丢），但 YAML 里不写引号就会变成数字。
 * 两者都收，统一成字符串。
 */
const revid = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+$/.test(value), 'digits only');

/** keywords 允许写成逗号分隔的字符串（既有内容的习惯），也允许写成数组。 */
const keywords = z.union([z.string(), z.array(z.string())]);

/**
 * 页面 frontmatter。
 *
 * 设计要点：
 * - 用 passthrough 放行未知字段。内容仓库与工具版本会脱钩，
 *   多一个我们不认识的键不该让整站构建失败 —— 校验未知字段是 lint 的事，不是 schema 的事。
 * - 来源/许可是**整篇改编**时使用的一组扁平键（对齐既有的 AUTHORING 约定），
 *   只借某几节时改用正文里的 `<!-- source: ... -->`。
 * - 不做枚举限制 section：站点在自己配置里声明可选值，core 负责比对。
 */
export const frontmatterSchema = z
  .object({
    // —— 内容 ——
    title: z.string().min(1, 'title must not be empty'),
    description: z.string().optional(),
    keywords: keywords.optional(),
    section: z.string().optional(),
    order: z.coerce.number().int().optional(),
    updated: isoDate.optional(),
    draft: z.boolean().default(false),

    /**
     * 这一页用哪个布局（`layouts/<name>.eta`，不写就是 `doc`）。
     *
     * 布局名只能是一段文件名（字母数字与 `._-`），不能带路径 —— 否则内容
     * 就能把模板解析到仓库外面去。文件不存在时构建直接报错，`wiki check` 会先点名。
     */
    layout: z
      .string()
      .regex(/^[A-Za-z0-9._-]+$/, 'layout must be a single file name, e.g. landing')
      .optional(),

    /**
     * 这一页额外引入的样式表 / 脚本，按顺序注入 `<head>` 与 `</body>` 前。
     *
     * 路径相对 `assets/`（也可以写成 `/assets/...`）。**一律写 `.css`**：
     * 与 assets 目录的约定一致 —— `hero.less` 会被编译成 `hero.css`，产物里只有后者。
     * 文件不存在时 `wiki check` 会报错（构建会跳过并警告，不会让整页挂掉）。
     */
    styles: z.union([z.string(), z.array(z.string())]).optional(),
    /**
     * 脚本。每条可以是一个路径，也可以写成 `{ src, module }`。
     *
     * `module: true` 会注入 `<script type="module">`（不加 defer —— module 本来就是延迟执行的）。
     * 两种写法可以混用，所以只在个别脚本需要 ESM 时不必把整页都换成模块。
     */
    scripts: z
      .union([
        z.string(),
        z.object({ src: z.string().min(1, 'src must not be empty'), module: z.boolean().default(false) }),
        z.array(
          z.union([
            z.string(),
            z.object({ src: z.string().min(1, 'src must not be empty'), module: z.boolean().default(false) }),
          ]),
        ),
      ])
      .optional(),

    /**
     * 分类的键是 ASCII slug，显示名放站点配置的 `categories` 里。
     * 理由是 URL 要稳定、要能翻译。
     */
    categories: z.union([z.string(), z.array(z.string())]).optional(),
    /** 用哪个分类的页面列表充当侧栏；不填则用全站导航 */
    sidebarCategory: z.string().optional(),

    // —— 整篇改编的来源 ——
    sourceSite: z.string().optional(),
    sourceTitle: z.string().optional(),
    sourceUrl: z.string().url('sourceUrl must be a full URL').optional(),
    sourceRevid: revid.optional(),
    sourceLicense: z.string().optional(),
    sourceLicenseUrl: z.string().url('sourceLicenseUrl must be a full URL').optional(),
    sourceChanges: z.string().optional(),

    // —— 站点自有内容的许可 ——
    license: z.string().optional(),
    licenseUrl: z.string().url('licenseUrl must be a full URL').optional(),
    authors: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

export type Frontmatter = z.infer<typeof frontmatterSchema>;

/** 未定义模板的替换函数：拿到模板名与原始写法，返回替换后的文本 */
export type UndefinedMacroHandler = (name: string, raw: string) => string;

/**
 * 未定义的宏怎么处理。
 *
 * 内容仓库经常是「从别处搬来的」—— 原来的宏没跟着搬过来。默认保留原文（显眼，
 * 一眼能看出漏了什么）；不想在产物里露出花括号就换成 `'hide'`，或者给个函数自己决定。
 * 三种选择都不影响构建成功，但都会在构建输出里报一条提示。
 */
const undefinedMacroHandler = z.union([
  z.enum(['show', 'hide']),
  z.custom<UndefinedMacroHandler>((value) => typeof value === 'function', {
    message: 'macros.undefined must be show / hide, or a function (name, raw) => string',
  }),
]);

export const siteConfigSchema = z.object({
  /** 站点名，进 `<title>`、侧栏顶部与导航 brand */
  title: z.string().min(1),
  /** 完整站点地址。canonical、重定向页的绝对地址、站外链接判定都用它 */
  siteUrl: z.string().url('siteUrl must be a full URL'),
  /** 部署前缀。`/` 与空串视为无前缀，其余规范成 `/sub`（补前导斜杠、去末尾斜杠） */
  basePath: z.string().default('/'),
  /**
   * 语言代码，只用于 `<html lang>` 与模板里的 `it.page.lang`。
   * 不参与路由：想让 URL 带语言段，用 `urlPrefix`。
   */
  lang: z.string().min(1).default('zh'),
  /** 内容目录（相对内容根目录）。整个站只有这一处内容 */
  content: z.string().min(1),
  /**
   * URL 前缀，可空。
   *
   * - `''`（默认）→ `/关于/`
   * - `'zh'` → `/zh/关于/`
   *
   * 多语言站就是每门语言一份配置、各自跑一次构建（`--config`）。
   */
  urlPrefix: z
    .string()
    .regex(/^[A-Za-z0-9_-]*$/, 'urlPrefix must be a single name (letters, digits, _ or -); leave empty for no prefix')
    .default(''),
  /** 资源来源目录。只影响「从哪读」，产物里固定落在 `assets/` */
  assetsDir: z.string().default('assets'),
  /** 内容里允许出现的 section 取值与顺序；留空则不校验 */
  sections: z.array(z.string()).default([]),
  /** section slug -> display name; undeclared ones fall back to the slug */
  sectionLabels: z.record(z.string(), z.string()).default({}),
  /** 分类 slug → 显示名。未声明的分类用 slug 当显示名 */
  categories: z.record(z.string(), z.string()).default({}),
  /**
   * 主题包名，或主题目录。`./` 开头与绝对路径按目录解析，其余按包名解析；
   * 都解析不到时**静默回落到内置主题**（不报错），所以写错路径的表现是「样式没变」。
   */
  theme: z.string().default('@lightwiki/theme-default'),
  /** 构建输出目录（相对内容根）。每次构建前整个清空 */
  outputDir: z.string().default('dist'),

  /** 宏相关的行为开关 */
  macros: z
    .object({
      /** 未定义的宏：`show`（默认，保留原文）/ `hide`（删掉）/ 自定义函数 */
      undefined: undefinedMacroHandler.optional(),
    })
    .default({}),

  /**
   * 内容页的额外路径前缀。
   *
   * - `''`（默认）→ `/关于/`，页面直接挂在站点根（或 `urlPrefix`）下
   * - `'docs'` → `/docs/关于/`
   * - `'wiki'` → `/wiki/关于/`
   *
   * 只接受一段名字（允许空串）：带了斜杠等于把内容塞进子目录，那是另一件事。
   * 空串时会和 `assets/`、`categories/` 这些保留段抢位置（`check` 会点名同名页面）。
   */
  docsDir: z
    .string()
    .regex(/^[A-Za-z0-9_-]*$/, 'docsDir must be a single name (letters, digits, _ or -); leave empty for pages at the site root')
    .default(''),
  /**
   * 链接形态。directory 适合托管站（a/b/），file 适合 file:// 与 CHM（a/b.html）。
   */
  urlStyle: z.enum(['directory', 'file']).default('directory'),

  /**
   * 单文件产物：CSS / JS / 图片全部塞进页面，产物里只剩 `.html`。
   *
   * 用于「一个文件就能看」的场景（分享单页、邮件附件、打包成 CHM）；
   * 代价是每页都带一份样式，全站体积随页数线性增长。
   */
  inline: z.boolean().default(false),

  /**
   * 旧地址 → 新地址。`from` / `to` 都写**最终 URL**（含 `basePath` 与 `urlPrefix`），工具不做推断。
   *
   * 默认生成 JS 跳转页，因为用户可能只有 GitHub Pages 这类没有服务端的托管；
   * 换成 `server` 则输出 Netlify / Cloudflare Pages 认的 `_redirects`（真 301）。
   */
  redirects: z
    .array(
      z.object({
        from: z.string().min(1, 'from must not be empty'),
        to: z.string().min(1, 'to must not be empty'),
        status: z.number().int().default(301),
      }),
    )
    .default([]),
  /**
   * 重定向产物形态：`js` 生成 HTML 跳转页（没有服务端的托管用）、
   * `server` 只输出 `_redirects`（Netlify / Cloudflare Pages 认的真 301）、`both` 都做。
   */
  redirectMode: z.enum(['js', 'server', 'both']).default('js'),

  /**
   * 代码块高亮。
   *
   * 内置一批常用语言；要加别的就在 `languages` 里列 highlight.js 的语言名
   * （如 `ruby`、`go`、`php`），构建时会按需加载。
   */
  highlight: z
    .object({
      enabled: z.boolean().default(true),
      languages: z.array(z.string()).default([]),
    })
    .default({ enabled: true, languages: [] }),

  /**
   * 站内搜索。工具只负责**生成索引**（`search-index.json`，或内联进页面）；
   * 搜索框、结果列表、跳转都在主题里 —— 那是 UI，不是数据。
   *
   * file 模式与 inline 模式下索引会自动内联（`file://` 下 fetch 不到 json）。
   */
  search: z
    .object({
      enabled: z.boolean().default(true),
      /** 每页索引里保留的正文摘要长度（字符）；0 表示只要标题 */
      excerpt: z.number().int().min(0).default(300),
    })
    .default({ enabled: true, excerpt: 300 }),

  /**
   * 把当前页的元数据以 JSON 注入 HTML，供页面里的 JS 读取。
   *
   * 注入的是模板里 `it.page` 那一份（`slug` / `url` / `lang` / 归一化后的
   * `keywords`、`categories`，以及 `frontmatter` 原对象），只去掉整篇原文 `markdown`。
   * 放进 `<script type="application/json" id="lightwiki-page-data">`，走 HTML 后处理，
   * 所以覆盖过皮肤也会生效。
   *
   * 默认关闭：它会把每页的 frontmatter 交给浏览器，不需要就别开。
   */
  frontmatterInjection: z.boolean().default(false),

  /**
   * 站点级 markdown-it 插件入口。
   *
   * ```ts
   * markdown(md) { md.use(myPlugin, { ... }) }
   * ```
   */
  markdown: z
    .custom<MarkdownSetup>(
      (value) => value === undefined || typeof value === 'function',
      'markdown must be a function',
    )
    .optional(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

/**
 * 用户写在 `wiki.config.ts` 里的形状。
 *
 * 为什么手写而不是 `z.input<typeof siteConfigSchema>`：zod 推导出来的是映射类型，
 * schema 字段上的 JSDoc **不会**带过去（实测 `getDocumentationComment()` 全空），
 * 用户在配置里悬停时什么说明也看不到。所以「给人读的」写在这里，
 * 「给机器验的」仍然是 `siteConfigSchema`。
 *
 * 两份不许漂移：文件末尾那条 `assertConfigInput` 断言把它和 `z.input` 逐字段比对，
 * 少一个字段、多一个必填，`yarn type:check` 当场失败。
 */
export interface SiteConfigInput {
  /** 站点名。进 `<title>`、侧栏顶部与导航 brand，必填且非空 */
  title: string;

  /**
   * 站点完整地址，必须带协议（写成 `example.com` 会被拦）。
   * 用于 canonical、重定向页的绝对地址、`it.site.siteUrl` 与站外链接判定。
   */
  siteUrl: string;

  /**
   * 部署前缀。`'/'` 与 `''` 都表示无前缀，其余规范成 `'/sub'`。
   * GitHub Pages 项目站要写 `'/仓库名'`；和实际部署位置对不上时，链接与资源全部 404。
   */
  basePath?: string;

  /**
   * 语言代码，只用于 `<html lang>` 与模板里的 `it.page.lang`。
   * 不参与路由 —— 想让 URL 带语言段就设 `urlPrefix`。
   */
  lang?: string;

  /**
   * 内容目录（相对内容根），整个站只有这一处。
   * 目录里必须有 `index.md`（它就是首页），缺了 `wiki check` 判失败。
   */
  content: string;

  /**
   * URL 前缀，可空。`''`（默认）→ `/关于/`；`'zh'` → `/zh/关于/`。
   * 多语言站就是每门语言一份配置、各自跑一次构建。
   */
  urlPrefix?: string;

  /** 静态资源目录名（相对内容根）。只改「从哪读」，产物里固定落在 `assets/` */
  assetsDir?: string;

  /**
   * 允许出现的 `section` 取值与侧栏顺序。空数组表示不校验；
   * 写了之后页面用了表外的 `section`，`wiki check` 会点名。
   */
  sections?: string[];

  /** `section` slug → 显示名。未声明的回落到 slug 本身 */
  sectionLabels?: Record<string, string>;

  /** 分类 slug → 显示名。未声明的回落到 slug；分类页自动生成在 `/categories/<slug>/` */
  categories?: Record<string, string>;

  /**
   * 主题包名，或主题目录。`./` 开头与绝对路径按目录解析，其余按包名解析；
   * 解析不到时静默回落到内置主题，写错路径的表现是「样式没变」。
   */
  theme?: string;

  /** 构建输出目录（相对内容根）。每次构建前会被整个清空 */
  outputDir?: string;

  /** 模板（`macros/*.eta`）相关的行为开关 */
  macros?: {
    /**
     * 未定义的模板：`'show'`（默认，保留 `{{原文}}`，一眼能看出漏了什么）/
     * `'hide'`（删掉）/ 自定义函数。三种都不让构建失败，但都会在输出里提示。
     */
    undefined?: 'show' | 'hide' | UndefinedMacroHandler;
  };

  /**
   * 内容页的路径前缀，只接受单段名字（字母、数字、`_`、`-`）或空串。
   * `'wiki'` → `/wiki/a/`；`''` → `/a/`，此时会和 `assets/`、`categories/`
   * 这些保留段抢位置，由 `wiki check` 点名。
   */
  docsDir?: string;

  /**
   * 链接形态。`'directory'` → `a/b/`；`'file'` → `a/b.html`，
   * 并把站内链接改成相对路径（给 `file://` 与 CHM 用）。
   */
  urlStyle?: 'directory' | 'file';

  /**
   * 单文件产物：CSS / JS / 图片 / 搜索索引全部塞进页面，产物里只剩 `.html`。
   * 代价是每页带一份样式，全站体积随页数线性增长。
   */
  inline?: boolean;

  /** 旧地址 → 新地址。`from` / `to` 都写**最终 URL**（含 `basePath` 与 `urlPrefix`），工具不做推断 */
  redirects?: Array<{ from: string; to: string; status?: number }>;

  /**
   * 重定向产物形态：`'js'` 生成 HTML 跳转页（没有服务端的托管用）、
   * `'server'` 只输出 `_redirects`（Netlify / Cloudflare Pages 认的真 301）、`'both'` 都做。
   */
  redirectMode?: 'js' | 'server' | 'both';

  /** 代码块高亮 */
  highlight?: {
    /** 关闭后代码块只保留转义后的纯文本，不含高亮标记 */
    enabled?: boolean;
    /** 额外加载的 highlight.js 语言名，如 `'ruby'`、`'go'`；内置语言不用写 */
    languages?: string[];
  };

  /** 站内搜索。工具只生成索引，搜索框与结果列表在主题里 */
  search?: {
    /** `false` 时连索引都不产出 */
    enabled?: boolean;
    /** 每页索引里保留的正文摘要长度（字符）；`0` 表示只要标题 */
    excerpt?: number;
  };

  /**
   * 把当前页的元数据（`it.page`，去掉整篇原文）注入
   * `<script type="application/json" id="lightwiki-page-data">`，供页面里的 JS 读取。
   */
  frontmatterInjection?: boolean;

  /** 站点级 markdown-it 插件入口：`(md) => { md.use(plugin) }` */
  markdown?: MarkdownSetup;
}

// 手写接口与 zod 推导的类型必须逐字一致，否则 type:check 失败。
// `Equal` 用双泛型比较，能分辨 optional 与 required、多字段与少字段。
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertConfigInput: Equal<SiteConfigInput, z.input<typeof siteConfigSchema>> = true;
void assertConfigInput;

/** 站点级的 markdown-it 插件入口：拿到的就是 markdown-it 实例 */
export type MarkdownSetup = (md: unknown) => void;

/** 把 zod 的报错整理成「文件: 字段 -> 原因」，避免只丢一坨 JSON。 */
export function describeIssues(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path} -> ${issue.message}` : issue.message;
  });
}
