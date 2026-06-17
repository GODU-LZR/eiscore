# EISCore 工程测试报告

报告日期：2026-06-16 / 2026-06-17 续测
测试对象：本地 WSL 工程 `/home/lzr/eiscore` 与远端环境 `https://nanpai.eissys.top`
测试目标：验证工程可构建、核心接口可用、业务写读改删闭环、Workflow V2 策略链路、知识图谱查询、AI 文档采集链路、浏览器 UI 回归和远端发布一致性。

## 一、结论摘要

| 测试层 | 结果 | 说明 |
|---|---:|---|
| Node 脚本语法门禁 | PASS | `npm run test:syntax` 通过，覆盖 tests/scripts/playwright/realtime 的 34 个入口。 |
| 离线单元/回归 | PASS | `npm run test:unit` 通过，包含数字分身成本表、Smart BI、EISGrid agent、共享 grid 工具、工程 HTTP 客户端、AI 文档采集/解析/计划/通用入库/固定入库 worker 回归。 |
| EISGrid agent 语义 | PASS | `npm run test:grid-agent` 通过，覆盖中文分组统计、明细抽样、金额汇总和受控查询 payload。 |
| 共享 grid 工具 | PASS | `npm run test:grid-utils` 通过，覆盖分页、时间过滤、hash URL 拼接、服务端汇总 payload 和全量合计行。 |
| 工程 HTTP 客户端 | PASS | `npm run test:http-client` 通过，覆盖远端重试、非幂等写请求保护、超时归一化和原生 body 透传。 |
| 全前端构建 | PASS | `npm run build:frontends`，11 个前端包全部构建成功。 |
| 远端 smoke | PASS | V2 patch 前后均为 23/23 PASS。 |
| 远端业务闭环 | PASS | V2 + 本体覆盖 + 本体推理 + 推理洞察 + 知识图谱查询后最新为 31/31 PASS，包含角色授权视图、本体投影覆盖审计、推理事实、洞察健康、角色访问解释、KG 节点/邻域/路径、严格策略和显式状态迁移规则。 |
| 远端工程 API 套件 | PASS | `npm run test:engineering:remote:api` 最新 smoke 23/23、business-chain 31/31。 |
| 67 功能点 UI | PASS | `npm run test:e2e:functions67:remote` 最新 67/67 PASS，覆盖完整功能点矩阵。 |
| UI 业务闭环 | PASS | `npm run test:e2e:business-chain:remote` 最新 1/1 PASS。 |
| UI 点击巡检 | PASS | `npm run test:e2e:clicks:remote` 最新 4/4 PASS；已修复直跑 Playwright 时缺少本地 Linux 依赖路径的问题。 |
| 完整 77 浏览器长跑 | PASS | 历史 `npm run test:e2e:remote` 最终 77/77 PASS；本轮拆分 UI 点击、业务闭环和 67 功能点均已通过。 |

总体判断：工程主链路可用，远端业务、语义本体、推理引擎、推理洞察、知识图谱查询、AI 文档采集链路和 UI 点击功能均已通过自动化验证。当前剩余风险主要是历史观察到的远端长时间回归偶发 DNS/连接抖动、当前本机 WSL 偶发 `E_UNEXPECTED` 运行时中断、桌面采集器缺少本机 .NET SDK 无法实编，以及静态资源发布时删除旧 hash 资源会影响缓存窗口内的微前端动态加载。

## 二、本地工程基线

