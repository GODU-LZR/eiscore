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

## 2026-10-02 全部图片插槽比例修复与发布

用户要求将首屏扩图和容器铺满方法应用到独立站其他含图片的 div。审计 `LoginView.vue` 和 `login-view.scss` 后按素材性质分开处理：

- 企业介绍 `.story-media` 使用现有宽幅场景素材，容器统一为 `16:7`，图片使用 `object-fit: cover`，不再在容器上下留下空带。
- 底部画廊 `.gallery-track figure` 与宽幅素材统一为 `16:7`，图片使用 `cover`；移动端保持单列并隐藏后续重复画面。
- 制造服务 `.manufacturing-series-media` 使用产品卡素材的 `16:9` 比例，图片继续 `contain`，保留产品四周留白和完整主体。
- 产品卡 `.product-card-media` 保持 `contain`，补充 `min/max-width` 与 `min/max-height` 约束，避免固有比例图片撑破 div。
- 解决方案主图和移动端行图使用产品素材的 `16:9` 容器，图片继续 `contain` 并保留内边距，避免泵体被 `cover` 裁掉。
- Logo 继续使用 `contain`，不修改伦度官方 Logo。

源码提交为 `dd0e72d fix(lundu): align image containers with asset ratios` 和 `db22e70 fix(lundu): constrain product card images`。本次未重新生成图片；现有 GPT Image 2 宽幅/卡片素材的比例已经覆盖各插槽，重新生成会造成不必要的视觉漂移。构建 `eiscore-base` 的 `npm run build` 通过，仅有既有 Sass `@import` 弃用、circular chunk 和大 chunk 警告。

发布前声明：目标服务为 `web`；分支 `codex/systematic-refactor`；完整制品为 `output/lundu-image-slots-final-20261002053327.tar.gz`，由 12 入口基底叠加当前 `eiscore-base/dist` 生成；影响范围仅为独立站图片容器 CSS 和静态 web 制品。发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`，旧 release 备份至 `/opt/lundu-eiscore/backups/release-pre-image-slots-final-20261001215010`，仅执行 web-only Compose 重建，没有重建 DB、API、Agent、DeepSeek Web 或 Harness。

发布后根入口为 6258 字节，主包 `/assets/index-BUN5FU0_.js`；manifest 版本 `9ade523b9428a2c0`、590 项、备份 URL 为 0；远端首屏图保持 `2048×1024` JPEG，SHA-256 `377821b9f3eab6f2ff30754830606f72d2fd27d8a3eb23697aca8a38b16b3da7`。HTTP 资源、企业配置、Logo、产品图均返回 200。Playwright 线上验收在 `390×844`、`414×896`、`768×1024` 和 `1440×900` 通过：scrollWidth 等于 viewport、23 个图片节点无断图、页面标题正确、DOM 不含君乐缘。

## 2026-10-03 产品图片安全放大与全插槽铺满发布

用户继续反馈产品图片在容器中视觉留白过大。本轮只调整伦度登录页图片插槽样式：宽幅场景图和画廊使用 `cover` 铺满 `16:7` 容器；制造服务和产品卡继续使用 `contain` 保持泵体、电机和端盖完整，并通过安全 `scale` 放大素材自身的浅色外围留白；解决方案图使用 `16:9` 容器与轻度放大。没有重新生成 GPT Image 2 素材，也没有修改 DeepSeek、Harness 或后端服务。源码提交为 `3990fb6 fix(lundu): enlarge product media within slots`，构建命令为 `npm run build`，通过既有 Sass/circular chunk/large chunk 警告。

发布前声明：目标服务为 `web`；分支为 `codex/systematic-refactor`；完整 12 入口制品为 `output/lundu-image-fill-final-20261003001315.tar.gz`，本地 SHA-256 为 `93ffe0e4aec9162387a330563f2accf075e4efe9c216fcc8a0d804df40bb13c3`，manifest version `b2282d37b8f50532`、590 项、83,730,314 bytes，备份 URL 为 0。制品入口和公开配置未包含“君乐缘/junleyuan”；manifest 中保留的君乐缘路径仅属于仓库内合法历史子应用资产，未出现在伦度根入口和公开正文。

远端发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`。当前 release 已备份至 `/opt/lundu-eiscore/backups/release-pre-image-fill-20261002164443`，随后原子替换 `/opt/lundu-eiscore/release`。实际只执行：

```sh
docker compose --env-file /opt/lundu-eiscore/.env \
  -f /opt/lundu-eiscore/compose.yml \
  up -d --no-deps --force-recreate web
```

实际重建服务为 `lundu-eiscore-web-1`；DB、API、Agent、DeepSeek Web 和 Harness 未重建。远端入口 6258 字节，线上 `/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json`、伦度 Logo、首屏图和产品图均返回 HTTP 200；manifest 为 `b2282d37b8f50532` / 590 项，企业配置为 `enterprise.id=lundu`。远端浏览器在 `390×844`、`414×896`、`768×1024`、`1440×900` 验收：标题为“伦度机电｜电机与水泵制造”，`scrollWidth` 等于 viewport，页面 DOM 无君乐缘，页面错误和控制台错误均为 0。下方产品图片使用 `loading=lazy`，未滚动时报告未完成加载；逐一请求资源均返回正常尺寸和 HTTP 200，不属于断图。

## 2026-10-03 第二幅轮播图扩图替换与发布

用户反馈轮播第二幅水泵图片视觉上没有扩图。核对配置后确认：第一幅 `hero-wide.jpg` 已是 GPT Image 2 扩图后的 `2048×1024` 素材，但第二幅仍使用原始 `generated-pump-product-wide.jpg`（`1600×700`），因此第二幅在 `cover` 容器中被裁切，产品周围没有足够留白。

本次使用 GPT Image 2 对第二幅原图执行 outpainting：保持蓝色离心泵和电机的结构、透视、颜色与光照不变，只向四周补齐浅灰背景和地面空间；生成结果为 `2048×1152`，产品主体居中，泵头、底座、电机端盖和后罩完整可见。最终 JPG 已替换源码资源 `eiscore-base/public/enterprise-assets/site/crops/generated-pump-product-wide.jpg`，公开 URL 保持不变。新素材 SHA-256 为 `2a8027d143ddf51fd93a424e59d31482a83ff0364cd55b5c0ec68a665cb59506`。

发布前声明：目标服务为 `web`；分支为 `codex/systematic-refactor`；完整制品为 `output/lundu-carousel-expand-release-202610030.tar.gz`，本地与远端 SHA-256 均为 `773f64f6fc0a1004bd0420b318e3d8ba09766f0afe13836202ddae07e5ba723e`；manifest version `de12e415e871e152`、605 项、84,491,819 bytes，备份 URL 为 0。入口主包为 `/assets/index--SFwBGTj.js`，配置 `enterprise.id=lundu`，入口和公开配置没有君乐缘品牌。

