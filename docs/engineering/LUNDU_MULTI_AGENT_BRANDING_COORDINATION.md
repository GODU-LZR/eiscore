# 伦度多 Agent 品牌与发布协作记录

## 目的

本文件记录伦度独立站反复显示“君乐缘”的协作事故，并作为所有 Agent 在同一项目中修改、构建、验收和发布前必须阅读的共同约束。

本轮只记录问题和协作规则，不修改前端代码，不删除仓库中合法保留的君乐缘企业包、素材或测试资产。

## 已确认的问题

伦度线上地址是 `https://lundu.eiscore.top/login`，远端静态发布目录是 `/opt/lundu-eiscore/release`。线上曾多次从正确的伦度构建回退到君乐缘页面，根因不是浏览器缓存或 DNS，而是多个 Agent/发布流程直接写入同一个 release 目录，旧制品覆盖了当前制品。

已观察到的覆盖证据：

- 正确伦度入口约为 6257 字节，标题为“伦度机电｜电机与水泵制造”，主配置的 `enterprise.id` 为 `lundu`。
- 被覆盖的旧入口约为 5318 字节，引用旧 EISCore 主包，页面硬编码君乐缘文案和 `/company-assets/junleyuan-mark.png`。
- 旧发布同时把 `asset-manifest.json` 退回旧清单，甚至使 `/config/eiscore-enterprise.json` 被 SPA fallback 返回 HTML。
- 仅替换企业 JSON 或 Logo 不能修复旧 JS 中的硬编码品牌；必须发布正确构建出的完整静态入口和资源。
- 发布脚本若对已存在的 `release` 使用 `cp -a backup release`，会把备份嵌套到 release 内并污染 manifest；正确做法是先清空/替换 release，再叠加 dist。

仓库中出现“君乐缘”并不自动代表错误：君乐缘企业包、独立站素材、历史测试和多租户兼容资产需要保留。错误边界是：伦度构建入口、伦度公开配置、伦度线上页面和伦度发布 manifest 不能引用君乐缘品牌。

## 轻量发布协作协议

伦度远端当前是开发/验收 Docker Compose 环境，不是严格生产环境。三个 Agent 都可以在自己的职责范围内发布，不设置单一发布权限；协作目标是避免互相覆盖和让服务回退到错误客户版本。

以下规则对所有 Agent 生效：

1. 所有 Agent 都可以发布自己负责的服务，但发布前必须声明职责、目标服务、当前分支/提交、制品路径、预计影响的其他 Agent。
2. 所有前端 Agent 必须在 `github-eiscore-refactor` 工作区构建，禁止从 `github-eiscore`、旧 WSL checkout、君乐缘工作区或历史 tarball 直接复制入口 JS/CSS。
3. 后端整合 Agent 可以发布 `db`、`api`、`agent`、Harness 等后端服务；独立站 Agent 和前端整合 Agent 可以发布 `web`。跨职责重建服务前，先通知对应 Agent。
4. 不使用无范围的 `docker compose up -d` 作为日常更新命令，只重建本次修改涉及的服务。
5. web 发布必须使用同一个完整 dist，并在保留微应用资源的临时目录中合并；不得只复制 `index.html`、单个主 JS、单个 Logo 或单个配置文件。
6. 发布前必须生成完整 `asset-manifest.json`，并检查 manifest 不包含 `release.codex-bak-*`、`carousel-incoming`、`carousel-prev` 等备份目录。
7. web 发布只能执行：

   ```sh
   docker compose --env-file /opt/lundu-eiscore/.env \
     -f /opt/lundu-eiscore/compose.yml \
     up -d --no-deps --force-recreate web
   ```

   后端 Agent 发布后端服务时不要顺带重建 web；前端 Agent 发布 web 时不要顺带重建后端服务。
8. 任何 Agent 发现远端不是伦度页面，先暂停自己的发布动作，记录入口大小、主包名、manifest 数量、配置响应类型和容器挂载，并通知另外两个 Agent。
9. 发布完成后必须回报实际重建的服务、入口主包、manifest 数量、线上页面标题和品牌验收结果。

## 发布前品牌门禁

任何会更新 web 的 Agent 必须逐项通过以下检查，任何一项失败都停止发布：

```sh
test -f dist/index.html
test -f dist/config/eiscore-enterprise.json
test -f dist/enterprise-assets/site/lundu-logo.png
rg -n "君乐缘|junleyuan" dist/index.html dist/assets dist/config || true
```