| 命令 | 结果 | 备注 |
|---|---|---|
| `npm run test:syntax` | PASS | 34 个 Node 脚本入口语法门禁通过。 |
| `npm run test:unit` | PASS | 数字分身、Smart BI、Grid、HTTP 客户端、AI 文档采集/解析/计划/通用入库/固定入库 worker 回归通过。 |
| `npm run test:smart-bi` | PASS | Smart BI 领域路由、输出章节、指标口径、风险状态、工作台卡片、卡片报告请求和常用问题回归通过。 |
| `npm run test:grid-agent` | PASS | EISGrid agent 中文查询语义、分组推断、PostgREST payload 和 prompt 格式化回归通过。 |
| `npm run test:grid-utils` | PASS | 共享 grid 分页、时间过滤、服务端汇总和 hash URL 边界回归通过。 |
| `npm run test:http-client` | PASS | 工程 HTTP 客户端远端重试、安全方法策略、JSON/text 解析和原生 body 透传回归通过。 |
| `npm run test:document-intake` | PASS | AI 文档采集 handler 设备鉴权、远程配置、采集目录表兜底、心跳配置响应、上传校验、hash mismatch、重复上传、真实文件大小和环境兜底回归通过。 |
| `npm run test:document-parser` | PASS | AI 文档解析 worker 文本、图片、unsupported、环境兜底回归通过。 |
| `npm run test:document-planner` | PASS | AI 文档入库计划 worker 应用匹配、fallback 计划、字段快照和环境兜底回归通过。 |
| `npm run test:document-entry` | PASS | AI 文档入库 worker 表格/文本转业务记录、未匹配字段补充、标识符净化和环境兜底回归通过。 |
| `npm run test:document-fixed-entry` | PASS | AI 文档固定入库 worker 采购入库单字段识别、主数据校验、stock-in RPC payload、未匹配字段补充和环境兜底回归通过。 |
| `npm run build:frontends` | PASS | 11 个前端包构建成功。 |
| `node --check playwright.config.mjs tests/e2e/helpers.mjs tests/e2e/ui-business-chain.spec.mjs realtime/index.js` | PASS | Playwright 配置、E2E helper、UI 业务链路、realtime 后端语法通过。 |

构建警告记录：

1. 当前本机 Node.js 为 `20.18.1`，项目 CI 配置为 `20.19.0`，Vite 提示建议升级到 `20.19+` 或 `22.12+`。
2. 部分前端包存在大 chunk、manual chunk 循环和 Sass legacy JS API 警告；本轮不阻断构建，但建议后续纳入性能/构建治理。

## 三、远端接口与业务闭环

### 1. Smoke

| 命令 | 结果 |
|---|---|
| `npm run test:smoke` with `EISCORE_BASE_URL=https://nanpai.eissys.top` | 23/23 PASS |
| V2 patch 后再次 `npm run test:smoke` | 23/23 PASS |

覆盖内容包括首页/深链、登录、错误密码拒绝、PostgREST profile、Workflow definitions alias、Agent health、AI config、AI 非流式/流式、WebSocket 鉴权订阅。

### 2. Business Chain

首次远端业务闭环主流程通过，但 cleanup 失败：

| 指标 | 结果 |
|---|---:|
| 总步骤 | 22 |
| 通过 | 21 |
| 失败 | 1 |

失败原因：当前工作区的 Workflow Policy V2 测试和 cleanup 依赖 `app_center.workflow_transition_rules`、`app_center.workflow_permission_policies`，远端当时尚未应用 V2 schema，PostgREST 返回 `PGRST205`。

处理动作：

1. 远端备份：`/root/eiscore_workflow_policy_v2_before_20260616.sql`
2. 应用：`sql/patch_workflow_policy_v2.sql`
3. PostgREST schema reload：patch 内已执行 `pg_notify('pgrst', 'reload schema')`

复测结果：

| 命令 | 结果 |
|---|---|
| `npm run test:business-chain` with `EISCORE_CHAIN_BASE_URL=https://nanpai.eissys.top` | 24/24 PASS |

新增验证点：

1. strict policy 下缺少迁移规则时，Workflow transition 返回 403。
2. 创建显式状态迁移规则后，Workflow 从 `FLOW_REVIEW` 正确流转到 `FLOW_DONE`。
3. Workflow permission policy、transition rules、state mappings、definition、instance、动态数据记录均完成 cleanup。

## 四、浏览器工程回归

执行环境：

```bash
LD_LIBRARY_PATH=$PWD/tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu
EISCORE_E2E_BASE_URL=https://nanpai.eissys.top
```

### 1. 完整套件观察

| 命令 | 结果 | 说明 |
|---|---:|---|
| `npm run test:e2e:remote` | 75/77 PASS | 初次发现 FP39 登录 socket hang up；仓储侧边栏旧 hash 资源 404。 |
| `npx playwright test --workers=1` | 76/77 PASS | 单 worker 后发现 FP28 登录 socket hang up；修复后又遇到连接层错误。 |
| `npx playwright test --workers=1 --retries=1` | 76/77 PASS | FP01 首次 `ERR_CONNECTION_CLOSED`，retry 时 DNS `EAI_AGAIN`。 |
| `npm run test:e2e:remote` | 77/77 PASS | 配置远端默认单 worker、retry、登录/跳转重试与更长 API timeout 后全量通过。 |

### 2. 已修复问题

