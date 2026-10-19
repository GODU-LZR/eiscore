# EIS-011：工作台发布时保留伦度独立站

2026-10-20（北京时间）。保留用户确认的六张轮播、真实水泵 BOM 拆组动画、产品及采购单图片、伦度图标，同时发布 EIS-010 工作台双入口。本轮仅更新 `https://lundu.eiscore.top` 静态 Web。

## 原因与修复

首次 EIS-010 制品 `e1dc2396a7b9c01c / 609` 保留了艺术文件，却使用缺少历史独立站修复的宿主源码。候选与重构主分支一致、资源 HTTP 200，不能证明它保留远端独立站 `9ff93969` 的行为。本次属于源码整合遗漏，不能归咎于用户缓存或艺术文件被删除。

真实公开配置有 83 个产品，图片字段为空，首页轮播也为空；缺失保护会使空配置覆盖部署艺术配置，并丢失图片系列回退和公开目录排序。首次发布已撤回，先恢复 `2ef653fcc2779be6 / 609`；错误制品保留于 `/opt/lundu-eiscore/.codex-deploy/eis010-regressed-20261019T172513Z`。

修复任务分支 `codex/fix-eis010-preserve-lundu-site-20261020`、提交 `f4959d6eca85fee5a879c3aa7cd70bb91a161828` 已推送 `eiscore`。以下四个产品文件和两份回归与 `9ff93969a16fe3ac96fa3b1d6457f04e5c403e3e` 的 Git blob 完全一致：

- `eiscore-base/src/views/LoginView.vue`
- `eiscore-base/src/styles/login-view.scss`
- `eiscore-base/src/utils/product-image.mjs`
- `packages/eiscore-platform/src/enterprise-profile.mjs`
- `tests/engineering/enterprise-profile-regression.mjs`
- `tests/engineering/lundu-product-image-regression.mjs`

宿主、移动端、平台包、伦度企业包及聚合/清单脚本范围，相对 `9ff93969` 唯一预期差异是 EIS-010 的 `HomeView.vue`。企业艺术资源源码无差异，水泵全产品查找逻辑保留。重构主分支整合提交 `937b548a` 已推送。

主树既有 Flash 交接改动保留且未提交。用户已有的平台包物理删除保持原状；仅将修复后的两个 tracked blob（LoginView、enterprise-profile）定向整合到 Git 索引，另外四文件增量整合，没有在主树恢复 SDK 文件夹。发布构建来自干净隔离提交，不包含主树未提交的惠众或 Flash 改动。

## 制品与发布

隔离树 `.codex-tmp/workbench-harness-build-20261019` 的宿主构建通过，5920 modules；存在既有 Sass import 与大包警告。完整制品使用新构建宿主，保留线上已验收的 11 个微应用和全部公开配置/艺术文件；531 个非宿主文件逐项 SHA-256 不变，HTML 后加的三处伦度 PNG favicon 引用保留。

| 项目 | 实际结果 |
| --- | --- |
| 完整目录 | `output/lundu-workbench-eis010-20261020/full-dist-v2` |
| manifest | `b0f9263913598a27`，609 项，77,427,417 bytes |
| 根入口主包 | `/assets/index-DKDgtxGL.js` |
| index SHA-256 | `e48457d8c91b5f612ab41d450df277509974df6890e4e6b30bad13e9c05e6c53` |
| 归档 | `lundu-workbench-eis010-f4959d6e-v2.tar.gz` |
| 归档 SHA-256 | `7924c139dc9e317df8aefb79c6f76a63eedd4bedf9393ed0982fcd4857051bd7` |
| 入口数量 | 根站与11个微应用，共12份 |
| 远端回退目录 | `/opt/lundu-eiscore/backups/release-pre-eis010-v2-20261019T175502Z` |
| 实际重建服务 | 仅 `lundu-eiscore-web-1`，新 ID `04983d08f921` |