远端旧 release 已备份至 `/opt/lundu-eiscore/backups/release-pre-image-fill-20261002181918`，通过 `/opt/lundu-eiscore/.lundu-web-publish.lock` 完成原子替换。实际只重建 `lundu-eiscore-web-1`，没有重建 DB、API、Agent、DeepSeek Web 或 Harness。线上第二幅图片 URL 返回 `2048×1152`、HTTP 200，SHA-256 与本地产物一致；`/login`、公开配置、Logo 和 manifest 均返回 200。浏览器在 `390×844`、`414×896`、`768×1024`、`1440×900` 切换到第二个轮播点后验证：水泵完整居中、四周浅灰留白、没有黑边或主体裁切，页面无横向溢出、无君乐缘正文、页面错误和控制台错误均为 0。

## 2026-10-05 全部图片插槽 GPT Image 2 扩图发布

用户确认将独立站所有非 Logo、非图标、非 3D Canvas 的图片插槽逐一扩图。本轮盘点登录页实际渲染的唯一素材，保留已经完成的首屏 `hero-wide.jpg` 与第二幅泵图，并使用 GPT Image 2 outpainting 重新处理其余 11 张：4 张轮播/场景图（电机、应用、制造现场、部件细节）、5 张产品卡（YE3、YC、PST、WQ、JET）和 2 张解决方案图（水泵选型、生产数字化；电机选型复用扩展后的电机宽幅图）。

扩图规则按插槽比例执行：宽幅场景与解决方案统一为 `2048x1152`，产品卡统一为 `1600x900`；每张图均要求主体位于中央安全区、四周补齐自然背景、产品结构保持完整，不裁切泵头、法兰、轴、底座、电机端盖或电缆，不添加文字、Logo、水印和黑边。生成结果先制作接触表逐张检查，再替换运行时资源 `eiscore-base/public/enterprise-assets/site`，同时同步 `enterprise-packs/lundu/assets/site`，避免后续企业包重建把旧素材带回。生成与检查产物目录为 `output/lundu-all-image-expansion-20261005`。

发布前声明：目标服务为 `web`；分支为 `codex/systematic-refactor`；完整 12 入口制品为 `output/lundu-all-images-release-20261005.tar.gz`，本地与远端 SHA-256 均为 `6377d89a4288a0c7114fbb83355a26d972fb8c236784566e91eba24d7238a1e2`；manifest version `1fc106518c10bb50`、619 项、87,943,073 bytes，备份 URL 为 0。入口 6258 字节，主包为当前构建生成的 `/assets/index-UcXqmSUy.js`；入口、公开配置和首屏正文没有“君乐缘/junleyuan”。

