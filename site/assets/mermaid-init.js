/**
 * 把页面里的 ```mermaid 代码块渲染成图。
 *
 * 为什么必须在前端做：mermaid 要测量文本尺寸才能布局，构建期拿不到这些数据，
 * 除非在构建机里塞一个 headless 浏览器。这是「外部库示例」挑它的原因。
 *
 * 依赖 vendor/mermaid.min.js 先加载（UMD，全局 `mermaid`）。
 * 两个脚本都用 `defer`，执行时 DOM 已经解析完，可以直接查元素。
 */
(function () {
  var mermaid = window.mermaid;
  if (!mermaid) return;

  var blocks = document.querySelectorAll('pre > code.language-mermaid');
  if (!blocks.length) return;

  // 站点的代码块是 <pre><code class="language-mermaid">，mermaid 认的是元素本身，
  // 所以把内容搬进一个 div，再把原来的 pre 换掉。
  var nodes = [];
  for (var i = 0; i < blocks.length; i += 1) {
    var code = blocks[i];
    var host = document.createElement('div');
    host.className = 'mermaid';
    host.textContent = code.textContent || '';
    if (code.parentElement) code.parentElement.replaceWith(host);
    nodes.push(host);
  }

  // 配色跟着站点的深浅色走，不然深色页面上会蹦出一张白底的图
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    securityLevel: 'strict',
  });

  // 单张图语法写错时 mermaid 会自己画一个错误提示，不影响其它图
  Promise.resolve(mermaid.run({ nodes: nodes })).catch(function (error) {
    console.error('[mermaid]', error);
  });
})();