最后一条允许仓库中合法的历史资源存在，但伦度入口主包、配置和首屏公开内容必须没有君乐缘品牌。发布后必须验证：

```text
GET /login                         -> 200, 伦度标题/页面
GET /config/eiscore-enterprise.json -> 200, application/json, enterprise.id=lundu
GET /asset-manifest.json           -> 200, application/json
GET /enterprise-assets/site/lundu-logo.png -> 200, image/png
```

浏览器验收至少覆盖 `390x844` 和 `1440x900`，确认 Logo、伦度公司名、产品内容可见，页面正文不出现“君乐缘”，且控制台没有异常错误。

## Agent 协作流程

### 独立站登录页 Agent

- 只修改自己负责的源码范围。
- 开始前阅读本文件和 `LUNDU_REMOTE_BRANDING_FIX_20260927.md`。
- 完成后报告：修改文件、构建命令、产物目录、品牌门禁结果、是否请求发布。
- 可以发布 web，但必须使用当前工作区重新构建的完整 dist，并提前通知 DeepSeek 前端整合 Agent。
- 不得重建后端容器，不得覆盖 DeepSeek/Harness 的后端制品。

### DeepSeek/Harness 后端 Agent

- 负责把 DeepSeek Harness、数字分身或 BI 变更合并到当前重构分支。
- 合并后必须重新构建完整 `eiscore-base/dist`，不能沿用旧 dist 或从其他客户 release 复制入口。
- 合并前检查 `index.html` 主包引用、企业配置、Logo 和 manifest 生成脚本。
- 可以发布自己负责的 `db`、`api`、`agent`、Harness 服务，但不能直接替换独立站静态 release。
- 若后端改动需要 web 配置或入口配合，先通知独立站 Agent 和前端整合 Agent。

### DeepSeek/Harness 前端整合 Agent

- 可以发布 web，但必须把独立站登录页和 DeepSeek 前端整合放在同一个完整 dist 中重新构建。
- 不得用 DeepSeek 默认站点或君乐缘旧入口替换伦度入口；发布前必须通知独立站 Agent。
- 发布后报告入口主包、manifest 数量、伦度配置和浏览器验收结果。

### 复核 Agent

- 可以只读复核；如需发布修复，先声明自己接管的服务范围，不能默认覆盖其他 Agent 的服务。
- 重点检查是否存在旧主包、旧 Logo、君乐缘硬编码、错误 fallback、备份目录进入 manifest，以及其他 Agent 是否绕过职责声明和范围协作。
- 失败时给出具体文件、URL、时间戳和阻断原因。

## 给其他 Agent 的统一提示词

将下面提示词作为新 Agent 的首条任务上下文；按职责选择其中一段，但保留共同约束。

### 通用提示词

```text
你正在参与 EISCore codex 重构分支的多 Agent 协作。先阅读：
docs/engineering/LUNDU_MULTI_AGENT_BRANDING_COORDINATION.md
docs/engineering/LUNDU_REMOTE_BRANDING_FIX_20260927.md

当前伦度开发/验收站是 https://lundu.eiscore.top/login，发布目录是
/opt/lundu-eiscore/release。仓库中君乐缘资产可以合法保留，但伦度构建入口、伦度公开配置、伦度线上页面不得出现君乐缘品牌。

你可以在声明职责后发布自己负责的服务，但必须先通知另外两个 Agent，不能覆盖其他 Agent 的未提交改动或正在运行的发布。完成后报告修改文件、验证命令、实际重建的服务、结果和线上入口版本。任何 web 发布前都必须使用当前 github-eiscore-refactor 的完整 dist，并通过伦度品牌门禁。
```

### 独立站登录页 Agent 提示词

```text
你负责伦度独立站前端修改。只在 github-eiscore-refactor/eiscore-base 内工作。
先确认 LoginView、PumpBomViewer、企业配置和资源引用来自伦度配置，不要把客户名称、Logo 或素材硬编码为君乐缘。完成后运行 npm run build，并检查 dist/index.html、dist/config/eiscore-enterprise.json、dist/enterprise-assets/site/lundu-logo.png。需要部署时先在协作消息中声明将重建 web，并通知 DeepSeek 前端整合 Agent。
```

### DeepSeek/Harness 集成 Agent 提示词

```text
你负责 DeepSeek Harness、数字分身或 BI 集成。集成必须保持企业站品牌配置与运行时边界，不得复制旧客户 release 或旧入口 JS。完成合并后重新构建完整 eiscore-base/dist，检查主包和企业配置没有君乐缘公开品牌引用，并运行相关回归测试。需要发布时可以重建自己负责的后端服务；如果涉及 web，先通知独立站 Agent 并共同确认完整 dist。
```

