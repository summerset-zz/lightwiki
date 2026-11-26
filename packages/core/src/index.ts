export { loadConfig, type LoadedConfig } from './config.js';
export {
  loadContent,
  type ContentProblem,
  type LoadedContent,
  type Page,
  type PageSeed,
} from './content.js';
export { buildSite, type BuildOptions, type BuildResult } from './build.js';
export {
  checkSite,
  type AssetIssue,
  type CategoryIssue,
  type CheckResult,
  type LayoutIssue,
  type ReservedIssue,
  type SectionIssue,
  type UnresolvedIssue,
} from './check.js';
export {
  assetList,
  injectPageAssets,
  pageAssetUrl,
  resolvePageAsset,
  scriptList,
  type ResolvedAsset,
  type ScriptRef,
} from './page-assets.js';
export { buildLinkReport, normUrl, type LinkReport, type RedLink } from './links.js';
export { compileLess, collectAssets, copyAssets, type AssetFile } from './assets.js';
export { createHighlighter, type Highlighter } from './highlight.js';
// 皮肤里 `<pre lang>` / `<code lang>` 的代码块高亮：build 与 dev 共用同一个出口
export { highlightCodeBlocks } from './code-blocks.js';
export { loadMacros,
  listMacroNames,
  type MacroBase,
  type MacroContext,
  type MacroProblem,
  type MacroRegistry,
} from './macros.js';
export {
  LinkResolver,
  normalizeTitle,
  type PageRef,
  type ResolvedLink,
  type TitleConflict,
} from './resolve.js';
export {
  createMarkdown,
  renderMarkdown,
  type Heading,
  type LinkRef,
  type RenderEnv,
  type RenderResult,
  type UnresolvedRef,
} from './markdown.js';
export {
  assetHref,
  categoryOutputPath,
  categoryUrl,
  INDEX_SLUG,
  indexOutputPath,
  localizeHref,
  normalizeBasePath,
  outputPathFor,
  pageBase,
  pageUrl,
  prefixPath,
  SEARCH_INDEX_FILE,
  searchIndexUrl,
  shouldInlineSearch,
} from './routes.js';
export { createRenderer, layoutCandidates, type Renderer } from './render.js';
export {
  ejectTheme,
  listThemeFiles,
  type EjectOptions,
  type EjectResult,
  type ThemeFile,
} from './theme.js';
export { rewriteRelativeLinks, relativeUrl } from './relative.js';
export {
  buildSearchIndex,
  injectSearchIndex,
  plainText,
  SEARCH_INDEX_ID,
  type SearchEntry,
  type SearchOptions,
} from './search.js';
// 页面元数据注入（`frontmatterInjection`）：build 与 dev 共用同一个出口
export { injectPageData, pageDataOf, PAGE_DATA_ID } from './page-data.js';
export {
  buildNav,
  buildSidebar,
  createCategoryView,
  createNotFoundRender,
  createNotFoundView,
  createPageView,
  NOT_FOUND_SLUG,
  type CategoryView,
  type NavGroup,
  type NavPage,
  type NotFoundRender,
  type NotFoundView,
  type PageView,
  type Sidebar,
} from './view.js';
export {
  categoriesOf,
  createSiteInfo,
  keywordsOf,
  pageInfoOf,
  summarize,
  type CategoryInfo,
  type PageInfo,
  type PageInfoInput,
  type PageSummary,
  type SiteInfo,
  type Summarizable,
} from './context.js';
