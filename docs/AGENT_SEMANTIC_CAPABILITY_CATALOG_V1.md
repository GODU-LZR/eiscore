# EISCore Agent 语义能力清单（V1）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：Flash/工作助手/应用中心 Agent 工具网关接入

## 1. 目的

把“自然语言”稳定映射为“系统已存在接口能力”，用于：
1. 新增应用无感语义补全（`ai_defined` 默认模式）。
2. Agent 调用表格应用与系统接口时可控、可审计、可回滚。
3. 不破坏既有权限核心（兼容模式优先）。

本清单是 V1 执行目录，不是重构方案。

## 2. 对齐的既有规范

1. `docs/ONTOLOGY_COMPATIBILITY_PERMISSION_STANDARD.md`
2. `docs/SEMANTICS_MODE_GOVERNANCE_MATRIX.md`
3. `docs/STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`
4. `docs/ONTOLOGY_WORKFLOW_STATUS_V2_BLUEPRINT.md`
5. `docs/AGENT_AUTO_SEMANTICS_NO_TOUCH_SPEC_V1.md`

## 3. 系统模块解析结论（用于能力编目）

1. 前端入口
   - 基座：`eiscore-base`
   - 应用中心：`eiscore-apps`
   - HR：`eiscore-hr`
   - 物料：`eiscore-materials`
2. Agent 运行时
   - HTTP：`/agent/ai/*`、`/agent/flash/*`
   - WS：`/agent/ws`（`agent:task`、`agent:tool_use`、`agent:terminal`）
3. 数据核心
   - 应用中心：`app_center.*`
   - 工作流：`workflow.*`
   - HR：`hr.*` + `public.*`
   - 物料：`scm.*` + `public.raw_materials`
4. 语义核心
   - `public.ontology_table_semantics`
   - `app_data.ontology_table_relations`
   - `public.v_permission_ontology`

## 4. 能力模型（Tool Gateway 统一格式）

每个能力（capability）统一定义：
1. `capability_id`：稳定标识。
2. `intent`：查询/统计/导出/新增/修改/删除/流程发起/流程推进/配置。
3. `object`：业务对象（应用、流程实例、库存草稿、人事档案等）。
4. `api`：实际接口（PostgREST/RPC/Agent Runtime）。
5. `permission_min`：最低权限建议（沿用既有权限码语义）。
6. `risk`：`low`/`medium`/`high`。
7. `confirm_required`：是否要求二次确认（写操作默认 `true`）。

## 5. V1 意图词汇（Intent Vocabulary）

1. `read_list`：列表查询
2. `read_detail`：详情查询
3. `read_aggregate`：统计聚合
4. `read_export`：导出准备
5. `create_record`：新增记录
6. `update_record`：修改记录
7. `delete_record`：删除记录
8. `start_workflow`：发起流程
9. `transition_workflow`：推进流程
10. `configure_app`：配置应用/流程映射/分派规则
11. `semantic_enrich`：语义补全（表/列/关系）

## 6. V1 对象词汇（Object Vocabulary）

1. `app_registry`（应用注册）
2. `data_table`（动态业务表）
3. `workflow_definition`
4. `workflow_instance`
5. `workflow_task_assignment`
6. `workflow_state_mapping`
7. `hr_archive`
8. `hr_attendance_record`
9. `inventory_draft`
10. `inventory_current`
11. `inventory_transaction`
12. `material_master`
13. `warehouse`
14. `ontology_relation`
15. `ontology_semantic`

## 7. V1 能力目录（首批可落地）

说明：
1. 下表优先覆盖你当前代码里已使用接口。
2. `permission_min` 使用模板写法，实际由应用 `aclModule` 展开。