远端旧 release 已备份至 `/opt/lundu-eiscore/backups/release-pre-all-images-20261004210649`。发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`，原子替换 release，实际只重建 `lundu-eiscore-web-1`；DB、API、Agent、DeepSeek Web 和 Harness 未重建。线上 13 张唯一图片资源均返回 HTTP 200，扩图后的宽幅资源为 `2048x1152`，产品卡为 `1600x900`；`enterprise.id=lundu`，Logo 正常，页面标题为“伦度机电｜电机与水泵制造”。

Playwright 线上验收在 `390x844`、`414x896`、`768x1024`、`1440x900` 完成：每个视口 `scrollWidth` 等于 viewport，23 个图片节点全部加载，6 个轮播点均可切换，产品主体完整居中且无黑边，页面 DOM 不含君乐缘，页面错误和控制台错误均为 0。构建 `npm run build` 通过，仅保留既有 Sass import 弃用、circular chunk 和大 chunk 警告。
## 2026-10-05 采购商城与销售 Agent 发布

前端制品来自 codex/systematic-refactor 当前提交 561f3d83c760c7c0511a460b567af4eeced95359，完整制品目录为 output/lundu-shop-release-20261005，上传归档 SHA-256 为 325275a042e3ee6164c501ac2233ffcadfcdb95361adc2f94eba912d9260a760。制品门禁：入口 6258 字节、主包 /assets/index-BZXjBFdi.js、enterprise.id=lundu、manifest version 24a9dfe4594e25bc、634 项、88,502,432 bytes，入口/配置/主包没有“君乐缘/junleyuan”。

发布前声明目标服务为 web；影响范围是完整伦度静态入口及资源。远端旧 release 已原子备份至 /opt/lundu-eiscore/backups/lundu-shop-before-20261004231319，使用锁 /opt/lundu-eiscore/.lundu-web-publish.lock。实际只重建 lundu-eiscore-web-1；DB、API、Agent、DeepSeek Web 和 Harness 没有被重建。

发布后复核发现销售 Agent 返回 SITE_NOT_FOUND，原因是数据库中已有的 primary / lundu.eiscore.top 站点记录是 draft、published_version=0，而销售路由只接受 published。按 realtime/company-site.js 的既有发布语义，将该现有伦度站点配置发布为 published，版本变为 1，并同步 zh-CN、en-US 站点语言；没有创建新客户内容或修改数据库结构。发布前数据备份为 /opt/lundu-eiscore/backups/site-config-before-sales-publish-20261004232143.sql，后端容器没有重启。

销售 Agent 端到端接口验收通过：POST /agent/sales/sessions -> HTTP 201；POST /agent/sales/sessions/{id}/messages -> HTTP 200，缺少公开依据时正确转人工；POST /agent/sales/sessions/{id}/leads -> HTTP 201，返回测试询价编号 INQ-20261004-454E4ECD。

浏览器端到端验收通过：远端标题为“伦度机电｜电机与水泵制造”，Logo 可见；JET 产品详情弹层可打开；加入询价单后徽标为 1，询价单显示产品、数量和联系方式字段；销售 Agent 面板可打开；采购状态显示“待提交询价”，支付说明为“接口已预留，本页面不会产生扣款”。四视口 390x844、414x896、768x1024、1440x900 的静态检查均满足 scrollWidth <= viewport，DOM 无君乐缘品牌。支付仍是前端占位流程，不会收款。

后续 Agent 协作要求：不要把 company_site.site_config.primary 退回 draft；涉及站点内容发布时使用现有发布处理器的快照和审计逻辑，并在发布前声明目标服务与影响范围。web 发布继续只使用当前重构分支的完整 dist，不得复制旧客户入口或单独替换主 JS。

## 2026-10-05 商城视觉精修与移动端首屏布局修复 v9

本轮目标是把已存在的产品详情、询价单、销售 Agent、采购状态和支付预留收口为正式的伦度工业独立站界面，并修复移动端首屏图片被旧断点样式覆盖的问题。源码位于 codex/systematic-refactor 工作区，主要修改 eiscore-base/src/views/LoginView.vue 和 eiscore-base/src/styles/login-view.scss：商品卡、产品详情弹层、询价单和 Agent 使用统一伦度深绿色主操作样式；弹层使用统一品牌线；短按钮在移动端保持单行；产品图使用 contain，场景图使用 cover；轮播 Transition 移除 mode="out-in"，避免切换空档；文件 EOF 的移动端覆盖规则将图片带、文案带、轮播控制和企业入口恢复为正常文档流，避免 .hero-inner 绝对定位遮住图片。

发布前声明：目标服务为 web；当前分支为 codex/systematic-refactor，工作树含其他 Agent 未提交改动，本轮只使用当前工作区完整构建结果；完整制品目录为 output/lundu-shop-polish-release-20261005-v9，归档为 output/lundu-shop-polish-release-20261005-v9.tar.gz，归档 SHA-256 为 7EE8FA19DE6A124B07C78894416FEEC023500CE1B2F283F7D824734029FAD090。入口 index.html 为 6258 bytes，主包为 /assets/index-DGkoAd94.js；asset-manifest.json version 01aeac7693f23a7b、569 项、89467037 bytes。制品入口、公开配置和主资源未包含君乐缘公开品牌。

远端发布前将旧 release 备份至 /opt/lundu-eiscore/backups/lundu-shop-polish-before-v9-20261005133411.tgz，使用 /opt/lundu-eiscore/.lundu-web-publish.lock，原子替换完整 /opt/lundu-eiscore/release，实际只执行 docker compose --env-file /opt/lundu-eiscore/.env -f /opt/lundu-eiscore/compose.yml up -d --no-deps --force-recreate web。实际重建服务为 lundu-eiscore-web-1；DB、API、Agent、DeepSeek Web 和 Harness 未重建。远端入口、manifest、企业配置和 Logo 校验通过，enterprise.id=lundu。

Playwright 线上验收：标题为“伦度机电｜电机与水泵制造”，Logo 正常，控制台 0 errors（仅既有 Three.js PCFSoftShadowMap 弃用 warning）。390×844、414×896、768×1024、1440×900 均无横向溢出；移动端图片带为 16:9，六张轮播图均自然尺寸加载、透明度为 1，产品主体不被文案层遮挡；全页滚动后所有可见图片均完成加载。产品详情弹层、加入询价单徽标/数量/移除、采购四阶段和支付接口预留、销售 Agent 面板均通过交互检查。BOM 区域保持固定视角，移动端页面滚动不被 Canvas 抢占。后续发布必须继续使用当前重构分支构建出的完整 dist，并在发布前声明目标服务、分支/提交、制品路径和影响范围。

## 2026-10-06 商城视觉精修 v11 与移动端弹层边界修复

本轮在 v9 的基础上继续收口采购界面：产品卡增加项目规格询价提示；询价单增加产品数量摘要和四阶段状态视觉；销售 Agent 增加快速提问入口；采购状态按询价、报价、订单、支付阶段使用一致的伦度工业色彩；轮播图片移除独立淡出过渡，使图片和文案在同一更新帧切换，避免瞬态错配。移动端最终断点将询价遮罩和弹层固定为视口宽度、`box-sizing: border-box`，修复 390px 设备上弹层宽 404px 的左右溢出。

发布前声明：目标服务为 `web`；分支/提交为 `codex/systematic-refactor @ 561f3d83c760c7c0511a460b567af4eeced95359`；完整制品为 `output/lundu-shop-polish-release-20261006-v11.tar.gz`，本地和远端 SHA-256 均为 `dd45df267d263161e840c237cde0a4d98b6116ef79281962084fa039aa6e7a6a`。入口 `6258` 字节，主包 `/assets/index-BVC3yn1A.js`；manifest version `38ed484e4be24934`、569 项、89472094 bytes，备份 URL 为 0；入口、配置和主资源没有“君乐缘/junleyuan”。

远端发布前 release 备份为 `/opt/lundu-eiscore/backups/lundu-shop-polish-before-v11-20261005192749.tgz`。使用 `/opt/lundu-eiscore/.lundu-web-publish.lock` 原子替换完整 release，实际只执行 `docker compose --env-file /opt/lundu-eiscore/.env -f /opt/lundu-eiscore/compose.yml up -d --no-deps --force-recreate web`，实际重建 `lundu-eiscore-web-1`；DB、API、Agent、DeepSeek Web 和 Harness 未重建。Compose 仅报告既有 orphan 容器提示，没有清理其他服务。

线上 HTTP 门禁通过：`/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json` 和伦度 Logo 均返回 200，配置 `enterprise.id=lundu`。Playwright 线上验收通过：390×844、414×896、768×1024、1440×900 的 `scrollWidth` 分别等于视口宽度，Logo 可见，产品卡 5 个；390px 询价弹层为 `x=0/right=390/width=390`，桌面 1440px 弹层为 `760px`，销售 Agent 弹层为 `620px`；产品详情→加入询价单→数量/联系方式→报价→订单→支付占位→销售 Agent 流程通过；浏览器无页面错误和控制台错误，正文无君乐缘品牌。

## 2026-10-06 伦度白色 UI 收口 v12

本轮针对用户反馈的页面颜色不统一完成白色 UI 收口。`eiscore-base/src/views/LoginView.vue` 移除根页面动态蓝灰渐变，`eiscore-base/src/styles/login-view.scss` 将 `.login-page`、`.public-products-section`、`.commerce-section` 及采购弹层基线收口为纯白，并保留伦度绿色用于按钮、品牌线和状态强调；产品图片承载区与采购状态面板的局部浅色保持不变，避免产品图和流程状态失去层次。没有修改产品资料、销售 Agent、支付占位或后端服务。

发布前声明：目标服务为 `web`；分支/提交为 `codex/systematic-refactor @ 561f3d83c760c7c0511a460b567af4eeced95359`；完整制品为 `output/lundu-shop-polish-release-20261006-v12.tar.gz`，本地与远端归档 SHA-256 均为 `FE3CAF7B2FBBAAA862D4B486C75A94340F07271B2239141552D5AABDDBA7C0D3`。制品由当前工作区 `npm run build:frontends` 和 `node scripts/generate-client-cache-manifest.mjs eiscore-base/dist` 生成，入口 `6258` 字节，主包为 `/assets/index-QbRhdywN.js`；manifest version `30a748b48609988b`、`569` 项、`89472167` bytes，归档包含根入口及 `apps`、`company-site`、`equipment`、`hr`、`materials`、`mobile`、`production`、`quality`、`decision`、`purchase`、`sales` 共 12 个入口。构建通过，仅有既有 Sass import 弃用、circular chunk 和大 chunk 警告；`npm run test:syntax`、`npm run lint:changed`、`git diff --check` 均通过。

远端发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`，旧 release 已备份至 `/opt/lundu-eiscore/backups/lundu-shop-polish-before-v12-20261006000839`。远端归档 SHA 校验通过后原子替换完整 `/opt/lundu-eiscore/release`，实际只执行：

```sh
docker compose --env-file /opt/lundu-eiscore/.env \
  -f /opt/lundu-eiscore/compose.yml \
  up -d --no-deps --force-recreate web
```

实际重建服务为 `lundu-eiscore-web-1`；DB、API、Agent、DeepSeek Web 和 Harness 未重建。Compose 仅报告既有 `lundu-eiscore-deepseek-web-1` orphan 提示，没有使用 `--remove-orphans`，其他容器保持运行。远端 `/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json` 和 `/enterprise-assets/site/lundu-logo.png` 均返回 HTTP 200；配置 `enterprise.id=lundu`，入口正文和主资源没有 `君乐缘/junleyuan`。

