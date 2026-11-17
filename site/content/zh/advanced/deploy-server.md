---
title: 部署到自有服务器
keywords: 部署, 静态托管, nginx, 404, 子路径
description: 产物是纯静态文件，扔到任何静态服务器都能跑。这一页讲部署前要改哪几个配置。
section: advanced
order: 4
updated: 2026-11-17
draft: false
---

`dist/` 里只有 HTML、CSS、JS、图片与 json。没有服务端渲染，没有 API，也没有数据库。

任何能把一个目录当网站发出去的东西都能托管：Nginx、Apache、Caddy、对象存储、CDN。

## 部署前对照检查 {#checklist}

| 情况 | 要改 |
|---|---|
| 挂在域名根，如 `https://example.com/` | `basePath: '/'`，默认就是 |
| 挂在子路径，如 `https://example.com/wiki/` | `basePath: '/wiki'` |
| 用 Nginx、Apache、Caddy | 确认目录请求会落到 `index.html` |
| 想用服务端 301 | 见下面的重定向一节 |

`basePath` 末尾斜杠写不写都能跑，构建会去掉。字段说明见 [站点配置](/docs/advanced/config)。

## 目录请求 {#index-files}

`urlStyle: 'directory'`（默认）下，页面产物是 `docs/a/index.html`，访问地址是 `/docs/a/`。

这要求服务器把以 `/` 结尾的请求映射到该目录的 `index.html`。主流静态服务器默认如此。

个别配置会 404，比如关掉了 `autoindex` 又没有配 `index`。

`urlStyle: 'file'` 下产物是 `docs/a.html`，不依赖这个行为。

服务器托管同样能用 `'file'` 模式，只是地址里带 `.html`。

## 404 页 {#not-found}

产物根目录有 `404.html`。静态托管没有服务端路由，但有一条通用约定：未命中时返回根目录的 `404.html`。

GitHub Pages、Netlify、Cloudflare Pages、S3、OSS 都认这条。

Nginx 要自己配：

```nginx
error_page 404 /404.html;
```

Apache 用 `ErrorDocument 404 /404.html`。

## 重定向 {#redirects}

`redirectMode` 的三种取值决定产物：

| 取值 | 产物 | 谁能直接用 |
|---|---|---|
| `'js'`（默认） | 每条规则一个跳转页，meta refresh 加 JS 兜底 | 任何托管，不需要服务端配置 |
| `'server'` | 只写一份 `_redirects` | Netlify、Cloudflare Pages |
| `'both'` | 两者都做 | 同上 |

`_redirects` 每行一条，依次是来源地址、目标地址、状态码，中间用两个空格分隔。

Netlify 与 Cloudflare Pages 认这个格式。Nginx 与 Apache 不认，要用自己的语法写规则。

省事的做法是用默认的 `'js'` 模式，它不依赖服务端配置。

## 部署后先查这几项 {#verify}

| 检查 | 用来确认 |
|---|---|
| 打开站点根地址 | 首页产物在正确位置 |
| 打开一个深层页面 | 目录请求落到了 `index.html` |
| 打开一个不存在的地址 | 返回的是 `404.html` |
| 看一张正文里的图片 | `basePath` 与实际挂载位置一致 |

四项分别对应上面几节的内容，出问题基本能在这里看出来。

## 缓存 {#cache}

工具不生成带哈希的文件名，所以不能给资源设长缓存。这一点要自己权衡。

## 再往下 {#next}

- [发布到 GitHub Pages](/docs/advanced/deploy-pages)
- [打包成 CHM](/docs/advanced/deploy-chm)
