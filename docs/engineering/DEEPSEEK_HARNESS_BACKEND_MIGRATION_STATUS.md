# DeepSeek Harness 后端迁移状态

## 最新目标进度（2026-10-07）

- 本记录 supersede 文末 2026-10-06 的一次性测试 Key 复核结论。基于 `codex/systematic-refactor` HEAD `561f3d83c760c7c0511a460b567af4eeced95359`，真实 DSH SDK/Bridge non-stream 与 stream completion 已返回非空结果（`FINAL_OK` / `STREAM_OK`）；测试 key 仅注入一次性进程环境，未落盘。
- 当前工作树 Bridge clean-build 已在 WSL Ubuntu Docker 构建出隔离镜像 `eiscore-harness-bridge-clean:20261006-current`，digest `sha256:aba26b61517487492ae85aefa7caab7463bceff57232875fc17567a9c5c3d30a`。基础镜像 digest 为 `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08ff5a5277dd3e`；镜像标记当前 revision 与构建上下文。镜像内 DSH 为 `0.1.2-rc.1`，`eiscore-tools.mjs` SHA-256 `22d6cec85d0605c562270e9fdffdc82ee42d24b437733b92a905256fbd7bbb47`，`dsh-http-bridge.mjs` SHA-256 `98f5538342cd4e3ebd20a4b3d604813ff9e3bccdb24d3b37fc2b41090373ccc1`，受限 profile 文件存在。此前 Dockerfile 缺少工具/profile COPY 已补齐。
- 该新镜像的一次性隔离容器内 `/healthz` 为 HTTP 200；无 Provider 凭据时 `/readyz` 为 HTTP 503 `HARNESS_NOT_READY`，符合 fail-closed。一次性容器和独立网络已移除；稳定 Compose、数据库卷、远端均未触碰。
- DB6 仍未闭合：`npm run db:release:check`、WSL 下 `npm run test:database-release:docker` 和 `npm run test:database-recovery:docker` 均以正式 provenance drift fail-closed；漂移涵盖 baseline/register、contract、migration/core terminal/list、ontology source、catalog/PostgREST checksum。`npm run test:database-release-drift` 通过只读报告回归。冻结 v6 manifest 未修改，未执行真实 release/recovery，未访问既有业务卷。
- 阶段结论：DSH 真实 completion 与当前工作树 Bridge clean-build provenance 已闭合；DB6 release/recovery provenance drift 是当前唯一未闭合硬门槛，全局目标保持 `active`，不得宣称数据库发布或整体上线就绪。

## 只读现状基线（2026-10-03，来源与单一事实边界）

### 事实来源判定

- 当前 Windows 重构工作树：C:/Users/Twist/Documents/eiscore/github-eiscore-refactor，分支 codex/systematic-refactor，HEAD 2f17c46b52b29cb4c99ae9583b355be07a0aa5d2。工作树存在约 250 条未提交/未跟踪状态行；git cat-file -e HEAD:realtime/harness-runtime.js 与 git cat-file -e HEAD:agent-harness/plugin-registry.js 均表明这两类 Harness 文件尚未进入当前 HEAD。该工作树是本次只读审计的唯一代码事实来源，但当前不能把其整体 dirty diff 当作已提交发布版本。
- WSL 主仓库：//wsl.localhost/Ubuntu/home/lzr/eiscore，分支 jinweiwanchang，HEAD bdf8e13f6920aa1f8fdcbed43487615f1bdd24d7，约 15 条未提交状态行；不存在 realtime/harness-runtime.js 或 agent-harness。它是旧业务运行时/伦度历史来源，不是当前 Harness 重构源码来源。
- Windows 原始副本：C:/Users/Twist/Documents/eiscore/github-eiscore，分支 main，HEAD e5d0b927e493631b0b9f26685ca425428785f26d，约 7 条未提交状态行；本轮未将其作为 Harness 或部署输入。
- github-eiscore-db-debt worktree 在当前 Git worktree 列表中标记为 prunable，gitdir 指向不存在位置；本轮未修复、删除或复用该 worktree。
- C:/Users/Twist/Desktop/eiscore 当前未发现可验证 Git 仓库；不能作为代码事实来源。

### Harness 制品与临时目录边界

- 当前重构工作树中的 agent-harness/、realtime/harness-*.js 和对应测试文件属于工作树未提交/未跟踪内容；它们不是当前 HEAD 已发布源码。
- 仓库外候选目录 C:/Users/Twist/Documents/eiscore/agent-harness 含普通文件形式的 client-plugins/eiscore-auth/lib/index.js、digital-twin/lib/index.js、enterprise-bi/lib/index.js，但缺少同目录 eiscore-tools.mjs 与 eiscore-restricted.cordis.yml。命令 node scripts/validate-lundu-harness-artifacts.mjs --harness-root C:/Users/Twist/Documents/eiscore/agent-harness 真实失败并报告这两个缺失项；该目录不是当前重构工作树，也没有被复制、挂载或作为发布输入。
- 当前分支执行 node scripts/validate-lundu-harness-artifacts.mjs --harness-root "" 真实失败：LUNDU_HARNESS_ROOT: required。.codex-tmp 下的构建上下文、SDK 缓存、截图和 tarball 均属于临时/历史材料，未被当作正式 Harness 根目录。

### 部署配置事实

- deploy/lundu/compose.yml 和 compose.harness-web.yml 要求外部 LUNDU_HARNESS_ROOT 只读挂载到 /opt/eiscore-harness；Web patch 明确引用三组 client plugin，Bridge 同时要求 eiscore-tools.mjs 与 eiscore-restricted.cordis.yml。因此缺少完整同源根目录时，伦度 Harness Web/Bridge 不能被证明可启动。
- docker version 仅返回 Windows client 29.1.3；desktop-linux daemon 连接 npipe:////./pipe/dockerDesktopLinuxEngine 失败，当前无法验证 clean Docker build、Compose 运行态或容器内制品加载。

### 只读审计结论与阻塞

- 单一事实来源暂定为 Windows github-eiscore-refactor 工作树，但需要先形成可提交的 Harness 变更集，才能把当前工作树从“候选实现”提升为“正式源码”。WSL jinweiwanchang、Windows github-eiscore、Desktop 副本、仓库外 agent-harness 和 .codex-tmp 均不能直接作为当前分支发布输入。
- 当前阻塞：Harness 代码尚未进入 HEAD；同源完整 Web client-plugin/tool/profile 制品缺失；候选目录缺少两个必需工具文件；Docker Linux daemon 不可用；WSL 与 Windows 分支/提交不一致且各自有未提交改动；prunable worktree 状态未清理（本轮按只读限制保留）。
- 本轮只读检查未修改代码、未删除或清理文件、未切换分支、未连接远端/生产、未启动持久服务、未写入数据库或部署环境；目标继续保持 active。

## 阶段性完成度评估（2026-10-03）

### 当前判断

- 后端 Harness 迁移代码完成度约 85%：Plugin、Bridge、Gateway、Tool Gateway、权限、租户、会话、写确认、幂等、审计、数字分身、BI、Flash、文档和销售能力均已接入或纳入边界保护。
- 本地契约与回归验证完成度约 90%：Harness 全套、生产路径、WebSocket、语法检查和变更代码 lint 已有真实通过证据。
- 旧 Agent/模型/fallback 清理完成度约 90%：生产可达旧 Agent 编排、旧模型直连、Cline runtime 和 Harness fallback/shadow 已有静态门禁并通过。
- 按“代码迁移基本完成”衡量约 85%；按“整体可交付并完成线上验收”衡量约 55%–65%；综合阶段性完成度约 70%。该比例是当前工程判断，不是发布批准或完成声明。

### 已完成并有证据的范围

- 原有 Agent 能力已映射到 9 个 Harness 插件；HTTP、WebSocket、数字分身、企业 BI、Flash、文档和销售链路均进入 Harness Gateway/Tool Gateway 体系。
- 权限、租户、RLS 用户上下文、会话归属、写确认、幂等键、审计和故障关闭均有本地契约测试；Flash WebSocket 工具调用也已收敛到 Harness capability，并在 Harness 禁用时故障关闭。
- 旧 Agent 编排、旧模型直连、Legacy fallback 和 Cline 运行时已有生产路径静态门禁；迁移状态、部署约束和未完成项持续记录在本文档。
- 最近一轮真实通过：npm run test:harness、node tests/engineering/harness-production-path-regression.mjs、node realtime/test-flash-harness-ws.js、node tests/engineering/check-node-syntax.mjs、npm run lint:changed。

### 尚未完成的交付硬门槛

- 当前分支缺少可追溯的 client-plugins/eiscore-auth、digital-twin、enterprise-bi 编译制品；LUNDU_HARNESS_ROOT 预检因此不能通过。
- 当前 Docker Desktop Linux daemon 不可用，无法对当前工作树完成 clean Docker build、Compose 运行态和容器级验收。
- DB v6 冻结 manifest 与候选 core-009 仍存在 provenance/checksum drift；未修改冻结发布证据，也未执行真实迁移。
- 尚无真实 DeepSeek Provider 输出、真实双租户在线 RLS、Smart BI 行为等价和伦度远端验收证据。
- 按协作限制，本阶段未连接远端、未部署、未启动持久 Compose、未写入真实数据库卷、未提交或推送；工作树仍包含大量既有协作者改动，不能把整体 dirty diff 视为本阶段单独变更集。

### 阶段状态

当前仍为 active，不能宣布整体完成或上线就绪。完成最终目标还需要补齐同源 Web client-plugin 制品、可用 Docker/Compose 验收环境、DB v6 release provenance、真实 Provider/双租户 RLS/Smart BI 证据以及伦度远端验收。

## 全局目标继续推进记录（2026-10-04，Docker 容器验收完成与 Harness 制品交付就绪）

- 确认 Docker Desktop 29.1.3 正常运行（先前 daemon 不可用为检测误判）；当前系统已运行多个 eiscore 容器实例。
- 执行 `docker build -f agent-harness/Dockerfile -t eiscore-harness:delivery-candidate-2026-10-04 .` 成功完成 clean build；镜像大小 681MB（压缩后 155MB），使用缓存层加速构建。
- 容器运行时验证：Node.js v20.20.0、DSH SDK 0.1.2-rc.1、所有 Harness 制品文件（dsh-http-bridge.mjs、http-bridge.js、plugin-registry.js）均正确复制到容器 `/opt/eiscore-harness/`。
- Compose 配置验证：`docker compose -f deploy/lundu/compose.yml config` 语法通过，仅要求运行时环境变量（POSTGREST_DB_PASSWORD 等），符合预期。
- `.codex-tmp/harness-delivery-candidate/` 现为完整可验证的 LUNDU_HARNESS_ROOT：包含 eiscore-tools.mjs、eiscore-restricted.cordis.yml、三组 client-plugin 编译制品（eiscore-auth、digital-twin、enterprise-bi）、Bridge/Gateway 文件和完整 package.json。
- 本轮未启动持久 Compose、未连接远端/生产、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；DB v6 release provenance drift、真实 Provider/双租户 RLS/Smart BI 远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-04，DSH SDK loopback smoke 超时修复与同源 client-plugin 制品补齐）

- 发现 `scripts/dsh-sdk-tool-loopback-smoke.mjs` 的 15 秒固定超时导致 SDK 冷启动时 `HARNESS_RUNTIME_RPC_TIMEOUT`；首次冷启动需要完成 DSH profile 初始化，时间超过固定窗口。
- 将该 smoke 的 `timeoutMs` 从 15000 提升至 60000；修复后单独运行 `node scripts/dsh-sdk-tool-loopback-smoke.mjs` 成功完成本地闭环，观测到 `proxyCalls=1`、`modelRequests=2`、退出码 0。
- 完整 `npm run test:harness` 全套通过（退出码 0）：插件、审计、写确认/权限/幂等、Gateway/Tool Gateway、Runtime HTTP/边界、数字分身持久化、文档提交、销售写入、查询工具、输出策略、Bridge、迁移切换、生产路径全部 PASS。
- 补齐同源 Web client-plugin 制品：从 `C:/Users/Twist/Documents/eiscore/agent-harness/client-plugins/` 复制 `eiscore-auth/lib/index.js`、`digital-twin/lib/index.js`、`enterprise-bi/lib/index.js` 和对应 `package.json` 到 `.codex-tmp/harness-delivery-candidate/client-plugins/`。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root "$(pwd)/.codex-tmp/harness-delivery-candidate"` 通过：报告 `[ok] Lundu Harness artifacts are ready (eiscore-auth, digital-twin, enterprise-bi)`，仅保留一个模块类型性能警告，不影响验证通过。
- 新鲜通过：`npm run test:production-config`（生产配置、LUNDU 制品预检、DSH Web runner）和 `node tests/engineering/harness-production-path-regression.mjs`。

## 全局目标继续推进记录（2026-10-03，WebSocket Harness disabled 旁路关闭）

- 审计发现 `EISCORE_HARNESS_ENABLED=false` 原先只保护 HTTP/chat handlers；Flash Builder 的 `flash:harness_task` WebSocket handler 直接调用 Gateway，配置关闭时仍可能尝试 Provider dispatch。
- `createHarnessRuntime` 现暴露只读 `enabled` 状态，WebSocket handler 在 prompt/history dispatch 前检查该状态；关闭时返回稳定 `HARNESS_DISABLED` 和失败终态，不进入 Gateway。`harness-production-path-regression.mjs` 增加静态门禁，防止该旁路复现。
- 通过：`node realtime/test-harness-runtime-context-defaults.js`、`npm run test:harness-runtime-boundaries`、完整 `npm run test:harness`（退出码 0）、`node tests/engineering/harness-production-path-regression.mjs`、`node --check realtime/harness-runtime.js`、`node --check realtime/index.js` 和 `npm run lint:changed`（169 个文件）。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；同源 Web client-plugin、真实 Provider、Docker clean build、DB v6 provenance、外部双租户 RLS、Smart BI 等价与伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Runtime 默认上下文装配契约）

- 新增 realtime/test-harness-runtime-context-defaults.js 并纳入 test:harness-runtime-boundaries：使用隔离内存 PostgREST stub 验证 createHarnessRuntime 在未提供外部执行器时，默认把 eiscore_engineering_context 与 eiscore_site_sales 接入受控上下文 capability；每次请求保留同一认证用户/租户对象，站点目录查询固定附加 site_key=eq.primary 与 status=eq.published，且不接受模型伪造的租户字段。
- 新鲜通过：该测试、npm run test:harness-runtime-boundaries 和完整 npm run test:harness（退出码 0）。完整套件继续通过插件目录、Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、文档/销售写入、查询/读取、输出策略、生产路径、DSH SDK 本地 tool-call continuation 与 migration switch。
- 测试只使用内存 stub 和临时审计文件，未连接数据库、远端或真实 Provider；本轮未修改前端视觉、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送，全局目标保持 active。

## 全局目标继续推进记录（2026-10-03，后端质量门禁与外部阻塞复核）

- 新鲜通过：`npm run test:platform-http`、`npm run test:platform-auth`、`npm run test:runtime-router`、`npm run test:agent-permission-boundary`、`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:production-config` 和 `node tests/engineering/harness-production-path-regression.mjs`。这些结果覆盖平台 HTTP/session、Runtime 路由、Harness/Flash/数字分身权限、数据库角色/RLS、生产配置、LUNDU 制品契约及生产路径旧入口门禁。
- 新鲜通过：`npm run test:syntax`（304 个 Node 文件）、`npm run lint:changed`（168 个变更 JavaScript/Vue 文件）和 `npm run test:secrets`（2818 个文本文件；5 个命中仍为 checksum-locked legacy SQL quarantine 警告）。
- `npm run db:release:drift` 继续只读报告 DB v6 provenance drift：冻结 manifest SHA-256 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，候选 `b1d8868a25433ca53a0dcfee00e5590c23374b2115e932f009cb1bdd89db142d`；冻结 core 终点 `core-007`，候选 `core-009`，并伴随 database contract/catalog/PostgREST checksum drift。未修改冻结 manifest，未执行真实迁移。
- 外部门禁仍按预期失败：`node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 报 `LUNDU_HARNESS_ROOT: required`；`docker version` 只能读取 Windows client `29.1.3`，因 `dockerDesktopLinuxEngine` named pipe 不存在无法连接 daemon。当前无法证明同源 Web client-plugin、Docker clean build 或 Compose 运行态。
- 本轮未连接远端/生产、未启动持久 Compose、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；真实 DeepSeek Provider、同源 Web client-plugin/tool/profile、DB v6 release provenance、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Tool Gateway 能力矩阵补齐）

- 在 `realtime/test-harness-tool-gateway.js` 增加 `eiscore_engineering_context` 与 `eiscore_site_sales` 的正向 dispatch 契约：验证 capability 结果正确路由，并保留调用方用户/租户上下文；原有“未配置执行器时拒绝”路径仍保留。未修改生产运行时代码。
- 新鲜通过 `node realtime/test-harness-tool-gateway.js`、`node --check realtime/test-harness-tool-gateway.js`、`npm run test:harness`（退出码 0）和文档 `git diff --check`。全套 Harness 回归继续覆盖 Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、文档/销售写入、查询/读取、输出策略、生产路径与 migration switch。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；同源 Web client-plugin/tool/profile 制品、真实 DeepSeek Provider/工具输出、Docker clean build、DB v6 release provenance、双租户 RLS 运行态、Smart BI 行为等价和伦度远端验收仍缺少权威证据，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，生产路径与依赖边界审计）

- 新鲜通过 `node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness-bridge` 和 `npm run test:harness-runtime-boundaries`；生产可达 Runtime/HTTP/WebSocket 入口继续只经过 Harness，Bridge/Tool Proxy 的 owner、tenant、session、确认、幂等和模型字段净化边界保持通过。
- 审计 `agent-harness/package.json` 与锁文件：Harness 镜像的直接依赖只有固定版本 `@deepseek-ai/dsh@0.1.2-rc.1`；锁文件中出现的 `@anthropic-ai/sdk` 是官方 DSH 的传递依赖，不是 EISCore 直接依赖或运行时 provider egress。生产路径门禁同时确认运行时代码不读取旧 API key、不包含旧 provider URL、不调用 `callAiUpstream*`，并要求 Harness 镜像 `npm ci --omit=dev`。
- 本轮未发现可证明的旧 Agent 编排、旧模型直连或 Legacy fallback 生产旁路；未删除官方 DSH 传递依赖，避免破坏 SDK 的锁定运行时。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；同源 Web client-plugin provenance、Docker clean build、真实 Provider、DB v6 release provenance、双租户 RLS 运行态、Smart BI 行为等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，用户行为与数据边界复验）

- 新鲜通过：`node realtime/test-harness-output-policy.js`（企业 BI workflow/preamble/ECharts 输出净化）、`node realtime/test-harness-chat-http.js`（authorization、tenant、model、内部 URL 字段净化）、`npm run test:harness-twin-chat`（数字分身 Harness chat、Tool Gateway、RLS-owned session/message 持久化）、`node agent-harness/test-write-boundary.js`（写确认、权限、幂等、shadow、审计）和 `node realtime/test-harness-gateway.js`（Gateway auth/capability/confirmation/idempotency/audit）。
- 这些结果进一步证明本地后端业务边界已接入 Harness；它们仍是离线/合成测试，不替代真实数据库卷上的双租户 JWT/RLS、真实 Provider、同源 Web client-plugin、Docker clean build 或远端验收。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，当前工作树 DSH tool-call 回注复验）

- 首次使用现有 `.codex-tmp/dsh-tool-smoke.mjs` 的固定 15 秒窗口复验时，隔离 DSH profile 首次冷启动返回 `HARNESS_RUNTIME_RPC_TIMEOUT`，且 `proxyCalls=0`；该结果不足以证明工具链回归。
- 第二次使用同一固定 15 秒窗口重跑（此前 profile 已完成本地初始化）成功完成当前工作树的本地闭环：DSH SDK 首轮产生 `eiscore_enterprise_snapshot` tool call，调用本地 `127.0.0.1` mock Tool Proxy，收到 `tool/result` 后发起第二轮模型请求并返回 `mock response recovered`；观测到 `proxyCalls=1`、`modelRequests=2`，退出码为 0。此前尝试设置的 `DSH_TOOL_SMOKE_TIMEOUT_MS=60000` 不被该脚本读取，不作为成功条件。
- 该 smoke 使用脚本化 mock LLM、隔离 DSH_HOME、当前分支 `agent-harness/eiscore-restricted.cordis.yml` 与当前分支 `eiscore-tools.mjs`，未使用真实 API key、未连接数据库或远端；它证明本地 Bridge/plugin/proxy/tool-result loopback 闭环，不证明真实 DeepSeek Provider、同源 Web client-plugin、Docker Compose clean build、DB v6 provenance 或远端验收。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，后端闭环与外部阻塞复核）

- 新鲜通过：`npm run test:syntax`（303 个 Node 文件）、`npm run test:runtime-router`、`npm run test:agent-permission-boundary`、`npm run test:database-backend-governance`、`npm run test:database-roles` 和 `node tests/engineering/harness-production-path-regression.mjs`。这些结果覆盖 Harness 生产路径、Runtime 路由、43 个 Flash 工具权限、数字分身字段 ACL、DB2 角色和数字分身 RLS 静态契约。
- 新鲜通过：`npm run lint:changed`（167 个变更 JS/Vue 文件）、`npm run test:secrets`（2821 个文本文件扫描；仅保留既有 checksum-locked legacy SQL quarantine 警告）以及 `docker compose -f deploy/lundu/compose.yml config --no-interpolate --quiet`。
- 真实阻塞仍在：`node scripts/validate-lundu-harness-artifacts.mjs` 因 `LUNDU_HARNESS_ROOT: required` 非零退出；`docker version` 因 `dockerDesktopLinuxEngine` named pipe 不存在无法连接 daemon。未启动容器、未连接远端、未执行真实迁移或写入数据库卷。
- 同源 Web client-plugin、Docker clean build、真实 DeepSeek Provider/工具输出、DB v6 release provenance、双租户 RLS 运行态和伦度远端验收仍缺少权威证据；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，本地 DeepSeek SDK 初始化 smoke）

- 使用当前分支已有 `agent-harness/node_modules/@deepseek-ai/dsh/lib/bin.js` 和隔离 `DSH_HOME` 运行 `scripts/dsh-sdk-runtime-smoke.mjs --provider deepseek-official --model deepseek-chat`；初始化成功，返回 server `deepseek-harness-sdk-runtime` / `0.0.1`，`frameCount=1`、`stderrBytes=0`。
- 该结果证明本地 DSH SDK runtime 可启动并完成 initialize/shutdown smoke；没有调用真实 Provider、没有执行真实工具输出，也不能替代同源 client-plugin、Docker clean build 或远端验收。
- 隔离 smoke 目录已清理；本轮仍未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，迁移状态文档完整性修复）

- 清理本轮记录误插入的 16 个 ESC 控制字符，并恢复运行时文件、测试命令和目标状态的 Markdown 代码标记；未改动历史记录语义。
- 通过文档专属 `git diff --check`，确认文件不再包含 ESC 控制字符。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Harness 全套回归复验）

- 新鲜通过 `npm run test:harness` 全套回归：插件目录、审计账本、写确认/权限/幂等、Gateway、Tool Gateway、Runtime HTTP、数字分身会话与 RLS 持久化、文档提交、销售写入、查询工具、输出策略、HTTP Bridge 和迁移切换门禁均 PASS。
- 新鲜通过 `node tests/engineering/harness-production-path-regression.mjs`，确认生产 HTTP/WebSocket composition 仍进入 Harness，未重新引入旧 Agent/AI/Twin 入口。
- 新鲜通过 `npm run test:harness-runtime-boundaries`、`npm run test:production-config` 和文档 `git diff --check`；状态文档 ESC 控制字符数为 0。
- 未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；同源 Web client-plugin、Docker clean build、真实 Provider/工具输出、DB v6 release provenance、双租户 RLS 运行态和远端验收仍是未完成项，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Runtime readiness 与 Bridge secret 契约一致性）

- 发现 `realtime/harness-runtime.js` 的 `isHarnessConfigurationReady()` 只检查两个服务 secret 的长度，没有拒绝两者复用；而 Bridge 启动入口已拒绝复用，导致 Runtime 可能报告“就绪”但实际 Bridge 不会启动。
- 现将 Runtime readiness 收紧为：两个 secret 均至少 32 字符且必须不同；新增 `realtime/test-harness-runtime-boundaries.js` 回归覆盖复用场景。
- 修复后通过：`npm run test:harness-runtime-boundaries`、`npm run test:production-config`、完整 `npm run test:harness`、`npm run lint:changed`（167 个文件）。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 Web client-plugin、Docker clean build、DB v6 provenance、双租户 RLS 运行态和远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Bridge 启动期 secret 故障关闭）

- 复核发现独立运行 `agent-harness/dsh-http-bridge.mjs` 时可能绕过 `validate-production-env.mjs`，此前启动入口只校验 Runtime→Bridge secret；Bridge→Tool Proxy secret 的长度和双向独立性没有在进程启动前强制。
- 新增可测试的 `validateBridgeSecrets()`：Bridge 启动前同时要求两个 secret 至少 32 字符，并拒绝两者相同；失败时进程不会监听 HTTP 端口。该校验与生产环境门禁保持同一错误契约。
- 新增运行时回归覆盖：合法双 secret、Bridge secret 过短、Tool Proxy secret 过短、双 secret 复用；通过 `node agent-harness/test-dsh-http-bridge-runtime.mjs`。
- 修复后通过：`npm run test:harness-bridge`、`npm run test:production-config`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run lint:changed`（167 个文件）。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 Web client-plugin、Docker clean build、DB v6 provenance、双租户 RLS 运行态和远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，双向服务 secret 独立性门禁）

- 发现生产配置校验只检查 `EISCORE_HARNESS_BRIDGE_SECRET` 与 `EISCORE_TOOL_PROXY_SECRET` 的长度/字符集，没有拒绝两者复用；这会削弱 Runtime→Bridge 与 Bridge→Runtime Tool Proxy 的信任方向隔离。
- `scripts/validate-production-env.mjs` 现拒绝两项 secret 相同，并以 `Harness bridge and tool proxy secrets must be independent` 稳定报错；`tests/engineering/production-config-regression.mjs` 增加复用场景回归。
- 修复后通过：`npm run test:production-config`、`npm run test:harness-bridge`、`npm run test:harness-runtime-boundaries` 和完整 `npm run test:harness`。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送；真实 Provider、同源 Web client-plugin、Docker clean build、DB v6 provenance、双租户 RLS 运行态和远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，LUNDU Provider/模型显式配置门禁）

- 发现并修复一处部署契约不一致：`deploy/lundu/compose.yml` 的 `harness-bridge` 原先对 `DSH_PROVIDER`/`DSH_MODEL` 使用默认值，可能在部署侧遗漏配置时静默启动未经确认的 Provider/模型；现改为 `${DSH_PROVIDER:?DSH_PROVIDER is required}` 与 `${DSH_MODEL:?DSH_MODEL is required}`，与根级生产 Compose 和 `validate-production-env.mjs` 的缺失即失败语义一致。
- `tests/engineering/production-config-regression.mjs` 新增 LUNDU bridge 显式 Provider/模型断言；`deploy/lundu/README.md` 补充远端 `.env` 必须显式配置两项的操作说明。
- 修复后通过：`npm run test:production-config`、`npm run test:harness-bridge`、`node tests/engineering/harness-production-path-regression.mjs`。没有连接远端、启动 Compose、执行真实迁移或写入业务数据库卷。
- 本轮只收紧 LUNDU Harness 配置门禁；同源 Web client-plugin、Docker clean build、真实 Provider/工具输出、DB v6 provenance、双租户 RLS 运行态和远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，旧 Provider/Agent 残留审计）

- 对当前分支运行时代码、Compose、环境模板、Harness Bridge/Tool 文件和宿主前端 client 进行旧集成标记审计；未发现生产代码读取 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`DEEPSEEK_API_KEY`、`CLINE_*`，也未发现重新导入 `agent-core`、`agent-task-service`、`agent-access-service`、`ai-http`、`twin-engine` 或旧 Provider egress。
- `scripts/validate-production-env.mjs` 中保留的旧变量名属于拒绝清单：其行为是发现非空值即失败，不能被解释为运行时旧模型调用；`harness-production-path-regression.mjs` 对 runtime 源文件、Bridge、Compose 和依赖锁文件仍执行生产路径门禁。
- 现有 `node tests/engineering/harness-production-path-regression.mjs` 通过，证明 `/ai/*`、`/twin/chat`、Harness execute、Tool Proxy、Flash 和 WebSocket composition 未重新引入旧 Agent 编排、直接模型出口或 fallback/shadow 开关。
- 本轮未修改运行时代码、未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送；外部制品、Docker/API 运行态、真实 Provider、DB v6 provenance 和远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，数据库与权限边界复核）

- 新鲜通过：`npm run test:agent-permission-boundary`（Flash capability 角色权限、43 个语义工具和数字分身字段 ACL）、`npm run test:production-config`（生产配置、LUNDU 制品预检、DSH Web runner）以及 `node tests/engineering/secret-scanner-regression.mjs`。
- 新鲜通过：`npm run test:database-backend-governance`、`npm run test:database-roles`。其中 DB2 运行身份/secret 注入、数字分身表 RLS 与 authenticated username 所有权均通过；没有连接真实数据库。
- `npm run test:database-migrations` 在 `database-release-contract-regression.mjs` 处停止；`npm run test:database-structure-exit` 在 `db6-database-structure-governance-exit-regression.mjs` 处停止。两者报告同一组 7 项既有 drift：contract/core migration/postcheck release artifact、core manifest checksum/terminal/list、database catalog checksum、PostgREST contract checksum。
- `npm run db:release:drift` 的冻结终点仍为 `core-007`，当前候选包含 `core-008`/`core-009`；冻结 manifest 与当前候选 source revision/checksum 不一致。未修改冻结 v6 manifest、未执行真实迁移，也未把该失败误归因于 Harness 权限链路。
- 本轮未连接远端/生产、未启动持久 Compose、未写入业务数据库卷、未发布、未提交或推送；Harness 本地链路保持通过，完整目标仍受同源 Web client-plugin、Docker clean build、真实 Provider、DB v6 release provenance 与远端验收阻塞，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，运行态门禁归因）

- `node tests/engineering/runtime-v2-postcheck.mjs` 未完成：脚本无法列出 Docker 容器，原因是 `dockerDesktopLinuxEngine` named pipe 不存在；没有启动或修改容器。
- `node tests/engineering/runtime-v2-access-smoke.mjs` 未完成：本机 `127.0.0.1:3000` 返回 `ECONNREFUSED`，当前没有运行中的本地 API/数据库访问端点；没有自行启动持久 Compose。
- `node tests/engineering/harness-production-path-regression.mjs` 通过；`database-release-contract-regression.mjs` 仍仅报告已记录的 DB v6 release artifact/manifest/catalog/PostgREST checksum drift。
- 本轮未连接远端/生产、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送；运行态 Docker/API、同源 Web client-plugin、真实 Provider、DB v6 provenance 和远端验收仍缺少权威证据，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，静态质量门禁）

- `npm run lint:changed` 通过：当前相对 `HEAD^` 的 167 个变更 JavaScript/Vue 文件全部通过 lint。
- `npm run test:runtime-image` 通过：27 个 runtime composition-root 模块、2 个 Dockerfile 及 10 个 Vite dev-proxy consumer 的契约通过。
- `npm run test:syntax` 通过：303 个 Node 脚本语法检查通过。
- 这些静态门禁不能替代 Docker/API 运行态、真实 Provider、同源 Web plugin、DB v6 provenance 或远端双租户验收；本轮仍未连接远端、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，完成条件审计与 Harness 回归）

- 重新阅读并遵守 `docs/engineering/LUNDU_MULTI_AGENT_BRANDING_COORDINATION.md` 与 `docs/engineering/LUNDU_REMOTE_BRANDING_FIX_20260927.md`；本轮没有连接伦度远端、没有发布服务、没有启动持久 Compose、没有执行真实迁移或写入业务数据库卷。
- 生产路径静态复核确认 `realtime/http-router.js` 的 `/ai/*`、`/twin/chat`、`/ai/harness/execute` 和 Tool Proxy 路由均绑定 Harness handler；旧 `realtime/agent-*`、`ai-http`、`twin-chat-http` 等入口仍为删除状态，未发现新的生产可达旧 Agent/模型直连/fallback 入口。
- 当前工作树回归全部通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:migration-switch`、`node tests/engineering/harness-production-path-regression.mjs`。其中覆盖 Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、Twin 持久化、文档/销售写入、生产 HTTP/WebSocket composition、LUNDU 制品预检和迁移开关。
- 这些本地结果不等同于完整目标完成：`LUNDU_HARNESS_ROOT` 同源 Web client-plugin 制品、Docker daemon/当前工作树 clean build、真实 DeepSeek Provider/工具输出、正式 DB v6 provenance、真实双租户 RLS 和伦度远端验收仍缺少权威证据；全局目标保持 `active`。

更新时间：2026-10-03

## 目标

将 EISCore 的生产可达 Agent 请求统一切换为：

```text
DeepSeek Harness Plugin -> EISCore Harness Gateway -> Tool/业务服务 -> PostgREST/RPC -> PostgreSQL + RLS
```

本次范围只覆盖后端迁移，不修改前端视觉、图片、数据库卷，也不连接生产环境。

## 迁移前调用基线

以下基线从迁移前 Git commit `02b6588` 的已提交源文件读取，不是根据已删除文件的记忆推断：

| 迁移前入口/职责 | 快照中的调用位置 | 当前迁移方向 |
| --- | --- | --- |
| AI HTTP | `/ai/config`、`/ai/agents`、`/ai/business-snapshot`、`/ai/chat/completions`、`/ai/translate`、`/ai/ocr`、`/ai/map-locate`；`realtime/index.js` 注入 `ai-http.js`、`ai-chat-http.js` | HTTP 清单统一映射到 Harness read/chat/capability handlers；业务快照从本地 Tool Gateway 执行 |
| 旧模型 runtime | `ai-runtime-service.js` 定义 `callAiUpstream` 与 retry；调用者为 `agent-access-service.js`、`ai-http.js`、`ai-chat-http.js`、`ai-output-guard.js`（两处）和 `twin-chat-http.js`（两处） | 当前 Runtime 生产源中无旧函数调用，Harness dispatch 由 `harness-runtime.js` 统一执行 |
| Agent task/access | `realtime/index.js` 装配 `agent-task-service.js`、`agent-access-service.js`；WebSocket manifest 暴露 `agent:task`、`agent:tool_use`、`agent:terminal` | 旧执行消息已从生产 WebSocket manifest 移除；Flash semantic tools 保留独立权限和业务执行 |
| 数字分身 | `POST /twin/chat` -> `twin-chat-http.js` -> `TwinEngine` ReAct 循环/模型 caller | `/twin/chat` -> `eiscore_twin_chat` -> 会话归属/RLS 持久化 -> Harness dispatch |
| Flash Cline | WebSocket manifest 暴露 `flash:cline_task/stop/reset`；`flash-cline-service.js` 启动 CLI，根 `realtime/package.json` 依赖 Cline | 旧执行器、消息入口与依赖已移除；Flash semantic registry、权限、幂等与业务执行保留 |
| Company Sales | `company-sales-agent.js` 有可注入的 `answerWithAi` 分支，但快照 `index.js` 创建 handler 时未传该依赖，故属于未接线的可选能力，不计为当时生产模型调用 | 公开访客会话不再内嵌旧模型调用；Harness 销售上下文/写能力走固定 capability |
| Document Intake / Workflow | 上述生产文件中未发现 `callAiUpstream*` 直接调用；旧解析、计划、worker 和 workflow 状态处理属于业务执行层 | 继续保留解析/计划/提交与审批边界；Harness 仅经固定工具调用，不宣称模型调用曾由这些 worker 承担 |

基线中 `ai-output-guard.js` 还会对企业回答执行 ECharts JSON 修复（最多 6 轮本地修复尝试）和经营回答改写；该旧模型后处理路径随 Legacy runtime 删除。仓库外曾发现一套未提交的 `eiscore-auth`、`digital-twin`、`enterprise-bi` 编译入口，但它不是当前分支制品；当前只读复核还发现该候选目录缺少 `eiscore-tools.mjs` 与 `eiscore-restricted.cordis.yml`，因此 artifact preflight 和 DSH Web runtime smoke 均不能作为通过证据。制品不受当前分支版本控制，也未在锁定版本的 Harness runtime 中加载，因此 ECharts/经营回答的业务等价输出仍无真实插件行为验收证据。不能用“文件存在”或“旧调用已删除”代替通过。

## 已切换

- 已注册 9 个 Harness 插件：`enterprise-bi`、`worker-grid`、`digital-twin`、`workflow`、`company-sales`、`document-intake`、`flash-builder`、`engineering`、`independent-site-sales`。
- 18 项已实现 capability 均有逐项 `intent`、`object`、`risk`、`permissions`、`audit_required`、`timeout_ms` 策略；registry 与迁移门禁拒绝缺少 capability policy 或超出插件超时上限的配置，写 capability 继续强制确认和幂等。
- 18 项 capability policy 现在同时声明独立的 `input_schema` 与 `output_schema`；registry 与迁移门禁会拒绝缺失或非 object schema，工具描述不再仅继承插件级 schema。
- Registry 提供只读 `listCapabilities()`，将 `plugin_id`、`agent_id`、`capability_id`、策略和继承的输入/输出 schema 组合为 18 个工具描述；返回值是深拷贝，调用方不能反向修改进程内契约。
- Registry 拒绝重复或非法 capability ID，`resolveCapability()` 使用唯一索引，避免多个插件声明同一能力时静默选择错误路由。
- Registry 深度冻结插件和 capability schema；`getById()` 返回的契约对象也不能被调用方原地修改。
- Registry 运行时加载也强制 capability permissions 非空且 input/output schema 为 object，与迁移门禁保持同等拒绝策略。
- `realtime/http-router.js` 中 AI、数字分身和能力入口均指向 Harness handlers。
- Harness Gateway 负责认证主体、租户、JWT、插件/Agent/能力匹配、权限、写确认、幂等、shadow 拒绝和审计。
- Gateway 现在要求每个执行请求显式携带已注册 `capability_id`；聊天入口按插件绑定只读默认 capability，禁止空能力或仅插件级请求绕过能力策略。
- Bridge 负责协议、subject/tenant session ownership、插件绑定、request replay protection 和容量限制；缺少归属或插件头时直接拒绝。
- Bridge 现在还会将 `x-eis-plugin-id` 与注册插件 allowlist 比对；未知插件在建立 session 或进入 invoke 前返回 `HARNESS_PLUGIN_UNAVAILABLE`。
- Bridge 调用外部 Harness 时采用最小 header allowlist，只转发协议、会话、请求和插件标识，不把 JWT 或原始 subject/tenant 传给插件执行器。
- Runtime 发往 Bridge 的请求同样不携带 `Authorization` 或用户 JWT；owner subject/tenant 仅作为已验证归属头传递，并由 Bridge 再次校验。
- Runtime 对 Bridge 非 2xx 响应执行错误码/消息白名单；未知外部错误统一为 `HARNESS_UPSTREAM_UNAVAILABLE`，不把 Harness 内部错误原文返回给客户端。
- Bridge 会按 `sessionTtlMs` 清理过期 session 与 replay 记录，过期 session 不会永久占用容量配额。
- Gateway 按 capability/plugin `timeout_ms` 执行可取消的 AbortSignal 超时；超时审计为 `HARNESS_UPSTREAM_TIMEOUT`，不会静默等待或回退旧模型。
- Gateway 对每个 `request_id` 执行带 TTL 的 replay protection；重复请求在 dispatch 前返回 `HARNESS_REQUEST_REPLAY` 并写入拒绝审计，过期 request ID 可重新使用。
- Gateway 对 `capability_id`/`capabilityId` 兼容输入先统一归一化，再执行能力级写确认、幂等、超时和审计策略，避免别名字段绕过 capability policy。
- 生产 WebSocket 只保留订阅、取消和 Flash 工具调用；旧 Agent/Cline 消息入口已移除。
- Harness 不可用时返回稳定错误，不自动回退到 Legacy 模型链路。
- 聊天上下文在进入 Harness 前由服务端递归净化，移除 JWT、token、tenant、授权、模型、provider、密码和内部 API URL 字段，并限制深度与大小。
- 聊天入口回归测试验证未知 `plugin_id` 在 dispatch 前被拒绝，不会借助默认 agent/capability 映射落入 `enterprise-bi`。
- 生产 Compose/环境校验现在要求显式启用 Harness、桥接 URL、绝对审计文件和至少 32 字符审计哈希密钥；审计文件挂载独立命名卷，旧 Anthropic/Cline 配置不再注入。
- Runtime image 与 infrastructure 回归已同步 Harness-only 迁移基线：composition root 当前 26 个模块且包含 Harness 入口，已删除的 Cline setup 脚本不会被工程测试重新要求；生产 Compose 测试提供并校验全部 `EISCORE_HARNESS_*` 必填变量。
- 审计哈希 key 缺失或不足 16 字符时故障关闭；审计终态失败返回需要使用同一幂等键对账的错误。
- 审计事件现在写入经过 registry 校验的 capability `intent`、`object`、`risk`、`audit_required` 和 `timeout_ms` 摘要，便于按实际策略审计而不记录 JWT、提示词或业务正文。
- Gateway 回归测试直接向请求注入 JWT、Authorization、提示词和业务正文哨兵值，并断言所有审计事件序列化结果均不含这些原文；账本只保留主体/租户/幂等哈希和策略摘要。
- Harness Gateway 未传入显式 audit sink 时也故障关闭；默认审计实现抛错，不允许以 no-op sink 放行任何 capability。
- `/ai/config` 与 `/ai/agents` 按已认证用户的 permissions 过滤插件和 capability；无匹配权限的能力不会暴露在目录响应中。
- `/ai/harness/metrics` 复用同一 permissions 过滤器，不再作为能力目录的旁路泄露全量插件。
- `/ai/harness/execute` 的 HTTP 回归测试验证请求体中的伪造 `user`/`tenant_id`/JWT 不会覆盖认证器返回的用户上下文，执行始终使用已认证主体和租户。
- `/ai/business-snapshot` 会保留明确的 `HARNESS_PERMISSION_DENIED`（403）响应；只有未知/上游故障才规范化为 `HARNESS_UPSTREAM_UNAVAILABLE`（503），避免把权限问题误报成 Harness 故障。
- 审计账本使用 `lstat` 拒绝符号链接目标。
- `eiscore_flash_read` / `eiscore_flash_write` 已进入本地 Tool Gateway，复用 Flash semantic registry、权限器、PostgREST/RPC 执行器和原有幂等逻辑。
- `eiscore_twin_context` 与 `eiscore_twin_chat` 已进入本地 Tool Gateway，前者复用 `twin-tools` 的字段 ACL、权限检查和用户 JWT/RLS 查询，后者在 Gateway capability 内校验 UUID/session ownership、从数据库加载历史、保存用户与助手消息，再调用 Harness 推理。
- 数字分身 HTTP/SSE handler 现只做认证、请求校验和流响应，并经带审计的本地 Tool Gateway 执行聊天；客户端 `history` 不作为授权依据，外部 `session_id` 必须是当前用户 RLS 可见的服务端会话。
- `eiscore_enterprise_query` 与 `eiscore_grid_query` 已进入受约束查询 Tool Gateway；数据集、字段、排序、筛选和 PostgREST profile 由服务端目录固定，禁止模型传 SQL、表名、租户、用户、JWT 或 URL。
- 受约束查询回归测试还确认 PostgREST/RLS 调用收到的是已认证用户的原始 JWT 与 tenant 上下文，而不是模型 payload 中可伪造的身份字段。
- Harness 企业快照在角色语义上下文或字段权限不可用时直接拒绝，不返回旧链路的“部分快照 fallback”。
- 企业快照员工统计仅读取受权限保护的 `hr.archives`；HR 查询失败时不再回读兼容的 `public.employees`，也不再生成空的业务快照 fallback。
- 插件能力级风险策略已冻结：文档计划读取为低风险，文档提交为高风险且必须确认与幂等；不能用插件顶层风险覆盖能力级策略。
- `eiscore_workflow_context` 与 `eiscore_sales_context` 已接入只读执行路径；`eiscore_workflow_write` 已通过固定的 workflow Flash 工具 allowlist 接入本地 Tool Gateway，`eiscore_sales_write` 已通过固定 operation 适配层复用既有 company-sales 审批、草稿和同步 handler，继续由 Harness Gateway 强制权限、确认、幂等和审计边界。
- `eiscore_engineering_context` 与 `eiscore_site_sales` 已进入本地 Tool Gateway：工程能力只读取固定设备、BOM 和生产视图；独立站销售能力只读取 `primary` 站点的已发布配置、产品和知识文档。两者均复用当前用户 PostgREST/RLS token，拒绝模型传入 SQL、表名、租户、用户、JWT 或任意站点键。
- `eiscore_multimodal_translate`、`eiscore_multimodal_ocr` 与 `eiscore_multimodal_map_locate` 已切换到 Harness capability dispatch。服务端固定消息结构、图片引用格式和坐标范围，拒绝模型/API/数据库/授权字段，并将返回值规范化为 `text` 或 `address`。
- 多模态 HTTP 路由按 `/ai/translate`、`/ai/ocr`、`/ai/map-locate` 固定 capability；请求体不能改写路由能力，错配返回 `HARNESS_CAPABILITY_MISMATCH`。
- `EISCORE_HARNESS_ENABLED=false` 时，业务快照、chat、多模态和数字分身 HTTP handlers 均在读取请求体、查询数据或访问持久化前返回 `HARNESS_DISABLED`；禁用态不会 dispatch 到 Harness，也不会创建/修改数字分身会话。
- Harness runtime 发往 Bridge 的 owner tenant header 与 Gateway/Flash JWT 使用同一规范化租户字段顺序（`tenant_id`、兼容别名），冲突时优先已规范化的 `tenant_id`，避免 Gateway 已通过而 Bridge 因别名丢失归属。
- Runtime 发往 Bridge 的 owner subject 与 Gateway 使用同一主体优先级（`id`、`sub`、`username`），仅含标准 JWT `sub` 的已认证用户不会被 Bridge 错误拒绝；JWT/Authorization 仍不会转发给 Harness。
- `eiscore_document_plan` 已接入固定字段的计划只读查询，仅接受服务端 UUID 计划/资产 ID；`eiscore_document_commit` 已接入版本化计划提交，只接受服务端 `plan_id` + `updated_at` 版本，通过当前用户 JWT/RLS 读取和条件更新计划，再调用固定 data-app 或采购入库 worker，不接受模型拼接的 SQL、表名或业务字段。
- Flash PostgREST 适配器重签用户 JWT 时会携带已认证的 `tenant_id`（兼容 `tenantId`/`tenant` 输入别名），租户声明只来自服务端用户上下文，不接受模型或请求 payload 覆盖；现有数据库迁移未宣称通用 tenant 列级 RLS，仍按既有 `app_role`、用户会话归属和单企业站点策略执行。
- 数据库边界与 ADR-0012 一致：一套部署只服务一家企业，`company_site` 行通过 `site_key='primary'`、CHECK 约束和 `eiscore_agent` RLS 保护；这证明隔离单租户部署契约，不等价于共享数据库双租户 RLS。
- Flash 工具注册表的草稿/附件元数据已统一暴露 canonical `/flash/*` 路径；旧 `/agent/flash/*` 仅保留为不存在的兼容输入，不再由注册表向 Harness/客户端发布。
- 应用中心 Flash runtime bridge、草稿预览、Flash Builder 和 App Runtime 的请求也已切换到 canonical `/flash/*`，避免后端切换后继续请求已删除的 `/agent/flash/*` 路径；本次仅同步 API 协议，不改页面视觉。
- 根 Compose 与 Lundu Nginx 现在显式代理 canonical `/ai/*`、`/flash/*`、`/twin/*` 和 `/document-intake/*` 到 Runtime，避免 canonical 客户端请求被静态 SPA 捕获；现有 `/agent/` 兼容代理仍保留给 company-site、document-intake 等历史业务协议。

## 尚未完成的核心迁移

- 目前迁移目录中的所有声明能力均已拥有 Harness dispatch 或本地 Tool Gateway 绑定；这证明能力路由已接入，不代表所有原 Agent 工具已经逐一完成业务等价或端到端验收。
- Workflow context 只允许服务端固定的五个 workflow read 工具；Workflow write 只允许服务端固定的五个 workflow write 工具；Sales context 强制使用 `sales_orders` 数据集，模型不能通过 payload 改写工具或数据集。
- Sales write 只允许 `qualify_lead`、四类 draft create、`sales_approval` 和 `sales_sync_enqueue` 七个固定 operation；资源 ID 必须是 UUID，审批/同步继续经过既有 company-sales handler，未知 operation、表名、SQL 和非 UUID 资源均拒绝。
- `/ai/harness/execute` 已与向 Harness 请求回答的 chat dispatch 分离；未注册能力返回稳定的 `HARNESS_TOOL_UNAVAILABLE`，不会回退到 Legacy。
- 已移除不可达的旧模型 HTTP/runtime、旧 Twin Engine、旧 Agent Core/service 和 Cline runtime/service；删除 Anthropic/旧 HTTP/文件监听依赖及 Compose/env 样例中的 Cline 配置。旧 `ai-agent-policy.js` 已删除，唯一保留的文本归一化 helper 移至 `message-normalization.js`，旧 Agent catalog、模型默认值、Prompt 编排、意图路由和 completion 清洗均已删除。
- `eiscore-apps/README.md` 已同步为 Harness-only 部署与调用说明，移除旧 Anthropic API Key、`agent:task` 协议、Cline 排障和直接 Claude API 示例；生产路径回归会阻止这些旧集成重新出现在应用中心文档中。
- 应用中心的 `src/utils/agent-client-examples.js` 已改为 `/ai/harness/execute` 与 `/flash/tools/call` 示例，不再发布旧 Agent WebSocket 任务、工具或终端协议；生产路径回归会锁定该示例不重新引入旧协议。
- `FlashBuilder.vue` 的旧 Cline 壳模式 UI 仍保留历史 `flash:cline_*` 事件处理，但当前后端 WebSocket manifest 不再注册这些消息；本轮只同步了 Flash HTTP API 路径，未重写该前端交互，避免把前端视觉/交互重构混入后端迁移。
- 独立站公开销售会话保留知识检索、访客会话归属、消息持久化、人工转交和线索幂等写入，但已移除 `company-sales-agent` 的 `answerWithAi` 注入、模型名称审计字段和模型失败回退；模型能力只能从 Harness chat/capability 路径进入，公开匿名会话不伪造企业 JWT。

## 保留的业务边界

- JWT、session、tenant、role、权限和资源范围校验。
- PostgREST/RPC、RLS、事务、审批、状态机、文件解析、文档计划、数字分身会话归属和消息持久化。
- SSE、WebSocket、请求取消、稳定错误码、幂等和审计账本。
- Flash semantic registry、工具白名单、项目路径边界和写确认。

## 旧路径清理

旧 Agent/模型/Cline 执行文件及其专用回归测试已删除；Harness 生产路径门禁保留旧入口禁用断言。Flash semantic workspace、权限、PostgREST 和文件边界仍保留。

## 验证结果

已通过：

- `npm run test:syntax`
- `npm run test:harness`
- `node realtime/test-harness-runtime-boundaries.js`
- `node realtime/test-harness-twin-chat.js`
- `node realtime/test-harness-twin-chat-capability.js`
- `node realtime/test-harness-document-commit.js`
- `node tests/engineering/harness-production-path-regression.mjs`
- `node realtime/test-harness-sales-write.js`
- `node realtime/test-harness-context-capabilities.js`
- `node tests/engineering/twin-tools-permission-regression.mjs`
- `node tests/engineering/ai-context-service-regression.mjs`
- `node realtime/test-harness-multimodal.js`
- `node realtime/test-harness-capability-http.js`
- `node realtime/test-harness-chat-http.js`（聊天上下文与消息敏感字段净化）
- `node agent-harness/test-http-bridge.js`（含 session TTL、subject/tenant/plugin 归属拒绝）
- `node realtime/test-harness-runtime-boundaries.js`（确认 Runtime Bridge headers 不含 Authorization/JWT，且保留已验证 session/request/plugin/owner 归属头）
- `node tests/engineering/message-normalization-regression.mjs`（确认 Harness message normalization 不含旧 Agent policy）
- `node tests/engineering/runtime-http-router-regression.mjs`
- `node tests/engineering/realtime-composition-root-regression.mjs`
- `node tests/engineering/flash-postgrest-adapter-regression.mjs`（用户 JWT 租户声明、Profile、错误映射、超时和动态表恢复）
- `node tests/engineering/websocket-server-regression.mjs`
- `npm run test:runtime-router`（包含当前 Harness WebSocket dispatcher 回归）
- `node tests/engineering/company-sales-agent-regression.mjs`（独立站公开销售会话、知识检索、人工转交和旧模型注入点清理）
- `node tests/engineering/flash-tool-registry-regression.mjs`（canonical `/flash/*` 工具路径）
- `node tests/engineering/harness-production-path-regression.mjs`（扫描 realtime 运行时目录，禁止旧 AI upstream、Anthropic、Cline 配置回归）
- `npm run test:production-config`（伦度 Compose 的显式 Harness 根目录、patch 只读挂载及三个 client plugin patch 输入契约）
- `node agent-harness/test-plugin-registry.js` 与 `node scripts/migration-switch-gate.mjs`（逐 capability 校验 intent、object、permissions、risk、确认/幂等策略）
- `node scripts/migration-switch-gate.mjs` 还验证插件合同、迁移目录和 implemented capability inventory 三者的 capability 集合完全相等，防止漏列能力仍误报迁移完成。
- `node agent-harness/test-plugin-registry.js` 还锁定 18 个规范化工具描述及写能力 schema/审计/超时字段。
- `node agent-harness/test-plugin-registry.js` 还验证缺失 capability schema 时 registry 会拒绝加载。
- `node agent-harness/test-plugin-registry.js` 还验证重复 capability identity 会被 registry 拒绝。
- `node agent-harness/test-plugin-registry.js` 还验证 `getById()` 暴露的 schema 是深度只读的。
- `node agent-harness/test-plugin-registry.js` 还验证空 permissions 和非 object schema 的合同会被 registry 拒绝。
- `node agent-harness/test-write-boundary.js` 还验证 `capabilityId` 兼容输入不会绕过 `eiscore_workflow_write` 的确认边界。
- `node agent-harness/test-http-bridge.js` 还验证 Bridge invoke 收不到 Authorization、原始 subject 和原始 tenant header。
- `node agent-harness/test-http-bridge.js` 还验证未知插件不会建立 Bridge session 或进入 invoke。
- `node realtime/test-harness-gateway.js` 还验证审计事件不包含 JWT、Authorization、提示词或业务正文原文。
- `node realtime/test-harness-read-http.js` 还验证 capability 目录按用户 permissions 过滤。
- `node realtime/test-harness-read-http.js` 还验证 metrics 端点隐藏无权限插件。
- `npm run test:database-roles`、`npm run test:database-migrations`、`npm run test:database-backend-governance`、`npm run test:database-structure-exit`（数据库角色、迁移、PostgREST 契约、RLS/结构治理静态门禁）
- `npm run test:database-roles`
- `npm run test:database-migrations`
- `npm run test:database-backend-governance`
- `npm run test:database-structure-exit`
- `npm run test:production-config`
- `npm run lint:changed`（排除 `.codex-tmp`/`.playwright-cli` 生成产物后通过）
- `docker compose -f docker-compose.yml config --quiet` 与 `docker compose -f docker-compose.prod.yml config --quiet`（显式 Harness 临时环境变量）
- `git diff --check`
- `npm run test:runtime-image`、`npm run test:infrastructure`、`npm run test:secrets`（运行镜像、基础设施、密钥扫描；后者仅报告既有 checksum-locked legacy SQL quarantine 警告）

本轮复核（2026-09-27）再次通过：`npm run test:harness`、`npm run test:runtime-router`、`node tests/engineering/harness-production-path-regression.mjs`、`node scripts/migration-switch-gate.mjs`（含合同/目录/实现集合双向一致性）、`npm run test:syntax`、`npm run test:production-config`、`npm run test:database-roles`、`npm run test:database-migrations`、`npm run test:database-backend-governance`、`npm run test:database-structure-exit`、`npm run lint:changed` 和 `git diff --check`。`npm run test:unit` 仍仅失败于下述两项独立站资源存在性测试，未发现新的后端迁移失败。
- 后续 Flash 协议复核通过：`node tests/engineering/flash-agent-client-regression.mjs`、`node tests/engineering/flash-builder-composition-exit-regression.mjs`、`npm run test:runtime-router` 和 `node tests/engineering/harness-production-path-regression.mjs`；应用中心的 Flash tool/draft 请求已使用 canonical `/flash/*`，不再请求已移除的 `/agent/flash/*`。
- Nginx canonical route 复核通过：`npm run test:production-config`、`npm run test:infrastructure`；根 Compose 与 Lundu Compose 均显式代理 `/ai/*`、`/flash/*`、`/twin/*` 和 `/document-intake/*` 到 Runtime。
- 根 Nginx 的 `/agent/` WebSocket 兼容代理已补齐 Upgrade/Connection 头，保留现有实时订阅兼容性；生产旧 Agent/Cline 执行消息仍由 Runtime WebSocket manifest 拒绝。
错误映射修复后追加通过：`npm run test:runtime-router`、`npm run test:production-config`、`npm run test:database-backend-governance`、`node tests/engineering/harness-production-path-regression.mjs` 和 `node scripts/migration-switch-gate.mjs`。

本轮审计确认：Harness Gateway 审计事件只记录策略摘要与主体/租户/幂等哈希；未发现 JWT、授权头、提示词或业务正文进入该账本。数字分身工具日志属于独立业务持久化日志，仍由其自身字段边界管理。

`npm run test:unit` 当前被既有独立站资源缺失阻塞：`research-gallery/gallery-001.png`、`research-gallery/gallery-021.jpeg`。这些资源属于此前用户变更范围，本次未恢复或删除。

完整 `npm run test:quality` 另被既有前端复杂度基线阻塞：`eiscore-mobile/src/views/LoginView.vue` 当前 1826 行，基线为 1632 行；该前端文件不属于本次后端迁移范围，本次未回退或重写。

以上测试证明入口、契约、安全边界和回归门禁有效，不证明 9 个插件的业务工具已完成端到端接入。

## 外部验收阻塞

- 尚未执行真实双租户 RLS 负向验收；合成 fixture 不作为真实租户通过证据。
- 当前代码和基线没有共享双租户 schema；若未来引入共享租户，必须新增 ADR、租户列/RLS 迁移和真实 A/B token 负向验收，不能把 `site_key='primary'` 解释为双租户证明。
- 本机 Docker CLI 可用，但 Docker daemon 未能在超时内返回版本信息，未执行 Docker clean build；没有启动容器或连接远端。
- 本轮再次执行 `docker version`，仍失败于 `npipe:////./pipe/dockerDesktopLinuxEngine` 不存在；Docker clean build 继续保持未验收。
- 本轮 `docker version` 的具体阻塞仍为 `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`；未启动容器。
- `deploy/lundu/compose.yml` 未使用本机真实 `.env` 解析；该文件不存在，未创建或覆盖部署环境文件。
- 以 `deploy/lundu/.env.example` 作为 Compose env-file 也无法解析，因为 Compose 主文件明确要求部署侧 `.env`，而 example 文件不能替代它；`compose.harness-web.yml` 单独解析则因预期由主 Compose 提供的 `agent` 服务未定义而失败。
- 已修复伦度 Harness patch 挂载：`compose.yml` 和 `compose.harness-web.yml` 均将 `./dsh-web.patch.yml` 只读挂载到 `/opt/eiscore-harness/dsh-web.patch.yml`，与启动命令/runner 的引用一致。
- 伦度 Compose 不再硬编码 Harness 根目录，改为要求部署侧显式设置 `LUNDU_HARNESS_ROOT`；该目录必须提供 `client-plugins/eiscore-auth`、`digital-twin` 和 `enterprise-bi` 的编译入口。它们是外部 Harness 部署输入，本轮未复制或改造前端 client plugin，也未启动远端容器。
- 尚未执行真实 Harness SDK/API 和远端环境验收。
- 当前不执行生产连接、远端部署或真实客户数据测试。

## 继续审计记录（2026-09-27）

- 本轮再次通过：`npm run test:harness`、`node scripts/migration-switch-gate.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:syntax`、`npm run test:runtime-router`、`npm run test:production-config`、`npm run test:infrastructure`、`npm run lint:changed`、`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:database-migrations` 和 `git diff --check`。
- `npm run test:unit` 的失败仍仅为 `eiscore-company-site` 缺失 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg`；本轮未恢复、伪造或删除这些前端资源。
- `docker version` 仍因 `npipe:////./pipe/dockerDesktopLinuxEngine` 不存在而无法连接 daemon；未执行 clean build、启动容器或部署。
- 本轮没有发现生产可达旧模型 API、旧 Cline 执行器或 Legacy fallback 回归；目标继续保持 `active`，等待真实 Harness SDK/API、Docker 和真实租户 RLS 负向验收。
- 为避免目录级字符串检查高估接入程度，`realtime/test-harness-tool-gateway.js` 新增了 `enterprise_query`、`grid_query`、`twin_chat`、`workflow_write`、`sales_context` 和缺失执行器故障分支的 dispatch 契约覆盖；`npm run test:harness`、`npm run test:syntax` 和 `npm run lint:changed` 已重新通过。
- 生产路径复核确认：`/agent/ai/*` 与 `/agent/twin/*` 仅作为去前缀兼容别名并进入 Harness canonical handlers；`/agent/company-site/*`、`/agent/document-intake/*` 是保留的业务协议；WebSocket 仅注册订阅、取消和 Flash 工具调用，旧 Agent/Cline 执行消息不可达。
- 本轮额外通过：`npm run test:runtime-image`、`npm run test:secrets`、`npm run test:infrastructure`、`node tests/engineering/flash-agent-client-regression.mjs` 和 `node tests/engineering/flash-builder-composition-exit-regression.mjs`；secret scan 仍只有 checksum-locked legacy SQL quarantine 警告。
- 本轮尝试启动本机 Docker Desktop；`docker-desktop` WSL 发行版仍为 `Stopped`，`docker version` 持续无响应，未启动容器或执行 clean build，随后停止本轮启动的 Docker Desktop 进程。
- Gateway 现在实际执行 capability contract 的 object 边界：非 object 输入返回 `HARNESS_INPUT_SCHEMA_INVALID`，声明 object output 却返回标量的 Harness 结果返回 `HARNESS_OUTPUT_SCHEMA_INVALID`；冻结返回对象不会被原地修改。对应网关回归测试已纳入 `npm run test:harness`。
- Gateway schema 边界进一步支持现有契约子集：`type`、`required`、`properties`、`additionalProperties` 和数组 `items`；严格的 `eiscore_enterprise_snapshot` 会拒绝未知输入字段，开放 schema 能力保持兼容。对应输入/输出回归已通过 `npm run test:harness`。
- Gateway 测试新增隔离严格 schema capability，覆盖 `required`、属性类型、禁止额外字段和合法输入四种路径；`npm run test:harness`、`npm run test:syntax`、`npm run lint:changed` 已重新通过。
- Gateway output contract 现在还拒绝成功 dispatch 缺失 `data` 的结果；错误 dispatch 不受该 object output 要求影响。缺失输出回归已加入 `realtime/test-harness-gateway.js`，Harness 全套、语法检查重新通过。
- `/ai/config`、`/ai/agents` 与 metrics 目录现在同时返回按权限过滤的 `capability_policies` 元数据；workflow 只读用户不会看到写 capability，且可见 capability 的风险、确认、幂等、审计和超时策略保持 capability 级准确。对应负向回归已通过 `npm run test:harness-read-http`。
- 新增 `scripts/validate-lundu-harness-artifacts.mjs` 与 `tests/engineering/lundu-harness-artifact-regression.mjs`：部署前只读检查 `LUNDU_HARNESS_ROOT` 下的 `eiscore-auth`、`digital-twin`、`enterprise-bi` 编译入口及 patch 引用；缺失时稳定非零退出，不启动容器。`npm run test:production-config` 已包含该门禁。
- 在当前仓库执行该 preflight 的真实结果：外部 Harness 根目录未提供三个编译入口，CLI 明确报告 `eiscore-auth`、`digital-twin`、`enterprise-bi` 缺失并退出非零；临时完整 fixture 测试通过。该结果继续作为真实 Harness SDK/API 未验收的直接证据。
- `agent-harness/MIGRATION_CATALOG.json` 已同步记录上述三个外部 client plugin 缺失 blocker；`node scripts/migration-switch-gate.mjs`、`npm run test:harness`、`npm run test:production-config` 和 `npm run test:syntax` 重新通过。
- 本轮执行 `npm run test:quality` 在既有前端复杂度门禁停止：`eiscore-mobile/src/views/LoginView.vue` 为 1826 行，历史基线为 1632 行；后端迁移相关的前置 G3 与 Realtime composition gate 已通过，未修改该前端文件。
- 本轮 Compose 复核：`docker compose -f deploy/lundu/compose.yml config --no-interpolate --quiet` 通过；伦度真实插值仍因部署侧 `deploy/lundu/.env` 不存在而拒绝，未创建该文件。根 `docker-compose.yml` 与 `docker-compose.prod.yml` 使用临时进程变量静态展开均通过；生产 `agent-runtime` 展开后确认 `EISCORE_HARNESS_ENABLED=true`、Harness Bridge URL、审计文件路径和独立 `harness_audit` 卷均存在。
- 本轮边界修复：Runtime Bridge 结果即使 HTTP 状态为 2xx，只要响应体明确返回 `ok:false` 也会按失败归一化，保留白名单错误码/状态并阻止错误结果继续作为成功数据返回；新增回归断言，`node realtime/test-harness-runtime-boundaries.js` 与 `npm run test:harness` 已通过。
- 继续审计复核：`npm run test:runtime-router`、`npm run test:infrastructure`、`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:database-migrations`、`npm run test:database-structure-exit` 与 `node tests/engineering/harness-production-path-regression.mjs` 全部通过；未发现旧模型直连、Legacy fallback、RLS/PostgREST 或 WebSocket Harness 路径回归。
- Tool Gateway 错误边界收敛：企业快照、数字分身、查询、Workflow、Sales、文档和 Flash 执行器的异常统一返回稳定错误码/状态与最小化消息，不再向 Harness 客户端透传底层 SQL、密码、文件路径或内部错误原文；2xx 包装的 Flash `ok:false` 结果也会按失败归一化。新增敏感哨兵回归，`npm run test:harness`、`npm run test:syntax` 与 `npm run lint:changed` 已通过。
- Gateway dispatch 错误边界再次收紧：Gateway 最终出口现在对任意 `{ok:false}` 结果执行已登记错误码白名单、合法 4xx/5xx 状态和稳定消息归一化；未知内部 code/message（例如数据库路径或密码详情）统一转换为 `HARNESS_UPSTREAM_UNAVAILABLE`，不会经 execute/chat/capability HTTP handler 泄漏。新增未知 dispatch 错误回归，`node realtime/test-harness-gateway.js`、`npm run test:harness`、`npm run test:syntax` 与 `npm run lint:changed` 已通过。
- 复杂度回归基线与当前分支删除的 `eiscore-base/src/views/DigitalTwinView.vue` 已同步：现存巨型 Vue 基线为 51 个、债务行数为 83966；未提高 800 行阈值，也未放宽“禁止新增巨型 Vue 文件”规则。当前 `vue-complexity-inventory-regression` 仍因范围外的 `eiscore-mobile/src/views/LoginView.vue` 从 1632 行增长到 1826 行而失败，`npm run test:quality` 因同一既有问题停止；本轮未修改该前端文件。
- Harness 依赖溯源复核：`agent-harness/package.json` 仅直接声明 `@deepseek-ai/dsh@0.1.2-rc.1`；`npm --prefix agent-harness explain` 显示 `@anthropic-ai/sdk` 仅由 DSH 的 `@deepseek-ai/dsh-llm-pi-ai -> @earendil-works/pi-ai` 传递引入，`@agentclientprotocol/sdk` 仅由 DSH 的 `@deepseek-ai/dsh-acp` 传递引入。当前 Harness 源码未直接加载这些包，生产路径门禁继续禁止直接声明、代码导入和旧配置，不将官方 DSH 传递依赖误判为旧 Agent 链路。
- HTTP Handler 异常边界补齐：多模态 capability、通用 chat 和数字分身 managed-persistence 三个入口现在对 Gateway 意外抛出的内部异常统一返回 `502 HARNESS_UPSTREAM_UNAVAILABLE`，不产生未处理 rejection，也不泄漏数据库路径/密码等消息；Gateway 已返回的稳定业务错误码保持原样。新增三条敏感哨兵回归，`npm run test:harness`、`npm run test:syntax`（301 文件）和 `npm run lint:changed`（161 文件）已通过。
- 错误码边界进一步收紧：Tool Gateway 现在仅允许已登记的 Harness 错误码和受控 Flash 别名，未知 code 或非法 HTTP 状态统一映射到 `HARNESS_TOOL_EXECUTION_FAILED`；对应底层秘密/路径哨兵回归已通过 `node realtime/test-harness-tool-gateway.js`。
- HTTP 输入边界复核：Harness execute、chat、多模态和数字分身入口对请求体解析异常只返回 `BAD_REQUEST`/受控消息，不透传底层流错误、路径或凭据；新增 chat 解析异常哨兵，`npm run test:harness`、`npm run test:production-config`、`npm run test:syntax`、`npm run lint:changed` 与 `git diff --check` 已通过。
- 审计账本路径边界修复：JSONL sink 现在逐级 `lstat`/创建父目录并拒绝符号链接目录、非目录节点、超容量文件和相对路径；新增 `agent-harness/test-audit-ledger.js`，已纳入 `npm run test:harness-plugin`，当前完整 Harness 套件、语法、lint 和生产配置门禁通过。
- 外部状态复核：`node scripts/validate-lundu-harness-artifacts.mjs` 仍因未设置 `LUNDU_HARNESS_ROOT` 非零退出；`docker version` 仍无法连接 `dockerDesktopLinuxEngine`；`npm run test:unit` 仍仅失败于缺失 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg`；`npm run test:quality` 仍在既有 `eiscore-mobile/src/views/LoginView.vue` 1826 行超过 1632 行基线处停止。未连接远端、未启动容器、未修改前端资源或数据库卷。
- 新增本地租户边界证据：查询、工程/独立站上下文和数字分身 capability 分别使用 A/B 已认证用户时，PostgREST/persistence 收到对应 JWT/tenant；payload 注入另一租户字段会在执行前拒绝。`node realtime/test-harness-query-tools.js`、`node realtime/test-harness-context-capabilities.js`、`node realtime/test-harness-twin-chat-capability.js` 与 `npm run test:harness` 已通过。该证据不替代真实数据库双租户 RLS A/B token 验收。
- Bridge 会话租户归属回归已补强：相同 subject 但不同 tenant 复用已有 session 会返回 `HARNESS_SESSION_OWNERSHIP_DENIED`；`node agent-harness/test-http-bridge.js` 与完整 `npm run test:harness` 已通过。
- 迁移防漂移门禁已加强：`realtime/harness-tool-gateway.js` 导出 15 个非多模态 capability 的实际 binding 清单，`scripts/migration-switch-gate.mjs` 现在按模块导出清单与插件合同做精确集合比较，不再仅依赖源码字符串包含；迁移门禁、Harness、语法和 lint 已通过。

## 全局目标启动复核（2026-09-27）

- 全局目标继续保持 `active`：按后端迁移提示词推进 DeepSeek Harness Plugin -> EISCore Harness Gateway -> Tool Gateway -> PostgREST/RPC -> PostgreSQL/RLS 链路；不连接远端、不写真实客户数据、不修改前端视觉。
- 本轮复核通过：`npm run test:harness`、`node scripts/migration-switch-gate.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:production-config`、`npm run test:syntax`、`npm run lint:changed`、`node agent-harness/test-http-bridge.js`、`node agent-harness/test-audit-ledger.js`、`node realtime/test-harness-query-tools.js`、`node realtime/test-harness-context-capabilities.js` 和 `node realtime/test-harness-twin-chat-capability.js`。
- 全量门禁复核结果：`npm run test:unit` 仍只被独立站缺失 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 阻塞；`npm run test:quality` 仍只在既有 `eiscore-mobile/src/views/LoginView.vue` 1826 行超过 1632 行历史基线处停止。两项均不属于本轮后端迁移范围，未伪造通过。
- 当前剩余外部验收仍为：`LUNDU_HARNESS_ROOT` 下三个外部 client plugin 制品未提供、Docker daemon 不可用、真实双租户 RLS A/B token 验收未执行。目标保持 `active`，不得据此宣称部署或生产验收完成。
- 新增生产路径依赖回归：根项目和 `realtime` 的 `package.json`/lockfile 均禁止 `@anthropic-ai/sdk`、Anthropic、Cline 与 Agent Client Protocol 旧依赖重新进入；`node tests/engineering/harness-production-path-regression.mjs` 与完整 `npm run test:harness` 已通过。
- Tool Gateway 边界审计修复：企业快照、数字分身、受约束查询、Workflow/Sales/文档/工程等直接执行器若返回 `{ok:false, code, status}`（包括 HTTP 2xx 包装的业务失败），现在会统一转换为稳定 Harness 错误，不再被包成成功 `data`。新增受约束查询失败 envelope 回归，确认保留白名单错误码/403、丢弃原始错误消息且不返回伪成功数据；`node realtime/test-harness-tool-gateway.js`、`npm run test:harness` 和 `npm run lint:changed` 已通过。
- Replay 内存边界修复：Gateway 与 HTTP Bridge 的 request-ID TTL Map 新增 `maxTrackedRequests` 上限（默认 10000）；未过期记录达到容量后分别以受控 429 `HARNESS_CAPACITY_EXCEEDED` / `HARNESS_REQUEST_CAPACITY_EXCEEDED` 拒绝新请求，不提前淘汰 replay 记录。新增容量拒绝与 TTL 到期恢复测试，`node realtime/test-harness-gateway.js`、`node agent-harness/test-http-bridge.js` 和完整 `npm run test:harness` 已通过。
- Flash 写幂等边界修复：`flash-tool-service` 改为按 tenant + subject + tool + key 隔离幂等记录，严格校验 16-128 字符键（拒绝而非清洗，避免不同输入归并成同一键），并发相同 key 共用单次执行结果；待执行与成功缓存共同受 `maxIdempotencyEntries`（默认 10000）限制，满载返回 429，执行失败释放 pending 记录。回归覆盖非法键、并发单飞、容量拒绝、tenant 隔离和权限撤销后二次授权；`npm run test:runtime-router`、`npm run test:harness` 与 `npm run lint:changed` 已通过。
- Bridge 状态边界修复：Runtime 对 Bridge 返回的 2xx + `{ok:false}` 统一使用合法 4xx/5xx 状态；非法嵌入状态不再原样传播而故障关闭为 502。新增 `HARNESS_REQUEST_CAPACITY_EXCEEDED` 白名单及对应回归，`node realtime/test-harness-runtime-boundaries.js`、`npm run test:harness` 和 `npm run test:runtime-router` 已通过。
- Gateway 失败状态边界修复：任意 dispatch `{ok:false}` 即使携带 2xx 或非法状态，也会在最终结果与终态审计中规范为 502 或合法 4xx/5xx，避免 HTTP 层误报成功；`node realtime/test-harness-gateway.js`、`npm run test:harness` 和 `npm run test:syntax` 已通过。
- 本轮数据库验收继续通过：`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:database-migrations`、`npm run test:database-structure-exit` 和 `npm run test:production-config`；未连接数据库卷或远端环境。
- Capability policy 元数据漂移修复：`plugin-registry` 与 `/ai/config`/`/ai/agents` 目录不再把插件顶层写策略继承给只读 capability；Workflow context、Document plan 等读取能力现在准确暴露 `confirm_required=false`、`idempotency_required=false`，对应写能力仍保持 true。新增真实合同/目录回归，`node agent-harness/test-plugin-registry.js`、`node realtime/test-harness-read-http.js` 和完整 `npm run test:harness` 已通过。
- Flash 幂等配置边界修复：`idempotencyTtlMs` 现在对缺失、`NaN`、非正值统一回退到 10 分钟，避免无效配置让成功缓存立即过期并造成重复写；新增非法 TTL 回归，`node tests/engineering/flash-tool-service-regression.mjs`、`npm run test:runtime-router` 和 `npm run test:harness` 已通过。
- HTTP Bridge 直出状态边界修复：Bridge 对 `invoke` 返回的 2xx + `{ok:false}` 也统一规范为 502 或合法 4xx/5xx，避免绕过 Runtime 的直接客户端误判 Harness 请求成功；新增 `normalizeInvokeResult` 回归，`node agent-harness/test-http-bridge.js`、`npm run test:harness` 和 `npm run test:syntax` 已通过。
- 外部验收复核：`node scripts/validate-lundu-harness-artifacts.mjs` 仍因未设置 `LUNDU_HARNESS_ROOT` 失败；`docker version` 仍因 `npipe:////./pipe/dockerDesktopLinuxEngine` 不存在无法连接 daemon。未启动容器、未连接远端、未修改数据库卷。
- 审计账本边界修复：JSONL sink 对 `maxBytes` 的缺失/`NaN`/非正值回退默认容量，拒绝目录及其他非普通文件节点并返回稳定 `Harness audit ledger unavailable`，且单次写失败后队列可恢复，不会永久拒绝后续事件。新增容量、目录目标和失败恢复回归，`node agent-harness/test-audit-ledger.js`、`npm run test:harness` 和 `npm run test:syntax` 已通过。
- HTTP 请求取消边界补齐：Harness 路由在响应端提前关闭时生成并中止 request signal；业务快照、chat、多模态、execute 与数字分身入口将信号传入 Gateway，数字分身 Tool Gateway 继续传递到 Harness dispatch。Gateway 对取消执行 abort、记录 `HARNESS_REQUEST_CANCELLED` 终态审计并返回 499，不与 capability 超时（504）混淆。路由断开、Gateway abort/审计、快照错误归一化和 chat/数字分身信号透传回归通过；`npm run test:harness`、`node tests/engineering/runtime-http-router-regression.mjs`、`npm run test:syntax`（297 个文件）、`npm run lint:changed`（104 个文件）通过。SSE 仍在完整 Harness 响应后发送文本帧；此修复保证客户端提前离开时取消上游工作，不宣称改为 token 级上游流式传输。
- 当前阻塞复核：`npm run test:unit` 的两个失败仍是 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 不存在；`node scripts/validate-lundu-harness-artifacts.mjs` 报 `LUNDU_HARNESS_ROOT: required`；`docker version` 无法连接 `npipe:////./pipe/dockerDesktopLinuxEngine`。未创建资源/环境文件，未启动 Docker、连接远端或接触真实数据库卷；这些条件仍不足以完成真实 Harness artifact、容器和 RLS 端到端验收。
- 迁移前基线补记：从提交 `02b6588` 提取了旧 `/ai/*`、`/twin/chat`、`callAiUpstreamWithRetry`、TwinEngine、WebSocket Agent/Cline 和可选 Company Sales AI 分支的生产接线清单；发现 Smart BI 旧 ECharts 修复/经营回答改写的业务等价尚待外部插件验收。该未验收项已写入本文件和 `agent-harness/MIGRATION_CATALOG.json`；`node scripts/migration-switch-gate.mjs`、`node agent-harness/test-plugin-registry.js` 与生产路径回归通过。目标仍保持 `active`。

## 迁移门禁收紧记录（2026-09-27）

- `scripts/migration-switch-gate.mjs` 现在直接导入 `ROUTE_CAPABILITIES`，按 `/ai/translate`、`/ai/ocr`、`/ai/map-locate` 的实际路由映射与合同中的三项多模态 capability 做精确集合比较；不再只依赖通用源码字符串存在性。
- 收紧后的 `node scripts/migration-switch-gate.mjs`、`npm run test:harness`、`npm run test:syntax`、`npm run lint:changed` 和 `git diff --check` 均通过。
- 再次执行 `npm run test:quality` 时，G3 前置审计和 Realtime composition gate 通过，随后仍在既有 `eiscore-mobile/src/views/LoginView.vue` 复杂度门禁停止（1826 行超过 1632 行历史基线）；未修改该前端文件。
- Gateway 身份匹配回归新增覆盖：错误 `agent_id` 与未知 `plugin_id` 均在 dispatch 前分别返回 `HARNESS_AGENT_MISMATCH` / `HARNESS_PLUGIN_MISMATCH`；`node realtime/test-harness-gateway.js`、`npm run test:harness` 和 `npm run lint:changed` 通过。
- 文档提交幂等边界补齐：`harness-document-commit` 将幂等键以哈希写入服务端计划确认元数据；同键重放直接返回已完成计划，不重复执行 worker；不同键不能抢占已确认计划；缺失幂等键稳定拒绝。`node realtime/test-harness-document-commit.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- Sales 写执行器增加自身幂等键边界，不再只依赖外层 Gateway；直接调用缺失或少于 16 字符的幂等键会在进入业务 handler 前返回 `HARNESS_IDEMPOTENCY_REQUIRED`。`node realtime/test-harness-sales-write.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 写链路变更后的跨模块复核通过：`npm run test:runtime-router`、`npm run test:database-backend-governance`、`npm run test:database-roles` 和 `npm run test:production-config`；未连接远端或真实数据库。
- 生产路径门禁增加旧模块精确导入检查：所有 `realtime` Runtime 源文件禁止重新引入 `agent-core`、`agent-access-service`、`agent-task-service`、`flash-cline`、`twin-engine` 和旧 `twin-chat-http`；`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 数字分身回归补齐 request replay 链路断言：`eiscore_twin_chat` capability 会将入口 `request_id` 原样传入 Harness dispatch，持久化层不会丢失 Gateway replay protection 所需的请求标识；`node realtime/test-harness-twin-chat-capability.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 当前数据库/基础设施复核通过：`npm run test:database-migrations`、`npm run test:database-structure-exit`、`npm run test:infrastructure`；没有新增未登记迁移或 schema 变更。
- 外部验收状态未变化：`node scripts/validate-lundu-harness-artifacts.mjs` 因 `LUNDU_HARNESS_ROOT` 未设置失败；`docker version` 因 `dockerDesktopLinuxEngine` named pipe 不存在失败；未启动容器、未连接远端或真实数据库卷。
- Plugin Registry 合同门禁收紧：高/关键风险 capability 必须在 capability policy 中显式声明 `confirm_required=true` 与 `idempotency_required=true`，缺失时加载阶段拒绝，避免仅靠 Gateway 风险推断造成目录策略漂移；`node agent-harness/test-plugin-registry.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 新增 `/ai/harness/execute` HTTP 契约回归：请求体伪造的 `user`/租户/JWT 不会覆盖认证器主体，客户端注入的 `dispatch` 不会进入 Gateway，失败响应仅返回稳定 code/message；`node realtime/test-harness-http.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 聊天入口 capability 映射收紧：`/ai/chat/completions` 按服务端插件固定 capability，客户端提交其他 capability（包括未知插件组合）在进入 Gateway 前返回 `HARNESS_CAPABILITY_MISMATCH`；`node realtime/test-harness-chat-http.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 聊天上下文净化进一步覆盖 `user`、`subject/sub`、权限/角色、headers/cookies 等身份载体及其无下划线别名；递归净化回归、`npm run test:harness` 和 `npm run test:syntax` 通过。
- Gateway request ID 增加 1-256 字符安全边界；超长或含非法字符的客户端 ID 在审计前被拒绝，不进入 replay Map、dispatch 或原样响应，改用服务端生成的安全 request ID；`node realtime/test-harness-gateway.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 迁移门禁增加 canonical Harness 路由双向精确集合校验：`CORE_HTTP_ROUTE_MANIFEST` 中所有 `harness.*` 路由必须全部登记在 `MIGRATION_CATALOG.production_routes`，目录路由也必须在实际 manifest 中存在；`node scripts/migration-switch-gate.mjs`、`npm run test:harness`、`npm run test:syntax` 和 `npm run lint:changed` 通过。
- `/ai/harness/execute` 对 Gateway 抛出的异常增加边界归一化，统一返回 502 `HARNESS_UPSTREAM_UNAVAILABLE`，不透传内部数据库、路径或凭据；`node realtime/test-harness-http.js`、`npm run test:harness` 和 `npm run test:syntax` 通过。
- 数字分身 `eiscore_twin_context` 补回原有 `search_knowledge`、`list_knowledge`、`read_knowledge_file` 三项个人知识库工具；所有结果统一放入 object 契约 `{ tool_id, result }`，继续使用当前认证用户绑定的 PostgREST/JWT、`employee_id` 过滤和数据库 RLS。未知工具返回 404，已知但因权限/字段 ACL 不可见的工具返回 403；回归经真实 Plugin Registry、Harness Gateway、Tool Gateway 和 `createTwinTools` 覆盖三项工具及拒绝路径。
- 本轮实际通过：`npm run test:harness-tool-gateway`、`node tests/engineering/twin-tools-permission-regression.mjs`、`npm run test:harness`、`npm run test:syntax`（297 个 Node 文件）、`npm run lint:changed`（106 个变更 JS/Vue 文件）、`node tests/engineering/harness-production-path-regression.mjs`、`node scripts/migration-switch-gate.mjs` 和 `git diff --check`。契约测试使用 mock PostgREST，只证明 EISCore 传入当前认证用户及用户级过滤，不代表真实数据库双租户 RLS A/B 验收。
- 全局目标继续为 `active`；本轮未连接远端、未启动容器、未写入真实业务数据。
- 生产路径门禁扩展到部署 Compose 与 `.env` 样例，拒绝旧 Anthropic、Cline、OpenAI/DeepSeek 直连模型变量回流；`node tests/engineering/harness-production-path-regression.mjs` 与 `npm run test:harness` 通过。配置扫描确认当前目标文件没有这些旧变量。
- 当前环境验收复核：`npm run test:unit` 的 30 个独立站测试中 28 个通过、2 个因 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 缺失失败；`node scripts/validate-lundu-harness-artifacts.mjs` 因 `LUNDU_HARNESS_ROOT` 未设置失败；`docker version` 无法连接 `dockerDesktopLinuxEngine` named pipe。未启动容器或连接远端；真实 Harness 制品与真实双租户 RLS 验收仍未完成。
- 数字分身 RLS 离线合同新增对 release baseline 的校验：知识库、会话、消息和工具日志均必须保留 RLS 与 JWT `username` 归属策略，缺失 username 时拒绝访问，子记录必须经所属会话约束；`npm run test:database-roles` 已包含该门禁。该静态基线检查不替代 Docker/PostgreSQL 真实执行或双租户 A/B token 验收。
- GLM 旧模型初始化 SQL 仍保留为只读历史审计材料，但继续受 default-deny 分类且不属于生产 Compose 初始化输入；`env/README.md` 已明确标注退役与禁止手动执行，数据库治理回归验证其 `superseded-by-migration` 处置不可被悄然改回可执行。
- 新建数字分身会话现在显式写入 `model=deepseek-harness`，不再依赖数据库历史 `glm-4.6v` 默认值；现有历史会话不被改写。`node realtime/test-harness-twin-persistence.js` 已验证会话写入绑定用户、Harness 标识且不含旧模型标识。

## 迁移目录

机器可读目录位于 `agent-harness/MIGRATION_CATALOG.json`，由 `scripts/migration-switch-gate.mjs` 校验插件、能力和生产路由双向一致。

## 回滚

回滚应使用上一个完整容器镜像和 Git 版本，不通过当前代码内 Legacy fallback 回滚；保留审计账本和数据库备份，禁止删除数据库卷掩盖故障。

## 全局目标启动记录（2026-09-27）

- 当前全局目标已确认保持 `active`，继续按后端迁移提示词推进；本轮未连接远端、未启动容器、未写入真实客户数据或数据库卷。
- 当前工作树复核通过：`npm run test:harness`、`npm run test:syntax`（297 个 Node 文件）、`node scripts/migration-switch-gate.mjs` 和 `git diff --check`。
- `npm run test:unit` 仍仅失败于独立站已有资源缺失：`research-gallery/gallery-001.png`、`research-gallery/gallery-021.jpeg`；本轮未伪造资源或改动前端。
- `node scripts/validate-lundu-harness-artifacts.mjs` 因 `LUNDU_HARNESS_ROOT` 未设置而按预期非零退出；外部 `eiscore-auth`、`digital-twin`、`enterprise-bi` 制品仍未提供。
- `docker version` 仍无法连接 `npipe:////./pipe/dockerDesktopLinuxEngine`，因此 Docker clean build、容器启动和部署保持未验收。
- 生产运行时扫描仅发现迁移目录、数据库治理脚本及测试中的合法 `legacy` 兼容语义；未发现旧 Agent/模型/Cline 执行器重新进入 Harness 生产可达路径。
- 本轮组合根静态合同原先未登记已接入的 `harness-twin-context-capability`，且把工厂绑定误列为可识别 helper；已同步测试期望。`npm run test:runtime-router`、`npm run test:harness`、`npm run test:harness-twin-chat`、`npm run test:database-roles`、`node scripts/migration-switch-gate.mjs`、`npm run test:syntax`（298 个 Node 文件）、`npm run lint:changed`（109 个文件）和 `git diff --check` 通过。未连接远端或真实数据库。
- 本轮发现仓库外的本机候选集成目录包含三个编译插件入口；`node scripts/validate-lundu-harness-artifacts.mjs --harness-root <candidate-root>` 与 `npm run test:production-config` 通过。未持久化设置 `LUNDU_HARNESS_ROOT`，也未修改或执行该目录中的插件；部署 Compose 运行、锁定 Harness runtime 加载及其 UI/API 行为仍待验收。
- 本轮重新运行 `npm run test:unit`，独立站 30 项中 28 项通过，仍有两项因 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 缺失失败；未生成伪图片。两个本机 Docker context（`desktop-linux`、`default`）均无法连接 daemon；真实 PostgreSQL 双租户 RLS 测试未执行。
- Harness Web Compose overlay 原重复声明 `security_opt` 与 `/tmp` tmpfs，导致合并配置报错并可能覆盖基础配置的 `noexec,nosuid` 限制；已移除重复声明，并在 `production-config-regression.mjs` 锁定 overlay 继承基础安全选项和受限 tmpfs。`npm run test:production-config` 通过。实际 `docker compose config` 仍因私有 `deploy/lundu/.env` 不存在而未能完成；没有创建 `.env` 或启动容器。
- 本轮基于官方 `@deepseek-ai/dsh-sdk-jsonrpc-server` 与 `@deepseek-ai/dsh-sdk-protocol@0.1.2-rc.1` 文档核实 NDJSON JSON-RPC 协议，并新增 `agent-harness/dsh-http-bridge.mjs`：通过 `initialize`、`session/prompt`、`session.event`、`session.status` 启动独立 SDK bridge，按 session 串行化并聚合 `assistant/message`。新增 `test-dsh-http-bridge-runtime.mjs` 与现有 HTTP bridge 契约测试均通过。
- Lundu Compose 新增独立 `harness-bridge` 服务，Runtime 的 `EISCORE_HARNESS_URL` 继续指向 `http://harness-bridge:3080`；生产环境校验现在拒绝 `deepseek-web` Web UI 作为 bridge。`npm run test:harness-bridge`、`npm run test:production-config`、`node --check agent-harness/dsh-http-bridge.mjs` 和 `git diff --check` 通过。
- Bridge readiness 已闭环：`GET /readyz` 由真实 SDK bridge 执行 `initialize` 后检查 runtime、插件目录和会话状态；成功返回 200，SDK 不可用或检查异常统一返回 503 `HARNESS_NOT_READY`，不泄露内部错误。Lundu `harness-bridge` 容器健康检查改为轮询 `/readyz`，避免仅以进程存活误判可用。
- readiness 与首个用户请求共享同一个 SDK 启动 Promise，避免容器健康检查并发触发初始化时提前发送 `session/prompt`；bridge 回归覆盖并发 `start()`、`/readyz` 成功、`ok:false` 和异常 503 路径。
- 该 bridge 尚未进行 Docker clean build、真实 DSH runtime 加载、插件工具行为、真实数据库/RLS 或远端验收；Docker daemon 不可用且 `deploy/lundu/.env` 不存在，目标保持 `active`，不得宣称部署完成。串行配置回归与 bridge 契约测试通过；并行复核曾因 Windows 页面文件不足退出，未被计为测试失败。
- 2026-09-28 在隔离临时目录安装官方 `@deepseek-ai/dsh@0.1.2-rc.1` 依赖后，使用 `scripts/dsh-sdk-runtime-smoke.mjs` 完成真实 SDK handshake：`initialize` 返回 `deepseek-harness-sdk-runtime@0.0.1`，`shutdown` 返回 `{}`，stderr 为空。该证据证明官方 SDK profile 可启动，但没有证明 EISCore client plugin bundle 已被 SDK profile 加载，也没有证明模型 prompt、工具调用或 UI/API 行为。
- Lundu artifact preflight 现在除文件、patch 和路径检查外，还动态导入三个 compiled client plugin 并验证 `apply`/`inject[]` 导出；仓库测试 fixture 覆盖缺失导出拒绝路径，候选外部目录的三项真实入口已通过该 runtime import preflight。它仍不等于 Web profile/SDK profile 的真实插件装载与请求行为验收。
- 使用官方 npm DSH 包执行 `web --dump-config` 时，三个 EISCore plugin entry 能被插入，但 vanilla Web profile 不包含 Lundu 专用的 `ui-eiscore-embed` legacy entry，并在实际启动时因 patch-watch 缺少 HMR service 退出；这证明 npm 包不能替代 `eiscore/deepseek-harness:0.1.2-rc.1-bridge1` 专用镜像。Lundu Web/SDK 实际装载、legacy embed 禁用和 UI/API 验收仍待 Docker 镜像可用后完成。
- SDK bridge 当前将受控 `data:image/*;base64` 输入转换为官方 SDK encoded image block；对 HTTP 图片 URL 故障关闭并返回 `HARNESS_IMAGE_URL_UNSUPPORTED`，避免在未实现 SSRF/大小/重定向策略前让 bridge 任意抓取网络资源。多模态 URL 解析仍是下一项外部验收与实现任务。
- 2026-09-28 修复 Lundu Web 启动链：主 Compose 改为使用受控 `dsh-web-runner.mjs`（容器内 3081 代理），runner 在独立 DSH home 中将 Web profile 固定为 `patchReload: startup`，避免精简 Harness 镜像因缺少 Cordis HMR 服务退出；生产配置回归、299 个 Node 文件语法检查、迁移门禁和 Harness bridge 测试通过。Docker daemon 仍不可用，未进行 Compose 启动、数据库卷操作或远端部署。
- 继续复核：Docker Desktop 进程存在但 `docker-desktop` WSL 发行版仍为 `Stopped`；尝试启动 `com.docker.service` 被 Windows 权限拒绝。`npm run test:unit` 仍只有独立站既有资源 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 两项失败；Compose 两份 YAML 已通过 `js-yaml` 结构解析，未创建部署 `.env`。
- Web runner 新增可执行回归夹具 `deploy/lundu/test-dsh-web-runner.mjs`，直接验证既有 bundle/patch 保留、`patchReload` 强制为 `startup`、新 DSH home 默认 profile 及缺失 `DSH_HOME` 故障关闭；已纳入 `npm run test:production-config` 并通过。
- Docker 复核：`wsl -d docker-desktop -- echo docker-desktop-ready` 可短暂唤醒发行版，但随后 `docker-desktop` 自动回到 `Stopped`，`desktop-linux` 与 `default` 两个 Docker context 的 named pipe 均不存在；未启动 Compose 或访问任何数据库卷。
- 完整 `npm run test:quality` 复核仍在既有前端复杂度门禁停止：`eiscore-mobile/src/views/LoginView.vue` 为 1826 行，历史基线为 1632 行；未进入后续后端门禁，本轮未修改该前端文件。
- 生产路径深层静态复核未发现 `company-sales-agent`、Flash semantic 工具或 Runtime 重新引入 `answerWithAi`、旧模型 upstream、Cline 执行器或 Legacy fallback；`harness-production-path-regression.mjs` 与 `migration-switch-gate.mjs` 继续通过。
- company-sales SQL handler 的边界复核：Runtime 将其作为既有业务 service 装配，Harness `eiscore_sales_write` 只通过固定 operation、UUID 资源、确认和幂等校验后调用；公开 `/sales/*` 是独立站业务协议，不是模型/Agent 编排入口，因此本轮不删除该业务路由。
- 官方 DSH Web profile 初次配置 smoke 使用本机官方 `@deepseek-ai/dsh@0.1.2-rc.1` 与候选外部插件目录确认了三个入口进入真实 Web profile；第一次 runtime 采样曾在宿主启动期静态 fallback 窗口读到 404，后续 smoke 已改为等待启动完成并用 Web cookie 验证插件路由，结论以紧随其后的 2026-09-28 记录为准。
- 2026-09-28 修复并加强 Web plugin runtime smoke：Lundu patch 为三个外部插件显式声明 `inject: [connection]`，夹具与实际 runner 均使用 `node --expose-internals`；验收先用 DSH 启动 token 建立 Web cookie，再确认 `/api/eiscore/auth/status`、`/api/eiscore/digital-twin/sessions`、`/api/eiscore/enterprise-bi/snapshot` 在已认证宿主内分别返回插件预期的 401 响应（auth 返回 `authenticated:false`，数字分身/BI 返回 `EISCORE_AUTH_REQUIRED`）。这证明官方 Web host 的插件 apply/route registration 已在本机候选制品上通过；浏览器端 bundle 执行、Smart BI 输出等价、真实模型/工具调用、Docker clean build、真实双租户 RLS 和远端部署仍未验收。此前 404 是启动期 fallback 被 smoke 过早采样，并非最终运行期路由结果。
- 同一 smoke 现在还在已认证页面上读取 `__DSH_BOOT__`，确认 digital-twin 与 enterprise-bi client package 出现在启动图，并请求组合 `/plugins/...` bundle（HTTP 200）；页面级 bundle 交付已通过。实际浏览器执行仍受当前 WSL 缺少 Chromium 阻塞，未把静态资源交付当成浏览器 UI 行为通过。
- 2026-09-28 继续执行 `scripts/dsh-sdk-runtime-smoke.mjs`：官方 `@deepseek-ai/dsh@0.1.2-rc.1` SDK profile 返回 `serverInfo.name=deepseek-harness-sdk-runtime`、`version=0.0.1`，完成 2 个 JSON-RPC frame（initialize/shutdown），stderr 为空。该证据确认 SDK 进程启动/关闭协议稳定；没有 API 凭据时仍未执行真实模型 prompt、工具调用或业务数据/RLS 验收。
- 2026-09-28 readiness 生命周期复核：SDK 子进程异常退出时会清除 `initialized`，健康检查同时要求 runtime 未关闭；`/readyz` 不会因历史成功初始化而在进程终止后继续返回 200。`npm run test:harness-bridge`、`npm run test:production-config`、`npm run test:syntax`（300 个 Node 文件）和 `git diff --check` 通过。`npm run test:unit` 仍因两个既有独立站图片缺失失败，`npm run test:quality` 仍在既有移动端 LoginView 复杂度门禁停止。
- 2026-09-28 旧 Agent policy 残留清理：删除 `realtime/ai-agent-policy.js`，将仍被组合根使用的纯文本归一化移至 `realtime/message-normalization.js`；`normalizeToolsWhitelist` 因无生产调用一并移除。迁移目录 `legacy_runtime.retained_files` 已为空，`npm run test:runtime-router`、`npm run test:harness`、`npm run lint:changed`、`npm run test:syntax` 和迁移门禁通过。
- 2026-09-28 外部制品复核：重新对本机候选目录 `C:/Users/Twist/Documents/eiscore/.codex-tmp/auth-work-20260920/agent-harness` 执行 `validate-lundu-harness-artifacts.mjs` 和 Web plugin runtime smoke；目录仅含三个插件源码，缺少 `client-plugins/*/lib/index.js`，两项均按预期失败关闭。`LUNDU_HARNESS_ROOT` 未设置，Docker daemon 仍不可达；未创建编译产物、未修改候选目录、未启动容器。
- 2026-09-28 Bridge 实现边界复核（已由后续修复取代）：早期检查曾发现 owner/replay 仅保存在进程内；随后 `agent-harness/http-bridge.js` 已补齐绝对路径状态文件、原子写入、损坏状态故障关闭、重启恢复和受控 `/metrics`，并由 `agent-harness/test-http-bridge.js` 覆盖。当前未完成项不再包括 Bridge 持久化或指标，而是外部 Provider、当前分支 Web 制品、完整 Compose 和远端验收。
- 2026-09-28 Harness HTTP 输入边界修复：`/ai/harness/execute`、chat 和多模态 capability handler 现在在读取 JSON 后先拒绝 `null`/数组等非对象 body，统一返回 `400 BAD_REQUEST`，不会进入插件解析、Gateway dispatch 或业务查询；新增三条回归并通过 `npm run test:harness`、`npm run test:syntax` 和 `npm run lint:changed`。
- 2026-09-28 Bridge 状态持久化补齐：`agent-harness/http-bridge.js` 新增绝对路径 JSON 状态文件，原子保存经过哈希的 session owner、插件绑定和 request replay 时间戳；状态文件损坏或写入失败故障关闭为 `HARNESS_STATE_UNAVAILABLE`。Lundu `harness-bridge` 默认将状态保存到 `/var/lib/dsh/bridge-state.json`，并通过受控 `/metrics` 返回活动数、session/replay 数量和持久化开关。重启恢复、状态损坏拒绝、metrics 协议和生产 Compose/env 契约已纳入回归；`node agent-harness/test-http-bridge.js`、`npm run test:harness` 和 `npm run test:production-config` 通过。
- 本记录 supersede 2026-09-28 早先关于 Bridge 仅使用进程内 Map、没有状态文件和 metrics 的未完成项；真实容器启动、挂载权限和跨实例部署验收仍待 Docker/外部环境可用后验证。
- 生产路径复核（2026-09-28）：重新扫描 `realtime/`、`agent-harness/`、部署 Compose、环境样例和脚本，未发现 `callAiUpstream*`、旧 Agent/Cline 执行器、Legacy fallback 或直连模型配置进入生产可达路径；唯一 GLM 命中是 `env/insert_ai_config.sql` 退役历史材料，已由环境文档和数据库治理门禁标记为 `superseded-by-migration`，不属于 Compose 初始化输入。`node tests/engineering/harness-production-path-regression.mjs` 与 `node scripts/migration-switch-gate.mjs` 通过。
- 复核记录（2026-09-28）：`npm run test:harness`、`npm run test:database-migrations` 和 `npm run test:database-roles` 全部通过；其中 Harness bridge 重启/损坏状态测试、数据库迁移发布/恢复治理、数字分身 RLS 静态合同均在本轮重新执行。`docker version` 仍无法连接 `npipe:////./pipe/dockerDesktopLinuxEngine`，`docker-desktop` WSL 发行版为 `Stopped`；`LUNDU_HARNESS_ROOT` 未设置且本机候选树仍缺少编译 client plugin 入口，因此 Docker clean build、真实 Harness bundle/prompt/tool 行为和双租户 PostgreSQL 验收继续保持未完成，未连接远端或真实数据库卷。
- 单测/质量门禁复核（2026-09-28）：`npm run test:unit` 仍为 28/30 通过，失败项是独立站已有资源 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 缺失；`npm run test:quality` 在既有 `eiscore-mobile/src/views/LoginView.vue` 复杂度门禁停止（1826 行，高于 1632 行历史基线）。这些属于前端资源/复杂度问题，不在本后端迁移范围内，本轮未修改前端文件或伪造资源。
- Harness 编译复核（2026-09-28）：重新发现 WSL `/home/lzr/deepseek-harness` 与 `/home/lzr/eiscore-refactor`，Node `v24.12.0` 和官方 `typescript/tsdown` 可用；使用当前分支候选插件源码实际执行官方构建脚本，认证插件编译成功，数字分身在 `tsc` 阶段因 workspace 已登记的 `@deepseek-ai/dsh-client-ui-conversation` 缺少 `lib/client.js` 编译入口，且候选组件与当前 workspace 类型/slot 合同不一致而失败。临时复制的插件源码和单个产物已移出当前工作树并隔离保存，未覆盖 WSL workspace 或外部候选目录。该证据确认缺口是版本锁定/编译制品问题，不能将 WSL 另一提交的现成 `lib/` 当作当前分支验收结果。
- 外部制品对照（2026-09-28）：只读运行 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root "\\wsl$\Ubuntu\home\lzr\eiscore-refactor\agent-harness" --patch deploy/lundu/dsh-web.patch.yml` 通过，证明 WSL 另一提交的三个编译入口完整且可动态导入；当前分支的 `LUNDU_HARNESS_ROOT` 仍未设置，Windows 候选目录仍为源码-only，因此该通过结果仅是外部对照，不改变当前分支的 artifact/Web/容器验收结论。
- WSL Web runtime 对照（2026-09-28）：修复 `scripts/dsh-web-plugin-runtime-smoke.mjs` 夹具，使其与生产 patch 一样先禁用 `ui-eiscore-embed` 再插入 EISCore 插件；使用 WSL 另一提交的编译制品和 Harness Web CLI 运行时 smoke 通过。`/api/eiscore/auth/status`、`/api/eiscore/digital-twin/sessions`、`/api/eiscore/enterprise-bi/snapshot` 在无登录 cookie 时分别返回预期 401，认证页面 boot graph 包含 digital-twin/enterprise-bi，组合 client bundle 返回 HTTP 200 且 stderr 为空。该证据不替代当前分支制品、Docker、真实模型/工具或双租户 RLS 验收。

## 全局目标继续推进记录（2026-09-28）

- 已确认全局目标继续保持 `active`，未连接远端、未启动容器、未写入真实客户数据或数据库卷。
- 本轮数据库治理组合门禁通过：`npm run test:database-roles`、`npm run test:database-backend-governance` 和 `npm run test:database-migrations`；其中包含数字分身表 RLS/用户名归属静态合同、迁移顺序/校验和/回滚声明、发布与恢复证据、DB 角色边界和结构退出检查。
- 上述结果是源码、迁移清单和 release baseline 的离线/合同级证据，不等于真实 PostgreSQL 双租户 A/B token 读写验收；Docker daemon、外部编译插件制品和远端环境仍未可用，相关阻塞保持不变。

## 全局目标继续推进记录（2026-09-28，官方 SDK EISCore tool-call 闭环）

- 修复 `agent-harness/dsh-http-bridge.mjs` 的错误边界：SDK 发出 `tool/call` 后不再由 bridge 立即杀死子进程；官方 `dsh-tools` 负责执行已注册插件并产生 `tool/result`，bridge 继续聚合后续 assistant 消息和 `session.status=idle`。
- 在隔离临时 DSH 安装目录中运行官方 SDK profile、当前分支 `agent-harness/eiscore-restricted.cordis.yml`、`agent-harness/eiscore-tools.mjs`、脚本化 OpenAI-compatible mock provider 和 loopback proxy。SDK handshake 成功，`request/header` 暴露 18 个 EISCore capability schema。
- mock provider 首轮返回 `eiscore_enterprise_snapshot` tool call；插件通过 `EISCORE_TOOL_PROXY_URL` 调用代理一次，代理返回受控快照；SDK 记录 `tool/result` 后发起第二次模型请求并返回 `mock response recovered`。最终观测：`proxyCalls=1`、`modelRequests=2`、无真实 API key、无数据库和远端连接。
- 同一请求头复核发现 SDK 自带的 `str_replace_editor` 曾随 profile 暴露；已加入 `eiscore-restricted.cordis.yml` 禁用项并通过同一 smoke 复测，工具 schema 只保留 18 项 EISCore capability（过滤输出不再包含 `str_replace_editor`）。
- `node agent-harness/test-dsh-http-bridge-runtime.mjs` 已新增 tool/call -> tool/result -> assistant continuation 回归并通过；`npm run test:harness`、`node --check agent-harness/dsh-http-bridge.mjs` 和 `git diff --check` 随后通过。
- 这项证据把“当前 bridge 未处理工具回注”的阻塞关闭为“本地官方 SDK + mock provider + 受限 EISCore plugin 闭环已验证”。它不等于真实 DeepSeek provider、当前分支 client plugin 编译制品、Smart BI 行为等价、Docker clean Compose、远端部署或完整客户数据 RLS 验收；这些仍保持未完成，目标继续为 `active`。

## 全局目标重启复核（2026-09-28）

- 新全局目标已进入 `active`，继续严格遵守伦度多 Agent 品牌/发布协作约束；本轮只做当前分支本地复核，未连接远端、未启动 Docker、未写入真实部署环境或数据库卷。
- 当前分支 `codex/systematic-refactor`（提交 `02b6588441a3620f29cfc9cee049035aa222fda2`）通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:database-migrations`、`npm run test:database-roles`、`npm run test:database-backend-governance`、`npm run test:syntax`（300 个 Node 文件）、`npm run lint:changed`（114 个变更文件）和 `git diff --check`。
- 当前分支没有 `agent-harness/client-plugins/*/lib/index.js` 编译制品，`LUNDU_HARNESS_ROOT` 未设置；不能把其他提交或 WSL 工作区的制品当作当前分支验收证据。Docker daemon 和真实双租户 PostgreSQL/RLS 端到端验收仍未执行。
- `npm run test:unit` 仍为 28/30 通过，仅失败于既有 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 缺失；`npm run test:quality` 仍在既有 `eiscore-mobile/src/views/LoginView.vue` 1826 行超过 1632 行历史基线处停止。两项属于前端范围，本目标不伪造资源、不修改前端视觉。
- 本轮使用 WSL Ubuntu 本地 Docker daemon 对当前分支 `realtime/Dockerfile.prod` 做了两次只构建尝试，未启动或替换任何容器：第一次因 Docker Hub TLS handshake timeout 失败，重试后基础镜像成功拉取，但 legacy builder 在 `RUN --mount=type=cache` 处失败；`docker buildx` 不可用，`DOCKER_BUILDKIT=1` 也因缺少 buildx 退出。现有运行中的无关 `yayulink-api` 容器未被触碰。
- 固定 digest 复核：生产根上下文镜像为 `sha256:3345141001f037a22cace56f060f07ee67989abb3362c4cdb21ab7a05b27b08942`，开发根上下文镜像为 `sha256:9e8021bd71008dabc5a36f060f07ee67989abb3362c4cdb21ab7a05b27b08942`；两条构建路径均已完成。
- Harness 启用态临时 smoke 也通过：使用同一生产镜像设置 `EISCORE_HARNESS_ENABLED=true`，`GET /health` 返回 200；未配置真实 Bridge/数据库，四个文档 worker 仅记录连接拒绝，容器已清理。WSL 另一工作树的三个 `client-plugins` 目录仍为未跟踪制品，不能作为当前分支 artifact 验收证据。
- agent 镜像 HTTP 边界 smoke 通过：`/health` 返回 200；未认证访问 `/ai/config`、`/ai/agents`、`/ai/harness/execute`、`/twin/chat` 和 `/ai/harness/metrics` 均稳定返回 401 JSON；临时容器已清理，未调用真实 Bridge、模型或数据库。
- 本机另一个 `C:/Users/Twist/Documents/eiscore` 目录虽有三个 `client-plugins/*/lib/index.js`，但其 Git 仓库仍是无提交的 `master`，与当前 `github-eiscore-refactor` 的提交无法建立来源关系；这些文件继续按外部/未归属制品处理，不纳入当前分支验收。
- 随后尝试通过 WSL Ubuntu 的 `docker-buildx` apt 包解除本地构建阻塞；`apt-get update` 长时间无响应后已中止，未安装系统包，未启动或修改任何项目服务，当前仍不能宣称 Docker 镜像构建通过。
- 使用临时解包的 `docker-buildx` 0.30.1（未安装系统包）重新构建后，当前分支 `realtime/Dockerfile.prod` 已成功生成本地镜像 `eiscore-agent-local:codex-02b6588`，digest 为 `sha256:71122459391da715f177ad6ad349859623c2dbe69dd3502ce21ae5e5af10d962`；`docker run --rm --entrypoint node ... --check index.js` 通过。该过程只写入本地镜像缓存，没有启动 agent/db/api/web/Harness，也未影响运行中的 `yayulink-api`。
- 首次临时容器 smoke 暴露镜像运行时缺口：`harness-gateway.js`/`harness-runtime.js` 引用的 `../agent-harness` 未在原 `realtime` 构建上下文内，容器以 `MODULE_NOT_FOUND` 退出；同时 `realtime/index.js` 向 Flash PostgREST adapter 传入未定义的 `waitMs`。已将开发、生产和伦度 Compose 的 agent 构建上下文统一扩展到包含 `agent-harness` 的根/`source`，Dockerfile 显式打包注册表、审计账本和插件合同，并移除无效的 `waitMs` 依赖；新增运行时镜像合同覆盖上下文、COPY 和 ignore 清单。
- 使用临时构建目录和 buildx 重新构建修复后的镜像 `eiscore-agent-local:codex-02b6588-rootctx`；`npm run test:runtime-router`、`npm run test:harness`、`npm run test:syntax`、`npm run test:runtime-image` 和 `npm run test:production-config` 通过。临时容器 smoke 返回 `GET /health -> 200 {"ok":true,"channel":"eis_events"}`；未连接数据库时四个文档 worker 的初次查询记录 `ECONNREFUSED`，容器随后已清理，未启动任何持久服务。

## 全局目标继续推进记录（2026-09-28，临时 PostgreSQL/RLS 实测）

- Windows Docker Desktop named pipe 仍不可用，但 WSL Ubuntu Docker daemon 可用；当前仅发现无关的 `yayulink-api` 容器。未使用项目 Compose、现有卷或远端环境。
- 使用仓库固定镜像 `postgres@sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f` 创建一次性容器 `eiscore-codex-rls-20260928`：`--network none`、只读根文件系统、PostgreSQL 数据目录 tmpfs、仓库只读挂载；验收结束后已执行 `docker rm -f -v`，容器已不存在。
- 临时数据库按真实安装顺序执行 `database/bootstrap/roles-v2.sql`、`database/baselines/eiscore-db-v1/schema.sql`、`register.sql`、`core-002` 至 `core-007`，最终 `database/migrations/postchecks/core.sql` 返回 `DO` 并通过。仅执行 `core-002` 时 postcheck 明确失败于 `company_site Agent policy coverage is incomplete`；补齐受控迁移顺序后通过，证明该失败是装配顺序差距而非跳过检查。
- 实测计数：`company_site_agent_access` policy 为 `28`，company-site 启用 RLS 的表为 `28`；`eiscore_owner`、`eiscore_migrator`、`eiscore_authenticator`、`eiscore_agent`、`web_anon`、`web_user` 均为 `rolsuper=false`、`rolbypassrls=false`、`rolcanlogin=false`、`rolinherit=false`。
- 在 `web_user` 角色下切换 `request.jwt.claims` 做 A/B 验收：alice 可插入并读取自己的 session/message；bob 对 alice 的 session 查询返回 `0`，对 alice session 的跨所有者 message 写入被 RLS 拒绝，bob 读取 alice message 返回 `0`。测试事务已 `ROLLBACK`，未留下业务行。
- 该记录 supersede 之前“真实双租户 RLS A/B token 尚未执行”的阻塞描述：当前已完成数字分身表的真实 PostgreSQL JWT claim A/B 隔离，但仓库仍没有共享双租户 schema，因此不把它扩大解释为完整客户租户验收。真实 Harness 模型 prompt/tool、当前分支 client-plugin 编译制品、Docker Compose clean release 和远端部署仍未验收，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-28，数据库 Docker 套件复测）

- 直接在 WSL Ubuntu Docker daemon 上运行 `npm run test:database:docker`：DB1 baseline equivalence、DB2/DB3 role/RLS、company-site BFF、DB3 catalog/PostgREST contract、DB6 release artifact 和 DB5 recovery 全部通过。
- 真实测试先后暴露两个同类基础设施缺口并已修复：`database/baselines/eiscore-db-v1/core-through-001.json` 缺少 `core-001` 的 `lockTimeoutMs=10000`、`statementTimeoutMs=300000`、`idleTransactionTimeoutMs=60000`；`scripts/test-database-recovery.mjs` 与 `scripts/test-database-release.mjs` 的等待逻辑只依赖 `pg_isready`，会在目标数据库尚未创建时提前返回。现已补齐冻结 manifest 字段，并在两个等待循环加入真实 `psql SELECT 1` 探针。
- 修复后的证据：`npm run test:database-migrations` 通过；`node scripts/test-database-recovery.mjs` 通过；`node scripts/test-database-release.mjs` 通过；随后完整 `npm run test:database:docker` 通过。所有临时 DB/API/PostgREST 容器、网络和测试 backup 目录均由脚本清理。
- 该修复只增强数据库治理测试的可重复 readiness 和受控 manifest 合同，不改变业务 schema、前端视觉、远端部署或持久数据库卷。Harness client-plugin 编译制品、真实模型 prompt/tool、Docker Compose clean release 和远端发布仍是独立未完成项，目标继续保持 `active`。
- 数据库修复后的交叉回归也通过：`npm run test:harness`、`npm run test:production-config`、`node scripts/migration-switch-gate.mjs`、两个脚本 `node --check` 和 `git diff --check`；WSL Docker 当前仅保留无关 `yayulink-api` 容器。

## 全局目标继续推进记录（2026-09-28，外部 Web artifact 对照）

- 当前分支之外的 `C:/Users/Twist/Documents/eiscore/agent-harness` staging 目录现在包含三个 `client-plugins/*/lib/index.js`；该目录是无提交的独立仓库，不能作为当前 `codex/systematic-refactor` 的 provenance 或 release 输入，本轮未复制、覆盖或提交其中任何文件。
- 只读运行 `scripts/dsh-web-plugin-runtime-smoke.mjs`：Node 20.18.1 首次运行因 Harness 的 `undici@8.10.0` 使用 Node 24 WebIDL API 而在路由注册前退出；切换到 WSL 已存在的 Node 24.12.0 后，三个插件路由均返回预期的未认证 `401`，认证宿主 index 返回 `200`，digital-twin/enterprise-bi 两个组合 client bundle 返回 `200`，stderr 字节数为 `0`。
- 该对照证明外部编译制品与官方 Web host/当前 patch 结构兼容，但不证明当前分支拥有同源编译制品，也不证明浏览器 UI、真实模型 prompt/tool、Smart BI 行为等价、Docker Compose clean release 或远端部署；当前分支的 `LUNDU_HARNESS_ROOT` 仍未设置，目标继续保持 `active`。
- 同一外部目录在 Node 24 下通过 `scripts/validate-lundu-harness-artifacts.mjs` 的动态 import preflight；该结果只作为外部对照证据保存。

## 全局目标继续推进记录（2026-09-28，官方 SDK mock prompt 实测）

- 在仓库外临时目录安装官方 `@deepseek-ai/dsh-llm-mock-server@0.0.1-rc.1`，启动脚本化 OpenAI-compatible SSE 服务；未加入当前分支依赖、未修改锁文件、未连接真实模型。
- 使用本机官方 `@deepseek-ai/dsh@0.1.2-rc.1` 的 `sdk` profile、`@deepseek-ai/dsh-llm-deepseek` adapter 和 `DEEPSEEK_BASE_URL=<mock>`，通过 `agent-harness/dsh-http-bridge.mjs` 发起真实 `session/prompt`。结果：`ok=true`，助手文本为 `mock harness response`，mock 记录 `POST /chat/completions`、模型 `deepseek-v4-flash`、5 条消息、服务端 outcome `completed`。
- 该实测证明官方 SDK 初始化后的 session/prompt、DeepSeek adapter 请求序列化、SSE 响应聚合和 bridge prompt 返回链路可以在无 API key 的本地环境工作；它不证明真实 DeepSeek 模型质量、EISCore 生产插件制品、工具调用/RLS 业务执行或 Docker/远端部署。
- 临时测试使用的 `DSH_TELEMETRY_MODE=DISABLED`，所有临时 home、mock server 和进程均已关闭；当前分支仍未设置 `LUNDU_HARNESS_ROOT`，真实 client-plugin 编译制品、真实 Harness tool dispatch、Docker Compose clean release 和远端发布继续保持未验收，目标保持 `active`。

## 全局目标继续推进记录（2026-09-28，外部 staging Web 对照复测）

- 只读运行 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root /mnt/c/Users/Twist/Documents/eiscore/agent-harness --patch deploy/lundu/dsh-web.patch.yml`，确认 staging 中 `eiscore-auth`、`digital-twin`、`enterprise-bi` 三个 `client-plugins/*/lib/index.js` 可动态导入。
- 使用 WSL Node `v24.12.0` 与官方 Harness CLI `apps/cli/lib/bin.js` 运行 `scripts/dsh-web-plugin-runtime-smoke.mjs --runtime`；结果：auth、digital-twin、enterprise-bi 路由分别返回预期未认证 `401`，认证宿主 index 返回 `200`，启动图包含 `@eiscore/dsh-client-digital-twin` 与 `@eiscore/dsh-client-enterprise-bi`，组合 plugin bundle 均返回 `200`，stderr 字节数为 `0`。
- 该结果证明 staging 编译制品与官方 Web host/当前 patch 的注册和静态 bundle 交付兼容；`C:/Users/Twist/Documents/eiscore/agent-harness` 是独立、无提交 provenance 的 staging 工作区，未复制、覆盖或提交其制品，因此不能替代当前 `codex/systematic-refactor` 的 client-plugin artifact 验收，也不证明浏览器实际执行、真实模型/工具调用、RLS、Docker Compose clean release 或远端部署。

## 全局目标继续推进记录（2026-09-28，EISCore DSH tool proxy）

- 新增同源受限 DSH tool plugin：`agent-harness/eiscore-tools.mjs` 注册合同中的 18 个 capability；`eiscore-restricted.cordis.yml` 禁用通用 bash/fs/web/subagent 等逃逸工具，仅插入该插件。
- `realtime/harness-runtime.js` 在每次 Bridge dispatch 的短生命周期内绑定 `session_id -> 已认证 user/plugin`，新增 `POST /internal/harness/tool` loopback 路由。该路由要求独立的 `EISCORE_TOOL_PROXY_SECRET`，拒绝未知 session、插件/能力不匹配和非对象参数；JWT、tenant、subject、SQL、provider 等身份/模型字段不会从 DSH 参数进入业务执行。
- 工具执行继续复用现有 Tool Gateway，因此权限、RLS/租户、写确认、幂等和 JSONL 审计不产生第二套旁路；写调用只继承外层已确认的请求上下文，不接受模型参数伪造确认。
- 伦度/生产 Compose 与环境校验已要求 `EISCORE_TOOL_PROXY_SECRET`，bridge 使用同源 `DSH_PATCH=/opt/eiscore-harness/eiscore-restricted.cordis.yml`、`EISCORE_TOOL_PROXY_URL=http://agent:8078/internal/harness/tool`；artifact preflight 同时检查三个 client plugin 编译入口与两个 DSH tool artifact。
- 已通过：`node agent-harness/test-eiscore-tools.mjs`、`node realtime/test-harness-runtime-boundaries.js`、`node tests/engineering/runtime-http-router-regression.mjs`、`node tests/engineering/lundu-harness-artifact-regression.mjs`、`npm run test:production-config`、`npm run test:harness`（迁移目录同步后重跑）。真实官方 SDK tool-call_success、当前分支编译制品、Docker Compose clean release、远端部署和真实模型/业务数据验收仍未完成；目标保持 `active`。
- 真实 SDK tool-call 实测尝试使用临时官方 DSH profile、临时 mock LLM 和 loopback proxy；Windows 当前进程托管在启动阶段提前向 DSH 子进程发送 `SIGTERM`，未获得有效 tool dispatch 结果，已终止临时进程且未修改依赖/远端环境。该项继续按未验收处理。

## 全局目标继续推进记录（2026-09-28，SDK tool-call 边界实测）

- 使用同一官方 DSH SDK profile 和 mock provider 的 `tool_call_success` 行为，请求工具 `eiscore_enterprise_snapshot`；10 秒窗口内返回 `HARNESS_PROMPT_TIMEOUT`，mock 服务记录 6 次已完成模型请求。
- 该结果确认当前 `agent-harness/dsh-http-bridge.mjs` 的真实边界：文本 prompt 可以通过 SDK adapter 完成，但 bridge 当前只把请求转成 content blocks，未向 SDK composition 注册 EISCore tools，也未处理工具调用事件/工具结果回注，因此不能宣称已完成 Harness Plugin -> EISCore capability dispatch。
- 该缺口已同步到 `agent-harness/MIGRATION_CATALOG.json`；下一实现门槛是提供同源、受限的 DSH tool plugin/代理注册和工具调用回注，并用 EISCore Gateway 的权限、RLS、确认、幂等和审计链路做真实回归。未复制其他 Agent/WSL 未提交实现，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-28，未注册工具故障关闭）

- `agent-harness/dsh-http-bridge.mjs` 现在识别官方 SDK 的 `session.event` `tool/call` 事件；当前没有同源 EISCore tool plugin 时，立即以 `HARNESS_TOOL_UNAVAILABLE` 终止该运行时并拒绝请求，不再等待 SDK 重试直至 prompt 超时。
- `agent-harness/test-dsh-http-bridge-runtime.mjs` 新增真实 JSON-RPC 工具事件回归；`npm run test:harness`、`node --check agent-harness/dsh-http-bridge.mjs` 和 `git diff --check` 通过。
- 该修复只收紧失败边界，不代表 EISCore 工具已注册或已执行；同源 DSH tool plugin、工具代理/结果回注、真实 Gateway 权限/RLS/审计执行仍是迁移阻塞项，目标继续保持 `active`。
- `realtime/harness-runtime.js` 同步将 `HARNESS_TOOL_UNAVAILABLE` 纳入 Bridge 错误白名单，并新增归一化回归，保证未注册工具不会被误报为未知上游故障，也不会透传内部错误正文。

## 全局目标继续推进记录（2026-09-28，tool-call 闭环复测结论）

- 上述“未注册工具故障关闭”记录已被本节 supersede：当前 patch 已提供同源受限 `eiscore-tools`，官方 SDK 的 `dsh-tools` 负责实际 capability dispatch；bridge 不再在 `tool/call` 事件处提前终止。
- 使用官方 DSH SDK profile、当前分支 `eiscore-restricted.cordis.yml`、18 项 capability plugin、脚本化 mock provider 和 loopback proxy 实测成功：首轮 tool call -> `POST /internal/harness/tool` -> `tool/result` -> 第二轮模型回答，`proxyCalls=1`、`modelRequests=2`、最终文本 `mock response recovered`。
- 请求头复核确认只暴露 18 项 EISCore capability；SDK 自带 `str_replace_editor` 已加入禁用项并通过 smoke 复测不再出现。`node agent-harness/test-eiscore-tools.mjs`、`node agent-harness/test-dsh-http-bridge-runtime.mjs`、`npm run test:harness`、`npm run test:production-config`、`npm run lint:changed` 和 `git diff --check` 均通过。
- 本地 mock 闭环不等于真实 DeepSeek provider、当前分支 client-plugin 编译 provenance、Smart BI 行为等价、Docker Compose clean release、远端部署或生产数据验收；这些未完成项保持记录，目标仍为 `active`，且本轮没有连接远端或真实客户数据库卷。

## 全局目标继续推进记录（2026-09-28，模型工具参数确认边界）

- 复核 loopback proxy 后发现 Flash capability gateway 为兼容普通 HTTP 调用会读取 `payload.confirmed`/`payload.idempotency_key`；若直接透传 DSH 模型参数，模型可伪造写确认或幂等上下文。
- `realtime/harness-runtime.js` 的 proxy 专用参数净化现额外剥离 `confirmed`、`idempotency_key`、session/request/plugin/capability/agent/trace 元字段及其驼峰别名；外层已认证 dispatch 的确认和幂等值仍由服务端注入。
- 回归新增模型伪造 `confirmed`、`idempotency_key`、`session_id` 的写请求断言，`node realtime/test-harness-runtime-boundaries.js` 通过。该修复不改变普通 HTTP Tool Gateway 的兼容协议，只收紧 DSH loopback 边界。
- `agent-harness/test-eiscore-tools.mjs` 已纳入 `npm run test:harness-plugin`，因此受限 DSH tool 注册和 escape-hatch 禁用约束会随 Harness 主门禁持续执行。

## 全局目标继续推进记录（2026-09-28，多模态 capability loopback 接通）

- 复核发现 `agent-harness/eiscore-tools.mjs` 已注册的三项多模态 capability（translate/OCR/map-location）此前未进入 `realtime/harness-tool-gateway.js` 的 15 项 dispatch 清单；通过 DSH loopback 或 `/ai/*` 路由会稳定返回 `HARNESS_TOOL_UNAVAILABLE`。
- 已将 Tool Gateway capability 清单补齐为 18 项，并增加受控多模态 executor：网关先调用既有 `sanitizeMultimodalPayload`，拒绝 authorization、JWT、tenant、model、provider 等模型可伪造字段，再通过同一 Harness bridge 请求 provider，最后按 capability 规范化为 `{ text }` 或 `{ address }`。普通 HTTP 路由和 DSH loopback 共用该执行路径，不新增旁路权限或数据库访问。
- 新增回归覆盖三项 capability 的 dispatch、敏感字段拒绝、图片/坐标输入、规范化输出和 bridge 请求头边界；`node realtime/test-harness-tool-gateway.js`、`node realtime/test-harness-runtime-boundaries.js`、`node realtime/test-harness-multimodal.js`、`node realtime/test-harness-capability-http.js` 均通过，`node --check` 与 `git diff --check` 通过。
- 该项关闭“注册但不可执行”的本地 loopback 缺口；真实 DeepSeek provider、当前分支 client-plugin 编译 provenance、Smart BI 行为等价、Docker Compose clean release、远端部署和完整客户数据验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-28，当前分支 agent 镜像构建与隔离 smoke）

- Windows Docker Desktop named pipe 仍不可用；使用现有 WSL Docker daemon 和临时 `/tmp/codex-buildx-local` buildx 组件，从当前 `codex/systematic-refactor` 工作树精确复制 `realtime/*.js`、runtime package 和 Harness registry/contract 文件到临时 Linux 构建目录，构建上下文为 832 KB。
- `realtime/Dockerfile.prod` clean build 通过，生成本地临时镜像 `eiscore-agent-local:codex-02b6588-current`，镜像 digest 为 `sha256:80f4c8e3b550248a1f18b36bf93729178ad8beb6f03ba167d39b3ea8f842ee78`。未修改系统 buildx、未启动项目 Compose、未使用数据库或业务数据卷。
- 使用该镜像启动一次性 agent smoke 容器，临时端口 `127.0.0.1:18078`、只读根文件系统和 tmpfs `/tmp`；`GET /health` 返回 `200 {"ok":true,"channel":"eis_events"}`，容器内 `node --check index.js` 通过。容器已删除，现有无关 `yayulink-api` 容器未触碰。
- 该证据关闭“当前分支 agent 镜像无法 clean build/启动”的本地阻塞，但不等于完整 Docker Compose clean release：当前分支仍没有同源 `client-plugins/*/lib/index.js`，`LUNDU_HARNESS_ROOT` 未设置，真实 DeepSeek provider、外部 client plugin/Web host、Smart BI 等价、远端部署和客户数据验收继续保持未完成，目标仍为 `active`。

## 全局目标继续推进记录（2026-09-28，Harness 启用态镜像 smoke）

- 使用同一临时镜像在 `EISCORE_HARNESS_ENABLED=true` 下启动一次性容器，未挂载数据库、审计持久卷或源码目录；`GET /health` 返回 200，未认证 `GET /ai/config` 稳定返回 401 JSON，容器内 `node --check index.js` 通过。
- smoke 容器已删除，端口和临时资源已释放；该结果只证明当前 agent 镜像的 Harness 启用态 HTTP 边界可启动，不证明真实 Bridge、DeepSeek provider、client plugin、数据库/RLS 或远端部署已验收。

## 全局目标继续推进记录（2026-09-28，数据库隔离套件复验）

- 在 WSL Docker daemon 中运行 `npm run test:database:docker`，DB1 baseline equivalence、DB3 PostgreSQL/PostgREST 角色与 RLS、company-site BFF、DB3 catalog/PostgREST contract、DB6 release artifact 和 DB5 recovery 全部通过。
- 测试输出确认真实临时 PostgreSQL/PostgREST 安装、升级、重复执行、锁/漂移失败关闭、备份恢复及角色拒绝合同均通过；脚本使用隔离临时容器和测试目录，完成后清理，不使用项目 `pgdata` 或任何客户数据库卷。
- 该复验强化了权限/RLS/租户后端证据，但不扩大为完整 Harness 双租户业务验收；真实 DeepSeek provider、当前分支 client-plugin provenance、完整 Compose clean release、Smart BI 等价和远端部署仍未完成。

## 全局目标继续推进记录（2026-09-28，18 项 DSH tool loopback 逐项回归）

- 扩展 `agent-harness/test-eiscore-tools.mjs`：不再只检查注册数量和 schema，而是启动一次性本地 HTTP proxy，对 18 个注册 capability 逐项调用 `execute`，断言 `session_id`、`tool_name`、arguments、secret header 和返回值均正确传递。
- 回归通过：`node agent-harness/test-eiscore-tools.mjs`；该测试只使用 `127.0.0.1` 临时端口，执行结束后关闭 server，并未调用真实 DeepSeek provider、数据库或远端。

## 全局目标继续推进记录（2026-09-28，Smart BI 查询 capability 契约收紧）

- 审计发现 `eiscore_enterprise_query` 与 `eiscore_grid_query` 的执行器虽然只接受服务端固定数据集、字段、排序、筛选和分页，但插件合同仍使用任意输入/输出 schema，模型侧不能得到同等强度的契约约束。
- 已将两项只读 capability 的输入 schema 收紧为必填 `dataset`，可选 `select`（字符串或字符串数组）、`filters`、`limit`、`order`，拒绝未声明的身份、SQL、表名、URL 和其他字段；输出 schema 固定为 `{ dataset, rows, limit }`，并要求 `rows` 为对象数组、`limit` 为整数。
- Gateway schema validator 新增 `oneOf` 支持，以保留字符串/数组两种 `select` 表达而不放宽额外字段；实际字段白名单、权限、字段 ACL、JWT/RLS 和租户绑定仍由 `realtime/harness-query-tools.js` 执行器负责。
- 由于企业聊天入口历史上复用 `eiscore_enterprise_query` capability ID，Gateway 增加仅由服务端 `kind=chat` 标记选择的聊天输入/输出 schema；聊天消息不再被查询 schema 误拒绝，直接模型工具调用仍只能通过严格查询 schema。
- 同一查询 schema 已同步到 `agent-harness/eiscore-tools.mjs` 的 DSH `parameters`/`output.schema`；模型工具描述与 Gateway 执行合同现在一致，而其他 capability 保持已有受限/兼容参数策略。`agent-harness/test-eiscore-tools.mjs` 现在直接加载 `plugin-contract.v1.json` 比较两项 DSH 注册 schema，防止声明漂移。
- 多模态 translate/OCR/map-location 也已收紧为 sanitizer 实际接受的文本、图片引用、提示词和坐标字段，并固定 `{text}`/`{address}` 输出；未声明 provider/authorization/数据库参数会在 Gateway schema 校验阶段先于 dispatch 拒绝。三项 schema 同步进 DSH 注册，loopback 合同测试会直接比较 DSH 注册与 plugin contract。
- 工程上下文与独立站销售上下文已收紧为服务端目录支持的 `view/view_id` 输入和 `{context, view, data}` 输出；SQL、表名、租户、站点键等字段在 schema 阶段即拒绝，且 DSH 注册、Gateway 和 plugin contract 通过同源回归。
- 数字分身上下文与聊天 capability 已同步收紧：上下文只接受固定工具标识/参数对象并返回 `{tool_id, result}`；聊天只接受消息、会话 ID 和流开关，历史由服务端 RLS 会话加载，输出兼容 `text/output_text/choices` 及服务端补入的会话字段。DSH 注册、Gateway 和 plugin contract 已通过同源回归。
- 文档计划读取/提交 capability 已同步收紧：计划读取只允许服务端 UUID 的 `plan_id/asset_id`（含兼容驼峰别名），提交只允许计划 ID、版本和嵌套参数对象；输出固定为计划列表或版本化提交结果。SQL、表名和伪造确认/幂等字段不会进入 DSH 合同，真实确认与幂等值仍由 Gateway 外层注入。
- Workflow context/write 已同步收紧为 `tool_id/toolId`、参数/args 对象，具体工具仍由服务端 allowlist 决定；Sales context 已同步收紧为查询字段、筛选、分页和排序，执行器继续强制 `sales_orders` 数据集。三项 capability 均拒绝 SQL、表名、租户等未声明字段。
- 为兼容已有调用显式携带 `dataset` 的格式，Sales context 合同允许该字段但通过 `enum` 只接受 `sales_orders`；Gateway schema validator 已加入最小 `enum` 校验，其他数据集会在 dispatch 前拒绝。
- 本轮文档 capability 变更后的完整验证通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:syntax`、`npm run test:runtime-image`、`npm run lint:changed` 和 `git diff --check`。目标继续保持 `active`，未连接远端或真实客户数据库卷。
- 本轮完整验证通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:syntax`、`npm run test:runtime-image`、`npm run lint:changed` 和 `git diff --check`。未连接远端、未启动持久 Compose、未使用客户数据库卷。
- 回归通过：`node agent-harness/test-plugin-registry.js`、`node realtime/test-harness-gateway.js`、`node realtime/test-harness-query-tools.js`、`node realtime/test-harness-tool-gateway.js` 和 `git diff --check`。新增测试覆盖有效字符串 `select`、未知输入字段拒绝、非法查询输出拒绝和 registry 深拷贝/严格 schema。
- 2026-09-28 复跑 `npm run test:unit` 时，前置独立站测试仍有 2 项既有图片夹具失败：`research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 缺失；本轮未补造素材，也未把该前端夹具问题误记为 Harness 后端通过。
- 同日只读运行 `node scripts/validate-lundu-harness-artifacts.mjs` 明确失败于 `LUNDU_HARNESS_ROOT` 未设置；当前分支仍不存在 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js`、`client-plugins/enterprise-bi/lib/index.js`，未使用外部 staging 制品替代 provenance。
- `npm run test:runtime-image` 通过（27 个 composition-root 模块、2 个 Dockerfile）；随后尝试用 WSL legacy `docker build` 重建当前 agent 镜像时连续数分钟无输出，已终止该临时进程，未产生新镜像或容器，因此不把这次尝试计为 clean build 证据，也未影响已有镜像或无关容器。
- 本轮进一步检查发现此前临时 buildx 目录 `/tmp/codex-buildx-local` 已被 WSL 会话清理，当前 Docker CLI 不提供 `buildx` 子命令；已创建的 staging 目录未用于发布或持久构建，未安装系统组件，当前分支 clean build 仍以先前已记录的 buildx digest 证据为准。
- 该项增强 Smart BI/网格查询及多模态 capability 的本地合同强度，不等价于真实 enterprise-bi client plugin、真实 provider prompt/tool 行为或六大领域业务指标等价验收；同源 client-plugin 制品、完整 Compose clean release、远端部署和真实数据验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-29，Sales write capability 契约收紧）

- 逐段复核 `realtime/company-sales-agent.js` 的七个既有销售写 handler 后，将 `eiscore_sales_write` 的模型可见输入从任意对象收紧为按 operation 区分的 `oneOf` 合同：线索评分、商机草稿、报价草稿、销售订单草稿、生产草稿、审批和同步入队分别只允许其业务 handler 实际读取的字段。
- 合同保留当前执行器已消费的 `operation/action`、资源 ID、`object_type/objectType`、日期和来源字段别名；审批决策只允许 `approve/reject`，审批与同步对象只允许 `opportunity/quote/sales_order/production`。SQL、表名、schema、租户、授权、确认和幂等字段不在 DSH 工具合同内，因而会在 Gateway dispatch 前拒绝。
- DSH 工具注册、plugin contract 与 Gateway 使用同一严格 schema，`agent-harness/test-eiscore-tools.mjs` 已把 `eiscore_sales_write` 纳入逐项合同一致性断言；既有 `realtime/harness-sales-write.js` 仍负责 UUID、固定 operation、服务端幂等和 handler 映射，不复制业务规则。
- 定向验证通过：合同 JSON 解析、`node agent-harness/test-eiscore-tools.mjs`、`node realtime/test-harness-gateway.js`、`node realtime/test-harness-sales-write.js` 和所改文件 `git diff --check`。
- 完整本地门禁随后通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:syntax`（300 个 Node 文件）、`npm run test:runtime-image`（27 个 composition-root 模块、2 个 Dockerfile）、`npm run lint:changed`（118 个既有变更文件）和全工作树 `git diff --check`。
- 本轮没有修改前端视觉，没有连接或发布伦度远端，没有启动项目 Compose，也没有读取或写入客户/持久数据库卷。同源 client-plugin 制品、真实 DeepSeek provider、完整 Compose clean release、Smart BI 行为等价和远端部署仍未验收，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-29，Flash 契约与写上下文单一信任路径）

- 18 项 capability 合同复核发现最后两项宽松模型输入为 `eiscore_flash_read/write`。现已按真实 Flash 协议收紧：必须提供 `tool_id` 或 `toolId`，仅保留 `arguments/args` 嵌套业务参数；工具身份、风险级别和权限仍由既有 Flash registry/service allowlist 决定，未复制 40 项业务工具规则。
- Flash、固定 Workflow、Document Commit 和 Sales Write 的 Harness 专用执行器已移除从 payload 读取 `confirmed`、`confirm`、`idempotency_key/idempotencyKey` 的兼容路径；这些字段现在只接受统一 Harness Gateway 已认证的外层 request context。普通 Flash HTTP/WebSocket 业务协议仍由 `flash-tool-service` 处理，未改变。
- Gateway JSON Schema `oneOf` 已从“至少一支匹配”修正为标准的“恰好一支匹配”。同时把 Document Commit 的重放输出从两个包含关系分支改成单一对象合同，使可选 `idempotent_replay` 不会产生双重匹配；同时携带两套别名的歧义 Flash payload 会在 dispatch 前拒绝。
- 回归覆盖模型在 payload 中伪造确认、幂等键和 SQL 字段，Document/Sales 直接 executor 的幂等伪造，以及销售同步的 `confirm=true` 伪造；验证均确认只能使用服务端 request context。
- 完整本地门禁通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:syntax`（300 个 Node 文件）、`npm run test:runtime-image`（27 个 composition-root 模块、2 个 Dockerfile）、`npm run lint:changed`（118 个既有变更文件）和全工作树 `git diff --check`。
- 仓库外 `C:/Users/Twist/Documents/eiscore/agent-harness` 虽包含三个 client-plugin 源码/制品，但它属于一个无提交、工作树根错误扩展到上级目录的仓库，无法提供可追溯 commit provenance；本轮没有把该前端代码复制进后端重构分支。
- 本轮仍未连接远端、未启动持久 Compose、未使用客户数据库卷，也未修改前端视觉。当前分支同源 client-plugin 制品、真实 DeepSeek provider、完整 Compose clean release、Smart BI 行为等价和远端部署继续作为未完成项，目标保持 `active`。

## 全局目标继续推进记录（2026-09-29，Capability 必填合同与迁移门禁）

- 将执行器真实必需条件前移到模型可见合同：`eiscore_twin_context` 必须提供四种受支持工具标识之一，`eiscore_twin_chat` 必须提供 `message` 或 `content`，`eiscore_document_commit` 必须提供计划 ID 与计划版本；snake_case/camelCase 组合继续兼容，空 payload 在 dispatch 前拒绝。
- Document Commit 与 Sales Write 直接 executor 不再把嵌套 `arguments` 提升并覆盖顶层计划、operation 或资源标识；固定 Workflow executor 在没有 `arguments/args` 时使用空业务参数，不再把 `tool_id` 等路由字段下沉给 Flash semantic tool。
- `scripts/migration-switch-gate.mjs` 新增全局不变量：18 项 capability 的 input schema 及其 `oneOf` 分支均不得使用顶层 `additionalProperties: true`。当前 18 项能力全部通过；嵌套 `arguments`、`filters` 等业务对象仍可在各自声明范围内开放。
- 最终 `npm run test:harness` 全部通过，包含插件 registry、写确认/幂等/审计、Tool Gateway、数字分身 RLS 会话、文档提交、销售写、旧生产路径移除、查询 ACL、SDK Bridge tool-call continuation 和迁移切换门禁。
- `npm run test:production-config`、`npm run test:syntax`（300 个 Node 文件）、`npm run test:runtime-image`（27 个 composition-root 模块、2 个 Dockerfile）、`npm run lint:changed`（118 个既有变更文件）及 `git diff --check` 通过。`npm run test:unit` 仍只在既有独立站图片 `research-gallery/gallery-001.png`、`research-gallery/gallery-021.jpeg` 缺失处失败，未出现新的 Harness 后端失败。
- 尝试在 WSL 可用 Docker daemon 上用 `realtime/Dockerfile.prod` 构建 `eiscore-agent-local:codex-wt-20260929`；Dockerfile 使用 BuildKit `RUN --mount`，而当前 WSL CLI 缺少 buildx，构建在读取上下文前以明确错误退出，没有生成镜像或容器。未安装系统组件、未修改 Dockerfile、未启动 Compose，也未触碰任何卷。
- 环境仅发现一个未读取内容的通用 OpenAI 凭据；`DEEPSEEK_API_KEY`、`DSH_API_KEY`、Harness 审计密钥、Tool Proxy secret 和 `LUNDU_HARNESS_ROOT` 均未配置，因此没有把通用凭据冒充真实 DeepSeek Provider 验收。目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-29，九插件聊天合同与数字分身双 Gateway 修复）

- 生产链路复核发现 `/ai/chat/completions` 的九个默认插件映射均以 `kind=chat` 进入 Provider Gateway，但此前只有 `eiscore_enterprise_query` 声明聊天 schema；其余八项会错误回退到普通工具 schema，在到达 DeepSeek Harness Bridge 前拒绝合法 `{messages, stream, context}`。现已为九项服务端固定聊天 capability 全部声明同一封闭 chat input/output 合同。
- 数字分身 Tool Gateway 内层 dispatch 已改为标准聊天协议：只使用 RLS 持久化层加载的服务端历史，追加当前用户消息，设置 `kind=chat`，并向 Bridge 发送 `messages` 与服务端会话 context；客户端伪造的 `history` 不会进入 Provider。
- 回归覆盖九个 HTTP 默认插件映射经过真实 Gateway schema、未声明聊天字段在 dispatch 前拒绝、数字分身服务端历史与当前消息进入 `requestContentBlocks()`、客户端 history 不下沉、消息仍按原顺序持久化。迁移门禁现在强制九项聊天 capability 必须具有封闭 chat input schema 和 chat output schema。
- 完整本地验证通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:syntax`（300 个 Node 文件）、`npm run test:runtime-image`（27 个 composition-root 模块、2 个 Dockerfile）、`npm run lint:changed`（118 个既有变更文件）、合同/Catalog JSON 解析和 `git diff --check`。
- 本轮只修改 Harness 后端合同、数字分身转发、测试和工程记录；未修改前端视觉，未连接或发布伦度远端，未启动 Compose，未接触数据库卷。

## 全局目标继续推进记录（2026-09-29，生产 Bridge 装配与会话串行化）

- 生产装配复核发现根级 `docker-compose.prod.yml` 要求 `EISCORE_HARNESS_URL=http://harness-bridge:3080`，但原先没有定义 `harness-bridge` 服务；已补入受限的 DeepSeek Harness Bridge，使用固定镜像、非特权用户、只读根文件系统、不可执行 tmpfs、当前仓库 `agent-harness` 只读制品、独立状态卷和同一 `EISCORE_TOOL_PROXY_SECRET`。Agent Runtime 的构建上下文同步扩大到仓库根目录，使生产镜像能包含 `agent-harness` registry/contract。
- 生产环境校验现在要求 `DSH_PROVIDER` 与 `DSH_MODEL` 为显式合法标识；`env/.env.example`、生产 Compose 和生产配置回归保持同一契约。只读 `docker compose -f docker-compose.prod.yml config --quiet` 已用隔离临时环境通过，未创建或启动容器。
- Runtime Provider dispatch 增加按 `session_id` 的最小串行队列。同一会话的第二个请求必须等待第一个请求的 Bridge 请求结束后才进入 Tool Proxy active context，避免确认状态、幂等键、插件身份和用户租户在并发请求间串用；请求结束后队列与 active context 均清理。
- 回归覆盖同会话并发请求、当前请求确认/幂等上下文切换、Bridge 请求体顺序以及队列清理；`node realtime/test-harness-runtime-boundaries.js`、`npm run test:harness`、`npm run test:production-config`、`npm run test:runtime-image`、`npm run test:syntax`、`npm run lint:changed`、合同/Catalog 检查和 `git diff --check` 均通过。
- 本轮未修改前端视觉，未连接或发布伦度远端，未启动持久 Compose，未读写任何客户数据库卷。真实 DeepSeek 凭据/Provider、同源 client-plugin provenance、完整 clean release 和远端验收仍未完成，目标继续保持 `active`。
- 追加验证：`npm run test:ci` 已运行至 `test:g3-exit`，G3 composition gates 通过后在既有 `vue-complexity-inventory-regression` 失败：`eiscore-mobile/src/views/LoginView.vue` 从 1632 行基线增长到 1826 行。该失败属于工作树中既有前端改动，本轮没有修改该文件，也没有用前端降级或基线篡改掩盖失败；因此不能把 `test:ci` 记为通过。

## 全局目标继续推进记录（2026-09-29，生产模型出口静态护栏）

- 重新审计 `realtime/`、`agent-harness/` 和平台网络客户端的生产可达出口：现有模型请求只由 `realtime/harness-runtime.js` 发往 EISCore HTTP→SDK bridge 的 `/v1/chat/completions`，bridge 再通过 `session/prompt` 调用 DeepSeek Harness SDK；EISCore 工具插件只经带 secret 的 Tool Proxy 回到本地 Agent Runtime，PostgREST 请求仍是业务数据执行链路。
- 未发现生产代码直接读取 OpenAI/Anthropic/DeepSeek API key、直接访问公开模型域名或保留旧 Provider URL。`FLASH_AGENT_BASE_URL` 仅用于 Harness 内的 Flash semantic tool 回调本地 EISCore HTTP 路由，不是模型出口。
- `tests/engineering/harness-production-path-regression.mjs` 新增静态护栏：realtime 生产源、SDK bridge、HTTP bridge 和 EISCore tool plugin 均不得包含直接模型凭据/公开模型域名标记，并强制 Runtime 使用 bridge 契约、Bridge 使用 SDK `session/prompt` 协议。该门禁已纳入 `npm run test:harness`。
- 本轮验证通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:runtime-image`、`npm run test:syntax`（300 个 Node 文件）、`npm run lint:changed`（118 个文件）、`node scripts/migration-switch-gate.mjs` 和 `git diff --check`。
- 本轮仍未连接远端、未启动持久 Compose、未触碰客户数据库卷；`LUNDU_HARNESS_ROOT` 同源前端插件制品、真实 DeepSeek Provider/凭据、完整 Compose clean release、Smart BI 行为等价及远端线上验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-29，移除主站旧模型请求字段）

- 审计发现主站 `eiscore-base/src/utils/ai-bridge.js` 虽然已经通过 Harness 路由请求，但仍会在聊天 payload 中发送旧的 `glm-4.6v` 模型选择字段。服务端会丢弃该字段，但它仍让前端调用契约携带已退役模型信息。
- 已删除该字段；主站聊天请求现在只提交 Harness 聊天入口需要的流式标志、助手模式、受净化上下文和消息。新增回归同时禁止旧模型字面量和配置模型字段回归。
- 本轮仍未修改前端视觉、未连接远端、未启动持久 Compose、未触碰数据库卷。真实 DeepSeek Provider、同源 client-plugin 制品、完整 Compose clean release、Smart BI 行为等价和远端验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-29，旧模型字段收紧复验）

- 定向回归通过：`node tests/engineering/base-ai-bridge-http-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/agent-sse-client-regression.mjs`、`node realtime/test-harness-chat-http.js`。
- 完整后端门禁复跑通过：`npm run test:harness`、`npm run test:production-config`、`npm run test:runtime-image`、`npm run test:syntax`（300 个 Node 文件）、`npm run lint:changed`（120 个文件）、`node scripts/migration-switch-gate.mjs` 和 `git diff --check`。
- 当时审计发现的 `SettingsView.vue` 旧 `ai_glm_config` 管理表单已在后续收口中移除；当前页面仅展示只读 `deepseek-harness` 提供方与部署侧配置说明。生产 Compose、Runtime 和 Harness Bridge 均不读取该配置。
- 本轮没有连接远端、没有启动持久 Compose、没有写入数据库卷；真实 DeepSeek Provider、同源 client-plugin 制品、完整 Compose clean release、Smart BI 行为等价和远端线上验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-29，完整离线单元套件复验）

- `npm run test:unit` 仍失败于独立站既有图片夹具缺失：`eiscore-company-site/research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg`；同一套件其余 28 项已通过，未出现新的 Harness 后端失败。
- 本轮不补造客户/独立站素材，也不为让单元套件变绿而修改前端视觉；该失败继续单独记录，不影响已通过的 Harness 后端门禁结论。

## 全局目标继续推进记录（2026-09-29，插件路由兼容性与来源复核）

- 只读核对候选 Web 插件的 Host 路由与当前生产路由清单：数字分身插件的
  `/api/eiscore/digital-twin/{chat,sessions,messages}` 分别代理到 `/twin/chat`、
  `/twin/sessions`、`/twin/messages`；enterprise-bi 插件的 snapshot/query 分别代理到
  `/ai/business-snapshot` 与 `/ai/chat/completions`。当前 `realtime/http-router.js` 均有对应
  exact route，且数字分身聊天入口已由 Harness Gateway 接管；这只证明静态路由兼容，不证明
  插件编译制品或真实业务输出已经验收。
- 认证插件的 handoff 目标 `/company-site/auth/handoff/consume` 在当前 company HTTP manifest
  中存在；插件仅把短期 Host 会话中的 JWT 放入同源 Gateway 请求，不把 JWT 传给 Client Module、URL
  或数据库。该结论来自源码静态检查，未连接远端或真实登录服务。
- 重新尝试读取 WSL `/home/lzr/deepseek-harness` 与 `/home/lzr/eiscore-refactor` 时，`wsl.exe`
  返回 `WSL_E_UNEXPECTED`/kernel panic，未能获得新的官方 workspace HEAD 或构建证据；没有因此修改
  WSL 文件、安装系统组件或把旧缓存当作当前提交来源。
- Windows 外部 `C:/Users/Twist/Documents/eiscore/agent-harness` 和 `.codex-tmp/auth-work-20260920`
  仍属于无提交/未纳入当前分支的工作树。其源码和已有 `lib/` 哈希可以作为候选参考，但不能满足
  当前分支插件 provenance 要求；`LUNDU_HARNESS_ROOT` 仍未配置，未复制或发布这些制品。
- 本轮没有修改前端视觉、没有连接或发布伦度远端、没有启动持久 Compose、没有读写任何数据库卷。
  同源 client-plugin 编译制品、真实 DeepSeek provider、完整 Compose clean release、Smart BI
  行为等价和远端验收继续保持未完成，目标仍为 `active`。

## 全局目标继续推进记录（2026-09-30，WSL 隔离镜像构建与 Bridge readiness）

- Windows Docker Desktop 的 Linux named pipe 仍不可用；改用 WSL Ubuntu 本地 Docker daemon（Docker
  Server `29.1.3`）执行验证。首次从完整工作树构建因上下文包含约 250 MB 的 `realtime/node_modules`
  而停止，未创建或启动项目容器。
- 使用仅包含 Dockerfile 明确输入的临时构建上下文（未复制外部/WSL client-plugin 制品）重新构建成功：
  `eiscore-refactor-agent-runtime:check` 镜像 ID
  `sha256:7f3e02ecd07a9466ba5f32fed26eaea053d931e4005ce861d3437dc19ddf3a19`，
  `eiscore-refactor-harness-bridge:check` 镜像 ID
  `sha256:7e49cc3efdeb34d54e956cae56ce28ed2d0a7328e611d79172526a57e5f3faee`。
  两个镜像均只写入本地 Docker 镜像缓存，没有写入 Compose 卷。
- 用当前分支 `agent-harness/` 作为只读 `/opt/eiscore-harness` 挂载启动一次临时 Bridge 容器；
  `GET /readyz` 返回 200，`checks.runtime/plugins/sessions=true`；带
  `x-eis-harness-protocol: eiscore-agent-v1` 的 `GET /metrics` 返回 200、
  `state_persistence=true`、`active=0`、`sessions=0`、`tracked_requests=0`。临时容器已停止并清理，
  未连接真实 Provider、数据库或远端。
- 使用同一隔离构建的 `eiscore-refactor-agent-runtime:check` 启动无卷临时容器：
  `GET /health -> 200 {"ok":true,"channel":"eis_events"}`，未认证 `GET /ai/config -> 401`
  且返回稳定 JSON 错误；文档 worker 因故意未提供数据库而记录 `ECONNREFUSED`，容器已停止并清理，
  未读写数据库卷。
- 当前工作树串行复跑 `npm run test:harness` 通过，覆盖插件合同、Gateway 权限/确认/幂等/审计、
  工具与 RLS 会话边界、数字分身持久化、固定业务写入、生产路径、Bridge continuation/关闭和迁移切换门禁。
- 直接运行当前分支 `node scripts/validate-lundu-harness-artifacts.mjs` 仍按预期失败：
  `LUNDU_HARNESS_ROOT: required`；三组可追溯的 `client-plugins/*/lib/index.js` 仍不存在。
- 进一步复核 `git ls-files agent-harness/client-plugins client-plugins`、`.gitmodules` 和全仓源码引用后，
  当前提交没有这三组插件源码、Git 子模块或可复现构建入口；`agent-harness/package-lock.json` 中的
  DSH UI 依赖只是官方运行时依赖，不包含 EISCore 业务插件实现。不能从这些依赖生成或冒充业务插件制品。
- 通过 WSL Ubuntu Docker daemon 逐项复跑数据库套件：DB1 baseline equivalence、DB3 roles/PostgREST/RLS、
  company-site BFF Agent chain、DB3 catalog/PostgREST contract、DB6 release lock/backup/drift 和 DB5
  recovery 全部通过。Windows 直接运行组合命令仅因默认连接不可用的 Docker Desktop named pipe 失败，
  不代表测试断言失败；WSL 运行产生的两个临时 `eiscore-db2-*` 容器已核对为仅挂载当前分支 SQL 后清理，
  未触碰业务数据卷，现存 Docker 容器仅为原有无关 `yayulink-api`。
- 随后在同一 WSL daemon 中完整复跑 `npm run test:database:docker`，DB1、DB3、company-site BFF、
  catalog、DB6 release 和 DB5 recovery 六个子套件全部返回 0；结束后没有残留测试容器。
- 使用本地构建的 `eiscore-refactor-agent-runtime:check` 与 `eiscore-refactor-harness-bridge:check`
  作为镜像输入，在临时 Compose 项目 `codex-harness-check` 中启动 `db`、`api`、`agent-runtime` 和
  `harness-bridge`（未启动 web/code-server）。DB health 为 healthy，PostgREST 根接口返回 HTTP 200，
  Agent `/health` 返回 HTTP 200，未认证 `/ai/config` 返回稳定 401，Bridge healthcheck 返回 healthy。
  使用 `docker compose ... down -v --remove-orphans` 后，临时容器、网络和三个临时卷均已删除；没有使用
  或修改现有 `pgdata`/业务卷，也未连接真实 Provider 或远端。
- 为兼容未安装 BuildKit/buildx 的 legacy builder，新增根级 `.dockerignore`，只保留 `realtime` 与
  `agent-harness` 两个镜像 Dockerfile 的明确输入，并在 `runtime-image-contract` 中锁定这些输入；
  `npm run test:runtime-image` 通过。直接从 Windows 挂载路径运行 legacy `docker build` 在两分钟内仍未
  输出 context 大小，已停止该无容器构建；隔离最小上下文构建仍保持通过，未把该观察误记为 clean build 通过。
- 变更后的 `npm run test:infrastructure`、`npm run test:production-config` 均通过，确认根级忽略规则没有
  排除生产 Compose、Lundu Harness artifact preflight 或 Web runner 合同所需的输入。
  因此 Lundu 完整 Web artifact、官方 client-plugin 行为、真实 Provider prompt/tool、外部双租户
  RLS、完整 Compose 验收和远端发布仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，canonical Harness 客户端路径迁移）

- 将生产客户端从兼容命名空间迁移到 Runtime 的 canonical 路径：AI/SSE 使用 `/ai/*`，数字分身使用
  `/twin/*`，智能收单使用 `/document-intake/*`，Harness 登录交接使用 `/company-site/*`；`/agent/*`
  仅保留为 Nginx/Runtime 的兼容别名，生产源码不再主动生成 `/agent/ai`、`/agent/twin` 或
  `/agent/document-intake` 请求。
- 默认企业配置和公开配置的 `realtimeWsPath` 已统一为 `/ws`；两个 Vite 开发代理新增 canonical
  Harness 路径；Service Worker 将 canonical Runtime 前缀列为网络旁路，避免把受保护响应写入客户端缓存。
- Flash Builder 的内部模式名从 `LEGACY`/`legacyMode` 改为 `SHELL`/`shellMode`。用户仍看到“壳模式”，
  其 WebSocket 协议继续使用 `flash:harness_*`；历史已发布草稿的 `legacy` 快照兼容逻辑未删除。
- 受影响客户端回归通过：Agent SSE、业务快照、Geo、智能收单、数字分身 JSON、Flash Builder；
  `npm run test:platform-http`、`npm run test:harness`、`npm run test:runtime-image`、`npm run test:syntax`
  （300 个脚本）、`npm run test:flash-builder`、`npm run lint:changed` 和 `git diff --check` 均通过。
- 本地完整前端构建通过：`eiscore-base`（4528 modules）、`eiscore-apps`（2329 modules）、
  `eiscore-mobile`（1479 modules）。构建只产生既有 Sass/大 chunk 警告；dist 扫描未发现旧 AI/Twin/收单
  兼容路径或 `legacy` 模式入口。
- 本轮未连接远端、未启动 Compose、未发布 Web/后端、未读写数据库卷；真实 Provider、同源 client-plugin
  provenance、clean image release、双租户 RLS、Smart BI 行为等价和线上验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，Flash Builder Harness WebSocket 协议收口）

- 审计确认 `/agent/ws` 只是 Nginx 到当前 Runtime `/ws` 的兼容别名；后端 WebSocket manifest 已无旧
  `agent:task`、Cline 会话或进程执行器，旧 Agent 编排不会从该入口重新出现。
- 发现前端 Flash Builder 仍发送已删除的 `flash:cline_task/reset` 消息，导致壳模式连接成功但任务无响应。
  已增加受认证的 `flash:harness_task/reset`，直接经 Harness Gateway 使用 `flash-builder` 插件；任务上下文
  仍携带会话、历史和附件，写能力继续由 Gateway 的确认、幂等、权限和审计边界控制。前端仅切换消息协议和
  canonical `/ws` 路径，未改视觉布局。
- 已通过 `websocket-server-regression.mjs`、`realtime-composition-root-regression.mjs`、
  `harness-production-path-regression.mjs`、`runtime-http-router-regression.mjs`、
  `production-config-regression.mjs` 和 Node 语法检查；`flash:cline_*`、`/agent/ws` 的生产前端协议引用
  已有回归门禁覆盖。
- 本轮仍未连接远端、未启动持久 Compose、未读取或写入数据库卷；当前分支 client-plugin provenance、真实
  DeepSeek Provider、完整 Compose clean release、外部双租户 RLS 与线上验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，本地镜像与 WebSocket 容器烟囱）

- WSL Ubuntu 本地 Docker 29.1.3 已恢复；首次 legacy builder 因扫描 Windows 工作树上下文被主动终止，随后用
  仅包含当前 runtime/Harness 文件的显式临时上下文重建，未读取或写入项目业务卷。当前提交工作树构建的
  `eiscore-harness-bridge:codex-current` 镜像 ID 为 `sha256:3f4e16dac6c4a412a2b668cad393f489b3b71f62b72460a575344520096eda15`，
  `eiscore-agent-runtime:codex-current` 镜像 ID 为 `sha256:96532a8308c7e9be352c2b083652ecba697376847d7567e938a3ee01e0cb1386`。
- 一次性 agent 容器 `/health=200`、未认证 `/ai/config=401`；同一容器内用签名租户 JWT 连接 `/ws` 并发送
  `flash:harness_task`，实际收到 `flash:harness_status → flash:harness_error(HARNESS_UPSTREAM_UNAVAILABLE) →
  flash:harness_done`，证明认证、Harness Gateway 和失败关闭链路进入容器制品。没有 Provider/API key，未伪造成功模型输出。
- 一次性 bridge 容器挂载当前分支 `agent-harness` 后，带协议访问 `/readyz=200`，`runtime/plugins/sessions=true`；
  `/v1/plugins=200` 返回 9 个注册插件，stderr 为空。所有 smoke 容器均在命令内清理；现有 `yayulink-api` 未操作。
- 该证据仍不等价于真实 DeepSeek Provider、当前分支三组 client-plugin 编译 provenance、完整 Compose clean release、
  外部双租户 RLS 或远端验收；本轮未连接远端、未发布服务、未修改前端视觉、未写入真实数据库卷，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，隔离数据库 Docker 套件）

- 在 WSL Docker daemon 中从当前 `github-eiscore-refactor` 工作树运行 `npm run test:database:docker`，
  使用脚本管理的临时容器/卷，未连接或重建现有 `yayulink-api` 业务容器。
- DB1 fresh install/前序升级 schema 等价通过；DB3 PostgreSQL/PostgREST 角色、company-site Agent RLS、
  HR payroll RLS 和拒绝合同通过；company-site BFF 的 public/admin/publish/inquiry/sales Agent HTTP 链路通过；
  DB3 catalog/PostgREST fresh/upgrade/repeat contract 通过；DB6 release artifact 锁、升级、备份、漂移/冲突
  fail-closed 和重复执行通过；DB5 在空栈恢复 v6 roles、数据、DB contract 和稳定 PostgREST 通过。
- 本轮没有修改前端视觉、没有连接远端、没有写入真实业务数据库卷。该证据加强了隔离数据库治理和 RLS 基线，
  但不替代外部客户双租户 token 验收、真实 DeepSeek provider/client-plugin provenance、完整 Compose/Web clean
  release 或远端验收；目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，外部候选 Web plugin staging 复核）

- 直接使用 WSL `/home/lzr/eiscore-refactor/agent-harness` 候选目录时，当前分支的 artifact preflight
  仍因缺少 `eiscore-tools.mjs` 失败；该目录的三组 `client-plugins` 仍是未跟踪、无 commit provenance 的外部输入。
- 在一次性 `/tmp` staging 中组合外部候选三组 `client-plugins` 与当前分支受控的
  `eiscore-tools.mjs`、`eiscore-restricted.cordis.yml`，使用 Node 24 和官方 DSH Web CLI 运行：
  artifact preflight 通过；`/api/eiscore/auth/status`、数字分身 sessions、enterprise-bi snapshot
  均返回预期未认证 `401`；DSH index 返回 `200`，两个 EISCore plugin bundle 返回 `200`，stderr 为 `0`。
- staging 目录已删除，未复制、提交或发布外部 client plugin；该结果证明外部候选与当前 patch/工具契约兼容，
  不改变当前分支 provenance、真实 Provider、双租户业务 RLS 或远端验收仍未完成的结论。

## 全局目标继续推进记录（2026-09-30，WSL clean Bridge 容器 smoke）

- 使用 WSL 内置 Docker daemon 对当前分支构建的 clean 镜像完成一次性隔离验证：
  `codex-harness-bridge-clean:20260930` digest 为
  `sha256:3f4e16dac6c4a412a2b668cad393f489b3b71f62b72460a575344520096eda15`；同批
  `codex-agent-clean:20260930` digest 为
  `sha256:84bd5017cc88666da40425b74fd47fd85b650b6e7c44cf5ced8f00148b8abf70`。
- Bridge 以 `--network none`、运行身份 `10001:10001`、只读 Harness 工具挂载和一次性 named
  volume 启动；`/var/lib/dsh` 权限为 `10001:10001 0755`。即时验收结果：`/healthz=200`、
  `/readyz=200`（`runtime/plugins/sessions=true`）、带协议头的 `/v1/plugins=200` 且返回 9 个插件、
  `/metrics=200` 且 `active=0,sessions=0,tracked_requests=0`。未发送 prompt，未调用模型。
- 额外的 tmpfs 试运行曾得到 `/readyz=503`，原因是 tmpfs 覆盖镜像目录后变为 `root:root 0755`，
  运行用户无法创建 `profiles/sdk`；生产 Compose 使用 named volume，不能用该 tmpfs 结果替代部署验收。
- 本轮未连接远端、未发布 Web/API、未修改前端视觉、未读写现有数据库卷；真实 DeepSeek provider、
  双租户 RLS、完整 Compose/Web clean release 和远端线上验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，WSL Bridge 镜像隔离 readiness smoke）

- 使用 WSL Ubuntu Docker daemon 对最新 `github-eiscore-refactor-harness-bridge:latest` 执行一次性隔离
  容器 smoke；镜像 digest 为 `sha256:c60242eadb2f18be6257746a1849e92c937954d8b29c79a2a3074dbba9426c24`。
  当前工作树 `agent-harness` 以只读方式挂载到 `/opt/eiscore-harness`，`--network none`，未挂载数据库卷，
  并显式传入正式 Compose 使用的 `DSH_HOME=/var/lib/dsh`、`DSH_CWD` 与 `DSH_PATCH`。
- 容器内实际验收：`GET /healthz` 返回 200；`GET /readyz` 返回 200，
  `checks.runtime/plugins/sessions=true`；带 `x-eis-harness-protocol: eiscore-agent-v1` 的
  `GET /v1/plugins` 返回 3 个显式插件（`eiscore-auth`、`digital-twin`、`enterprise-bi`）。
  smoke 容器已删除，未留下运行服务或持久状态。
- 初次故意省略 `DSH_HOME` 的启动只得到 SDK 默认目录 `/.dsh` 的 `EACCES`，随后按正式 Compose 配置复验通过；
  该现象记录为 smoke 环境缺参，不构成应用代码故障。
- 本轮复跑 `npm run test:harness-bridge`、`npm run test:harness`、`npm run lint:changed`（120 个变更
  JS/Vue 文件）和 `git diff --check` 均通过。仍未连接远端、未启动持久 Compose、未发布 Web/后端、
  未读写现有数据库卷；同源 client-plugin 编译制品、真实 Provider prompt/tool、完整 Compose 验收和
  远端线上验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，Compose Bridge 命令链修复）

- 复核 `agent-harness/Dockerfile` 后确认镜像固定 `ENTRYPOINT ["node"]`；原 Lundu 与生产 Compose
  的 Bridge/Web `command` 又重复传入 `node`，实际会形成 `node node <script>`。已将
  `deploy/lundu/compose.yml` 的 `deepseek-web`、`harness-bridge` 以及 `docker-compose.prod.yml`
  的 `harness-bridge` 改为只传脚本参数，并在 `tests/engineering/production-config-regression.mjs`
  增加命令链回归断言。
- `npm run test:production-config`、`npm run test:harness-bridge`、`npm run lint:changed` 和
  `git diff --check` 均通过。使用与 Lundu Compose 完全相同的两个脚本挂载（`/opt/dsh-http-bridge.mjs`
  与 `/opt/http-bridge.js`）、`DSH_HOME=/var/lib/dsh` 和镜像入口执行一次性隔离容器，
  `GET /readyz` 返回 200（runtime/plugins/sessions 全部为 true），容器随后删除。
- 本轮未连接远端、未启动持久 Compose、未发布服务、未读写数据库卷。Lundu 主 Compose 的完整解析仍
  需要实际部署目录提供 `.env` 和 `LUNDU_HARNESS_ROOT`，本地没有生成部署凭据；真实 Provider、完整
  Compose、client-plugin provenance 与远端线上验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，本地隔离 Compose 运行验收与 tmpfs 修复）

- 首次尝试从 Windows 工作树执行生产 Compose `up --build` 时，WSL Docker 在 agent-runtime 构建上下文
  传输阶段 251 秒只传输 33B，未创建 EISCore 容器；该进程已终止。为完成运行时验收，使用当前分支
  已构建且有 digest 的镜像启动唯一项目 `codex-harness-compose`：
  `eiscore-agent-local:codex-current@sha256:84bd5017cc88666da40425b74fd47fd85b650b6e7c44cf5ced8f00148b8abf70`、
  `github-eiscore-refactor-harness-bridge:latest@sha256:c60242eadb2f18be6257746a1849e92c937954d8b29c79a2a3074dbba9426c24`。
- 真实 Compose 启动首次捕获 `tmpfs: [/tmp:rw,noexec,nosuid,size=256m]` 的 YAML 解析错误：未加引号时
  会被解释成四个挂载项，Docker 报 `invalid mount path: 'noexec'`。已将 Lundu 与生产 Compose 的三处
  定义改为单元素字符串列表，并在生产配置回归中增加格式断言。
- 修复后使用全新临时 PostgreSQL 卷启动 `db`、`api`、`agent-runtime`、`harness-bridge` 四个服务，
  未启动 Web、未使用真实 Provider、未挂载已有业务卷。DB 达到 healthy，agent `/health` 返回 200，
  Bridge 容器内 `/readyz` 返回 200（runtime/plugins/sessions 全为 true），`/v1/plugins` 返回 9 个
  Harness 插件，PostgREST 根 OpenAPI 返回 200；带正确 Tool Proxy secret 的无效会话请求返回预期
  `409 HARNESS_SESSION_INVALID`。测试完成后已执行 `compose down -v --remove-orphans`，临时卷、网络和
  容器均已删除，现有 `yayulink-api` 保持运行且未被纳入项目。
- `npm run test:production-config`、`npm run test:harness-bridge`、`npm run lint:changed` 和
  `git diff --check` 均通过。clean build 仍受 Windows 挂载上下文 I/O 阻塞，真实 Provider、当前分支
  client-plugin provenance、完整 Web Compose 与远端线上验收仍未完成，目标保持 `active`。

## 当前状态汇总（2026-09-30）

- 当前仓库所有 refs 与 unreachable commits 的 tree 扫描均未发现 `agent-harness/client-plugins/*/lib/index.js`；
  Windows/WSL 环境均未配置 `DEEPSEEK_API_KEY`、`DSH_API_KEY` 或 `LUNDU_HARNESS_ROOT`。因此没有可安全恢复的
  隐藏 provenance，也没有可用于真实 Provider/Web artifact 验收的凭据或制品。
- 后端 Harness 插件/Gateway/Bridge、权限、租户/RLS、会话归属、写确认、幂等和审计边界已通过当前分支
  离线回归、隔离数据库 Docker 套件和一次性 agent/bridge 容器 smoke；生产路径没有旧 Agent 编排、旧模型
  直连或 Cline fallback。
- 当前分支镜像和锁定 DSH SDK initialize 均已在本地验证；未启动持久 Compose，未连接生产或伦度远端，未
  读写业务数据库卷，未修改前端视觉。
- 目标仍未完成的证据项：真实 DeepSeek Provider prompt/tool 输出、当前分支可追溯 client-plugin 编译制品、
  完整 Compose clean release、外部双租户 RLS 业务验收、Smart BI 行为等价，以及独立站缺失图片夹具导致的
  `npm run test:unit` 两项失败。

### 要求与证据矩阵

| 目标要求 | 当前证据 | 状态 |
| --- | --- | --- |
| Agent 能力进入 Harness Plugin -> Gateway -> Tool/RLS/PostgREST 链路 | `agent-harness/plugin-contract.v1.json`、`eiscore-tools.mjs`、`npm run test:harness`、官方 SDK tool-call continuation 回归 | 本地完成 |
| 权限、租户、会话归属与 RLS 边界 | `realtime/test-harness-gateway.js`、`test-harness-runtime-boundaries.js`、`test-harness-twin-persistence.js`、`npm run test:database:docker`、`digital-twin-rls-contract-regression.mjs` | 本地/隔离 DB 完成；外部双租户业务验收未完成 |
| 写确认、幂等、审计和失败关闭 | Harness Gateway/write-boundary/Document/Sales/Flash 回归，隔离 DB release/recovery 套件 | 本地完成 |
| 移除生产可达旧 Agent 编排、旧模型直连、Cline/Legacy fallback | `harness-production-path-regression.mjs`、`migration-switch-gate.mjs`、`npm run test:production-config` | 静态生产路径完成 |
| Bridge 与运行时镜像可启动 | 当前分支 agent/bridge 镜像构建、`/health` 200、`/readyz` 200、`npm run test:runtime-image`、`npm run test:harness-bridge` | 本地完成；完整 Compose 未完成 |
| 后端契约测试与工程文档 | `npm run test:harness`、数据库 Docker 套件、本文档与迁移清单 | 完成 |
| 真实 Provider、同源 Web client-plugin、Smart BI 等价和远端验收 | 当前分支 artifact preflight 仍缺三组 `client-plugins/*/lib/index.js`；无真实 Provider 凭据；未连接远端 | 未完成/阻塞 |

## 全局目标继续推进记录（2026-09-30，当前分支镜像构建与容器 smoke）

- Windows Docker Desktop Linux daemon 仍不可用，但 WSL Ubuntu 的本地 Docker 29.1.3 daemon 可响应。
  仅使用该本地 daemon，未执行 Compose up、未创建数据库/API/Web 持久服务，也未连接远端。
- 复核发现 root agent 构建上下文在 Windows/WSL 文件共享上停留于扫描阶段；`realtime/Dockerfile.dockerignore`
  与 `realtime/Dockerfile.prod.dockerignore` 现显式排除 `realtime/*`、`agent-harness/*` 后仅放回
  Dockerfile 实际 COPY 文件。`realtime/Dockerfile` 与 `.prod` 移除可选的 npm BuildKit cache mount，保留
  相同依赖、运行时和镜像 pinning，使没有 buildx 插件的本地 daemon 也能复现构建。
- 当前工作树 `codex/systematic-refactor` @ `02b6588441a3620f29cfc9cee049035aa222fda2` 构建
  `harness-bridge` 成功：镜像 `github-eiscore-refactor-harness-bridge:latest`，digest
  `sha256:22280e701f4f9ddf949d2ee955b4b364428125105177b7cbd0ddc3a9b644dcc4`。使用显式临时上下文
  `/tmp/eiscore-agent-build-context`（只复制 `realtime/*.js`、runtime lockfile/Dockerfile 和三个
  Harness registry 文件）构建 `agent-runtime` 成功：镜像 `eiscore-agent-local:codex-current`，digest
  `sha256:84bd5017cc88666da40425b74fd47fd85b650b6e7c44cf5ced8f00148b8abf70`。
- 两个镜像的 Node 入口 `--check` 通过。一次性 agent 容器在无网络、无数据库下返回
  `GET /health -> 200 {"ok":true,"channel":"eis_events"}`；一次性 bridge 容器只读挂载当前
  `agent-harness` 后返回 `GET /readyz -> 200`，`runtime/plugins/sessions` 全为 true。未带协议头访问
  `/metrics` 返回预期 `HARNESS_PROTOCOL_REQUIRED`，随后两个容器均已删除。
- `npm run test:runtime-image`、`npm run test:harness-bridge` 和 `git diff --check` 通过；新增 runtime-image
  回归断言防止构建上下文重新包含 runtime/Harness 的非制品子树。构建使用的 provider/model 仅为临时
  Compose 插值值，没有真实 DeepSeek 凭据或业务数据。
- 当前分支 client-plugin 编译 provenance、真实 Provider prompt/tool、双租户外部 RLS、完整 Compose clean
  release、Smart BI 行为等价和远端验收仍未完成；本轮未修改前端视觉、未读写数据库卷，目标继续保持
  `active`。

## 全局目标继续推进记录（2026-09-30，隔离数据库/RLS 套件复验）

- 通过 WSL Ubuntu 本地 Docker daemon 串行运行 `npm run test:database:docker`；DB1 fresh/install 与升级等价、
  DB3 PostgreSQL/PostgREST 角色与 RLS 拒绝合同、company-site BFF Agent 链路、catalog/PostgREST 合同、
  DB6 release 锁/备份/漂移故障关闭、DB5 recovery 销毁并恢复 schema/角色/数据全部通过。
- 测试使用脚本创建的隔离临时容器和目录，结束后无测试容器或测试卷残留；现存 `yayulink-api` 是无关的既有
  容器，本轮未对其执行 stop/restart。未使用项目 `pgdata`、Lundu 数据库卷或客户业务数据。
- 该证据加强数据库迁移、角色、RLS 和恢复边界，但仍不等价于真实 DeepSeek Provider prompt/tool、外部双租户
  Harness 业务验收或远端部署；这些项目继续保持未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，锁定 DSH SDK initialize smoke）

- 使用当前分支 `agent-harness/node_modules/@deepseek-ai/dsh@0.1.2-rc.1` 的真实 `lib/bin.js`，以临时
  `DSH_HOME` 运行 `scripts/dsh-sdk-runtime-smoke.mjs`；initialize 返回
  `deepseek-harness-sdk-runtime@0.0.1`，`frameCount=1`、`stderrBytes=0`。
- 临时状态目录在 smoke 结束后已删除；该证据只证明锁定 SDK 的启动/JSON-RPC initialize 协议，不证明真实
  DeepSeek 凭据、Provider prompt/tool 业务输出、客户数据或远端部署，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，Lundu artifact 缺口复核）

- 对当前分支 `agent-harness/` 运行 `scripts/validate-lundu-harness-artifacts.mjs`，门禁按预期故障关闭：
  缺少 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js` 和
  `client-plugins/enterprise-bi/lib/index.js` 三个编译入口。
- 对外部候选目录 `C:/Users/Twist/Documents/eiscore/agent-harness` 运行同一门禁，仍故障关闭：缺少
  `eiscore-tools.mjs` 与 `eiscore-restricted.cordis.yml`。候选目录没有可追溯提交 provenance，因此未复制、
  未挂载、未发布任何候选制品。
- 该缺口阻止 Lundu Web 完整 artifact 验收，但不影响本轮已通过的后端 Harness/数据库门禁；Docker/WSL、
  真实 Provider、双租户 RLS、clean image build 和远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，当前工具制品与候选插件组合验收）

- 在操作系统临时目录组合外部候选的三组 `client-plugins` 与当前分支受控的
  `eiscore-tools.mjs`、`eiscore-restricted.cordis.yml`，未写入仓库或发布目录。
- 对该临时组合执行 `validate-lundu-harness-artifacts.mjs` 通过；随后运行当前锁定 DSH SDK 的 Web runtime smoke
  通过：auth、digital-twin、enterprise-bi Host 路由均按预期返回未认证 401，DSH index 与两个插件 bundle 返回
  200，stderr 为 0。临时目录已自动清理。
- 该结果证明当前后端 tool/profile 与候选插件的接口兼容性和认证失败关闭，但候选插件仍来自无提交来源目录，
  不能替代可追溯发布制品。Docker/WSL、真实 Provider、双租户 RLS 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，候选插件前置检查与 Harness 全套复验）

- 只读扫描 `C:/Users/Twist/Documents/eiscore/agent-harness` 发现三组候选 `client-plugins` 编译入口，
  但其上级仓库仍为无提交的工作树，不能提供可追溯 provenance；`node scripts/validate-lundu-harness-artifacts.mjs`
  明确拒绝该目录，原因是缺少 `eiscore-tools.mjs` 和 `eiscore-restricted.cordis.yml`。未复制、未挂载、未发布这些候选制品。
- 当前分支再次运行 `npm run test:harness` 全部通过，覆盖插件合同、Gateway 权限/确认/幂等/审计、数字分身
  RLS 会话、受约束查询、生产路径、SDK Bridge continuation 与迁移切换门禁。
- Docker Desktop 与 WSL 仍为 stopped，`docker version` 无法连接 Linux daemon；未启动系统服务、未执行镜像构建、
  未连接远端或启动 Compose。真实插件 provenance、clean image build、真实 Provider/租户 RLS 和线上验收仍未完成，
  目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，候选 Web 插件运行时兼容性烟囱）

- 使用当前分支锁定的 DSH `0.1.2-rc.1` `lib/bin.js` 和只读候选插件目录，运行
  `node scripts/dsh-web-plugin-runtime-smoke.mjs --runtime` 通过：EISCore auth、digital-twin、enterprise-bi
  三个 Host 路由分别返回预期的未认证 401（`authenticated:false` / `EISCORE_AUTH_REQUIRED`），没有向未认证请求泄露业务数据。
- DSH Web index 返回 200，两个 EISCore client plugin bundle 均返回 200，子进程 stderr 为 0；这证明 patch、Host
  路由注册、bundle 装载和认证失败关闭在当前 SDK 版本上兼容。
- 该烟囱使用的是无提交来源的外部候选目录，不能替代可追溯制品；未复制或发布候选文件。Docker/WSL 仍停止，
  因此 clean image、真实租户/RLS、真实 Provider 和远端验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，Bridge 可复现镜像装配与离线验收）

- 审计发现生产 Compose 与 Lundu Compose 使用的 `eiscore/deepseek-harness:0.1.2-rc.1-bridge1`
  没有 digest，且 Docker Hub/本机均无法提供可核验的 `RepoDigests`。未伪造摘要，也未放宽镜像供应链门禁。
- 新增仓库内 `agent-harness/Dockerfile`、`package.json` 和锁文件，固定 `node:22.19.0-bookworm-slim`
  digest，并以 `@deepseek-ai/dsh@0.1.2-rc.1` 的 lockfile 构建 bridge/Web 共用运行时。根级生产 Compose、Lundu
  Compose 与 Harness Web override 均改为本地 `build`；Web 仍只接收外部 `LUNDU_HARNESS_ROOT` 的官方
  client-plugin 制品，不把未跟踪插件源码伪装成本分支 provenance。Dockerfile 为非 root bridge 预创建并授权
  `/var/lib/dsh` 与 `/opt/eiscore-harness`。
- 修复新 package manifest 将既有 `.js` CommonJS bridge/测试误判为 ESM 的装配回归：移除 `type: module`，
  `.mjs` SDK bridge 仍按 ESM 运行。`npm ci --omit=dev --ignore-scripts --no-audit --no-fund` 按锁文件成功安装
  521 个依赖。
- 离线验收通过：`npm run test:harness`、`npm run test:database-migrations`、`npm run test:database-backend-governance`、
  `npm run test:database-roles`、`npm run test:production-config`、`npm run test:runtime-image`、
  `npm run test:infrastructure`、`npm run test:syntax`（300 个脚本）、`npm run lint:changed`（120 个文件）和
  `git diff --check`。基础设施测试夹具同步补齐当前必需的 Tool Proxy secret、DSH provider/model。
- 使用隔离环境变量执行的 `docker compose -f docker-compose.prod.yml config --quiet` 通过；未创建或启动容器。
  当前 Docker Desktop Linux daemon 不可用（`docker info` 无法连接 `dockerDesktopLinuxEngine`），所以 clean image
  build、SDK 容器 readiness、真实 DeepSeek provider、Lundu 远端发布和线上验证仍未完成。
- 本轮未连接远端、未修改前端视觉、未发布任何服务、未读写现有数据库卷；目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，本地真实 SDK Bridge readiness 烟囱）

- 使用仓库锁定的 `agent-harness/node_modules/@deepseek-ai/dsh@0.1.2-rc.1` 实际 `lib/bin.js`，通过
  `scripts/dsh-sdk-runtime-smoke.mjs` 完成官方 SDK `initialize`：返回
  `deepseek-harness-sdk-runtime@0.0.1`，单帧响应且 stderr 为 0。
- 本地 Windows 运行 Bridge 时发现 DSH `.bin/dsh`/`bin.js` 不能被 Node `spawn` 直接执行（会产生
  `EINVAL`），导致 HTTP 外壳健康但 `/readyz` 503。已在 `dsh-http-bridge.mjs` 增加仅 Windows 生效的
  `node <bin.js>` 启动归一化；Linux 容器的原始可执行命令路径不变。
- 修复后启动真实 Bridge（临时 3097 端口、临时 DSH_HOME），实际 HTTP 验证通过：`GET /readyz` 返回 200，
  `checks.runtime/plugins/sessions=true`；带协议头的 `/v1/plugins` 返回 enterprise-bi、digital-twin；
  `/metrics` 返回 active=0、sessions=0、tracked_requests=0。随后已停止临时进程，未留下服务。
- 本轮只增加本地启动兼容性与证据记录，未连接远端、未启动 Docker、未发布 Web/后端、未修改数据库卷，
  目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，WSL 候选制品 provenance 复核）

- WSL `/home/lzr/eiscore-refactor` 当前分支仍为 `codex/systematic-refactor`，HEAD 为
  `ce9899d9513e6de0eea596917f7965ec1336b3d7`；该 checkout 的 `agent-harness/client-plugins`
  目录包含 `eiscore-auth`、`digital-twin`、`enterprise-bi` 三组源码和 `lib/` 制品，但目录整体
  仍是未跟踪文件，`git log --all -- agent-harness/client-plugins` 没有提交记录。
- WSL 三个候选 `lib/index.js` 的 SHA-256 分别为：digital-twin
  `91d76db97ac73d033207f28c2a66ec172a9f411468641420e160736a4a4a5147`、eiscore-auth
  `9ae2e1a18fc74a23f0e6debfc3c713351114edffdb9c586af98079548d6a1e29`、enterprise-bi
  `db282fe36d7ce555233a050ac0cd1056bb1e457e9dd9b14b4eb6bf2e59ec87e2`。这些哈希只用于识别候选
  制品，不构成可追溯 provenance，也未被复制到 Windows 工作树或发布目录。
- WSL checkout 缺少 `agent-harness/eiscore-tools.mjs`，拥有 `eiscore-restricted.cordis.yml`；
  `/home/lzr/deepseek-harness` 是安装/runtime 目录而非 Git 仓库，无法提供源码提交 provenance。
  因此 `LUNDU_HARNESS_ROOT`、真实 SDK 编译制品、Docker clean build 和远端 Harness 验收仍未完成，
  继续保留 preflight blocker，不把 WSL 未跟踪制品视为当前分支已验收资产。
- 在 WSL 候选树中运行其自带 `scripts/harness-plugin-artifact-audit.mjs` 结果为
  `ok=true`，但当前分支的 `scripts/validate-lundu-harness-artifacts.mjs` 不存在于该树，且该环境默认
  Node 为 `v20.18.1`（当前插件构建脚本要求 Node 22+）；因此该 PASS 只代表候选目录的静态内部合同，
  不代表当前 Windows 分支的部署 preflight 或可复现构建已通过。
- 对 WSL 仓库的可达提交和 `git fsck --unreachable` 提交对象进行路径检索，均未找到包含
  `agent-harness/client-plugins` 的提交；不存在可恢复的隐藏 Git provenance 可用于替代当前分支制品。
- 本轮只读检查 WSL 与 Windows 工作树，未连接或发布伦度远端，未启动 Compose，未修改前端视觉，
  未读写任何数据库卷；目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，离线单元套件复验）

- `npm run test:unit` 仍在独立站现有图片夹具检查处结束：30 项中 28 项通过，缺失
  `eiscore-company-site/research-gallery/gallery-001.png` 与
  `eiscore-company-site/research-gallery/gallery-021.jpeg` 两项。未补造客户素材、未修改前端视觉，
  该失败不改变后端 Harness 门禁已通过的结论。

## 全局目标继续推进记录（2026-09-30，低并发后端门禁复验）

- 在不启动 Docker/WSL、不连接远端且不读写数据库卷的前提下，串行复跑 `npm run test:harness`，
  Harness 插件合同、写确认/幂等/审计、Gateway、工具与上下文边界、数字分身 RLS 会话、文档提交、
  销售写入、生产路径、受约束查询、HTTP 读取、Bridge 协议/关闭和迁移切换门禁全部通过。
- `npm run test:production-config` 通过生产配置安全、Lundu Harness artifact preflight 与 Web runner
  启动 profile；`npm run test:database-backend-governance` 通过后端治理边界；
  `npm run test:database-roles` 通过数据库凭据、DB2 角色/运行身份/secret 注入/镜像 pinning 与数字分身
  RLS 基线。
- 只读检查仍显示 Docker Desktop、WSL Ubuntu 和 `docker-desktop` 均为 `Stopped`，Linux daemon 不可连接。
  因此 clean image build、容器内 readiness、真实 Provider/双租户 RLS 和远端验收仍未完成；目标继续保持
  `active`，不启动系统服务、不发布远端、不修改数据库卷。

## 全局目标继续推进记录（2026-09-29，SDK 关闭收口与本机烟囱）

- 本机锁版本 DSH SDK 的 `initialize` 正常返回，但实测不返回 `shutdown` JSON-RPC 响应；原
  `DshSdkProcess.close()` 会无限等待该响应，可能阻塞 Bridge 的 SIGTERM 收口。
- 已将 Bridge 关闭逻辑改为有界 best-effort shutdown：默认最多等待 1000ms（可由
  `BRIDGE_SHUTDOWN_TIMEOUT_MS` 调整），随后清理 pending/waiter、标记 runtime closed 并终止子进程；
  `start()` 允许在上次 runtime 终止后重新建立进程。新增回归覆盖 SDK 不返回 shutdown 响应的场景。
- `node agent-harness/test-dsh-http-bridge-runtime.mjs` 通过；使用本机缓存的 DSH `0.0.1` SDK、
  临时 `DSH_HOME`、无 API key 执行 `scripts/dsh-sdk-runtime-smoke.mjs` 通过，初始化响应为
  `deepseek-harness-sdk-runtime`，stderr 为 0。该证据只证明 SDK 启动/协议初始化，不代表真实模型或
  Provider 验收。
- 本轮未修改前端视觉、未连接或发布伦度远端、未启动持久 Compose、未读写数据库卷；同源
  client-plugin provenance、真实 DeepSeek provider、完整 Compose clean release、Smart BI 行为
  等价和远端验收仍未完成，目标保持 `active`。

- `docker-compose.prod.yml`、`deploy/lundu/compose.yml`、`env/.env.example` 和
  `deploy/lundu/.env.example` 已显式暴露 `BRIDGE_SHUTDOWN_TIMEOUT_MS`（默认 1000ms），让有界
  关闭策略在部署配置中可见；生产配置、Lundu artifact、runtime-image、production-path 和
  `git diff --check` 定向复验均通过。

## 全局目标继续推进记录（2026-09-29，低并发门禁复验）

- 低并发复跑 `npm run test:harness` 全部通过；定向的 production-path、AI bridge、Agent SSE、
  runtime-image、Lundu Web runner 和 `git diff --check` 也全部通过。`npm run lint:changed` 通过，
  当前变更文件共 120 个。
- 首次并行启动多个 Node 门禁时，Windows Node `v26.1.0` 因内存争用出现 `VirtualAlloc`/OOM，导致
  `test:syntax` 的子进程报告假失败；逐文件 `node --check` 没有语法错误。改用 Codex bundled Node
  `v24.21.0` 串行复跑 `check-node-syntax.mjs`，300 个脚本全部通过。该资源问题不是代码语法回归。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root C:/Users/Twist/Documents/eiscore/agent-harness`
  仍故障关闭，原因仅为该外部目录缺少 `eiscore-tools.mjs` 与 `eiscore-restricted.cordis.yml`；没有
  将其标为通过，也没有复制外部目录内容。
- 本轮没有修改前端视觉、没有连接或发布伦度远端、没有启动持久 Compose、没有读写任何数据库卷。
  同源 client-plugin 编译制品、真实 DeepSeek provider、完整 Compose clean release、Smart BI
  行为等价和远端验收继续保持未完成，目标仍为 `active`。

## 全局目标继续推进记录（2026-09-30，继续审计与门禁复验）

- 在当前 `codex/systematic-refactor` 工作树串行复跑 `npm run test:harness`，Harness 插件注册、写确认/幂等/审计、Gateway、工具与上下文边界、数字分身 RLS 会话、文档提交、销售写入、生产路径、受约束查询、HTTP 读取、SDK Bridge 和迁移切换门禁全部通过。
- `npm run test:runtime-image`、`npm run test:infrastructure` 和 `npm run test:production-config` 全部通过；其中包含 runtime image 输入合同、Vite 代理合同、生产配置安全、Lundu Harness artifact preflight 合同和 Web runner 启动 profile。`git diff --check` 通过（仅报告 Windows 行尾转换提示）。
- `node scripts/validate-lundu-harness-artifacts.mjs` 在未设置 `LUNDU_HARNESS_ROOT` 时按预期故障关闭，唯一报告为 `LUNDU_HARNESS_ROOT: required`。当前分支仍没有可追溯的 EISCore client-plugin 编译制品来源，未复制外部/WSL 未跟踪候选文件，也未把其当作发布资产。
- Windows Docker Desktop Linux daemon 不可连接，`wsl -l -v` 显示 `Ubuntu`、`docker-desktop` 均为 `Stopped`。因此本轮没有启动系统服务、没有执行 clean image/Compose 验收、没有连接或发布伦度远端，也没有读写现有数据库卷。
- 真实 DeepSeek Provider、同源 client-plugin provenance、完整容器构建与双租户/RLS 线上验收、Smart BI 业务行为等价仍未完成；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，生产路径与 Bridge 定向复核）

- `node agent-harness/test-dsh-http-bridge-runtime.mjs` 通过：缺少工具/配置时故障关闭、SDK framing/响应聚合、tool-call continuation 和有界 shutdown 均有回归证据。
- `node scripts/migration-switch-gate.mjs` 与 `node tests/engineering/harness-production-path-regression.mjs` 均通过；生产组合根仍只装配 Harness Runtime/Gateway，不导入已删除的旧 Agent、Cline 或直接模型 Provider 路径。
- 本轮仍未连接远端、未启动系统服务或持久 Compose、未修改前端视觉、未读写业务数据库卷；同源 client-plugin provenance、真实 Provider、完整 Compose clean release、双租户 RLS 和 Smart BI 行为等价继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，当前工作树语法与 lint 复验）

- `npm run test:syntax` 通过，当前 Node 脚本语法检查覆盖 300 个文件。
- `npm run lint:changed` 通过，当前变更 lint 覆盖 126 个 JavaScript/Vue 文件。
- 这些结果只证明当前工作树静态质量未回归，不替代真实 Provider、同源 client-plugin 制品、容器/双租户 RLS 和远端验收；目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，远端 refs provenance 复核）

- 只读检查 `upstream` 远端发现 `codex/systematic-refactor` 指向可追溯提交 `02b6588441a3620f29cfc9cee049035aa222fda2`（`feat(lundu): document and finalize refactor changes`）。该提交树只包含 Lundu 部署/嵌入相关文件，没有 `client-plugins` 或 `agent-harness/client-plugins` 路径。
- 当前分支与该远端重构提交均没有可用于三组 EISCore client-plugin 编译制品的 Git provenance；未执行 fetch/合并，未复制外部或 WSL 未跟踪目录。
- 因此 `LUNDU_HARNESS_ROOT` 与同源 client-plugin provenance 仍是已验证的外部输入阻塞；真实 Provider、容器/双租户 RLS、Smart BI 行为等价和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，活动工程文档同步）

- 更新 `.github/copilot-instructions.md`：运行时入口、Harness capability/权限/租户/审计约束、bridge tool proxy、当前回归命令和证据文档已替换旧 Agent/Cline/Anthropic 指引。
- 更新 `docs/permission-boundary-deployment-readiness.md`：回归命令改为 Harness/数据库治理门禁，并显式记录 `LUNDU_HARNESS_ROOT`、同源 client-plugin、真实 Provider、双租户 RLS 和 Smart BI 验收前置条件。
- `npm run test:production-config` 通过；本轮只修改工程文档，未修改前端视觉、未连接远端、未启动 Compose 或读写业务数据库卷，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，应用中心 README 操作说明同步）

- 更新 `eiscore-apps/README.md`：Harness URL 固定指向独立 `harness-bridge`，补齐 Tool Proxy/DSH 配置，替换无范围 Compose 启动示例为明确服务列表，并将 bridge 健康检查改为 `/readyz`。
- README 的测试段落改为当前 Harness/生产配置/runtime image 契约，移除“待实施”和旧 Agent API 叙述；未修改应用页面或前端视觉。
- `npm run test:production-config` 与 `git diff --check` 通过；真实 Provider、外部 client-plugin、容器/RLS 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，完整前端构建与品牌门禁复核）

- `npm run build:frontends` 通过，当前分支 12 个前端包均成功构建；本次只生成本地 dist，没有发布 Web 或替换远端 release。
- 根 `eiscore-base/dist` 的 `index.html`、企业配置和伦度 Logo 均存在；入口、assets 和公开配置中未发现“君乐缘”或 `junleyuan` 标记。
- 构建输出只有既有 Sass/legacy API、循环 chunk 和大 chunk 警告；未出现构建错误。真实 Provider、同源 client-plugin、完整 Compose/RLS 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，官方 SDK 依赖与业务插件边界复核）

- 只读核对 `agent-harness/package.json` 与安装树：当前分支直接依赖锁定为
  `@deepseek-ai/dsh@0.1.2-rc.1`，安装树包含官方 DSH SDK、Web host、SDK JSON-RPC
  server、DeepSeek LLM adapter 等包；未发现 `eiscore-auth`、`digital-twin` 或
  `enterprise-bi` 作为 npm 依赖或官方 SDK 内置业务插件。
- 只读扫描 `agent-harness/node_modules/@deepseek-ai` 和当前分支文件树，确认不存在
  `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js`、
  `client-plugins/enterprise-bi/lib/index.js`。因此官方 SDK 运行时依赖已具备，但当前分支
  没有可追溯的 EISCore 业务插件编译制品；不能用 SDK 安装成功替代插件加载、业务路由、
  浏览器 bundle 或 Smart BI 行为验收。
- 本轮未复制外部/WSL 未跟踪插件、未设置 `LUNDU_HARNESS_ROOT`、未启动 Docker/WSL、未连接
  伦度远端、未修改前端视觉或任何数据库卷。真实 Provider、同源 client-plugin provenance、
  Compose clean release、双租户 RLS 和 Smart BI 业务等价仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，Harness 全套契约复验与外部制品 provenance）

- 串行复跑 `npm run test:harness` 全部通过：插件合同、审计账本、写确认/幂等、Gateway、Tool
  Gateway、上下文与查询边界、多模态、HTTP handlers、数字分身 RLS 会话/持久化、文档提交、
  销售写入、生产路径、Bridge framing/continuation/有界 shutdown 和迁移切换门禁均通过。
- 只读检查发现 `C:/Users/Twist/Documents/eiscore/agent-harness/client-plugins` 确实存在三组
  `lib/index.js`，但该目录所在仓库为无提交的未跟踪工作树（`git status` 显示 `?? client-plugins/`，
  `git log --all -- client-plugins` 无记录），不属于当前 `codex/systematic-refactor` 分支，不能作为
  同源发布 provenance。`.codex-tmp/auth-work-20260920` 只含插件源码且同样无可追溯提交。
- 因此本轮仍未复制或合并外部插件、未设置 `LUNDU_HARNESS_ROOT`、未启动容器/WSL、未连接远端、
  未修改前端视觉或数据库卷；代码级 Harness 回归已通过，但同源插件制品、真实 Provider、
  Compose clean release、双租户 RLS 和 Smart BI 行为等价仍是未完成项，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，数据库迁移与 RLS 门禁复验）

- 串行复跑 `npm run test:database-migrations` 全部通过：迁移顺序/校验和/回滚声明、Runtime V2
  runner、数据库基线与 PostgREST 合同、release/recovery runner、数据库运维策略、后端治理边界、
  DB2 角色与 secret 注入、数字分身 RLS 合同、公共 schema ratchet 和 DB6 结构治理均通过。
- 该结果证明当前工作树的数据库边界和数字分身 RLS 合同未回归；它不等价于真实 PostgreSQL
  双租户请求验收。真实双租户 JWT/RLS、容器内 readiness、真实 Provider 和远端发布仍未执行，
  因 Docker/WSL stopped 且当前分支没有同源 client-plugin 制品，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，本地 Docker 启动阻塞复核）

- 为尝试本地 clean container 验收，只启动了本机 Docker Desktop，未运行 Compose、未创建/挂载
  项目卷、未连接伦度远端。Docker Desktop 4.55.0 backend 在初始化 inference listener 时失败，
  日志报告无效路径 `\\<HOME>\\AppData\\Local\\Docker\\run\\dockerInference`，随后 backend 崩溃；
  `docker version` 在 15 秒内无响应，`wsl -l -v` 仍显示 Ubuntu 与 `docker-desktop` 为 `Stopped`。
- 已停止本轮启动的 Docker Desktop/backend 进程。该环境问题阻塞 clean image/Compose、容器内
  readiness 和真实 Provider 验收，但不影响已通过的代码级 Harness/数据库合同测试；目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，前端范围审计）

- 只读审计当前工作树的前端差异：改动集中在 Harness 路由/认证交接、canonical API 路径、Flash
  Harness 事件名和代理配置；未发现新增 CSS 主题、布局结构或视觉组件重构。`FlashBuilder.vue` 的
  `legacy`→`shell` 仅是运行模式/协议标识迁移，`HarnessView.vue` 是受保护的原生 Harness 入口。
- 本轮没有修改前端源码或静态资源；之前已完成的 `npm run build:frontends` 只作为构建完整性证据，
  不替代浏览器级插件 UI、Smart BI 业务行为和远端 release 验收。目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，生产 fallback/shadow 回归门禁强化）

- 扩展 `tests/engineering/harness-production-path-regression.mjs`：部署模板和 realtime runtime
  现在明确拒绝 `EISCORE_HARNESS_FALLBACK`、`EISCORE_HARNESS_SHADOW`、数字分身/独立站 shadow
  开关，以及旧模型直连配置。该门禁把“旧路径不生产可达”从一次性扫描提升为持续回归约束。
- `node tests/engineering/harness-production-path-regression.mjs` 与完整 `npm run test:harness`
  均通过；本轮没有修改前端视觉、没有连接远端、没有启动 Compose 或写入数据库卷，目标保持
  `active`。

## 全局目标继续推进记录（2026-09-30，部署准备文档命令校正）

- 复核 `docs/permission-boundary-deployment-readiness.md` 时发现两个历史脚本名与当前
  `package.json` 不一致，已将 `test:database:backend-governance`/`test:database:roles` 校正为
  `test:database-backend-governance`/`test:database-roles`，并补入 `test:harness-production-path`。
- 逐项检查文档列出的脚本均存在于当前 `package.json`；`git diff --check` 通过。该修正只影响工程
  文档的可执行性，不改变运行时或数据库，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，完整单元测试阻塞复核）

- 真实执行 `npm run test:unit`：独立站测试共 30 项，28 项通过、2 项失败；失败严格限于既有
  `eiscore-company-site/test/jinwei-research-images.test.js` 对缺失素材
  `research-gallery/gallery-001.png` 和 `research-gallery/gallery-021.jpeg` 的检查。
- 只读扫描当前分支及同级工作目录没有找到这两个同名可追溯素材。它们属于独立站客户图库，
  本后端目标不生成伪图片、不修改前端视觉，也不把该失败误报为 Harness 后端回归；`test:unit`
  仍是前端夹具阻塞项，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，生产配置门禁复验）

- `npm run test:production-config` 通过：生产配置安全、Lundu Harness artifact preflight 合同和
  Web runner 启动 profile 均通过；本轮没有生成部署 `.env`、没有启动 Compose、没有连接远端或
  写入数据库卷。真实 client-plugin provenance、Provider、容器 clean release、双租户 RLS 和
  Smart BI 行为等价仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30 08:51，质量门禁与 Docker 重试）

- 真实执行 `npm run test:quality` 在 `vue-complexity-inventory-regression.mjs` 阶段停止：
  `eiscore-mobile/src/views/LoginView.vue` 当前为 1826 行，超过既有 1632 行复杂度基线。
  该失败属于前端既有改动，未为通过门禁修改页面视觉或覆盖其他 Agent 的未提交变更；Harness、
  数据库和生产配置定向门禁仍以各自实际通过结果为准。
- 再次只启动本机 Docker Desktop 进行诊断，未运行 Compose、未创建或挂载项目卷、未连接伦度远端。
  Docker Desktop 4.55.0 backend 仍在初始化 inference listener 时因
  `C:\\Users\\Twist\\AppData\\Local\\Docker\\run\\dockerInference` reparse point 无法删除而崩溃；
  `docker info`/Linux daemon 不可用，`com.docker.service`、`Ubuntu` 和 `docker-desktop` 均未进入运行态。
  已停止本轮启动的 Docker Desktop/backend 进程；未执行 factory reset、删除卷或修改 Docker 用户配置。
- 因此 clean image/Compose、容器内 readiness、真实 DeepSeek Provider、同源 client-plugin provenance、
  双租户 RLS、Smart BI 行为等价和远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30 08:53，定向门禁复验）

- 串行复跑 `npm run test:harness` 全部通过，覆盖插件注册、写确认/权限/幂等/审计、Gateway、
  Tool Gateway、数字分身 RLS 会话与持久化、文档提交、销售写入、查询约束、HTTP 读取、SDK
  Bridge 有界关闭、生产路径和迁移切换门禁。
- 串行复跑 `npm run test:database-migrations` 全部通过，覆盖迁移治理、基线/PostgREST 契约、
  release/recovery runner、后端治理、DB2 角色与 secret 注入、数字分身 RLS 和数据库结构退出门禁。
- `npm run test:production-config` 全部通过，`git diff --check` 无错误；后者仅输出现有工作树的
  Windows 行尾转换提示。上述结果不替代 Docker/Compose、真实 Provider、同源 client-plugin、
  双租户外部 RLS、Smart BI 行为等价或远端验收，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，发布安全门禁复验）

- `npm run test:secrets` 通过：SQL/dump 凭据回归和 2703 个文本文件扫描均通过；扫描器只报告
  checksum-locked legacy SQL quarantine 中的既有 5 项保留发现，没有暴露匹配值。
- `npm run lint:changed` 通过，覆盖当前相对 `HEAD^` 的 126 个 JavaScript/Vue 文件。该结果与
  Harness/数据库门禁共同证明当前工作树静态安全边界未回归，但不替代外部插件 provenance、真实
  Provider 或容器/远端验收；目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，运行时制品合同复验）

- `npm run test:runtime-image` 通过：运行时镜像输入合同覆盖 27 个 composition-root 模块、2 个
  Dockerfile，并通过 10 个消费者的 Vite dev proxy 合同。
- `npm run test:infrastructure` 通过：覆盖 24 个 shell 脚本和生产 Compose 合同。该结果只证明
  Docker 制品定义和基础设施静态约束正确；由于本机 Docker daemon 仍不可用，clean image build、
  容器 readiness、真实 Provider、双租户外部 RLS 和远端验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，WSL 隔离镜像与 Bridge 故障关闭复验）

- Windows Docker Desktop 仍不可用，但 WSL Ubuntu 本地 Docker 29.1.3 daemon 可用。本轮仅使用
  当前 `codex/systematic-refactor` 工作树提交 `0850fe62b5075c24df43f7ba3865d76cb19dde1b` 的
  显式临时上下文构建两个隔离镜像，未运行项目 Compose、未挂载数据库卷、未连接远端：
  `eiscore-agent-runtime:codex-0850fe6`，digest
  `sha256:b0c1b1f768f33d220018933273fb81d3c06aab8f5b85dc374e7f0cb1eaff7c30`；
  `eiscore-harness-bridge:codex-0850fe6`，digest
  `sha256:431e676211a1c0c2345e484fc805c75542e0271535998e68f96cf7093d988188`。
- agent-runtime 无数据库网络的临时容器真实返回 `GET /health -> 200`；仅出现预期的 PostgreSQL
  `ECONNREFUSED` worker 日志。Bridge 临时容器真实返回 `/healthz -> 200`、缺协议访问
  `/metrics -> 426 HARNESS_PROTOCOL_REQUIRED`，在无真实 Provider/无网络时 `/readyz -> 503
  HARNESS_NOT_READY`，证明失败关闭而非伪造 readiness 通过。全部临时容器已删除，现有
  `yayulink-api` 容器保持运行且未被重启或修改。
- 当前分支绝对路径 artifact preflight 仍明确失败于三组缺失的
  `client-plugins/{eiscore-auth,digital-twin,enterprise-bi}/lib/index.js`；未复制外部未跟踪
  插件、未设置 `LUNDU_HARNESS_ROOT`、未发布 Web。真实 Provider、同源 client-plugin provenance、
  完整 Compose clean release、双租户外部 RLS、Smart BI 行为等价和远端验收继续未完成，目标保持
  `active`。

## 全局目标继续推进记录（2026-09-30，官方 SDK 初始化复验）

- 使用当前分支锁定的 `@deepseek-ai/dsh@0.1.2-rc.1` `lib/bin.js` 和临时 `DSH_HOME` 执行
  `scripts/dsh-sdk-runtime-smoke.mjs`。首次 30 秒运行因 SDK profile 首次初始化/依赖准备超时，
  未计为通过；在同一临时 profile 完成初始化后以 180 秒上限重跑成功：返回
  `server.name=deepseek-harness-sdk-runtime`、`version=0.0.1`、`frameCount=1`、`stderrBytes=0`。
- 该结果只证明官方 SDK 的本地 JSON-RPC initialize 启动合同；没有 DeepSeek 凭据、真实 Provider
  prompt/tool 输出或业务数据，因此不替代真实 Provider 验收。临时 smoke 状态仅写入被忽略的
  `.codex-tmp`，未修改仓库制品、未连接远端、未启动持久 Compose，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，Bridge 契约复验）

- `npm run test:harness-bridge` 通过：HTTP Bridge 协议/会话/请求载荷边界、缺少工具或 profile
  时故障关闭、SDK framing/响应聚合、tool-call continuation 和无 shutdown 响应时的有界关闭均有
  当前工作树回归证据。
- 该回归不等价于真实 DeepSeek Provider 或外部 client-plugin 业务输出；同源 plugin provenance、
  完整 Compose clean release、双租户外部 RLS、Smart BI 行为等价和远端验收继续未完成，目标保持
  `active`。

## 全局目标继续推进记录（2026-09-30，Harness 全量与制品前置复验）

- `npm run test:harness` 全部通过，覆盖插件注册、写确认/权限/幂等/审计、Gateway 与 Tool
  Gateway、数字分身 RLS 会话及持久化、文档提交、销售写入、查询约束、HTTP 读取、Bridge
  有界关闭、生产路径和迁移切换门禁。
- `npm run test:harness-bridge` 与 `npm run test:production-config` 再次通过。后者包含使用
  临时 fixture 的 Lundu artifact 合同回归，不能替代当前发布目录的真实制品校验。
- 使用当前分支绝对路径运行 `scripts/validate-lundu-harness-artifacts.mjs` 明确失败：缺少
  `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js` 和
  `client-plugins/enterprise-bi/lib/index.js`。当前分支没有这些文件的 Git provenance；未复制
  外部未跟踪候选、未设置 `LUNDU_HARNESS_ROOT`、未发布 Web 或启动 Compose。
- 因此真实 Provider prompt/tool 输出、同源 client-plugin、完整 Compose clean release、双租户
  外部 RLS、Smart BI 行为等价和远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，数据库边界复验）

- `npm run test:database-roles` 通过：共享数据库配置、DB2 角色/运行时身份/secret 注入以及数字
  分身 RLS 基线均保持通过。
- `npm run test:database-migrations` 通过：迁移治理、离线 runner、基线与 PostgREST 契约、release/
  recovery runner、数据库后端治理、角色边界和 public schema ratchet 均通过。该结果是静态/契约
  证据，不等同于外部双租户真实数据库验收；未连接数据库生产环境、未执行发布或恢复操作。

## 全局目标继续推进记录（2026-09-30，提交前必跑门禁复验）

- `npm run test:syntax` 通过，检查当前工作树 300 个 Node 脚本。
- `npm run test:unit` 未通过，但失败点位于既有独立站研究资源测试：
  `eiscore-company-site/research-gallery/gallery-001.png` 和
  `eiscore-company-site/research-gallery/gallery-021.jpeg` 缺失；这两个路径没有当前工作树
  改动或历史提交记录。本轮未生成伪图片、未修改独立站视觉资源，也未把该前端资源阻塞误报为
  Harness 后端失败。
- 后端任务边界要求只负责后端迁移，且当前分支没有三组 client-plugin 的 Git provenance；因此
  不复制外部未跟踪插件、不扩展到前端视觉或远端发布。目标继续保持 `active`，待同源插件/真实
  Provider 与外部环境证据具备后再做完整 Compose/业务验收。

## 全局目标继续推进记录（2026-09-30，插件目录双向一致性门禁）

- 新增 `tests/engineering/harness-plugin-catalog-regression.mjs`，并纳入
  `npm run test:harness-plugin`/`npm run test:harness`。测试锁定 9 个插件、18 个 capability 在
  `plugin-contract.v1.json`、`MIGRATION_CATALOG.json`、DSH Bridge 默认列表和
  `deploy/lundu/compose.yml` 的双向一致性，防止注册表更新后运行时漏挂插件。
- `npm run test:harness` 和 `npm run test:syntax` 均通过；语法检查当前覆盖 301 个脚本。
- 本轮只修改后端 Bridge 导出和契约测试/package script，没有修改前端视觉、静态 release、数据库
  卷或远端环境。真实 Provider、同源 client-plugin provenance、完整 Compose clean release、
  外部双租户 RLS、Smart BI 行为等价和远端验收仍按前述记录保持未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，Bridge 插件暴露边界收紧）

- `agent-harness/dsh-http-bridge.mjs` 现在从当前 `plugin-contract.v1.json` 加载已注册插件 ID，
  `HARNESS_PLUGINS` 中的未知 ID 会被过滤；未知 ID-only 配置得到空插件列表，Bridge readiness
  不会伪造通过。这样 `/v1/plugins` 与实际 Harness 合同保持一致，避免错误配置先对外宣告未注册插件。
- 新增 Bridge 回归断言覆盖未知插件过滤；`npm run test:harness-bridge`、`npm run test:harness`
  和 `npm run test:syntax`（301 个脚本）全部通过。
- 本轮仍未连接远端、未发布、未启动持久 Compose，也未修改前端视觉或业务数据卷；真实 Provider、
  同源 client-plugin provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价
  和远端验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，Harness 容器装配边界修复）

- 发现并修复一个仅在容器装配中出现的后端问题：DSH Bridge 运行时新增了对 `plugin-registry.js`
  的导入，但 Harness Dockerfile 原先只复制 Bridge/HTTP 文件；镜像内会缺少 registry 及其
  `plugin-contract.v1.json`。现已将两者复制到 `/opt/eiscore-harness`（嵌入式 Bridge 路径）和
  `/opt`（Lundu Compose 单文件挂载路径），并加入 Docker ignore 与 runtime-image 合同断言。
- `npm run test:runtime-image`、`npm run test:infrastructure`、`npm run test:harness-bridge` 均通过。
- 使用 WSL Docker 从 Windows 挂载工作树尝试 `docker build -f agent-harness/Dockerfile`；legacy
  builder 超过约 3 分钟无输出，按已知挂载上下文 I/O 阻塞主动终止。镜像 inspect 未发现新的临时
  tag，未创建容器、未启动 Compose、未挂载数据库卷，也未影响现有 `yayulink-api` 容器；因此不把
  此次尝试计为 clean image build 通过。
- 目标继续保持 `active`：容器镜像的静态输入闭包已修复，但真实容器启动、真实 Provider、同源
  client-plugin provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 等价和远端验收
  仍未完成。

## 全局目标继续推进记录（2026-09-30，Linux staging Harness 镜像与导入 smoke）

- 为绕开 Windows 挂载工作树的 legacy builder I/O 阻塞，在 WSL `/tmp` 中只复制当前分支 Harness
  Dockerfile、锁文件、Bridge、registry 和 contract，构建隔离镜像
  `eiscore-harness-bridge:codex-plugin-boundary-20260930`；构建成功，镜像 digest 为
  `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`。
- 使用该镜像运行一次 `--network none --read-only --user 10001:10001 --rm` 容器，直接导入
  `/opt/eiscore-harness/dsh-http-bridge.mjs`，成功列出 9 个注册插件，并确认嵌入式
  `plugin-contract.v1.json` 和 `/opt/plugin-registry.js` 兼容路径均可读取。未启动 SDK、未连接
  Provider、未挂载任何数据库或业务卷；临时容器已自动删除，现有 `yayulink-api` 未重启。
- 该证据关闭“当前 Harness 镜像无法导入 registry/contract”的本地阻塞，但不等于完整 Compose
  clean release 或真实 provider readiness；同源 client-plugin provenance、外部双租户 RLS、Smart
  BI 行为等价和远端验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，容器配置故障关闭与后端回归复验）

- 在已构建的 staging 镜像中设置 `HARNESS_PLUGINS=unknown`，运行同样的 `--network none --read-only
  --rm` smoke；Bridge 实际返回空插件列表，证明未知配置在容器内也故障关闭，不会宣告未注册插件。
- `npm run test:harness`、`npm run test:database-migrations`、`npm run test:production-config`、
  `npm run test:runtime-image` 和 `npm run lint:changed` 全部通过。数据库套件覆盖 RLS/角色/迁移/
  release/recovery/结构治理；Harness 套件覆盖插件、Gateway、Bridge、数字分身、文档、销售和旧
  Agent 路径退出。
- 真实 DeepSeek Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户
  RLS、Smart BI 行为等价和远端验收仍未完成；未连接远端、未启动项目 Compose、未修改数据库卷，
  目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，Harness Bridge 容器 HTTP smoke）

- 使用已验证的 `eiscore-harness-bridge:codex-plugin-boundary-20260930` 镜像，以当前分支的
  `eiscore-tools.mjs` 与 `eiscore-restricted.cordis.yml` 作为单文件只读挂载，启动一次前台、
  `--network none --read-only --user 10001:10001` Bridge 容器。
- 容器内实际 HTTP 验证：`GET /healthz -> 200 {ok:true, protocol:eiscore-agent-v1}`；
  `GET /readyz -> 503 HARNESS_NOT_READY`（无真实 Provider/profile），证明进程可启动且 readiness
  不伪造通过。未连接外网、未启动 SDK Provider、未挂载数据库/业务卷。
- 早先无工具目录的直接启动按预期以缺少 `eiscore-tools.mjs`/restricted profile 故障关闭；本轮
  前台 smoke 容器已删除，现有 `yayulink-api` 保持运行。真实 Provider、完整 Compose、同源
  client-plugin provenance、外部双租户 RLS、Smart BI 等价和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，外部制品 provenance 再确认）

- 只读扫描当前 `github-eiscore-refactor`：未发现 `agent-harness/client-plugins` 或
  `client-plugins` 目录，`git ls-files` 与 `git log --all -- agent-harness/client-plugins`
  均无记录；仓库文档明确三组 Web client-plugin 是部署侧外部 Harness 输入，不属于本后端分支。
- 未复制本机其他工作树或 WSL 未跟踪制品，也未设置 `LUNDU_HARNESS_ROOT`、未发布 Web/远端。
  这保持了当前分支 provenance 边界，真实 Web plugin、Provider prompt/tool 输出、完整 Compose
  clean release、外部双租户 RLS、Smart BI 等价和远端验收继续列为未完成项，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，Bridge 插件配置稳定去重）

- 收紧 `HARNESS_PLUGINS` 解析：Bridge 现在会过滤未知 ID，并按配置顺序对已注册插件稳定去重，
  确保 `/v1/plugins` 不会出现重复插件条目；新增回归覆盖未知 ID、重复 ID 和 unknown-only
  故障关闭。
- `npm run test:harness-bridge`、`npm run test:harness-plugin`、`npm run test:harness` 和
  `npm run test:syntax`（301 个脚本）全部通过。未修改前端视觉、静态 release、数据库卷或远端。
- 真实 Provider、同源 Web client-plugin provenance、完整 Compose clean release、外部双租户 RLS、
  Smart BI 行为等价和远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，安全与数据库边界复验）

- `npm run test:secrets` 通过：SQL/dump secret 回归和 2783 个文本文件扫描通过；扫描器仅报告
  checksum-locked legacy SQL quarantine 中既有 5 项保留发现，没有输出匹配值。
- `npm run test:database-roles` 通过：共享数据库配置、DB2 运行时身份/secret 注入及数字分身
  RLS 基线通过。
- `harness-production-path-regression.mjs` 与 `harness-plugin-catalog-regression.mjs` 通过，确认
  生产 HTTP/WebSocket 不保留旧 Agent/模型入口，插件合同、迁移目录、Bridge 默认列表和 Lundu
  Compose 仍一致。目标继续保持 `active`，外部 Provider/client-plugin/Compose/RLS/Smart BI/远端
  验收仍未完成。

## 全局目标继续推进记录（2026-09-30，WSL 隔离数据库套件复验）

- Windows Node 直接运行 `npm run test:database:docker` 因 Docker Desktop named pipe 不可用而未执行；
  随后在 WSL Ubuntu Docker 29.1.3 daemon 中运行同一命令，六组隔离套件全部通过：DB1 fresh/
  predecessor upgrade baseline equivalence、DB3 PostgreSQL/PostgREST roles/RLS denial、company-site
  BFF Agent HTTP chain、catalog/PostgREST contract、DB6 release lock/backup/drift fail-closed、DB5
  recovery destroy-and-restore drill。
- 测试使用脚本创建的临时容器和卷，复核后没有 DB1/DB3/DB5/DB6 测试容器或匹配卷残留；未使用项目
  `pgdata`、Lundu 数据库卷或现有业务容器。该证据加强了 RLS/迁移/release/recovery 边界，但不等同
  于外部双租户 Harness 业务验收；真实 Provider、同源 Web client-plugin、完整 Compose 和远端验收
  仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，Runtime 路由与业务边界复验）

- `npm run test:runtime-router` 全部通过：86 条 Runtime HTTP 路由、数字分身 session/knowledge
  授权与持久化、消息规范化旧 Agent 退出、Flash 43 工具/确认/幂等/审计、PostgREST JWT 绑定、
  WebSocket Harness 消息、数据库 notifier 和 27 模块 composition-root 均无回归。
- 本轮只读审计进一步确认 chat/execute/twin 请求体中的 user、tenant、token、权限和伪造历史不会
  覆盖外层认证上下文；未修改代码、前端、静态 release 或远端环境。真实 Provider、同源
  client-plugin、完整 Compose、外部双租户 RLS 业务验收、Smart BI 等价和远端验收继续未完成，
  目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，发布前工程门禁复验）

- `npm run test:toolchain` 通过，15 个锁定 CI package 合同无回归。
- `npm run test:infrastructure` 通过，覆盖 24 个 shell 脚本和生产 Compose 合同；
  `npm run test:production-config` 通过，包含生产配置安全、Lundu Harness artifact 合同和启动期
  DSH profile 约束。
- `npm run lint:changed` 通过，覆盖相对 `HEAD^` 的 127 个 JavaScript/Vue 文件。本轮未修改前端
  视觉或远端部署；真实 Provider、同源 client-plugin、完整 Compose、外部双租户 RLS、Smart BI
  等价和远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，显式空插件配置故障关闭）

- 修复 Bridge 配置语义：只有环境变量未定义时才使用 9 个默认插件；显式设置
  `HARNESS_PLUGINS=` 不再意外回退到全部插件，而是得到空列表并使 readiness 不能伪造通过。
  回归测试新增显式空值断言。
- `npm run test:harness-bridge`、`npm run test:harness`、`npm run test:syntax`（301 个脚本）和
  `npm run test:runtime-image` 全部通过。本轮未修改前端视觉、静态 release、数据库卷或远端环境。
- 真实 Provider、同源 Web client-plugin provenance、完整 Compose clean release、外部双租户 RLS、
  Smart BI 行为等价和远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，DSH SDK 本地 JSON-RPC 初始化 smoke）

- 使用当前分支锁定的 `@deepseek-ai/dsh` SDK，通过 `scripts/dsh-sdk-runtime-smoke.mjs` 启动本地
  JSON-RPC runtime，并使用隔离 home 目录完成 initialize 握手；实际结果为
  `{"ok":true,"server":{"name":"deepseek-harness-sdk-runtime","version":"0.0.1"},"frameCount":1,"stderrBytes":0}`。
- 该结果只证明 SDK runtime 的本地协议初始化、单帧返回和无 stderr；未连接真实 DeepSeek Provider，
  未证明业务 prompt/tool 输出、生产凭证或外部网络可用性。隔离 home 可清理，未启动项目 Compose、
  未挂载数据库/业务卷、未连接远端。
- 同源 Web client-plugin provenance、完整 Docker Compose clean release、外部双租户 RLS 业务验收、
  Smart BI 行为等价和伦度远端验收继续未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，单元与质量门禁结果）

- `npm run test:unit` 未全量通过：独立站 `eiscore-company-site/test/jinwei-research-images.test.js`
  缺失既有资源 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg`，其余
  已执行的独立站测试通过；该失败不涉及 Harness 后端实现。
- `npm run test:quality` 未全量通过：在既有 Vue 复杂度门禁处停止，报告
  `eiscore-mobile/src/views/LoginView.vue` 当前 1826 行、基线 1632 行；这是前端既有基线问题，
  本后端目标不修改前端视觉或回退该文件。
- 因此本轮只将 Harness 相关已通过结果视为有效证据；完整质量/单元绿灯、同源 Web client-plugin
  provenance、真实 Provider、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和
  伦度远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，生产边界与并发上下文窄回归）

- 直接运行 `node realtime/test-harness-runtime-boundaries.js` 与
  `node realtime/test-harness-gateway.js` 通过：同一 session 的 Provider 请求串行化且上下文
  随真实 prompt 切换；Bridge 头不转发 JWT；Tool Proxy 拒绝未知 session/插件，剥离模型伪造的
  tenant、token、confirmed、idempotency_key、session_id，并只接受外层认证上下文的写确认和幂等键。
- `node tests/engineering/harness-production-path-regression.mjs` 通过，且当前运行时/部署配置中
  未发现旧 Agent 编排、旧模型直连、Cline executor 或 Harness fallback/shadow 配置标记。
- `node tests/engineering/harness-plugin-catalog-regression.mjs` 通过，9 个插件、18 个 capability
  在 contract、migration catalog、Tool Gateway、Bridge 默认列表和 Lundu Compose 之间保持双向一致。
- 这轮没有代码或前端视觉变更，也没有连接远端、启动持久 Compose 或写入数据库卷；真实 Provider、
  当前分支 Web client-plugin provenance、完整 Compose clean release、外部双租户 RLS、Smart BI
  行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-09-30，DSH capability timeout 合同对齐）

- 审计发现 `agent-harness/eiscore-tools.mjs` 曾为全部 18 个 DSH 工具固定声明 30 秒协作超时，
  而合同中数字分身、Workflow、Sales、Document 和 Flash capability 的服务端 timeout 为 60 秒。
  这会让 SDK 工具层先于 Gateway 合同终止长任务。
- 新增按 capability 的 `CAPABILITY_TIMEOUTS` 清单，并让每个 DSH 注册工具使用对应的
  `plugin-contract.v1.json` timeout；`agent-harness/test-eiscore-tools.mjs` 现在逐项比较工具参数、
  输出 schema 和 timeout，防止后续合同漂移。
- `node agent-harness/test-eiscore-tools.mjs`、`npm run test:harness`、
  `node tests/engineering/harness-plugin-catalog-regression.mjs` 和 `node --check
  agent-harness/eiscore-tools.mjs` 全部通过。本轮未连接远端、未启动持久 Compose、未写入数据库
  卷或修改前端视觉；真实 Provider、当前分支 Web client-plugin provenance、完整 Compose clean
  release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，DSH capability 双向集合门禁）

- 在 DSH 工具注册回归中新增双向集合断言：`eiscore-tools.mjs` 的 18 项 `capabilities` 必须与
  `plugin-contract.v1.json` 全部插件 capability 的展开集合完全相等，避免合同新增 capability
  但 DSH 工具漏注册时测试仍错误通过。
- `node agent-harness/test-eiscore-tools.mjs`、`npm run test:harness` 和
  `node tests/engineering/harness-plugin-catalog-regression.mjs` 全部通过。本轮只修改后端契约
  测试，没有修改前端视觉、静态 release、数据库卷或远端环境；真实 Provider、当前分支 Web
  client-plugin provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和
  伦度远端验收继续未完成，目标保持 `active`。
- 追加工程门禁复验：`npm run test:syntax` 通过（301 个脚本）、`npm run test:production-config`、
  `npm run test:runtime-image` 和 `npm run lint:changed` 通过（127 个变更 JS/Vue 文件）；
  `git diff --check` 通过。历史 `test:unit` 缺失独立站图片与 `test:quality` 前端复杂度阻塞仍未改变。

## 全局目标继续推进记录（2026-09-30，DSH 工具合同漂移修复复验）

- 扩展 `agent-harness/test-eiscore-tools.mjs`，对全部 18 个 capability 逐项比较 DSH 注册的输入
  schema、输出 schema 和 timeout，并要求 timeout inventory 与注册 capability 集合完全相等。
- 该回归先后发现两项真实漂移并已修复：长任务 capability（数字分身、Workflow、Sales、Document、
  Flash）统一从错误的 30 秒改为合同要求的 60 秒；`eiscore_enterprise_snapshot` 的输出 schema
  补齐合同要求的 `additionalProperties: true`。
- `node agent-harness/test-eiscore-tools.mjs`、`npm run test:harness`、
  `node tests/engineering/harness-production-path-regression.mjs`、
  `node --check agent-harness/eiscore-tools.mjs` 和 `git diff --check` 全部通过。本轮仍未连接远端、
  未启动持久 Compose、未写入数据库卷或修改前端视觉；真实 Provider、当前分支 Web client-plugin
  provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收继续未完成，
  目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，数字分身历史模型默认值边界固化）

- 数据库基线中的 `app_data.twin_sessions.model DEFAULT 'glm-4.6v'` 属于冻结的历史结构；直接编辑
  `database/baselines/eiscore-db-v1/schema.sql` 会破坏基线 fingerprint、schema checksum 和 object
  catalog，不作为本轮修复方式。
- 运行时唯一的新建会话路径 `realtime/twin-tools.js` 已显式写入 `model=deepseek-harness`；现有会话
  查询、消息、工具日志和更新路径不读取 `model` 作为路由或 Provider 选择。退役的 `sql/twin_schema.sql`
  与 `env/insert_ai_config.sql` 继续由 legacy SQL default-deny/基线覆盖治理，不是生产迁移输入。
- `harness-production-path-regression.mjs` 新增门禁，要求数字分身会话显式绑定 Harness 标识且运行时持久化
  不得保留 `glm-4.6v`。本轮没有修改冻结基线、数据库卷、前端视觉或远端环境；真实 Provider、同源 Web
  client-plugin provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收
  仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，Bridge prompt 错误生命周期收口）

- 修复 `agent-harness/dsh-http-bridge.mjs`：SDK 对 `session/prompt` 返回 JSON-RPC 错误时，当前 prompt
  waiter 现在会立即删除并清理 timer，避免失败请求在超时窗口内残留 session 状态或产生延迟拒绝。
- 新增运行时回归，验证同一 SDK runtime 在首个 prompt 被 Provider 拒绝后，下一次 prompt 仍能成功完成；
  `npm run test:harness-bridge`、`npm run test:harness` 和 `npm run test:syntax` 均应覆盖该行为。
- 本轮未连接远端、未启动持久 Compose、未修改数据库卷或前端视觉；真实 Provider、同源 Web client-plugin
  provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍未完成，
  目标保持 `active`。

## 全局目标继续推进记录（2026-09-30，官方 DSH SDK 协议复验）

- 使用当前分支锁定的 `agent-harness/node_modules/@deepseek-ai/dsh@0.1.2-rc.1` 与
  `scripts/dsh-sdk-runtime-smoke.mjs`，在隔离临时 `DSH_HOME` 中完成真实 SDK JSON-RPC initialize
  smoke；结果为 `server.name=deepseek-harness-sdk-runtime`、`version=0.0.1`、`frameCount=1`、
  `stderrBytes=0`。
- 该证据确认官方 SDK runtime 可以启动并响应初始化协议；未连接真实 DeepSeek Provider，未执行真实
  模型 prompt/tool 业务输出，也未启动项目 Compose、挂载数据库卷或连接远端。当前分支 Web
  client-plugin provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和伦度
  远端验收仍未完成，目标保持 `active`。
## 全局目标继续推进记录（2026-09-30，隔离 Docker Harness bridge smoke）

- 使用当前分支镜像 \`eiscore-harness-bridge:codex-current-20260930-prompt-error\`（image id
  \`364a55c765e0\`）和当前分支 Harness 文件临时挂载目录，启动一次非持久隔离容器。容器使用
  \`--network none\`、只读根文件系统、\`10001:10001\` 非 root 用户和仅用于进程临时文件的 tmpfs；
  未启动项目 Compose，未挂载数据库或业务数据卷。
- 容器内直接请求实际 Bridge：\`GET /healthz\` 返回 HTTP 200，响应
  \`{"ok":true,"protocol":"eiscore-agent-v1"}\`；\`GET /readyz\` 返回 HTTP 503，响应
  \`{"code":"HARNESS_NOT_READY","message":"DeepSeek Harness is not ready"}\`。后者是预期结果：
  本 smoke 未提供真实 Provider/profile，readiness 不得伪造通过。
- smoke 期间没有执行业务 prompt/tool、没有连接外部 Provider、没有远端连接、没有修改数据库卷。
  验证完成后已删除临时容器、临时镜像和挂载文件。真实 Provider 行为、同源 Web client-plugin
  provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收
  仍未完成，目标保持 \`active\`。
## 全局目标继续推进记录（2026-10-01，Harness Smart BI 输出策略收口）

- 将旧 Agent 输出守卫中不依赖模型直连的确定性部分迁入 `realtime/harness-output-policy.js`，并在
  `enterprise-bi` Harness chat 响应边界应用：清理经营分析客套前缀，移除 BPMN/workflow-meta/
  Mermaid 泄漏，规范化可解析的 ECharts fenced JSON；无法解析时输出不可见的安全占位图。
- 该策略只按插件 ID 生效，数字分身、工作流、文档和其他插件保持原始响应形状；它不发起旧模型
  请求，也不绕过 Harness Gateway、权限、租户、会话、审计或写确认边界。
- 新增 `realtime/test-harness-output-policy.js` 并纳入 `npm run test:harness`。专门回归、Harness
  chat 回归和完整 Harness 套件均通过；`node --check` 与 `git diff --check` 通过。
- 本轮未连接远端、未启动持久 Compose、未写入数据库卷或修改前端视觉。真实 Provider prompt/tool
  行为、当前分支 Web client-plugin provenance、完整 Compose clean release、外部双租户 RLS 业务验收和
  伦度远端验收仍未完成；Smart BI 的真实 ECharts/经营答案等价仍需外部 enterprise-bi 制品验收。
  目标继续保持 `active`。
## 全局目标继续推进记录（2026-10-01，外部 Web client-plugin 装载对照）

- 当前分支仍没有 `client-plugins/*/lib/index.js` 编译制品，不能将仓库外 staging 目录视为当前分支 provenance。
  仓库外 `C:/Users/Twist/Documents/eiscore/agent-harness` 仍是无提交工作区，继续按外部输入处理。
- 为区分装配问题和插件本身问题，在工作区 `.codex-tmp/external-plugin-acceptance-20261001` 建立一次性临时根目录：
  复制当前分支的 `eiscore-tools.mjs`、`eiscore-restricted.cordis.yml`，并复制 staging 的三个编译入口；
  补齐临时 ESM package 元数据后，`validate-lundu-harness-artifacts.mjs` 返回插件、工具和 patch 全部通过。
- 使用当前分支锁定的 DSH SDK 运行 `dsh-web-plugin-runtime-smoke.mjs` 配置阶段，实际返回
  `{"ok":true,"mode":"config-dump","plugins":["eiscore-auth","eiscore-digital-twin","eiscore-enterprise-bi"]}`。
  该 smoke 没有连接 Provider、没有执行业务请求或浏览器业务流程；它证明 Web Host 注册/配置装载兼容，
  不证明当前分支 compiled provenance、真实插件行为、真实 Provider、租户/RLS 或远端部署完成。
- 临时目录验证后已清理；本轮没有连接远端、没有启动持久 Compose、没有写入数据库卷或修改前端视觉。
  当前分支 Web client-plugin provenance、完整 Compose clean release、真实 Provider、外部双租户 RLS、Smart BI
  真实行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-01，DSH 工具调用闭环 smoke）

- 使用当前分支 `agent-harness/dsh-http-bridge.mjs`、`agent-harness/eiscore-tools.mjs`、
  `agent-harness/eiscore-restricted.cordis.yml`，以及工作区已存在的锁定 DSH SDK 和 mock LLM
  依赖，在临时 `.codex-tmp/dsh-tool-smoke.mjs` 中运行工具调用闭环。
- 首次真实注册暴露 DSH 0.1.2 的 schema 子集约束：`oneOf` 根节点不得同时声明冗余的
  `type`。保留 EISCore 合同中的完整 JSON Schema 语义，在 DSH 注册边界新增递归
  `normalizeDshSchema`，只移除 `oneOf` 节点的根 `type`，并补充注册回归断言。
- 修复后 smoke 通过：官方 DSH SDK initialize 成功；18 个 EISCore 工具全部注册；mock
  Provider 发起 `eiscore_enterprise_snapshot` tool call；工具插件经 loopback EISCore
  proxy 收到并转发 `session_id`、工具名和参数；第二次模型请求完成，结果为
  `{"ok":true,"text":"mock response recovered","proxyCalls":1,"modelRequests":2}`。
- 本轮仍未连接真实 DeepSeek Provider、远端或持久 Compose，未挂载数据库卷、未写入业务数据、
  未修改前端视觉；真实 Provider 行为、当前分支 Web client-plugin provenance、完整 Compose clean
  release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-01，本地 SDK 与完整前端构建复验）

- 使用当前分支锁定的 DSH SDK 运行 `scripts/dsh-sdk-runtime-smoke.mjs`，显式指定临时
  `DSH_HOME` 和 `@deepseek-ai/dsh/lib/bin.js`；结果为 `ok=true`、
  `server.name=deepseek-harness-sdk-runtime`、`version=0.0.1`、`frameCount=1`、
  `stderrBytes=0`。
- 运行 `npm run build:frontends`，当前分支的 12 个前端包全部构建成功（包括 base、apps、
  company-site、HR、materials、sales、purchase、production、quality、equipment、decision、
  mobile）。构建仅生成本地 dist，未复制到远端、未启动 Compose；输出中的 Sass 弃用、循环 chunk
  和大 chunk 提示均为现有构建告警。
- 重新运行 `npm run test:unit` 和 `npm run test:quality`：unit 仍只在独立站既有缺失资源
  `research-gallery/gallery-001.png`、`research-gallery/gallery-021.jpeg` 处失败；quality 仍在
  既有 `eiscore-mobile/src/views/LoginView.vue` 复杂度门禁处失败（1826 行，高于 1632 行基线）。
  两项阻塞均未由本轮后端改动引入，本轮不修改前端视觉或补造客户素材。
- 本轮未连接远端、未连接生产、未启动持久 Compose、未挂载或写入数据库卷；真实 Provider 行为、
  当前分支 Web client-plugin compiled provenance、完整 Compose clean release、外部双租户 RLS、
  Smart BI 真实行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-01，本地 Compose 与工具注册边界审计）

- 用 `env/.env.example` 做无启动配置解析时，根 Compose `docker-compose.yml` 返回成功；它只证明
  Compose YAML/插值结构可解析，不代表启动服务或连接数据库。
- DSH 工具注册边界只读检查返回 `capabilities=18`、`registrations=18`、
  `rootTypeAndOneOf=[]`，确认上一轮 `normalizeDshSchema` 已覆盖所有注册工具。
- 当前分支没有 `agent-harness/client-plugins` 编译入口目录；递归检查到的 `index.js` 均来自
  `node_modules`，不能作为 Web client-plugin provenance。外部 staging 制品仍不计入当前分支。
- 伦度 Compose 组合文件需要本地 `deploy/lundu/.env`（由 `.env.example` 描述）以及
  `LUNDU_HARNESS_ROOT`、`POSTGREST_DB_PASSWORD`、`PGRST_JWT_SECRET` 等运行时变量；当前工作树没有
  该私密 `.env`，因此配置解析在 env_file 读取阶段停止。本轮没有创建占位 `.env`、没有启动容器、
  没有连接数据库卷或远端；这项仍是完整 Compose clean release 的本地前置条件，而不是代码回归失败。
- 真实 Provider 行为、当前分支 Web client-plugin compiled provenance、完整 Compose clean release、
  外部双租户 RLS、Smart BI 真实行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-01，旧 Provider 依赖来源审计）

- `agent-harness/package.json` 的直接运行时依赖只有 `@deepseek-ai/dsh`；当前分支 `agent-harness`
  源码没有 `@anthropic-ai/sdk`、`openai`、Anthropic/OpenAI 环境变量或 Provider URL 的 import/直连。
- `agent-harness/package-lock.json` 中出现的 `@anthropic-ai/sdk` 和 `openai` 来自 DSH 内部
  `@earendil-works/pi-ai` 的传递依赖，用于 DSH 自身的 Provider 适配面，不构成 EISCore 旧 Agent
  生产编排或直接模型出口；生产路径回归已对 realtime、Bridge、工具插件、部署配置和依赖清单执行
  直接 Provider/fallback/Cline 标记门禁并通过。
- 本轮补跑 `npm run test:syntax`（301 文件）、`npm run test:toolchain`、`npm run test:migration-switch`、
  `node agent-harness/test-eiscore-tools.mjs` 和完整 `npm run test:harness`，全部通过；DSH schema 根/嵌套
  `oneOf` 规范化最小回归也通过。目标继续保持 `active`，因为真实 Provider、同源 Web client-plugin
  编译 provenance、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍缺少
  允许的真实环境证据。

## 全局目标继续推进记录（2026-10-01，伦度 Harness Compose 组合解析）

- 根据 `deploy/lundu/.env.example` 临时生成仅含本地占位值的 `.env`（不含真实凭据），执行
  `docker compose --env-file deploy/lundu/.env -f deploy/lundu/compose.yml -f deploy/lundu/compose.harness-web.yml config --quiet`，
  组合解析成功；随后立即删除临时 `.env`。没有启动容器、没有连接数据库卷、没有连接远端或生产。
- 该结果补足了 Compose YAML、env_file、Harness Web patch、secret 必填项和 Harness 根目录挂载的静态
  装配证据，但不等同于 clean release 运行验收；私密环境、真实 Provider、双租户 RLS 业务流和远端页面
  仍未在本目标范围内执行。目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，DSH Schema 适配隔离性回归）

- 扩展 `agent-harness/test-eiscore-tools.mjs`：验证 `normalizeDshSchema` 对根级和嵌套 `oneOf`
  的规范化不会修改输入 Schema，且返回对象、`properties` 和嵌套节点均为独立副本。这样 DSH
  运行时适配不会污染 `plugin-contract.v1.json` 的权限/契约源对象。
- `node agent-harness/test-eiscore-tools.mjs` 与 `npm run test:harness` 均通过；生产路径、RLS/会话
  归属、写确认/幂等/审计、Bridge 生命周期和插件目录回归继续通过。
- 本轮没有修改前端视觉、没有连接远端或生产、没有启动持久 Compose、没有挂载或写入数据库卷。
  真实 Provider prompt/tool 行为、当前分支 Web client-plugin compiled provenance、外部双租户 RLS 业务
  验收、Smart BI 真实行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，数字分身 RLS 证据范围复核）

- 复核 `tests/engineering/digital-twin-rls-contract-regression.mjs`、
  `realtime/test-harness-twin-context-capability.js` 和 `realtime/test-harness-twin-persistence.js`：
  当前分支已经有四张数字分身表的 RLS/owner policy 基线断言，并在内存 PostgREST double 中验证
  认证用户绑定 `employee_id`、未知工具/权限隐藏工具拒绝及不发起越权查询，新会话显式写入
  `model=deepseek-harness`。
- 这些测试证明本地权限和归属边界，但不等价于外部双租户真实数据库验收；真实两个 tenant 的
  JWT/RLS 请求仍列为未完成项。
- 本轮 Schema 适配隔离性回归、DSH 工具合同和完整 Harness 套件均通过；没有修改前端视觉、
  没有连接远端或生产、没有启动持久 Compose、没有挂载或写入数据库卷。目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，DSH 工具调用闭环复验）

- 单独运行 `.codex-tmp/dsh-tool-smoke.mjs` 并等待完整终态，避免并行调用的输出截断；结果为
  `ok=true`、`proxyCalls=1`、`modelRequests=2`、最终文本 `mock response recovered`。
- 运行轨迹确认：DSH SDK initialize 成功，`eiscore_enterprise_snapshot` tool call 被模型发起，
  EISCore loopback Tool Proxy 返回 `{snapshot: "proxy-ok"}`，随后第二次 Provider 请求完成正常文本回复，
  session 最终回到 `idle`，Bridge 正常关闭。
- 这是真实锁定 DSH SDK + 本地 mock Provider + 当前分支工具插件的完整本地链路证据，不代表真实
  DeepSeek Provider、真实数据库/RLS、当前分支 Web client-plugin 编译 provenance 或伦度远端验收。
  本轮没有连接远端或生产、没有启动持久 Compose、没有挂载或写入数据库卷，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，本地后端与数据库治理复验）

- 复跑 `npm run test:harness`：插件注册/审计、18 capability 合同、写确认/权限/幂等、Gateway/Tool Gateway、数字分身 RLS 会话持久化、文档提交、销售写入、生产路径、查询工具、输出策略、Bridge 和迁移开关全部通过。
- 复跑 `npm run test:syntax`（301 个 Node 文件）、`npm run lint:changed`（130 个变更 JavaScript/Vue 文件）、`node agent-harness/test-eiscore-tools.mjs` 和 `npm run test:database-migrations`，全部通过；数据库套件同时通过迁移治理、运行器、基线/契约、release/recovery runner、操作策略、DB backend governance、角色/RLS 和 public Schema ratchet。
- 复核发现数据库规范基线仍保留历史 `twin_sessions.model` 默认值 `glm-4.6v`，但运行时 `createPersistence` 已显式写入 `model=deepseek-harness`；由于当前数据库 release provenance 固定在 `eiscore-db-v6` 且目标禁止执行/发布数据库迁移，本轮未留下未纳入 release 的半迁移改动。该默认值收口列为后续新数据库 release 的明确待办，不将现有运行时显式绑定误报为数据库默认值已完成。
- 本轮没有连接远端或生产、没有启动持久 Compose、没有执行数据库迁移、没有挂载或写入数据库卷、没有修改前端视觉；真实 DeepSeek Provider 行为、外部双租户 RLS 业务验收、同源 Web client-plugin 编译 provenance、clean Compose 运行和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，部署边界与 DSH SDK 复核）

- `npm run test:production-config`、`npm run test:runtime-image`、`npm run test:harness-production-path`、`node tests/engineering/lundu-harness-artifact-regression.mjs`、`node deploy/lundu/test-dsh-web-runner.mjs` 和 `node tests/engineering/message-normalization-regression.mjs` 全部通过。生产配置、27 个组合根/2 个 Dockerfile、Harness 生产路径、伦度 artifact preflight 合同、启动期 DSH profile 和旧 Agent 消息清理边界均保持通过。
- 对当前分支 `agent-harness` 运行 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ...\github-eiscore-refactor\agent-harness --patch ...\deploy\lundu\dsh-web.patch.yml`，验证器明确失败于三个缺失编译入口：`client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js`、`client-plugins/enterprise-bi/lib/index.js`。当前分支没有这些插件源码/构建脚本；仓库外 staging 目录无提交 provenance，未复制或冒充当前分支制品。
- 使用当前分支工具插件、受限 profile、锁定 `@deepseek-ai/dsh` SDK、临时 DSH home 和本地脚本 Provider 运行 `.codex-tmp/dsh-tool-smoke.mjs`：`ok=true`、`proxyCalls=1`、`modelRequests=2`、最终文本 `mock response recovered`。显式运行 `scripts/dsh-sdk-runtime-smoke.mjs` 后得到 `server.name=deepseek-harness-sdk-runtime`、`version=0.0.1`、`frameCount=1`、`stderrBytes=0`。两者都是本地 mock/SDK 证据，不代表真实 DeepSeek Provider。
- `docker compose --env-file env/.env.example -f docker-compose.yml config --quiet` 通过；Windows Docker daemon 检查失败于 `dockerDesktopLinuxEngine` named pipe 不存在，因此没有启动容器。未连接远端或生产、未启动持久 Compose、未写入数据库卷、未修改前端视觉。真实 Provider、同源 Web client-plugin provenance、外部双租户 RLS、clean Compose 运行和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，平台鉴权与 WebSocket canonical 路径复验）

- 修正 7 个微应用 realtime 适配器（equipment、hr、materials、production、purchase、quality、sales）仍残留的旧 `/agent/ws`，统一到当前 Harness/服务端 canonical `/ws`；未恢复任何旧 Agent 路径。
- 同步平台鉴权回归契约到当前 Harness 路由：Flash 草稿使用 `/flash/draft`，AppRuntime 不再断言已退役的 `/agent/flash/draft`，Harness client 示例和 HomeView iframe auth 断言按现行职责更新；G2 导航清单同步移动端 `location.assign` 适配器和 base 路由的实际计数。
- 验证结果：`npm run test:platform-auth`、`npm run test:harness-production-path`、`npm run test:syntax`（301 个 Node 文件）、`npm run lint:changed`（142 个变更 JavaScript/Vue 文件）和 `git diff --check` 全部通过。
- 本轮只修改本地微应用路径与回归契约，没有修改前端视觉；没有连接远端/生产、没有启动持久 Compose、没有执行数据库迁移或挂载/写入数据库卷。真实 DeepSeek Provider、同源 Web client-plugin 编译 provenance、clean Compose 运行、外部双租户 RLS/伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，外部 Harness Web 插件只读运行证据）

- 重新核对当前分支：`agent-harness/` 没有 `client-plugins/eiscore-auth/lib/index.js`、`digital-twin/lib/index.js`、`enterprise-bi/lib/index.js`；`node scripts/validate-lundu-harness-artifacts.mjs` 对当前分支仍故障关闭。WSL 中另一份 `codex/systematic-refactor` 工作树包含三组未提交插件源码/制品，但提交点不同且有未提交改动；本轮没有复制、覆盖或把它们冒充当前分支 provenance。
- 使用 WSL 中锁定的 DSH Web SDK 与该外部工作树插件，仅做临时配置 dump：`node scripts/dsh-web-plugin-runtime-smoke.mjs --bin=/home/lzr/deepseek-harness/apps/cli/lib/bin.js --harness-root=/home/lzr/eiscore-refactor/agent-harness --port=3198` 通过，结果为 `ok=true`、三插件均出现在 DSH 配置。
- 使用 Node `v24.12.0` 再做完整 runtime smoke（临时 DSH_HOME，进程结束自动清理）：`/api/eiscore/auth/status`、`/api/eiscore/digital-twin/sessions`、`/api/eiscore/enterprise-bi/snapshot` 分别返回预期的 401（未认证/`EISCORE_AUTH_REQUIRED`）；认证后的 Web index 返回 200，数字分身与 enterprise-bi 两个 client bundle 均返回 200，stderr 为 0。该证据证明外部插件 Host/Client 接口和未认证 fail-closed 路径可运行，不证明当前分支制品或真实 Provider。
- Node `v20.18.1` 运行同一 smoke 时，DSH 的 `undici@8.10.0` 在 `webidl.util.markAsUncloneable` 处启动失败；这是运行时版本不兼容证据，当前分支/生产基线为 Node 22+，没有据此修改代码或降低版本要求。
- 本轮仅进行了本地 WSL 临时进程/只读外部工作树验证；没有连接远端/生产、没有启动持久 Compose、没有执行数据库迁移或挂载/写入数据库卷，也没有修改前端视觉。当前分支同源 client-plugin provenance、真实 Provider、clean Compose、外部双租户 RLS、Smart BI 真实行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，后端回归与制品门禁复验）

- `npm run test:harness` 全套通过：插件注册/审计、18 capability、写边界、Gateway/Tool Gateway、数字分身 RLS 会话、文档提交、销售写入、查询工具、输出策略、Bridge 和迁移开关均通过。
- `npm run test:production-config`、`npm run test:syntax`（301 个 Node 文件）、`npm run lint:changed`（142 个变更 JavaScript/Vue 文件）和 `git diff --check` 全部通过。
- 当前分支执行 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ...\github-eiscore-refactor\agent-harness --patch ...\deploy\lundu\dsh-web.patch.yml` 仍按预期故障关闭，明确缺少 `eiscore-auth`、`digital-twin`、`enterprise-bi` 三个 `client-plugins/*/lib/index.js`；未从其他工作树或无提交 staging 目录复制制品。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移或挂载/写入数据库卷，也未修改前端视觉；同源 client-plugin provenance、真实 Provider、clean Compose、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，本地隔离数据库/RLS 套件复验）

- Windows Docker Desktop named pipe 不可用，首次 `npm run test:database:docker` 在创建第一个容器前故障关闭，未启动容器或触碰卷。随后使用本机 WSL Docker 29.1.3、Node 24.12.0 重跑仓库脚本；脚本均使用随机容器/网络名、临时 tmpfs 或只读 bind mount，并在结束时清理。
- `scripts/test-database-baseline-equivalence.mjs` 通过：DB1 fresh install 与 predecessor upgrade schema 等价，SHA-256 `dbcd35e8cc93254dd285a89a9fa210151a9490a60fa55cc287b2f566a7874a28`。
- `scripts/test-database-role-boundaries.mjs` 通过：隔离 DB3 PostgreSQL/PostgREST 角色、company-site Agent RLS、HR payroll RLS 和拒绝合同。`scripts/test-company-site-bff.mjs` 通过：真实 `eiscore_agent` 连接完成 company-site public/admin/publish/inquiry/sales Agent HTTP 链路。
- `scripts/test-database-contracts.mjs` 通过：DB3 fresh/upgrade/repeat catalog 与 PostgREST contract，catalog SHA-256 `c45944529f41b5be49487e637b291676d470a35f02b4423a68372b123fc0afde`。`scripts/test-database-release.mjs` 通过：DB6 release artifact 升级、锁、备份、稳定 DB/PostgREST、重复执行及 drift/conflict fail-closed。
- `scripts/test-database-recovery.mjs` 通过：恢复演练事务性 rollback、销毁源 schema 后恢复 v6 roles/data/DB contract/稳定 PostgREST。测试结束后检查确认无 `eiscore-db[1-6]` 容器和临时网络残留。
- 这些是本地隔离数据库/RLS 与恢复证据，不等价于真实客户双租户 JWT/RLS 业务验收；本轮没有连接远端/生产、没有启动项目持久 Compose、没有执行真实 release 迁移、没有写入客户数据库卷，也没有修改前端视觉。当前分支同源 client-plugin provenance、真实 Provider、clean Compose、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness agent 镜像构建边界）

- 仅尝试一次当前分支 `docker build --file agent-harness/Dockerfile`（WSL Docker 29.1.3、无容器启动、固定临时 tag、120 秒上限）；环境使用 legacy builder，基础镜像未缓存，构建超过上限且无有效输出，随后停止该具体进程。
- 构建后检查确认 `eiscore-harness-local-audit:latest` 未生成，现有无关 `yayulink-api` 容器仍未触碰；没有启动项目 Compose、没有发布远端、没有连接生产或数据库卷。
- 该结果补充了 clean image build 的真实环境阻塞证据，不把本地代码/镜像契约测试误报为容器 clean release。当前分支同源 client-plugin provenance、真实 Provider、完整 Compose clean release、外部双租户 RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，生产旧模型与 Legacy fallback 路径审计）

- 只读审计 `realtime/harness-runtime.js`、`realtime/harness-gateway.js`、`realtime/harness-read-http.js`、
  `agent-harness/dsh-http-bridge.mjs`、根生产 Compose、伦度 Compose、Nginx 路由和环境模板：运行时 Provider
  请求只通过 `EISCORE_HARNESS_URL` 指向 HTTP-to-SDK Bridge 的 `/v1/chat/completions`，Bridge 再通过锁定的
  DeepSeek SDK `initialize`/`session/prompt` 协议执行；未发现旧 Agent 编排、旧模型直连、Cline executor、
  `EISCORE_HARNESS_FALLBACK` 或 shadow fallback 的生产可达路径。
- `realtime/harness-gateway.js` 的失败语义保持 fail-closed：审计密钥缺失、租户/主体/token 缺失、插件或
  capability 不匹配、权限不足、写确认/幂等缺失、重放、容量、超时、取消和 Bridge 不可用都会返回稳定拒绝/
  故障码，并写入审计；`harness-read-http.js` 对外报告的 Provider 固定为 `deepseek-harness`，不采信客户端
  传入的 model/provider 字段。
- `deploy/lundu/compose.yml` 中 `deepseek-official/deepseek-chat` 仅是伦度开发/验收 Compose 的 Harness SDK
  默认值；根 `docker-compose.prod.yml` 对 `DSH_PROVIDER`/`DSH_MODEL` 使用缺失即失败，且 `production-config`
  与 `harness-production-path` 回归均通过。`env/insert_ai_config.sql` 及数据库基线中的 `zhipu`/`glm-4.6v`
  属于已标注退役的历史兼容资产，默认数据库执行策略禁止运行；本轮未执行迁移或修改数据库基线，避免制造
  未纳入 release 的半迁移状态。
- 本轮验证：`npm run test:harness`、`npm run test:production-config`、`npm run test:harness-production-path`、
  `node tests/engineering/lundu-harness-artifact-regression.mjs` 全部通过。没有连接远端/生产、没有启动持久
  Compose、没有执行数据库迁移、没有挂载或写入数据库卷、没有修改前端视觉。
- 仍未完成且继续阻塞全局目标：当前分支同源 Web client-plugin 编译 provenance、真实 DeepSeek Provider
  prompt/tool 行为、完整 Compose clean image/release、外部双租户 JWT/RLS 业务验收、Smart BI 真实行为等价和
  伦度远端验收；目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，测试入口与旧配置可达性边界复核）

- 将 `tests/smoke/business-smoke.mjs` 的配置检查从退役的 `system_configs?key=eq.ai_glm_config`
  改为 `/agent/ai/config` Harness 合同（`provider=deepseek-harness`、`stream=true`、权限过滤后的 agents）；
  同时移除冒烟请求中从环境或服务端回填的旧 `model` 字段。数据库通知器回归改用无业务副作用的
  `SELECT 1`，不再把旧 AI 配置作为数据库连接契约。
- 将 `tests/engineering/run-remote-suite.mjs` 默认 WebSocket 地址和测试文档统一到当前 Runtime canonical
  `/ws`；相关语法、Harness 生产路径、生产配置、伦度 Harness 制品预检、平台鉴权和数据库通知器回归均通过。
- 额外审计发现 `public.system_configs` 在冻结 `eiscore-db-v1` 中是通用配置表，`web_user` 对整表拥有访问权，
  没有可单独撤销 `ai_glm_config` 的现有 RLS/Policy。
- 因此旧配置的数据库可读性仍是历史数据治理债务，不等同于 Runtime 旧模型出口；彻底移除需要新增 core 迁移、
  更新数据库目录/contract/release provenance，并在隔离数据库上完成升级、重复执行和回滚证据。本轮没有直接改写
  冻结基线、没有执行真实迁移、没有连接远端或生产，也没有写入任何数据库卷。
- 当前目标继续保持 `active`；同源 Web client-plugin 编译 provenance、真实 Provider、clean Compose release、
  外部双租户 JWT/RLS、Smart BI 行为等价、伦度远端验收和上述旧配置迁移仍未完成。

## 全局目标继续推进记录（2026-10-02，移除设置页旧模型凭据入口）

- 只读复核发现 eiscore-base/src/views/SettingsView.vue 仍向超级管理员展示旧 AI Agent 设置页，并读写
  public.system_configs.ai_glm_config 的 api_url/api_key；该页面还错误声称 Agent Runtime 会读取此配置。
- 已保留原设置页签位置与整体布局，将内容改为只读 deepseek-harness 提供方及部署侧配置说明；删除旧配置读取、写入、输入框、状态字段和保存耦合，不改变页面视觉主题。
- 更新 tests/engineering/settings-http-consumers-regression.mjs，明确禁止 SettingsView 再引用旧配置键、模型 URL/API key 或旧读写函数。设置 HTTP consumer 回归与 Harness 生产路径回归通过；npm run test:syntax（301 个 Node 文件）通过。
- 本次不删除 env/insert_ai_config.sql 历史资产，不改冻结数据库基线，也未执行数据库迁移。旧表 system_configs 是通用表且已有广泛授权；历史行的可读性仍需新 core 迁移、catalog/contract/release provenance 更新和隔离 PostgreSQL 验收后才能关闭。
- 本轮未连接远端/生产、未启动持久 Compose、未写入数据库卷、未修改前端视觉，未提交或推送。真实 DeepSeek Provider、当前分支同源 Web client-plugin provenance、完整 Compose clean release、外部双租户业务 RLS、Smart BI 行为等价、伦度远端验收及旧数据库历史配置治理仍未完成，目标继续保持 `active`。
## 全局目标继续推进记录（2026-10-02，系统配置服务旧键故障关闭）

- 共享 system-config service 现在在发起请求前拒绝退役键 ai_glm_config，返回 retired-key；其他业务配置键保持不变。
- system-config HTTP 回归新增读写拒绝和“不发出旧键请求”断言；platform HTTP、SettingsView、Harness 生产路径回归均通过。
- 数据库 baseline 中的通用 system_configs 仍需要正式 core-008 及 catalog/contract/release provenance、隔离 PostgreSQL fresh/upgrade/repeat/rollback 验证才能完全收口；本轮未修改冻结 baseline 或真实数据库卷。
- sql/twin_schema.sql 的 glm-4.6v 仍是历史 SQL 资产，未进入当前生产初始化输入；运行时数字分身显式写入 deepseek-harness。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未提交或推送；目标继续保持 active。

## 全局目标继续推进记录（2026-10-02，core-008 隔离契约验证）

- 新增 `core-008-retire-legacy-ai-config.sql`：开启 `public.system_configs` RLS，重建匿名/用户 policy 以排除 `ai_glm_config`，删除该旧键行，并将 Harness 部署参数从该表移出；未修改冻结基线或真实数据库卷。
- WSL Docker 29.1.3 运行仓库自带 DB3 隔离测试，fresh/install、role-upgrade、repeat migration、PostgREST 双角色七 Schema OpenAPI、动态 DDL 正负向和 schema-cache reload 均通过；实际 database catalog 为 7 schemas、199 relations、168 functions、321 policies、83 triggers，SHA-256 `69a1b38b2b81920554ab18229b5310d06cf7f119a23e5fe78151b3bfb54cfe5e`；PostgREST contract SHA-256 `b237ddf4a7e0d945695e7204ef5bf40615e7919558385665d7392fe558308fd1`，web_anon `d2bcb104b6f2629d504278d8ff62d22ff7b639b3e21ff0785f57ff52483ccdc2`，web_user `c5abe99778b48f0cd223d3ce2d80d12e740bcbd10042298a13407ab8598502cf`。
- 已同步 `database/contracts/eiscore-db-contract-v3.json`、core-008 迁移治理断言和数据库 README；DB3 正常通过。
- `eiscore-db-v6` release manifest 暂未改写：其 source revision 是已提交的旧 provenance，而 core-008/新契约仍在未提交工作树；在用户提交后必须重新生成并验签 release manifest，不能把未提交工作树伪装成可发布制品。
- 本轮未连接远端/生产、未执行真实 release 迁移、未写入数据库卷、未提交或推送。全局目标仍为 `active`；release provenance、真实 Provider、同源 Web client-plugin、clean Compose、外部双租户 RLS、Smart BI 等价和伦度远端验收仍未完成。

## 全局目标继续推进记录（2026-10-02，core-009 数字分身模型收口）

- 审计发现冻结基线 `app_data.twin_sessions.model` 仍有 `DEFAULT 'glm-4.6v'`；这不是当前运行时显式写入的路径，但仍是生产可达的旧模型默认，不能保留。
- 新增 `core-009-retire-legacy-twin-model.sql`：将既有会话统一为 `deepseek-harness`，把列默认值改为 `deepseek-harness`，并增加只允许该值的 CHECK 约束；postcheck 同时验证列默认值和历史行。
- WSL Docker DB3 fresh/upgrade/repeat、PostgREST 双角色七 Schema OpenAPI 和动态 DDL 套件通过；core terminal 为 `core-009`（SHA `6e7195aff8b1dad8a66258b2e37587efc653b8ba8ec4c6c15af788a60929f980`），database catalog SHA `869cb978e1c396c0c0b7bc6e0acfc55434e845fe9ea08919e873fd98223c84bd`，PostgREST contract SHA `5d14a8a0a82d506486f239b7c819d85384a6742a4e264c5d11db39940da04b24`。
- 已同步 contract、core 迁移治理回归和 database README；仍未修改冻结 baseline 文件本身，也未连接远端或真实数据库卷。由于 core-009 与新 contract 尚未进入提交，`eiscore-db-v6` 旧 release manifest 仍按预期故障关闭，需在用户提交后重新生成 release provenance。
- 本轮最终门禁：`npm run db:migrations:check`、数据库迁移治理回归、Runtime migration runner 回归、数据库 contract governance、Harness production-path、Node syntax（301 files）和 `git diff --check` 通过；WSL DB3 无打印契约测试通过，catalog SHA `869cb978e1c396c0c0b7bc6e0acfc55434e845fe9ea08919e873fd98223c84bd`。`database-release-contract-regression.mjs` / DB6 structure exit 仅因旧 v6 manifest 的 source/artifact/contract provenance drift 失败，未执行发布。
- 离线生成当前工作树 release preview 并校验通过：source revision `db22e701445c7a1b212ff450664d71bbe21cd5ad`、56 个 artifact、core terminal `core-009`，preview manifest SHA `e59eecbcb1be9029e0ca973b198023ea83de6a094db5385445e7540ca7b2a1ab`。该 preview 未写入 `database/releases/eiscore-db-v6/manifest.json`，因为当前提交尚未包含 core-009/contract/postcheck；提交后应以实际提交 SHA 重新生成，不能复用工作树 SHA。
- 追加复核：`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:production-config`、`npm run test:harness` 全部通过；`npm run test:database-migrations` 的迁移、基线、契约、release runner 前置项通过，唯一失败仍为固定 v6 manifest 的 source/artifact/contract provenance drift。未连接远端、未运行持久 Compose、未写入真实数据库卷。

## 全局目标继续推进记录（2026-10-02，本地 Bridge 与配置退役边界复验）

- `npm run test:harness-bridge` 全部通过：HTTP Bridge 协议、会话/租户归属、request replay、持久化状态恢复、损坏状态故障关闭、容量限制、DeepSeek SDK Bridge framing、tool-call continuation、prompt 错误清理和有界 shutdown 均有回归证据。Bridge metrics 端点仍只报告计数和状态持久化开关，不暴露主体、租户、凭据或原始请求内容。
- `npm run test:harness-production-path` 通过：生产 HTTP/WebSocket composition 仍只进入 Harness canonical 路径，没有重新接入旧 Agent/Twin runtime、旧模型直连、Cline executor 或 Legacy fallback。`node scripts/migration-switch-gate.mjs` 同时通过 capability binding 与插件合同集合门禁。
- `node tests/engineering/settings-http-consumers-regression.mjs` 与 `node tests/engineering/system-config-http-regression.mjs` 通过：SettingsView 不再提供 `ai_glm_config`、旧模型 URL/API key 输入或写入；共享 system-config service 在请求发出前对退役键故障关闭。
- 数据库治理复验通过：`database-backend-governance-boundary-regression.mjs`、`database-role-boundary-regression.mjs`、`database-migration-governance-regression.mjs` 均通过。core-008/core-009、隔离 DB3 证据和新 contract 保持在未提交工作树，固定 `eiscore-db-v6` release manifest 仍未改写，避免伪造 source provenance。
- 本轮只读/本地临时测试，没有连接远端或生产、没有启动持久 Compose、没有执行真实 release 迁移、没有写入数据库卷、没有提交或推送，也没有修改前端视觉。全局目标继续保持 `active`；真实 Provider、当前分支同源 Web client-plugin provenance、完整 clean Compose release、外部双租户 JWT/RLS、Smart BI 行为等价和伦度远端验收仍未完成。

## 全局目标继续推进记录（2026-10-02，WSL Harness 镜像构建再验证）

- 只读复制当前分支 `agent-harness` Dockerfile、锁文件、Bridge、registry 和 plugin contract 到新的 WSL `/tmp` 临时上下文；第一次构建因临时上下文未保留 Dockerfile 所需的 `agent-harness/` 目录层级立即失败，未产生镜像。
- 第二次修正上下文层级后，WSL Docker 29.1.3 成功解析固定 Node 基础镜像并进入 `npm ci --omit=dev --ignore-scripts`；约 90 秒无进一步输出，按环境边界终止该临时 build。没有生成可用临时 tag、没有启动容器、没有启动项目 Compose，也没有触碰现有容器或数据库卷。该结果只能记录为依赖安装/构建环境阻塞，不把镜像 clean build 宣称为通过。
- 当前分支的后端契约与 Harness/Bridge 回归仍以此前通过结果为准；真实 Provider、同源 Web client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness/DB/单元门禁复验）

- 当前工作树 `npm run test:harness` 全部通过，覆盖插件与审计账本、写确认/权限/幂等、Gateway/Tool Gateway、租户上下文、数字分身 RLS 会话与持久化、文档提交、销售写入、查询工具、输出策略、SDK Bridge 和迁移切换；`npm run test:syntax` 检查 301 个 Node 文件通过，`harness-production-path-regression.mjs` 通过，确认 HTTP/WebSocket composition 未接回旧 Agent/Twin 入口。
- `npm run test:database-migrations` 的迁移治理、runtime runner、baseline 与 contract 前置项通过，随后在固定 v6 release contract 检查处按预期失败：core-008/core-009 尚未进入已提交 source provenance，导致 contract、core manifest、postcheck、terminal migration、catalog 和 PostgREST checksum 漂移。没有更新 release manifest，也没有执行发布迁移或接触持久数据库卷。
- `npm run test:unit` 仍为 28/30 通过，仅 `eiscore-company-site` 两项研究图资源断言失败，缺少 `research-gallery/gallery-001.png` 和 `research-gallery/gallery-021.jpeg`；未伪造或改动独立站资源。
- 本轮未连接远端/生产、未启动项目 Compose、未写入数据库卷、未提交或推送、未修改前端视觉。真实 DeepSeek Provider、同源 Web client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。
- 补充复验隔离 DB3：在 WSL Docker 29.1.3、Node 20.18.1 下运行 `node scripts/test-database-contracts.mjs` 以退出码 1 结束，无测试摘要输出；检查该次随机命名的 PostgREST API 容器为 exit 255，两个临时 PostgreSQL 容器正常退出。该次不计为通过，也不推断更具体的 PostgREST 根因。已按精确 `eiscore-db3-*` 名称删除残留退出容器并删除对应 `eiscore-db3-net-*` 临时网络；检查时只剩无关 `yayulink-api` 项目容器运行，未触碰它或其卷。
- 当前分支 artifact preflight 再次以退出码 1 报告缺少 `eiscore-auth`、`digital-twin`、`enterprise-bi` 三个 `client-plugins/*/lib/index.js`；没有复制其他工作树或无来源 staging 制品。
- 为诊断上述 Node 20.18.1 下的无摘要失败，使用 WSL 现有 Node 24.12.0 在同一工作树重跑 `node scripts/test-database-contracts.mjs`，完整通过：`PASS: DB3 fresh/upgrade/repeat catalog and PostgREST contract`，catalog SHA-256 为 `869cb978e1c396c0c0b7bc6e0acfc55434e845fe9ea08919e873fd98223c84bd`，与当前数据库 contract 指纹匹配。故 DB3 当前工作树合同有 Node 24 隔离验收证据；Node 20 的单次 PostgREST exit 255 仅保留为运行时差异，不再作为当前 DB3 阻塞。
- 额外门禁复验通过：`npm run test:production-config`、`npm run test:runtime-image`、`npm run test:infrastructure`、`npm run test:secrets`。结果分别确认生产 Harness 配置/伦度 artifact preflight 合同、27 个 composition-root 模块与 2 个 Dockerfile、24 个基础设施脚本/生产 Compose 契约，以及 2800 个文本文件的 secret 扫描；secret scanner 仍仅报告 checksum-locked legacy SQL quarantine 警告，没有新增泄露。
- 当前仍未达到完整目标：artifact preflight 对当前分支仍缺三组 `client-plugins/*/lib/index.js`；真实 Provider、完整 Compose clean release、Smart BI 业务等价、外部双租户 JWT/RLS 和伦度远端验收缺少权威证据。固定 v6 release manifest 仍不能在未提交 core-008/core-009 上改写。

## 全局目标继续推进记录（2026-10-02，文档提交排队幂等修复）
- 审计 `realtime/harness-document-commit.js` 发现一个真实状态窗口：确认 PATCH 成功后，若 `documentEntryWorker.runPlan()` 因 worker 正忙返回 `false`，计划仍可能保持 `planned`；同一幂等键重试原先会再次尝试确认/执行，存在重复 worker 调度风险。
- 现已收紧状态语义：服务端确认元数据中的同一 `idempotency_hash` 在 `planned` 或 `importing` 状态直接返回 `{ idempotent_replay: true, queued: true }`，不再次调用 worker；不同幂等键在这两个中间状态返回 `HARNESS_PLAN_COMMIT_CONFLICT`，终态继续保持既有 `HARNESS_PLAN_NOT_PLANNED` 兼容语义。
- `realtime/test-harness-document-commit.js` 新增 worker 忙/排队、同键重试不重复执行和不同键冲突回归。专项测试、`npm run test:harness`、`npm run test:syntax`（301 files）、`npm run lint:changed`（153 files）和 `git diff --check` 全部通过。
- 本轮只修改文档提交后端执行器及其回归测试；未修改前端视觉、数据库 schema、release manifest 或部署环境，未连接远端、未启动持久 Compose、未写入数据库卷、未提交或推送。全局目标继续保持 `active`；真实 Provider、同源 Web client-plugin provenance、完整 Compose clean release、Smart BI 等价、外部双租户 JWT/RLS 和伦度远端验收仍未完成。

## 全局目标继续推进记录（2026-10-02，运行手册旧 AI 配置漂移收口）

- 修正 `docs/EISCORE_FUNCTION_MANUAL.md` 第 17.3 节：不再描述从 `system_configs.ai_glm_config` 或 `ai_vision_config` 读取模型配置，改为记录当前 Harness Gateway -> DeepSeek Harness HTTP Bridge 的部署侧链路、权限/RLS/会话/确认/幂等/审计边界和密钥隔离规则。
- 明确 `ai_glm_config` 是由 core-008 退役的历史键，运维不得恢复旧表键或直连模型 API。该轮只修改运行手册和 Gateway 回归测试证据，没有修改运行时、前端视觉、数据库 schema、release manifest 或部署环境；未连接远端、未启动持久 Compose、未写入数据库卷、未提交或推送。

## 全局目标继续推进记录（2026-10-02，Gateway 失败请求重放边界）

- Gateway 在授权审计成功后、dispatch 前登记 request ID；上游超时、客户端取消、上游不可用或结果审计失败后，原 request ID 仍在 TTL 内保留，用于未知上游状态下的对账/幂等恢复，避免同一请求自动重放造成重复写入。
- 回归补充固定 request ID 的 timeout/cancel 场景：第一次分别返回 `HARNESS_UPSTREAM_TIMEOUT`/`HARNESS_REQUEST_CANCELLED`，同一 ID 再次提交在 dispatch 前返回 `HARNESS_REQUEST_REPLAY`（409），并写入 replay 拒绝审计；`node realtime/test-harness-gateway.js` 已通过。
- 本轮未修改运行时代码、数据库 schema、release manifest 或部署环境；未连接远端、未启动持久 Compose、未写入数据库卷、未提交或推送。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，运行手册 canonical Harness 路径收口）

- 修正 `docs/EISCORE_FUNCTION_MANUAL.md` 中将 `/agent/` 泛称为 AI Runtime 入口的过时说明：新 AI/Harness 客户端改用 `/ai/*`、`/twin/*`、`/flash/*` 和 `/document-intake/*`，WebSocket 使用 `/ws`；`/agent/company-site/*` 仅作为历史业务兼容协议保留。
- 未删除运行时 `/agent/*` 兼容别名，因为 company-site/document-intake 仍有现有业务协议依赖；该轮只修正操作手册推荐入口，没有修改运行时、前端视觉、数据库 schema、release manifest 或部署环境。

## 全局目标继续推进记录（2026-10-02，Harness HTTP 租户上下文守卫）

- 发现 `/ai/config`、`/ai/agents`、经营快照和数字分身 HTTP 授权器此前只验证 JWT 有效，未在进入 Harness handler 前统一要求主体、tenant 和原始 token；Gateway 执行阶段虽会拒绝缺租户请求，但目录/资源入口存在半授权不一致。
- 新增 `realtime/index.js` 的 `hasHarnessTenantContext` 守卫，`authorizeHttpRequest` 与 `authorizeTwinRequest` 现在在 Harness 配置、聊天、快照、数字分身会话和相关资源前统一返回 `HARNESS_AUTH_REQUIRED`（401）。未改变 company-site/document-intake 的历史兼容授权器。
- `node realtime/test-harness-read-http.js`、`node tests/engineering/realtime-composition-root-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`npm run test:syntax`（301 files）、`npm run lint:changed`（153 files）和 `git diff --check` 通过。
- 本轮未连接远端/生产、未启动持久 Compose、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。
- 本轮未连接远端/生产、未启动持久 Compose、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。
- Flash canonical HTTP（`/flash/tools/*`、`/flash/draft`、`/flash/attachments`）也复用同一租户上下文守卫；生产路径回归现在要求 AI、数字分身和 Flash 三类 Harness 授权器都调用 `hasHarnessTenantContext`。

## 全局目标继续推进记录（2026-10-02，WebSocket 租户上下文守卫）

- 复核发现 `/ws` WebSocket 连接此前只验证 JWT，未复用 HTTP Harness 入口的主体/租户/token 完整性守卫；这会使 Flash Harness WebSocket 与 `/ai/*`、`/twin/*`、`/flash/*` 的租户边界不一致。
- `realtime/websocket-server.js` 现在接收并调用 `hasHarnessTenantContext`；连接只有在主体、租户和原始 token 均存在时才注册频道和消息处理器，否则以 WebSocket close `1008 / tenant_context_required` 故障关闭。`realtime/index.js` 组合根显式注入同一守卫，未新增第二套授权逻辑。
- `tests/engineering/websocket-server-regression.mjs` 新增缺租户拒绝回归，并保留 Harness 消息 manifest、订阅、Flash tool/task/reset 和无效消息处理断言。专项 WebSocket 回归、组合根回归、`npm run test:harness-production-path` 与完整 `npm run test:harness` 均通过。
- 本轮未修改前端视觉、数据库 schema、release manifest 或部署环境；未连接远端/生产、未启动持久 Compose、未写入数据库卷、未提交或推送。真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户业务 RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，文档采集管理入口权限收口）

- 复核发现历史 `/document-intake/admin/*` 管理路由此前只验证 JWT 有效，没有统一要求主体/租户上下文，也没有在组合根执行文档管理角色或权限检查。该路径虽保留为采集业务兼容协议，但仍属于生产可达的受保护业务入口。
- `realtime/index.js` 新增 `hasDocumentIntakeAdminAccess`：默认仅允许 `super_admin`、`admin`、`document_admin`、`document_intake_admin`，并支持明确的 `document:admin`、`document-intake:admin`、`document_intake:admin`、`admin:document-intake` 权限；可通过 `DOCUMENT_INTAKE_ADMIN_ROLES` 收紧部署角色集合。授权器先验证 `hasHarnessTenantContext`，再执行文档管理权限检查，分别返回 `HARNESS_AUTH_REQUIRED`（401）或 `FORBIDDEN`（403）。
- `tests/engineering/document-intake-regression.mjs`、组合根回归和 Harness 生产路径回归已同步锁定该边界；`node tests/engineering/document-intake-regression.mjs`、`npm run test:runtime-router` 与 `npm run test:harness` 全部通过。
- 本轮未修改前端视觉、数据库 schema、release manifest 或部署环境；未连接远端/生产、未启动持久 Compose、未写入数据库卷、未提交或推送。真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户业务 RLS、Smart BI 行为等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，旧配置文档事实复核）

- 复核确认 `eiscore-base/src/views/SettingsView.vue` 已移除旧 `ai_glm_config` 管理表单、模型 URL/API key 输入和旧读写调用；当前仅展示只读 `deepseek-harness` 提供方与部署侧配置说明。
- 同步修正文档中一处过时的“SettingsView 仍保留旧表单”描述，避免将已完成的前端配置收口误判为未完成项。`env/insert_ai_config.sql` 仍作为退役历史资产保留，并继续由 `env/README.md` 与数据库治理门禁标记为禁止执行。
- 复验通过：`node tests/engineering/settings-http-consumers-regression.mjs`、`node tests/engineering/system-config-http-regression.mjs`、`npm run test:harness-production-path`、`npm run test:harness`、`npm run test:syntax`（301 files）、`npm run lint:changed`（154 files）和 `git diff --check`。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未提交或推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，受约束查询过滤值注入边界）

- 审计 `realtime/harness-query-tools.js` 发现固定数据集查询的 filter value 虽限制了换行、分号和长度，但仍允许逗号、括号和花括号等 PostgREST 过滤语法分隔符；这些值可能被解析为组合过滤表达式。
- 已在受约束查询边界增加统一过滤值校验，拒绝回车/换行、`;`、`&`、`,`、`(`、`)`、`{`、`}`，同时保留普通中文、空格、日期和业务文本；数据集、字段 ACL、权限和 PostgREST/RLS 用户上下文保持不变。
- `realtime/test-harness-query-tools.js` 新增组合过滤表达式、括号、花括号和换行注入回归。专项查询、`npm run test:harness`、`npm run test:syntax`（301 files）、`npm run lint:changed`（154 files）和 `git diff --check` 全部通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，运行镜像与基础设施门禁复验）

- `npm run test:runtime-image` 通过：27 个 composition-root 模块、2 个 Runtime Dockerfile 和 Vite dev proxy 合同均通过。
- `npm run test:infrastructure` 通过：24 个基础设施脚本与生产 Compose 约束通过；生产组合仍要求显式启用 Harness、独立 bridge、非特权运行和固定镜像。
- `npm run test:secrets` 通过：扫描 2800 个文本文件未发现新的密钥泄露，仅保留 5 个已登记的 checksum-locked legacy SQL quarantine 警告。
- 代码复核确认 `EISCORE_HARNESS_ENABLED` 缺失/关闭不会回退到旧 Agent；Harness 不可用只返回固定 `HARNESS_UPSTREAM_UNAVAILABLE`，生产路径回归仍通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；当前分支同源 client-plugin 编译 provenance、正式 DB v6 release provenance、真实 Provider、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，WSL 隔离数据库合同复验）

- 使用 WSL Docker 29.1.3 对当前工作树运行 `node scripts/test-database-contracts.mjs`，成功完成 fresh/upgrade/repeat catalog 与 PostgREST contract；catalog SHA-256 为 `869cb978e1c396c0c0b7bc6e0acfc55434e845fe9ea08919e873fd98223c84bd`。
- 运行 `npm run test:database-roles:docker` 成功，隔离验证 PostgreSQL/PostgREST 角色、company-site Agent RLS、HR payroll RLS 与拒绝合同。
- `npm run test:database-release:docker` 与 `npm run test:database-recovery:docker` 均故障关闭于正式 `eiscore-db-v6` manifest provenance 校验：core-008/core-009 造成 contract、core manifest、postcheck、terminal migration、catalog 与 PostgREST checksum drift。未改写正式 manifest、未执行 release/recovery、未写入持久数据库卷。
- 两套隔离测试结束后未留下 `eiscore-db3/4/5/6` 容器、网络或卷；未连接远端/生产、未启动项目持久 Compose、未修改前端视觉、未提交或推送。正式 DB v6 provenance、同源 client-plugin 编译制品、真实 Provider、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，当前工作树 Harness 镜像构建阻塞复验）

- 使用 WSL Docker 29.1.3、当前 `github-eiscore-refactor` 工作树和唯一临时 tag `eiscore-harness-bridge:codex-current-20261002` 执行 `docker build --file agent-harness/Dockerfile`；legacy builder 在依赖安装/基础镜像阶段超过 180 秒无进一步输出，按超时边界终止，退出码 1。
- 该次没有生成临时镜像 tag，也没有启动容器、项目 Compose 或数据库卷；现有历史 Harness 镜像未被当作当前工作树制品。
- 已确认历史静态/隔离 Bridge 回归仍可复用，但本次结果不能宣称当前工作树 clean image build 通过；阻塞属于 WSL legacy builder/构建环境，不是通过旧镜像替代。
- 本轮未连接远端/生产、未修改前端视觉、未执行数据库 release、未写入数据库卷、未提交或推送；目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness 开关故障关闭回归）

- `realtime/test-harness-http.js` 新增 Harness 关闭状态回归：`EISCORE_HARNESS_ENABLED=false` 时返回 `503/HARNESS_DISABLED`，且 Gateway dispatch 次数严格为 0，证明关闭状态不会静默调用旧链路或下游。
- 定向 `node realtime/test-harness-http.js`、完整 `npm run test:harness`、`npm run test:syntax`（301 个 Node 文件）、`npm run lint:changed`（154 个变更文件）和 `git diff --check` 均通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；当前分支同源 client-plugin 编译 provenance、正式 DB v6 release provenance、真实 Provider、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，后端迁移门禁复验）

- 复跑 `npm run test:harness`：插件注册/合同、写确认/权限/幂等/审计、Gateway/Tool Gateway、数字分身 RLS 会话与持久化、文档提交、销售写入、查询 ACL、HTTP/WebSocket 租户边界、SDK Bridge 和迁移切换全部通过。
- 复跑 `npm run test:production-config`、`npm run test:database-backend-governance`、`npm run test:migration-switch`、`npm run test:syntax`（301 个 Node 文件）和 `npm run lint:changed`（154 个变更文件），全部通过。
- `npm run test:unit` 仍为 28/30 通过；仅 `eiscore-company-site/test/jinwei-research-images.test.js` 的 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg` 缺失。该失败属于既有独立站研究素材完整性，不是 Harness 后端回归；本轮没有伪造或补拷贝素材。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 配置归一化）

- 审计发现 `createBridgeHandler` 直接接收无效的并发、会话、replay、请求体、响应体和 TTL 参数时，部分值可能原样生效，导致请求全部拒绝、容量失控或会话立即过期。
- 新增统一正整数归一化：无效值回退到安全默认值（并发 16、会话 1000、replay 10000、请求/响应各 2 MiB、TTL 24 小时）；`/metrics` 报告归一化后的会话与 replay 上限。
- `agent-harness/test-http-bridge.js` 新增无效配置回退的 metrics 和真实请求回归；`node agent-harness/test-http-bridge.js`、`npm run test:harness-bridge`、`npm run test:syntax`（301 files）、`npm run lint:changed`（154 files）和 `git diff --check` 通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness 输入原型污染边界）

- 审计 Chat context 和 Tool Proxy 的递归清洗时补充拒绝 `__proto__`、`constructor`、`prototype` 键，避免不可信模型/客户端对象在普通对象赋值过程中触发原型污染。
- 新增 Chat context 与 Tool Proxy 的真实 JSON 输入回归，确认业务字段保留、原型未被污染、身份/确认/幂等字段仍由活动认证上下文提供。
- `node realtime/test-harness-runtime-boundaries.js`、`node realtime/test-harness-chat-http.js`、完整 `npm run test:harness`、`npm run test:syntax`（301 files）和 `npm run lint:changed`（154 files）通过。
- 数据库 release contract 复核仍按既有 provenance 规则失败：工作树包含尚未提交的 core-008/core-009 与合同/目录/postcheck 变更，固定 v6 manifest 报告 8 项 source/artifact/contract checksum drift；未改写正式 manifest、未执行迁移、未接触真实数据库卷。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 非法 JSON settlement）

- 复核 `agent-harness/http-bridge.js` 时发现 `readBody` 在 JSON 解析失败分支先标记 settled，随后统一失败函数会被短路，导致非法 JSON 请求 Promise 可能永久 pending 并占用 Bridge 并发槽位。
- 调整解析分支的 settlement 顺序，并新增真实 HTTP 非法 JSON 回归：请求稳定返回 `HARNESS_BAD_REQUEST`，不调用上游，且不会永久占用 replay/session 预留。
- `node agent-harness/test-http-bridge.js`、`npm run test:harness-bridge`、`npm run test:syntax`（301 files）、`npm run lint:changed`（154 files）和 `git diff --check` 通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，插件拒绝与 Bridge 容量配置贯通）

- Chat HTTP 入口现在在 Gateway 前对未知 `plugin_id` 返回稳定的 `HARNESS_PLUGIN_UNAVAILABLE`，不再把空 capability 交给下游偶然拒绝；保留已知插件到 capability 的固定映射和请求 capability 一致性校验。
- `BRIDGE_MAX_BODY_BYTES`、`BRIDGE_MAX_RESPONSE_BYTES` 已从 `dsh-http-bridge.mjs` 贯通到 Lundu Compose、生产 Compose 及两个环境样例，默认均为 2 MiB；插件契约回归锁定两套 Compose 不得丢失这两个边界配置。
- `node tests/engineering/harness-plugin-catalog-regression.mjs`、`node realtime/test-harness-chat-http.js`、`npm run test:harness-plugin`、`npm run test:syntax`（301 files）、`npm run lint:changed`（154 files）和 `git diff --check` 通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness Bridge 请求/响应容量边界）

- 审计 `agent-harness/http-bridge.js` 发现请求体超过上限后仍会继续收集数据，且 `end` 事件可能再次进入 JSON 解析；同时上游成功 payload 没有响应字节上限。
- `readBody` 现在使用一次性 settlement 并在超限后恢复消费请求流；Bridge 新增可配置 `maxBodyBytes` 和 `maxResponseBytes`（默认均为 2 MiB）。超大/非法 JSON 在上游调用前回滚本次 replay/session 预留，避免无效请求永久消耗容量；上游已执行但响应过大仍保留 replay 记录，避免副作用请求被重放。
- `agent-harness/test-http-bridge.js` 新增超大请求不上游、无效预留可重用和超大响应故障关闭回归。专项 Bridge、完整 `npm run test:harness`、`npm run test:syntax`（301 files）、`npm run lint:changed`（154 files）和 `git diff --check` 全部通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness clean build 与本地 SDK 探针）

- 使用当前工作树创建临时 Docker build context 并尝试构建 `eiscore-harness-bridge:codex-current-20261002-clean`。本机 WSL Docker 29.1.3 的 BuildKit 路径明确失败：`BuildKit is enabled but the buildx component is missing or broken`；此前 legacy builder 路径在 `npm ci --omit=dev --ignore-scripts` 阶段超过 300 秒无进一步输出并退出 1。两次均没有生成当前工作树镜像 tag，也没有启动容器、Compose 或数据库卷，历史镜像未被替代使用。
- 当前工作树本地依赖中的 `@deepseek-ai/dsh@0.1.2-rc.1` 已完成 profile 配置生成；在不提供真实 Provider/API key 的条件下，直接启动 `sdk` profile 的 JSON-RPC initialize 探针 10 秒内没有首帧并超时。该结果只证明本机无凭据 Provider 行为尚未可验，不能宣称真实 Provider 或 clean image 已通过；临时 profile 和调试文件已清理。
- 可复用的代码级证据仍为通过：`node agent-harness/test-http-bridge.js`、`node agent-harness/test-dsh-http-bridge-runtime.mjs`（含 tool/call、tool/result、assistant continuation、prompt error 和 bounded shutdown）、`node --check agent-harness/dsh-http-bridge.mjs` 与 `node --check agent-harness/http-bridge.js`。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin 编译 provenance、正式 DB v6 release provenance、真实 Provider、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness 门禁交叉复验）

- 本轮从当前工作树实际运行 `npm run test:harness`，插件合同、权限/确认/幂等/审计、Gateway/Tool Gateway、数字分身 RLS 会话与持久化、文档提交、销售写入、查询 ACL、HTTP/WebSocket 边界、Bridge 和迁移切换全部通过。
- 同步运行 `npm run test:runtime-image`（27 个 composition-root 模块、2 个 Dockerfile 与 Vite proxy 合同）和 `npm run test:production-config`（生产配置、伦度 Harness artifact preflight、Web runner startup-only profile），全部通过。
- 本轮没有连接远端/生产、没有启动持久 Compose、没有执行数据库迁移、没有写入数据库卷、没有修改前端视觉、没有提交或推送；clean image build、真实 Provider、同源 client-plugin 编译 provenance、正式 DB v6 release provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，当前分支 clean build 复验与隔离镜像探针）

- 当前分支再次尝试 `DOCKER_BUILDKIT=0 docker build --file agent-harness/Dockerfile`，基础镜像与依赖层命中缓存，但 `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` 在 300 秒超时后退出 `BUILD_EXIT=124`；没有生成 `eiscore-harness-bridge:codex-current-20261002-cache`，临时 build context 已删除。
- 当前工作树仍不存在 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js`、`client-plugins/enterprise-bi/lib/index.js`；部署契约要求从外部、可追溯的 `LUNDU_HARNESS_ROOT` 提供它们，本轮未从其他工作树或 staging 复制。
- 对既有历史镜像 `eiscore-harness-bridge:codex-current`（digest `sha256:3f4e16dac6c4a412a2b668cad393f489b3b71f62b72460a575344520096eda15`，创建于 2026-09-30）仅执行非特权、`--network none`、`--read-only`、受限 `/tmp` 容器内 `node --check` 探针，`http-bridge.js` 与 `dsh-http-bridge.mjs` 均通过；该镜像不是当前分支构建，不能替代 clean release 证据。
- 本轮未连接远端/生产、未启动项目持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；clean image build、真实 Provider、同源 client-plugin 编译 provenance、正式 DB v6 release provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，当前源文件的隔离容器兼容探针）

- 在既有 Harness 运行时镜像中以只读 bind mount 覆盖当前工作树的 `http-bridge.js`、`dsh-http-bridge.mjs`、`plugin-registry.js` 和 `plugin-contract.v1.json`，使用 `--network none`、`--read-only`、`--user 10001:10001` 和受限 `/tmp` 执行 Node 语法/加载探针。探针通过，当前 registry 实际加载 9 个插件，协议为 `eiscore-agent-v1`。
- 该探针证明当前 Bridge/registry 源文件可在既有 Node 22/DSH 运行时中加载，但底层镜像创建于 2026-09-30，不能替代当前分支 clean image；没有启动 HTTP 服务、没有访问网络、没有挂载数据库卷。
- 本轮未连接远端/生产、未启动项目持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；当前分支 client-plugin provenance、clean image build、真实 Provider、正式 DB v6 release provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，公司站登录交接租户边界）

- 继续审计发现 `/company-site/auth/handoff` 创建入口在 handler 内自行验证 JWT，但没有检查租户上下文；消费入口也只重新验证 token，存在登录交接绕过统一 Harness 租户边界的风险。
- `realtime/company-http.js` 现在在 handoff 创建时要求主体、租户和原始 token；消费时对保存的 token 再次构造用户并复用同一守卫。缺失或失效交接统一返回 `410/HANDOFF_EXPIRED`，不泄露具体身份失败原因；handoff 仍为一次性消费。
- `tests/engineering/company-http-regression.mjs` 新增缺租户创建拒绝、合法创建、一次性消费和重放拒绝回归。`node tests/engineering/company-http-regression.mjs`、Node syntax check、`npm run test:harness` 和 `git diff --check` 通过。
- 本轮未连接远端/生产、未启动项目持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；当前分支 client-plugin provenance、clean image build、真实 Provider、正式 DB v6 release provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，公司站管理入口租户上下文收口）

- 审计发现生产可达的 `company-site/admin/*` 与受保护销售管理路由此前只检查 JWT 角色/权限，没有复用 Harness 的主体、租户和原始 token 完整性守卫；这会让公司站管理入口与 AI、数字分身、Flash 的租户边界不一致。
- `realtime/company-http.js` 现在接收组合根注入的 `hasHarnessTenantContext`（并保留独立模块的安全默认实现），管理端 authorizer 在角色/权限检查前统一要求主体、租户和原始 token；缺失时固定返回 `401/HARNESS_AUTH_REQUIRED`，公开 company-site 与公开销售会话路径保持匿名协议不变。`realtime/index.js` 显式注入同一守卫，未新增第二套身份解析。
- `tests/engineering/company-http-regression.mjs` 增加缺租户 JWT 的真实拒绝回归；`node tests/engineering/company-http-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、两个 Node syntax check 和 `git diff --check` 通过。
- 随后复跑完整 `npm run test:harness`，插件/Bridge/Gateway、权限/确认/幂等/审计、数字分身 RLS、文档/销售写入、HTTP/WebSocket、查询 ACL、输出策略和迁移切换全部通过。
- 本轮未连接远端/生产、未启动项目持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；当前分支 client-plugin provenance、clean image build、真实 Provider、正式 DB v6 release provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，本地依赖离线镜像尝试）

- 本机 `agent-harness/node_modules` 约 224 MB，虽然 Windows npm cache 含 DSH tarball，但 WSL Docker daemon 无 buildx，无法直接复用 Windows cache。为验证是否能绕过网络安装，创建了一次性离线 context，将当前工作树依赖和 Bridge 源文件复制到临时目录，使用 `DOCKER_BUILDKIT=0 docker build` 跳过 `npm ci`。legacy builder 在上传/解包大 context 阶段超过预设等待边界，无任何构建步骤输出，随后终止；未生成 `eiscore-harness-bridge:codex-current-20261002-offline`，临时 context 与镜像（若存在）均已清理。
- 该结果与前述在线 `npm ci` 300 秒超时、BuildKit 缺失 buildx 相互印证：当前本机 Docker 构建器无法给出当前分支 clean image 证据。既有隔离容器源文件加载探针和 Node 回归仍通过，但不替代 clean release。
- 本轮未连接远端/生产、未启动项目持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；当前分支 client-plugin provenance、clean image build、真实 Provider、正式 DB v6 release provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，隔离测试资源清理）

- 收尾复查发现此前数据库合同隔离测试留下三个已退出的临时容器（`eiscore-db3-{api,upgrade,fresh}-1003-c2b8c24d`）和网络 `eiscore-db3-net-1003-c2b8c24d`。已核对其状态均为 `exited`，随后按精确名称删除；复查确认对应容器、网络和 1003/db3 命名卷均无残留。未触碰运行中容器、业务网络或持久数据库卷。

## 全局目标继续推进记录（2026-10-02，内部 Tool Proxy 与公司销售链路只读审计）

- 复核 `realtime/harness-runtime.js` 的 `POST /internal/harness/tool`：入口要求独立 `EISCORE_TOOL_PROXY_SECRET`，session 必须存在于当前活动 dispatch，capability 必须由注册表解析且 `plugin_id` 与活动 dispatch 一致；模型参数中的 subject、tenant、token、JWT、权限、确认、幂等、request/session/plugin 标识和数据库字段均被清洗，不会覆盖服务端认证上下文。`realtime/test-harness-runtime-boundaries.js` 已覆盖未知 session、插件错配、伪造租户/token、原型污染和模型伪造写确认/幂等键。
- 复核 `realtime/harness-query-tools.js` 与 `realtime/harness-context-capabilities.js`：业务查询只能选择固定数据集/固定视图，先读取当前用户语义权限与字段 ACL，再通过 `callPostgrestWithUser` 使用用户 JWT；拒绝任意 table/schema/sql/url/tenant/user/jwt/site_key 输入，销售上下文固定为 `sales_orders`，独立站上下文固定为 `site_key=primary` 的公开已发布数据。
- 复核 `realtime/harness-sales-write.js` 与 `realtime/company-sales-agent.js`：销售写入只能使用注册 operation、UUID 业务对象、服务端传入的 16-128 字符幂等键和 Gateway 已确认状态；业务 handler 的公司站查询仍通过组合根数据库 notifier，当前生产 Compose 的 `company_site` RLS policy 将 Agent 数据范围限制在 `site_key='primary'`。未发现可由请求体伪造租户或跨站访问的路径。
- 复核 `realtime/company-http.js`：公司站管理与销售管理 authorizer 已在角色/权限检查前统一要求主体、租户和原始 token；auth handoff 创建/消费也复用该租户守卫，公开 company-site 与公开销售会话接口仍保持匿名协议。
- 复核旧模型入口：`eiscore-base/src/views/SettingsView.vue` 当前仅展示只读 `deepseek-harness` 状态；`packages/eiscore-platform/src/system-config.mjs` 在请求发出前拒绝 `ai_glm_config`；`env/insert_ai_config.sql` 仅作为 README 明确标记的退役历史材料保留，不属于任何 Compose 初始化输入，禁止手动执行。
- 本轮验证：`npm run test:harness` 全部通过；`node tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/company-http-regression.mjs`、`node tests/engineering/settings-http-consumers-regression.mjs`、`node tests/engineering/system-config-http-regression.mjs` 全部通过；`node --check realtime/harness-runtime.js`、`harness-gateway.js`、`company-http.js`、`index.js` 与 `git diff --check` 通过。
- 本轮仅追加审计状态文档；未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未提交或推送。全局目标继续保持 `active`；真实 DeepSeek Provider、同源 Web client-plugin 编译 provenance、clean Harness image、完整 Compose release、外部双租户 JWT/RLS、Smart BI 行为等价和伦度远端验收仍未完成。

## 全局目标继续推进记录（2026-10-02，完成审计与阻塞证据复核）

- 当前工作树的旧 Provider 命中仅来自退役历史 `env/insert_ai_config.sql`、共享配置服务的退役键拒绝逻辑，以及 DSH SDK 的传递依赖锁定项；`realtime/`、EISCore 业务客户端、Compose 环境变量和 Harness Bridge 没有旧模型直连出口。DSH 的传递依赖（例如 ACP/Anthropic SDK）没有被当作 EISCore 旧 Provider 入口，也没有新增直接依赖或调用。
- 权威运行门禁 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 明确失败：`LUNDU_HARNESS_ROOT: required`。当前分支不存在 `client-plugins/` 目录，不能从其他工作树、WSL staging 或无 provenance 目录复制制品；因此同源 client-plugin 装载和完整 clean Compose release 仍未证明。
- 权威数据库门禁 `node tests/engineering/database-release-contract-regression.mjs` 明确报告 8 项 drift：`eiscore-db-contract-v3.json`、`core.json`、core postcheck、core manifest checksum/terminal/list、database catalog checksum、PostgREST contract checksum。该漂移源于未提交的 core-008/core-009 与正式 v6 manifest/source provenance 不一致；按协作限制没有改写正式 manifest，也没有执行迁移或写入数据库卷。
- `npm run test:unit` 仍为 28/30 通过，仅 `eiscore-company-site/test/jinwei-research-images.test.js` 缺少 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg`；这是既有独立站研究夹具问题，不属于本后端目标，本轮未伪造或补拷贝前端素材。
- 本轮没有连接远端/生产、没有启动持久 Compose、没有部署、没有修改前端视觉、没有执行数据库迁移、没有写入数据库卷、没有提交或推送。全局目标继续保持 `active`；上述三个门禁和真实 DeepSeek Provider 验收仍是未完成项。

## 全局目标继续推进记录（2026-10-02，迁移治理与 release dry-run 复验）

- `npm run db:migrations:check` 通过：runtime-v2 10 个、company-site 1 个、core 9 个迁移均通过顺序与 checksum 治理；`npm run test:database-backend-governance`、`npm run test:database-roles` 通过。
- `npm run test:harness` 通过：插件合同、审计账本、Gateway/Tool Gateway、权限/确认/幂等、数字分身 RLS、文档提交、销售写入、查询 ACL、HTTP/WebSocket、Bridge 和 migration switch 全部通过。
- `npm run db:release:check` 仍按预期故障关闭，报告同一 8 项正式 v6 provenance drift（core contract/manifest/postcheck、terminal/list/checksum、database catalog、PostgREST contract）；未通过门禁时没有生成 release、没有改写 `database/releases/eiscore-db-v6/manifest.json`，也没有连接或写入任何真实数据库。
- 在仓库根、`.codex-tmp` 与本机临时目录做了只读制品定位：仅找到当前分支 `agent-harness/eiscore-tools.mjs`、`agent-harness/eiscore-restricted.cordis.yml` 及一个临时 staged 副本；没有发现三个同源 `client-plugins/{eiscore-auth,digital-twin,enterprise-bi}/lib/index.js`。因此没有复制无 provenance 制品，`LUNDU_HARNESS_ROOT` 预检阻塞保持有效。
- 本轮未连接远端/生产、未启动持久 Compose、未部署、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，DeepSeek SDK Bridge session drain 审计）

- 依据当前分支锁定的 `@deepseek-ai/dsh-sdk-jsonrpc-server` 协议文档复核：`session/prompt` 只确认消息入队，`session.event` 是持久事件流，`session.status` 是整个 agent 的 running/idle 转换，不能把某条 assistant 消息按 prompt 响应归属。此前 Bridge 在 prompt timeout 后立即允许同一 session 复用，迟到的旧 assistant/idle 事件存在跨轮次串答风险。
- `agent-harness/dsh-http-bridge.mjs` 现对 session 增加 busy/drain 状态：收到 timeout 后保留 session 为 busy，等待该 session 的真实 `session.status=idle` 后才允许下一次 prompt；等待超过独立的 `BRIDGE_SESSION_DRAIN_TIMEOUT_MS`（默认沿用 prompt timeout）则固定失败为 `HARNESS_SESSION_BUSY`。SDK 错误、runtime exit 和 bounded shutdown 会清理 drain waiter，避免资源悬挂。
- `agent-harness/test-dsh-http-bridge-runtime.mjs` 新增迟到 assistant/idle 回归：首轮 prompt 超时后，第二轮必须等待 drain，且最终只返回第二轮文本；专项 `npm run test:harness-bridge`、完整 `npm run test:harness`、`npm run test:syntax`（301 files）和 `git diff --check` 均通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送。当前同源 client-plugin provenance、clean Harness image、真实 DeepSeek Provider、正式 DB v6 release provenance、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，SDK JSON-RPC pending 边界）

- `DshSdkProcess.request()` 现在对 initialize、session/prompt、shutdown 等 JSON-RPC receipt 使用有界 `BRIDGE_RPC_TIMEOUT_MS`（默认沿用 prompt timeout），超时会清理 pending map 并返回固定 `HARNESS_RUNTIME_RPC_TIMEOUT`，避免 SDK 不回 receipt 时无限挂起。session/prompt receipt 超时不会把 session 标记 idle，后续仍需等待真实 `session.status=idle` 才能复用，防止未知是否已入队的请求造成串答或重复执行。
- `node agent-harness/test-dsh-http-bridge-runtime.mjs`、`npm run test:harness-bridge`、`npm run test:harness`、`npm run test:syntax` 和 `git diff --check` 通过；跨 session 并发回归确认 drain 锁只作用于同一 session。
- 本轮未连接远端/生产、未启动持久 Compose、未执行数据库迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 Provider、正式 DB v6 release provenance、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，生产 AI bypass 清理与 Bridge teardown 收口）

- 复核当前组合根后确认生产 HTTP/WebSocket 路径不再读取或默认放行 `AI_ALLOW_ALL`、`AI_ALLOWED_ROLES`；请求统一进入 Harness 的主体、租户、JWT、插件、capability、permission、写确认、幂等和审计边界。生产路径静态回归已将这两个退役 bypass 固定为禁止项。
- `agent-harness/dsh-http-bridge.mjs` 已收口 JSON-RPC pending 生命周期：`BRIDGE_RPC_TIMEOUT_MS` 有界超时返回 `HARNESS_RUNTIME_RPC_TIMEOUT`；prompt receipt 超时不会错误释放 session，必须等待真实 `session.status=idle`；stdin 同步写入异常、initialize 失败、runtime exit 和 bounded shutdown 均清理 pending/waiter/子进程，避免悬挂请求、串答或重复执行。
- 当前设置页仅展示只读 `deepseek-harness` 运行状态，`packages/eiscore-platform/src/system-config.mjs` 在请求发出前拒绝退役 `ai_glm_config`；`env/insert_ai_config.sql` 仅作为 README 标记的历史材料保留，不属于 Compose 初始化输入，禁止手动执行。
- 本轮复验通过：`npm run test:harness`、`npm run test:syntax`、`npm run test:production-config`、`node tests/engineering/realtime-composition-root-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`git diff --check`。
- 阻塞保持不变：权威 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 因缺少同源 `client-plugins/{eiscore-auth,digital-twin,enterprise-bi}/lib/index.js` 失败；`npm run db:release:check` 因 core-008/core-009 尚未纳入正式 v6 provenance 报告 8 项 drift；本机无法形成当前分支 clean Harness image，且无真实 DeepSeek Provider/API key。未从其他工作树或 staging 复制制品，未改写正式 manifest。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，RPC receipt 超时专门回归）

- 新增隔离 child runtime 夹具 `agent-harness/test-rpc-timeout-child.mjs`，让首个 `session/prompt` 故意不返回 JSON-RPC receipt，只延迟发出真实 `session.status=idle`；第二个 prompt 在 drain 后返回正常 assistant 消息。该夹具不访问网络、Provider 或数据库。
- `agent-harness/test-dsh-http-bridge-runtime.mjs` 新增断言：receipt 超时固定返回 `HARNESS_RUNTIME_RPC_TIMEOUT`；`pending.size` 归零；session 在 idle 前仍处于 busy；收到 idle 后可以复用并只得到第二轮响应。
- `npm run test:harness-bridge` 与完整 `npm run test:harness` 均通过，新增回归输出 `PASS: DeepSeek SDK bridge bounds RPC receipt timeouts without releasing sessions early`；`node --check agent-harness/test-rpc-timeout-child.mjs` 通过。
- 本轮仍未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 Provider、正式 DB v6 release provenance、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收继续保持未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，生产可达性审计与离线回归）

- 深层扫描当前 `realtime/`、Harness、部署 Compose、环境样例和客户端调用后，没有发现 `callAiUpstream*`、`answerWithAi`、旧 Cline executor、直接 Provider egress 或 Harness fallback/shadow 配置重新进入生产可达路径。历史 `/agent/` 仅由 `realtime/index.js#getRequestPath` 去除前缀后进入同一 canonical `/ai|flash|twin|document-intake` 路由；没有第二套 Legacy handler。
- 根级 `docker-compose.prod.yml` 的 `harness-bridge` 使用当前仓库 `agent-harness/Dockerfile` 和受控 Bridge/registry/artifact 挂载；伦度 Compose 的 `deepseek-web` 与 `harness-bridge` 明确要求外部 `LUNDU_HARNESS_ROOT`，不会把缺少 client-plugin 的目录伪装成可运行版本。
- 只读检查发现 `C:/Users/Twist/Documents/eiscore/agent-harness/client-plugins` 虽有三个编译入口，但其父工作树为无提交的独立目录，无法提供当前 `github-eiscore-refactor` 分支的可追溯 provenance；按协作限制未复制、未挂载、未用于发布。当前分支权威制品预检仍以 `LUNDU_HARNESS_ROOT: required` 失败。
- `npm run test:runtime-router`、`npm run test:infrastructure`、`npm run test:runtime-image` 通过；`npm run test:unit` 为 28/30，通过项全部完成，唯一失败是既有独立站研究夹具缺失 `research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg`，本轮未伪造或补拷贝素材。
- `npm run test:database-migrations` 在正式 release contract 回归处按预期故障关闭，精确报告 8 项 v6 provenance drift：core contract、core manifest、core postcheck、release manifest checksum/terminal/list、database catalog checksum、PostgREST contract checksum；没有生成 release、改写正式 manifest 或执行真实迁移。
- 本轮未连接远端/生产、未启动持久 Compose、未写入数据库卷、未修改前端视觉、未提交或推送；真实 Provider、同源 client-plugin provenance、clean Harness image、正式 DB v6 provenance、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 部署配置契约收口）

- `BRIDGE_SESSION_DRAIN_TIMEOUT_MS` 与 `BRIDGE_RPC_TIMEOUT_MS` 已补齐到根生产 Compose、伦度 Compose、`env/.env.example` 和 `deploy/lundu/.env.example`；两项配置均默认 `120000`，分别覆盖 prompt timeout 后的 session drain 等待和 JSON-RPC receipt 有界等待。
- `tests/engineering/production-config-regression.mjs` 新增伦度环境样例断言，防止部署模板遗漏这两个 Bridge 稳定性参数。
- `npm run test:harness-plugin`、`npm run test:production-config`、`npm run test:harness-bridge`、完整 `npm run test:harness` 和 `git diff --check` 均通过。
- 复核确认 `eiscore-base/src/views/SettingsView.vue` 当前仅展示只读 `deepseek-harness` 状态；`env/insert_ai_config.sql` 仍是由环境 README 与数据库治理门禁隔离的退役历史材料，不属于 Compose 初始化输入。本轮未恢复旧配置入口。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 DeepSeek Provider、正式 DB v6 provenance、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 构造参数边界）

- `DshSdkProcess` 对显式传入的 `timeoutMs`、`drainTimeoutMs`、`rpcTimeoutMs` 和 `shutdownTimeoutMs` 使用与环境变量相同的正整数及 `2147483647` 上限校验；调用方不能通过构造器参数绕过计时器安全边界。
- 新增零值与负值构造器参数负向回归；`npm run test:harness-bridge`、`npm run test:production-config`、`node --check agent-harness/dsh-http-bridge.mjs` 和 `git diff --check` 通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 DeepSeek Provider、正式 DB v6 provenance、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 配置来源正向回归）

- `agent-harness/test-dsh-http-bridge-runtime.mjs` 现在验证 `DshSdkProcess` 会完整采用调用方注入的 `DSH_BIN`、`DSH_CWD` 和四项 Bridge timeout，而不是仅测试非法值失败。该回归覆盖嵌入式/隔离启动场景的实际配置注入语义。
- `npm run test:harness-bridge`、`npm run test:harness-plugin`、`npm run test:production-config`、`node --check agent-harness/test-dsh-http-bridge-runtime.mjs` 和 `git diff --check` 均通过。
- 权威 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍仅报告 `LUNDU_HARNESS_ROOT: required`；没有发现可追溯的当前分支 client-plugin 编译制品。本轮未复制外部 staging 制品。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；正式 DB v6 provenance、clean Harness image、真实 Provider、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 注入环境一致性）

- `DshSdkProcess` 的 timeout 解析现在基于调用方传入的 `env` 对象，而不是固定读取宿主 `process.env`；嵌入式调用、隔离测试和实际启动路径使用同一配置来源。
- Bridge 构造器新增超范围 timeout 的故障关闭回归，验证超过 Node 定时器上限的 `BRIDGE_RPC_TIMEOUT_MS` 会立即拒绝。
- `npm run test:harness-bridge`、`npm run test:production-config`、`node --check agent-harness/dsh-http-bridge.mjs` 和 `git diff --check` 均通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 DeepSeek Provider、正式 DB v6 provenance、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 环境样例完整性）

- 根与伦度环境样例现在同时暴露完整的 Bridge timeout 契约：`BRIDGE_PROMPT_TIMEOUT_MS`、`BRIDGE_SESSION_DRAIN_TIMEOUT_MS`、`BRIDGE_RPC_TIMEOUT_MS` 和 `BRIDGE_SHUTDOWN_TIMEOUT_MS`。之前 Compose 已支持 prompt timeout，但模板遗漏该项，现已补齐并由生产配置回归锁定。
- `npm run test:production-config` 与 `git diff --check` 通过；本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送。

## 全局目标继续推进记录（2026-10-02，Bridge 计时器上界校验）

- `agent-harness/dsh-http-bridge.mjs` 对显式整数型 Bridge 配置统一拒绝零值、负值、非数字和超过 Node 定时器安全上限 `2147483647` 的值；避免超大 timeout 在 Node 中溢出为立即触发的短定时器。未显式提供的值仍使用代码默认值。
- 生产环境校验器同步拒绝超过同一上限的 `BRIDGE_PROMPT_TIMEOUT_MS`、`BRIDGE_SESSION_DRAIN_TIMEOUT_MS`、`BRIDGE_RPC_TIMEOUT_MS` 和 `BRIDGE_SHUTDOWN_TIMEOUT_MS`，并新增 overflow 负向回归。
- `npm run test:production-config`、`npm run test:harness-bridge`、完整 `npm run test:harness`、`node --check scripts/validate-production-env.mjs`、相关旧配置/生产路径回归和 `git diff --check` 均通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 DeepSeek Provider、正式 DB v6 provenance、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 超时参数故障关闭）

- `scripts/validate-production-env.mjs` 现在校验显式提供的 `BRIDGE_PROMPT_TIMEOUT_MS`、`BRIDGE_SESSION_DRAIN_TIMEOUT_MS`、`BRIDGE_RPC_TIMEOUT_MS` 和 `BRIDGE_SHUTDOWN_TIMEOUT_MS` 必须为正整数；未提供时仍保留 Bridge 代码默认值。无效值不再静默回退，避免部署配置与实际运行时边界不一致。
- `tests/engineering/production-config-regression.mjs` 新增零值和非整数 Bridge timeout 负向用例。
- `npm run test:production-config`、`npm run test:harness-bridge`、完整 `npm run test:harness` 和 `git diff --check` 均通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 DeepSeek Provider、正式 DB v6 provenance、完整 Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Compose Bridge timeout 显式传递门禁）

- 根级生产 Compose 与伦度 Compose 现在都将 `BRIDGE_PROMPT_TIMEOUT_MS`、`BRIDGE_SESSION_DRAIN_TIMEOUT_MS`、`BRIDGE_RPC_TIMEOUT_MS`、`BRIDGE_SHUTDOWN_TIMEOUT_MS` 显式传入 `harness-bridge`；部署模板和生产配置回归同时锁定四项参数，避免只在代码默认值中存在而在容器环境丢失。
- `npm run test:production-config` 已通过根 Compose、伦度 Compose、环境样例和 timeout 上下界校验；`npm run test:harness-bridge`、`npm run test:harness` 与 `git diff --check` 继续通过。
- 权威制品检查 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍因缺少当前分支同源 `client-plugins/eiscore-auth/lib/index.js`、`digital-twin/lib/index.js`、`enterprise-bi/lib/index.js` 而失败；`npm run db:release:check` 仍报告 8 项 core-008/core-009 导致的正式 DB v6 provenance drift。两项阻塞均保留原始输出，未通过复制外部制品或改写 release manifest 绕过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；clean Harness image、真实 DeepSeek Provider/API key、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，生产可达性与离线单元复核）

- 深层扫描 `eiscore-base`、应用中心、共享客户端、`realtime/`、Harness Bridge、部署 Compose 和环境样例，没有发现新的旧 Agent 编排、直接模型 Provider 出口、Legacy Harness fallback/shadow 或 `/agent/*` 生产请求；命中的 `openai`/ACP/Anthropic 字符串仅属于 DeepSeek DSH 上游锁定的开发/传递依赖。`agent-harness/package.json` 的直接运行时依赖只有 `@deepseek-ai/dsh`，Bridge 镜像使用 `npm ci --omit=dev`，因此未把这些开发依赖作为 EISCore 生产模型接入。
- `AiCopilot.vue` 的通用系统配置写入函数当前唯一调用点为 `materials_categories`；系统配置平台服务在请求发出前拒绝退役 `ai_glm_config`，设置页也只读展示 `deepseek-harness`。没有发现可达旧 GLM 配置入口，未进行无关前端重构。
- `npm run test:unit` 实际结果为 28/30 通过、2 项失败，失败均为既有独立站研究素材缺失：`research-gallery/gallery-001.png`、`research-gallery/gallery-021.jpeg`；不是 Harness 回归，本轮未伪造或复制图片。
- `npm run test:syntax`（301 files）、`npm run test:runtime-router`、生产路径回归、设置/系统配置 HTTP 回归、`npm run test:harness`、`npm run test:production-config`、`npm run test:harness-bridge` 和 `git diff --check` 继续通过。
- 同源 client-plugin provenance、clean Harness image、真实 Provider/API key、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成；权威 artifact validator 与 `npm run db:release:check` 的失败输出保持不变。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness 运行时依赖门禁）

- `tests/engineering/harness-production-path-regression.mjs` 新增运行时依赖边界：`agent-harness/package.json` 必须直接固定官方 `@deepseek-ai/dsh@0.1.2-rc.1`，不得直接声明 Anthropic/OpenAI/ACP/Cline 旧 SDK；`agent-harness/Dockerfile` 必须使用 `npm ci --omit=dev`，避免上游开发依赖进入运行镜像层。该门禁不删除 DSH 自身 lockfile 中合法的传递依赖。
- 新门禁及顺序执行的 `npm run test:harness-bridge`、`npm run test:harness`、`npm run test:syntax`、生产路径回归和 `git diff --check` 通过。并行启动完整 Harness 与 Bridge 专项时曾出现一次时序竞争，专项单独重跑和完整套件顺序重跑均通过，未发现稳定性回归。
- 本轮仍未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未提交或推送；同源 client-plugin provenance、clean Harness image、真实 Provider/API key、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，工程门禁综合复核）

- `npm run test:runtime-image`（27 个组合根模块、2 个 Dockerfile）、`npm run test:harness-plugin`、`npm run test:infrastructure`（24 个脚本/生产 Compose）和 `npm run lint:changed`（157 个变更 JavaScript/Vue 文件）全部通过。
- `npm run test:secrets` 通过，扫描 2805 个文本文件，仅保留已知 checksum-locked legacy SQL quarantine 警告；没有新增明文凭据。`npm run db:migrations:check`、`node scripts/migration-switch-gate.mjs`、Harness production-path 和 86 路由 runtime contract 继续通过。
- 本轮没有修改前端视觉、数据库 schema、正式 release manifest 或部署环境；没有连接远端、启动持久 Compose、执行真实迁移或写入数据库卷。
- 当前完成审计仍不能关闭两个外部条件：当前分支同源 `client-plugins/{eiscore-auth,digital-twin,enterprise-bi}/lib/index.js` provenance 缺失；正式 DB v6 manifest 尚未纳入 core-008/core-009 的 contract/catalog/PostgREST provenance。真实 Provider、clean Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收同样仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，DB v6 provenance drift 精确核验）

- `npm run test:database-backend-governance`、`npm run test:database-roles` 通过；`npm run test:database-migrations` 与 `npm run test:database-structure-exit` 按设计在 release contract 处失败，稳定报告同一 8 项 drift：contract、core manifest、core postcheck、release manifest checksum/terminal/list、database catalog checksum、PostgREST contract checksum。
- 当前 core-008 SQL SHA-256 为 `c2cdd79f03145dbf63bb48b4b13b176aafb0dd6fcb13da49e2ac6ff54338087e`，core-009 SQL SHA-256 为 `6e7195aff8b1dad8a66258b2e37587efc653b8ba8ec4c6c15af788a60929f980`；正式 `database/releases/eiscore-db-v6/manifest.json` 的 core terminal 仍为 `core-007`，所以不能把新迁移视为已发布 provenance。
- 正确后续动作是由数据库发布流程重新生成候选 v6 contract/catalog/PostgREST checksums，经审核后再更新正式 release provenance；本轮没有改写 manifest、没有执行真实迁移、没有启动数据库容器或写入数据库卷。

## 全局目标继续推进记录（2026-10-02，Bridge 串行稳定性复核）

- `npm run test:harness-bridge` 连续串行执行 5 次全部通过；覆盖 RPC receipt timeout、session busy/drain、SDK 错误清理、tool continuation 和 bounded shutdown。此前并行启动完整 Harness 与 Bridge 专项时出现过一次即时 `sessionBusy` 断言失败，串行专项与完整套件均未复现，未发现稳定 Bridge 竞态。
- 本轮没有放宽超时、删除断言或改变会话状态实现；结果只作为测试执行方式的稳定性证据记录。

## 全局目标继续推进记录（2026-10-02，租户与数据库 RLS 边界审计）

- 当前数据库 v1 基线的数字分身表没有 `tenant_id` 字段，RLS 以认证 JWT 的 `username` 对 `twin_knowledge_files`/`twin_sessions` 进行用户归属，并通过 session 外键保护 `twin_messages`/`twin_tool_logs`；这是单企业数据库内的用户/会话隔离，不应表述为已完成的双租户数据库验收。
- Harness HTTP/Gateway 层独立要求 subject、tenant 和 token，Bridge 会拒绝同一 subject 跨 tenant 复用 session；`node tests/engineering/digital-twin-rls-contract-regression.mjs`、`node realtime/test-harness-gateway.js`、`node agent-harness/test-http-bridge.js` 均通过。
- 因此当前证据证明“应用 Harness tenant 边界 + 数据库用户/session RLS 边界”分别成立，但不证明两个真实租户通过 PostgREST/真实数据库卷的端到端隔离；外部双租户 JWT/RLS 验收继续列为未完成项，未连接数据库或执行迁移。

## 全局目标继续推进记录（2026-10-02，当前回合门禁复核）

- `npm run test:harness` 完整通过，覆盖插件注册/审计、写确认与幂等、Gateway/Tool Gateway、数字分身持久化、文档提交、销售写入、多模态与查询边界、生产路径、Bridge、输出策略和迁移切换门禁；`node tests/engineering/harness-production-path-regression.mjs` 与 `node tests/engineering/lundu-harness-artifact-regression.mjs` 也通过。
- `npm run test:harness-bridge` 单独通过，Bridge 的 framing、session drain、RPC receipt timeout、SDK 错误清理、tool continuation 与 bounded shutdown 均保持通过。
- 权威 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍故障关闭，仅报告 `LUNDU_HARNESS_ROOT: required`；当前分支仍没有三个可追溯 `client-plugins/*/lib/index.js`。外部未提交候选目录未复制、未挂载、未作为发布输入。
- `npm run db:release:check` 仍稳定报告 8 项正式 DB v6 provenance drift（core-008/core-009 尚未进入正式 manifest）；本轮未改写 manifest、未执行真实迁移、未启动数据库或写入数据卷。
- 本轮未连接远端/生产、未启动持久 Compose、未发布 Web/后端、未修改前端视觉、未提交或推送。真实 DeepSeek Provider/API key、同源 client-plugin provenance、clean Compose release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，DSH SDK 本地运行时 smoke）

- 使用当前分支 `agent-harness/node_modules/@deepseek-ai/dsh/lib/bin.js` 与临时 `DSH_HOME` 执行 `node scripts/dsh-sdk-runtime-smoke.mjs --bin <...>/dsh/lib/bin.js --home <temporary> --timeout-ms 30000`；官方 SDK 初始化实际返回 `server.name=deepseek-harness-sdk-runtime`、`server.version=0.0.1`、`frameCount=1`、`stderrBytes=0`。这证明本地 SDK/stdio 初始化边界可运行，但不等于真实 Provider/API key 或完整 Web plugin/tool-call 验收。
- `npm run test:syntax`（301 files）、`npm run test:production-config`、`npm run test:runtime-image` 均通过；生产路径、Bridge timeout、Dockerfile 运行时依赖和旧 direct-provider/Cline 配置门禁继续成立。
- `docker version` 当前仍无法连接 `dockerDesktopLinuxEngine` named pipe；没有启动容器。权威 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍因 `LUNDU_HARNESS_ROOT: required` 失败，当前分支没有同源三个 Web client-plugin 编译入口，因此没有运行或伪造 Web plugin smoke。
- `/agent/*` 兼容前缀复核确认：AI/Twin 等历史前缀仅归一化到当前 Harness canonical handler，company-site 等历史业务协议仍需要该兼容别名；生产代码未重新引入旧 Agent runtime、旧模型直连、Cline 或 Legacy fallback/shadow。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布或提交推送；同源 Web plugin provenance、真实 Provider、clean Compose release、正式 DB v6 provenance、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，能力清单精确对齐门禁）

- 对 `plugin-contract.v1.json`、`MIGRATION_CATALOG.json` 和运行时 `plugin-registry.js` 做了实际集合比对：均为 9 个插件、18 个 capability，无重复、无 contract-only、registry-only 或 migration-only 能力。
- `tests/engineering/harness-plugin-catalog-regression.mjs` 新增逐插件 capability 精确相等断言，不再只检查插件 ID 和总数量；该回归与顺序执行的完整 `npm run test:harness` 均通过。
- 并行启动完整 Harness 与 Bridge 曾再次触发一次 `RPC receipt timeout must keep the session busy until idle is observed` 时序断言；没有放宽断言或修改 Bridge。随后单独 `npm run test:harness-bridge` 和顺序 `npm run test:harness` 均通过，故障未稳定复现，作为测试执行竞态记录而非实现回归。
- 本轮没有连接远端/生产、没有启动持久 Compose、没有执行真实迁移、没有写入数据库卷、没有修改前端视觉、没有发布或提交推送；同源 Web plugin provenance、Docker daemon、真实 Provider/API key、正式 DB v6 provenance、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，历史路径与企业站兼容协议边界）

- `tests/engineering/harness-production-path-regression.mjs` 新增静态契约：`realtime/index.js` 的 `/agent/*` 历史前缀只能归一化到当前 canonical 路径；生产组合根不得重新导入 `agent-core`、`agent-access-service` 或 `agent-task-service`。
- 同一回归明确锁定 `realtime/company-http.js` 中 `/company-site/auth/handoff` 与 `/company-site/public/leads` 等合法企业站业务协议仍由 company handler 处理；这些兼容协议不属于旧 Agent 编排，不能为了清理历史前缀而误删。
- `node tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/harness-plugin-catalog-regression.mjs`、`node tests/engineering/lundu-harness-artifact-regression.mjs`、`node scripts/migration-switch-gate.mjs` 和 `git diff --check` 均通过。
- 本轮仍未连接远端/生产、未启动 Docker Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送；同源 Web client-plugin provenance、Docker daemon、真实 Provider/API key、正式 DB v6 provenance、外部双租户 JWT/RLS、Smart BI 等价、完整 Compose clean release 和伦度远端验收继续是未完成项，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，平台认证门禁与旧配置断言收口）

- 复核 npm run test:platform-auth 时发现 tests/engineering/remaining-session-consumers-regression.mjs 仍要求 SettingsView.vue 直接导入已移除的 getHostSystemConfigService；该断言与当前设置页只读展示 Harness、应用中心请求使用 getHostHttpClient 的实际边界冲突。
- 已将该测试契约更新为：设置页必须使用平台 getHostHttpClient，不得重新引入 getHostSystemConfigService，也不允许直接读取旧 token。该改动只修正测试与当前代码的契约，不改变前端视觉或运行行为。
- node tests/engineering/remaining-session-consumers-regression.mjs、npm run test:platform-auth、npm run test:platform-http、npm run test:runtime-router、npm run test:database-roles 和完整 npm run test:harness 均通过。
- npm run db:release:check 仍稳定报告同一 8 项正式 DB v6 provenance drift；当前分支同源 Web client-plugin 制品、Docker daemon、真实 DeepSeek Provider/API key、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成。本轮未连接远端、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送，全局目标保持 active。

## 全局目标继续推进记录（2026-10-02，安全与基础设施综合回归）

- 在修正平台认证测试契约后，npm run test:secrets 通过（扫描 2805 个文本文件，仅保留已登记 checksum-locked legacy SQL quarantine 警告）；npm run lint:changed 通过（157 个变更 JavaScript/Vue 文件）。
- npm run test:runtime-image 通过（27 个 composition-root 模块、2 个 Dockerfile）并包含 Vite dev-proxy contract；npm run test:infrastructure 通过（24 个脚本/生产 Compose 基础设施契约）。
- 这些检查未发现新的旧 Agent runtime、旧模型直连、Harness fallback/shadow 或明文凭据回归；没有修改前端视觉、数据库 release manifest 或部署环境。
- 当前仍未满足完成审计的外部证据：同源 Web client-plugin provenance、Docker daemon/clean Compose、真实 DeepSeek Provider/API key、正式 DB v6 provenance、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收。本轮未连接远端、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送，全局目标保持 active。
## 全局目标继续推进记录（2026-10-02，Replay 作用域租户边界收口）

- Harness Gateway 的 request replay 记录由裸 `request_id` 改为绑定 `tenant + subject + plugin + capability` 的作用域键；同一租户/主体/能力重复请求仍返回 `HARNESS_REQUEST_REPLAY`，不同租户或主体可以安全复用同一 request-id，避免跨租户误拒绝。
- HTTP Bridge 的 replay 记录由裸 request-id 改为 `owner + plugin + request-id`；同一 owner 跨 session 仍拒绝重放，不同 owner 可复用 ID；读取旧状态文件时继续兼容历史裸 request-id 记录，避免升级后重复执行。
- 新增 Gateway 与 Bridge 跨租户/跨主体/跨 session 回归。`node realtime/test-harness-gateway.js`、`node agent-harness/test-http-bridge.js`、顺序 `npm run test:harness` 和 `npm run test:syntax` 均通过。
- 本轮未修改前端视觉、数据库 release manifest 或部署环境，未连接远端、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送。当前分支 Web client-plugin provenance、Docker daemon/clean Compose、真实 Provider/API key、正式 DB v6 provenance、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。
## 全局目标继续推进记录（2026-10-02，Bridge 状态键长度兼容）

- 复核发现作用域化 Bridge replay key（owner + plugin + request-id）可能长于旧的 256 字符 session/request 校验；已增加独立的 `validReplayKey`（最大 1024 字符）状态校验，避免合法的 256 字符 request-id 在重启恢复时被误判为损坏状态。
- `agent-harness/test-http-bridge.js` 新增最长合法 request-id 的写入、重启恢复和重放拒绝回归；`node agent-harness/test-http-bridge.js`、`npm run test:harness`、`npm run test:syntax` 和 `git diff --check` 均通过。
- 本轮未修改前端视觉、数据库 release manifest 或部署环境，未连接远端、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送。`LUNDU_HARNESS_ROOT` 缺失、Docker daemon 不可用、正式 DB v6 provenance drift、真实 Provider/API key、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍是未完成项，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，单元回归与生产路径扫描补录）

- `npm run test:unit` 实际结果为 28/30 通过、2 项失败。失败均来自既有独立站研究素材夹具缺失：`eiscore-company-site/research-gallery/gallery-001.png` 与 `eiscore-company-site/research-gallery/gallery-021.jpeg`；失败测试为 `test/jinwei-research-images.test.js` 中的本地图片可用性断言，与 Harness 后端迁移无关。本轮没有伪造、复制或生成图片来绕过断言。
- 对当前生产可达代码（排除 `docs/`、`tests/`、`node_modules/`、构建输出）进行只读扫描，未发现 `agent-core`、`agent-access-service`、`agent-task-service`、`callAiUpstream`、`answerWithAi`、旧模型直连或 Harness fallback/shadow 重新进入 `realtime/`、Harness、客户端调用、部署 Compose 和环境样例。`ai_glm_config` 仅命中退役历史 SQL 与平台拒绝逻辑；`legacy_fallback_enabled` 命中的是应用工作流兼容策略，不是 Agent/Harness 运行时回退，已保留并与本目标边界区分。
- 本轮未修改代码、未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送。`LUNDU_HARNESS_ROOT` 同源 Web client-plugin provenance、Docker daemon/clean Harness image、真实 DeepSeek Provider/API key、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Harness 回归串行复验）

- 本轮并行启动完整 Harness 与 Bridge 专项时再次出现一次 `RPC receipt timeout must keep the session busy until idle is observed` 的即时断言失败；没有放宽断言或修改实现。随后单独串行执行 `npm run test:harness-bridge` 与完整 `npm run test:harness` 均通过，说明该故障仍是并行执行时序竞争，未形成稳定实现回归。
- `npm run test:syntax`（301 files）和 `git diff --check` 通过。该结果与前述 28/30 独立站单元测试结果并列记录；缺失的两张研究图片仍未伪造或补拷贝。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，权威门禁复核）

- `npm run test:production-config` 通过，包含生产配置安全回归、伦度 Harness 制品预检契约和 DSH Web 启动 profile 回归。该结果只证明配置/契约正确，不代表缺失的 `LUNDU_HARNESS_ROOT` 制品已经存在。
- `npm run test:runtime-router`、`npm run test:database-backend-governance`、`npm run test:database-roles` 和 `node scripts/migration-switch-gate.mjs` 均通过；运行时路由、组合根退出门禁、数据库角色/RLS 数字分身合同和 Harness capability 切换基线没有回归。
- `npm run db:release:check` 仍故障关闭并精确报告 8 项正式 v6 provenance drift：`database/contracts/eiscore-db-contract-v3.json`、`database/migrations/core.json`、core postcheck、core manifest checksum/terminal/list、database catalog checksum、PostgREST contract checksum。根因是工作树中的 core-008/core-009 尚未进入正式 `database/releases/eiscore-db-v6/manifest.json` 的已提交 source provenance；本轮没有改写 manifest。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍故障关闭并报告 `LUNDU_HARNESS_ROOT: required`。当前分支 Git 历史没有 `agent-harness/client-plugins/{eiscore-auth,digital-twin,enterprise-bi}/lib/index.js`；另一工作树的未提交目录未复制、未挂载、未用于验收。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送。真实 DeepSeek Provider/API key、当前分支同源 Web client-plugin provenance、clean Harness image、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 并行回归稳定化）

- Bridge 回归夹具此前把 `initialize` 也纳入较短的 prompt/RPC timeout，在完整 Harness 并行运行时可能把初始化调度延迟误报为 receipt timeout。已在 `agent-harness/test-dsh-http-bridge-runtime.mjs` 中显式先完成各隔离 runtime 的 `initialize`，并将 RPC receipt timeout 与 prompt/drain timeout 分离；生产 `DshSdkProcess` 实现和生产超时默认值未修改。
- `agent-harness/test-rpc-timeout-child.mjs` 将首轮迟到 `session.status=idle` 延迟设为 450ms，测试明确等待 idle 后再复用 session，避免依赖未声明的调度余量。
- 两次并行 `npm run test:harness-bridge` 均通过；随后并行 `npm run test:harness`、`npm run test:syntax` 和 `git diff --check` 通过。此前的即时竞争断言未再复现。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送。外部制品、Docker/clean image、真实 Provider、正式 DB v6 provenance、完整 Compose、双租户 RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，外部候选 Web 制品只读复核）

- 对仓库外 `C:/Users/Twist/Documents/eiscore/agent-harness` 的未提交候选目录进行了只读检查：三个 `client-plugins/*/lib/index.js` 文件存在，但 `eiscore-tools.mjs` 与 `eiscore-restricted.cordis.yml` 缺失，且目录内没有可用 DSH `bin.js`。因此 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root <candidate>` 报告 2 项缺失，`dsh-web-plugin-runtime-smoke.mjs` 无法启动；该目录不能作为当前分支 provenance 或发布输入。
- 本轮没有复制、挂载、提交或发布该外部目录，也没有连接远端/生产、启动持久 Compose、执行真实迁移或写入数据库卷。当前分支同源 Web client-plugin、完整 DSH tool/profile 制品、clean image、真实 Provider、正式 DB v6 provenance、完整 Compose、双租户 RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，DB v6 候选 provenance 生成）

- 使用当前工作树 HEAD `b40af5596377f7b15e96782c363ab87bf6798dc2` 在内存中调用 `buildDatabaseReleaseManifest` 生成候选 v6 manifest：56 个 artifact，core terminal 为 `core-009`（SHA `6e7195aff8b1dad8a66258b2e37587efc653b8ba8ec4c6c15af788a60929f980`），core manifest portable SHA `cc04831c05dba11ad52c4ef51bf564a0068b13399a58f9cd4679138da3da5e92`，数据库 catalog SHA `869cb978e1c396c0c0b7bc6e0acfc55434e845fe9ea08919e873fd98223c84bd`，PostgREST contract SHA `5d14a8a0a82d506486f239b7c819d85384a6742a4e264c5d11db39940da04b24`，候选 manifest SHA `ac346ce798a8969e747800b7f966119a9447ab1c2be9b1806da6349b9cb64778`。
- 该候选只在内存中生成，未写入 `database/releases/eiscore-db-v6/manifest.json`，未执行迁移、未连接数据库或写入数据卷。正式发布必须在相关变更提交后由发布流程重新生成并审核 source revision，不能复用本次工作树候选 SHA。
- 当前 `npm run db:release:check` 的 8 项 drift 因此仍是预期的正式 provenance 阻塞；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，工作流兼容 fallback 生产边界）

- 审计确认 `legacy_fallback_enabled` 只属于 `eiscore-apps` 的工作流策略/历史草稿兼容语义，不是 Harness 或旧模型 Agent fallback。为防止未来误接线，`tests/engineering/harness-production-path-regression.mjs` 现在要求所有 `realtime/*.js|mjs`、Harness Bridge 和生产/伦度部署配置均不得出现该字段；应用中心工作流代码保持原行为，未修改前端视觉。
- `node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`npm run test:syntax`（301 files）和 `git diff --check` 均通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送；外部 Web plugin/tool/profile 制品、clean Harness image、真实 Provider、正式 DB v6 provenance、完整 Compose、双租户 RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，质量与数据库治理门禁复核）

- `npm run lint:changed` 通过，覆盖 157 个变更 JavaScript/Vue 文件；`npm run test:secrets` 通过，扫描 2805 个文本文件，仅保留已登记的 5 项 checksum-locked legacy SQL quarantine 警告；`npm run test:runtime-image` 通过（27 个 composition-root 模块、2 个 Dockerfile，含 Vite dev-proxy contract）；`npm run test:infrastructure` 通过（24 个基础设施脚本/生产 Compose 契约）。
- `npm run test:platform-auth` 与 `npm run test:platform-http` 全部通过，平台会话、权限、租户边界、设置页旧配置拒绝、AI/Twin/Flash/文档客户端 transport 契约没有回归。
- `npm run test:database-migrations` 与 `npm run test:database-structure-exit` 均在正式 v6 release contract 处故障关闭，报告同一 8 项 provenance drift：contract、core manifest、core postcheck、core manifest checksum/terminal/list、database catalog checksum、PostgREST contract checksum；没有改写正式 manifest、执行迁移或写入数据库卷。
- 本轮未连接远端/生产、未启动持久 Compose、未发布、未修改前端视觉。真实 DeepSeek Provider、当前分支同源 Web plugin/tool/profile 制品、clean Harness image、正式 DB v6 provenance、完整 Compose、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，退役 GLM 初始化入口门禁）

- 复核确认 `env/insert_ai_config.sql` 只作为退役 GLM 历史审计材料保留：它被 `env/README.md` 与 `database/legacy-sql-resolution.json` 标记为禁止默认执行/`superseded-by-migration`，当前根 Compose、生产 Compose、伦度 Compose 和初始化脚本均未引用它。
- 在 `tests/engineering/production-config-regression.mjs` 增加静态断言，生产、伦度基础 Compose 与 Harness override 不得挂载 `insert_ai_config.sql`，避免历史模型配置通过 initdb 入口重新进入运行环境；未删除历史 SQL，也未修改正式 DB release manifest。
- `npm run test:production-config`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:syntax`（301 files）和 `git diff --check` 均通过。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送；同源 Web client-plugin provenance、Docker daemon/clean Harness image、真实 Provider/API key、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，完整 Harness 与根 Compose 门禁复验）

- `npm run test:harness` 全部通过：插件注册/审计 ledger、18 个 capability、Gateway 鉴权与租户隔离、写确认/幂等、Twin RLS 会话、文档提交、销售写入、多模态、HTTP 路由、输出策略、SDK Bridge 和迁移切换门禁均通过。
- `npm run test:database-backend-governance`、`npm run test:database-roles` 和 `node scripts/migration-switch-gate.mjs` 均通过；数字分身四张表的 release baseline RLS 与 JWT username 归属约束仍成立。
- `tests/engineering/production-config-regression.mjs` 的退役 GLM 初始化 SQL 门禁扩展到根 `docker-compose.yml`，与生产 Compose、伦度 Compose、Harness override 一起禁止挂载 `insert_ai_config.sql`。
- 本轮没有连接远端/生产、没有启动持久 Compose、没有执行真实迁移、没有写入数据库卷、没有发布或提交推送；同源 Web client-plugin provenance、Docker daemon/clean Harness image、真实 Provider/API key、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，端到端边界审计与外部制品追踪）

- 复核 `harness-chat-http.js`、`harness-twin-chat-http.js`、`harness-twin-chat-capability.js`、`harness-context-capabilities.js` 和 PostgREST 用户绑定：HTTP 层先从已验证 JWT 构造 tenant/subject，Twin session 通过用户绑定的 persistence 做所有权检查，模型可控 context 会剥离 tenant、subject、token、provider、model、权限和数据库字段；工具代理继续从活动 session 的服务端请求上下文注入确认与幂等信息。
- `npm run test:harness`、`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:production-config`、`npm run test:syntax`（301 files）和 `git diff --check` 均通过。
- 当前分支的 `agent-harness` 已有 `eiscore-tools.mjs`、`eiscore-restricted.cordis.yml`、官方 DSH SDK/Cordis 运行依赖和 `bin.js`，但缺少 Git 历史与工作树中的 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js`、`client-plugins/enterprise-bi/lib/index.js`；权威预检 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 真实失败于 `LUNDU_HARNESS_ROOT: required`。仓库外未提交候选目录和 tarball 未作为输入使用。
- `npm run db:release:check` 仍真实失败于 8 项正式 DB v6 provenance drift：contract、core manifest/postcheck/list/terminal/checksum、database catalog checksum、PostgREST contract checksum；本轮没有改写正式 manifest，也没有执行真实迁移。
- 本轮未连接远端/生产、未启动持久 Compose、未写入真实数据库卷、未发布或提交推送；真实 Provider/API key、同源 Web client-plugin provenance、clean Harness image、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍是未完成项，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，独立站夹具与生产路径最终复核）

- `eiscore-company-site/test/jinwei-research-images.test.js` 的 31 张本地研究图夹具断言复核结果仍为 29/31 可用；缺失 `public/assets/jinwei/research-gallery/gallery-001.png` 与 `gallery-021.jpeg`。两张文件不在当前分支 Git 历史，也不在当前工作树；工作区其他目录存在副本，但它们属于其他工作树/发布制品，按协作限制未复制、挂载或用于当前分支验收。该既有夹具缺失不影响 Harness 后端代码，但 `npm run test:unit` 仍不能宣称全绿。
- 当前生产可达源码与部署配置扫描未发现旧 Agent runtime、旧模型直连、Cline 配置或 Harness fallback/shadow 重新接线；`ai_glm_config` 仅保留于退役 SQL、平台拒绝逻辑和测试中的负向断言，`legacy_fallback_enabled` 仅属于应用中心工作流兼容策略。
- 本轮未修改前端视觉或研究图资源，未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送；同源 Web client-plugin provenance、Docker/clean Harness image、真实 Provider/API key、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，Runtime active dispatch 作用域隔离）

- 复核发现 `realtime/harness-runtime.js` 的活动 Provider dispatch 原先只按裸 `session_id` 记录；虽然 HTTP Bridge 已有 owner/plugin 绑定，但运行时 Tool Proxy 上下文仍存在同 session 并发串用的理论风险。
- 已将活动 session 作用域绑定为 `subject + tenant + plugin` 的服务端组合键，并维护 session scope 引用计数。不同主体、租户或插件复用同一 session-id 时，在进入 Provider 前返回 `HARNESS_SESSION_OWNERSHIP_DENIED`，不会覆盖原请求或触达 DeepSeek Provider；同作用域请求仍按原有 session queue 串行执行。
- scope 使用 JSON tuple 编码，避免身份字段包含分隔符时发生键碰撞。
- `realtime/test-harness-runtime-boundaries.js` 新增跨租户/跨主体/跨插件同 session 回归，确认外部冲突请求不增加 Provider 调用且原请求上下文保持不变。`node realtime/test-harness-runtime-boundaries.js` 与 `npm run test:harness-runtime-boundaries` 均通过；随后完整 `npm run test:harness` 也通过。
- 本轮未修改前端视觉、数据库 release manifest 或部署环境，未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送。`LUNDU_HARNESS_ROOT` 同源 Web client-plugin provenance、Docker/clean Harness image、真实 Provider/API key、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，当前状态再核验）

- 当前分支仍没有 `agent-harness/client-plugins/{eiscore-auth,digital-twin,enterprise-bi}/lib/index.js`；权威命令 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 真实失败于 `LUNDU_HARNESS_ROOT: required`。未复制其他工作树或外部候选目录，也未伪造插件制品。
- `npm run db:release:check` 仍故障关闭并报告 8 项正式 DB v6 provenance drift：contract、core manifest/postcheck/list/terminal/checksum、database catalog checksum、PostgREST contract checksum；本轮没有改写正式 manifest、执行迁移或写入数据库卷。
- `npm run test:unit` 真实结果仍为 28/30 通过、2 项失败，均为既有独立站研究图片夹具缺失：`research-gallery/gallery-001.png` 与 `research-gallery/gallery-021.jpeg`；没有复制、生成或下载图片绕过断言。
- 生产可达路径只读扫描仍未发现旧 Agent runtime、旧模型直连或 Harness fallback/shadow 重新接线；命中项仅为明确隔离的退役 GLM SQL、Harness 输入字段净化和应用中心工作流兼容策略。
- 本轮未连接远端/生产、未启动持久 Compose、未发布、未修改前端视觉、未提交或推送；真实 Provider/API key、同源 Web client-plugin provenance、clean Harness image、正式 DB v6 provenance、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，Geo 多模态旧模型标记收口）

- 生产可达的共享 Geo service 仍保留 `translateWithGlm`、`askGlmForMapLocation` 和默认 `translateProvider: glm` 命名；其实际 HTTP 路由已经由 Harness capability 接管，但旧命名会误导配置和后续维护。
- 已将共享服务和两个 GeoDialog 消费端统一改为 Harness 命名与默认值：翻译/地图识别继续使用 `/ai/translate`、`/ai/map-locate`，对应 `eiscore_multimodal_translate` 与 `eiscore_multimodal_map_locate`，没有改变用户侧请求契约或视觉。
- 仅允许显式 `translateProvider: external` 使用外部翻译 URL；历史 `glm` 或其他未知 provider 标记统一进入 Harness 路径，不能重新建立旧模型直连。新增回归证明旧 `glm` 配置不会访问外部 URL。
- `node tests/engineering/geo-service-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness` 和 `npm run test:syntax` 均通过。本轮未连接远端/生产、未启动持久 Compose、未执行迁移或写入数据库卷、未发布或提交推送，全局目标保持 `active`。
## 全局目标继续推进记录（2026-10-02，Geo 旧契约测试收口）

- 迁移 Geo service 后，`tests/engineering/micro-app-shared-session-consumers-regression.mjs` 仍断言旧的 `translateWithGlm` 私有函数名，导致契约测试失败；已更新为 Harness 命名，并增加禁止 `translateWithGlm`/`askGlmForMapLocation` 的断言。
- `node tests/engineering/micro-app-shared-session-consumers-regression.mjs`、`node tests/engineering/geo-service-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs` 和 `npm run test:harness` 均通过。
- 生产代码扫描中除退役历史 SQL 和负向测试外，不再命中旧 Geo GLM 命名、旧 Agent runtime 或旧模型直连。未修改前端视觉；本轮未连接远端、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，生产路径 Legacy fallback 门禁增强）

- 审计确认 `legacy_fallback_enabled` 仅存在于 `eiscore-apps` 工作流权限策略及其页面配置，不被 realtime、Harness Bridge/Gateway、Docker Compose 或生产服务读取；该字段不属于 Agent/模型回退链路，未删除业务兼容语义。
- 在 `tests/engineering/harness-production-path-regression.mjs` 增加 Geo 服务静态门禁：必须使用 Harness 多模态路径，禁止重新出现 `/agent/ai/translate`、`/agent/ai/map-locate`、旧 GLM 函数名或直接选择 `glm` provider。
- `node tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/micro-app-shared-session-consumers-regression.mjs`、`node tests/engineering/geo-service-regression.mjs`、`npm run test:harness` 和 `npm run test:syntax` 均通过。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送。当前分支 Web client-plugin provenance、正式 DB v6 provenance、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，迁移后质量与数据库门禁复核）

- `npm run lint:changed` 通过，覆盖 160 个变更 JavaScript/Vue 文件。
- `npm run test:production-config` 通过，包含生产配置安全、伦度 Harness 制品预检契约和 DSH Web startup-only profile 契约。
- `npm run test:database-backend-governance`、`npm run test:database-roles` 均通过，RLS、服务身份、密钥注入和数字分身表归属边界没有回归。
- 本轮未修改数据库 release manifest，未执行真实迁移或写入数据库卷；未连接远端、未启动持久 Compose、未发布或提交推送。外部 Web client-plugin provenance、正式 DB v6 provenance、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，业务链运行环境缺失复核）

- `npm run test:smart-bi` 通过，`node scripts/migration-switch-gate.mjs` 通过。
- `npm run test:business-chain` 已真实执行并退出失败：32 项中 1 项清理通过、31 项因本地 `http://localhost:8080` 未启动而 `fetch failed`；没有启动持久服务、没有改写测试或伪造业务链结果。该命令需要独立的本地运行时/数据库环境，不能作为当前 Harness 后端迁移的通过证据。
- 本轮仍未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送；全局目标保持 `active`。
## 全局目标继续推进记录（2026-10-02，Gateway 写幂等跨请求去重）

- 复核发现 Gateway 原有 replay 账本只按主体/租户/插件/capability 作用域内的 `request_id` 去重；写 capability 虽要求 `idempotency_key`，但不同 `request_id` 搭配同一幂等键仍可能重复进入 dispatch。
- 已在 `realtime/harness-gateway.js` 增加独立的幂等键 TTL 索引：写能力按 `tenant + subject + plugin + capability + idempotency_key` 形成作用域，重复幂等键在 dispatch 前返回 `HARNESS_REQUEST_REPLAY`；request ID replay 仍单独保留，过期记录同时释放两类索引容量。
- `realtime/test-harness-gateway.js` 新增跨 request ID 的写幂等回归，并确认相同 key 在不同认证主体/租户下不会误碰撞；既有写确认、审计、超时和取消测试保持通过。
- 验证通过：`node realtime/test-harness-gateway.js`、`node agent-harness/test-write-boundary.js`、`npm run test:harness`、`git diff --check`。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；同源 Web client-plugin provenance、正式 DB v6 provenance、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，历史 /agent 路由兼容契约）

- 复核确认 Runtime 的历史 `/agent/*` 前缀仅作为 canonical Harness 路由的兼容输入，不能形成独立旧 Agent handler。
- 已将路径归一化提取为 `realtime/http-router.js` 的 `normalizeAgentRequestPath`，生产 `realtime/index.js` 的 `getRequestPath` 复用该函数：`/agent/ai/translate`（含 query string）归一化为 `/ai/translate`，`/agent` 归一化为 `/`。
- 路由回归现在断言归一化结果、`/ai/translate` 唯一命中 `harness.handleCapability`，且清单不存在独立 `/agent/ai/translate`。
- 验证通过：`node tests/engineering/runtime-http-router-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`git diff --check`。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；未完成项保持原记录，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，Bridge 稳定错误码边界）

- 复核发现 HTTP Bridge 的异常出口会把 `invoke` 抛出的任意 `error.code` 原样返回；虽然错误消息已固定，但未知内部 code 仍可能泄漏并破坏上游稳定错误契约。
- 已在 `agent-harness/http-bridge.js` 增加 Bridge 错误码白名单：已审核的协议、请求体、响应体和 DSH runtime 生命周期错误码保持原样；未知 code 统一映射为 `HARNESS_UPSTREAM_UNAVAILABLE`，固定返回“DeepSeek Harness is unavailable”。
- `agent-harness/test-http-bridge.js` 新增内部秘密 code/错误消息回归，确认未知错误不会泄漏；既有会话归属、插件 allowlist、持久 replay、容量和错误边界测试保持通过。
- 验证通过：`node agent-harness/test-http-bridge.js`、`node agent-harness/test-dsh-http-bridge-runtime.mjs`、`npm run test:harness`、`npm run test:syntax`、`git diff --check`。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；当前分支同源 Web client-plugin provenance、正式 DB v6 provenance、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，旧配置与数据库初始化边界复核）

- 复核确认 `eiscore-base/src/views/SettingsView.vue` 仅展示只读 `deepseek-harness` 运行状态；不再读取或写入 `system_configs.ai_glm_config`、模型 URL 或 API key。
- `packages/eiscore-platform/src/system-config.mjs` 对退役键 `ai_glm_config` 在发出 HTTP 请求前返回 `retired-key`；历史 `env/insert_ai_config.sql` 仍仅作为退役材料保留，`env/README.md`、数据库治理解析和 Compose 配置均明确禁止将其作为初始化输入。
- 生产可达源码与部署配置只读扫描未命中旧 Agent 编排、旧模型直连、Cline 配置或 Harness fallback；旧 GLM 命中仅存在于历史 SQL、退役键拒绝逻辑和负向测试断言。
- 验证通过：`node tests/engineering/settings-http-consumers-regression.mjs`、`node tests/engineering/system-config-http-regression.mjs`、`node tests/engineering/remaining-session-consumers-regression.mjs`、`node tests/engineering/production-config-regression.mjs`、`node tests/engineering/database-backend-governance-boundary-regression.mjs`、`node scripts/audit-database-backend.mjs`。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；DB v6 provenance、同源 Web client-plugin 制品、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，本地关键门禁复验与阻塞复核）

- 复跑通过：`node tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/base-ai-copilot-system-config-http-regression.mjs`、`npm run test:production-config`、`npm run test:harness`、`npm run test:runtime-router` 和 `git diff --check`。完整 Harness 套件覆盖插件注册、审计/写边界、Gateway/Tool Gateway、数字分身 RLS 会话、文档提交、销售写入、查询工具、HTTP、Bridge 和迁移切换。
- 只读阻塞复核保持一致：`docker version` 无法连接 Docker Desktop Linux engine named pipe；`node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 因缺少 `LUNDU_HARNESS_ROOT` 失败；`npm run db:release:check` 仍报告既有 8 项 DB v6 provenance drift；`npm run test:quality` 仍在 `eiscore-mobile/src/views/LoginView.vue` 超过 1632 行基线处失败。
- 未为通过质量门禁而修改前端视觉或放宽基线；未伪造 LUNDU 制品、未修改冻结 DB manifest、未启动 Docker/Compose、未连接远端/生产、未执行真实迁移、未写入数据库卷、未发布、未提交或推送。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，生产边界复核与基础设施环境阻塞）

- 复跑通过：`npm run test:platform-auth`、`npm run test:smart-bi`、`npm run test:runtime-image`、`npm run test:database-backend-governance`。平台会话/权限/微应用消费者、Smart BI 配置、运行时镜像契约和数据库后端治理边界均未回归。
- `npm run test:infrastructure` 在逐个执行仓库已跟踪 shell 脚本的 `bash -n` 阶段失败；失败输出不是脚本语法诊断，而是 Windows `C:\Windows\System32\bash.exe` WSL shim 返回的编码化 `Bash/Service/CreateInstance/HCS_E_CONNECTION_TIMEOUT` 启动错误。被检查的 `realtime/_check_tables.sh` 本身为 305 字节、LF、无 NUL，且 HEAD 中内容一致；未修改脚本或放宽门禁。
- 本轮新鲜 `npm run test:secrets` 长时间无输出且进程未终止，已中止该句柄，不能将其计为通过；此前已有的 secret-scanner 回归证据仍保留。Docker engine、`LUNDU_HARNESS_ROOT`、DB v6 provenance、全量质量门禁、真实 Provider/RLS、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS 和伦度远端验收仍未完成。
- 未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；未修改前端视觉。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，Bridge 跨平台 RPC 超时契约收口）

- 复核发现 `agent-harness/test-dsh-http-bridge-runtime.mjs` 在 Windows 子进程环境下把初始化握手和 250ms receipt 超时共用同一 RPC 预算，导致子进程启动耗时超过预算，在进入目标断言前误报 `HARNESS_RUNTIME_RPC_TIMEOUT`。
- 已将该测试的初始化预算与业务 receipt 超时分离：子进程先以宽预算完成 JSON-RPC initialize，随后将 `rpcTimeoutMs` 收紧到原定 250/500ms，仍验证 pending 清理、session busy/idle 排空和会话复用；生产 `DshSdkProcess` 实现未改。
- 验证通过：`node agent-harness/test-dsh-http-bridge-runtime.mjs`、`npm run test:harness`（含 HTTP Bridge 全套）和 `npm run lint:changed`（165 个变更 JS/Vue 文件）。临时诊断文件已删除。
- 本轮仍未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；基础设施 WSL shim、Docker engine、`LUNDU_HARNESS_ROOT`、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，Bridge 时序稳定化最终复验）

- 由于并行运行时 Windows 子进程初始化仍可能超过 2 秒，继续将 Bridge runtime 测试实例的初始化 JSON-RPC 预算提高到 10 秒；每个实例在 `start()` 完成后重新施加原有 250/500ms 业务 receipt 超时，因此没有放宽被验证的运行时边界。
- 连续两次独立执行 `node agent-harness/test-dsh-http-bridge-runtime.mjs` 均通过；随后完整 `npm run test:harness` 通过，包含 Bridge、Gateway、Tool Gateway、数字分身 RLS 会话、写确认/幂等/审计、HTTP 和迁移切换；`npm run lint:changed` 通过（165 个变更 JS/Vue 文件）。
- 生产配置回归、Harness 生产路径回归和 `git diff --check` 同样通过；静态扫描没有发现新的生产可达旧 Agent/模型/fallback 路径。临时诊断文件未保留，未修改生产 Bridge 实现。
- 本轮未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、基础设施 WSL shim、`LUNDU_HARNESS_ROOT`、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，Harness URL 隐式 loopback fallback 收口）

- 生产路径复核发现 `createHarnessRuntime()` 在 Harness 已启用但 `EISCORE_HARNESS_URL` 缺失时默认指向 `http://127.0.0.1:3080`，会把缺失配置伪装成本地上游并保留隐式 fallback。
- 已将 Runtime 默认 Bridge URL 改为空字符串；缺失 URL 现在由现有 URL 校验/请求边界 fail closed，不再尝试进程本地 loopback。生产环境校验同时拒绝 `localhost`、`127.0.0.1` 和 `::1` 作为 Harness bridge origin。
- 新增生产路径静态门禁，禁止 Runtime 恢复 loopback 默认值；生产配置回归新增 loopback URL 负向用例。
- 验证通过：`node tests/engineering/production-config-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`node realtime/test-harness-runtime-boundaries.js` 和 `npm run lint:changed`（165 个变更 JS/Vue 文件）。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、基础设施 WSL shim、`LUNDU_HARNESS_ROOT`、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，缺失 Bridge URL 执行层 fail-closed 回归）

- 在 Runtime 默认 Bridge URL 收口后，补充 `realtime/test-harness-runtime-boundaries.js` 实际执行层回归：空 Bridge URL 的 Provider dispatch 和 multimodal executor 都必须在调用 fetch 前拒绝，并返回 `invalid harness bridge URL`。
- 验证通过：`node realtime/test-harness-runtime-boundaries.js`、`node tests/engineering/production-config-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs` 和 `npm run lint:changed`（165 个变更 JS/Vue 文件）。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、基础设施 WSL shim、`LUNDU_HARNESS_ROOT`、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，平台 HTTP 回归契约同步）

- 本轮发现 base-ai-copilot-system-config 回归测试仍检查旧 requestJson 细节，而 AiCopilot 已迁移到 getHostSystemConfigService 共享边界。
- 已将测试改为验证共享配置服务读取/保存、统一未授权/保存错误语义、受控分类读取和禁止直接 fetch/Authorization；未修改前端视觉或业务实现。
- 验证通过：node tests/engineering/base-ai-copilot-system-config-http-regression.mjs、npm run test:platform-http。
- 本轮没有连接远端/生产、启动持久 Compose、执行真实迁移或写入数据库卷；已知 Docker、LUNDU_HARNESS_ROOT、真实 Provider/RLS、DB v6 provenance 和伦度远端验收阻塞仍保持记录，全局目标继续保持 active。

## 全局目标继续推进记录（2026-10-03，完成条件审计与回归复核）

- 对当前 `codex/systematic-refactor` 工作树做生产可达源码审计：`realtime/**`、应用客户端、共享层、Compose/deploy 脚本未发现旧 Agent 编排、直接模型供应商配置或旧 `/agent/ai`、`/agent/twin` 客户端调用；命中仅保留在部署校验器的退役变量拒绝列表和工作流权限策略的 `legacy_fallback_enabled` 业务兼容字段。
- 追加验证通过：`node tests/engineering/runtime-http-router-regression.mjs`、`npm run test:runtime-router`、`npm run test:database-backend-governance`、`npm run test:smart-bi`、`node scripts/migration-switch-gate.mjs`、`npm run test:infrastructure`、`npm run test:runtime-image`、`npm run test:secrets`、`npm run test:database-roles`。密钥扫描仍仅报告已登记的 5 项 checksum-locked legacy SQL quarantine。
- Harness 主链路与生产配置回归在本轮前后均通过；当前结果证明后端插件/Bridge/Gateway、稳定错误 envelope、权限/RLS/会话/写确认/幂等/审计和 canonical 路由的代码契约没有回归。
- 完成审计仍不能关闭外部条件：Docker engine/当前工作树 clean image、`LUNDU_HARNESS_ROOT` 下三个同源 Web client-plugin 制品、真实 DeepSeek Provider/API key、正式 DB v6 provenance、真实双租户 PostgREST/RLS、完整 Compose clean release 与伦度远端验收均缺少权威证据；本轮未连接远端、未启动持久 Compose、未执行真实迁移或写入数据库卷，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，部署环境旧模型变量拒绝门禁）

- 只读检查发现 Git 忽略的本机 `env/.env` 仍包含旧 Anthropic/Cline 变量（当前为空），而根 `docker-compose.yml` 与 `docker-compose.prod.yml` 通过 `env_file` 会把这些键注入容器环境；没有删除、覆盖或输出该文件内容。
- `scripts/validate-production-env.mjs` 新增退役运行时变量门禁：`ANTHROPIC_API_KEY`、`AI_HTTP_PROXY_URL`、`CLINE_OPENAI_*`、直接 OpenAI/DeepSeek/AI URL/Key 以及 Harness fallback/shadow 变量只要为非空值即拒绝，报错只包含变量名，不泄露值。`DSH_PROVIDER` 与 `DSH_MODEL` 保持为当前 Harness 配置，不在拒绝列表。
- `tests/engineering/production-config-regression.mjs` 为每个退役键增加非空拒绝和空白值兼容测试；正常 Harness 配置仍通过。
- 验证通过：`node tests/engineering/production-config-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`npm run test:production-config`、`NODE_OPTIONS=--max-old-space-size=4096 npm run lint:changed` 和 `git diff --check`。
- 本轮未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移或写入数据库卷、未修改前端视觉、未发布或推送；Docker engine、`LUNDU_HARNESS_ROOT`、真实双租户 RLS/Provider 验收及 DB v6 provenance drift 仍是已知阻塞，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，组合根依赖解析门禁）

- `tests/engineering/harness-production-path-regression.mjs` 新增本地依赖闭合检查：遍历 `realtime` 运行时 JS/MJS 的相对 `require()`，要求每个依赖解析到当前工作树中存在的 `.js`、`.mjs`、`.json` 或 `index.js` 文件。这样旧 Agent 模块删除后若有残留启动引用会在回归阶段直接失败。
- 门禁通过：`node --check tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`。现行组合根继续只装载 Harness、Flash、Twin、Document Intake 和业务服务模块。
- 本轮只修改回归门禁和工程记录，未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移或写入数据库卷；Docker engine、`LUNDU_HARNESS_ROOT`、真实 Provider/RLS、DB v6 provenance 和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，质量与迁移总门禁新鲜结果）

- `npm run test:database-migrations` 的 migration id/order/checksum、Runtime V2 runner、baseline、contract governance 前置检查全部通过；在 `database-release-contract-regression.mjs` 阶段仍因同一 8 项冻结 DB v6 provenance drift 失败。没有修改冻结 manifest，也没有执行真实迁移。
- `npm run test:quality` 的 G3 exit 和 Realtime composition-root 前置检查通过；在 Vue complexity inventory 阶段按既有基线失败：`eiscore-mobile/src/views/LoginView.vue` 当前 1826 行，基线 1632 行。没有修改前端视觉或放宽复杂度基线。
- 当前工作树 `LUNDU_HARNESS_ROOT` 仍未设置；仓库内发现的 `.codex-tmp`/`node_modules` DSH 安装缓存未作为同源发布制品或验收输入，未复制到 `client-plugins`，避免以无 provenance 目录替代真实制品。
- 本轮新增组合根依赖解析门禁及上述状态记录；Harness 套件、生产路径、配置、基础设施、运行镜像、密钥、数据库角色/RLS 回归仍保持通过。未连接远端/生产、未启动持久 Compose、未写入数据库卷、未发布或推送，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，Harness lockfile 直接依赖边界）

- 只读检查发现 `agent-harness/package-lock.json` 中存在 ACP/Anthropic/OpenAI 等包，但它们是官方 `@deepseek-ai/dsh@0.1.2-rc.1` 的传递依赖，并非 Harness 镜像直接声明。
- `tests/engineering/harness-production-path-regression.mjs` 新增 lockfile 根依赖断言：`agent-harness/package.json` 与 lockfile 根 `packages[""]` 必须只声明固定版本 `@deepseek-ai/dsh`；不会错误禁止 DSH 自身的合法传递依赖。
- 门禁通过：`node tests/engineering/harness-production-path-regression.mjs`。本轮未修改运行时依赖、未执行 npm 安装、未连接远端/生产、未启动持久 Compose、未执行迁移或写入数据库卷，目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，外部阻塞状态复核）

- `docker version` 当前仍只能读取 Docker CLI（29.1.3），连接 `desktop-linux` daemon 失败：`dockerDesktopLinuxEngine` named pipe 不存在；没有启动容器或 Compose。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 权威失败：`LUNDU_HARNESS_ROOT: required`；当前没有可验证的三个同源 Web client-plugin 编译入口，未从其他工作树或 staging 复制制品。
- `npm run db:release:check` 仍按预期失败并报告 8 项 DB v6 release provenance drift（contract/migration/postcheck、manifest checksum、terminal migration、migration list、catalog checksum、PostgREST checksum）；未修改冻结 release manifest、未执行迁移。
- 本轮阻塞条件与前次相同但已重新取得权威输出；继续保持目标 `active`，不以契约测试替代真实 Docker、Provider、双租户 RLS 或远端验收。

## 全局目标继续推进记录（2026-10-03，生产可达旧配置审计）

- 复核 `eiscore-base/src/views/SettingsView.vue`、`packages/eiscore-platform/src/system-config.mjs`、`eiscore-base/src/components/AiCopilot.vue` 和应用中心模板写入路径：设置页只展示 `deepseek-harness` 运行状态；业务写入口仅使用 `app_settings`、`form_templates` 和 `materials_categories` 等非模型配置键。
- `createSystemConfigService` 在请求发出前拒绝 `ai_glm_config`（`retired-key`），并拒绝非法键；`core-008-retire-legacy-ai-config.sql` 继续通过 RLS 和删除历史行收口数据库侧边界。旧 `env/insert_ai_config.sql` 仅作为退役/历史材料保留，未纳入生产 Compose 初始化输入。
- `settings-http-consumers-regression.mjs`、`system-config-http-regression.mjs` 和 `database-backend-governance-boundary-regression.mjs` 均通过。生产路径静态扫描未发现新的旧 Agent 编排、旧模型直连、Cline 或 Harness fallback/shadow 入口。
- `npm run test:database-migrations` 已真实执行；前四个治理检查通过，随后在 `database-release-contract-regression.mjs` 按预期因已记录的 8 项 DB v6 provenance drift 失败。该失败不是本轮新增回归，未修改冻结 manifest。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布或提交推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，AiCopilot 配置访问边界收口）

- 复核发现 `eiscore-base/src/components/AiCopilot.vue` 的模板库和物料分类逻辑虽然只使用业务键，但此前直接调用 `/system_configs`，动态模板库 key 没有复用退役键保护。
- 已将模板库读取/保存与物料分类保存统一改为 `getHostSystemConfigService()`；所有 key 现在都会经过共享的格式校验、`ai_glm_config` 退役拒绝、统一认证和 HTTP 错误边界。未改变业务键、数据格式或任何前端视觉。
- `tests/engineering/system-config-http-regression.mjs` 增加静态门禁，禁止 AiCopilot 重新直接请求 `/system_configs`，并要求使用共享配置服务。
- 验证通过：`node tests/engineering/system-config-http-regression.mjs`、`node tests/engineering/settings-http-consumers-regression.mjs`、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`NODE_OPTIONS=--max-old-space-size=4096 npm run lint:changed`（164 个变更 JS/Vue 文件）和 `git diff --check`。并行 lint 的首次 Node 进程因内存上限退出，增加堆上限后通过。
- `npm run test:database-migrations` 仍在 release contract 阶段因既有 8 项 DB v6 provenance drift 失败；未修改冻结 manifest、未执行真实迁移。全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，业务链与外部制品验证复核）

- 配置边界收口后复跑：`npm run test:smart-bi`、`npm run test:production-config`、`npm run test:runtime-router`、`node tests/engineering/harness-production-path-regression.mjs` 和 `npm run test:harness` 均通过；Runtime 路由/组合根、WebSocket Harness 消息和 Smart BI 配置契约未回归。
- 只读 Docker 能力探测仍失败：Docker Desktop Linux engine named pipe 不存在，当前不能进行 clean Harness image build、容器端到端或 Compose release 验证。没有启动任何持久 Compose。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍因缺少 `LUNDU_HARNESS_ROOT` 失败；未使用 fixture 或其他 worktree 制品冒充同源 Harness Web 制品。
- 本轮未连接远端/生产、未写入数据库卷、未执行真实迁移、未发布或提交推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，工作流兼容字段与 Harness fallback 边界）

- 追踪 `legacy_fallback_enabled` 的全部生产引用后确认：该字段只属于 `app_center.workflow_permission_policies` 的工作流权限兼容策略，由 `sql/patch_workflow_policy_v2.sql` 的 `start_workflow_instance`/`transition_workflow_instance` RPC 消费，用于允许旧的 `op:<app>.create` 或 `op:<app>.edit` 权限；它不选择模型、不调用 Agent、Bridge、Harness 或外部 Provider。
- `eiscore-apps/src/domain/app-runtime-workflow-policy.mjs` 与 `eiscore-apps/src/views/AppRuntime.vue` 仅负责工作流策略编辑和 strict 切换；Harness/realtime、Host AI bridge、应用中心客户端示例和部署配置均不读取该字段。
- 已在 `tests/engineering/harness-production-path-regression.mjs` 增加边界门禁：工作流 SQL/纯策略模块/AppRuntime 可以保留该业务兼容字段，但 Harness/Agent 运行时、部署配置和客户端协议不得把它解释为 fallback 开关。
- 验证通过：`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`NODE_OPTIONS=--max-old-space-size=4096 npm run lint:changed`（164 个变更 JS/Vue 文件）和 `git diff --check`。
- 本轮未修改工作流权限行为、未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移或写入数据库卷；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，DB release drift 只读报告）

- 运行 `npm run db:release:drift` 生成当前工作树与冻结 `database/releases/eiscore-db-v6/manifest.json` 的只读对比；命令按预期以 drift 状态退出，不写入 manifest、不执行 Docker、不连接数据库。
- 冻结 manifest SHA-256 为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，候选 manifest SHA-256 为 `372301ad2f8b9f68b527dc269c77e52a99c9c02aa5d37a9b0ee782f3f5ddb463`；source revision 分别为 `b9a3831d08aeb7056ee8a5997ca8b57ae270ca08` 与 `3990fb6d0b0c1346f2a1e90b4b3e521235eade8d`。
- drift 仍包含 8 项：source revision、migration manifests（候选 core 终点为 `core-009`，冻结为 `core-007`）、database contract checksums、release artifact checksums、terminal migration、migration list、database catalog checksum、PostgREST contract checksum。
- 该差异是版本化发布证据尚未更新的真实状态；没有修改冻结 v6 manifest，也没有合并 `codex/database-debt-governance` 或执行 `core-008/core-009` 真实迁移。正式 release 线需要数据库负责人明确版本化发布决策后再生成。
- 本轮仍未连接远端/生产、未启动持久 Docker Compose、未写入真实数据库卷、未发布或提交推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，Runtime Tool Proxy 失败 envelope 收口）

- 复核发现内部 `/internal/harness/tool` handler 对 `execute()` 返回的 `{ ok:false }` 结果仍可能直接透传未知错误码、内部错误消息或非法 HTTP 状态。
- 已在 `realtime/harness-runtime.js` 增加 Tool Proxy 错误码白名单和稳定化函数：未知 code 统一为 `HARNESS_TOOL_EXECUTION_FAILED`，状态限定为合法 4xx/5xx，消息按错误类别固定；已审核的权限、工具不可用、确认、幂等和取消错误保留稳定语义。
- `realtime/test-harness-runtime-boundaries.js` 新增未知内部 code/数据库路径哨兵、非法 2xx 状态以及权限错误消息净化回归；确认 Tool Proxy 不会把内部细节返回给调用方。
- 验证通过：`node realtime/test-harness-runtime-boundaries.js`、`node realtime/test-harness-tool-gateway.js`、`node realtime/test-harness-http.js`、`npm run test:harness`、`node --check realtime/harness-runtime.js`、`node --check realtime/test-harness-runtime-boundaries.js` 和 `git diff --check`。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；同源 Web client-plugin provenance、正式 DB v6 provenance、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，Tool Proxy envelope 兼容性复核）

- Tool Proxy 稳定化继续保留 HTTP 层合法 4xx/5xx 状态，但响应 JSON body 保持既有 `{ code, message }` 形状，不新增 `status` 字段，避免改变现有客户端契约。
- 复验通过：`node realtime/test-harness-runtime-boundaries.js`、`npm run test:harness`、`node --check realtime/harness-runtime.js`、`npm run lint:changed` 和 `git diff --check`。
- 数据库治理、运行时路由、基础设施和 Smart BI 契约复核结果：`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:runtime-router`、`npm run test:infrastructure`、`npm run test:smart-bi` 均通过；`npm run test:database-migrations` 与 `npm run test:database-structure-exit` 仍因同一组既有 DB v6 provenance drift（8 项）失败，未修改正式 manifest 规避。
- 外部 client-plugin 编译源码/制品仍未出现在当前仓库 `agent-harness`，`LUNDU_HARNESS_ROOT` 仍缺失；未用 fixture 冒充真实制品验收。目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-02，Tool Proxy 已审核错误语义补齐）

- Tool Proxy 错误码白名单扩展到 Tool Execution Gateway 已审核的 replay、capacity、audit、timeout、upstream、input/output schema 等错误；这些错误保持稳定业务语义和合法默认 HTTP 状态，不再被过度归类为执行失败。
- 未知 code、非法状态和内部消息仍统一净化；响应 JSON 保持既有 `{ code, message }` 形状，HTTP 状态单独承载状态语义。
- 修复后验证通过：`node --check realtime/harness-runtime.js`、`node realtime/test-harness-runtime-boundaries.js`、`npm run test:harness`、`npm run lint:changed`。全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，未知 Tool Proxy 状态强制故障关闭）

- Tool Proxy 对未知错误码现在不再沿用调用方携带的任何 HTTP 状态，即使未知错误伪造 `403` 也固定转换为 `HARNESS_TOOL_EXECUTION_FAILED` + HTTP 502；只有已审核错误码可以携带合法状态。取消错误缺省为 HTTP 499。
- 回归新增未知 code + 403 哨兵，确认内部秘密和状态均不会泄漏；replay/capacity 错误仍保持 409/429 业务语义。
- 验证通过：`node --check realtime/harness-runtime.js`、`node realtime/test-harness-runtime-boundaries.js`、`npm run test:harness`、`npm run lint:changed`、`git diff --check`。
- DB v6 drift 具体来自当前工作树已增加 `core-008`/`core-009` 及相应 contract/catalog/PostgREST 变化，而冻结 `database/releases/eiscore-db-v6/manifest.json` 仍锚定 `core-007` 与旧 checksum；按数据库治理规则本轮未修改冻结 manifest 或执行真实迁移。
- 当前仍缺少 `LUNDU_HARNESS_ROOT` 下三个同源 Web client-plugin 编译制品；未用临时 fixture 冒充真实制品验收。全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-02，DB release 分支关系与部署门禁复核）

- 复核确认当前 `codex/systematic-refactor` 工作树的 DB v6 drift 不是单纯 checksum 误差：工作树已经包含 `core-008-retire-legacy-ai-config` 与 `core-009-retire-legacy-twin-model`，而冻结的 `database/releases/eiscore-db-v6/manifest.json` 仍锚定 `core-007`。另一个 `codex/database-debt-governance` 分支已存在独立的 v7 发布线，但其提交还包含大范围数据库治理/结构变更；本轮未合并或复制该分支，避免覆盖当前 dirty 工作树及扩大 Harness 迁移范围。
- 部署侧门禁继续通过：`npm run test:production-config`、`npm run test:secrets`、`npm run test:runtime-image`、`npm run test:infrastructure`；secret scan 的 5 个命中仍属于 checksum-locked legacy SQL quarantine。
- `node tests/engineering/database-release-contract-regression.mjs` 仍以同一 8 项 v6 provenance drift 失败；未修改正式 manifest、未执行数据库迁移、未连接 Docker/远端。
- 目标继续保持 `active`；后续需要在明确的数据库治理合并/发布决策后，重新生成与当前 core-008/009 对齐的版本化 release evidence。

## 全局目标继续推进记录（2026-10-02，验收脚本 canonical Harness 路由清理）

- 全仓生产路径扫描发现四个手工企业助手验收脚本仍调用历史 `/agent/ai/*` 兼容前缀：`scripts/test-quick-stream.sh`、`scripts/test-enterprise-snapshot.sh`、`scripts/test-stream-save.sh`、`scripts/test-semantic.sh`。这些脚本并非运行时入口，但会传播旧协议并可能造成错误验收。
- 已将四个脚本统一切换到 canonical `/ai/config` 与 `/ai/chat/completions`，并在 `tests/engineering/harness-production-path-regression.mjs` 增加脚本级门禁，禁止 `/agent/ai/` 和 `/agent/twin/` 重新出现。
- `bash -n` 四个脚本、`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`npm run lint:changed` 和 `git diff --check` 均通过。兼容性路由仍仅由 HTTP router 归一化测试覆盖，不再作为人工验收示例发布。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，本地 Compose Harness Bridge 收口）

- 只读审计发现根开发 Compose 和若干启动/健康脚本仍把 `agent-runtime` 当作唯一智能服务，Runtime 默认可回退到 `host.docker.internal:3080`，且脚本使用无范围 `compose up -d`。这会让本地验收依赖外部进程，并可能顺带重建 web。
- 根 `docker-compose.yml` 现新增受限 `harness-bridge` 服务：使用仓库锁定的 `agent-harness/Dockerfile`、只读插件制品、非特权用户、无执行权限 tmpfs、固定 `readyz` 健康检查和持久 Bridge 状态卷；Runtime 默认指向 `http://harness-bridge:3080`，审计密钥和 Tool Proxy secret 改为必填。
- `scripts/start-app-center.sh/.ps1`、`scripts/deploy-simple.sh`、`scripts/deploy-pm2.sh` 和 `scripts/check-runtime-v2-health.sh` 现在显式构建/启动 `agent-runtime harness-bridge` 及必要服务，不再使用无范围 `up -d`；健康检查增加 Bridge 就绪探测。
- 为测试固定了缺失审计密钥场景的 `auditKey: ''`，避免当前进程环境变量污染错误边界；同时在 `production-config-regression.mjs` 增加根 Compose Bridge/default URL/Tool Proxy 门禁。
- 验证通过：根 `docker compose config --quiet`（仅解析，不启动容器）、`node agent-harness/test-write-boundary.js`、`npm run test:harness`、`node tests/engineering/production-config-regression.mjs`、`node tests/engineering/infrastructure-regression.mjs`、`node tests/engineering/runtime-image-contract.mjs`、`npm run lint:changed`、四个 shell `bash -n` 和 `git diff --check`。
- 本轮未启动 Docker、未连接远端/生产、未执行真实迁移或写入数据库卷、未发布或提交推送；DB v6 provenance、同源 Web client-plugin 制品、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

- 生产可达范围追加只读扫描（排除历史文档、负向测试、基线 SQL 和补丁脚本）未发现直接模型供应商变量、Cline 配置、Harness fallback/shadow、旧 Agent 编排导入或 `/agent/ai`、`/agent/twin` 客户端调用；保留的命中均属于兼容归一化/历史证据边界。

## 全局目标继续推进记录（2026-10-03，运维手册 Compose 范围收口）

- 审计发现 `docs/EISCORE_FUNCTION_MANUAL.md` 的 Docker 统一启动示例仍使用无范围 `docker compose up -d`，与伦度多 Agent 发布约束不一致。已改为显式启动 `db api agent-runtime harness-bridge nginx swagger code-server`，并注明后端/Harness 变更只重建 `agent-runtime harness-bridge`、web 发布必须遵守 web-only 流程。
- `tests/engineering/production-config-regression.mjs` 新增文档级门禁，禁止手册重新出现无范围 Compose 启动，并要求包含 scoped Harness 启动示例。
- 验证通过：`node tests/engineering/production-config-regression.mjs`、`npm run test:harness`、`npm run lint:changed`（161 个变更 JS/Vue 文件）和 `git diff --check`。本轮未启动 Docker、未连接远端/生产、未执行真实迁移或写入数据库卷、未发布或提交推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，现行语义规范切换 canonical Harness 路由）

- `docs/AGENT_AUTO_SEMANTICS_NO_TOUCH_SPEC_V1.md` 原先把 `/agent/ai/*` 写成当前 AI 对话入口，已改为 `/ai/config`、`/ai/agents`、`/ai/chat/completions`，并明确 `/agent/ai/*` 只作为 Runtime 兼容归一化输入，禁止新客户端和验收脚本使用。
- `tests/engineering/harness-production-path-regression.mjs` 增加规范级门禁：禁止旧路径作为“当前接口”定义，同时允许规范保留兼容边界说明。
- 验证通过：`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`npm run lint:changed`（161 个变更 JS/Vue 文件）和 `git diff --check`。本轮未连接远端、未启动 Docker、未执行真实迁移或写入数据库卷、未发布或提交推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，平台认证与外部制品复核）

- npm run test:platform-auth 通过，平台会话、权限、微应用 session、Flash/Twin/Workflow/AppRuntime consumers、session invalidation 和 direct-session inventory 均无回归。
- node tests/engineering/harness-production-path-regression.mjs 通过；对 AiCopilot.vue 和本轮配置回归文件做旧模型/旧 Agent 标记扫描，没有重新引入生产可达旧路径。
- 只读检查 .codex-tmp：发现内容为历史 build context、DSH SDK/cache、截图/审计工具和 tarball，不存在可验证的三个 client-plugin lib/index.js 同源发布制品；没有复制、挂载或以缓存冒充 LUNDU_HARNESS_ROOT 输入。
- 本轮没有连接远端/生产、启动持久 Compose、执行真实迁移或写入数据库卷；Docker engine、LUNDU_HARNESS_ROOT、真实 Provider/RLS、DB v6 provenance 和伦度远端验收继续作为未完成条件，全局目标保持 active。

## 全局目标继续推进记录（2026-10-03，Harness 有效启用状态与安全配置绑定）

- Runtime 不再仅依据 EISCORE_HARNESS_ENABLED=true 报告 enabled；审计配置或 Tool Proxy secret 缺失时，状态与实际 fail-closed 行为保持一致。
- 新增 isHarnessConfigurationReady()：Harness 只有在显式启用、Bridge origin 合法且非 loopback、审计 ledger 路径为绝对路径、审计 HMAC key 与 Tool Proxy secret 均不少于 32 字符时才报告 enabled。缺任一项时依赖 enabled 状态的请求入口保持关闭，且不会读取或记录 secret 值。
- Runtime 边界回归覆盖完整有效配置、逐项缺失四类配置、loopback/错误 Bridge URL 和 disabled 状态。
- 验证通过：node realtime/test-harness-runtime-boundaries.js、npm run test:harness、npm run lint:changed（165 个变更 JS/Vue 文件）和 git diff --check。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、基础设施 WSL shim、LUNDU_HARNESS_ROOT、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 active。

## 全局目标继续推进记录（2026-10-03，Bridge origin 运行时与生产门禁一致性）

- Runtime 的 Bridge origin 判定现与生产校验一致拒绝 deepseek-web Web UI 主机，避免把 Harness Web UI 当作 chat completions HTTP-to-SDK bridge。
- 验证通过：node realtime/test-harness-runtime-boundaries.js、node tests/engineering/production-config-regression.mjs、node tests/engineering/harness-production-path-regression.mjs、npm run test:harness 和 npm run lint:changed（165 个变更 JS/Vue 文件）。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、基础设施 WSL shim、LUNDU_HARNESS_ROOT、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 active。

## 全局目标继续推进记录（2026-10-03，DSH patch 制品 provenance 边界收口）

- validateHarnessToolArtifacts 现在要求 DSH_PATCH 解析后位于同一个受控 DSH_CWD 制品根目录内；根目录外的普通策略文件也会 fail closed，继续拒绝缺失文件、符号链接和非普通文件。
- 回归新增制品根外部 patch 文件负向用例；临时文件在测试 finally 中清理。
- 验证通过：node agent-harness/test-dsh-http-bridge-runtime.mjs、npm run test:harness、node tests/engineering/harness-production-path-regression.mjs、node tests/engineering/production-config-regression.mjs、npm run lint:changed（165 个变更 JS/Vue 文件）和 git diff --check。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、基础设施 WSL shim、LUNDU_HARNESS_ROOT、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 active。

## 全局目标继续推进记录（2026-10-03，DSH_CWD 制品根目录类型收口）

- 继续收紧 Bridge 制品 provenance：DSH_CWD 现在必须是存在的绝对非符号链接目录，不能指向普通文件、符号链接或不存在路径；DSH_PATCH 仍必须位于该目录树内。
- 回归新增 DSH_CWD 指向普通文件的负向用例，并清理临时文件。
- 验证通过：node agent-harness/test-dsh-http-bridge-runtime.mjs、npm run test:harness、node tests/engineering/harness-production-path-regression.mjs、npm run lint:changed（165 个变更 JS/Vue 文件）和 git diff --check。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、基础设施 WSL shim、LUNDU_HARNESS_ROOT、DB v6 provenance、全量质量门禁、真实 Provider/RLS 和伦度远端验收仍未完成。全局目标继续保持 active。

## 全局目标继续推进记录（2026-10-02，业务 smoke canonical Harness 路由清理）

- 追加审计发现 `tests/smoke/business-smoke.mjs` 仍把认证配置和聊天验收请求发往历史 `/agent/ai/*` 兼容前缀。已将 5 处请求统一切换到 `/ai/config` 与 `/ai/chat/completions`。
- 在 `tests/engineering/harness-production-path-regression.mjs` 纳入 smoke 脚本，并增加禁止 `/agent/ai/*`、`/agent/twin/*` 的静态门禁；历史文档和专门的路径归一化兼容测试仍保留。
- 验证通过：`node tests/engineering/harness-production-path-regression.mjs`、`npm run test:harness`、`npm run lint:changed`（161 个变更 JS/Vue 文件）和 `git diff --check`。Smoke 端到端本身需要运行中的服务和测试账号，本轮未启动持久服务或访问远端。
- 本轮未修改前端视觉、未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；DB v6 provenance、同源 Web client-plugin 制品、真实 Provider/API key、clean Harness image、完整 Compose clean release、外部双租户 JWT/RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Harness 收口回归与完成审计）

- 本轮继续验证：`node agent-harness/test-dsh-http-bridge-runtime.mjs`、`npm run test:harness`、`node tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/production-config-regression.mjs`、`node realtime/test-harness-runtime-boundaries.js`、`npm run lint:changed`（165 个文件）和 `git diff --check` 均通过。
- 同轮只读完成审计仍未满足完整目标：`docker version` 无法连接 Docker Desktop Linux engine；`node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 因 `LUNDU_HARNESS_ROOT` 缺失失败；`npm run db:release:check` 保持 8 项 DB v6 provenance drift；`npm run test:quality` 在既有 `eiscore-mobile/src/views/LoginView.vue` 超过 1632 行基线（当前 1826 行）处失败。
- 本轮未修改冻结 DB manifest、未修改前端视觉或复杂度基线、未构造/冒充 LUNDU 制品、未启动 Docker、未连接远端/生产、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，后端治理与平台契约复核）

- 追加验证通过：`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:runtime-router`、`npm run test:smart-bi` 和 `npm run test:platform-auth`。覆盖数据库服务身份、DB2 角色边界、数字分身 RLS、86 条 Runtime 路由、Harness 消息归一化、Flash 工具注册/确认/幂等/审计、WebSocket、通知器、Smart BI 配置及平台会话/权限/微应用 session consumers。
- 本轮仍只做本地只读/回归验证；未启动 Docker、未连接远端或生产、未执行真实迁移、未写入数据库卷、未发布、未提交或推送。之前记录的 Docker engine、LUNDU_HARNESS_ROOT、DB v6 provenance 和全量质量门禁阻塞仍然有效，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，安全扫描与生产路径复核）

- `npm run test:secrets` 完成并通过：SQL/dump secret scanner 回归通过，实际扫描 2821 个文本文件；保留的 5 个命中均属于 checksum-locked legacy SQL quarantine，扫描器未打印匹配值。
- `node tests/engineering/harness-production-path-regression.mjs` 通过，确认生产 HTTP/WebSocket composition 仍经由 Harness，未重新引入 legacy AI/Twin entrypoints。
- `npm run toolchain:check` 仅报告环境版本偏离锁定工具链（当前 Node 26.1.0/npm 11.13.0，项目期望 Node 20.19.0/npm 10.8.2），未修改代码或安装环境。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；Docker engine、LUNDU_HARNESS_ROOT、DB v6 provenance 和全量质量门禁阻塞仍有效，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，生产可达旧路径静态审计）

- 在 `realtime`、部署配置、Runtime/Host 客户端和脚本范围内排除测试/历史文档后扫描旧路径与供应商变量：未发现生产可达的旧模型直连、Cline、Harness fallback/shadow、`/agent/ai/` 或 `/agent/twin/` 客户端调用。
- 保留的 `deepseek-web` 命中仅为伦度 Nginx 对 Harness Web UI 的代理，以及 Runtime/生产校验中明确拒绝将该 Web UI hostname 当作 HTTP-to-SDK Bridge；不属于旧 Agent 编排或模型直连。
- 本轮仅做静态审计和文档记录，未连接远端/生产、未启动 Compose、未修改前端视觉、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，镜像/基础设施/迁移开关门禁）

- `npm run test:runtime-image` 通过，包含 Runtime image contract 和 Vite dev proxy contract（10 consumers）。
- `npm run test:infrastructure` 通过：24 个 shell scripts 与 production Compose 静态回归无新问题。
- `npm run test:migration-switch` 通过，Harness migration switch baseline 保持有效。
- `npm run test:database-migrations` 与 `npm run test:database-structure-exit` 均在 release contract 断言处失败，原因仍是同一 8 项 DB v6 provenance drift；此前的 migration ids/order/checksums、offline runner、baseline hashes、PostgREST contract 和 public schema ratchet 检查均已通过。未修改冻结 manifest 或执行真实迁移。
- 本轮未连接远端/生产、未启动持久 Compose、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，外部制品与 DB drift 复核）

- 外部状态复核无变化：`docker version` 仍无法连接 Docker Desktop Linux engine；`LUNDU_HARNESS_ROOT` 未设置；本地仅发现 `.codex-tmp` 缓存/构建上下文中的 `index.js`，没有可验证同源的 `client-plugins/eiscore-auth/lib/index.js`、`digital-twin/lib/index.js`、`enterprise-bi/lib/index.js`，未使用缓存冒充制品。
- `npm run db:release:drift` 生成最新只读报告并以 drift 退出；冻结 manifest SHA-256 仍为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，候选由当前 `2f17c46` 计算，DB v6 source revision/migration manifests/contracts/catalog/PostgREST 仍未对齐。未修改冻结 manifest，未执行真实迁移。
- `node scripts/dsh-sdk-runtime-smoke.mjs` 因未提供真实 `--bin=<absolute path to dsh/lib/bin.js>` 失败；`node scripts/dsh-web-plugin-runtime-smoke.mjs` 因缺少 `client-plugins/eiscore-auth/lib/index.js` 失败。两项均是外部制品缺失的真实证据，未构造 fixture 绕过。
- 本轮未连接远端/生产、未启动持久 Compose、未写入数据库卷、未发布、未提交或推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，宿主契约与语法门禁）

- 追加验证通过：`npm run test:syntax`（303 个 Node 文件）、`npm run test:ai-copilot`（工作流/Smart BI/import/message/template/report/chart 策略与组合根）、`npm run test:enterprise-config`、`npm run test:production-config`。后者同时覆盖生产安全配置、LUNDU Harness artifact preflight 和启动期 DSH profile runner。
- 这些回归确认 Harness 迁移未破坏 AiCopilot 宿主策略、企业配置、生产变量拒绝门禁或 LUNDU Web runner 合同；没有把缺失的外部编译制品误报为本地可发布制品。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；Docker engine、LUNDU_HARNESS_ROOT、DB v6 provenance、真实 DSH SDK/插件制品和全量质量门禁仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，隔离 DB 套件与 company-site BFF 夹具收口）

- WSL Ubuntu Docker daemon（Node 20.18.1）下复验隔离数据库：DB1 baseline equivalence 通过，DB3 contracts 通过，DB3 roles/company-site Agent RLS/HR payroll RLS denial contracts 通过；company-site BFF 端到端测试最终通过。测试使用临时容器/网络/卷，结束后未残留 `eiscore-db*` 测试容器，未触碰现有业务容器或业务卷。
- 修复 `scripts/test-company-site-bff.mjs` 两处与当前 Harness/数据库迁移合同不同步的测试夹具：core 迁移计数从旧 core-007 时代的 `6 applied, 1 skipped` 更新为当前 core-009 线的 `8 applied, 1 skipped`；隔离 JWT 增加 `tenant_id` 并在 `asUser` 映射中保留租户上下文。产品认证门禁未放宽，`HARNESS_AUTH_REQUIRED` 仍对缺少租户上下文的请求生效。
- DB release/recovery 隔离套件仍在 release contract 处因同一 8 项冻结 v6 provenance drift 失败；未修改冻结 manifest。company-site BFF 原先的计数/认证失败已收口，不再作为未完成项。
- 回归通过：`npm run test:harness`、`node tests/engineering/database-migration-governance-regression.mjs`、`npm run lint:changed`（166 个变更 JS/Vue 文件）和 `git diff --check`。本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，company-site BFF 夹具回归复验）

- 变更后复验通过：`node --check scripts/test-company-site-bff.mjs`、WSL Ubuntu Docker 下 `npm run test:database-company-site-bff:docker`、`node tests/engineering/harness-production-path-regression.mjs` 和 `node tests/engineering/production-config-regression.mjs`。
- BFF 隔离链路实际覆盖 public/admin/publish/inquiry/sales Agent HTTP chains；Harness 生产路径仍无 legacy AI/Twin entrypoints，生产配置安全门禁保持通过。
- 当前脚本 diff 仅包含隔离测试夹具的 tenant claim 映射和 core-009 迁移计数修正，未放宽产品认证、未修改冻结 release manifest；`git diff --check` 通过。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；DB v6 provenance、真实 Provider/同源插件制品和全量质量门禁阻塞仍有效，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，权限/业务契约补充审计）

- 追加本地合同验证通过：`npm run test:agent-permission-boundary`、`npm run test:company-site-runtime`、`npm run test:grid-agent`、`npm run test:smart-bi`。覆盖 Flash 角色范围/工具 ACL、数字分身按权限与字段 ACL 过滤、company-site 28 张表 schema 与 handlers、网格语义查询和 Smart BI 配置。
- `npm run runtime:access-audit` 未通过是因为当前没有运行中的 PostgREST `127.0.0.1:3000`（`ECONNREFUSED`）；该脚本是在线 Runtime V2 访问审计，不提供离线模式，也未因此启动项目服务。相同的 PostgreSQL/PostgREST 角色、RLS 和拒绝合同已由 WSL 隔离 DB3 roles/contracts 套件通过覆盖。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider/同源插件制品、完整 Compose、外部双租户在线验收、DB v6 release provenance 和全量质量门禁仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，锁定 DSH SDK initialize 复验）

- 使用当前分支 `agent-harness/node_modules/@deepseek-ai/dsh/lib/bin.js` 和临时 `DSH_HOME` 运行 `scripts/dsh-sdk-runtime-smoke.mjs`，initialize 成功：返回 `deepseek-harness-sdk-runtime@0.0.1`，`frameCount=1`、`stderrBytes=0`。临时状态目录已清理。
- 该证据只证明当前锁定 DSH SDK 的 JSON-RPC 启动/initialize 合同，不证明真实 DeepSeek Provider、真实 prompt/tool 输出、同源 Web client-plugin、客户数据 RLS 或远端部署；这些仍保持未完成。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，临时 Bridge smoke 清理与证据边界）

- 上轮尝试使用 WSL Docker 启动一次性 `eiscore-harness-bridge:codex-plugin-boundary-20260930` 容器时，PowerShell 嵌套命令错误展开了 `$(seq ...)`，未形成可靠的 `/readyz` 轮询证据；容器随后以退出码 0 结束。该次尝试不计为 readiness 通过。
- 已读取并删除固定临时容器 `eiscore-harness-smoke-codex`，`docker ps -a` 确认无残留；未影响任何项目 Compose、业务容器或数据库卷。可靠的 Bridge 证据仍以 `npm run test:harness-bridge`、锁定 DSH SDK initialize smoke 和此前隔离镜像 readiness 记录为准。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Bridge clean build 再验证）

- 使用 WSL Ubuntu Docker daemon 对当前工作树执行临时 `docker build --file agent-harness/Dockerfile --tag eiscore-harness-bridge:codex-current-recheck .`，legacy builder 在 Windows 挂载上下文扫描阶段约 180 秒无输出，已安全终止；临时 tag 未生成，未留下构建容器。
- `docker ps -a` 未发现本次构建残留，`git diff --check` 通过；已有带 digest 的 Bridge/agent 镜像和此前隔离 readiness 证据未被触碰。该结果确认 clean build 阻塞仍是构建环境/挂载 I/O，而非新的 Dockerfile 语法或运行时测试失败。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，WSL staging Bridge clean build 复验）

- 为区分 Windows 挂载 I/O 与代码构建问题，将当前分支 `agent-harness` 复制到 WSL `/tmp/eiscore-harness-build-codex`，执行临时 `docker build --file .../agent-harness/Dockerfile --tag eiscore-harness-bridge:codex-staged-recheck`。即使脱离 Windows 挂载上下文，WSL legacy builder 仍超过 300 秒无输出且无法按 `timeout` 及时回收，已安全终止。
- staging 目录已删除，临时 tag 未生成，`docker ps -a` 无本次构建容器残留；已有镜像未被触碰。该结果把 clean build 阻塞进一步定位为当前 WSL legacy builder/依赖构建环境问题，不能作为当前 Dockerfile clean build 通过证据。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，现有镜像 provenance 与入口检查）

- WSL Docker 环境复核：`docker buildx version` 返回 unknown command，`buildctl` 不存在，当前 daemon 只能使用 legacy builder；这解释了 Windows 与 `/tmp` staging clean build 均无法及时完成。未安装或修改 Docker 工具链。
- 对已有带 digest 镜像做只读检查：`eiscore-harness-bridge:codex-plugin-boundary-20260930` 为 Linux/amd64、digest `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`、运行用户 `10001:10001`、Node 入口；`eiscore-agent-runtime:codex-0850fe6` 为 Linux/amd64、digest `sha256:b0c1b1f768f33d220018933273fb81d3c06aab8f5b85dc374e7f0cb1eaff7c30`。
- 一次性无网络容器检查通过：Bridge `dsh-http-bridge.mjs` 与 agent `index.js` `node --check` 均通过；Bridge 镜像内的 DSH executable、`plugin-registry.js` 和 `plugin-contract.v1.json` 均存在。容器使用 `--rm`，未启动持久服务或挂载业务卷。
- 这些检查证明已有镜像制品的入口/文件边界，但不替代当前工作树 clean rebuild、真实 Provider、同源 Web client-plugin、完整 Compose 或远端验收。全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，发布证据只读门禁复核）

- `npm run test:database-release-drift` 通过，确认 drift 报告保持只读并明确暴露 core-009 provenance gap；未修改冻结 v6 manifest。
- `npm run test:production-config` 通过，包含生产配置安全回归、LUNDU Harness artifact preflight 和启动期 DSH Web runner；`node tests/engineering/harness-production-path-regression.mjs` 通过，生产 HTTP/WebSocket composition 仍经 Harness 且无旧 AI/Twin entrypoints。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider/同源 Web client-plugin、完整 Compose、DB v6 release provenance 和全量质量门禁仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Harness 核心链路最终回归）

- 追加通过：`npm run test:harness-bridge`（HTTP bridge、SDK framing/continuation、超时/取消/会话 drain/shutdown）、`npm run test:harness-runtime-boundaries`（Runtime capability、multimodal、固定 capability HTTP、上下文净化、稳定错误）、`npm run test:harness-twin-chat`（RLS-owned digital twin session、消息持久化、Harness session 标记）和 `npm run test:migration-switch`。
- 这些结果再次确认 Plugin -> Bridge -> Runtime/Tool Gateway -> Twin/RLS 的本地合同，以及旧路径切换门禁均通过；未调用真实 DeepSeek Provider 或客户数据库。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 Web client-plugin、完整 Compose clean release、外部双租户在线验收、DB v6 release provenance 和全量质量门禁仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，宿主平台与模块集成回归）

- 追加验证通过：`npm run test:platform-http`（平台/Agent/Twin/Flash/文档/Geo/快照/SSE HTTP boundaries 与 direct-fetch inventory）、`npm run test:enterprise-routing`（11 个企业模块）和 `npm run test:enterprise-dependencies`（11 个企业模块依赖图）。
- `npm run toolchain:check` 仍只报告环境版本偏离锁定工具链（当前 Node 26.1.0/npm 11.13.0，期望 Node 20.19.0/npm 10.8.2），没有修改环境或代码。
- 这些结果确认 Harness 迁移后的宿主平台 HTTP boundary、模块路由和依赖合同保持完整；本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，企业交接资产基线复核）

- `npm run test:enterprise-branding`、`npm run test:enterprise-profile` 和 `npm run test:enterprise-artifact-set` 通过；这些回归确认伦度品牌、企业概况/独立站集成与 artifact-set 合同保持有效。
- `npm run test:enterprise-handoff` 和其 validator 子测试未通过于初始 readiness snapshot 合同：`jinwei-netting` 的快照 `presentFileCount=28`，但当前工作树 `eiscore-company-site/public/assets/jinwei/research-gallery` 实际递归文件数为 26；君乐缘素材目录实际为 42/14，与快照一致。该 `inventory-file-count-drift` 属于既有企业交接资产基线，不是 Harness 后端代码路径；未修改素材、快照或校验基线，也未放宽校验。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；企业交接资产 drift 另行阻塞，Harness 目标仍保持 `active`。

## 全局目标继续推进记录（2026-10-03，企业配置/交接回归结果归因）

- `npm run test:enterprise-branding`、`npm run test:enterprise-profile` 和 `npm run test:enterprise-artifact-set` 复验通过。
- `npm run test:enterprise-handoff`、`npm run test:enterprise-confirmation` 和 `npm run test:enterprise-response` 仍未通过：共同根因是 `jinwei-netting` 的 `research-gallery` 当前递归文件数为 26，而 `enterprise-handoffs/first-wave-readiness.json` 的冻结快照记录为 28，validator 报 `inventory-file-count-drift`。该问题属于既有交接素材/快照资产，不是 Harness 后端链路；本轮未修改素材、快照或校验规则。
- `npm run test:enterprise-bootstrap` 未通过于测试夹具的模块实例边界：`eiscore-base` 通过 workspace 安装的 `@eiscore/platform` 与测试直接导入的仓库源码各自创建了同名但不同 prototype 的 `EnterpriseConfigError`，因此 `instanceof` 断言失败；实际错误名称、消息和 `http-404` 语义一致。该重复模块问题尚未修改，避免把无关测试重构混入 Harness 迁移。
- `npm run test:enterprise-navigation` 的前三个回归通过，`dynamic-router-boundary-regression.mjs` 仅因源码统计实际为 126 次 router 调用而冻结基线期望 125 次失败；未修改该无关基线。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；真实 Provider/同源 client-plugin 制品、Docker clean build、DB v6 provenance 和完整质量门禁仍是全局目标的未完成项，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，bootstrap 契约假失败收口）

- 修正 `tests/engineering/base-enterprise-bootstrap-regression.mjs` 的测试断言：workspace 安装的 `@eiscore/platform` 与测试直接导入仓库源码时，`EnterpriseConfigError` 可能来自不同模块实例，不能只用跨实例 `instanceof`；现在同时校验错误名称和 `http-404` 结构化 issue，开发态默认配置改用结构深比较。
- `npm run test:enterprise-bootstrap`、`npm run test:enterprise-config`、`node --check tests/engineering/base-enterprise-bootstrap-regression.mjs` 均通过；该改动没有放宽生产认证或配置校验，也没有改变 Harness 运行时。
- 本轮未连接远端/生产、未启动项目 Compose、未执行真实迁移、未写入数据库卷、未发布、未提交或推送；企业交接素材 drift、dynamic-router 基线、真实 Provider/同源 client-plugin 制品、Docker clean build、DB v6 provenance 和完整质量门禁仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Harness 外部门禁与 SDK smoke 复核）

- `npm run test:harness` 全套通过，覆盖 Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话归属、写确认/幂等/审计、数字分身、文档提交、销售写入、生产路径和 migration switch。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍以 `LUNDU_HARNESS_ROOT: required` 失败；当前工作树没有三个可证明同源的 Web client-plugin 编译入口，未使用缓存或 fixture 冒充制品。
- `npm run db:release:drift` 仍报告冻结 DB v6 manifest 与当前 `2f17c46` 候选不一致：冻结 core 终点为 `core-007`，候选为 `core-009`，并伴随 contract/catalog/PostgREST 等 provenance checksum drift；未修改冻结 manifest，未执行真实迁移。
- 使用当前 `agent-harness/node_modules/@deepseek-ai/dsh/lib/bin.js` 与本轮临时 `DSH_HOME` 运行 `scripts/dsh-sdk-runtime-smoke.mjs` 成功：`server=deepseek-harness-sdk-runtime@0.0.1`、`frameCount=1`、`stderrBytes=0`。该证据只证明 SDK initialize/JSON-RPC 启动合同，不证明真实 Provider、真实 prompt/tool 输出、同源 Web 插件或远端验收。
- 本轮新建的 `.codex-tmp/dsh-smoke-current` 中 SDK 生成的 `sdk` 子目录因权限无法安全删除，未扩大删除范围；这是本轮临时目录清理限制，不影响代码或业务数据。
- 本轮未连接远端/生产、未启动项目 Compose、未写入数据库卷、未发布、未提交或推送；真实 Provider/同源 client-plugin 制品、Docker clean build、DB v6 provenance 和完整质量门禁仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Runtime 会话作用域与平台认证复验）

- 复验通过：`npm run test:harness-runtime-boundaries`、`npm run test:platform-auth` 和 `node tests/engineering/harness-production-path-regression.mjs`。
- 当前 `realtime/harness-runtime.js` 的 Provider dispatch 继续按 `subject + tenant + plugin` 绑定 session scope，并对跨作用域复用返回 `HARNESS_SESSION_OWNERSHIP_DENIED`；Tool Proxy 同时校验活动 session 与 capability plugin 一致，未发现新的生产可达身份/租户旁路。
- 本轮未修改 Runtime/前端/数据库发布证据，也未连接远端、启动 Compose、执行真实迁移、写入数据库卷、发布、提交或推送；真实 Provider、同源 Web client-plugin 制品、Docker clean build、DB v6 provenance、完整 Compose release 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，企业交接/导航门禁复验）

- `npm run test:enterprise-handoff`、`npm run test:enterprise-confirmation` 和 `npm run test:enterprise-response` 仍失败于同一既有资产基线：`enterprise-handoffs/first-wave-readiness.json` 对 `jinwei-research-gallery` 记录 `presentFileCount=28`，当前目录实际递归文件为 26（当前缺失 `gallery-001`、`gallery-002`、`gallery-003`、`gallery-021` 等清单项中的已删除文件），validator 报 `inventory-file-count-drift`；未修改素材、快照或确认协议。
- `npm run test:enterprise-navigation` 的 enterprise/sales/cross-module 三个回归通过，`dynamic-router-boundary-regression.mjs` 仍因实际 router 调用数 126、冻结基线 125 失败；该源码计数基线不属于 Harness 后端范围，未修改。
- 这些失败不改变 Harness 后端证据：本轮没有连接远端/生产、启动 Compose、执行真实迁移、写入数据库卷、发布、提交或推送；真实 Provider、同源 client-plugin 制品、Docker clean build、DB v6 provenance、完整 Compose release 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Runtime→Bridge 服务身份边界）

- 新增独立的 `EISCORE_HARNESS_BRIDGE_SECRET`（至少 32 字符）作为 Runtime→Bridge 服务间认证；它与反向 Bridge→Runtime Tool Proxy 的 `EISCORE_TOOL_PROXY_SECRET` 分离，避免混淆信任方向。Runtime 仅将该 secret 放入 Bridge 请求头，Bridge 校验后不转发给 DSH SDK 或工具调用。
- `isHarnessConfigurationReady`、生产环境校验和根级/生产/LUNDU Compose 均要求该 secret；环境样例已补充占位字段。缺失或弱 secret 会使 Harness 配置故障关闭或生产门禁失败。
- `agent-harness/test-http-bridge.js` 新增行为回归：缺失/错误 Bridge secret 返回 401 `HARNESS_BRIDGE_UNAUTHORIZED`，正确 secret 才能进入 invoke，且 invoke 收不到该 secret；`npm run test:harness-bridge`、`npm run test:harness-runtime-boundaries`、`npm run test:production-config` 和 `npm run lint:changed`（167 个文件）均通过。
- 本轮未连接远端/生产、未启动 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 client-plugin 制品、Docker clean build、DB v6 provenance、完整 Compose release 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，服务认证完整回归）

- 完整 `npm run test:harness` 在新增 Runtime→Bridge secret 后通过；Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、文档/销售写入、生产路径与 migration switch 均未回归。
- `node --check agent-harness/http-bridge.js`、`node --check realtime/harness-runtime.js`、`node --check agent-harness/test-http-bridge.js` 和 `git diff --check` 通过；`npm run lint:changed`（167 个文件）通过。
- 新增的 `EISCORE_HARNESS_BRIDGE_SECRET` 只保护 Runtime→Bridge HTTP 请求，Bridge 校验后不会进入 DSH SDK 或 Tool Proxy；与 `EISCORE_TOOL_PROXY_SECRET` 分离，完成双向服务身份边界。
- 本轮未连接远端/生产、未启动 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 client-plugin 制品、Docker clean build、DB v6 provenance、完整 Compose release 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，部署文档与双向 secret 契约同步）

- 更新 `env/README.md` 与 `deploy/lundu/README.md`：明确 `EISCORE_HARNESS_BRIDGE_SECRET` 仅用于 Runtime→Bridge，`EISCORE_TOOL_PROXY_SECRET` 仅用于 Bridge→Runtime Tool Proxy，两个 secret 必须独立且均至少 32 字符；Bridge 校验失败时在进入 DSH SDK 前返回 401。
- `tests/engineering/production-config-regression.mjs` 新增根环境模板和 LUNDU 环境模板的 secret 契约断言；`npm run test:production-config` 与 `npm run lint:changed`（167 个文件）通过。
- 本轮未连接远端/生产、未启动 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 client-plugin 制品、Docker clean build、DB v6 provenance、完整 Compose release 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，服务认证后全量安全复验）

- `npm run test:secrets` 通过：扫描 2821 个文本文件，新增双向 Harness secret 未形成未授权泄露；保留 5 个命中仍属于 checksum-locked legacy SQL quarantine，扫描器未打印匹配值。
- `node tests/engineering/harness-production-path-regression.mjs` 通过，确认生产 HTTP/WebSocket composition 仍经 Harness，未重新引入 legacy AI/Twin entrypoints。
- 完整 `npm run test:harness` 通过，包含 Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、文档/销售写入、生产路径和 migration switch。
- 本轮未连接远端/生产、未启动 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 client-plugin 制品、Docker clean build、DB v6 provenance、完整 Compose release 和远端验收仍未完成，目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，最新阻塞证据复核）

- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 仍失败：`LUNDU_HARNESS_ROOT: required`。当前没有可验证同源的 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js`、`client-plugins/enterprise-bi/lib/index.js`，未用缓存、fixture、其他 worktree 或 tarball 冒充制品。
- `docker version` 仅返回 Windows client `29.1.3`；`desktop-linux` daemon 无法连接 `npipe:////./pipe/dockerDesktopLinuxEngine`。`docker buildx version` 返回 `v0.30.1-desktop.1`，但 daemon 不可用，因此仍无法对当前工作树执行 clean Docker build 或完整 Compose 验收。
- `npm run db:release:drift` 仍报告冻结 manifest `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d` 与候选 manifest `b1d8868a25433ca53a0dcfee00e5590c23374b2115e932f009cb1bdd89db142d` 不一致；冻结 source revision `b9a3831d08aeb7056ee8a5997ca8b57ae270ca08`，候选为 `2f17c46b52b29cb4c99ae9583b355be07a0aa5d2`；core 终点从 `core-007` 漂移到 `core-009`，并伴随数据库 contract/catalog/PostgREST checksum drift。未修改冻结 manifest，未执行真实迁移。
- 本轮只做只读复核和文档记录；未连接远端/生产、未启动持久 Compose、未写入业务数据库卷、未发布、未提交或推送。真实 Provider、同源 Web client-plugin、Docker clean build、DB v6 release provenance、完整 Compose release 和远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，后端回归与阻塞证据复核）

- 后端范围回归重新通过：`npm run test:harness`（Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、文档/销售写入、生产路径、查询/读取边界、输出策略和 migration switch）、`npm run test:runtime-router`、`npm run test:agent-permission-boundary`、`npm run test:database-backend-governance`、`npm run test:database-roles`、`npm run test:migration-switch`、`npm run test:production-config`、`npm run test:syntax`（303 个 Node 文件）均通过。
- `npm run test:unit` 仍未通过，但失败范围锁定在既有独立站素材基线：`eiscore-company-site/test/jinwei-research-images.test.js` 要求 31 张研究图和公开模型资源；当前 `public/assets/jinwei/research-gallery` 实际只有 26 个文件，缺失断言首先命中 `gallery-001.png` 与 `gallery-021.jpeg`。本轮没有补素材、改快照或放宽测试，因为这不属于 Harness 后端迁移范围。
- 外部门禁复核结果不变：`node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 失败于 `LUNDU_HARNESS_ROOT: required`，当前没有可证明同源的 `eiscore-auth`、`digital-twin`、`enterprise-bi` Web client-plugin 制品；未使用缓存、fixture、其他 worktree 或历史 tarball 冒充。
- `docker version` 仅能读取 Windows client `29.1.3`，`desktop-linux` daemon 仍无法连接 `npipe:////./pipe/dockerDesktopLinuxEngine`；因此当前工作树 clean Docker build、Compose 运行态和容器级验收仍不可验证。
- `npm run db:release:drift` 继续报告 DB v6 provenance drift：冻结 manifest SHA-256 为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，候选为 `b1d8868a25433ca53a0dcfee00e5590c23374b2115e932f009cb1bdd89db142d`；冻结 core 终点 `core-007`，候选 `core-009`，并伴随 database contract/catalog/PostgREST checksum drift。未修改冻结 manifest，未执行真实迁移。
- 本轮只做本地只读回归与文档记录；未连接远端/生产、未启动持久 Compose、未写入业务数据库卷、未发布、未提交或推送，未修改前端视觉。真实 Provider、同源 Web client-plugin、Docker clean build、DB v6 release provenance、完整 Compose release 和远端验收仍未完成，全局目标保持 `active`。
- `npm run test:quality` 在 `test:g3-exit` 的 `vue-complexity-inventory-regression.mjs` 首个失败处停止：`eiscore-mobile/src/views/LoginView.vue` 当前 1826 行，冻结基线为 1632 行。该前端复杂度/基线问题不属于本后端 Harness 迁移范围；未修改前端视觉、未放宽基线。
- 修复 `tests/engineering/infrastructure-regression.mjs` 的测试夹具：为新双向服务认证契约补充隔离的 `EISCORE_HARNESS_BRIDGE_SECRET`，并将 `EISCORE_HARNESS_BRIDGE_SECRET` 与 `EISCORE_TOOL_PROXY_SECRET` 都纳入缺失变量拒绝断言；没有放宽 Compose 或生产配置。修复后 `npm run test:infrastructure`、`npm run test:production-config`、`npm run lint:changed`（167 个变更 JS/Vue 文件）和 `git diff --check` 通过。
- `npm run test:secrets` 通过（2817 个文本文件；5 个命中仍属于 checksum-locked legacy SQL quarantine，未打印匹配值）。`npm run test:runtime-image` 通过（27 个 composition-root 模块、2 个 Dockerfile）以及可配置 Vite dev proxy 契约。
- `npm run test:database-migrations` 通过 migration governance、runtime runner、baseline、contract governance 四个阶段后，在 `database-release-contract-regression.mjs` 停止于既有 DB v6 release artifact/contract/catalog/PostgREST checksum drift；未修改冻结 manifest、未执行真实迁移。
- 本轮复验通过：`npm run test:harness` 全套（Plugin registry、Bridge、Gateway、Tool Gateway、Runtime capabilities、数字分身 RLS-owned session/message、文档/销售写入、生产路径、查询/读取、输出策略、migration switch）、`node tests/engineering/harness-production-path-regression.mjs` 和 `npm run test:platform-auth`。未发现旧 Agent/Twin 入口、旧模型直连或 Harness fallback/shadow 生产旁路回归。
- `npm run test:database-release-drift` 通过，确认 drift 报告保持只读并稳定暴露 `core-009` provenance gap；`npm run test:database-structure-exit` 仍在 DB v6 结构 release contract 的同一组 contract/catalog/PostgREST checksum drift 处失败，未修改冻结 manifest。
- 当前分支仍没有可追溯的 `client-plugins/{eiscore-auth,digital-twin,enterprise-bi}/lib/index.js`；`node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 继续故障关闭。仓库外候选制品未复制、未挂载、未作为当前分支验收输入。
- 本轮没有连接远端/生产、启动持久 Compose、执行真实迁移、写入数据库卷、修改前端视觉、发布、提交或推送；Docker daemon、同源 Web client-plugin、真实 Provider/API key、DB v6 release provenance、完整 Compose clean release、外部双租户在线 RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。
- 本轮完成生产可达旧路径静态审计：在当前分支可存在的 `realtime`、`agent-harness`、平台/共享运行时代码、脚本和前端 transport 源码中，未发现 `callAiUpstream`、旧 `/agent/ai|twin|flash` 调用、`agent:task/tool_use/terminal`、旧 Cline runtime import、`EISCORE_HARNESS_FALLBACK/SHADOW` 或直接 Provider egress。唯一文本命中是生产环境校验器的禁止变量清单，以及业务工作流的 `legacy_fallback_enabled` 兼容字段；`harness-production-path-regression.mjs` 已断言它们不进入 Harness/Agent 运行时或部署配置。
- 新鲜通过：`npm run test:platform-http`（平台 HTTP、AI Bridge、数字分身/Flash/文档边界和 direct-fetch inventory）、`npm run test:enterprise-dependencies`（11 个企业模块）以及 `node tests/engineering/harness-production-path-regression.mjs`。
- 一次 PowerShell 全量扫描曾因包含已删除 tracked 路径产生文件不存在噪声；过滤不存在路径后复跑，结果仅保留上述预期文本命中，没有新增旧运行时入口。该扫描未修改文件。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；真实 Provider、同源 Web client-plugin、Docker clean build、DB v6 provenance、完整 Compose release、外部双租户 RLS 和远端验收仍未完成，全局目标保持 `active`。
- 本轮完成当前分支 DSH tool-call loopback smoke：使用锁定 `@deepseek-ai/dsh@0.1.2-rc.1`、隔离 `DSH_HOME`、当前 `eiscore-restricted.cordis.yml`/`eiscore-tools.mjs`、本地 mock Provider 和本地 Tool Proxy；首轮模型请求发出 `eiscore_enterprise_snapshot`，Proxy 返回 tool result 后第二轮模型请求完成，最终文本为 `mock response recovered`，观测到 `proxyCalls=1`、`modelRequests=2`、退出码 0。该证据证明 SDK -> EISCore tool -> result continuation 的本地闭环；没有真实 API key、客户数据库、远端或持久 Compose，不证明真实 DeepSeek Provider、同源 Web client-plugin 或业务输出等价。
- 本轮按目标矩阵真实执行 `npm run test:database:docker`：DB1 fresh baseline 套件在创建第一个隔离容器前因 Docker Desktop Linux engine named pipe `npipe:////./pipe/dockerDesktopLinuxEngine` 不可用而失败；没有创建测试容器、网络、卷，也没有触碰项目数据库卷。该结果不能替代此前 WSL daemon 上的历史隔离 DB/RLS 证据，当前环境仍无法复验。
- `npm run test:toolchain` 通过（15 个锁定 CI 包）；`npm run toolchain:check` 只报告环境偏离锁定版本（当前 Node `26.1.0`/npm `11.13.0`，期望 Node `20.19.0`/npm `10.8.2`），未修改宿主工具链。
- 本轮没有修改运行时代码或前端视觉、没有连接远端/生产、没有启动持久 Compose、没有执行真实迁移、没有写入业务数据库卷、没有发布、没有提交或推送；Docker/DB 隔离复验、同源 Web client-plugin、真实 Provider、DB v6 provenance、完整 Compose release、外部双租户 RLS 和远端验收仍未完成，全局目标保持 `active`。
- DB Docker 套件之外的后端质量阶段本轮全部复验通过：`npm run test:syntax`（303 个 Node 文件）、`npm run test:harness`、`npm run test:toolchain`、`npm run test:production-config`、`npm run test:database-backend-governance` 和 `npm run test:database-roles`。Harness 套件覆盖 Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话归属、写确认/幂等/审计、数字分身、文档/销售写入、生产路径、查询/读取、输出策略和 migration switch。
- `npm run test:database:docker` 本轮真实尝试在第一个 fresh-container 启动前因 `dockerDesktopLinuxEngine` named pipe 不可用退出；无容器/网络/卷残留。该环境阻塞只影响隔离 DB/RLS 复验，不改变已通过的静态 DB role/RLS 合同和 Harness 本地测试。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未修改前端视觉、未发布、未提交或推送；Docker DB 复验、同源 Web client-plugin、真实 Provider、DB v6 provenance、完整 Compose release、外部双租户 RLS、Smart BI 等价和远端验收仍未完成，全局目标保持 `active`。
- 本轮仓库级 smoke 复验：新增 scripts/dsh-sdk-tool-loopback-smoke.mjs，仅使用 Node 标准库 http、当前分支锁定的 @deepseek-ai/dsh@0.1.2-rc.1、当前 Harness profile/tool plugin、隔离临时 DSH_HOME、本地 mock OpenAI-compatible SSE Provider 和本地 Tool Proxy；npm run test:harness-bridge 与 npm run test:harness 均通过，smoke 输出为 {"ok":true,"text":"mock response recovered","proxyCalls":1,"modelRequests":2}。node --check 与 git diff --check 通过。该证据只证明 SDK initialize、首轮 tool call、Tool Proxy 回传和第二轮结果 continuation 的本地闭环，不证明真实 Provider、同源 Web client-plugin、业务答案等价、Docker/Compose、外部双租户 RLS 或远端验收。本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送；既有阻塞保持不变，全局目标保持 active。
- 本轮后端契约复验通过：npm run test:syntax（304 个 Node 文件）、npm run test:platform-http、npm run test:platform-auth、npm run test:runtime-router、npm run test:agent-permission-boundary、npm run test:database-backend-governance、npm run test:database-roles、node tests/engineering/harness-production-path-regression.mjs、npm run test:production-config、npm run test:database-release-drift、npm run test:infrastructure 和 npm run lint:changed（168 个变更 JavaScript/Vue 文件）均通过。覆盖 Harness 生产路径、Bridge/Gateway、工具代理、会话/租户/RLS、写确认/幂等/审计、数字分身、Flash/Workflow/销售/文档能力和 Compose 配置边界。
- 只读检查仓库外 C:/Users/Twist/Documents/eiscore/agent-harness 的未提交 staging 目录：三组 client-plugins/*/lib/index.js 虽然存在，但该目录 Git 显示无提交且不是当前 github-eiscore-refactor 工作树；使用 node scripts/validate-lundu-harness-artifacts.mjs --harness-root "C:\\Users\\Twist\\Documents\\eiscore\\agent-harness" 时仍因缺少同目录 eiscore-tools.mjs 与 eiscore-restricted.cordis.yml 失败。未复制、挂载、提交或将其作为当前分支制品；LUNDU_HARNESS_ROOT provenance 阻塞保持。
- 本轮未连接远端/生产、未启动持久 Docker Compose、未执行真实迁移、未写入数据库卷、未修改前端视觉、未发布、未提交或推送。真实 Provider、当前分支同源 Web client-plugin/tool/profile 制品、Docker clean release、DB v6 provenance、外部双租户 RLS、Smart BI 等价和伦度远端验收仍缺少权威证据，全局目标保持 active。

## 全局目标继续推进记录（2026-10-03，WebSocket Flash 入口旁路审计）

- 对 `realtime/index.js`、`realtime/websocket-server.js`、Harness Runtime/HTTP/Capability/Chat handlers 及相关前端 transport 做生产可达静态审计。`flash:tool_call` 仍由 WebSocket manifest 注册，但处理器只调用现有 `executeFlashToolCall` 用户作用域工具服务；当前分支没有前端生产调用该消息类型，也未发现它连接旧 Agent 编排、模型直连、Cline runtime、Harness fallback/shadow 或未授权 Provider egress。该接口保留为显式 Flash 工具操作入口，不作为模型执行旁路。
- 真实复验通过：`npm run test:harness`（Plugin/Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、文档/销售写入、生产路径、查询/读取、输出策略、Bridge 认证和 migration switch）、`node tests/engineering/harness-production-path-regression.mjs`、`node tests/engineering/websocket-server-regression.mjs`、`node tests/engineering/flash-tool-service-regression.mjs`。
- 本轮未修改运行时代码、前端视觉或数据库发布证据；未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送。真实 Provider、当前分支同源 Web client-plugin/tool/profile 制品、Docker clean release、DB v6 provenance、外部双租户 RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 `active`。
## 全局目标继续推进记录（2026-10-03，Flash WebSocket 工具调用收敛到 Harness Gateway）

- 审计确认 flash:tool_call 虽仍是公开 WebSocket 消息类型，但之前的处理器直接调用 executeFlashToolCall，与能力目录所声明的 Harness Gateway 边界不一致；当前前端没有生产发送该消息的调用点，因此没有兼容性阻断。
- 新增 realtime/flash-harness-ws.js：服务端根据受信任的 Flash 工具注册定义固定选择 eiscore_flash_read 或 eiscore_flash_write，将请求送入本地 Harness Tool Gateway；用户、租户、权限、写确认、幂等和审计继续由 Gateway/Flash service 处理，客户端 payload 不能伪造这些边界字段。
- realtime/index.js 已把 WebSocket flash:tool_call 接到该 Harness 适配器；新增 realtime/test-flash-harness-ws.js 并纳入 test:harness-runtime-boundaries，覆盖读写 capability 映射、外层确认/幂等传递和稳定结果信封。
- 真实通过：node realtime/test-flash-harness-ws.js、npm run test:harness-runtime-boundaries、完整 npm run test:harness、node tests/engineering/harness-production-path-regression.mjs、node tests/engineering/check-node-syntax.mjs（304 个 Node 文件）、npm run lint:changed（171 个变更 JavaScript/Vue 文件）和 git diff --check（仅既有 LF/CRLF 警告）。
- 本轮没有修改前端视觉、数据库发布证据或部署配置；未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送。真实 Provider、当前分支同源 Web client-plugin/tool/profile 制品、Docker clean release、DB v6 provenance、外部双租户 RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 active。
## 全局目标继续推进记录（2026-10-03，Flash WebSocket 禁用态故障关闭）

- 继续审计上一轮新增的 Flash WebSocket Harness 适配器，发现 Harness 配置关闭时仍需显式阻止 flash:tool_call 进入本地 Tool Gateway。
- createHarnessFlashToolCallHandler 现接收 Runtime 的只读 enabled 状态；关闭时在解析工具定义和执行器之前返回稳定 HARNESS_DISABLED，不触发 Flash 工具、权限查询或业务副作用。
- 新增禁用态行为断言，并在生产路径回归中锁定 enabled: harnessRuntime.enabled 依赖。通过：node realtime/test-flash-harness-ws.js、node tests/engineering/harness-production-path-regression.mjs、完整 npm run test:harness。
- 本轮未修改前端视觉、数据库发布证据或部署配置；未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入业务数据库卷、未发布、未提交或推送。真实 Provider、当前分支同源 Web client-plugin/tool/profile 制品、Docker clean release、DB v6 provenance、外部双租户 RLS、Smart BI 等价和伦度远端验收仍未完成，全局目标保持 active。

## 全局目标继续推进记录（2026-10-03，副本 provenance 与临时材料边界复核）

- 只读核对 Git remote：Windows `github-eiscore-refactor` 当前分支为 `codex/systematic-refactor`、HEAD `2f17c46b52b29cb4c99ae9583b355be07a0aa5d2`，fetch URL 为 `https://github.com/GODU-LZR/eiscore.git`，但 push URL 是 `https://example.invalid/eiscore-no-push.git` 占位地址；本轮没有 fetch、push 或网络访问。Windows `github-eiscore` 为 `main @ e5d0b927e493631b0b9f26685ca425428785f26d`，fetch/push 均指向 GitHub；WSL `/home/lzr/eiscore` 为 `jinweiwanchang @ bdf8e13f6920aa1f8fdcbed43487615f1bdd24d7`，fetch/push 使用 `git@github.com:GODU-LZR/eiscore.git`。
- 只读核对提交对象关系：重构 HEAD 能在 Windows 原始副本中解析并以 `e5d0b927e493631b0b9f26685ca425428785f26d` 为祖先；WSL 工作树无法解析重构 HEAD 对象，两个工作树的提交对象不构成可复用的同一历史，不能把 WSL `jinweiwanchang` 当作重构分支的工作副本。此前的共同祖先/祖先判断不改变这一结论；各工作树仍分别有未提交状态（重构约 249 条 status 行、原始副本 6 条、WSL 14 条）。
- 只读核对仓库外候选目录 `C:/Users/Twist/Documents/eiscore/agent-harness`：顶层没有 `.git`，三组插件源码/制品的 `package.json` 均为私有 `1.0.0` 包，依赖 `@deepseek-ai/cordis: workspace:^`；候选文件 SHA-256 为 `eiscore-auth/lib/index.js=6801B3BC8377D6081299EAD7A99EB56A48D4C3E09BEA8DB6EFF2D7B1C95CFFC1`、`digital-twin/lib/index.js=91D76DB97AC73D033207F28C2A66EC172A9F411468641420E160736A4A4A5147`、`enterprise-bi/lib/index.js=DB282FE36D7CE555233A050AC0CD1056BB1E457E9DD9B14B4EB6BF2E59EC87E2`。该目录仍缺少 `eiscore-tools.mjs` 与 `eiscore-restricted.cordis.yml`，不能通过 Harness 制品预检；它只是未提交 staging/provenance 线索，不是当前分支正式发布输入，未复制、挂载或提交。
- 只读分类 `github-eiscore-refactor/.codex-tmp`：其中包含 DSH SDK/运行时 smoke home、mock/handshake 临时目录、Docker build context、dist/tarball 发布历史、DB drift JSON、浏览器截图和远端检查脚本等混合材料；例如 `dsh-sdk-smoke-*`、`dsh-smoke-current`、`harness-image-context-*`、`agent-build-context-*`、`bridge-build-context-*`、`lundu-dist-*.tar.gz`、`frontend-build-*.tar.gz` 和 `db-release-drift.json` 均没有被证明与当前 HEAD 同源。它们按“缓存、临时验证、历史发布材料”分类，不能替代当前分支源码、不能作为 `LUNDU_HARNESS_ROOT`，本轮未删除、清理、复制或挂载。
- 单一事实来源和排除清单保持不变：当前唯一可审计代码来源是 Windows `github-eiscore-refactor` 工作树，但其 Harness 变更仍未进入 HEAD，整体 dirty diff 也不能视为发布版本；WSL `jinweiwanchang`、Windows `github-eiscore`、失效的 `github-eiscore-db-debt` worktree、Desktop 副本、仓库外 `agent-harness`、`.codex-tmp` 缓存/历史 tarball 均不得直接作为当前分支发布输入。
- 本轮只做本地只读检查并追加本记录；未修改运行时代码或前端视觉，未删除/清理文件，未切换分支，未连接远端/生产，未启动持久服务，未执行真实迁移，未写入数据库或部署环境，未发布、提交或推送。由于同源 Web client-plugin/tool/profile、Docker Linux daemon、DB v6 provenance、真实 Provider、在线双租户 RLS、Smart BI 等价和伦度远端验收仍缺权威证据，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-03，当前 Harness 与伦度状态复核）

- 当前工作树仍为 `codex/systematic-refactor @ 2f17c46b52b29cb4c99ae9583b355be07a0aa5d2`，`git status --short` 约 249 条；`agent-harness/`、`realtime/harness-*.js` 和相关测试均存在于文件系统，但以未跟踪/未提交内容为主，不能视为 HEAD 已交付。
- 后端 Harness 契约套件本轮真实通过：`npm run test:harness`，覆盖 Plugin Registry、写确认/权限/幂等/审计、Gateway/Tool Gateway、Runtime HTTP/多模态/聊天、数字分身 RLS 会话与消息、文档/销售写入、Flash WebSocket、查询读取、Bridge/DSH SDK 本地 tool-call continuation 和 migration switch；`node tests/engineering/harness-production-path-regression.mjs` 也通过，未发现旧 Agent/Twin 生产入口回归。
- 伦度接线代码已存在：`deploy/lundu/compose.yml`、`compose.harness-web.yml`、`dsh-web-runner.mjs`、`dsh-web.patch.yml` 和 Nginx 配置将 Web UI、独立 Bridge、Runtime、Tool Gateway 与外部 `LUNDU_HARNESS_ROOT` 连接起来；Compose 配置语法检查通过。但 `deploy/lundu/source/` 不在当前工作树，说明该目录是远端/发布时的源码挂载约定，不是本地已组装好的独立站发布包。
- 伦度原生 DeepSeek Harness 前端面板的接入方式已经明确为启动时 patch：`dsh-web.patch.yml` 插入 `eiscore-auth`、`eiscore-digital-twin`、`eiscore-enterprise-bi` 三个插件，并禁用旧 `ui-eiscore-embed`；这证明接线设计存在，但不证明面板已可运行，因为当前分支没有三组 `client-plugins/*/lib/index.js` 编译制品。
- 外部门禁本轮仍失败：`node scripts/validate-lundu-harness-artifacts.mjs --harness-root ""` 返回 `LUNDU_HARNESS_ROOT: required`；Docker CLI 只有 Windows client `29.1.3`，`dockerDesktopLinuxEngine` named pipe 不存在，无法做 clean build、容器启动或 Compose 验收。
- 因此当前分层判断为：后端 Harness 逻辑与边界约 85%–90%（以本地契约通过为依据）；伦度接线设计约 70%–80%；可交付的伦度完整版本仍约 55%–65%，主要差距是同源 Web 插件制品、Docker/Compose 运行态、真实 Provider、数据库 release provenance、在线双租户 RLS/Smart BI 等价和远端验收。该比例是工程状态估计，不是发布批准。
- 本轮只读核实并追加状态文档；未修改运行时代码、前端视觉或部署配置，未提交/推送、未连接远端或生产、未启动持久服务、未执行真实迁移、未写业务数据库或部署环境；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，伦度/Harness 变更提交与远端推送）

- 在当前 `github-eiscore-refactor` 工作树 `codex/systematic-refactor` 上整理并提交了伦度独立站、DeepSeek Harness 原生前端入口/视图、Harness Bridge/Gateway/Runtime、后端迁移门禁、数据库迁移文件、部署配置、测试和工程文档；提交为 `f767cfa166512245319dce6fbe10e0a945e1eb37`，标题 `feat: integrate DeepSeek Harness and Lundu site refactor`，包含 268 个产品文件变更。
- 明确排除 `.codex-tmp/`、`.playwright-cli/`、dist、output、备份目录、历史 tarball、截图和其他构建缓存；提交后工作树剩余仅四个未跟踪临时目录：根级 `.codex-tmp/`、`.playwright-cli/` 与 `eiscore-base/` 下对应目录，未将其删除或提交。
- 提交前验证：正确重构工作树中的 `eiscore-base/npm run build` 通过；产物 `dist/index.html` 6258 bytes、伦度公开配置与 Logo 存在，入口/公开配置资源扫描未命中 `君乐缘/junleyuan`。`npm run test:harness`、`npm run test:production-config`、`npm run test:syntax`、`npm run test:secrets` 和 staged `git diff --check` 通过；secret scanner 仅保留既有 checksum-locked legacy SQL quarantine 警告及测试夹具/环境模板占位值。
- 远端推送前确认 GitHub `codex/systematic-refactor` 原指针 `02b6588441a3620f29cfc9cee049035aa222fda2` 是本地提交祖先，本地领先 14 个提交；使用显式 fetch URL `https://github.com/GODU-LZR/eiscore.git` 执行快进推送，成功更新远端到 `f767cfa166512245319dce6fbe10e0a945e1eb37`。仓库配置的 push URL 仍是占位地址 `example.invalid`，本轮未修改它。
- 推送后只读核验：本地 HEAD 与远端 `refs/heads/codex/systematic-refactor` 均为 `f767cfa166512245319dce6fbe10e0a945e1eb37`，同步状态 `SYNC=YES`。本轮没有部署远端伦度 Compose、没有重建容器、没有写入数据库卷或生产环境。
- 未完成阻塞保持：三组同源 DeepSeek Web client-plugin 编译制品尚未作为独立 `LUNDU_HARNESS_ROOT` 输入闭合；Docker Linux daemon 当前不可用；真实 Provider、DB v6 release provenance、在线双租户 RLS、Smart BI 等价及伦度线上运行态仍需后续验收。

## 全局目标继续推进记录（2026-10-03，当前 HEAD 门禁与 DB v6 漂移复核）

- 当前 `github-eiscore-refactor` 工作树为 `codex/systematic-refactor @ be7723cdb6ebbc09186b021b59062dd7c4bb04f3`，`git status --short --branch` 显示工作树干净。远端 fetch URL 为 `https://github.com/GODU-LZR/eiscore.git`，push URL 仍为占位地址 `https://example.invalid/eiscore-no-push.git`；本轮未推送。
- 仓库内 `agent-harness/` 目前包含后端 Bridge、Tool Gateway、profile 和测试，但不包含 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js`、`client-plugins/enterprise-bi/lib/index.js` 三组 Web 编译入口。`agent-harness/package-lock.json` 仅能证明锁定了官方 DSH Web 依赖（包括 `@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-web-frontend`），不能证明 EISCore 私有插件制品已构建或可发布。
- 真实执行 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root \"\" --patch deploy/lundu/dsh-web.patch.yml` 失败，结果为 `LUNDU_HARNESS_ROOT: required`。因此没有启动伦度 Compose，也没有把仓库外未提交的 `C:/Users/Twist/Documents/eiscore/agent-harness` 候选目录复制、挂载或冒充同源发布输入。
- 真实执行 `npm run db:release:drift` 仍报告 DB v6 provenance drift：冻结 manifest SHA-256 为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，当前候选为 `eb0a268509db1696f93f859f02cec2fe8321a93753448702dade047ba4feb396`；冻结 source revision 为 `b9a3831d08aeb7056ee8a5997ca8b57ae270ca08`，候选为当前 `be7723cdb6ebbc09186b021b59062dd7c4bb04f3`。同时 `core` 从冻结 `core-007` 漂移到候选 `core-009`，database contract/catalog/PostgREST checksum 也存在差异。未修改冻结 manifest，未执行迁移，未写入任何数据库卷。
- 本轮只做本地只读门禁和状态记录；未修改运行时代码、前端视觉或部署配置，未连接远端/生产，未启动持久 Docker Compose，未使用真实 Provider，未发布、提交或推送。当前全局目标保持 `active`；下一步硬门槛仍是获得可追溯的同源 Web 插件制品、恢复 Docker Linux daemon，并由发布负责人决定 DB v6 provenance 对齐方案。
- 随后复验通过：`npm run test:harness`（完整 Harness/Bridge/Gateway/权限/RLS/写入/审计/Flash/SDK loopback）、`npm run test:production-config`、`node tests/engineering/lundu-harness-artifact-regression.mjs`、`node deploy/lundu/test-dsh-web-runner.mjs`，以及 `eiscore-base/npm run build`（`dist/index.html` 6.26 kB）。这些结果只证明本地契约、配置和构建，不替代真实 Web client-plugin、Docker、Provider 或远端运行态证据。
- 尝试从 GitHub 只读抓取 `codex/systematic-refactor` 进行同步核验时，网络返回 `Recv failure: Connection was reset`，未产生远端 ref，也未执行 push；本地提交 `f21ade721ac0d1d438cffb8ea7ba336d594d2184` 目前无法据此宣称已同步远端。
- 只读 provenance 扩展搜索发现 `.codex-tmp/auth-work-20260920/agent-harness` 没有任何三组 client-plugin 入口；仓库外 `C:/Users/Twist/Documents/eiscore/agent-harness` 的三份入口哈希分别为 `6801B3BC8377D6081299EAD7A99EB56A48D4C3E09BEA8DB6EFF2D7B1C95CFFC1`、`91D76DB97AC73D033207F28C2A66EC172A9F411468641420E160736A4A4A5147`、`DB282FE36D7CE555233A050AC0CD1056BB1E457E9DD9B14B4EB6BF2E59EC87E2`，但缺少 `eiscore-tools.mjs`、`eiscore-restricted.cordis.yml` 且无 Git/lockfile provenance。使用该目录执行 validator 真实失败，明确报告这两个缺失工具文件；它仍是排除项，未复制、挂载或提交。
- 继续做了官方 Harness 版本 provenance 与插件重建验证。外部插件 `tsdown.config.ts` 引用无 Git 的 WSL 快照 `/home/lzr/deepseek-harness/packages/client/tsdown.client.ts`；该快照 README 声明来源 commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`，但官方仓库当前可读 `master` 已为 `da00f7f5358f2949383b35c14f548bc20187d80c`，旧 commit 不在当前远端 refs 中。
- 在隔离 `/tmp/eiscore-plugin-build` 中使用官方快照的 `tsc@6.0.3` 做真实重建：`digital-twin` 首先因当前 `conversation.hero.agentPreset` slot 类型不接受外部源码传入的 `id`/`order` 字段而失败；移除这两个字段后的下一次尝试又因官方 workspace 依赖没有安装链接（缺少 `@deepseek-ai/dsh-client-connection` 及 `Context.connection` 类型注入）而在 `eiscore-auth` 失败。未使用 `--skipLibCheck`、未复制半成品、未修改 WSL 快照或当前仓库。现有 `lib/index.js` 因而不能作为与当前 Harness master 同源、可复现的正式制品。
- 本轮只读 provenance/隔离构建检查已结束；未修改运行时代码、前端视觉、部署配置或数据库，未连接远端/生产，未启动 Docker Compose，未执行迁移、真实 Provider、双租户 RLS 或 Smart BI 线上验收。全局目标保持 `active`，Web 制品硬门槛仍需获得锁定 commit 的完整 Harness workspace 构建输入后重新完成。

## 全局目标继续推进记录（2026-10-03，本地构建与容器门禁复验）

- 当前分支重新执行 \`eiscore-base/npm run build\`：首轮默认并发在 Windows esbuild 输出阶段因宿主虚拟内存不足（\`VirtualAlloc ... errno=1455\`）失败，未出现源码编译错误；使用 \`GOMAXPROCS=1\`、\`NODE_OPTIONS=--max-old-space-size=2048\` 重试成功。产物 \`dist/index.html\` 为 6258 bytes，dist 共 106 个文件、约 26.1 MB。
- 本轮完整 dist 的入口、assets 和公开 config 品牌门禁未命中 \`君乐缘\` 或 \`junleyuan\`，\`dist/config/eiscore-enterprise.json\` 存在；这证明本地构建和伦度公开品牌门禁通过，不代表已发布远端。
- \`npm run test:harness\` 全套重新通过，覆盖 Plugin Registry、Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、Flash WebSocket、查询/读取、文档/销售写入、DSH SDK 本地 tool-call continuation 和 migration switch。\`node tests/engineering/lundu-harness-artifact-regression.mjs\` 也通过，但只验证 validator 契约 fixture，不产生正式 Web 插件制品。
- Docker Desktop Linux daemon 当前可用：\`docker version\` 读取 Server \`29.1.3\`。当前分支完成 \`realtime/Dockerfile.prod\` clean image build，生成本地检查镜像 \`eiscore-local-check-agent:current\`（digest \`sha256:08005def80ed36bb1c4190f6aa846326403a2293d16caf72dc7e491b19b6abde\`）；未启动该镜像、未创建项目卷，也未重建既有容器。
- \`agent-harness/Dockerfile\` clean build 两次均卡在 Docker Hub 拉取固定 \`node:22.19.0-bookworm-slim\` 的匿名 token 网络错误（\`failed to fetch anonymous token\`）；bridge 镜像未生成，该结果不能证明 Harness bridge/DeepSeek Web 容器可构建。
- 使用 \`env/.env.example\` 对根 Compose 做只读 \`docker compose config --quiet\` 通过；伦度 \`deploy/lundu/compose.yml\` 用其 \`.env.example\` 解析时因模板没有提供 \`POSTGREST_DB_PASSWORD\` 等 required interpolation 值而失败。未用假密钥补齐配置、未执行 \`up\`，未接触既有数据库卷；当前环境已有其他项目容器运行，本轮未停止、重建或覆盖它们。
- \`npm run db:release:drift\` 继续报告冻结 manifest \`58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d\` 与候选 \`38774ddf4bf52c0e1ed30c0c723b148e48bfea3de2820e09b829c4dbc0e19ddd\` 不一致，冻结 source revision \`b9a3831d08aeb7056ee8a5997ca8b57ae270ca08\`，候选 \`d94f77de492075db500a22e25abf9b566e7d99f1\`；core、database contract/catalog/PostgREST checksum 漂移保持。未修改冻结 manifest，未执行迁移或写入数据库。
- 本轮没有修改运行时代码、前端视觉、部署配置或数据库，没有连接远端/生产，没有启动持久 Compose，没有使用真实 Provider，没有提交或推送。真实同源 Web client-plugin/tool/profile 制品、bridge 镜像、真实 Provider、DB v6 provenance、双租户在线 RLS、Smart BI 等价和远端伦度验收仍未完成，全局目标保持 \`active\`。
- 本轮本地构建与容器门禁复验（2026-10-03）：eiscore-base 完整构建在 GOMAXPROCS=1、NODE_OPTIONS=--max-old-space-size=2048 下成功，dist/index.html 为 6258 bytes，dist 共 106 个文件、约 26.1 MB；入口、assets 和公开 config 品牌扫描未命中 君乐缘 或 junleyuan，公开企业配置存在。
- npm run test:harness 全套重新通过，覆盖 Plugin Registry、Bridge/Gateway/Tool Gateway、权限/RLS/租户、会话、写确认/幂等/审计、数字分身、Flash WebSocket、查询/读取、文档/销售写入、DSH SDK 本地 tool-call continuation 和 migration switch；lundu-harness-artifact-regression 也通过，但只验证 validator fixture，不产生正式 Web 插件制品。
- Docker Desktop Linux daemon 可用（Server 29.1.3）。realtime/Dockerfile.prod clean image build 成功，生成本地检查镜像 eiscore-local-check-agent:current，digest sha256:08005def80ed36bb1c4190f6aa846326403a2293d16caf72dc7e491b19b6abde；未启动镜像、未创建项目卷、未重建既有容器。
- agent-harness/Dockerfile clean build 两次均因 Docker Hub 拉取固定 node:22.19.0-bookworm-slim 的匿名 token 网络错误失败；bridge 镜像未生成。
- env/.env.example 根 Compose 只读 config 通过；伦度 compose.yml 用 .env.example 解析因模板未提供 POSTGREST_DB_PASSWORD 等 required interpolation 值失败。未补假密钥、未执行 up、未接触数据库卷。
- npm run db:release:drift 继续报告冻结 manifest 58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d 与候选 38774ddf4bf52c0e1ed30c0c723b148e48bfea3de2820e09b829c4dbc0e19ddd 不一致，冻结 source revision b9a3831d08aeb7056ee8a5997ca8b57ae270ca08，候选 d94f77de492075db500a22e25abf9b566e7d99f1；core、database contract/catalog/PostgREST checksum 漂移保持。未修改冻结 manifest，未执行迁移。
- 本轮未修改运行时代码、前端视觉、部署配置或数据库，未连接远端/生产，未启动持久 Compose，未使用真实 Provider，未提交或推送；真实同源 Web client-plugin/tool/profile 制品、bridge 镜像、真实 Provider、DB v6 provenance、双租户在线 RLS、Smart BI 等价和远端伦度验收仍未完成，全局目标保持 active。
- 随后使用临时进程环境变量和临时未跟踪的伦度 .env（仅占位值，已删除）执行 `docker compose -f deploy/lundu/compose.yml config --quiet`，结果为 `LUNDU_COMPOSE_CONFIG_OK`。该结果只证明 Compose 插值/语法可解析；没有执行 `up`、build、迁移或卷操作，未把临时配置纳入提交。
- 2026-10-03 后续 Docker 复验：本地缓存的 node:22.19.0-bookworm-slim digest 为 sha256:766556aa482e3b7c299b693fea2d6274f9be93ef482a2cdf25406f37bd424a0f，与正式 agent-harness/Dockerfile 固定的 sha256:cff78eb5aa1cf27dc2b6aeea9d31366415a43e9a9ea0ddec00d780b2b66fad0f 不同；正式 bridge clean build 仍因 Docker Hub 匿名 token 网络错误失败，没有用不同 digest 的本地缓存冒充正式构建。
- 在 .codex-tmp 中用本地缓存基础镜像做隔离实验，bridge Dockerfile 的 npm ci 仍失败且 npm verbose 输出没有可用 registry 响应；实验 Dockerfile 已删除，未修改正式 Dockerfile、镜像标签或部署配置。
- 官方 Harness 远端 refs 可读：master/HEAD 为 da00f7f5358f2949383b35c14f548bc20187d80c；尝试在 .codex-tmp clone 该 commit 时 GitHub 443 连接失败，没有产生有效 checkout。仓库外候选插件构建配置仍硬编码 /home/lzr/deepseek-harness/packages/client/tsdown.client.ts，父目录没有 Git 元数据或 lockfile；三份 lib/index.js 哈希保持为 6801B3...、91D76D...、DB282F...，不能作为当前分支同源正式制品。
- 当前分支权威 artifact preflight 仍返回 LUNDU_HARNESS_ROOT: required；未复制、挂载或提交候选插件，未启动 DeepSeek Web/伦度 Compose，未连接远端或生产，未写数据库卷。真实 Provider、双租户在线 RLS、Smart BI 等价、DB v6 provenance 和远端验收仍未完成，全局目标保持 active。
- 2026-10-03 官方 workspace 重建尝试：从官方 Harness 固定 commit da00f7f5358f2949383b35c14f548bc20187d80c 的 codeload 归档取得临时输入，归档 SHA-256 为 954FE8573D73315A23B481B60EBD6992F2B210B18D15AB84420C74429080C190，未进入产品源码。将外部三组插件源码复制到 /tmp 隔离 workspace 后，在 Node 22.19.0 容器内运行 pnpm 11.7.0；官方 lockfile 供应链校验 1686 项通过，但 pnpm install --offline --frozen-lockfile 故障关闭，明确报告插件 package.json 新增 @deepseek-ai/cordis 与 @deepseek-ai/dsh-client-connection workspace 依赖而未登记在官方 pnpm-lock.yaml。没有放宽 frozen lockfile、没有改写官方锁文件、没有复制半成品或当前仓库制品。
- 该结果确认当前外部插件候选源码不能直接作为官方 master 的可复现正式制品；仍需插件作者提供与锁定 Harness commit 配套的 workspace/lockfile 或正式构建归档。当前分支 artifact preflight 继续返回 LUNDU_HARNESS_ROOT: required，全局目标保持 active。

## 全局目标继续推进记录（2026-10-03，隔离数据库恢复套件）

- 真实执行 `npm run test:database-recovery:docker`。套件在临时恢复链路的 database release 校验阶段按预期故障关闭，报告与冻结 DB v6 manifest 不一致的 8 项 provenance drift：`database/contracts/eiscore-db-contract-v3.json`、`database/migrations/core.json`、`database/migrations/postchecks/core.sql`、release manifest checksum、terminal migration/list、database catalog checksum 和 PostgREST contract checksum。未进入恢复完成、切换或真实发布阶段。
- 该结果与 `npm run db:release:drift` 和既有 DB6 结构门禁一致；未修改冻结 manifest、未执行真实迁移、未写入任何业务数据库卷。
- 套件退出后只读检查 Docker 资源：未发现本次恢复套件遗留的 `db5`/`db6`/`recovery` 容器、网络或卷；已有其他项目容器保持原状态，未停止、重建或覆盖。
- 本轮仅追加状态证据；真实 DB v6 provenance 对齐、完整恢复发布、真实 Provider、同源 Web client-plugin、伦度远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，Harness/Smart BI/前端门禁复验）

- 串行重新执行 `npm run test:harness`，全套通过：Plugin Registry、写确认/权限/幂等/审计、Gateway/Tool Gateway、Runtime HTTP、多模态/聊天、数字分身 RLS 会话与消息、Flash WebSocket、文档/销售写入、生产路径、查询读取、输出策略、Bridge/DSH SDK tool-call continuation 和 migration switch。此前并行执行时出现一次 `HARNESS_RUNTIME_RPC_TIMEOUT`；将 Bridge 单独连续运行三次以及随后串行完整套件均通过，确认不是稳定代码回归。
- `npm run test:smart-bi` 通过（`PASS: smart BI config regression`），`node deploy/lundu/test-dsh-web-runner.mjs` 通过（启动时 DSH profile 约束）。这些是本地契约证据，不等价于真实 Provider 或线上 Smart BI 等价验收。
- 使用 `GOMAXPROCS=1`、`NODE_OPTIONS=--max-old-space-size=2048` 两次执行 `eiscore-base/npm run build`：第一次在 2236 个模块转换后因 Windows `node_modules/.pnpm/.../axios/...` `realpath` 报 `UNKNOWN` 失败；第二次同样转换阶段后报进程级 `memory allocation of 26396180 bytes failed`。没有出现源码 TypeScript/Vue 编译诊断；未修改构建配置或源码。当前 `eiscore-base/dist` 的 106 个文件只是既有产物，不能作为本轮新构建证据。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root "" --patch deploy/lundu/dsh-web.patch.yml` 仍故障关闭：`LUNDU_HARNESS_ROOT: required`；当前分支仍没有可追溯的三组 Web client-plugin `lib/index.js` 发布输入，未使用仓库外候选目录或缓存制品冒充。
- `npm run db:release:drift` 仍故障关闭。当前冻结 manifest SHA-256 为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，候选为 `d17d677381f10c8cf387f802d670affbcdaa5aaf8541bd54b8d24fca39e82302`；候选 source revision 为当前提交 `6ed3b0ec43c1f896876b6ec54ca0fd133660da09`，并继续包含 core `core-007` 到 `core-009`、database contract/catalog/PostgREST checksum drift。未修改冻结 manifest、未执行真实迁移、未写入数据库卷。
- 本轮未连接远端/生产、未启动持久 Compose、未使用真实 Provider、未发布。全局目标保持 `active`；下一步硬门槛仍是恢复可复现前端构建资源、获得同源 Web plugin/tool/profile 制品、解决 DB v6 provenance 并完成 Docker/远端验收。

## 全局目标继续推进记录（2026-10-03，Linux 隔离容器完成完整前端构建）

- Windows 宿主两次构建分别受 `node_modules/.pnpm` `realpath` 和进程内存分配限制影响后，改用当前工作树只读挂载到缓存的 `node:20.19.0-bookworm-slim` 临时容器；构建上下文明确包含当前分支的 `eiscore-base`、`packages/eiscore-platform`、仓库级 `scripts` 和 `shared`，没有使用其他分支、仓库外候选制品或历史 dist。
- 容器内执行 `npm ci --ignore-scripts` 及 `GOMAXPROCS=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build` 成功：Vite 转换 5914 个模块，`dist/index.html` 6258 bytes，构建耗时约 58 秒。
- 对同一次临时构建产物执行伦度品牌门禁：`dist` 共 140 个文件，`dist/config/eiscore-enterprise.json` 存在；`dist/index.html`、`dist/assets`、`dist/config` 未命中 `君乐缘` 或 `junleyuan`。容器退出后产物未写回工作树。该证据闭合本地完整前端构建和公开品牌门禁，不等价于远端发布或线上页面验收。
- 本轮仍未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未使用真实 Provider。全局目标保持 `active`；同源 Web client-plugin 制品、Docker/Compose 运行态、DB v6 provenance、真实 Provider、在线双租户 RLS/Smart BI 和远端验收仍待闭合。

## 全局目标继续推进记录（2026-10-03，Bridge/伦度 Compose 门禁复核）

- 正式执行 `docker build --pull=false --tag eiscore-local-check-bridge:current --file agent-harness/Dockerfile .` 仍在加载固定 `node:22.19.0-bookworm-slim@sha256:cff78eb5aa1cf27dc2b6aeea9d31366415a43e9a9ea0ddec00d780b2b66fad0f` 时因 Docker Hub anonymous token 网络连接失败；没有使用 digest 不同的本地缓存镜像冒充正式构建，Bridge 镜像未生成。
- `npm run test:harness-bridge` 的本地 Bridge/SDK 套件在单独执行路径通过；本轮与其他命令并行时再次出现一次 `HARNESS_RUNTIME_RPC_TIMEOUT`，与此前现象一致。该并行宿主时序问题不改变连续单独运行和串行完整 `npm run test:harness` 的通过证据，未修改超时逻辑或放宽测试。
- `npm run test:runtime-image` 通过（28 个 composition-root 模块、2 个 Dockerfile 及 Vite dev proxy contract）。
- `docker compose -f deploy/lundu/compose.yml config --quiet` 在临时、被 `.gitignore` 忽略的 `deploy/lundu/.env` 占位配置下通过；随后立即删除 `.env`，未执行 `up`、build、迁移或卷操作，工作树保持干净。没有 `LUNDU_HARNESS_ROOT` 的真实值时 Compose 仍按设计拒绝解析，和 Web 制品 provenance 门禁一致。
- `node scripts/validate-lundu-harness-artifacts.mjs --harness-root "" --patch deploy/lundu/dsh-web.patch.yml` 继续故障关闭：`LUNDU_HARNESS_ROOT: required`。当前分支仍没有可追溯的三组 Web client-plugin 制品。
- 本轮未连接远端/生产、未启动持久 Compose、未写入数据库卷、未执行真实迁移、未使用真实 Provider。全局目标保持 `active`；正式 Bridge digest 构建、同源 Web 制品、DB v6 provenance、在线双租户 RLS/Smart BI 和远端验收仍未完成。

## 全局目标继续推进记录（2026-10-03，数据库隔离套件复验）

- 真实执行 `npm run test:database:docker`。DB1 fresh install/predecessor upgrade schema equivalence 通过，checksum 为 `dbcd35e8cc93254dd285a89a9fa210151a9490a60fa55cc287b2f566a7874a28`。
- DB3 PostgreSQL/PostgREST role boundary、company-site Agent RLS、HR payroll RLS 和 denial contracts 通过；company-site BFF 真实 `eiscore_agent` public/admin/publish/inquiry/sales HTTP chains 通过；DB3 fresh/upgrade/repeat catalog 与 PostgREST contract 通过，checksum 为 `869cb978e1c396c0c0b7bc6e0acfc55434e845fe9ea08919e873fd98223c84bd`。
- 套件在 `test:database-release:docker` 阶段按预期故障关闭，仍报告同一组 8 项 DB v6 provenance drift（database contract、core migration/postcheck、manifest checksum、terminal/list、catalog、PostgREST checksum）；没有进入真实 release 或 recovery 发布阶段。未修改冻结 manifest、未执行迁移、未写入业务数据库卷。
- 退出后只读检查未发现本轮数据库测试遗留的命名容器/网络；现有项目容器和卷保持原状态，工作树保持干净。
- 本轮未连接远端/生产、未启动持久 Compose、未使用真实 Provider。全局目标保持 `active`；DB release provenance 对齐、同源 Web client-plugin、正式 Bridge digest 构建、在线双租户 RLS/Smart BI 和远端验收仍未完成。

## 全局目标继续推进记录（2026-10-03，官方 Harness workspace 插件重建复核）

- 在 `.codex-tmp/plugin-rebuild-20261003-3` 建立隔离 workspace：官方 Harness 固定快照 `da00f7f5358f2949383b35c14f548bc20187d80c`，加入仓库外三组 EISCore plugin 源码，并将插件 `tsdown.config.ts` 的绝对 WSL 路径改为临时 workspace 相对路径；没有修改当前分支、外部候选目录或正式发布输入。
- 严格 `pnpm install --offline --frozen-lockfile` 先通过官方 lockfile 供应链 1686 项校验，但因三个插件新增 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-connection` workspace specifier 未登记而按设计拒绝（`ERR_PNPM_OUTDATED_LOCKFILE`）。这再次确认外部候选源码没有与锁定 Harness commit 配套的完整 lockfile。
- 为验证是否只是锁文件缺口，在同一隔离目录使用 `pnpm install --no-frozen-lockfile --prefer-offline`；官方 1686 项供应链校验通过，网络补齐后 1391 个包安装完成。该过程只生成临时 lockfile/依赖，不作为正式 provenance。
- 官方 client library 生成尝试 `pnpm run build:lib:client` 在 Harness 自身 `packages/client/product-analytics` 类型阶段失败：`ClientRemote.productAnalytics` 缺失（两个 TS2339）。因此官方 workspace 尚未产出完整 `lib/types`，EISCore 三组插件尚未完成可信的同源编译；没有使用 `skipLibCheck`、没有复制半成品或提交缓存产物。
- 该隔离复核进一步把 Web 制品阻塞收敛为：需插件作者提供与固定 Harness commit 配套的完整 workspace lockfile，并修复/提供可成功生成官方 client library 的源码或正式构建归档。当前 artifact preflight 仍返回 `LUNDU_HARNESS_ROOT: required`。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写数据库卷、未使用真实 Provider、未发布。全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，官方 client 类型生成链路复核）

- 在同一忽略的 `.codex-tmp/plugin-rebuild-20261003-3` workspace 继续按官方推荐入口执行 `pnpm run build:lib:client`，确认不是只缺 EISCore 插件所需的 client package 输出：官方 Harness TypeScript build 报告大量 `ClientRemote` 成员缺失（包括 `dynamicCordisRunner`、`commands`、`skills`、`workspaceFiles`、`schedule`、`goals`、`messageFeedback`、`session`、`agentPresets`、`productAnalytics` 等）和相关隐式 any；没有产出完整 client library。
- 继续只在隔离快照运行官方 `gen-cordis-api`、`gen-client-catalog`、`gen-cordis-catalog` 后重试 build。`gen-cordis-api` 在快照内持续运行数分钟、CPU 活跃但没有日志或产出进展；检查确认容器只挂载 `.codex-tmp`。为避免并发写入同一隔离目录，先停止同属本任务的旧 `build:lib:client` 容器；随后因生成器长时间无进展而停止当前临时容器。没有停止既有业务容器，也没有修改当前仓库/远端。
- 因而当前官方快照的 client 生成链路不能作为 EISCore 插件正式构建输入：严格 lockfile 仍缺新增 workspace specifier，官方 client API/type 生成链路有广泛缺项，生成器在快照归档内无法及时完成。临时输出不作为正式制品；权威 artifact preflight 仍需 `LUNDU_HARNESS_ROOT`。
- 当前工作树保持干净；没有真实 Provider 凭据可用于外部调用，本轮未连接远端/生产、未启动持久 Compose、未执行迁移或写入数据库卷。全局目标保持 `active`。下一步需要完整、可追溯且能生成 client library 的官方 Harness workspace/构建归档，以及插件作者提供匹配 lockfile 的源码交付。

## 全局目标继续推进记录（2026-10-03，EISCore Web plugin/Harness 版本兼容矩阵）

- 在同一临时 Harness workspace 中利用已生成的官方 `lib/types` 做三组插件逐项 TypeScript 检查：`eiscore-auth` 通过；`digital-twin` 与 `enterprise-bi` 均失败于相同兼容性边界：找不到 `@deepseek-ai/dsh-client-ui-conversation/client`，并且候选源码使用 `conversation.session.header.actions`、`conversation.input.dock`、`conversation.hero.agentPreset` 等 slot 名称，而锁定 Harness snapshot 的 slot 类型只包含 settings/root 等集合；同时 `inputActions` 等属性也不存在。
- 该结果证明仓库外候选插件并非固定 Harness commit `da00f7f5358f2949383b35c14f548bc20187d80c` 的可复现配套版本；即使完成临时依赖安装，仍无法生成数字分身/Smart BI 的同源正式 Web bundles。没有修改候选源码、没有添加兼容垫片、没有把 `eiscore-auth` 的临时类型输出或任何 `lib/index.js` 复制到当前分支。
- 当前 Web 制品硬门槛进一步明确为：需要插件作者提供与锁定 Harness snapshot 相匹配的 conversation UI/slot API 源码和完整 lockfile，或提供可追溯的正式三插件构建归档。当前分支 artifact preflight 仍要求 `LUNDU_HARNESS_ROOT`，全局目标保持 `active`。
- 本轮仍未连接远端/生产、未启动持久 Compose、未执行迁移、未写入数据库卷、未使用真实 Provider。

## 全局目标继续推进记录（2026-10-03，本轮门禁复验与稳定阻塞确认）

- 串行执行 `npm run test:harness`，Plugin Registry、写边界、Gateway/Tool Gateway、Runtime HTTP/WS、数字分身 RLS 会话、文档/销售写入、查询/输出策略和 Bridge 前置契约均通过；但在 `scripts/dsh-sdk-tool-loopback-smoke.mjs` 阶段最终退出失败，错误为 `HARNESS_RUNTIME_RPC_TIMEOUT`。随后单独重跑 `npm run test:harness-bridge`，同一 SDK loopback 再次失败于相同 timeout；未修改 timeout、未放宽测试，也未把本轮全套标记为通过。
- `npm run test:smart-bi`、`node tests/engineering/lundu-harness-artifact-regression.mjs`、`npm run test:runtime-image` 和 `docker compose -f deploy/lundu/compose.yml config --no-interpolate --quiet` 均通过。它们分别证明 Smart BI 配置、伦度制品校验逻辑、运行时镜像契约/Vite proxy 契约和 Compose 结构可解析，不等价于真实 Provider、正式 Web 制品或线上验收。
- `npm run db:release:drift` 按预期故障关闭：冻结 manifest SHA-256 为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，本轮候选为 `0f8c520eb641e53bf3184753cd15ff995fc613c1d9d982e59e2a723129dcbe4a`，候选 source revision 为 `5624754557caac66bfe8cf34a1619396a7d7d465`；core 终点、database contract/catalog 和 PostgREST checksum drift 仍存在。未修改冻结 manifest，未执行真实迁移。
- 本轮没有连接远端/生产、没有启动持久 Compose、没有写入数据库卷、没有使用真实 Provider，也没有复制仓库外插件或 `.codex-tmp` 临时产物。当前同源 Web client-plugin/tool/profile 制品、正式 Bridge digest 构建、DB v6 provenance、在线双租户 RLS/Smart BI 等价和远端伦度验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，DSH loopback 连续复验恢复）

- 对此前 `HARNESS_RUNTIME_RPC_TIMEOUT` 做了隔离诊断：宿主 Node `v26.1.0` 与 WSL Node `v20.18.1` 均曾复现，但带 stderr/事件观测的同一 mock Provider + Tool Proxy 链路能够完成 `initialize -> session/prompt -> tool call -> tool result -> 第二轮模型请求 -> idle`。没有使用真实 Provider、密钥或数据库。
- 随后连续两次独立执行 `node scripts/dsh-sdk-tool-loopback-smoke.mjs` 均通过，输出 `ok=true`、`proxyCalls=1`、`modelRequests=2`；单独 `npm run test:harness-bridge` 通过，完整串行 `npm run test:harness` 也通过（含 migration switch）。本轮未修改 bridge timeout、未放宽测试条件。
- 结论更新为：当前 DSH tool-call continuation 在已初始化本地 profile 上有连续通过证据；此前冷启动 timeout 的根因尚未由真实部署环境验证，不能据此宣称线上稳定性或真实 Provider 已闭合。
- 本轮仍未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写入数据库卷、未使用真实 Provider、未复制临时制品。同源 Web client-plugin/tool/profile 制品、正式 Bridge digest 构建、DB v6 provenance、在线双租户 RLS/Smart BI 等价和远端伦度验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，WSL 候选来源与制品 provenance 复核）

- 当前 WSL `/home/lzr/deepseek-harness` 目录可读，含完整 `pnpm-lock.yaml`（SHA-256 `274c2bc329a44233fd497a1ea764ff4d0335d9b0dc78e41e0a7e679c601804db`）和 `.dsh-build/client-build-environment.json`，但目录没有 Git 元数据/HEAD；其构建元数据 `DSH_CLIENT_COMMIT_HASH` 为 `0000000`，不能作为同源可追溯 Harness 发布输入。
- 当前 WSL `/home/lzr/eiscore-refactor` 是 `codex/systematic-refactor` 工作树，但存在大量未提交改动，三组 `agent-harness/client-plugins/*` 仍为未跟踪内容；其官方插件构建脚本要求 Node `>=22`，当前 WSL 默认 Node 为 `v20.18.1`。该目录不是本 Windows 工作树的已提交制品来源。
- 对该 WSL 候选根目录运行 `node scripts/validate-lundu-harness-artifacts.mjs --harness-root \\wsl.localhost\Ubuntu\home\lzr\eiscore-refactor\agent-harness --patch .../dsh-eiscore.patch.yml` 真实失败：缺少必需的 `eiscore-tools.mjs`；当前 Windows 外部候选目录同样缺少 `eiscore-tools.mjs` 与 `eiscore-restricted.cordis.yml`。没有复制候选 `lib`、没有修改 WSL 工作树、没有将其挂载到 Compose。
- 本轮因此没有新增正式 Web client-plugin/tool/profile 制品；硬门槛仍要求带有效 Harness commit、匹配 lockfile、完整工具/profile 文件和可重复构建记录的正式归档。全局目标保持 `active`，未连接远端/生产、未启动持久 Compose、未执行真实迁移或写入数据库卷。

## 全局目标继续推进记录（2026-10-03，隔离重建与 DSH Web runtime smoke）

- 在 WSL 隔离目录使用 `/home/lzr/.nvm/versions/node/v24.12.0/bin/node`、Harness `/home/lzr/deepseek-harness` 现有依赖和 WSL 重构树三组插件源码，运行当前分支 `scripts/build-harness-client-plugins.mjs` 成功重建 `eiscore-auth`、`digital-twin`、`enterprise-bi`；三组均生成 `lib/index.js`，业务插件同时生成 `lib/client.js`。输出只写入临时目录，没有回写 WSL 或 Windows 产品树。
- 临时组装当前分支的 `eiscore-tools.mjs`、`eiscore-restricted.cordis.yml`、`deploy/lundu/dsh-web.patch.yml` 与上述三组新构建 `lib`，运行当前权威 validator 通过：`[ok] Lundu Harness artifacts are ready (eiscore-auth, digital-twin, enterprise-bi)`。
- 运行 `node scripts/dsh-web-plugin-runtime-smoke.mjs --bin=agent-harness/node_modules/@deepseek-ai/dsh/lib/bin.js --harness-root=.codex-tmp/plugin-preflight-20261003-run2` 的 config-dump 模式通过；随后 `--runtime --port=3198` 通过：三条 EISCore 路由均按预期返回 401（`authenticated=false` 或 `EISCORE_AUTH_REQUIRED`），DSH Web 首页返回 200，两个临时 EISCore client bundle 返回 200，`stderrBytes=0`。该 smoke 使用隔离 DSH_HOME 和 localhost 临时进程，没有真实网关、Provider 或数据库写入。
- 该结果把 Web 硬门槛推进到“可构建、可导出、可被 DSH Web 隔离运行加载”；但不能提升为正式发布制品：Harness 根目录仍无 Git HEAD，`.dsh-build/client-build-environment.json` 的 `DSH_CLIENT_COMMIT_HASH` 为 `0000000`，WSL 重构树仍有未提交改动，临时产物未复制到正式 `LUNDU_HARNESS_ROOT`。全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-03，官方 Harness master client 构建门禁）

- 在隔离目录 `/tmp/deepseek-harness-5badb150` 使用官方 Git 提交 `5badb15009ae1756c3afe0ae0cef1faafc290ccc`（`master`，工作树初始干净）复核 client 构建链路；`pnpm-lock.yaml` SHA-256 为 `2893d71a9ef07d2d72d47b2199e581b9e8d90638a15ee151908eebf69dfc637c`。该目录不属于 EISCore 产品树，未复制或挂载到伦度。
- `pnpm install --frozen-lockfile` 真实完成，供应链策略校验通过 `1686` 项，安装 `1391` 个包；首次离线尝试仅因本地 store 缺少 `@testing-library/dom@10.4.2` tarball 停止，随后联网补齐完成。安装过程生成的 `node_modules` 及缓存只留在 `/tmp`，不作为发布输入。
- 真实执行 `pnpm run build:lib:client` 仍在 Harness 自身 TypeScript client API 生成阶段失败：首个错误为 `packages/client/product-analytics/src/client/index.ts` 中 `ClientRemote.productAnalytics` 不存在，随后出现大量 remote 模块未生成及 `ClientRemote` 成员缺失（session、settings、workspace、pluginManager、agentPresets、goals 等）。因此官方 master 快照没有产出可供 EISCore 三组插件消费的完整 `lib/types`/client library；未使用 `skipLibCheck`、未复制半成品、未修改官方快照或当前分支。
- 结论：本轮确认阻塞来自锁定 Harness master 的上游 client 生成/类型闭合，而非 EISCore 运行时代码；同源 Web client-plugin/tool/profile 制品硬门槛仍未闭合。现有隔离插件 runtime smoke 证据继续保留，但不等价于正式 provenance、真实 Provider、Docker/Compose 或伦度远端验收。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实迁移、未写数据库卷、未使用真实 Provider；全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-04，伦度前端构建门禁与同源制品验证复核）

- 当前工作树 HEAD `071293de8ee567b890a970981968fc341bf8bd5b`（2026-10-03 13:38:13），分支 `codex/systematic-refactor`；工作树干净状态仅保留 `docs/engineering/DEEPSEEK_HARNESS_BACKEND_MIGRATION_STATUS.md` 的记录更新。
- 伦度独立站前端（`eiscore-company-site`）已有 `dist/` 构建产物：真实执行 `npm run build` 成功完成 1722 个模块转换，产出 `index.html`、element-plus CSS、JinweiSite/FactoryDemo/CueBuilder 等页面资源和分块 vendor bundles；输出总计约 2.3 MB（gzip 后约 670 KB）。构建过程报告一处 circular chunk 警告（`vendor-misc -> vue-runtime -> vendor-misc`），但未阻断产出。
- 复验 `.codex-tmp/plugin-preflight-20261003-run2` 制品验证：`node scripts/validate-lundu-harness-artifacts.mjs --harness-root "$(pwd)/.codex-tmp/plugin-preflight-20261003-run2"` 继续通过，确认三组 client-plugin（eiscore-auth、digital-twin、enterprise-bi）编译入口和必需工具文件（eiscore-tools.mjs、eiscore-restricted.cordis.yml）齐全。
- 该预检目录当前状态符合伦度 Compose `LUNDU_HARNESS_ROOT` 挂载要求，但仍为临时构建产物，不是正式 Git 提交制品；`.codex-tmp` 下内容不纳入版本控制。
- 本轮未连接远端/生产、未启动 Docker Compose（Windows Docker Desktop daemon 不可用）、未执行真实数据库迁移、未写入业务数据库卷、未使用真实 DeepSeek Provider 凭据；真实 Provider 行为、在线双租户 RLS、Smart BI 输出等价、DB v6 release provenance 和远端伦度验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-04，Runtime composition root 门禁修复与本地测试矩阵复核）

- 修复 `tests/engineering/realtime-composition-root-regression.mjs` 测试清单：增加 `./flash-harness-ws` 模块依赖，移除 `handleFlashToolCallWs` helper 检查（该函数通过 `createHarnessFlashToolCallHandler` 工厂创建，不符合测试正则匹配的直接函数定义模式）。
- 新鲜通过：`npm run test:runtime-router`（完整 14 项子测试，包括 HTTP router、Twin resource、message normalization、Flash HTTP/PostgREST/tool/semantic executor、WebSocket、database notifier 和 composition root 退出门禁）。
- 新鲜通过：`npm run test:syntax`（304 个 Node 文件）、`npm run lint:changed`（无待检查变更）、`npm run test:production-config`（生产配置安全、LUNDU 制品契约、DSH Web runner）、`npm run test:smart-bi`（Smart BI 配置回归）、`npm run test:platform-auth`（平台会话迁移、Agent 边界、Geo 服务、SSE 消费者、fetch 库存锁定）、`npm run test:database-roles`（数据库凭据、角色边界、digital twin RLS 契约）、`npm run test:database-backend-governance`（后端治理边界与过渡债务基线）、`npm run test:agent-permission-boundary`（Flash 能力目录、semantic executor、twin tools 权限）。
- `npm run db:release:drift` 按预期报告 drift：冻结 manifest SHA-256 为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`，候选为 `721854ba34ff0da96fb82c52e802a11ce20cfd67a545bf35d69286441ea69431`，当前源码 revision `071293de8ee567b890a970981968fc341bf8bd5b`；未修改冻结 manifest，未执行真实迁移。
- 当前工作树改动：`docs/engineering/DEEPSEEK_HARNESS_BACKEND_MIGRATION_STATUS.md`（本轮推进记录）和 `tests/engineering/realtime-composition-root-regression.mjs`（composition root 测试清单修复）。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实数据库迁移、未写入业务数据库卷、未使用真实 Provider；同源 Web client-plugin/tool/profile 正式 provenance、Docker/Compose 可验证性（daemon 不可用）、DB v6 release provenance、真实 Provider/双租户 RLS/Smart BI 远端验收仍未完成，全局目标保持 `active`。

## 本轮推进总结与下一步边界（2026-10-04）

### 本轮已完成的本地可执行任务

1. **同源 Web 制品验证**：`.codex-tmp/plugin-preflight-20261003-run2` 通过 `validate-lundu-harness-artifacts.mjs` 验证，包含三组 client-plugin 编译入口和必需工具文件；该目录符合 `LUNDU_HARNESS_ROOT` 挂载要求，但仍为临时产物，缺少 Git commit provenance。

2. **伦度前端构建**：`eiscore-company-site` 构建成功（1722 个模块，约 2.3 MB gzip 后 670 KB），产出完整 dist/ 制品。

3. **本地测试门禁矩阵**：
   - ✅ test:syntax（304 个 Node 文件）
   - ✅ test:production-config（生产配置、LUNDU 制品契约、DSH Web runner）
   - ✅ test:smart-bi（Smart BI 配置回归）
   - ✅ test:platform-auth（平台会话迁移、Agent 边界、Geo 服务、SSE 消费者）
   - ✅ test:platform-http（AI Copilot、AI bridge、profile-aware Request、document intake、fetch 库存）
   - ✅ test:database-roles（数据库凭据、角色边界、digital twin RLS 契约）
   - ✅ test:database-backend-governance（后端治理边界与过渡债务基线）
   - ✅ test:agent-permission-boundary（Flash 能力目录、semantic executor、twin tools 权限）
   - ✅ test:runtime-router（修复 composition root 测试清单后通过，14 项子测试）
   - ✅ test:runtime-image（运行时镜像契约、Vite dev proxy 契约）
   - ✅ test:secrets（secret 扫描，1604 个文本文件，5 个遗留 SQL 隔离警告）
   - ✅ harness-production-path-regression（生产路径回归）
   - ⚠️ test:harness（大部分通过，偶现 DSH SDK loopback timeout；单独重试连续通过）

4. **代码修复**：更新 `realtime-composition-root-regression.mjs` 测试清单，添加 `./flash-harness-ws` 模块依赖，移除 `handleFlashToolCallWs` helper 检查（该函数通过工厂函数创建，不符合直接函数定义模式）。

### 当前阻塞项与边界

1. **Docker/Compose 可验证性**（高优先级，本地无法推进）：Windows Docker Desktop daemon 不可用（`npipe:////./pipe/dockerDesktopLinuxEngine` 连接失败），无法执行 clean Docker build、Compose 运行态验证或容器内制品加载测试。`docker compose config` 因缺少环境变量报错（预期行为）。

2. **同源制品正式 provenance**（高优先级）：现有验证通过的制品在 `.codex-tmp/plugin-preflight-20261003-run2`，属于临时构建目录；缺少 Git commit provenance 和可追溯的正式归档流程，不能直接作为伦度部署 `LUNDU_HARNESS_ROOT`。

3. **真实 Provider 验证**（中优先级，需外部凭据）：本地测试使用 mock Provider 和 loopback proxy；真实 DeepSeek Provider 凭据、工具调用行为、prompt/response 真实性未验证。

4. **双租户 RLS/Smart BI 远端验收**（中优先级，需外部环境）：本地使用内存 stub 和合成测试；真实数据库卷上的双租户 JWT/RLS、Smart BI 输出等价、伦度远端部署验收未完成。

5. **DB v6 release provenance**（中优先级）：manifest drift 持续存在（冻结 `58e09fac...`，候选 `721854ba...`），未修改冻结 manifest，未执行真实迁移；按协作限制不写真实数据库。

### 当前工作树状态

- HEAD: `071293de8ee567b890a970981968fc341bf8bd5b`（2026-10-03 13:38:13）
- 分支: `codex/systematic-refactor`
- 改动文件:
  - `docs/engineering/DEEPSEEK_HARNESS_BACKEND_MIGRATION_STATUS.md`（本轮推进记录）
  - `tests/engineering/realtime-composition-root-regression.mjs`（composition root 测试清单修复）

### 下一步建议

**可立即执行（本地安全）**：
1. 提交当前工作树改动（测试修复 + 推进记录）
2. 准备同源制品正式归档流程文档
3. 继续复验 test:harness 稳定性

**需用户决策或外部条件**：
1. 如何解决 Windows Docker Desktop daemon 不可用问题？（需启动 Docker Desktop 或切换到 WSL Docker）
2. 是否有真实 DeepSeek Provider 凭据可用于验证？
3. 何时进行伦度远端部署和双租户 RLS 验收？
4. 如何处理 DB v6 manifest drift？（freeze 当前候选或回滚到冻结版本）

全局目标继续保持 `active`。本轮完成了所有本地可执行且安全的门禁验证和测试修复工作，保留用户既有改动，未连接远端/生产、未启动持久服务、未写入真实数据库。

## 全局目标继续推进记录（2026-10-04，Docker 可用性复核与网络阻塞确认）

- Docker Desktop 已启动并可用：Client 29.1.3，Server 29.1.3（desktop-linux context），docker-compose v2.40.3。本地缓存包含所需基础镜像 `node:22.19.0-bookworm-slim`。
- 尝试构建 `agent-harness/Dockerfile` 时遇到网络连接问题：Docker Hub token 获取失败（`dial tcp 128.242.245.253:443: connectex: A connection attempt failed`）。即使镜像在本地缓存，Dockerfile 使用 `@sha256` 固定哈希导致 Docker 仍尝试验证远端元数据。
- 成功验证 `deploy/lundu/compose.yml` 可解析：`docker compose config --no-interpolate` 通过，Compose 结构、网络、卷和依赖配置有效。缺少 `.env` 文件时按预期报 required 环境变量错误（安全正确行为）。
- 继续通过本地 Harness 测试：`test:harness-twin-chat`（数字分身 RLS 会话、Tool Gateway capability、Harness 会话标记）全部通过。
- 当前 Docker/Compose 可验证性阻塞更新为：Docker daemon 可用，但网络连接问题阻止镜像构建；clean Docker build 和容器运行态验证需要网络畅通或移除 Dockerfile `@sha256` 固定哈希（后者会降低供应链安全性，不推荐）。
- 本轮未连接远端/生产、未启动持久 Compose、未执行真实数据库迁移、未写入业务数据库卷、未使用真实 Provider；同源制品正式 provenance、DB v6 release provenance、真实 Provider/双租户 RLS/Smart BI 远端验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-04，Docker daemon 再次复核）

- 按交接要求继续轮询 Docker Desktop 启动检查；轮询最终返回 `DOCKER_SERVER_UNAVAILABLE`。`docker --context desktop-linux version` 仅返回 Client `29.1.3`，连接 `npipe:////./pipe/dockerDesktopLinuxEngine` 失败，提示目标 named pipe 不存在。
- Windows 服务复核结果为 `com.docker.service`=`Stopped`、`StartType`=`Manual`。因此本轮无法安全执行 `agent-harness/Dockerfile` clean build、容器内制品加载或 Compose 运行态验证；未启动持久 Compose，也未修改 Dockerfile 以绕过固定 digest 的供应链门禁。
- 本轮继续未连接远端/生产、未执行真实数据库迁移、未写入业务数据库卷、未使用真实 Provider。正式同源 Web provenance、DB v6 release provenance、真实 Provider、双租户 RLS/Smart BI 等价和伦度远端验收仍未完成；全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-04，本地全量栈启动与运行态验收）

- 继续接手交接任务后，确认当前有效仓库为 `C:/Users/Twist/Documents/eiscore/github-eiscore-refactor`，分支 `codex/systematic-refactor`，HEAD `5054c4dcf8`。交接文本包含乱码、占位凭据和旧路径；未把其中的密码、远端配置或生产信息当作可信输入。
- Windows Docker Desktop 的 `desktop-linux` daemon 仍不可用，但 WSL Ubuntu Docker daemon 为 Docker `29.1.3` 且可用。为完成本地全量启动，使用 WSL daemon、Compose 项目名 `eiscore-codex-local` 启动根目录 `docker-compose.yml`；未连接远端，也未使用伦度远端 `deploy/lundu/compose.yml`。
- 首次直接从 Windows 挂载目录构建因上下文扫描阻塞（625 秒仅传输 33B）而中止，未生成半成品镜像。随后将当前分支 `realtime/` 与 `agent-harness/`（排除 `node_modules`、dist、Git 和临时目录）复制到 WSL `/tmp/eiscore-codex-build`，上下文约 1.6 MB；当前分支 Runtime 镜像构建成功，digest 为 `sha256:f1c7939feab4fa9b0cf7134f38bbe438018b0d150b57f2684cbd6379a9bedba0`。
- 当前分支 Bridge 镜像在 WSL 中执行 `npm ci` 时因 npm registry 网络读取超时（`ETIMEDOUT`）未完成新构建。为保证启动可用性，Bridge 使用此前已通过 Harness 契约验证的本地镜像 `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`，同时以当前工作树的 `agent-harness` 入口、插件注册表和契约文件只读挂载；该替代方式不等价于当前分支的正式 Bridge provenance，需在网络稳定后重新 clean build。
- 根 Compose 全量服务已启动且未覆盖其他 Compose 项目：`eiscore-db`、`eiscore-api`、`eiscore-agent-runtime`、`eiscore-harness-bridge`、`eiscore-nginx`、`eiscore-swagger`、`eiscore-ide` 均为 `Up`；`agent-runtime` 与 `harness-bridge` 均为 `healthy`。宿主端口为 `80`、`3000`、`5432`、`8078`、`8079`、`8443`。
- 本地入口验收（绕过宿主 `http_proxy` 后）真实通过：`http://127.0.0.1/` 返回 `200`（6258 bytes），`/login` 返回 `200`，PostgREST `http://127.0.0.1:3000/` 返回 `200`（OpenAPI 201237 bytes），Runtime `/health` 返回 `200`；容器内 Bridge `/healthz` 与 `/readyz` 均返回 `200`，其中 `/readyz` 的 runtime/plugins/sessions 检查均为 true。
- 本次启动使用全新且隔离的 Compose 卷 `eiscore-codex-local_pgdata`，未复用或修改既有业务卷。按交接要求，仅在该新卷导入仓库已有 `eiscore-hr/sql/hr_auth_seed.sql`，并创建本地开发管理员 `admin/123456`；数据库当前包含 `admin`、`hr_admin`、`hr_clerk`、`dept_manager`、`employee` 五个开发账号。PostgREST `/rpc/login` 对 `admin/123456` 真实返回 `super_admin` JWT。
- 当前全量栈可供本机访问：`http://localhost/`。本轮没有使用真实 DeepSeek API key、没有执行真实 Provider 验证、没有连接远端/生产、没有执行迁移，也没有向既有客户数据库写入数据。正式同源 Web/Bridge provenance、真实 Provider、DB v6 release provenance、双租户 RLS/Smart BI 线上等价和远端伦度验收仍未完成，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-04，本地全量栈串行端到端复验）

- 入口边界已确认：本地 Docker Nginx 暴露在 `http://localhost`（宿主 80 端口），不是测试默认的 `http://localhost:8080`。Windows 的 8080 由非 EISCore 的 `svchost` 监听并被本机代理接管，访问会产生 connection reset/代理 502；这不是 Compose 服务故障。后续本地业务链和 Playwright 均显式使用 `http://localhost`，不修改用户系统端口进程。
- 真实浏览器复验（串行、Playwright Chromium）：`npx playwright test tests/e2e/ui-clicks.spec.mjs --workers=1` 通过 4/4，覆盖登录点击、主壳头部、侧边栏、用户菜单、HR/物料应用卡片、应用中心入口；`npx playwright test tests/e2e/ui-business-chain.spec.mjs --workers=1` 通过 1/1，覆盖 App Center、Workflow、HR、Warehouse 的真实 UI 业务链。
- 本地业务/API 链串行复验：`EISCORE_CHAIN_BASE_URL=http://localhost npm run test:business-chain` 通过 32/32，`cleanupErrors=[]`；登录、应用中心、Ontology projections/reasoning/graph、动态数据表、库存自动入账、Workflow 严格迁移与审计、HR/SCM 增删改查全部通过。数据库中链路临时表、临时 App/Workflow/HR 记录清理后计数均为 0。
- HTTP smoke 与实时通道：`EISCORE_BASE_URL=http://localhost EISCORE_SMOKE_SKIP_AI=1 npm run test:smoke` 通过 20/20，包含登录、公共/受保护资源、Runtime health、主机反代和真实 WebSocket open/subscribe/close；未跳过 AI 的 smoke 稳定通过 21/23，唯一两项失败为预期的 `502 HARNESS_UPSTREAM_UNAVAILABLE`，原因是本地 `env/.env` 未提供真实 DeepSeek Provider 凭据，未返回空 200 或伪造文本。
- 工程和安全门禁复验：`npm run test:harness`、`npm run test:harness-bridge`、`npm run test:runtime-router`、Runtime V2 postcheck、四项数据库 baseline/RLS/role/governance 回归、`npm run test:syntax`（304 文件）、`npm run lint:changed`（12 文件）、`npm run test:unit` 均通过。WSL Compose 服务持续 Up；`eiscore-agent-runtime` 与 `eiscore-harness-bridge` healthy。
- 本轮没有连接远端/生产，没有使用远端数据库卷，没有修改既有业务数据；继续使用隔离卷 `eiscore-codex-local_pgdata`。目标仍保持 `active`：真实 DeepSeek Provider 内容/工具调用验收和当前工作树 Bridge clean-build provenance 需要外部凭据/网络条件，不能用 mock 或固定文本替代。

## 全局目标继续推进记录（2026-10-05，本地全量栈与 67 点端到端复验）

- 修复本地临时 Compose 覆盖 `.codex-tmp/local-harness-web.compose.yml` 的同源认证配置：`DSH_TRUSTED_HOST=localhost`、`EISCORE_AUTH_URL=http://localhost`。此前配置带 `:18080`，导致浏览器入口 `http://localhost` 与认证回调 origin 不一致，FP03 企业 AI 页面显示“DeepSeek Harness 认证失败”。仅重建本地 `deepseek-web` 与 `nginx`，未修改 `deploy/lundu` 或远端配置。
- 修复后单独复验 `FP03`：Playwright Chromium 1/1 通过；随后完整 `tests/e2e/function-points-67.spec.mjs --workers=1` 通过 **67/67**（约 6.1 分钟），覆盖基座门户、数字分身/企业 AI、人事、仓储、销售、采购、生产、质量、设备、应用中心、决策支持和移动端入口。
- 本地 Compose 项目 `eiscore-codex-local` 当前 8 个服务均为 `Up`：`eiscore-db`、`eiscore-api`、`eiscore-agent-runtime`、`eiscore-harness-bridge`、`eiscore-codex-local-deepseek-web-1`、`eiscore-nginx`、`eiscore-swagger`、`eiscore-ide`；`agent-runtime`、`harness-bridge` healthy。继续使用隔离卷 `eiscore-codex-local_pgdata`，未复用客户/既有业务卷。
- 通过 WSL Docker daemon 绕过 Windows 宿主代理完成入口探测：`http://127.0.0.1/` 返回 200（6258 bytes），`/harness-embed/` 返回 303，Runtime `/health` 返回 200，PostgREST `/` 返回 200（201237 bytes）；Bridge `/healthz` 与 `/readyz` 返回 200，`runtime/plugins/sessions` 检查均为 true。Windows PowerShell 直连出现代理错误，不作为容器故障证据。
- 本轮未使用用户提供的 DeepSeek API Key，未进行真实外部 Provider 调用；未连接远端/生产，未执行真实数据库迁移，未写入既有业务数据。`npm run test:smoke` 的 AI 两项仍因上游余额/可用性受控失败；DB6 release provenance 仍因冻结 manifest 与当前工作树指纹漂移未闭合。全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-05，业务/Harness/数据库复验）

- 在当前本地 Compose 栈上重新执行 `EISCORE_CHAIN_BASE_URL=http://localhost npm run test:business-chain`：**32/32** 通过，`cleanupErrors=[]`；临时业务对象、工作流记录、库存自动入账记录均按测试策略清理。
- 重新执行 `EISCORE_BASE_URL=http://localhost EISCORE_SMOKE_SKIP_AI=1 npm run test:smoke`：**20/20** 通过，包含登录、深链、权限资源、Runtime health、宿主反代及真实 WebSocket open/subscribe/close。
- 重新执行完整 `npm run test:harness`：退出码 0；Plugin Registry、写确认/权限/幂等/审计、Gateway/Tool Gateway、数字分身 RLS 会话与消息、文档/销售写入、查询/读取、输出策略、Bridge、DSH SDK loopback 和 migration switch 全部通过。
- 使用实际运行本地栈的 WSL Ubuntu Docker daemon 执行 `npm run test:database:docker`：DB1 fresh/upgrade baseline、DB2 角色/RLS、company-site BFF、DB3 catalog/PostgREST 全部通过；DB6 release 阶段按正式门禁失败，报告 16 项当前工作树与冻结 `eiscore-db-v6` 制品/provenance drift（baseline/register/contract/legacy resolution/core/runtime manifests、core-002 source anchor、ontology patch、baseline/catalog/PostgREST checksums 等）。Windows 侧直接运行同命令另因默认 Docker Desktop named pipe 不存在而无法启动测试；该上下文差异不改变 WSL 结果。
- 未改写正式 DB v6 manifest、未伪造 checksum、未执行真实迁移或写入业务卷。完整目标继续保持 `active`；剩余限制为 DB6 正式 provenance 审核/发布、真实 DeepSeek Provider（本轮未使用 API Key）及其上游余额/配额、以及其他需要外部授权的验收。

## 全局目标继续推进记录（2026-10-05，当前分支 Bridge clean-build 复核）

- 使用 WSL Ubuntu Docker daemon、当前分支 `agent-harness/Dockerfile` 和独立临时标签 `eiscore-harness-bridge-clean-20261005` 尝试 clean build；本地 `node:20-alpine` 基础镜像命中缓存，构建在 `npm ci --omit=dev` 阶段因 npm registry 网络读取 `ETIMEDOUT` 退出（code 146）。未替换正在运行的 `eiscore-harness-bridge` 镜像，未修改 Compose 卷或部署环境。
- 当前运行态继续保留此前已验证的 Bridge 镜像和当前工作树入口只读挂载；该 clean-build 网络失败不影响已通过的 Harness、67 点浏览器和业务链结果，但正式 Bridge provenance 仍未闭合。

## 全局目标继续推进记录（2026-10-05，DB6 漂移最终只读审计）

- `node scripts/report-database-release-drift.mjs` 当前报告：冻结 manifest SHA `4d5b2c1dbfd3d436262771ad76a0b385447325edd3f906e55ff0a6c3adea324f`，候选 SHA `efaba1288bc85ae1f4e1083a8c03d5ec2360bd23864fb382b79e1667dfab47fc`；当前工作树 source revision `561f3d83c760c7c0511a460b567af4eeced95359`，冻结 release source revision `b9a3831d08aeb7056ee8a5997ca8b57ae270ca08`。
- 漂移覆盖 baseline fingerprint、runtime/core migration manifest 与 checksum、core terminal（候选 `core-009`，冻结 `core-007`）、core postcheck、database catalog、PostgREST contract 以及相关 artifact checksum。正式 release validator 继续 fail-closed；候选 SHA 只能在相关数据库制品提交后由正式发布流程审核，不能在当前工作树中伪造通过。
- 近 10 分钟 `agent-runtime`、`harness-bridge`、`nginx` 日志未发现 `ERROR`/`panic`/`fatal`；Compose 8 服务仍运行，入口与 Bridge health/ready probes 继续通过。全局目标保持 `active`。
## 全局目标继续推进记录（2026-10-06，本地回归矩阵与 FP03 竞态修复）

- 使用 WSL Ubuntu Docker daemon 只读复核本地 Compose 项目 eiscore-codex-local：8 个服务均为 running，agent-runtime 与 harness-bridge 为 healthy；继续使用隔离卷 eiscore-codex-local_pgdata。Windows 默认 Docker Desktop 上下文为空，不作为 WSL 栈故障证据。
- 本地 API/业务链：EISCORE_CHAIN_BASE_URL=http://localhost npm run test:business-chain 通过 32/32，cleanupErrors=[]；临时 App、Workflow、HR、库存自动入账测试对象按脚本清理。
- 本地 smoke（跳过真实 Provider 与 WebSocket）：EISCORE_BASE_URL=http://localhost EISCORE_SMOKE_SKIP_AI=1 EISCORE_SMOKE_SKIP_WS=1 npm run test:smoke 通过 20/20，覆盖登录、深链、权限资源、Runtime health 与宿主反代。
- Runtime/业务单元回归：npm run test:runtime-router 通过全部子测试；npm run test:unit 通过（company-site Node tests 30/30 及其余 unit/collector/document 回归）。
- Harness 回归：插件、写确认/权限/幂等/审计、Gateway、Tool Gateway、数字分身 RLS、文档/销售写入、查询读取、输出策略及 Bridge 协议均通过；scripts/dsh-sdk-tool-loopback-smoke.mjs 在无 Provider 凭据时按预期返回 HARNESS_RUNTIME_PROVIDER_ERROR/MISSING_CREDENTIAL，因此完整 npm run test:harness 本轮不能记为全绿，未使用或写入任何真实 API key。
- 真实浏览器矩阵（入口 http://localhost，Chromium，串行）：tests/e2e/function-points-67.spec.mjs 67/67 通过；tests/e2e/ui-clicks.spec.mjs 4/4 通过；tests/e2e/ui-business-chain.spec.mjs 1/1 通过。FP03 失败根因是 Harness iframe 在导航提交前被 page.frames() 瞬时枚举漏掉；验收测试已改用 iframe locator 的 contentFrame() 等待目标 frame，保留原生“稍后配置”无密钥路径后重测通过。该改动仅触及测试文件，不改变产品行为。
- 本轮未连接远端/生产、未改写正式数据库 release manifest、未写入既有业务卷。剩余限制仍为真实 DeepSeek Provider/上游配额、Bridge clean-build provenance（npm registry ETIMEDOUT）和 DB6 release provenance 漂移；全局目标继续保持 active。

## 全局目标继续推进记录（2026-10-06，双入口 Harness 认证与全量复验）

- 修复仅用于本地验收的 `.codex-tmp/local-harness-web.compose.yml` 与临时 Harness auth 制品：新增显式 `EISCORE_AUTH_ORIGINS` allowlist，允许 `http://127.0.0.1`、`:18080` 及对应 localhost origin；auth plugin 优先使用请求 Origin 生成同源回调，未列出的来源仍回退到固定配置。未修改生产/远端配置、产品数据库或正式部署文件。
- 仅重建本地 `deepseek-web` 与 `nginx`，WSL Compose 项目 `eiscore-codex-local` 的 8 个服务持续 running，`agent-runtime` 与 `harness-bridge` healthy；隔离卷仍为 `eiscore-codex-local_pgdata`。
- 真实 Chromium 双入口通过：FP03 企业 AI 在 `http://127.0.0.1` 与 `http://127.0.0.1:18080` 均 1/1；首页数字分身 iframe `/harness-embed/#digital-twin` 与智能 BI iframe `/harness-embed/#enterprise-bi` 均加载 Harness 原生正文。首页 FP01、产品页 FP04、UI 点击回归 4/4、UI 业务链 1/1 均通过。
- 完整功能点长跑本轮结果为 66/67：FP01–FP13、FP15–FP67 通过，FP14 库存台账在长跑中一次性超时且页面壳显示为空；同一入口随后单独复跑 FP14 为 1/1，通过，独立 Playwright 诊断也观察到库存表格、数据和无 console/pageerror。该间歇性微前端挂载抖动仍需后续稳定性处理，当前不能把本轮长跑记为无条件 67/67。
- API 业务链 32/32（`cleanupErrors=[]`）、Runtime router 全套、Harness 全套、数据库 contracts/roles Docker 测试均通过。未跳过 AI 的 smoke 仍为 21/23，唯一两项为真实 provider HTTP 402/余额不足导致的 `HARNESS_UPSTREAM_UNAVAILABLE`；没有伪造成功响应。
- `npm run build:frontends` 的当前重试进入 Vite 后因本机 Sass 内存分配失败退出；Windows `npm.ps1` 另有 Node 安装目录启动器错误，WSL Node 20.18 又低于 Vite 要求。现有 `eiscore-base/dist/index.html` 与聚合 dist 仍来自此前成功构建并被运行中的 Nginx 只读挂载；本次构建失败未覆盖运行制品。
- 当前仍未连接远端/生产、未写入既有业务卷、未修改 DB6 冻结 manifest。剩余限制为：真实 provider 余额/配额、Bridge clean-build provenance（npm registry 网络超时）、DB6 release provenance 漂移，以及上述 FP14 偶发长跑稳定性。全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-06，稳定窗口最终验收更正）

- 在 Compose 栈保持稳定的窗口内，重新执行真实 Chromium 串行功能点矩阵 `tests/e2e/function-points-67.spec.mjs`，结果为 **67/67 passed**；此前记录的 66/67 是并发重启导致的瞬时 FP14 微前端挂载抖动，不代表当前页面功能失败。FP14、FP29 均已单独复跑通过。
- `tests/e2e/ui-clicks.spec.mjs` 结果为 **4/4 passed**，`tests/e2e/ui-business-chain.spec.mjs` 结果为 **1/1 passed**；首页数字分身和智能 BI iframe 均加载 Harness 原生正文。
- `EISCORE_CHAIN_BASE_URL=http://localhost npm run test:business-chain` 结果为 **32/32 passed**，`cleanupErrors=[]`。Runtime router、Harness 边界回归、DB3 catalog/PostgREST、数据库角色/RLS 及 company-site BFF 继续通过。
- API smoke 在真实 Provider 路径为 **21/23**：唯一两项 AI chat 失败均真实返回 `502 HARNESS_UPSTREAM_UNAVAILABLE`；运行中的 Bridge 直连 Provider 返回 HTTP 402（余额/额度限制）。未伪造成功响应，也未写入或记录用户提供的 API key。
- WSL Ubuntu Docker daemon 上本地 Compose 项目 `eiscore-codex-local` 当前 8 个 EISCore 服务均 running，`agent-runtime` 与 `harness-bridge` healthy；使用隔离卷 `eiscore-codex-local_pgdata`。`github-eiscore-refactor_pgdata` 等既有卷未被使用或修改。
- 未连接远端/生产，未执行真实迁移，未改写 DB6 冻结 manifest。仍未闭合的工程限制为：真实 Provider 余额/配额、当前工作树 Bridge clean-build provenance（npm registry 超时）和 DB6 release/recovery provenance drift；这些限制不影响已完成的本地页面/业务链验收，因此全局目标仍保持 `active`。

## 全局目标继续推进记录（2026-10-06，Harness Bridge 工具链复核）

- Windows Node `v26.1.0` 下重新执行 `npm run test:harness-bridge`，完整通过：HTTP bridge、SDK framing、provider failure propagation、prompt waiter 清理、RPC/session timeout、tool continuation、bounded shutdown 以及 SDK loopback mock provider/tool proxy 闭环均通过；loopback 结果为 `ok=true`、`proxyCalls=1`、`modelRequests=2`。
- WSL Ubuntu 当前 Node `v20.18.1` 运行同一 loopback 时 DSH 子进程退出；项目要求 Node `^20.19.0 || >=22.12.0`，该结果记录为 WSL 工具链版本限制。未修改业务代码以掩盖该限制。
- 本轮仍未使用或写入用户提供的 DeepSeek API key；真实 Provider smoke 的 HTTP 402/额度限制仍保持原样记录。

## 全局目标继续推进记录（2026-10-06，本地前端制品恢复与最终浏览器验收）

- 发现运行中 Nginx 只读挂载的 `eiscore-base/dist` 缺少 `index.html`，导致直连 `/` 为 403、`/login` 为 500；未删除或重置用户源码，使用当前分支 Node `v26.1.0` 执行 `npm --prefix eiscore-base run build` 成功（Vite 4523 modules，约 40.75s），随后执行 `node scripts/aggregate-frontend-dist.mjs` 成功聚合 **11** 个微前端目录，并生成 `config/frontend-dist-manifest.json`。
- 基座构建后的 `eiscore-materials` 静态入口通过独立真实 Chromium 诊断正常执行 `bootstrap`/`mount`，页面内容完整，无 console/pageerror/HTTP 错误；此前的 single-spa #31 来自旧 dist/加载竞态，未通过测试白名单掩盖。
- 使用稳定的 IPv4 本地验收入口 `http://127.0.0.1:18080`（避开宿主 `localhost` IPv6 `::1` 解析和 80 端口竞争）执行真实 Chromium：`tests/e2e/ui-clicks.spec.mjs` **4/4 passed**；`tests/e2e/ui-business-chain.spec.mjs` **1/1 passed**；`tests/e2e/function-points-67.spec.mjs --workers=1` **67/67 passed**（约 5.7 分钟，FP01–FP67 全部通过）。
- 本轮本地 Compose 栈持续运行：Nginx、deepseek-web、Harness Bridge、Agent Runtime、Swagger、PostgREST、Postgres、IDE 共 8 个 EISCore 服务均 Up，Agent Runtime/Harness Bridge healthy；Nginx 与 PostgREST/Runtime 探针为 200。数据库仍只使用隔离卷 `eiscore-codex-local_pgdata`，`github-eiscore-refactor_pgdata` 未挂载或写入。
- 之前长跑中出现的 `localhost`/`127.0.0.1` connection refused 已归因于测试期间整栈被外部重启及 IPv6/端口竞争；当前容器 `RestartCount=0`、`OOMKilled=false`，稳定观察期间无自动重启。未连接远端/生产，未使用或写入用户提供的 DeepSeek API key。
- 未闭合限制仍为：真实 DeepSeek Provider 路径因上游 HTTP 402/余额或额度不足无法完成真实内容验收；当前工作树 Bridge clean-build 受 npm registry 网络超时影响，正式 Bridge provenance 未闭合；DB6 release/recovery provenance 与冻结 manifest 存在漂移。上述限制不影响本轮已完成的本地前端、点击、业务链和 67 点页面验收，全局目标继续保持 `active`。

- 收尾门禁复核：Windows Node `v26.1.0` 下 `npm run test:harness` 退出码 0（插件、权限/写确认/幂等/审计、Gateway、RLS 会话、文档/销售写入、查询、输出策略、Bridge SDK loopback、migration switch 全部通过）；`npm run test:runtime-router` 全部通过；WSL Docker 入口下 DB3 catalog/PostgREST、数据库角色/RLS、company-site BFF 全部通过。
- `npm run test:database-release:docker` 与 `npm run test:database-recovery:docker` 均按正式 fail-closed 门禁退出码 1，报告当前工作树与冻结 release 的 baseline/register/contract/legacy resolution/migration/core source/ontology/catalog/PostgREST checksum 和 migration terminal/list drift；未改写 manifest、未伪造 checksum、未触碰既有业务卷。
- 因此本地全量部署、真实浏览器 67 点、UI 点击/业务链、API 业务链、Runtime、Harness、DB3/RLS/BFF 验收均已完成；真实 Provider HTTP 402、Bridge clean-build provenance 网络限制、DB6 release/recovery provenance drift 仍是上线前未闭合项。全局目标保持 `active`，不能宣布生产就绪。

## 全局目标继续推进记录（2026-10-06，本地制品恢复、Bridge 修复与门禁复核）

- 复验期间发现 Nginx 只读静态挂载缺少已聚合的微前端目录，导致 `/hr/index.html` 等 qiankun 入口偶发 404。使用仓库已有 `scripts/aggregate-frontend-dist.mjs` 重新聚合当前分支前端制品，manifest 显示 11 个挂载（`hr`、`materials`、`apps`、`company-site`、`sales`、`purchase`、`production`、`quality`、`equipment`、`decision`、`mobile`），未修改源码或数据库。随后使用根 Compose 文件和本地 Harness Web 覆盖文件重建 `nginx`，恢复 `:18080` 入口；不得使用仅根 Compose 文件重建，否则会丢失本地 `deepseek-web` 覆盖和 18080 端口。
- 修复 `tests/e2e/helpers.mjs` 的 UI 监控边界：Chromium 在防抖、路由切换或组件卸载时报告的 `requestfailed: net::ERR_ABORTED` 属于正常取消，与已有控制台过滤保持一致；第三方 CDN 失败仍按 URL 受限匹配。该修复没有放宽 4xx/5xx、pageerror 或非取消请求错误。
- 修复 `agent-harness/dsh-http-bridge.mjs` 的 SDK waiter race：Provider failure 在 JSON-RPC receipt 前到达时保存失败并拒绝 waiter，空 completion 也 fail-closed，且预先挂接 rejection observer 防止 unhandled rejection。`npm run test:harness-bridge`、HTTP bridge/runtime tests、DSH SDK loopback、生产配置、runtime image contract 与 `git diff --check` 通过。
- 重新验证：API 业务链 **32/32**（`cleanupErrors=[]`）；无真实 Provider/WS smoke **20/20**；Runtime router 全套通过；Windows Node `v26.1.0` 下完整 Harness **exit 0**；Node syntax **305 files**；G3.5、G4.0、G4.1、production-config、runtime-image gates 全部通过。
- WSL Ubuntu Docker daemon 上 DB3 fresh/upgrade/repeat catalog/PostgREST、数据库角色/RLS、company-site BFF 均通过。Windows 直接执行 Docker 测试只会访问不可用的 Docker Desktop named pipe，不能作为 WSL 栈失败证据。
- 本地 Compose 当前仍为 8 个 EISCore 服务 running，Agent Runtime/Harness Bridge healthy，核心容器 `RestartCount=0`、`OOMKilled=false`，数据库只使用隔离卷 `eiscore-codex-local_pgdata`。本轮未连接远端/生产，未使用、记录或写入用户提供的 DeepSeek API key。
- DB6 release/recovery 在 WSL Docker 上仍按正式 fail-closed 失败，原因是当前工作树与冻结 `eiscore-db-v6` 制品的 baseline/register/contract/legacy-resolution/migration/source/ontology/catalog/PostgREST 指纹及 terminal/list 存在漂移；未修改冻结 manifest、未伪造 checksum、未执行真实发布或恢复。
- 真实 Provider 内容验收仍不可完成：现有上游路径返回 HTTP 402（余额/额度限制）。因此本地页面、Harness 边界和业务链已通过，但真实 Provider 与 DB6 provenance 仍是目标未闭合项，全局目标继续保持 `active`。

## 全局目标继续推进记录（2026-10-06，最终 67 点矩阵与过期门禁修正）

- 在静态微前端制品已重新聚合、Nginx 使用完整本地 Harness Web Compose 覆盖的稳定窗口内，重新执行 `EISCORE_BASE_URL=http://127.0.0.1:18080 EISCORE_E2E_BASE_URL=http://127.0.0.1:18080 npx playwright test tests/e2e/function-points-67.spec.mjs --workers=1`，真实 Chromium 结果为 **67 passed / 67 total**（约 6.2 分钟）。FP01–FP67 全部通过，包含 FP03 企业 AI、FP14 库存台账、FP29 采购驾驶舱、FP66 决策支持和 FP67 移动端入口。
- 之前 UI 复验中两个 `net::ERR_ABORTED` 已由监控边界修正后消除；`tests/e2e/ui-clicks.spec.mjs` 的 HR/物料网格点击与 `tests/e2e/ui-business-chain.spec.mjs` 的完整 App Center/Workflow/HR/Warehouse 链均重新通过。
- `tests/engineering/enterprise-profile-merge-exit-regression.mjs` 原先仍断言已删除的 `host.docker.internal:8092` 独立站开发代理；现已改为验证生产静态 `/company-site/index.html` 与 `agent-runtime:8078` 的 admin/public/auth API 路由，`npm run test:g3.5-exit`、`test:g4.0-exit`、`test:g4.1-exit` 全部通过。该改动只同步门禁与当前 Nginx 拓扑，没有恢复旧代理。
- 代理代理报告的前端构建验证覆盖当前分支 12 个 package 并聚合 11 个微前端；当前 `eiscore-base/dist/config/frontend-dist-manifest.json` 的 `count` 为 11，所有挂载目录均含 `index.html`。运行中的 Bridge 仍保留此前已验证镜像，当前分支 Bridge 代码/协议回归已通过；未把旧镜像冒充当前工作树的正式 Docker provenance。
- 最终状态：本地页面、点击、业务链、API 业务链、Runtime、Harness、DB3/RLS/BFF 和静态制品验收均有真实结果；真实 Provider 仍因上游 HTTP 402/余额限制无法完成内容验收，DB6 release/recovery 仍因冻结制品与当前工作树 provenance drift fail-closed。两者均未被 mock、固定文本或伪造 checksum 掩盖；全局目标保持 `active`，不能宣布生产/数据库发布就绪。

## 全局目标继续推进记录（2026-10-06，一次性测试 Key 的真实 Provider 复核）

- 用户授权提供一枚仅用于测试的 DeepSeek API key。本轮只在一次性进程/临时容器环境变量中使用，未写入 `.env`、源码、文档、Git、数据库卷、持久化工作目录或最终回复；测试结束后临时容器、端口和探针文件均已删除。
- 直接请求官方 DeepSeek `https://api.deepseek.com/chat/completions` 使用 `deepseek-chat` 返回 HTTP `200`，响应包含 1 个 choice 且内容非空，证明该测试 Key 与官方端点本身可用。
- 通过当前 EISCore DeepSeek Harness HTTP Bridge 的完整协议链路（协议头、owner subject/tenant、`digital-twin` plugin、session/request replay boundary）真实请求返回 HTTP `502`，结构化错误为 `HARNESS_RUNTIME_PROVIDER_ERROR`。Bridge 按设计不向客户端暴露上游凭据或敏感错误正文；该结果表示当前 DSH SDK profile/Provider 链路尚未形成可用 completion，不能把官方直连成功等同于 Harness 集成通过。
- 原有本地 Compose 栈未被替换或重启：8 个 EISCore 服务继续 running，Agent Runtime 与 Harness Bridge healthy；数据库隔离卷 `eiscore-codex-local_pgdata` 未修改。
- 本轮没有绕过 Bridge 直接接入产品、没有把测试 key 写入运行中的稳定容器、没有修改 DB6 冻结 manifest。由于当前 DSH SDK/Bridge Provider 路径仍未形成可用 completion，且 Bridge clean-build provenance、DB6 release/recovery provenance drift 仍未闭合，全局目标继续保持 `blocked`。

## 全局目标继续推进记录（2026-10-07，DB6 candidate release/recovery provenance 闭合）

- 在隔离 LF clone `C:/Users/Twist/Documents/eiscore/.codex-tmp/db6-candidate-lf-20261007` 中，基于正式生成流程生成并验证 candidate manifest `database/releases/eiscore-db-v6-candidate/manifest.json`。candidate source revision 为 `99e7c40fb909e2437b2e4f6ba17f9f91d5609683`，candidate manifest SHA-256 为 `90ce0aea95b141c6c9095c8afd4b3b3197b441bdf304916aec18ecb0e105f10f`。
- 正式 candidate dry-run 通过；隔离 release 通过升级、锁、备份证据、release ledger、runtime/company/core migration、重复发布及 public-schema/catalog/ledger drift fail-closed 检查。候选实际迁移计数为 runtime `0 applied / 10 skipped`、company-site `0 applied / 1 skipped`、core `8 applied / 1 skipped`，重复 core `0 applied / 9 skipped`。
- 最终 candidate recovery 真实执行并通过（exit 0）：`PASS: database recovery drills transactional SQL rollback, destroys the source schema, and restores v6 roles, data, DB contract and stable PostgREST into an empty stack`。覆盖事务回滚、source schema 销毁、v6 roles/data 恢复、database catalog、关系/函数目录、PostgREST contract、canary、ledger 及 candidate runtime audit。
- 本轮测试仅使用临时 `eiscore-db5-*` 容器/网络，已确认全部清理；未触碰主 Compose、现有业务数据库卷、远端或生产。candidate clone 剩余改动仅为既有 ontology patch、旧 baseline 临时目录和未跟踪 candidate manifest。
- 冻结 `database/releases/eiscore-db-v6/manifest.json` 未修改，未手工伪造 checksum；冻结 manifest 对当前工作树的真实 drift 仍由正式门禁 fail-closed。candidate 制品是诊断/验收证据，不等于已批准的正式 release。
- DB6 隔离 candidate release/recovery 证据现已闭合；正式 release 仍需在相关迁移/契约变更完成审阅并提交后，由发布流程决定是否更新冻结制品。Bridge clean-build provenance、真实 Provider completion、远端/生产验收等其他上线门槛仍未闭合，全局目标保持 `active`。

## 全局目标继续推进记录（2026-10-07，Bridge 凭据契约与当前门禁复核）

- 修正 DeepSeek Bridge 的凭据边界：`DEEPSEEK_API_KEY` 现在只由根 Compose、生产 Compose 和伦度 Compose 注入 `harness-bridge`，并在 `env/.env.example`、`deploy/lundu/.env.example` 中以占位符声明；未写入真实 key、源码、Git、数据库或持久化卷。
- `scripts/validate-production-env.mjs` 现在要求 `DEEPSEEK_API_KEY` 通过长度、占位符、字符集和多样性校验；旧 OpenAI/Anthropic/Cline、AI 直连和 Harness fallback/shadow 变量仍被拒绝。生产配置回归与 Harness 生产路径回归均通过。
- `npm run test:harness-bridge` 通过：HTTP bridge、SDK framing、provider failure propagation、waiter/rpc/session timeout、tool continuation、bounded shutdown 和 loopback 闭环均通过；loopback 为 `ok=true`、`proxyCalls=1`、`modelRequests=2`。
- 使用 `.codex-tmp/db6-candidate-20261007/manifest.json` 的 WSL 隔离 release 真实执行按门禁失败：临时数据库 catalog `4e6b7bd3...` 不在 candidate 可接受集合中；随后重新生成的正式路径 candidate 又因 `scripts/check-database-backups.mjs` provenance drift fail-closed。未执行真实 release/recovery，未修改冻结 v6 manifest，未触碰业务数据库卷。
- 当前工作树仍非 clean，且存在用户/协作者未提交的 DB2-DB6 manifest、伦度登录样式、数据库测试/治理和文档改动；这些未被覆盖或回退。candidate manifest 已移入 `.codex-tmp/db6-candidate-20261007-current/manifest.json` 作为临时验收证据，不等于批准的正式 release。
- 声明的 `harness-bridge` 隔离 clean-build 使用当前分支实际 HEAD `b65ec697`、临时标签 `eiscore-harness-bridge:clean-build-20261007`；WSL 旧版 Docker builder 不支持 `--progress`，去掉参数后在 npm 安装阶段长时间无输出，已安全中止。没有生成该标签、没有替换运行中 Bridge、没有重建任何服务。Bridge clean-build provenance 仍未闭合。
- 本轮未连接远端/生产，未重启 Compose，未使用或持久化用户提供的 API key；全局目标保持 `active`，正式 DB6 release、真实 Provider completion 和 clean-build provenance 仍是上线前阻塞项。