白色 UI 视觉验收脚本 `output/playwright/lundu-v12-remote-color-qa.cjs` 在真实伦度域名通过 `390×844`、`414×896`、`768×1024`、`1440×900`：页面标题为“伦度机电｜电机与水泵制造”，四个视口 `scrollWidth` 分别等于视口宽度，`.login-page`、`.public-products-section`、`.commerce-section` 的计算背景均为 `rgb(255, 255, 255)` 且无背景图，Logo 可见，产品卡 5 个，正文无君乐缘，页面错误和控制台错误均为 0。截图保存为 `output/playwright/lundu-color-after-390.png`、`lundu-color-after-414.png`、`lundu-color-after-768.png`、`lundu-color-after-1440.png`。

商城交互验收脚本 `output/playwright/lundu-v12-remote-commerce-qa.cjs` 通过：产品详情可打开，询价单包含 1 个产品，390px 询价弹层为 `x=0/right=390/width=390`；状态依次经过“待提交询价”“待确认订单”“支付接口已预留”，支付占位和销售 Agent 均可打开并发送测试问题；页面错误和控制台错误为 0。

## 2026-10-06 产品详情箭头 hover 修复 v13

用户反馈产品详情按钮的箭头 hover 向右移动时被按钮边界裁切或与右侧询价按钮覆盖。根因是后置通用紧凑按钮规则设置了 overflow hidden，而箭头使用 translateX(4px)，按钮没有为位移预留尾部空间。本轮在 eiscore-base/src/styles/login-view.scss 文件末尾增加最终级联保护：产品详情按钮使用 overflow visible !important 和 padding-right: 8px !important，箭头 span 保持独立 flex 项并预留右侧间距。未修改产品数据、按钮文案、询价流程或后端服务。

发布前声明：目标服务为 web；分支/提交为 codex/systematic-refactor @ 561f3d83c760c7c0511a460b567af4eeced95359；完整 12 入口制品为 output/lundu-arrow-fix-release-20261006-v13.tar.gz，本地与远端归档 SHA-256 均为 6E7902C3DA9CE4A55B1602CFBC4435515E64EFA479D0A8F8E38B1EBA12991D94。manifest version 930f4ed6c854981e、569 项、89473006 bytes，入口 6258 字节；构建和聚合通过，入口和主资源没有君乐缘品牌。

远端发布使用 /opt/lundu-eiscore/.lundu-web-publish.lock，旧 release 已备份至 /opt/lundu-eiscore/backups/lundu-arrow-before-v13-20261006011850。归档 SHA 校验通过后原子替换完整 release，实际只执行 web-only Compose 重建；实际重建服务为 lundu-eiscore-web-1，DB、API、Agent、DeepSeek Web 和 Harness 未重建。Compose 仅报告既有 DeepSeek Web orphan 提示，没有清理其他容器。

线上门禁通过：/login、/asset-manifest.json、/config/eiscore-enterprise.json、/enterprise-assets/site/lundu-logo.png 均 HTTP 200；配置为 enterprise.id=lundu，入口主包为 /assets/index-CG3sdnEz.js，manifest 为 930f4ed6c854981e / 569 项，页面标题为“伦度机电｜电机与水泵制造”，正文没有君乐缘品牌。

浏览器脚本 output/playwright/lundu-arrow-remote-qa.cjs 在真实伦度域名通过 390x844 和 1440x900：hover 前后箭头均在详情按钮范围内，箭头向右移动 4px；移动端箭头右边界为 127.5px、详情按钮右边界为 137.5px、询价按钮左边界为 149.5px，桌面端箭头右边界为 184px、详情按钮右边界为 194px、询价按钮左边界为 206px，均无覆盖；按钮实际计算样式为 overflow visible、padding-right: 8px。浏览器页面错误和控制台错误均为 0，截图为 output/playwright/lundu-arrow-390.png 和 output/playwright/lundu-arrow-1440.png。

## 2026-10-06 产品图片铺满展示框与顶部横条移除 v14

用户反馈产品方向区域的水泵图片在展示框内留白过大，并要求移除产品展示栏上方的棕色/深色横条。本轮仅修改 eiscore-base/src/styles/login-view.scss 文件末尾的最终级联规则：.public-product-card 的 border-top 设为 0；产品图移除内边距并保持 object-fit: contain，防止产品主体被裁切；普通电机使用 scale(1.18)，JET/PST 水泵使用 scale(1.28)，WQ 潜水泵使用 scale(1.35)，图片容器保持 overflow: hidden。规则放在文件末尾，用于覆盖历史移动端、采购视觉和制造卡片规则，避免再次被 transform: none 或 object-fit: cover 覆盖。

发布前声明：目标服务为 web；当前分支为 codex/systematic-refactor，工作树包含其他 Agent 未提交改动，本轮只发布当前工作区生成的完整静态 dist；完整制品为 output/lundu-product-fill-final-20261006103100.tar.gz，本地与远端 SHA-256 均为 99A69426CD28C7A9FDDDA3732DF52F096F30B053D8F6C504197BE701A80CB84D，大小 53,580,429 字节。制品入口 6,258 字节，主包为 /assets/index-RHmY7e4A.js；manifest version 222c6db2e6eca7ed、569 项、89,473,958 bytes；入口、配置和主资源未包含君乐缘/junleyuan。影响范围仅为完整伦度静态 web；DB、API、Agent、DeepSeek Web 和 Harness 未重建。

远端发布使用 /opt/lundu-eiscore/.lundu-web-publish.lock。旧 release 已备份至 /opt/lundu-eiscore/backups/lundu-product-fill-final-before-20261006025004.tgz，校验归档后完成原子替换。实际执行 docker compose --env-file /opt/lundu-eiscore/.env -f /opt/lundu-eiscore/compose.yml up -d --no-deps --force-recreate web。实际重建服务为 lundu-eiscore-web-1；Compose 仅报告既有 lundu-eiscore-deepseek-web-1 orphan 提示，没有清理或重建其他服务。

真实线上 Playwright 在 390x844、414x896、768x1024、1440x900 完成验收：四个视口 scrollWidth 分别等于视口宽度；Logo 可见，正文不含君乐缘；5 个产品图片全部加载且自然尺寸为 1600x900；产品卡顶部计算样式为 0px none；图片均为 contain、无内边距，JET/PST 放大矩阵为 1.28，WQ 放大矩阵为 1.35；页面错误和控制台错误均为 0。截图保存为 output/playwright/lundu-product-final-390.png、lundu-product-final-414.png、lundu-product-final-768.png、lundu-product-final-1440.png。

## 2026-10-06 产品图片铺满展示框与顶部横条移除 v15

本轮重新从当前 `codex/systematic-refactor` 工作区构建并发布完整 web 制品，修复上轮源码最终级联规则未进入真正 EOF、导致 YC/YE3 电机图仍被旧 `transform: none` 覆盖的问题。`eiscore-base/src/styles/login-view.scss` 文件末尾现在统一保护产品卡：`.public-product-card { border-top: 0 !important; }`；产品图使用 `width/height: 100%`、`padding: 0 !important`、`object-fit: contain !important`、居中定位和容器 `overflow: hidden`；普通电机 `scale(1.18)`，JET/PST `scale(1.28)`，WQ `scale(1.35)`。

