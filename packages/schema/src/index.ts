import { z } from 'zod';

/**
 * 日期只接受 YYYY-MM-DD。
 * 理由：它同时用于页面上的「最后更新」与 sitemap 的 <lastmod>，
 * 一旦混入 `2026/11/7` 这类写法，两种输出都会坏掉。
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '应为 YYYY-MM-DD，例如 2026-11-15');

/**
 * 修订号写成字符串最稳（前导零不会丢），但 YAML 里不写引号就会变成数字。
 * 两者都收，统一成字符串。
 */
const revid = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+$/.test(value), '只接受纯数字修订号');

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
    title: z.string().min(1, 'title 不能为空'),
    description: z.string().optional(),
    keywords: keywords.optional(),
    section: z.string().optional(),
    order: z.coerce.number().int().optional(),
    updated: isoDate.optional(),
    draft: z.boolean().default(false),

    /**
     * 分类的键是 ASCII slug，显示名放站点配置的 `categories` 里。
     * 理由是 URL 要稳定、要能翻译。
     */
    categories: z.union([z.string(), z.array(z.string())]).optional(),
    /** 用哪个分类的页面列表充当侧栏；不填则用全站导航 */
    sidebarCategory: z.string().optional(),

    // —— 术语提示（整篇只有一个时用） ——
    hintTitle: z.string().optional(),
    hint: z.string().optional(),

    // —— 整篇改编的来源 ——
    sourceSite: z.string().optional(),
    sourceTitle: z.string().optional(),
    sourceUrl: z.string().url('sourceUrl 需要一个完整 URL').optional(),
    sourceRevid: revid.optional(),
    sourceLicense: z.string().optional(),
    sourceLicenseUrl: z.string().url('sourceLicenseUrl 需要一个完整 URL').optional(),
    sourceChanges: z.string().optional(),

    // —— 站点自有内容的许可 ——
    license: z.string().optional(),
    licenseUrl: z.string().url('licenseUrl 需要一个完整 URL').optional(),
    authors: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export const siteConfigSchema = z.object({
  title: z.string().min(1),
  siteUrl: z.string().url('siteUrl 需要一个完整 URL'),
  basePath: z.string().default('/'),
  defaultLanguage: z.string().default('zh'),
  /** 语言代码 → 该语言的内容目录（相对内容根目录） */
  content: z.record(z.string(), z.string()),
  assetsDir: z.string().default('assets'),
  /** 内容里允许出现的 section 取值与顺序；留空则不校验 */
  sections: z.array(z.string()).default([]),
  /** 分类 slug → 显示名。未声明的分类用 slug 当显示名 */
  categories: z.record(z.string(), z.string()).default({}),
  theme: z.string().default('@lightwiki/theme-default'),
  outputDir: z.string().default('dist'),
  /**
   * 链接形态。directory 适合托管站（a/b/），file 适合 file:// 与 CHM（a/b.html）。
   */
  urlStyle: z.enum(['directory', 'file']).default('directory'),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SiteConfigInput = z.input<typeof siteConfigSchema>;

/** 把 zod 的报错整理成「文件: 字段 → 原因」，避免只丢一坨 JSON。 */
export function describeIssues(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path} → ${issue.message}` : issue.message;
  });
}
