# 伦度线上品牌误显示修复记录

## 现象与根因

2026-09-27 检查 `https://lundu.eiscore.top/login` 时页面显示君乐缘。远端 `/config/eiscore-enterprise.json` 实际已是伦度配置，包含 `enterprise.id=lundu` 和 `branding.logoUrl=/enterprise-assets/site/lundu-logo.png`；问题出在静态前端发布目录不匹配：

- 远端 `index.html` 引用旧入口 `/assets/index-Du083Xzx.js`。
- 该 bundle 内硬编码君乐缘名称、台球产品文案和 `/company-assets/junleyuan-mark.png`，且不是当前伦度重构分支产物。
- 远端 `/asset-manifest.json` 不存在，被 Nginx SPA fallback 返回 HTML；浏览器期望的客户端缓存清单没有发布。
- 源码 `eiscore-base/index.html` 中客户端版本仍为 `20260612224947`，与 `eiscore-base/public/sw.js` 的 `20260926205000` 不一致。

只更新企业 JSON 或 Logo 图片不能修复硬编码在旧 JS 中的品牌内容。

## 修复与发布

- 将 `eiscore-base/index.html` 的客户端版本号与 Service Worker 统一为 `20260926205000`。
- 重新执行 `npm run build`，生成当前主包 `/assets/index-C5d-Pb9W.js`；该 bundle 不含君乐缘品牌字样。
- 使用 `scripts/generate-client-cache-manifest.mjs` 先对本地 dist 生成清单，再在远端保留现有微应用资源的临时合并目录中重新生成完整 release 清单，共 313 个 URL。
- 发布目录：`/opt/lundu-eiscore/release`。仅更新静态 Web release 文件，没有重启数据库、API、Agent 或 DeepSeek Harness，也没有修改数据库卷或业务数据。
- 发布前备份：`/opt/lundu-eiscore/backups/lundu-release-before-brand-fix-20260927-020459.tgz`（约 24 MB）。

## 验收证据

- 线上 `/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json`、伦度 Logo、`/sw.js` 和新入口 JS 均返回 HTTP 200；manifest 的 Content-Type 为 `application/json`。
- 页面标题为“伦度机电｜电机与水泵制造”；DOM 中 Logo `src` 为 `/enterprise-assets/site/lundu-logo.png`，图片自然宽度为 436px；正文不含“君乐缘”。
- Playwright 在 390×844、414×896、768×1024、1440×900 检查：Logo 加载、`body.scrollWidth` 等于视口宽度、无君乐缘文字、无页面异常。
- 1440×900 和 390×844 稳定状态截图均显示伦度 Logo 与伦度页面内容。
- 入口 HTML、Service Worker、企业配置、Logo 和新主 JS 的本地/远端 SHA-256 一致。
- `npm run build`、`node tests/engineering/flash-builder-preview-policy-regression.mjs` 和 `git diff --check` 通过。构建仍有既有 Sass `@import` 弃用和大 chunk 提示，不影响本次发布。

## DeepSeek 整合协作提醒

已将发现和修复通知正在运行的 `eiscore整合deepseekhardness` 任务。后续整合发布必须使用伦度当前重构分支构建出的完整静态 release，不能把旧的君乐缘 `index.html` 或主 JS 重新复制到 `/opt/lundu-eiscore/release`。如果整合引入新的前端入口或构建产物，部署前应核对 `index.html` 的主包引用、伦度企业配置和 Logo，并在最终合并后的完整 release 上生成 `asset-manifest.json`。

## 2026-09-28 再次覆盖与恢复

2026-09-28 检查发现线上又回到了君乐缘页面。远端 `/opt/lundu-eiscore/release/index.html` 在 17:29 UTC 变为 5318 字节，入口引用旧 EISCore 制品；`/asset-manifest.json` 同时退回 499 项，`/config/eiscore-enterprise.json` 请求被 SPA fallback 返回旧入口 HTML。该现象不是浏览器缓存或 DNS 问题，而是另一份旧静态发布覆盖了 release 目录。