发布前声明：目标服务为 `web`；分支为 `codex/systematic-refactor`；工作树含其他 Agent 未提交改动，本轮没有覆盖或回退这些改动。先执行 `npm --prefix eiscore-base run build`，再执行 `node scripts/aggregate-frontend-dist.mjs` 和 `node scripts/generate-client-cache-manifest.mjs eiscore-base/dist`。`npm run test:syntax`（305 个脚本）、`npm run lint:changed`（23 个 JS/Vue 文件）和 `git diff --check` 通过。当前完整 12 入口制品归档为 `output/lundu-product-fill-final-20261006115144.tar.gz`，大小 `40,669,221` bytes，SHA-256 为 `30995167C126B02F26B1F8E026540E38A4C705D53E6EB2886549D88C23B6E9A4`；入口 `6,258` bytes，主包 `/assets/index-BVVQQPYd.js`，manifest `353e757b68f91784`、`561` 项、`76,532,280` bytes，归档中的文件数为 `565`。入口、公开配置和主资源没有 `君乐缘/junleyuan`，配置为 `enterprise.id=lundu`，Logo 为 `/enterprise-assets/site/lundu-logo.png`。

远端发布前通过 `/opt/lundu-eiscore/.lundu-web-publish.lock` 的 `flock` 独占锁，归档 SHA-256 与本地一致；旧 release 备份为 `/opt/lundu-eiscore/backups/lundu-product-fill-before-20261006035912.tgz`。临时目录校验通过后原子替换 `/opt/lundu-eiscore/release`，随后实际只执行：

```sh
docker compose --env-file /opt/lundu-eiscore/.env \
  -f /opt/lundu-eiscore/compose.yml \
  up -d --no-deps --force-recreate web
```

实际重建服务为 `lundu-eiscore-web-1`；DB、API、Agent、DeepSeek Web 和 Harness 均未重建。Compose 只报告既有 `lundu-eiscore-deepseek-web-1` orphan 提示，没有清理其他容器。远端入口 `6,258` bytes，主包 `/assets/index-BVVQQPYd.js`，manifest 为 `353e757b68f91784` / `561` 项 / `76,532,280` bytes；发布后 web 容器状态为 `Up`。

HTTP 门禁通过：`/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json`、伦度 Logo 和五张产品图均返回 HTTP 200；五张产品图均为 `1600x900` JPEG。入口、主包和公开配置的明确品牌匹配均为 false，公开配置 `enterprise.id=lundu`。

真实线上 Playwright 视觉验收脚本 `output/playwright/lundu-product-fill-final-qa.cjs` 及结果 `output/playwright/lundu-product-fill-final-qa.json` 在 `390x844`、`414x896`、`768x1024`、`1440x900` 全部通过：页面 `scrollWidth` 不超过视口，Logo 可见，正文没有君乐缘；5 个产品图片全部加载；每张图计算样式为 `object-fit: contain`、`padding: 0`、居中，媒体容器为 `overflow: hidden`，卡片顶部为 `0px none`，YC/YE3 为 `scale(1.18)`、JET/PST 为 `scale(1.28)`、WQ 为 `scale(1.35)`；页面错误和控制台错误均为 0。截图保存为 `output/playwright/lundu-product-fill-final-390.png`、`lundu-product-fill-final-414.png`、`lundu-product-fill-final-768.png`、`lundu-product-fill-final-1440.png`。

## 2026-10-06 制造服务卡顶部绿条移除 v16

用户反馈制造服务产品卡顶部出现绿色横条。根因是 `.manufacturing-series-card` 同时受历史商城通用 `border-top` 和制造卡局部 `border-top: 3px solid var(--login-theme)` 规则影响；绿色横条来自卡片 CSS 边框，不是图片内容或伪元素。本轮在 `eiscore-base/src/styles/login-view.scss` 的最终级联区域增加 `.manufacturing-series-card { border-top: 0 !important; }`，并在实际发布 CSS 中保留带 Vue scope 的选择器，确保三张制造服务卡均无顶部边框。没有修改产品图片、产品数据、询价流程或后端服务。

发布前声明：目标服务为 `web`；当前分支为 `codex/systematic-refactor`，基线提交为 `561f3d83c760c7c0511a460b567af4eeced95359`；工作树包含其他 Agent 未提交改动，本轮未覆盖或回退这些改动。全量构建在 Windows 上因 `VirtualAlloc` 内存不足导致 Vite/esbuild 服务退出，因此没有使用失败构建的半成品；使用上一轮已通过四视口验收的完整 12 入口制品作为基底，仅对实际引用的 `assets/LoginView-C_DBAQB8.css` 做确定性 CSS 后处理。完整归档为 `output/lundu-product-fill-v15-202610061227.tar.gz`，SHA-256 `A76252AC8268F0A4B6E92662B2E79A25547D2139D24E84CC69BBB1CF4CEEA0E8`，归档大小 `40,669,197` bytes；manifest `e25f3e96431cad8d`、`561` 项、`76,532,435` bytes，入口 `6,258` bytes，主包 `/assets/index-BVVQQPYd.js`。入口、公开配置和主资源没有“君乐缘/junleyuan”，配置为 `enterprise.id=lundu`，Logo 为 `/enterprise-assets/site/lundu-logo.png`。