### 独立站 Web 发布 Agent 提示词

```text
你负责伦度独立站 web 发布。发布前先读取协作文档，记录当前远端 index.html 的大小、主包、manifest 数量和容器挂载，并在协作消息中通知 DeepSeek 后端和前端 Agent。使用当前 codex 重构分支的单一完整 dist，从 /opt/lundu-eiscore/release 的完整伦度备份恢复基础内容，再叠加 dist；先替换目标 release，不能把备份复制成 release 的子目录。生成完整 asset-manifest.json，确认 manifest 不包含任何备份目录。只重建 web，不顺带重启 db/api/agent/deepseek-web/Harness。发布后用 curl 和 Playwright 在 390x844、1440x900 验收：页面标题、伦度 Logo、enterprise.id=lundu、产品内容、无君乐缘文本、无控制台错误。失败立即停止并报告证据。
```

### 复核 Agent 提示词

```text
你负责发布复核，不直接改代码或部署。检查当前 dist 和远端是否来自同一版本，入口是否引用旧主包，配置是否返回 JSON，manifest 是否包含备份路径，线上公开 DOM 是否出现君乐缘。输出 PASS/FAIL、证据 URL、文件路径、时间戳和阻断原因。发现任意品牌混淆或版本不一致时，暂停相关发布并通知三个 Agent。
```

## 交接模板

```text
任务：
负责 Agent：
工作区/分支：
修改文件：
构建命令与结果：
品牌门禁：PASS / FAIL
构建产物路径：
是否需要远端发布：是 / 否
协作通知对象：
阻断项或风险：
```

## 当前状态

本文件创建时，伦度线上已恢复为当前重构分支制品。最近一次恢复只重建 web，未重启数据库、API、Agent 或 Harness。之后三个 Agent 均可发布自己负责的服务，但必须按本文件的声明、范围和验收流程协作。

## 2026-10-09 分享卡片与网站图标构建交接

本轮目标是让外部爬虫和支持 Open Graph 的分享入口读取伦度网站标题、描述、1200×630 分享图与站点图标。微信自定义菜单分享仍需要认证公众号、JS 接口安全域名、服务端 `access_token`/`jsapi_ticket` 签名；抖音 H5 官方能力主要面向图片/视频发布页，不承诺任意 URL 的聊天卡片。没有把平台密钥放入前端。

源码改动范围：`eiscore-base/index.html`、`eiscore-base/vite.config.js`、`scripts/vite-enterprise-share-metadata.mjs`、`packages/eiscore-platform/src/enterprise-seo.mjs`、分享回归测试、伦度企业包 SEO 字段和资源 Manifest。核心模板默认恢复为 `/favicon.ico`，分享图和 favicon 由企业构建变量注入；运行时 SEO 未配置资源时不再 fallback 到伦度资源。伦度企业包显式配置 `assets/site/share-card.jpg` 和 `assets/site/favicon.svg`，新增 `lundu-favicon.png` 供 Apple touch icon 使用。

发布声明：目标服务 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`；构建变量使用 `VITE_ENTERPRISE_SHARE_ORIGIN=https://lundu.eiscore.top`、伦度分享图、favicon 和标题描述。制品为 `output/lundu-share-metadata-20261009/full-dist`，根站由本轮源码构建，11 个微前端沿用上一轮已验收的完整入口并逐目录合并；发布前生成 `asset-manifest.json`，版本和数量以最终归档为准。预计影响只有 `lundu-eiscore-web-1`，不重建 DB、API、Agent、DeepSeek Web 或 Harness。发布完成后必须检查 HTML 的绝对 OG 图片 URL、favicon、`enterprise.id=lundu`、HTTP 200 资源和四视口页面。

## 2026-10-08 公司简介全球线路图发布

公司简介右侧媒体改为独立配置 `aboutImage`，不改变首屏轮播；伦度部署配置及中英文企业包均指向 `/enterprise-assets/site/lundu-world-routes-20261008.webp`（2048×1152 WebP）。图片在媒体容器中按 16:9、`object-fit: contain` 展示，点击可查看原图。修正后平板也采用单列布局，避免 768px 视口挤窄公司文字。