| 问题 | 处理 | 验证 |
|---|---|---|
| E2E 登录接口偶发 `socket hang up` | `tests/e2e/helpers.mjs` 的 `loginByApi` 增加远端默认 5 次短重试，支持 `EISCORE_E2E_LOGIN_ATTEMPTS` 覆盖。 | FP28/FP39 单点复测通过；最终全量 77/77 PASS。 |
| 仓储侧边栏点击出现旧 hash 资源 404 | 将远端备份中的旧 `materials/assets` 合并回当前目录，保留新旧 hash 资源。 | 旧/新仓储资源均 HTTP 200；侧边栏点击复测通过。 |
| 远端浏览器长跑连接抖动 | `playwright.config.mjs` 对远端目标默认 `workers=1`、`retries=1`，并允许环境变量覆盖；`gotoWithRetry` 远端默认 3 次跳转重试。 | `npm run test:e2e:remote` 全量通过。 |
| Smoke 首页 fetch 偶发失败 | `tests/smoke/business-smoke.mjs` 增加远端默认 3 次请求重试，支持 `EISCORE_SMOKE_REQUEST_ATTEMPTS` 覆盖。 | `npm run test:engineering:remote` 中 smoke 23/23 PASS。 |
| 业务链路 API 偶发慢响应 | `tests/e2e/ui-business-chain.spec.mjs` 默认 API timeout 从 20s 提高到 45s，支持 `EISCORE_E2E_API_TIMEOUT_MS` 覆盖。 | UI 业务闭环和全量 E2E 通过。 |
| 发布脚本可能删除旧 hash | 新增 `scripts/sync-spa-dist-preserve-assets.sh`，发布 SPA root 文件时可删除，发布 `assets/` 时保留历史 hash，并自动备份目标目录。 | `bash -n` 与远端 `--dry-run` 通过。 |

静态资源兼容修复涉及的旧文件：

1. `/materials/assets/index-CNij5kng.js`
2. `/materials/assets/MaterialAppGrid-BHY-6A2n.js`
3. `/materials/assets/MaterialsApps-GQyFIWlm.js`
4. `/materials/assets/MaterialsAppView-VXXDuM3X.js`

### 3. 单点复测结果

| 用例 | 结果 |
|---|---:|
| FP01 工作台首页 | PASS |
| FP28 回款记录 | PASS |
| FP39 生产工单 | PASS |
| UI 业务闭环 | PASS |
| UI 点击：交互登录 | PASS |
| UI 点击：侧边栏导航 | PASS |
| 完整远端浏览器套件 | PASS，77/77 |
| 完整远端工程套件 | PASS，3/3 |

## 五、续测记录

