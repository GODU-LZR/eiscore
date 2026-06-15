# EISCore 测试资料索引

更新时间：2026-06-16

本文档用于集中说明 EISCore 现有测试资料、自动化入口和后续测试资产沉淀规则。

## 一、当前自动化入口

| 入口 | 文件 | 用途 |
|---|---|---|
| 自动化说明 | `tests/README.md` | 说明本地单元测试、前端构建、业务冒烟测试和环境变量。 |
| 根脚本 | `package.json` | 提供 `test:unit`、`build:frontends`、`test:smoke`、`test:ci` 等统一命令。 |
| 包清单 | `scripts/eiscore-packages.mjs` | 维护前端微应用、运行时服务的包分组。 |
| 包脚本执行器 | `scripts/run-package-script.mjs` | 按分组批量执行各子项目的 npm script。 |
| 依赖安装器 | `scripts/install-packages.mjs` | CI 中按分组执行 `npm ci` 或 `npm install`。 |
| 业务冒烟测试 | `tests/smoke/business-smoke.mjs` | 覆盖登录、路由、PostgREST、智能体、SSE 和 WebSocket。 |
| 全业务链路闭环测试 | `tests/business/full-chain.mjs` | 覆盖应用中心、动态数据表、Workflow 状态回写、HR 档案、SCM 仓库的写读改删闭环。 |
| UI 点击巡检 | `tests/e2e/ui-clicks.spec.mjs` | 模拟普通用户登录、侧边菜单、应用卡片、网格搜索/列管理/导出、应用中心弹窗点击。 |
| GitHub Actions | `.github/workflows/ci.yml` | 在 push、PR 和手动触发时执行离线回归与前端构建。 |

## 二、推荐执行命令

```bash
npm run test:unit
npm run build:frontends
npm run test:ci
npm run test:smoke
npm run test:business-chain
npm run test:e2e
npm run test:e2e:clicks
```

远端业务冒烟测试示例：

```bash
EISCORE_BASE_URL=https://nanpai.eissys.top \
EISCORE_AGENT_WS_URL=wss://nanpai.eissys.top/agent/ws \
EISCORE_SMOKE_RESULT=tests/.artifacts/nanpai-smoke-result.json \
npm run test:smoke
```

远端全业务链路闭环测试示例：

```bash
EISCORE_CHAIN_BASE_URL=https://nanpai.eissys.top \
EISCORE_CHAIN_RESULT=tests/.artifacts/nanpai-full-chain-result.json \
npm run test:business-chain
```

远端 UI 点击巡检示例：

```bash
EISCORE_E2E_BASE_URL=https://nanpai.eissys.top \
npm run test:e2e:clicks
```

`tests/.artifacts/` 为本地测试产物目录，已经加入 `.gitignore`，可用于保存 JSON 结果、截图或临时日志。

## 三、历史测试资料整理

| 文件 | 类型 | 当前价值 | 建议去向 |
|---|---|---|---|
| `docs/BUSINESS_TEST_REPORT_2026-02-09.md` | 历史业务冒烟报告 | 记录 23 项本地业务链路检查，适合作为当前 smoke 脚本的用例来源。 | 保留为历史基线；后续自动化报告引用其用例口径。 |
| `docs/PROJECT_COMPLETION_INTEGRATED_2026-02-27.md` | 项目完成度评估 | 明确指出测试、CI、性能基线曾是薄弱项。 | 作为自动化工程建设的背景依据。 |
| `docs/WORKFLOW_ROLE_SMOKE_TEST_CHECKLIST.md` | 流程/角色手工冒烟清单 | 覆盖流程发起、任务可见性、状态迁移、自动推进等高风险链路。 | 后续拆成 Playwright E2E 与接口测试用例。 |
| `docs/ROLE_TEST_RECORD_TEMPLATE.md` | 角色测试记录模板 | 适合手工验收、业务验收和缺陷留痕。 | 保留为人工验收模板。 |
| `docs/第八章_系统测试初稿_2026-03-14.md` | 论文/交付型系统测试章节 | 可复用测试目标、测试环境、测试范围等描述。 | 与自动化结果交叉引用，避免只保留静态说明。 |
| `docs/agent/zh-query-testset.v1.json` | 智能体中文查询测试集 | 含 100 条中文查询意图与工具匹配样例。 | 后续建设智能体语义回归 runner。 |
| `docs/TEST_AUTOMATION_REPORT_2026-06-15.md` | 自动化工程启动报告 | 记录自动化入口、CI、首次远端 smoke 22/23 结果。 | 作为自动化建设第一版基线。 |
| `docs/TEST_AUTOMATION_REPORT_2026-06-16.md` | 远端修复验证报告 | 记录远端 Nginx workflow definitions 别名修复和 23/23 结果。 | 作为 P0 缺陷关闭依据。 |
| `docs/TEST_E2E_REPORT_2026-06-16.md` | 浏览器 E2E 验证报告 | 记录 Playwright 登录页、主站、关键微应用深链 5/5 结果。 | 作为浏览器级验收第一版基线。 |
| `docs/TEST_FULL_CHAIN_REPORT_2026-06-16.md` | 全业务链路闭环报告 | 记录应用中心、动态数据、流程状态回写、HR、SCM 仓库 22/22 结果。 | 作为写操作闭环测试第一版基线。 |
| `docs/TEST_UI_CLICK_REPORT_2026-06-16.md` | UI 点击巡检报告 | 记录普通用户日常点击路径 4/4、完整浏览器 E2E 9/9 结果。 | 作为交互级验收第一版基线。 |

## 四、资料沉淀规则

1. 每次正式自动化执行报告放在 `docs/TEST_AUTOMATION_REPORT_YYYY-MM-DD.md`。
2. 临时 JSON、截图、日志放在 `tests/.artifacts/`，不提交到远端。
3. 角色/流程手工验收记录可以从 `docs/ROLE_TEST_RECORD_TEMPLATE.md` 复制生成，文件名建议使用 `ROLE_TEST_RECORD_YYYY-MM-DD_<模块>.md`。
4. 远端服务器访问方式只记录在 `docs/private-review/`，该目录不进入 GitHub，不保存明文密码。

## 五、当前缺口与状态

| 优先级 | 状态 | 缺口 | 建议 |
|---|---|---|---|
| P0 | 已修复 | 远端 `/api/workflow.definitions` 别名返回 404 | 2026-06-16 已在远端 Nginx 增加精确匹配别名，远端 smoke 达到 23/23 PASS。 |
| P1 | 第一版已完成 | 缺少浏览器级 E2E | 已增加 Playwright，覆盖登录、主站、材料、人事、应用中心深链无白屏。 |
| P1 | 第一版已完成 | 缺少 UI 点击巡检 | 已增加 `test:e2e:clicks`，覆盖普通用户登录、侧边导航、应用卡片、网格工具栏和应用中心弹窗点击。 |
| P1 | 第一版已完成 | 缺少全业务链路闭环测试 | 已增加 `test:business-chain`，覆盖 API 级写读改删与 Workflow 状态回写闭环。 |
| P1 | 未开始 | 智能体语义用例未自动执行 | 基于 `docs/agent/zh-query-testset.v1.json` 增加语义回归脚本。 |
| P2 | 未开始 | 前端共享组件缺少单元测试 | 对 grid runtime、状态列、权限控制等共享逻辑补 Vitest。 |
| P2 | 未开始 | 性能与可用性无基线 | 为首页、子应用首屏、AI 接口建立响应时间门槛。 |