发布声明：目标服务 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`，基线 `2dad6a669d12300020e8c1c7283362ee63a36250`。使用完整 11 微前端构建，归档 `output/lundu-about-map-release-20261008.tar.gz`，SHA-256 `A3B597C954D0C39B1400BFFBF1551A251476BB6167733F65C1068555C62AA729`。品牌门禁通过，配置为 `enterprise.id=lundu`，入口 `/assets/index-BnbPYGd9.js`，manifest `59c9ccedef69c60a` / 562 项 / 76,686,588 bytes。地图本地与线上 SHA-256 一致：`923f6d77730de5e1217bec3175411e6d5c1a4d66b12e0fd784f862678297fe84`。

远端使用共享发布锁完成原子替换，旧版备份为 `/opt/lundu-eiscore/backups/lundu-about-map-before-20261008083134.tgz`；实际只重建 `lundu-eiscore-web-1`。DB、API、Agent、DeepSeek Web 和 Harness 均未重建。Compose 提示既有 `lundu-eiscore-deepseek-web-1` orphan，本次未清理或更改它。线上 `/login`、公开配置、manifest、伦度 Logo 与地图均返回 200；真实站点 Playwright 在 390×844、414×896、768×1024、1440×900 全部通过，地图完整加载、无横向溢出、无君乐缘文本和浏览器错误。

## 2026-10-08 独立站完整制品同步

本次发布目标服务为 `web`，来源工作区 `github-eiscore-refactor`、分支 `codex/systematic-refactor`、提交 `7071483d`。制品为完整 12 入口静态目录（根站加 11 个微前端），归档 `output/lundu-independent-site-7071483.tar.gz`，SHA-256 `75F57DD6A0EFD1CA9E3A741DB434970F31D89AB520A15C599483C1B11E31A172`。入口为 `6,258` 字节，主包 `/assets/index-C8MjTKaw.js`；manifest 为 `e53bbae10ffacf7d`、`564` 个 URL、`78,214,680` 字节。入口、公开配置和主资源未包含君乐缘品牌，配置 `enterprise.id=lundu`。

发布前通过 `/opt/lundu-eiscore/.lundu-web-publish.lock` 校验归档和品牌门禁，旧 release 已备份为 `/opt/lundu-eiscore/backups/release-pre-7071483-20261008120939`，随后原子替换 `/opt/lundu-eiscore/release`。实际只执行 web-only Compose 重建，重建服务为 `lundu-eiscore-web-1`；`db`、`api`、`agent`、`deepseek-web` 和 Harness 未重建。Compose 仅报告既有 `lundu-eiscore-deepseek-web-1` orphan，没有清理或修改它。

线上验收通过：`/login`、`/config/eiscore-enterprise.json`、`/asset-manifest.json` 和 `/enterprise-assets/site/lundu-logo.png` 均返回 HTTP 200；配置返回 JSON 且 `enterprise.id=lundu`，页面标题为“伦度机电｜电机与水泵制造”，入口不含君乐缘。线上 Playwright 在 `390x844`、`414x896`、`768x1024`、`1440x900` 通过，采购单和客服智能体流式面板可用，页面无横向溢出、无旧询价文案和浏览器错误。

Git 提交 `7071483d` 已同步到 `https://github.com/GODU-LZR/eiscore.git` 的 `codex/systematic-refactor`。本地 `origin` 仍指向 `deepseek-ai/deepseek-harness`，未向错误仓库推送；`upstream` 的 push URL 仍为无效地址。

## 2026-10-08 电机概况图片修补交接

独立站 Agent 完成提交 `2cd5076c`（`fix(lundu): repair motor overview image corner`）。本次只修补 `lundu-overview-motors.png` 的左下角背景区域 `(0,910,56,920)`，并同步运行时资源与 `enterprise-packs/lundu` 资源；图片尺寸仍为 `1920×920`，修补后两份 SHA-256 均为 `c5dc0deaad5fe31f9a4ae69de5661da30b027826d35ef6906a146ca5050ccd47`。产品主体、文字和区域外像素未改动。

本轮 web 发布声明：目标服务 `web`；制品 `output/lundu-motor-corner-release-2cd5076c.tar.gz`，SHA-256 `E323B01186147711443C7526BBA36EB013506C87BE0F3C71E74EEBA1896DB238`；manifest `e76b6d03cda554ae` / 564 项；远端备份 `/opt/lundu-eiscore/backups/release-pre-motor-corner-2cd5076c-20261008130105`。使用共享锁原子替换完整 12 入口 dist，实际仅重建 `lundu-eiscore-web-1`，其他 Agent 的 DB、API、Agent、DeepSeek Web、Harness 未重建。