| 时间 | 命令 | 结果 | 说明 |
|---|---|---:|---|
| 2026-06-17 | `sql/patch_ai_document_intake_mvp.sql` | PASS | 远端应用 AI 文档采集 MVP schema；采集设备、资产、解析任务/结果、入库计划、业务链接、未匹配字段和客户端日志均验证 ready。补丁只授权 `web_user` 读写，不向 `web_anon` 暴露采集资产/日志读取。备份：`tests/.artifacts/eiscore_document_intake_mvp_schema_before_20260617_0010.sql`。 |
| 2026-06-17 | `sql/patch_ontology_graph_query_v1.sql` | PASS | 远端应用知识图谱查询层，新增 `v_ontology_kg_nodes`、`search_ontology_kg_nodes(...)`、`query_ontology_kg_neighbors(...)`、`find_ontology_kg_paths(...)`；验证节点 `super_admin` 度数 354、邻域和路径查询均返回数据。 |
| 2026-06-17 | `npm run test:business-chain:remote` | PASS | business-chain 31/31；本体语义覆盖为关系 145/145、字段 1968/1968，推理事实 3052、推理健康 healthy，新增 `02h` KG 节点/邻域/路径 API 检查。 |
| 2026-06-17 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 31/31；最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-17T15-10-59-197Z.md`。 |
| 2026-06-17 | `npm run test:document-intake` | PASS | 新增采集端远程配置回归：`GET /document-intake/devices/config`、`collector_watch_folders` 表配置兜底、camelCase `false` 布尔值保真、heartbeat 配置响应拉平和设备 token hash 不外泄。 |
| 2026-06-17 | `npm run test:document-intake && npm run test:document-parser && npm run test:unit` | PASS | AI 文档采集/解析/计划/通用入库/固定入库 worker 离线回归全部通过，并已纳入 `test:unit`。 |
| 2026-06-17 | `npm run test:syntax` | PASS | 34 个 Node 脚本入口语法检查通过，覆盖新增 realtime document worker 与工程测试脚本。 |
| 2026-06-17 | `npm --prefix eiscore-base run build` | PASS | 受影响 base 前端构建通过；仍有 Node 20.18.1 低于 Vite 建议 20.19+ 的环境警告。 |
| 2026-06-17 | `npm run test:e2e:clicks:remote` | PASS | 远端普通用户 UI 点击巡检 4/4 PASS。 |
| 2026-06-17 | `npm run test:e2e:business-chain:remote` | PASS | 远端 UI 全业务链路闭环 1/1 PASS。 |
| 2026-06-17 | Collector Desktop XML 静态校验 | PASS | `collector-desktop/EISCore.Collector` 下 `.xaml` 与 `.csproj` XML 均可解析；本机 Windows 仅有 .NET runtime、无 SDK，WPF 实编需在安装 .NET SDK 的机器上继续执行。 |
| 2026-06-16 | `sql/patch_ontology_reasoning_insights_v1.sql` | PASS | 远端应用知识图谱推理洞察补丁；schema 执行前备份到 `tests/.artifacts/eiscore_ontology_reasoning_insights_v1_schema_before_20260616_2328.sql`。补丁新增规则统计、角色访问洞察、敏感路径、表依赖路径、表影响面、推理健康视图和 `explain_role_ontology_access(...)`。 |
| 2026-06-16 | `npm run test:business-chain:remote` | PASS | business-chain 30/30；新增 `02f` 洞察健康/影响面检查与 `02g` 角色访问解释 RPC 检查。测试从实际洞察数据动态选择候选角色，避免固定演示角色不存在导致误报。 |
| 2026-06-16 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 30/30；最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-16T15-32-59-513Z.md`。 |
| 2026-06-16 | `npm run test:e2e:clicks:remote` | PASS | 远端普通用户 UI 点击巡检 4/4 PASS。 |
| 2026-06-16 | `npm run test:syntax && npm run test:unit` | PASS | Node 语法门禁 24 个入口通过；离线单元/回归全绿。期间观察到一次 WSL `E_UNEXPECTED` 后单测重跑通过。 |
| 2026-06-16 | `npm --prefix eiscore-base run build && npm --prefix eiscore-apps run build` | PASS | 受影响前端包构建通过，覆盖 AI Copilot/首页历史联动、本体工作台洞察面板和 qiankun 生命周期保护。 |
| 2026-06-16 | `sql/patch_ontology_reasoning_engine_v1.sql` | PASS | 远端应用知识图谱推理引擎补丁；schema 执行前备份到 `tests/.artifacts/eiscore_ontology_reasoning_engine_v1_schema_before_20260616_2235.sql`。最新摘要：facts 3052、seed 2990、inferred 62、active rules 16、角色访问应用 3、角色访问业务表 2、传递依赖 37。 |
| 2026-06-16 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 28/28；新增 `02e ontology reasoning engine exposes inferred facts`，最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-16T14-43-32-197Z.md`。 |
| 2026-06-16 | `npm --prefix eiscore-apps run build && npm --prefix eiscore-base run build` | PASS | 受影响前端包构建通过，覆盖本体工作台推理面板和 AI Copilot 历史侧栏改动。 |
| 2026-06-16 | `npm run test:e2e:clicks:remote` | PASS | 远端普通用户 UI 点击巡检 4/4 PASS。首次直跑因 Chromium 缺 `libnspr4.so` 等共享库失败，已在 `playwright.config.mjs` 自动加载缓存依赖后复测通过。 |
| 2026-06-16 | `npm run test:e2e:business-chain:remote` | PASS | 远端 UI 全业务链路闭环 1/1 PASS，覆盖应用中心、工作流状态写回、HR、仓库。 |
| 2026-06-16 | `npm run test:e2e:functions67:remote` | PASS | 远端 67 个功能点全量 UI 验收 67/67 PASS，用时约 9.2 分钟。 |
| 2026-06-16 | `npm run test:engineering:remote` | PASS | smoke 23/23、business-chain 24/24、browser E2E 77/77，用时约 11.9 分钟。 |
| 2026-06-16 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 27/27；最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-16T14-24-56-371Z.md`。 |
| 2026-06-16 | `npm run test:ci` | PASS | 语法门禁、单元回归、Smart BI、EISGrid agent 语义、共享 grid 工具和工程 HTTP 客户端回归通过，11 个前端包全部构建成功。 |
| 2026-06-16 | `npm run test:syntax` | PASS | 24 个 Node 脚本入口语法检查通过；同步修复 `scripts/windows-lan-relay.cjs` shebang 位置。 |
| 2026-06-16 | `npm run test:smart-bi` | PASS | Smart BI 领域路由、指标口径、图表模板、风险规则、风险状态、卡片报告请求、概览卡片和常用问题提示均通过。 |
| 2026-06-16 | `npm run test:grid-agent` | PASS | 新增 EISGrid agent 中文语义回归，验证“每个部门多少人/状态统计/最近明细/金额汇总”等查询意图。 |
| 2026-06-16 | `npm run test:grid-utils` | PASS | 新增共享 grid 工具鲁棒性回归，验证非法日期、hash URL、分页钳制、服务端汇总 payload 和合计行。 |
| 2026-06-16 | `npm run test:http-client` | PASS | 新增工程 HTTP 客户端回归，验证远端请求重试、安全方法策略、POST 默认不重试和原生 body 透传。 |
| 2026-06-16 | 远端 DB 最小授权修复 | PASS | 对 `public.v_role_permissions` 执行 `GRANT SELECT ... TO web_user` 并触发 PostgREST schema reload；business-chain 前置检查返回 4 个角色授权行。 |
| 2026-06-16 | `sql/patch_ontology_semantic_coverage_v2.sql` | PASS | 远端应用本体覆盖补丁；语义覆盖审计为关系 119/119、字段 1590/1590，业务链路中 PostgREST 审计视图返回 119/119、1561/1561。 |
| 2026-06-16 | `node --check tests/engineering/run-remote-suite.mjs tests/smoke/business-smoke.mjs` | PASS | 新增工程套件与 smoke 重试逻辑语法通过。 |