已从完整备份 `release.codex-bak-20260927054514` 恢复基础目录，并叠加当前重构分支构建产物。恢复后入口为 6257 字节，manifest 为 942 项，伦度配置、Logo、应用场景图和制造现场图均返回 HTTP 200；仅重建 web 容器，未重启数据库、API、Agent 或 Harness。后续任何发布都必须先比较入口大小与主包引用，确认不包含 `junleyuan`/`君乐缘`，再生成完整 manifest 并重建 web。

## 2026-09-28 第三次覆盖与恢复

再次检查发现远端入口被旧 web 制品覆盖：`/login` 返回 4917 字节并引用 `/assets/index-DMGexNot.js`，HTML 含君乐缘；但 `/config/eiscore-enterprise.json` 仍返回 `enterprise.id=lundu`，说明配置服务没有出错。此时 manifest 为 1005 项，其中 339 项来自备份目录路径，说明旧发布还污染了静态 release。

已基于当前 `github-eiscore-refactor` 工作区重新构建完整 `eiscore-base/dist`，入口为 6257 字节、主包为 `/assets/index-lh67Jn66.js`，主入口和主包均未包含君乐缘。恢复后远端 manifest 为 366 项且无备份路径，伦度配置、Logo、桌面端和移动端页面均通过 HTTP/Playwright 验收；只重建 `web`，未重启后端服务。

## 2026-09-28 第四次覆盖与恢复

2026-09-28 05:57（北京时间）再次发现 web 被旧制品覆盖：`/login` 返回 4427 字节并引用 `/assets/index-DMGexNot.js`，静态标题退回 `EISCore 企业协同平台`；企业配置仍为 `enterprise.id=lundu`，因此仍是静态入口覆盖而不是配置错误。

已用当前工作区已验证的完整 dist 恢复 `web`。恢复后入口为 6257 字节、主包为 `/assets/index-lh67Jn66.js`，manifest 为 366 项且无备份路径。HTTP 和 Playwright 移动端验收均通过，浏览器标题为“伦度机电｜电机与水泵制造”，正文显示伦度公司名，控制台无错误；没有重启后端服务。

## 2026-09-28 子应用完整发布

主站恢复后曾发现 `/opt/lundu-eiscore/release` 只有根入口，缺少 `apps`、`materials`、`hr`、`company-site`、`mobile` 等 11 个 qiankun 子应用目录。Nginx 因根级 SPA fallback 将普通子应用请求返回 6257 字节主站 HTML，`mobile` 和 `company-site` 因入口缺失触发 internal redirection cycle；这不是品牌配置或后端故障。

已从 `github-eiscore-refactor` 的 `codex/systematic-refactor` @ `02b6588441a3620f29cfc9cee049035aa222fda2` 重新构建并暂存完整 12 份前端 dist：根目录使用 `eiscore-base/dist`，11 个微应用分别放入对应 URL 子目录。制品为 `output/lundu-microapps-20260928.tar.gz`，manifest version 为 `d8a1115a91bb3b5b`、共 567 项，备份 URL 为 0。

发布前将旧 release 备份至 `/opt/lundu-eiscore/backups/release-pre-microapps-20260928`，仅按 web-only Compose 命令重建 `web`，未重建数据库、API、Agent、DeepSeek Web 或 Harness。远端 release 权限为目录 755、文件 644；11 个子应用入口均 HTTP 200 且引用各自目录脚本，`/login`、公开配置 (`enterprise.id=lundu`)、伦度 Logo 均为 200，`/harness-embed` 保持 403。Playwright 在 390x844 与 1440x900 验收无横向溢出、伦度文案/Logo 可见、DOM 无“君乐缘”；materials qiankun bootstrap/mount smoke 通过且无 console error。

## 2026-09-29 企业概况排版发布

伦度企业概况由四个超大指标格改为“正式公司介绍 + 企业资料”两栏结构，移动端纵向排列。标题统一为“专注电机与水泵制造”，保留企业所在地、主营产品、业务体系和官网邮箱等已有事实，长地址和邮箱使用自然换行，不再裁切。