远端发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock` 完成原子替换；旧 release 备份为 `/opt/lundu-eiscore/backups/lundu-product-fill-v15-before-20261006043805.tgz`。实际只重建 `lundu-eiscore-web-1`，`db`、`api`、`agent`、`deepseek-web` 和 `Harness` 均未重建。远端发布后入口仍为 `6,258` bytes，主包为 `/assets/index-BVVQQPYd.js`，manifest 为 `e25f3e96431cad8d / 561 / 76,532,435`，web 容器状态为 `Up`。

真实线上 Playwright 验收脚本 `output/playwright/lundu-greenbar-final-qa.cjs` 在 `390x844`、`414x896`、`768x1024`、`1440x900` 全部通过，结果保存在 `output/playwright/lundu-greenbar-final-qa.json`，截图为 `output/playwright/lundu-greenbar-final-390.png`、`lundu-greenbar-final-414.png`、`lundu-greenbar-final-768.png`、`lundu-greenbar-final-1440.png`。四个视口的 `scrollWidth` 分别等于视口宽度；页面标题为“伦度机电｜电机与水泵制造”；Logo 可见；三张 `.manufacturing-series-card` 的计算 `border-top` 均为 `0px none`；五张产品图全部加载且自然尺寸为 `1600x900`；正文无君乐缘品牌，页面错误和控制台错误均为 0。

## 2026-10-06 采购单与客服智能体悬浮组件 v17

本轮根据用户要求将独立站的用户可见“询价单/询单”统一为“采购单”，并将销售询单入口改为“客服智能体”。`eiscore-base/src/views/LoginView.vue` 保留现有 `/agent/sales/sessions` 会话接口和内部 `quoteItems` 兼容字段，只调整客户侧文案：产品卡使用“加入采购单”，顶部和采购弹层使用“采购单/我的采购单”，提交按钮使用“提交采购单”，支付返回使用“返回采购单”；客服文案统一为“客服智能体”，移除页面可见的“询问销售/销售 Agent/询价单”旧称。

客服面板不再使用整页遮罩，改为 `customer-service-widget` 固定在页面右下角：收起时显示“客服智能体”按钮，点击后展开同一消息流、快速提问、输入框和采购单入口，再次点击可收起。组件使用 `position: fixed`、安全区域和移动端宽高限制，面板不捕获页面滚动，也不产生横向溢出。

发布前声明：目标服务为 `web`；当前分支为 `codex/systematic-refactor`，基线提交为 `561f3d83c760c7c0511a460b567af4eeced95359`；工作树包含其他 Agent 未提交改动，本轮仅修改独立站 `LoginView.vue`、`login-view.scss` 与 QA/交接记录，没有覆盖或回退其他改动。`npm --prefix eiscore-base run build` 通过；`npm run test:syntax`、`npm run lint:changed`、`git diff --check` 通过（仅保留既有 Sass import、circular chunk 和大 chunk 警告）。完整 12 入口制品由当前 `eiscore-base/dist` 聚合生成：`output/lundu-procurement-customer-service-release-20261006.tar.gz`，SHA-256 `F9927FD52A081117531EDD6963605A433ED51C8D88782F6EAB7A9D6A75C6D6FE`；入口 `6,258` bytes；manifest `371c700348c5ed4a` / `561` 项 / `76,537,309` bytes；入口、配置和主资源没有 `君乐缘/junleyuan`，公开配置 `enterprise.id=lundu`。

远端发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`。旧 release 备份为 `/opt/lundu-eiscore/backups/lundu-procurement-customer-service-before-20261006114716.tgz`；归档校验通过后原子替换完整 `/opt/lundu-eiscore/release`，实际只重建 `lundu-eiscore-web-1`。`db`、`api`、`agent`、`deepseek-web` 和 Harness 未重建；Compose 仅报告既有 `lundu-eiscore-deepseek-web-1` orphan 提示，没有清理其他容器。远端发布后入口仍为 `6,258` bytes，主包 `/assets/index-DkcveSVK.js`，manifest 为 `371c700348c5ed4a / 561 / 76,537,309`，web 状态为 `Up`。

线上 HTTP 门禁通过：`/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json`、`/enterprise-assets/site/lundu-logo.png` 均返回 HTTP 200，配置返回 JSON 且 `enterprise.id=lundu`；入口和公开配置没有君乐缘品牌。线上 Playwright 脚本 `output/playwright/lundu-procurement-customer-service-qa.cjs` 及结果 `output/playwright/lundu-procurement-customer-service-qa.json` 在 `390x844`、`414x896`、`768x1024`、`1440x900` 全部通过：页面标题为“伦度机电｜电机与水泵制造”，四个视口 `scrollWidth` 等于视口宽度，客服入口文本为“客服智能体”且父容器计算 `position: fixed`；展开后面板完整位于视口内，`aria-expanded=true`，收起后面板从 DOM 移除且 `aria-expanded=false`；页面可见文案包含“采购单”且不含“询价单/询问销售/销售 Agent/询单”，页面错误和控制台错误均为 0。截图保存在 `output/playwright/lundu-procurement-customer-service-390-expanded.png`、`414-expanded.png`、`768-expanded.png`、`1440-expanded.png` 及对应收起状态截图。

## 2026-10-06 竖向客服面板与销售消息 SSE v18

本轮把客服智能体改成竖向长方形面板，并让消息列表成为主体区域。`eiscore-base/src/views/LoginView.vue` 为每次提问先创建一条空的 assistant 消息，再读取 `ReadableStream` 的 SSE 增量，逐段更新同一条消息；响应不是 `text/event-stream` 时仍回退到原 JSON `answer`。重复发送会中止上一条请求，异常时保留已经显示的增量。`eiscore-base/src/styles/login-view.scss` 的最终级联规则将桌面面板限制为 `390×720`（受视口高度约束），移动端使用 `calc(100vw - 24px)` 和 `min(78dvh, 680px)`；标题和说明压缩，消息区使用 `flex: 1`，快捷问题、输入区和采购单入口固定在底部。

公开销售接口保留默认 JSON 兼容行为；当请求体包含 `stream: true` 或 `Accept: text/event-stream` 时返回 `text/event-stream; charset=utf-8`，按短片段发送 OpenAI 兼容的 `choices[0].delta.content` 事件并以 `[DONE]` 结束。远端现有销售运行时源码仍保留其他 Agent 的旧模型兼容字段，本轮只追加 SSE 传输分支，没有覆盖远端后端源码树。

发布前声明：目标服务为 `web` 和承载 `/agent/sales` 的 `agent`；当前分支为 `codex/systematic-refactor`，基线提交为 `561f3d83c760c7c0511a460b567af4eeced95359`；本地工作树含其他 Agent 未提交改动，本轮只修改客服视图/样式、销售 SSE 分支和 QA 脚本，没有回退或覆盖无关改动。完整 12 入口制品为 `output/lundu-customer-service-streaming-release-20261006.tar.gz`，SHA-256 `F46817A3E4C05E5B100789C3030FADB008D694CA79B5E1482AEF67D61F0789A1`，归档大小 `40,669,692` bytes；本地 manifest 为 `e8ca82a1b2779f43` / `561` 项 / `76,540,707` bytes，入口 `6,258` bytes，主包 `/assets/index-CmNu499U.js`。本地入口、公开配置和主包没有 `君乐缘/junleyuan`，公开配置 `enterprise.id=lundu`。

远端发布前使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`。销售后端源码先备份为 `/opt/lundu-eiscore/backups/company-sales-agent-before-sse-<timestamp>.js` 和 `/opt/lundu-eiscore/backups/realtime-index-before-sales-sse-<timestamp>.js`，通过 `node --check` 后仅重建 `lundu-eiscore-agent-1`；数据库、API、DeepSeek Web 和 Harness 未重建。静态 release 先原子备份为 `/opt/lundu-eiscore/backups/lundu-customer-service-streaming-before-20261006151026`，再替换完整 12 入口制品，实际只重建 `lundu-eiscore-web-1`；Compose 仅报告既有 `lundu-eiscore-deepseek-web-1` orphan，没有清理其他容器。

发布后远端入口为 `6,258` bytes，主包 `/assets/index-CmNu499U.js`；manifest `e8ca82a1b2779f43` / `561` 项 / `76,540,707` bytes；`web` 与 `agent` 均为 `Up`/healthy。HTTP 门禁通过：`/login`、`/asset-manifest.json`、`/config/eiscore-enterprise.json`、伦度 Logo 均返回 200，配置为 `enterprise.id=lundu`，入口、配置和主包无君乐缘品牌。真实销售链路创建公开会话返回 201，发送 `{stream:true}` 消息返回 `text/event-stream; charset=utf-8`，收到 `data` 增量和 `[DONE]`。线上 Playwright 使用 `output/playwright/lundu-procurement-customer-service-qa.cjs`，在 `390×844`、`414×896`、`768×1024`、`1440×900` 全部通过：标题为“伦度机电｜电机与水泵制造”，消息区高度分别约 `357/381/416/408px`，输入区 `58px`，面板均高于宽，入口固定右下角，展开/收起、采购单文案、无横向溢出和无控制台错误均通过。

## 2026-10-08 电机概况图片左下角背景修补

用户反馈企业概况电机图片左下角出现缺口。本轮确认根因是 PNG 原始背景区域存在白色像素，网页容器没有裁切；仅修补两份运行时与企业包资源的背景区域 `(x=0..55, y=910..919)`，产品主体、文字和其他像素均未改动，尺寸保持 `1920×920`。两份文件逐字节一致，修补后 SHA-256 均为 `c5dc0deaad5fe31f9a4ae69de5661da30b027826d35ef6906a146ca5050ccd47`；差异 bbox 为 `(0,910,56,920)`，共改变 537 个像素，区域外像素哈希保持 `91cf404de1942b8f55fb827229de83f3700dfa72c97d3430284c910db208da68`。

发布前声明：目标服务为 `web`；分支/提交为 `codex/systematic-refactor @ 2cd5076c`；完整 12 入口制品为 `output/lundu-motor-corner-release-2cd5076c.tar.gz`，SHA-256 `E323B01186147711443C7526BBA36EB013506C87BE0F3C71E74EEBA1896DB238`；manifest 为 `e76b6d03cda554ae`、564 项。运行时 PNG 与 `enterprise-packs/lundu` PNG 同步更新，避免后续重建恢复旧图片。

远端发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`，旧 release 备份为 `/opt/lundu-eiscore/backups/release-pre-motor-corner-2cd5076c-20261008130105`，原子替换完整 release 后只执行 `docker compose ... up -d --no-deps --force-recreate web`，实际重建 `lundu-eiscore-web-1`；DB、API、Agent、DeepSeek Web 和 Harness 均未重建。

