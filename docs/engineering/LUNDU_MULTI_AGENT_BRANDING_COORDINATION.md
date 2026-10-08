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