| capability_id | intent | object | api | method | permission_min | risk | confirm_required |
|---|---|---|---|---|---|---|---|
| `cap.app.list` | `read_list` | `app_registry` | `/api/apps` | GET | `module:app` | low | false |
| `cap.app.detail` | `read_detail` | `app_registry` | `/api/apps?id=eq.{appId}` | GET | `app:{aclModule}` | low | false |
| `cap.app.create` | `create_record` | `app_registry` | `/api/apps` | POST | `super_admin`（现状 RLS） | high | true |
| `cap.app.update` | `update_record` | `app_registry` | `/api/apps?id=eq.{appId}` | PATCH | `op:{aclModule}.config` | medium | true |
| `cap.app.delete` | `delete_record` | `app_registry` | `/api/apps?id=eq.{appId}` | DELETE | `super_admin`/配置管理员 | high | true |
| `cap.route.resolve` | `read_detail` | `app_registry` | `/api/published_routes?route_path=eq.{path}` | GET | `module:app` | low | false |
| `cap.route.upsert` | `configure_app` | `app_registry` | `/api/published_routes` | POST/PATCH | `op:{aclModule}.config` | medium | true |
| `cap.data.table.ensure` | `configure_app` | `data_table` | `/api/rpc/create_data_app_table` | POST | `op:{aclModule}.config` | medium | true |
| `cap.data.grid.list` | `read_list` | `data_table` | `/api/{table}` | GET | `app:{aclModule}` | low | false |
| `cap.data.grid.detail` | `read_detail` | `data_table` | `/api/{table}?id=eq.{id}` | GET | `app:{aclModule}` | low | false |
| `cap.data.grid.create` | `create_record` | `data_table` | `/api/{table}` | POST | `op:{aclModule}.create` | medium | true |
| `cap.data.grid.update` | `update_record` | `data_table` | `/api/{table}` | PATCH | `op:{aclModule}.edit` | medium | true |
| `cap.data.grid.delete` | `delete_record` | `data_table` | `/api/{table}` | DELETE | `op:{aclModule}.delete` | high | true |
| `cap.data.grid.export` | `read_export` | `data_table` | `/api/{table}?select=...` | GET | `op:{aclModule}.export` | low | false |
| `cap.workflow.definition.list` | `read_list` | `workflow_definition` | `/api/definitions?app_id=eq.{appId}` | GET | `app:{aclModule}` | low | false |
| `cap.workflow.definition.upsert` | `configure_app` | `workflow_definition` | `/api/definitions` | POST/PATCH | `op:{aclModule}.config` | high | true |
| `cap.workflow.assignment.list` | `read_list` | `workflow_task_assignment` | `/api/task_assignments?definition_id=eq.{id}` | GET | `app:{aclModule}` | low | false |
| `cap.workflow.assignment.upsert` | `configure_app` | `workflow_task_assignment` | `/api/task_assignments` | POST/PATCH | `op:{aclModule}.config` | high | true |
| `cap.workflow.mapping.list` | `read_list` | `workflow_state_mapping` | `/api/workflow_state_mappings?workflow_app_id=eq.{appId}` | GET | `app:{aclModule}` | low | false |
| `cap.workflow.mapping.upsert` | `configure_app` | `workflow_state_mapping` | `/api/workflow_state_mappings?on_conflict=...` | POST | `op:{aclModule}.config` | high | true |
| `cap.workflow.instance.list` | `read_list` | `workflow_instance` | `/api/instances?definition_id=eq.{id}` | GET | `app:{aclModule}` | low | false |
| `cap.workflow.event.list` | `read_list` | `workflow_instance` | `/api/instance_events?...` | GET | `app:{aclModule}` | low | false |
| `cap.workflow.instance.start` | `start_workflow` | `workflow_instance` | `/api/rpc/start_workflow_instance` | POST | `op:{aclModule}.workflow_start`（compat 可回退 create） | high | true |
| `cap.workflow.instance.transition` | `transition_workflow` | `workflow_instance` | `/api/rpc/transition_workflow_instance` | POST | `op:{aclModule}.workflow_transition` + `status_transition.*`（compat 可回退 edit） | high | true |
| `cap.hr.archive.list` | `read_list` | `hr_archive` | `/api/archives` | GET | `app:hr_employee`/数据域策略 | low | false |
| `cap.hr.archive.update` | `update_record` | `hr_archive` | `/api/archives` | PATCH | `op:hr_employee.edit` | medium | true |
| `cap.hr.attendance.init` | `configure_app` | `hr_attendance_record` | `/api/rpc/init_attendance_records` | POST | `op:hr_attendance.config` | high | true |
| `cap.inventory.current.list` | `read_list` | `inventory_current` | `/api/v_inventory_current` | GET | `app:mms_ledger`/库存应用权限 | low | false |
| `cap.inventory.draft.list` | `read_list` | `inventory_draft` | `/api/v_inventory_drafts` | GET | `app:mms_ledger`/库存应用权限 | low | false |
| `cap.inventory.draft.create` | `create_record` | `inventory_draft` | `/api/inventory_drafts` | POST | `op:mms_ledger.create` | medium | true |
| `cap.inventory.batchno.generate` | `configure_app` | `inventory_draft` | `/api/rpc/generate_batch_no` | POST | `op:mms_ledger.edit` | medium | true |
| `cap.inventory.stock.in` | `update_record` | `inventory_transaction` | `/api/rpc/stock_in` | POST | `op:mms_ledger.workflow_transition`/`op:mms_ledger.edit` | high | true |
| `cap.inventory.stock.out` | `update_record` | `inventory_transaction` | `/api/rpc/stock_out` | POST | `op:mms_ledger.workflow_transition`/`op:mms_ledger.edit` | high | true |
| `cap.ontology.relation.list` | `read_list` | `ontology_relation` | `/api/ontology_table_relations?relation_type=eq.ontology` | GET | `app:ontology_workbench` 或系统可见 | low | false |
| `cap.ontology.semantic.list` | `read_list` | `ontology_semantic` | `/api/ontology_table_semantics` | GET | `app:ontology_workbench` 或系统可见 | low | false |
| `cap.ontology.semantic.enrich` | `semantic_enrich` | `ontology_semantic` | `Agent + upsert ontology_table_semantics` | internal | `op:{aclModule}.config` | medium | false |