本地与线上 Playwright 在 `390×844`、`414×896`、`768×1024`、`1440×900` 全部通过：图片哈希一致、Logo 可见、页面品牌为伦度、无横向溢出、无浏览器错误。截图及 `remote-qa.json` 保存在 `output/lundu-motor-corner/`。

## 2026-10-08 两个制造服务详情页发布

源码提交 `20573070` 将首页 04 品质与交付、05 技术与服务链接至独立公开详情页，中英文内容以 `/enterprise-assets/site/service-pages.json` 配置并同步企业包。页面保留伦度白底蓝色、Logo、产品选择、采购单和客服入口。

完整 12 入口制品为 `output/lundu-service-pages/full-dist-final`，归档 `lundu-service-details-20573070.tar.gz`，SHA-256 `a596513039cfe1d31e228272d61e56cf47e7d4dc6eca90f2ecbe711337700632`；入口 6258 字节、主包 `/assets/index-B82MCbhh.js`，manifest `78294f227a301616` / 600 项 / 77,234,068 字节。主站由当前源码在远端独立 staging 构建；11 个微应用源码未变，使用同源码已验收制品，发布锁内逐文件确认与线上一致。本地陈旧共享 dist 已被拦截，没有发布。详见多 Agent 协作文档与 `output/lundu-service-pages/micro-entry-provenance.json`。

使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`，确认旧版仍为 `e76b6d03cda554ae` 后切换完整 release。备份 `/opt/lundu-eiscore/backups/release-pre-service-details-20573070-20261008150642`；实际只重建 `lundu-eiscore-web-1`，容器 ID 比较确认其他服务未变化。回退时在同一锁内把备份恢复为 release，再执行 web-only 重建，禁止回退业务数据。

线上 24 个 HTTP 资源与本地逐字节一致，配置 `enterprise.id=lundu`，Logo 正常、页面无君乐缘品牌。验收脚本及证据位于 `output/lundu-service-pages/`；没有提交真实订单或测试真实客服模型回复。

最终线上四视口视觉验收覆盖两个详情页共 8 项，全部通过：图片加载、Logo、单行按钮、无横向溢出、无错误品牌及浏览器错误。首页返回、FAQ、采购单资料模板、产品选择、客服窗体及中英文切换通过。启用 Service Worker 的首页进入详情/刷新 smoke 也通过，manifest 保持 `78294f227a301616`。对应证据为 `remote-qa.json`、`remote-http-qa.json` 与 `remote-cache-smoke.json`；流式客服使用 mock，未调用真实模型。运行目录为 `/opt/lundu-eiscore/release`，后续发布须保留完整 12 入口。

## 2026-10-09 远端中英文按钮稳定性修复

用户反馈远端桌面首页语言按钮消失。检查时远端发布配置仍支持中英文，未直接捕获该次现场过程；回归已复现并修复并发旧响应覆盖新语言资料、接口失败 fallback 覆盖已发布资料这两项隐患。提交 `014f5a72`、`10dde8b6` 统一请求序号保护、保留已发布 profile，并在首载故障时依据公开服务配置显示语言入口。失败切换会提示重试，URL 只反映成功加载的语言。

目标服务仅 `web`；完整 12 入口制品 `output/lundu-locale-fix-20261009/full-dist` 来自提交 `10dde8b6` 的隔离主站构建和源码未变的已验收 11 微应用。归档 SHA-256 `495b49636c38d697b443c9938296991285e8e7666ea35abd57e0b7cea8a8f529`；入口 6295 字节、主包 `/assets/index-Dac0SPOV.js`；manifest `a38aab250e541bcc` / 566 项 / 78,061,435 字节。静态审计确认 2337 个本地资源引用完整，微应用逐文件 SHA-256 与此前远端一致。

共享锁内确认旧 manifest `78294f227a301616` 后原子替换 release；备份 `/opt/lundu-eiscore/backups/release-pre-locale-10dde8b6-20261009061902`，实际只重建 `lundu-eiscore-web-1`，新容器 `96b0626f5f08`。其他容器 ID 未变化。回退时在同一锁内恢复备份并只重建 web。

远端四视口首页/两个服务页共 12 场景的中英往返、24 个 HTTPS 资源与本地字节核对均通过；Logo 为伦度，正文无君乐缘、无横向溢出或页面错误。桌面与手机截图已视觉检查。Service Worker 开启后，根地址进入首页、英文切换与刷新仍显示两个按钮并保留 `lang=en-US`；manifest 为 `a38aab250e541bcc`，无页面/控制台错误。证据目录 `output/playwright/lundu-locale-20261009`、`output/lundu-locale-fix-20261009`。后续 web 发布应保留这两项源码修复并使用当前完整制品来源，避免旧构建覆盖。

## 2026-10-09 客服头像同步

提交 `a2db08bc` 将客服入口改为 GPT Image 2 蓝白耳麦人物头像，固定 48×48，保持中英文名称、键盘与展开/收起操作。资源为 `eiscore-base/src/assets/customer-service-avatar.png`，192×192 透明 PNG，SHA-256 `472d409657bd6852f0565215393c569c2df3e6d5ccfa67bd5f3de5e4488c2c32`。

发布前已向 DeepSeek 整合聊天声明仅更新 web。完整 12 入口制品 `output/lundu-support-avatar-20261009/full-dist`，来自提交 `a2db08bcb1dde4893393518fa519ccd24d559b7a` 的隔离主站构建和源码未变的已验收 11 微应用；归档 SHA-256 `c3a121994d013a90c48c87be4d7874662b630cc164e54b3eea36543cfbd838b6`。入口 6295 字节、主包 `/assets/index-C7FhDJnR.js`，manifest `2051dc0c3fd37e54` / 567 项 / 78,114,439 字节。锁内校验旧版 `a38aab250e541bcc`、全部 manifest 资源、伦度品牌及微应用逐文件哈希后原子替换，仅重建 `lundu-eiscore-web-1`，新容器 `b9f3b78e49b3`；其他容器 ID 未变。

备份 `/opt/lundu-eiscore/backups/release-pre-avatar-a2db08bc-20261009072645`。回退必须持有 `/opt/lundu-eiscore/.lundu-web-publish.lock`，恢复该完整目录并只重建 web。后续发布保留头像及 `014f5a72`、`10dde8b6` 语言修复，不得发布陈旧入口。

本地及远端 `/login` 四视口中英头像/交互验收通过，已检查桌面与手机截图；无横向溢出、错误品牌或页面异常。25 个 HTTPS 资源和制品逐字节一致；Service Worker 开启的详情刷新及首页英文刷新通过。未发送真实客服消息或订单。证据位于 `output/playwright/lundu-support-avatar-20261009`、`output/lundu-support-avatar-20261009`。当时本机 DNS 返回 `103.73.220.77`，服务器返回 `149.104.26.71`；验收固定部署 IP，保留域名与证书验证，未修改 DNS/hosts。详细制品来源及发布记录见协作文档同日“客服头像入口发布”。

## 2026-10-09 客服窗口美化同步

### 分享卡片与站点图标交接

本轮源码把标准 Open Graph/Twitter 分享元数据与 favicon 做成企业构建注入。伦度构建使用绝对地址 `https://lundu.eiscore.top/enterprise-assets/site/share-card.jpg`，图片尺寸 `1200×630`；同时输出伦度标题、描述、站点名、SVG favicon 和 Apple touch icon。核心模板不再硬编码伦度资源，未配置分享图或 favicon 的其他企业不会继承伦度路径。微信菜单内自定义分享仍需认证公众号和服务端 JSSDK 签名；抖音 H5 官方能力主要为图片/视频发布，不保证任意网址聊天卡片。

