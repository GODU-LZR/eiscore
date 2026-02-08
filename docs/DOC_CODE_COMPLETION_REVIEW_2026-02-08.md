# EISCore 文档与代码完成度对照报告（2026-02-08）

审查日期：2026-02-08  
审查方式：静态代码与配置审阅（未执行全量联调与性能压测）

## 1. 范围与基线

本次对照基于：
- 规划基线：`docs/PROJECT_BACKGROUND_AND_POSITIONING.md`
- 代码范围：`eiscore-base`、`eiscore-hr`、`eiscore-materials`、`eiscore-apps`、`realtime`、`sql`、`docker-compose.yml`

说明：
- 本报告为“现状评估”，不是最终验收结论。
- 百分比为工程估算值，用于排优先级。

## 2. 规划-实现对照矩阵

| 规划能力 | 代码证据 | 状态 | 估算完成度 | 主要差异 |
|---|---|---|---:|---|
| 微前端基座与子应用拆分 | `eiscore-base/src/micro/apps.js`、`eiscore-base/vite.config.js`、`eiscore-hr/vite.config.js`、`eiscore-materials/vite.config.js`、`eiscore-apps/vite.config.js` | 已实现 | 85% | 架构到位，仍缺统一自动化测试与发布验证链路。 |
| PostgREST 数据库直出 API | `docker-compose.yml`（`api: postgrest/postgrest`）、`nginx/conf.d/default.conf`（`/api` 代理） | 已实现 | 85% | 已形成数据库中心 API 形态。 |
| “无后端”落地 | `realtime/index.js`、`realtime/agent-core.js`、`realtime/workflow-engine.js` | 部分实现 | 55% | 当前为“数据库中心 + Node Runtime”的混合架构，不是严格 No-Backend。 |
| MMS：批次规则 + 库存台账 + 实时库存 | `eiscore-materials/src/router/index.js`、`eiscore-materials/src/views/InventoryLedgerGrid.vue`、`eiscore-materials/src/views/InventoryCurrentGrid.vue`、`sql/inventory_schema.sql` | 部分实现 | 72% | SQL 已有 `stock_in/stock_out/stock_adjust`，但前端主流程当前只接入入库；库存大屏实时推送仍是 TODO。 |
| HMS：统一登录与权限治理 | `eiscore-base/src/views/LoginView.vue`（`/api/rpc/login`）、`eiscore-hr/src/views/HrAclView.vue`、`db_schema_and_data.sql`（`public.login`、`roles/user_roles`） | 部分实现 | 68% | 已有 JWT + 角色/操作/字段权限链路；未发现 OIDC/OpenID Connect 实现。 |
| 数据安全与 RLS | `sql/app_center_schema.sql`（RLS + policy）、`sql/inventory_schema.sql`（RLS + policy）、`db_schema_and_data.sql`（部分表 RLS） | 部分实现 | 65% | 已启用 RLS，但部分策略较宽（如 `USING (true)`），精细化隔离仍可加强。 |
| BPMN 2.0 设计与流程引擎 | `eiscore-apps/src/views/flow/FlowDesigner.vue`、`sql/workflow_schema.sql`、`realtime/workflow-engine.js` | 部分实现 | 60% | 设计器、定义表、实例推进已具备；`workflow_state_mappings` 到业务表状态写回未形成完整自动闭环。 |
| AI 开发器（NL → 前端/数据逻辑） | `eiscore-apps/src/views/FlashBuilder.vue`、`realtime/agent-core.js`、`sql/app_center_data_tables.sql` | 部分实现 | 52% | WebSocket + 文件操作可用；`executeCommand` 仍为 stub；Monaco 仅占位未初始化；自然语言到 SQL DDL/PLpgSQL自动化仍偏原型。 |
| 数据应用快速建模（Data App） | `eiscore-apps/src/views/DataApp.vue`、`eiscore-apps/src/components/AppCenterGrid.vue`、`sql/app_center_data_tables.sql` | 已实现（原型） | 75% | 可创建 app_data 表并发布；高级能力（复杂约束、迁移、审计）尚未系统化。 |
| 性能目标与质量验证（P95<200ms） | 当前仓库未见性能压测脚本与自动化测试（仅 `docs/TEST_VERIFICATION.md` 清单） | 未充分实现 | 35% | 目标存在，但缺可复现的压测与回归测试资产。 |

## 3. 总体完成度（估算）

加权维度：
- 架构基础（20%）：80
- MMS（20%）：72
- HMS/权限（15%）：68
- BPMN/流程闭环（15%）：60
- AI 开发器（20%）：52
- 性能与测试（10%）：35

加权结果：**约 64%**

## 4. 与立项目标的关键差异

1. 严格 No-Backend 与现状不一致  
- 当前依赖 `realtime` Node 服务承载 WebSocket、Agent 与流程实例推进。

2. OIDC 目标与现状有落差  
- 现有是自建 JWT 登录链路（`public.login` + `/api/rpc/login`），未见 OIDC 协议落地。

3. BPMN 到业务状态映射尚未全闭环  
- 流程映射配置存在，但运行时主要更新 `workflow.instances`，未见对业务表状态字段的统一写回执行器。

4. AI“端到端生成”仍处原型阶段  
- 已能触发 AI 文件改写和 Data App 表创建；但 NL→SQL DDL/PLpgSQL→前端一致性生成仍未完整打通。

5. MMS 前端能力与数据库能力不对称  
- 库存 SQL 已支持 `stock_out`、`stock_adjust`，前端库存页主入口当前主要接入 `stock_in`。

6. 性能与回归验证缺失  
- 尚未形成 P95 指标采集、压测报告、自动化回归测试闭环。

## 5. 建议优先级（面向下一里程碑）

1. 先补“流程闭环”  
- 在 `realtime` 或数据库函数层补齐 `workflow_state_mappings` 到业务表状态写回，形成可验证闭环。

2. 打通 MMS 剩余交易链路  
- 将 `stock_out`、`stock_adjust` 接入库存前端，并补齐审批/审计字段联动。

3. 明确认证路线  
- 二选一：继续强化自建 JWT（文档化标准）或升级为 OIDC（对齐立项目标）。

4. 建立可量化验收资产  
- 增加最小化 API 压测脚本、关键页面 E2E、核心 SQL/RPC 回归用例，支撑“P95<200ms”与商用稳定性评估。