线上与本地四视口验收均通过（`390×844`、`414×896`、`768×1024`、`1440×900`）：图片哈希一致、伦度 Logo/标题可见、无君乐缘品牌、无横向溢出、无页面或控制台错误。后续 Agent 发布 web 前必须从当前分支重新生成完整 dist，并保留本节记录的资源同步约束，避免旧图片或旧品牌回滚。

## 2026-10-08 品质与交付、技术与服务详情页发布

本轮独立站 Agent 将首页 04、05 接入 `/services/quality-delivery` 与 `/services/technical-support`，增加中英文服务说明、资料清单、流程、FAQ、产品选择及采购/客服入口，沿用白底蓝色样式。服务内容通过公开 JSON 配置，企业包副本同步；没有新增认证、产量、固定交期或质保承诺。采购模板和客服问题只填空字段，不覆盖客户输入。

发布声明：目标仅 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`，源码提交 `20573070d11adbd8c636862f755c00c8b6fa4f5d`。制品目录 `output/lundu-service-pages/full-dist-final`，归档 `output/lundu-service-pages/lundu-service-details-20573070.tar.gz`，SHA-256 `a596513039cfe1d31e228272d61e56cf47e7d4dc6eca90f2ecbe711337700632`。入口 6258 字节、主包 `/assets/index-B82MCbhh.js`；manifest `78294f227a301616`、600 项、77,234,068 字节。已提前通知 DeepSeek 整合聊天，未纳入另一 Agent 的本地业务验收文件。

构建来源：Windows 构建因内存不足失败，失败产物未发布。当前源码快照在远端独立目录 `/opt/lundu-eiscore/staging/service-details-20261008-20261008143945` 完整构建主站，未写运行源码。最初发现本地共享微应用 dist 陈旧，未发布该制品；11 个微应用及共享构建脚本源码相对 `2cd5076c` 没有变化，使用同源码已验收的 `output/lundu-motor-corner/full-dist/<mount>`。来源与入口哈希见 `output/lundu-service-pages/micro-entry-provenance.json`；发布锁内逐文件验证 11 个微应用与远端运行版本完全一致。后续 Agent 必须按来源核对完整 dist，不能直接沿用仓库中未验证的 dist。

远端共享锁内确认旧 manifest 仍为 `e76b6d03cda554ae`，校验归档、600 个资源、12 入口和伦度品牌后替换完整 release，备份为 `/opt/lundu-eiscore/backups/release-pre-service-details-20573070-20261008150642`。实际仅重建 `lundu-eiscore-web-1`，新容器 `8c0540eb3032`；发布前后容器 ID 核对确认其他服务未变化。没有清理既有 DeepSeek Web orphan。

线上 HTTP 核验 24 个入口/配置/Logo/服务 JSON/产品图均 200 且与本地逐字节一致，配置 `enterprise.id=lundu`；600 个 manifest URL 均存在，未检出错误品牌。服务 JSON SHA-256 `0fc00d690bc4a0c736d2328fb6536d3ff529519c08f711748c02d4d4dcce0f7c`，企业包 53 个 payload 通过标准 manifest 验证。本地语法、变更 lint、服务内容及相关品牌/路由回归、四视口视觉验收已通过。

最终线上视觉验收：两个服务页在 `390×844`、`414×896`、`768×1024`、`1440×900` 共 8 项通过；图片完整加载、Logo 正常、按钮单行、无横向溢出、无错误品牌和浏览器错误。采购单模板、产品选择、FAQ、客服展开/收起与中英文切换通过。另在启用 Service Worker 后完成首页进入详情及刷新，版本仍为 `78294f227a301616`。客服流式交互使用 mock，未验证真实模型回复或提交真实订单。证据为 `output/lundu-service-pages/remote-qa.json`、`remote-http-qa.json` 与 `remote-cache-smoke.json`。发布完成已通知 DeepSeek 整合聊天；远端运行制品为 `/opt/lundu-eiscore/release`，staging 的 `base-dist` 只有主站，不能单独覆盖完整 release。

## 2026-10-09 中英文控件竞态与故障回退修复

用户确认反馈发生于远端桌面首页 `https://lundu.eiscore.top`。检查时远端公开配置仍为 `enabledLocales=["zh-CN","en-US"]`，浏览器多数场景能看到按钮；本次未直接捕获用户那次消失的请求过程。确定性回归确认两项隐藏隐患：`App.vue` 与 `LoginView.vue` 并发加载配置，迟到的旧请求可能覆盖新语言状态；profile 接口失败返回仅中文的 `deployment-fallback`，原先会覆盖已加载的发布资料并隐藏语言入口。