新增工程化能力：

1. `tests/engineering/run-remote-suite.mjs` 将远端 smoke、业务闭环、浏览器 E2E 串成一个可重复执行的工程验收套件。
2. `npm run test:engineering:remote:api` 支持只跑远端 smoke + business-chain，适合接口侧快速验证。
3. `.nvmrc` 固定为 `20.19.0`，与 GitHub Actions Node 版本一致。
4. `tests/smart-bi/config-regression.mjs` 将 Smart BI 的六大领域路由、输出章节、工作台卡片、卡片报告请求和常用问题纳入离线单元回归。
5. `tests/grid-agent/query-regression.mjs` 将 EISGrid agent 中文数据查询语义和受控查询 payload 纳入离线单元回归。
6. `tests/grid-utils/shared-regression.mjs` 将共享 grid 分页、时间过滤和服务端汇总边界纳入离线单元回归。
7. `tests/engineering/http-client.mjs` 统一远端 smoke/business-chain 的超时、重试和 JSON/text 解析；business-chain 默认只重试安全方法，避免重复写入。
8. `sql/patch_ontology_semantic_coverage_v2.sql` 将业务表单、角色、角色授权和本体覆盖审计视图纳入 PostgREST 可读语义投影；`test:business-chain` 增加 `02c/02d` 前置检查，防止语义层缺口静默回归。
9. `sql/patch_ontology_reasoning_engine_v1.sql` 将本体推理规则、推理事实、推理运行批次、推理摘要和路径解释纳入数据库侧工程能力；`test:business-chain` 增加 `02e` 前置检查，防止推理层不可读或无推理事实。
10. `playwright.config.mjs` 自动加载 `tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu` 下的缓存 Linux 共享库，使 `test:e2e:*:remote` 单独直跑时也能稳定启动 Chromium。
11. `sql/patch_ontology_reasoning_insights_v1.sql` 将推理规则统计、角色访问洞察、敏感字段路径、表依赖路径、表影响面和推理健康纳入 PostgREST 可读洞察层；`test:business-chain` 增加 `02f/02g`，并动态选择实际存在的角色验证解释函数，避免硬编码角色码造成误报。
12. `sql/patch_ontology_graph_query_v1.sql` 将知识图谱节点检索、邻域展开和路径查询纳入 PostgREST 可读 RPC；`test:business-chain` 增加 `02h`，防止图查询层不可读或无路径数据。
13. `sql/patch_ai_document_intake_mvp.sql` 将 AI 文档采集、解析任务、入库计划、业务链接、未匹配字段和客户端日志纳入数据库侧 MVP，并补齐 13 张表与 192 个字段的本体语义。
14. `realtime/document-intake.js`、`document-parser.js`、`document-planner.js`、`document-entry.js`、`document-fixed-entry.js` 形成 AI 文档采集到业务入库的后端 worker 链路，并通过离线 mock 回归覆盖鉴权、上传、解析、计划、字段映射、通用入库、采购入库和错误兜底。
15. `collector-desktop/EISCore.Collector` 提供本地桌面采集器 MVP 结构；当前完成 XML 静态校验，等待具备 .NET SDK 的 Windows 环境做真实 WPF 构建。
16. `tests/business/full-chain.mjs` 对远端登录获取 JWT 增加独立短重试，避免偶发 `fetch failed` 造成空 token 连锁失败；业务写入请求仍保持默认不重试，避免重复写入。
17. `realtime/document-intake.js` 新增采集设备远程配置接口与 heartbeat 配置响应，支持从 `collector_watch_folders` 表下发默认采集目录，并通过回归测试防止布尔值 `false` 被默认值覆盖。