基于当前 `codex/systematic-refactor` 工作区重新构建完整 12 个前端包，制品为 `output/lundu-profile-release-20260929-v2.tar.gz`；根入口 6257 字节，主包 `/assets/index-ze0z-3ru.js`，manifest 567 项、备份 URL 0。远端旧 release 已备份至 `/opt/lundu-eiscore/backups/release-pre-profile-20260929`，仅重建 `web`。线上 `/login`、公开配置、Logo 和 11 个子应用入口均 HTTP 200；桌面 1440x900 与移动 390x844 无横向溢出，企业概况新结构可见，DOM 无君乐缘品牌。DB、API、Agent、DeepSeek Web 和 Harness 未重建。

## 回退

发布前归档保留了全部旧 release，可从该 tarball 提取到独立临时目录后，按原 release 内容恢复静态文件。若回退到本次发布前的状态，还应移除本次新增的 `/opt/lundu-eiscore/release/asset-manifest.json`，并让浏览器重新获取旧入口及 Service Worker。不要回滚或重建数据库、API、Agent、Harness 服务及数据卷。

## 2026-09-30 并发发布核验

用户反馈短时无法访问，结合此前多次覆盖记录，优先按多个 Agent 同时重建 `web` 的发布竞态处理。当前核验未发现新的品牌覆盖：

- 远端 `/login` 返回 200，入口 6258 字节，引用 `/assets/index-DlHNqxMx.js`。
- `/config/eiscore-enterprise.json` 返回 `application/json`，`enterprise.id=lundu`。
- `/asset-manifest.json` 返回 JSON，版本 `46f609a9fada2884`，共 568 项。
- Playwright 390x844 实测标题为“伦度机电｜电机与水泵制造”，Logo 可见，无横向溢出、无“君乐缘”、无控制台错误。

本次没有重新构建或重启任何服务。后续 Agent 发布前仍须声明目标服务、分支/提交和完整制品路径；涉及 `web` 时只允许使用当前 `github-eiscore-refactor` 的完整 dist，并在发布后再次报告入口主包、manifest 数量和验收结果。

## 2026-09-30 制造服务页面发布

本次发布目标为远端伦度开发/验收 Compose 环境的 `web` 服务。使用分支 `codex/systematic-refactor`、提交 `f5ce958` 生成的完整 12 个前端入口制品 `output/lundu-manufacturing-release-20260930051151.tar.gz`，没有使用备份目录或旧的单入口 dist。发布前制品校验通过：根入口 6258 字节，manifest version `7073b8d28f023d37`、568 项、备份 URL 为 0，入口配置为 `enterprise.id=lundu` 并引用伦度 Logo。

远端旧 release 已备份至 `/opt/lundu-eiscore/backups/release-pre-manufacturing-20260930051151`。解压校验通过后切换 `/opt/lundu-eiscore/release`，仅执行以下 web-only 重建：

```sh
docker compose --env-file /opt/lundu-eiscore/.env \
  -f /opt/lundu-eiscore/compose.yml \
  up -d --no-deps --force-recreate web
```

没有重建或重启 DB、API、Agent、DeepSeek Web 或 Harness。线上入口引用 `/assets/index-B__AF6n9.js`，入口 SHA-256 为 `9b7ca2c569a7cc274753609735b657e19cb3f2ef0ac017aa56f77b89787ba0f7`，主包 SHA-256 为 `a4ef7c025218857e591dcea974daa64043b8c66fb50277c8e0cfe75eafa61195`。`/login`、`/asset-manifest.json`、公开企业配置和 Logo 均返回 200；manifest 返回 568 项 JSON，配置返回 `enterprise.id=lundu`。

Playwright 线上验收通过：390×844 和 1440×900 均无横向溢出，页面标题为“伦度机电｜电机与水泵制造”，伦度 Logo、制造服务产品卡片和产品图片正常加载，按钮保持单行，DOM 不含“君乐缘”。控制台仅有既有 Three.js `PCFSoftShadowMap` 弃用警告，没有页面错误。Nginx 配置检查成功；发布期间通过 `/opt/lundu-eiscore/.lundu-web-publish.lock` 避免与其他 web 发布并发切换。