源码提交 `014f5a72` 为 `loadConfig` 增加与 `loadEnterpriseProfile` 共用的请求序号保护，并让两个加载动作保留已有 `published-site`，避免失败回退覆盖。提交 `10dde8b6` 在初次加载仅有 fallback 时，从公开服务内容的已配置语言保留中英文入口；正常发布资料继续遵循其语言列表。切换接口失败会提示重试，不将 URL 标记为未成功加载的语言。真实 store/service 的回归覆盖并发迟到、故障保留、首载回退及正常加载/保存兼容。

发布声明：目标仅 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`，构建提交 `10dde8b64a006c37d221f1ad75e5eb915f856c0e`。主站从 `git archive HEAD` 的隔离源码构建，未纳入其他 Agent 的未提交业务改动。完整制品目录 `output/lundu-locale-fix-20261009/full-dist`，归档 `lundu-locale-10dde8b6.tar.gz`，SHA-256 `495b49636c38d697b443c9938296991285e8e7666ea35abd57e0b7cea8a8f529`。入口 6295 字节、主包 `/assets/index-Dac0SPOV.js`，manifest `a38aab250e541bcc` / 566 项 / 78,061,435 字节 / 12 入口。11 个微应用源码未变，来源为同源码已验收的 `output/lundu-service-pages/full-dist-final/<mount>`；发布锁内逐文件确认其 SHA-256 与远端完全一致。600→566 是主站重新构建删除 75 个旧 hashed assets、新增 41 个 assets 的净变化；微应用资源完整。

2026-10-09 06:19 UTC 使用 `/opt/lundu-eiscore/.lundu-web-publish.lock` 校验旧 manifest `78294f227a301616`、归档、566 个资源、12 入口及品牌后原子替换 release，备份为 `/opt/lundu-eiscore/backups/release-pre-locale-10dde8b6-20261009061902`。实际仅重建 `lundu-eiscore-web-1`，新容器 `96b0626f5f08`；发布前后容器 ID 核对确认 DB、API、Agent、DeepSeek Web 和 Harness 均未变化。

验收通过：真实远端在 `390×844`、`414×896`、`768×1024`、`1440×900` 的首页及两个服务页共 12 场景完成中文→英文→中文切换，按钮可见、单行、可点击，URL 与语言一致，Logo 正常、无横向溢出、无错误品牌和页面错误。已视觉查看桌面及手机截图。24 个 HTTPS 入口/配置/Logo/资源与完整制品逐字节一致；Service Worker 启用后首页进入详情、刷新、根地址进入首页并切换英文刷新均通过，manifest 保持 `a38aab250e541bcc`，无页面或控制台错误。本地额外验证首载 profile 503 仍显示入口且切换失败不伪造 URL。证据位于 `output/playwright/lundu-locale-20261009/{local,remote}-qa.json` 和 `output/lundu-locale-fix-20261009/{remote-http-qa,remote-cache-smoke}.json`。

后续整合 Agent 发布 web 时须保留上述两项修复，从当前分支生成完整 dist；不得用旧主站构建覆盖语言修复。回退须在同一共享锁内把本节备份恢复为 `/opt/lundu-eiscore/release`，仅执行规定的 web-only Compose 重建，并重新检查品牌、配置和语言入口。

## 2026-10-09 客服头像入口发布

独立站 Agent 将右下角客服文字按钮替换为 GPT Image 2 生成的蓝白耳麦人物头像。源码提交 `a2db08bcb1dde4893393518fa519ccd24d559b7a`，修改仅为 `LoginView.vue`、`login-view.scss` 与 `src/assets/customer-service-avatar.png`；头像为 192×192 透明 PNG，页面入口固定 48×48，保留中英文无障碍名称、点击与键盘展开/收起。未调整客服流式面板或业务接口。生成记录位于 `output/imagegen/lundu-support-avatar-20261009-prompt.md`，资源 SHA-256 为 `472d409657bd6852f0565215393c569c2df3e6d5ccfa67bd5f3de5e4488c2c32`。

发布前已通知 DeepSeek 整合聊天。目标仅 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`。主站从该提交的 `git archive` 隔离源码构建，其他 Agent 的未提交 layout、HR、nginx、Grid 文件未纳入。11 个微应用及共享构建源码相对已验收版本未变，使用 `output/lundu-locale-fix-20261009/full-dist/<mount>`；发布锁内逐文件确认与运行版本一致。完整 12 入口制品为 `output/lundu-support-avatar-20261009/full-dist`，归档 `lundu-support-avatar-a2db08bc.tar.gz`，SHA-256 `c3a121994d013a90c48c87be4d7874662b630cc164e54b3eea36543cfbd838b6`。入口 6295 字节，主包 `/assets/index-C7FhDJnR.js`；manifest `2051dc0c3fd37e54` / 567 项 / 78,114,439 字节。头像路径 `/assets/customer-service-avatar-CQpezFol.png`。

