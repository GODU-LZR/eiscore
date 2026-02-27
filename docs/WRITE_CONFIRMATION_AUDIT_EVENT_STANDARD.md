# EISCore 写操作二次确认与审计事件规范（兼容版）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：应用中心、流程应用、HR、MMS、Agent 工具调用

## 1. 目标

本规范用于统一两件事：
1. 写操作二次确认：高风险操作必须“先预览、再确认、后执行”。
2. 审计事件留痕：每次写操作都可追踪“谁在何时对什么做了什么，结果如何”。

强约束：
1. 不改变既有权限裁决主链路（`module/app/op/field` + RLS/RPC）。
2. 兼容 `permission_mode=compat`，不强推全局 strict。
3. Agent 与人工操作使用同一确认与审计标准。

## 2. 术语与边界

1. 写操作：`create/update/delete`、流程发起/推进、配置变更、库存入出库等会改数据的动作。
2. 二次确认：服务端先给执行摘要，用户显式确认后才真正写入。
3. 审计事件：描述操作全生命周期的结构化记录。
4. 本规范不替代权限检查，只控制“写前确认”和“写后留痕”。

## 3. 风险分级与确认触发矩阵

## 3.1 风险等级

1. `low`：只读或低影响写（通常不触发确认）。
2. `medium`：普通业务写（建议确认，按应用策略开启）。
3. `high`：高影响写（必须确认）。

## 3.2 触发规则

默认策略（推荐）：
1. `DELETE` 永远 `high`，必须确认。
2. 涉及状态迁移、流程推进、库存扣减、权限配置变更，一律 `high`。
3. 批量写（影响行数 >= 10）升级为 `high`。
4. 单条普通新增/编辑可为 `medium`，由应用策略决定是否确认。

## 3.3 典型能力映射

1. 应用管理：`/api/apps` 创建/删除 -> `high`（必须确认）。
2. 动态建表：`/api/rpc/create_data_app_table` -> `medium/high`（建议确认）。
3. 流程发起：`/api/rpc/start_workflow_instance` -> `high`（必须确认）。
4. 流程推进：`/api/rpc/transition_workflow_instance` -> `high`（必须确认）。
5. 入出库：`/api/rpc/stock_in`、`/api/rpc/stock_out` -> `high`（必须确认）。
6. 普通表格编辑：`/api/{table}` PATCH -> `medium`（策略控制）。

## 4. 二次确认流程（标准状态机）

状态机：
1. `PRECHECKED`：预检查完成，返回确认摘要。
2. `CONFIRM_PENDING`：等待用户确认。
3. `CONFIRMED`：用户确认通过。
4. `EXECUTING`：开始执行写操作。
5. `SUCCEEDED`：执行成功。
6. `FAILED`：执行失败。
7. `CANCELLED`：用户取消。
8. `EXPIRED`：确认超时失效。

执行顺序（必须）：
1. 权限预检查（含 task assignment / status transition / op 权限）。
2. 生成写入摘要（目标对象、预计影响、关键字段变化）。
3. 签发一次性确认票据（`confirmation_id`）。
4. 用户确认（携带 `confirmation_id` + 参数哈希）。
5. 服务器校验票据、哈希、时效、操作者一致性。
6. 执行写入并记录审计事件。

## 5. 确认票据规范（建议）

最小字段：
1. `confirmation_id`：一次性票据 ID。
2. `actor_username`、`actor_role`：绑定确认人。
3. `app_id`、`capability_id`：绑定操作上下文。
4. `request_hash`：请求参数摘要（防篡改）。
5. `expires_at`：过期时间（建议 2~5 分钟）。
6. `risk_level`：风险等级。
7. `summary`：给人看的执行摘要（中文）。

防重放要求：
1. 票据仅可使用一次。
2. 超时失效。
3. 参数哈希不一致必须拒绝。
4. 操作者与创建票据时不一致必须拒绝。

## 6. 审计事件标准

## 6.1 事件命名（统一大写下划线）

确认类：
1. `WRITE_CONFIRM_REQUESTED`
2. `WRITE_CONFIRM_APPROVED`
3. `WRITE_CONFIRM_REJECTED`
4. `WRITE_CONFIRM_CANCELLED`
5. `WRITE_CONFIRM_EXPIRED`

执行类：
1. `WRITE_EXEC_STARTED`
2. `WRITE_EXEC_SUCCEEDED`
3. `WRITE_EXEC_FAILED`
4. `WRITE_EXEC_ROLLED_BACK`

拒绝/校验类：
1. `WRITE_PERMISSION_DENIED`
2. `WRITE_ASSIGNMENT_DENIED`
3. `WRITE_STATUS_TRANSITION_DENIED`
4. `WRITE_RLS_DENIED`
5. `WRITE_VALIDATION_FAILED`
6. `WRITE_CONFLICT_DETECTED`