## 2026-10-02 首屏背景扩图替换

用户确认的 GPT Image 2 扩图素材为 `output/lundu-hero-expand-20261002/hero-expanded-gptimage2-final-v4.png`，已转换为高质量 JPG `hero-wide-expanded-20261002.jpg`（2048×1024），替换远端同一路径 `/opt/lundu-eiscore/release/enterprise-assets/site/crops/hero-wide.jpg`。公开 URL 保持 `/enterprise-assets/site/crops/hero-wide.jpg` 不变，入口和企业配置无需修改。

发布前声明目标服务为 `web`，分支为 `codex/systematic-refactor`，影响范围仅为首屏图片和 `web` 容器；原图已备份至 `/opt/lundu-eiscore/backups/hero-wide-before-expand-20261002.jpg`。远端新图 SHA-256 为 `377821b9f3eab6f2ff30754830606f72d2fd27d8a3eb23697aca8a38b16b3da7`，与本地产物一致。仅执行 `docker compose --env-file /opt/lundu-eiscore/.env -f /opt/lundu-eiscore/compose.yml up -d --no-deps --force-recreate web`，没有重启 DB、API、Agent、DeepSeek Web 或 Harness。

线上验收结果：图片 URL HTTP 200、`image/jpeg`、2048×1024；`/login` HTTP 200，页面标题为“伦度机电｜电机与水泵制造”，桌面 1440×900 无横向溢出，DOM 不含“君乐缘”，Logo 和首屏泵/电机背景正常加载。manifest 版本 `6298eacfb43ccce0`、570 项；Nginx 配置检查通过。控制台只有既有 Three.js `PCFSoftShadowMap` 弃用警告，没有页面错误。

## 2026-10-02 首屏容器铺满修复

用户反馈首屏图片上下出现深色空带。根因是首屏图片使用 `object-fit: contain`，在桌面首屏容器和图片宽高比不一致时保留了上下空白。提交 `1e4434b50abaeac8e39a42b8a1a2c0b3386e7817`（`fix(lundu): fill hero image container`）将桌面和移动端 `.hero-media img` 统一改为 `object-fit: cover`，保留居中定位；同时使用已确认的 GPT Image 2 扩图素材 `2048×1024`。

发布前声明：目标服务为 `web`；分支 `codex/systematic-refactor`；完整制品为 `output/lundu-hero-cover-release-20261002041358-v2.tar.gz`，由 `output/lundu-no-legacy-release-20261002033412` 的 12 入口基底叠加当前 `eiscore-base/dist` 生成；影响范围为首屏 CSS/图片及 web 静态制品，不涉及其他 Agent 的后端服务或未提交改动。

发布过程使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`，当前 release 备份至 `/opt/lundu-eiscore/backups/release-pre-hero-cover-20261001202343`，随后原子替换完整 `/opt/lundu-eiscore/release`。实际仅执行：

```sh
docker compose --env-file /opt/lundu-eiscore/.env \
  -f /opt/lundu-eiscore/compose.yml \
  up -d --no-deps --force-recreate web
```

没有重建 DB、API、Agent、DeepSeek Web 或 Harness。发布后的入口为 6258 字节，主包 `/assets/index-CVLDTJOW.js`；manifest 版本 `b4066abdde0ebe27`、564 项、备份 URL 为 0。远端 `/opt/lundu-eiscore/release/enterprise-assets/site/crops/hero-wide.jpg` 为 `2048×1024` JPEG，SHA-256 为 `377821b9f3eab6f2ff30754830606f72d2fd27d8a3eb23697aca8a38b16b3da7`。

HTTP 验收通过：`/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json`、`/enterprise-assets/site/lundu-logo.png` 和 `/enterprise-assets/site/crops/hero-wide.jpg` 均返回 200；配置为 `enterprise.id=lundu`，页面标题为“伦度机电｜电机与水泵制造”，线上页面和入口资源不含“君乐缘/junleyuan”。远端 web 容器为 `lundu-eiscore-web-1`，状态为 Up。