## 8. Agent Runtime 能力（已存在）

## 8.1 HTTP 能力

1. `GET /agent/health`
2. `GET /agent/ai/config`
3. `GET /agent/ai/agents`
4. `POST /agent/ai/chat/completions`
5. `POST /agent/ai/translate`
6. `POST /agent/ai/map-locate`
7. `GET /agent/flash/draft`
8. `POST /agent/flash/draft`
9. `POST /agent/flash/attachments`

## 8.2 WebSocket 能力

1. `agent:task`（启动任务）
2. `agent:tool_use`（调用工具）
3. `agent:terminal`（受限命令）
4. `flash:cline_task`（闪念任务）
5. `subscribe/unsubscribe`（事件订阅）

## 9. 语义别名池（首批建议）

说明：用于 `intent + object` 命中，减少“用户口语”到能力映射误差。

| 对象 | 推荐别名 |
|---|---|
| `workflow_instance` | 流程实例、流程单、审批单、流程进度 |
| `workflow_definition` | 流程模板、流程图、审批流程 |
| `workflow_task_assignment` | 任务分配、办理人规则、候选角色 |
| `workflow_state_mapping` | 状态映射、节点状态规则 |
| `data_table` | 表格应用、业务台账、数据表 |
| `hr_archive` | 花名册、员工档案、员工台账 |
| `inventory_draft` | 入库草稿、出库草稿、库存草稿 |
| `inventory_current` | 当前库存、库存现状、库存余额 |
| `inventory_transaction` | 库存流水、出入库记录、库存变更记录 |
| `ontology_relation` | 本体关系、语义关系、依赖关系图 |

## 10. V1 执行策略

1. 先开只读能力
   - 优先启用 `read_list/read_detail/read_aggregate/read_export`。
2. 再开写能力
   - `create/update/delete/start/transition` 默认二次确认。
3. 严格审计
   - 记录能力命中、权限判定、接口返回、失败原因。
4. 失败降级
   - 能力未命中时只给建议，不直接执行写操作。

## 11. 与权限核心兼容约束（必须遵守）

1. 不改既有 `module/app/op/field` 权限体系。
2. 不绕过 RLS/RPC 裁决链路。
3. 不以语义推断结果直接替代权限结果。
4. 兼容模式下允许新码优先、旧码回退（按现有规范）。

---

本清单用于指导下一步“语义工具网关”落地与 Agent 接口接线，确保你现有系统可渐进升级，不伤权限核心。