发布前声明：目标仅 `web`；分支 `codex/systematic-refactor`；制品目录 `output/lundu-share-metadata-20261009/full-dist`，根站使用本轮构建，11 个微前端来自上一轮已验收完整制品。远端发布必须持有 `/opt/lundu-eiscore/.lundu-web-publish.lock`，只重建 `lundu-eiscore-web-1`，不能重建 DB、API、Agent、DeepSeek Web 或 Harness。验收至少包括 `/login`、`/config/eiscore-enterprise.json`、`/asset-manifest.json`、分享图、favicon 的 HTTPS 200，以及 HTML 中绝对 OG URL 和无君乐缘品牌。

提交 `cece9665`、`ff05d042` 将客服窗体调整为白底蓝色、380×600 上限，缩小标题和头部头像、扩大对话主体，使用灰色客服/蓝色用户气泡及多行输入和图标发送。欢迎语与快捷问题仅出现在首次对话；原 48×48 头像入口保留。修复客服消息 reactive 引用，流式回复会逐段显示；阅读历史不抢滚动，手机键盘弹出时按 visualViewport 调整窗体。

仅发布 `web`，构建来源提交 `ff05d042cab17617161db381af2568a193413ecc`，完整 12 入口目录 `output/lundu-support-window-20261009/full-dist-final`；归档 SHA-256 `d179a00f1d2bb27a60df8e9deaf195591922ab320869d3bf8238ca8a18ca0f9e`。Windows 构建因内存不足失败后，改用远端隔离源码快照构建主站；11 个源码未变的微应用在锁内与运行版本逐文件核对一致。失败产物和同目录旧 `full-dist` 没有发布。入口 6295 字节、主包 `/assets/index-DVSuB0h1.js`，manifest `3f41e8af83c33350` / 601 项 / 77,277,578 字节。

## 2026-10-09 分享卡片与站点图标发布

发布前声明：目标服务为 `web`；分支 `codex/systematic-refactor`，提交 `093d05cf`；制品目录 `output/lundu-share-metadata-20261009/full-dist`，归档 SHA-256 `fb2ab1a60c18ee9523b32a168b0c9948231c33ff879ac465fc0b23f26417bc0c`；完整 12 入口，manifest `7555e59f25c2b26d` / 569 项 / 78,221,469 bytes，入口 `7,617` bytes，主包 `/assets/index-5G3f1K6B.js`。影响范围仅为完整静态 web release，其他服务不重建。

2026-10-09 11:55 UTC 在 `/opt/lundu-eiscore/.lundu-web-publish.lock` 内完成发布。旧 manifest `3f41e8af83c33350` 和归档 SHA 校验通过后，旧 release 备份为 `/opt/lundu-eiscore/backups/release-pre-share-metadata-093d05cf-20261009115516`，原子替换 release，实际执行 `docker compose ... up -d --no-deps --force-recreate web`，仅重建 `lundu-eiscore-web-1`，容器 `21d774403df2`；DB、API、Agent、DeepSeek Web 和 Harness 均未重建。

线上验收：`/login`、`/config/eiscore-enterprise.json`、`/asset-manifest.json`、分享图、SVG favicon、PNG Apple touch icon 和 `/favicon.ico` 全部 HTTP 200，分享图 `image/jpeg` 94,400 bytes，Apple 图标 `image/png` 1,928 bytes。HTML 已输出绝对 Open Graph/Twitter 元数据和 favicon，配置为 `enterprise.id=lundu`，页面无“君乐缘”。Playwright CLI 因本机缺少 Chrome distribution 未启动；已完成真实 HTTPS HTML、Content-Type、字节数和资源门禁。

共享锁内验证旧版 `2051dc0c3fd37e54` 后原子替换 release，实际仅重建 `lundu-eiscore-web-1`，容器 `5043104240b8`；其他容器 ID 未变。备份 `/opt/lundu-eiscore/backups/release-pre-support-window-ff05d042-20261009085740`。回退须持有 `/opt/lundu-eiscore/.lundu-web-publish.lock`，恢复完整备份并只重建 web。

语法、变更 lint、登录/品牌/配置回归通过。25 个 HTTPS 资源与制品逐字节一致；Service Worker 下服务页刷新、首页英文切换与刷新通过，无错误品牌及控制台错误。源码已推送至正确的 EISCore Git 远端。本地及远端四视口中英文客服交互各 8/8 PASS，已人工检查截图，客服窗口无裁切、重叠和横向溢出；证据位于 `output/playwright/lundu-support-window-20261009`，制品与 HTTP/cache 证据位于 `output/lundu-support-window-20261009`。流式请求使用 mock，键盘几何使用模拟 visualViewport；未验证真实模型、提交订单或宣称真机键盘验证。后续 Agent 发布 web 时必须保留语言修复、头像和本次窗口/流式更新，不能用旧入口覆盖。详细发布声明、来源及既有移动英文导航按钮裁切记录见多 Agent 协作文档同日“客服窗口美化发布”。
