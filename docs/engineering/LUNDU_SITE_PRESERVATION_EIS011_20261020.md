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