## 六、当前风险

| 风险 | 级别 | 说明 | 建议 |
|---|---|---|---|
| 远端 DNS/连接偶发中断 | P2 | 长时间 Playwright 全量回归中曾出现 `EAI_AGAIN`、`ERR_CONNECTION_CLOSED`、`socket hang up`。E2E、smoke 和 business-chain 安全读请求均加入远端重试后已通过，但仍建议持续观察。 | 保持远端 E2E 默认单 worker 和 retry；必要时检查本地代理/DNS 与服务器连接稳定性。 |
| 静态资源发布删除旧 hash | P1 | 微前端动态 import 可能在缓存窗口请求旧 chunk。 | 使用 `scripts/sync-spa-dist-preserve-assets.sh` 发布，或采用整站原子发布；定期清理超过保留窗口的旧 hash。 |
| 本地 Node 版本低于 CI | P2 | 本机 Node 20.18.1，CI 为 20.19.0。 | WSL Node 升级到 20.19+，减少 Vite 环境差异。 |
| 前端大 chunk / manual chunk 循环 | P2 | 不阻断构建，但影响性能和缓存效率。 | 后续建立 bundle size 基线，优化 chunk 策略。 |
| 本机 WSL 偶发 `E_UNEXPECTED` | P2 | 本轮在并发 WSL 命令和一次远端 API 套件启动时观察到 WSL 运行时中断，重试后测试通过。 | 工程测试尽量串行跑 WSL 重负载命令；若复现频繁，重启 WSL 服务或迁移到 CI/Linux runner 执行长回归。 |
| 桌面采集器未实编 | P2 | 当前 Windows 环境仅安装 .NET runtime，没有 .NET SDK；本轮只能做 `.xaml`/`.csproj` XML 静态校验。 | 在安装 .NET SDK 的 Windows 构建机上执行 WPF build/publish。 |
| realtime 文档 worker 需要发布 | P2 | 远端数据库 patch 已应用并验收，但新增 realtime worker 代码需随容器重建/发布后才会在远端实际运行。 | 发布 realtime 镜像后复跑文档采集端到端用例。 |
| Docker 本地构建未完成长跑 | P3 | 本机 Docker/WSL 组合存在超时风险，本轮以 Dockerfile 静态 packaging 检查确认新增 worker 文件已 COPY。 | 后续在 CI 或稳定 Linux runner 做镜像构建验收。 |

## 七、建议的工程门禁

短回归：

```bash
npm run test:unit
npm run test:grid-agent
npm run test:grid-utils
npm run test:http-client
npm run test:syntax
npm run build:frontends
EISCORE_BASE_URL=https://nanpai.eissys.top \
EISCORE_AGENT_WS_URL=wss://nanpai.eissys.top/agent/ws \
npm run test:smoke
```

上线验收：

```bash
npm run test:engineering:remote
```

发布要求：

1. 数据库 patch 先备份再执行。
2. 前端静态资源发布使用 `scripts/sync-spa-dist-preserve-assets.sh` 或等价原子发布方案，保留旧 hash 兼容窗口。
3. 远端浏览器长跑的失败需要按“业务失败”和“连接层失败”分开判定；连接层失败必须单点复测确认。