语义补全相关：
1. `SEMANTIC_ENRICH_DRAFT_CREATED`
2. `SEMANTIC_ENRICH_APPLIED`
3. `SEMANTIC_ENRICH_FALLBACK`
4. `SEMANTIC_ENRICH_FAILED`

## 6.2 事件字段（逻辑模型）

最小建议字段：
1. `event_type`
2. `event_time`
3. `actor_username`
4. `actor_role`
5. `app_id`
6. `capability_id`
7. `intent`
8. `object`
9. `target_ref`（表/主键/实例ID）
10. `confirmation_id`
11. `request_hash`
12. `status`
13. `reason_code`
14. `message`
15. `rows_affected`
16. `before_snapshot`（可选）
17. `after_snapshot`（可选）
18. `diff_summary`（可选）
19. `trace_id`
20. `idempotency_key`

## 6.3 原因码（reason_code）建议

1. `OK`
2. `USER_CANCELLED`
3. `CONFIRM_EXPIRED`
4. `CONFIRM_HASH_MISMATCH`
5. `PERMISSION_DENIED`
6. `ASSIGNMENT_DENIED`
7. `STATUS_TRANSITION_DENIED`
8. `RLS_DENIED`
9. `VALIDATION_FAILED`
10. `CONFLICT`
11. `SYSTEM_ERROR`
12. `TIMEOUT`

## 7. 与现有表的兼容落点

## 7.1 `app_center.execution_logs`（通用写审计）

现有字段：
1. `app_id`
2. `execution_id`
3. `task_id`
4. `status`（`pending/running/completed/failed`）
5. `input_data`
6. `output_data`
7. `error_message`
8. `executed_by`
9. `executed_at`

兼容映射建议：
1. `task_id` 存 `capability_id` 或 `{intent}.{object}`。
2. `input_data` 存请求摘要、确认票据、风险等级、参数哈希。
3. `output_data` 存执行结果、影响行数、差异摘要。
4. `error_message` 存失败原因码+简述。

## 7.2 `workflow.instance_events`（流程专用审计）

保留现有事件并扩展 payload：
1. 现有：`INSTANCE_STARTED`、`TASK_TRANSITION`、`INSTANCE_COMPLETED`。
2. 建议在 `payload` 加入：`confirmation_id`、`request_hash`、`trace_id`、`reason_code`。

## 7.3 Agent Runtime 日志

`realtime/index.js` 已有 `logAgentEvent(...)`。  
建议将关键写操作事件同步到结构化审计表，不只写控制台日志。

## 8. 接口交互建议（不改现有权限链）

推荐两阶段调用：
1. `preview_write`：仅预检查 + 生成确认摘要，不落库写。
2. `confirm_write`：携带 `confirmation_id` 执行真实写入。

必要请求头：
1. `X-EIS-Trace-Id`：链路追踪 ID。
2. `X-Idempotency-Key`：幂等键（避免重复提交）。

响应约定（建议）：
1. 需确认时返回 `confirmation_required=true`。
2. 执行成功返回 `execution_id` + `rows_affected`。
3. 执行失败返回 `reason_code` + 可读中文消息。

## 9. 前端交互规范（中文、易懂）

确认弹窗必须显示：
1. 操作对象（例如“库存草稿 #123”）
2. 操作类型（新增/修改/删除/推进流程）
3. 关键变化（从什么改成什么）
4. 预计影响范围（记录数）
5. 风险提示（高风险红色标识）

按钮规范：
1. 主按钮：`确认执行`
2. 次按钮：`取消`
3. 高风险可选增加文本确认（例如输入“确认执行”）

## 10. 数据安全与脱敏

审计中禁止写入：
1. 密码、Token、密钥、完整证件号。
2. 大体积二进制文件内容。

建议策略：
1. 敏感字段仅保留掩码或哈希。
2. `before/after` 快照只保留关键字段。
3. 审计日志只读，禁止业务侧随意修改。

## 11. 留存与治理

1. 留存周期建议：在线 180 天，归档 2 年（按企业合规调整）。
2. 每周检查失败事件 TOP（`WRITE_EXEC_FAILED`、`WRITE_PERMISSION_DENIED`）。
3. 每月抽检高风险写操作样本，核对“确认记录”与“实际变更”一致性。

## 12. 验收清单（上线前）

1. 高风险写操作全部触发二次确认。
2. 用户取消/超时不会产生写入。
3. 相同幂等键重复提交不会重复执行。
4. 每次写入均可查到审计事件。
5. 权限拒绝与 RLS 拒绝能区分原因码。
6. 流程事件与业务写审计可通过 `trace_id` 串联。

---

本规范定位为“兼容增强层”标准：  
权限裁决仍由既有权限体系与 RLS/RPC 执行，  
二次确认与审计事件用于降低误操作风险并提升可追溯性。
