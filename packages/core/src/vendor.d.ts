declare module 'markdown-it-attrs' {
  import type MarkdownIt from 'markdown-it';
  const plugin: MarkdownIt.PluginSimple;
  export default plugin;
}

/** less 自身不带类型声明，这里只声明我们用到的部分 */
declare module 'less' {
  export interface RenderResult {
    css: string;
    map?: string;
    imports?: string[];
  }
  export interface RenderOptions {
    filename?: string;
    paths?: string[];
    compress?: boolean;
  }
  export function render(source: string, options?: RenderOptions): Promise<RenderResult>;
  const less: { render: typeof render };
  export default less;
}
