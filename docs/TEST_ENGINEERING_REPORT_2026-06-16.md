# EISCore 工程测试报告

报告日期：2026-06-16
测试对象：本地 WSL 工程 `/home/lzr/eiscore` 与远端环境 `https://nanpai.eissys.top`
测试目标：验证工程可构建、核心接口可用、业务写读改删闭环、Workflow V2 策略链路、浏览器 UI 回归和远端发布一致性。

## 一、结论摘要

| 测试层 | 结果 | 说明 |
|---|---:|---|
| Node 脚本语法门禁 | PASS | `npm run test:syntax` 通过，覆盖 tests/scripts/playwright/realtime 的 20 个入口。 |
| 离线单元/回归 | PASS | `npm run test:unit` 通过，包含数字分身成本表回归与 Smart BI 配置路由回归。 |
| 全前端构建 | PASS | `npm run build:frontends`，11 个前端包全部构建成功。 |
| 远端 smoke | PASS | V2 patch 前后均为 23/23 PASS。 |
| 远端业务闭环 | PASS | V2 patch 后 24/24 PASS，包含严格策略和显式状态迁移规则。 |
| 远端工程套件 | PASS | 新增 `npm run test:engineering:remote`，smoke + business-chain + browser E2E 三层 3/3 PASS。 |
| 67 功能点 UI | PASS | 67 点已整体通过；本轮 FP01/FP28/FP39 单点复测通过，最终全量浏览器回归 77/77 PASS。 |
| UI 业务闭环 | PASS | 单点复测 1/1 PASS。 |
| UI 点击巡检 | PASS | 静态资源兼容修复后，失败点击项单点复测通过。 |
| 完整 77 浏览器长跑 | PASS | `npm run test:e2e:remote` 最终 77/77 PASS，用时约 7.5 分钟。 |

总体判断：工程主链路可用，远端业务和 UI 功能本身通过；远端浏览器自动化已完成全量通过。当前剩余风险主要是历史观察到的远端长时间回归偶发 DNS/连接抖动，以及静态资源发布时删除旧 hash 资源会影响缓存窗口内的微前端动态加载。

## 二、本地工程基线

| 命令 | 结果 | 备注 |
|---|---|---|
| `npm run test:syntax` | PASS | Node 脚本语法门禁通过。 |
| `npm run test:unit` | PASS | `twin knowledge cost-table analysis regression` 通过。 |
| `npm run test:smart-bi` | PASS | Smart BI 领域路由、输出章节、指标口径、风险状态、工作台卡片和常用问题回归通过。 |
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
| 2026-06-16 | `npm run test:engineering:remote` | PASS | smoke 23/23、business-chain 24/24、browser E2E 77/77，用时约 11.9 分钟。 |
| 2026-06-16 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 24/24；最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-16T07-38-32-905Z.md`。 |
| 2026-06-16 | `npm run test:ci` | PASS | 单元回归通过，11 个前端包全部构建成功。 |
| 2026-06-16 | `npm run test:syntax` | PASS | 20 个 Node 脚本入口语法检查通过；同步修复 `scripts/windows-lan-relay.cjs` shebang 位置。 |
| 2026-06-16 | `npm run test:smart-bi` | PASS | Smart BI 领域路由、指标口径、图表模板、风险规则、风险状态、概览卡片和常用问题提示均通过。 |
| 2026-06-16 | `node --check tests/engineering/run-remote-suite.mjs tests/smoke/business-smoke.mjs` | PASS | 新增工程套件与 smoke 重试逻辑语法通过。 |

新增工程化能力：

1. `tests/engineering/run-remote-suite.mjs` 将远端 smoke、业务闭环、浏览器 E2E 串成一个可重复执行的工程验收套件。
2. `npm run test:engineering:remote:api` 支持只跑远端 smoke + business-chain，适合接口侧快速验证。
3. `.nvmrc` 固定为 `20.19.0`，与 GitHub Actions Node 版本一致。
4. `tests/smart-bi/config-regression.mjs` 将 Smart BI 的六大领域路由、输出章节、工作台卡片和常用问题纳入离线单元回归。

## 六、当前风险

| 风险 | 级别 | 说明 | 建议 |
|---|---|---|---|
| 远端 DNS/连接偶发中断 | P2 | 长时间 Playwright 全量回归中曾出现 `EAI_AGAIN`、`ERR_CONNECTION_CLOSED`、`socket hang up`。E2E 和 smoke 均加入远端重试后已通过，但仍建议持续观察。 | 保持远端 E2E 默认单 worker 和 retry；必要时检查本地代理/DNS 与服务器连接稳定性。 |
| 静态资源发布删除旧 hash | P1 | 微前端动态 import 可能在缓存窗口请求旧 chunk。 | 使用 `scripts/sync-spa-dist-preserve-assets.sh` 发布，或采用整站原子发布；定期清理超过保留窗口的旧 hash。 |
| 本地 Node 版本低于 CI | P2 | 本机 Node 20.18.1，CI 为 20.19.0。 | WSL Node 升级到 20.19+，减少 Vite 环境差异。 |
| 前端大 chunk / manual chunk 循环 | P2 | 不阻断构建，但影响性能和缓存效率。 | 后续建立 bundle size 基线，优化 chunk 策略。 |

## 七、建议的工程门禁

短回归：

```bash
npm run test:unit
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
