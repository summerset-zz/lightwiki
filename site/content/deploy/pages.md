---
title: 发布到 GitHub Pages
keywords: 部署, github pages, workflow, actions, basePath, 自定义域名
description: 仓库推上去就自动构建发布，需要先在设置里把 Source 选成 GitHub Actions。
section: deploy
order: 3
updated: 2026-11-17
draft: false
---

GitHub Pages 是 GitHub 自带的静态站点托管，把仓库里的产物当网站发出去。

起始模板自带一份 workflow，由 `wiki init` 铺到 `.github/workflows/pages.yml`。推送即构建，构建完就发布。

## workflow 做哪些事 {#workflow}

| 步骤 | 内容 |
|---|---|
| 检出 | 拉取仓库内容 |
| 装 Node | `actions/setup-node`，版本 22 |
| 构建 | 跑 `npx --yes @lightwiki/cli@0.5.0 build .` |
| 上传 | 把 `dist/` 上传成 Pages 站点产物 |
| 发布 | 把这份产物发到 Pages |

触发条件是 push 到 `main`。也可以在 Actions 页面手动触发。

## 第一次发布要做的三步 {#first-publish}

1. 仓库 Settings → Pages → Source 选 GitHub Actions
2. push 到 `main`
3. 等 Actions 里 `Pages` 这个 workflow 跑完

> 第 1 步不做，workflow 会在最后一步失败。构建步骤本身会先跑成功，所以现象是构建绿了、部署红了。

## 地址与子路径 {#base-path}

项目站的地址是 `https://<用户名>.github.io/<仓库名>/`，站点不在域名根上。

workflow 里已经把子路径通过环境变量传进去：

```yaml
env:
  LIGHTWIKI_BASE_PATH: /${{ github.event.repository.name }}/
```

站点配置读这个环境变量：

```ts
const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const basePath = env.LIGHTWIKI_BASE_PATH ?? '/';
```

所以本地预览是 `/`，线上自动变成 `/<仓库名>/`。仓库改名也不用动配置。字段本身见 [站点配置](/reference/config)。

## 工具版本写在哪 {#cli-version}

起始模板的 workflow 用 `npx` 直接跑，版本写在命令里：

```yaml
run: npx --yes @lightwiki/cli@0.5.0 build .
```

写死版本是为了构建可复现。升级工具时只改这一个数字。

> 别写成 `^0.5.0`。0.x 的 caret 只覆盖 `0.5.x`，下个 minor 就取不到，站点会一直停在旧版本。

### 仓库里有 package.json 时 {#cli-version-local}

把 CLI 装成本地依赖（见 [快速上手（会用命令行）](/start/quickstart-dev#init-local)）之后，版本号出现在两处：`pages.yml` 里的 `@0.5.0`，和 `package.json` 的 `devDependencies`。workflow 里的 `npx` **不会**去读 `package.json`，所以两处都要改，否则就是「本地跑新版本、CI 还在用旧版本构建」。

也可以让 CI 直接读 `package.json`，把版本收敛到一处：装完依赖再跑 script。

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm            # 可选：按 lockfile 缓存下载

      - run: npm ci             # 没有 package-lock.json 时换成 npm install

      - name: 构建
        env:
          LIGHTWIKI_BASE_PATH: /${{ github.event.repository.name }}/
          LIGHTWIKI_SITE_URL: https://${{ github.repository_owner }}.github.io
        run: npm run build
```

以后升级只改 `package.json`，再跑一次 `npm install` 让 lockfile 跟上，两个文件一起提交。

|  | 写死在 workflow | 交给 package.json |
| --- | --- | --- |
| 要改的文件 | `pages.yml` | `package.json` |
| 版本来源 | 命令里 | `devDependencies` |
| CI 多一步 | 无 | `npm ci` |
| 要提交 lockfile | 不用 | 要 |

## 不需要任何密钥 {#secrets}

工具从 npm 的公开包取，仓库里不用配 secret。workflow 用的凭据由 Actions 自动注入。

workflow 里显式声明的权限是 `contents: read`、`pages: write`、`id-token: write` 三项。

## 连续推送只跑完最后一条 {#concurrency}

workflow 的并发组设为 `pages`，并打开了 `cancel-in-progress`。

同一分支短时间内连推几次，前一次没跑完会被取消，只有最后一次完整跑完。

## 发布前先在本地跑一遍 {#precheck}

```bash
npx @lightwiki/cli check .
npx @lightwiki/cli build .
```

`check` 有问题会用退出码告诉你，`build` 成功说明产物能出来。CI 里跑的是同一条构建命令，只是版本号写死。

两个命令的用法见 [命令行](/reference/cli)。

## 要改的地方 {#tweaks}

`wiki.config.ts` 里的 `siteUrl` 默认是 `https://example.com`，模板不会自动改它。

这个值用在重定向页的 canonical 与跳转地址上，皮肤里也能从 `it.site.siteUrl` 拿到。用了重定向就应该改成真实地址。

绑定自己的域名时，先到 Settings → Pages → Custom domain 填好域名。再把站点配置的 `basePath` 改回 `'/'`，因为自定义域名通常挂在根上。

## 再往下 {#next}

- [部署到自有服务器](/deploy/server)
- [打包成 CHM](/deploy/chm)