2026-10-09 07:26 UTC，在共享锁内确认旧 manifest `a38aab250e541bcc`，通过完整资源、品牌及微应用门禁后原子切换 release。备份 `/opt/lundu-eiscore/backups/release-pre-avatar-a2db08bc-20261009072645`。实际仅重建 `lundu-eiscore-web-1`，容器 `b9f3b78e49b3`；容器 ID 比较确认其余服务未变化。回退须在同一锁内恢复该备份并仅重建 web。

本地语法、变更 lint、登录入口/品牌与 system-profile-request 回归、主站构建均通过。本地及远端 `/login` 在 390×844、414×896、768×1024、1440×900 中英两种语言的头像加载、48px 尺寸、点击、Enter、关闭及往返切换均通过；已视觉检查桌面、手机展开/收起截图。无横向溢出、君乐缘正文或页面异常。25 个 HTTPS 资源与制品逐字节一致，含头像、主包、Logo、公开配置及 11 个微应用入口；Service Worker 开启后的服务页刷新、首页英文切换与刷新通过。只验证客服界面，未提交真实消息或订单。证据见 `output/playwright/lundu-support-avatar-20261009/{local,remote}-qa.json` 和 `output/lundu-support-avatar-20261009/{release-proof,remote-http-qa,remote-cache-smoke}.json`。

验收环境备注：本机 DNS 当时将域名解析为 `103.73.220.77`，服务器解析为 `149.104.26.71`，默认自动化请求超时；HTTPS 验收固定到已授权部署 IP `149.104.26.71`，仍使用 `lundu.eiscore.top` 主机名且未跳过证书验证。没有改动 DNS 或全局 hosts。其他 Agent 后续发布 web 时必须保留本次头像和之前语言修复，并重新生成完整 dist。

## 2026-10-09 客服窗口美化发布

用户授权美化客服窗口并推送、部署。源码提交 `cece9665`、`ff05d042` 仅修改 `eiscore-base/src/views/LoginView.vue` 和 `eiscore-base/src/styles/login-view.scss`。窗口改为白底蓝色、桌面 380×600 上限、紧凑头像与标题、灰色客服/蓝色用户气泡和一体式多行输入框。首次欢迎语及三个简短问题在开始对话后隐藏；快捷问题只填入输入框，不自动发送。头像入口仍为 48×48。中文标题使用现有企业文案配置，没有新增客户名称硬编码。

同步修复流式回复更新：将被逐段修改的客服消息建为 Vue reactive 对象，使已渲染气泡逐段更新。阅读历史时停止自动跟尾，用户发送新问题或重新打开后恢复跟尾。输入区支持 Shift+Enter 换行、Enter 发送和 IME composing 保护；移动端通过 visualViewport 调整键盘弹出后的高度与底部位置，卸载时移除监听并取消流请求。客服和采购接口没有改变。