发布持有 `.lundu-web-publish.lock`，先核旧 manifest/index hash、归档 hash、路径安全、12 入口、品牌及 531 个保留文件，再原子切换。Nginx 检查通过；609 项清单及清单 JSON/配置/SW 的线上 HTTP 字节逐项匹配。所有其他容器 ID 和 StartedAt 前后完全一致，包括伦度 DB/API/Agent/Harness 与全部惠众服务；未迁移或写入业务数据库。

## 验证与剩余问题

离线先复现缺失保护的失败，再恢复实现。产品图片回归、`test:enterprise-profile` 六个脚本、`test:enterprise-branding`、system-profile-request、`test:eiscore-embed`、变更 lint、语法和差异检查通过。

Chrome 候选验收使用最终制品拦截静态响应，公开 API 直接访问真实伦度服务，无数据替身。随后在线上真实 HTTPS 无拦截复验。两次均等待 `__EISCORE_INITIAL_CONTENT_READY__` 且 Pinia profile source 为 `published-site`，通过以下检查：

- 390/414/768/1440 视口六张不同轮播逐张加载。
- 13 个水泵 BOM 零件，拆分与组装进度分别到终点，真实 Canvas 正常显示。
- 12 张产品图、详情图、采购单图片正常，采购图使用 contain。
- Logo/favicon 正常，无横向溢出或错误品牌，pageerror 为 0。

线上证据为 `output/lundu-workbench-eis010-20261020/public-remote-verification.json`（pass=true）和 `stable-remote-*` 截图；发布日志为 `deployment-v2.log`。未提交采购单、发送客服消息或调用模型。

旧验收浏览器曾缓存回退期间的资产 HTML，触发模块 MIME 错误；清除该隔离浏览器缓存后重新检查。另一次动画等待受并行浏览器影响超时，已关闭其他验收窗口并前台串行复验通过。这些先前失败保留在日志中，不混报为通过。

真实管理员登录进入线上工作台、两入口、业务流程、原生 Harness iframe 加载及往返 DOM/document 保留通过。但 iframe 显示“连接异常”，数字分身/智能 BI 插件未出现。这是本轮发现的远端运行态限制，未由仅 Web 的发布修复；不能宣称真实插件业务链或 Provider completion 已验收。

回退只恢复上述完整目录并重建伦度 Web，禁止回退数据库或覆盖惠众。后续发布必须比较远端独立站来源，不能只比较候选与主分支；公开页检查必须等待真实档案完成，BOM aria-label 含动态产品名称，应匹配后缀并验证 13 个零件。

## 防回退门禁与实际应用（2026-10-20）

用户追加要求避免再次发生。任务分支 `codex/fix-eis011-release-guards-20261020` 已提交
`ab8e85ef`、`41f14b23`，重构主分支串行整合为 `5db91770`、`a765a8e6`，两分支均已推送
`eiscore`。不是仅补一份操作清单：

- `release:lundu:prepare` 从包含 `937b548a` 的干净提交按锁文件实际安装、构建；同时运行公开档案/产品图行为回归，避免后续 revert 仍通过祖先检查。拒绝隐藏的 Vite env 输入；旧 greenbar 历史归档叠加脚本已停用。
- 准备完整12入口，保留11微应用、配置和艺术资源；记录全部文件实际 SHA-256 及统一树摘要，校验三处伦度 PNG 图标；HTML/SW 每次带唯一 stamp，确保旧worker可升级。
- 可复用 Chrome 脚本等待真实 `published-site`，逐一检查四视口的6轮播、13零件拆组、12产品及对应详情/采购图片，收集 pageerror/console.error；验收前后版本、树、来源和 stamp 必须一致。
- Python 标准库发布器已安装至远端 `/opt/lundu-eiscore/tools/publish-lundu-web-release.py`，policy 在 `/opt/lundu-eiscore/deploy/lundu/web-release-policy.json`。检查归档安全、逐文件来源、有效期内且绑定该制品的浏览器证据；持共享 flock，核对当前线上基线/保护文件、Nginx、挂载和HTTP实际字节；原子交换目录，只重建web，失败自动恢复完整旧站，检查所有非web容器身份不变。
- `npm run test:lundu-web-release` 已接 npm 与 GitHub CI，CI增加重构分支/本任务分支触发；AGENTS 和两份伦度协作说明要求全部窗口使用该路径，不再手工覆盖assets。已通知独立站协作窗口。

