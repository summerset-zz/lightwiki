/**
 * 内链解析。
 *
 * `[[目标]]` 里的「目标」有两种可能：slug 或页面标题。
 * 解析顺序固定为 **先 slug、再 title** —— slug 来自文件名，是最稳定的标识；
 * title 来自 frontmatter，方便但会随作者改标题而变化，所以只作为便利入口。
 */

export interface PageRef {
  lang: string;
  slug: string;
  url: string;
  title: string;
}

export interface TitleConflict {
  lang: string;
  /** 归一化之后的标题 */
  title: string;
  /** 撞在一起的 slug */
  pages: string[];
}

export interface ResolvedLink {
  url: string;
  /** 命中方式：排查「为什么链到了这一页」时有用 */
  via: 'slug' | 'title';
}

/**
 * 标题归一化：NFC、折叠连续空白、去掉首尾空白、小写。
 * 中文没有大小写问题，但中英混排的内容里 `Baseline` 与 `baseline` 容易被写成两种。
 */
export function normalizeTitle(input: string): string {
  return input.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export class LinkResolver {
  private readonly bySlug = new Map<string, Map<string, PageRef>>();
  private readonly byTitle = new Map<string, Map<string, PageRef[]>>();
  readonly conflicts: TitleConflict[] = [];

  add(ref: PageRef): void {
    const slugs = this.bySlug.get(ref.lang) ?? new Map<string, PageRef>();
    slugs.set(ref.slug.toLowerCase(), ref);
    this.bySlug.set(ref.lang, slugs);

    const titles = this.byTitle.get(ref.lang) ?? new Map<string, PageRef[]>();
    const key = normalizeTitle(ref.title);
    const list = titles.get(key) ?? [];
    list.push(ref);
    titles.set(key, list);
    this.byTitle.set(ref.lang, titles);
  }

  /** 在全部页面登记完之后调用一次，收集撞标题的情况 */
  finalize(): void {
    for (const [lang, titles] of this.byTitle) {
      for (const [title, refs] of titles) {
        if (refs.length > 1) {
          refs.sort((a, b) => a.slug.localeCompare(b.slug));
          this.conflicts.push({ lang, title, pages: refs.map((r) => r.slug) });
        }
      }
    }
  }

  /** 解析一个内链目标；找不到返回 null（由调用方决定怎么表现成红链） */
  resolve(target: string, lang: string): ResolvedLink | null {
    const trimmed = target.normalize('NFC').trim();
    if (!trimmed) return null;

    const bySlug = this.bySlug.get(lang)?.get(trimmed.toLowerCase());
    if (bySlug) return { url: bySlug.url, via: 'slug' };

    const byTitle = this.byTitle.get(lang)?.get(normalizeTitle(trimmed));
    const first = byTitle?.[0];
    if (first) return { url: first.url, via: 'title' };

    return null;
  }

  /** 仅按 slug 判断存在性，用于「站内链接是 slug 还是标题」的歧义检查 */
  hasSlug(slug: string, lang: string): boolean {
    return this.bySlug.get(lang)?.has(slug.toLowerCase()) ?? false;
  }
}