发布声明：目标仅 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`，构建提交 `ff05d042cab17617161db381af2568a193413ecc`。已提前向 DeepSeek 整合聊天声明服务、提交、制品和其他 Agent 的影响。完整制品目录 `output/lundu-support-window-20261009/full-dist-final`，归档 `lundu-support-window-ff05d042.tar.gz`，SHA-256 `d179a00f1d2bb27a60df8e9deaf195591922ab320869d3bf8238ca8a18ca0f9e`。入口 6295 字节、主包 `/assets/index-DVSuB0h1.js`；manifest `3f41e8af83c33350` / 601 项 / 77,277,578 字节 / 完整 12 入口。

构建来源：Windows 最终构建两次因 esbuild 内存不足失败，失败 dist 未发布。将该提交的 `git archive` 放到远端隔离目录 `/opt/lundu-eiscore/staging/support-window-ff05d042-build`，复用已安装的 Linux 依赖，并把 `@eiscore/platform` 指向当前快照中的平台源码；主站构建成功，未写运行源码。11 个微应用及共享构建源码相对 `2cd5076c` 未变，使用已验收的 `output/lundu-support-avatar-20261009/full-dist/<mount>`，并在发布锁内逐文件 SHA-256 核对与远端 live 完全一致。只有 `full-dist-final` 是本次可发布目录，同目录旧 `full-dist` 和失败的源目录 dist 不可发布。

2026-10-09 08:57 UTC，持有 `/opt/lundu-eiscore/.lundu-web-publish.lock`，确认旧 manifest `2051dc0c3fd37e54`、归档 SHA、601 资源、12 入口、伦度品牌及微应用门禁后原子替换 `/opt/lundu-eiscore/release`。实际只重建 `lundu-eiscore-web-1`，容器 `5043104240b8`；发布前后比较确认其他容器 ID 未变。未清理既有 DeepSeek Web orphan。备份 `/opt/lundu-eiscore/backups/release-pre-support-window-ff05d042-20261009085740`。回退需持有同一锁，恢复该完整目录并只重建 web，不回退业务数据。

验证记录：语法检查、变更 lint、登录入口/品牌与 system-profile-request 回归通过。源码提交已推送到 `https://github.com/GODU-LZR/eiscore.git` 的 `codex/systematic-refactor`；没有向指向 DeepSeek Harness 的本地 origin 推送。25 个 HTTPS 资源与制品逐字节一致；Service Worker 开启后的服务页刷新及首页英文切换/刷新通过，manifest 保持 `3f41e8af83c33350`，无错误品牌或控制台错误。本地及远端均完成 390×844、414×896、768×1024、1440×900 中英文 8/8 场景，全部 PASS，客服窗体无裁切、重叠或横向溢出；主 Agent 和只读 Agent 已人工检查截图。证据见 `output/playwright/lundu-support-window-20261009/{local,remote}-qa.json`。首次远端重展开检查曾在头像解码前断言失败；测试补齐每次展开的 decode 等待并加入 console error 收集后重跑，未为此修改线上代码。

验收边界：客服请求使用可控 ReadableStream mock，覆盖逐段显示、多行发送、长回复跟尾、历史阅读不抢滚动、重新发送、展开/关闭及采购单入口；未调用真实模型或提交订单。手机键盘几何为 Chromium visualViewport 模拟，未宣称真实 iOS/Android 设备验证。后续发布应保留语言修复、头像、窗口样式及 reactive 流式消息修复，从当前源码生成完整制品并重复品牌门禁。详细来源、资源核对和缓存证据位于 `output/lundu-support-window-20261009/`。

另见既有移动英文导航按钮 `Enterprise login` / `Purchase order` 在窄屏发生省略或右侧裁切，位置在客服窗体之外，本次未改导航；后续独立处理移动导航布局时应复用本次四视口截图基线。

## 2026-10-09 分享卡片与站点图标远端发布

本轮目标服务仅为 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`，提交 `093d05cf`。制品目录 `output/lundu-share-metadata-20261009/full-dist`，归档 `lundu-share-metadata-093d05cf.tar.gz`，SHA-256 `fb2ab1a60c18ee9523b32a168b0c9948231c33ff879ac465fc0b23f26417bc0c`；manifest `7555e59f25c2b26d` / 569 项 / 78,221,469 bytes，入口 `7,617` bytes，主包 `/assets/index-5G3f1K6B.js`。影响仅为完整静态站替换和 `lundu-eiscore-web-1` 重建，其他服务未重建。

2026-10-09 11:55 UTC 持有 `/opt/lundu-eiscore/.lundu-web-publish.lock`，校验旧 manifest `3f41e8af83c33350`、归档 SHA、12 入口、路径安全、`enterprise.id=lundu`、伦度 Logo、无“君乐缘”和微应用入口门禁后原子替换 `/opt/lundu-eiscore/release`。旧 release 备份为 `/opt/lundu-eiscore/backups/release-pre-share-metadata-093d05cf-20261009115516`。实际只重建 `lundu-eiscore-web-1`，新容器 `21d774403df2`；DB、API、Agent、DeepSeek Web 和 Harness 未重建，既有 orphan 未清理。

线上 HTTPS 验收通过：`/login`、公开配置、manifest、分享图、SVG favicon、PNG Apple touch icon 和 `/favicon.ico` 均 HTTP 200；分享图为 `image/jpeg`、94,400 bytes，PNG 图标为 `image/png`、1,928 bytes。HTML 已包含绝对 `og:title`、`og:description`、`og:image`、1200×630 尺寸、`twitter:card=summary_large_image`、SVG favicon 和 Apple touch icon；页面标题为“伦度机电｜电机与水泵制造”，配置为 `enterprise.id=lundu`。Playwright CLI 因本机缺少 Chrome distribution 未启动，已使用真实 HTTPS 请求完成 HTML、Content-Type、字节数和资源门禁。