本轮机器验证：门禁组合通过（含18个Python发布/回退/安全解包测试和17种浏览器缺陷拒绝）、变更lint、语法与diff检查通过。干净树准备器在脏树上实际拒绝；旧发布基线 `110051bb` 不包含所需祖先。真实完整tar本机 `--validate-only` 与远端锁内 `--check-only` 均通过，后者明确不切换/重建。

使用专用 localhost server 和独立 Chrome context，先真实激活旧SW、填充旧cache，再切换候选并更新worker；验证执行中的新worker stamp、cache名、旧cache清除、JS/CSS/图片不为HTML，自动刷新恰1次，再显式刷新1次且2.5秒内无循环。该测试为真实升级，不是清用户缓存。服务器和两个候选浏览器会话均已关闭。

| 项目 | 实际值 |
| --- | --- |
| 应用构建来源 | 干净提交 `ab8e85ef3e847b9e26beb1d10ceb78514ad90421`；后续 `41f14b23` 仅补工具和工具测试，未改变应用输入 |
| 完整候选 | `output/lundu-web-guards-eis011-20261020/full-dist` |
| manifest / 全文件 | `bffb63a78c4e3e81` / 609缓存项；614文件逐字节证明，另有自描述provenance |
| 树 SHA-256 | `4601c61b46fa76d3b71d973e92c93d52dfa7c010df277134b25a01eaf211828b` |
| index SHA-256 | `debc3f4ae8a166536e147be3141491127aef239ba54f45243de008dcd20105ce` |
| 主包 | `/assets/index-DKDgtxGL.js`（应用输入相同，保持原包） |
| 归档 SHA-256 | `c48948b64aca34a3a463bacfa90cc2065adb8b91a09eb0ee4ed97b0e0bea32ba` |
| 实际重建 | 仅 `lundu-eiscore-web-1`，新ID `fd4108ab3bf7` |
| 本轮完整回退 | `/opt/lundu-eiscore/backups/web-before-b0f9263913598a27-20261019T200409Z-0816ffe4` |

候选四视口真实公开API验收 `candidate-browser.json` pass=true。正式工具发布成功，614文件HTTP匹配，所有其他伦度及惠众容器ID/StartedAt不变；重放相同归档的远端 `--check-only` 实际被拒绝为 `live baseline version changed`，未覆盖新版。线上无静态/API拦截的四视口复验 `remote-browser-retry.json` pass=true：每个视口6轮播、13零件拆组、12产品/详情/采购图全部通过，errors=[]。截图 `output/playwright/lundu-eis011-remote-bom.png` 已视觉检查，真实拆分零件可见。

首次线上回归在1440视口等待动画超过20秒而失败，原始 `remote-browser.log` 保留；随后读取实际进度已到终点并确认模型渲染。考虑共享机器的rAF节流，测试在按钮前聚焦、两次有界等待改为90秒，拆分/组装终点和其余断言不变，子代理只读复核及离线回归通过，再完成真实线上复验。该结果证明最终功能，不代表20秒动画性能保证。修改仅涉及测试工具，未修改线上应用或重建任何容器。

本轮证据集中在 `output/lundu-web-guards-eis011-20261020/`：`candidate-browser.json`、`sw-upgrade.json`、`remote-check.log`、`deployment.log`、`replay-rejected.log`、`remote-browser-retry.json`。首次SCP传输中断后仅续传候选归档，归档独立SHA校验通过才允许预检查，没有把不完整文件切到线上。已向另外三个协作窗口发送规则和本轮版本通知。

这些门禁阻断已知的正常发布事故路径。provenance/历史JSON是来源一致性证据而非数字签名；共享root仍可故意绕过工具。没有承诺任何具备root权限的手工操作都无法覆盖。数据库、业务数据、认证和Harness运行态均未改；既有主树脏改动及平台包删除原样保留。
