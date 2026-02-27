# EISCore 本体语义与流程应用基线记录（2026-02-23）

> 更新说明（2026-02-27）：本文为语义+流程基线快照。  
> 当前整合口径请优先参考：`docs/PROJECT_COMPLETION_INTEGRATED_2026-02-27.md`。

## 1. 文档目的

1. 固化当前“本体语义”落地成果，作为后续迭代基线。
2. 解析当前流程应用实现状态，明确简化与系统集成的切入点。
3. 明确兼容边界：不破坏现有权限/鉴权核心。

## 2. 本体语义工作现状（已落地）

## 2.1 数据覆盖快照

基于 2026-02-23 实库统计：

1. 表级语义：`44` 张激活（`inactive=0`）。
2. 列级语义：`423` 条激活，覆盖 `44` 张表。
3. 覆盖率：`44/44` 表达到 `100%`（平均 `100.0%`）。
4. 中文化：`semantic_name` 中文 `423/423`，英文残留 `0`。
5. 中文标签：`lang:zh_CN` 打标 `423/423`。

## 2.2 已完成能力

1. 新建/改列语义增量：
   - `sql/app_center_data_tables.sql`
   - `app_center.create_data_app_table(...)` 自动 upsert 表级与列级语义。
2. 历史语义回填：
   - `sql/backfill_ontology_column_semantics_all_tables.sql`
   - 已完成全量历史业务表列语义回填。
3. 全量中文语义补全：
   - `sql/patch_fill_column_semantics_chinese_full.sql`
   - 已完成列语义中文补全与中文标签打标。
4. 本体工作台可视化：
   - `eiscore-apps/src/views/OntologyWorkbench.vue`
   - 支持关系图与列语义展示（按表懒加载）。

## 2.3 兼容边界（确认）

本轮语义工作仅操作语义元数据，不改权限裁决链路：

1. 未改 `public.permissions` 权限模型结构。
2. 未改 `public.role_permissions`/`public.user_roles` 绑定规则。
3. 未替换既有 RLS 作为核心鉴权来源。
4. `permission_mode` 仍按 `compat` 执行。

## 3. 流程应用当前实现解析

## 3.1 前端入口与页面

路由入口：

1. 流程设计器：`/workflow-designer/:appId?` -> `eiscore-apps/src/views/flow/FlowDesigner.vue`
2. 应用运行时：`/app/:appId` -> `eiscore-apps/src/views/AppRuntime.vue`

当前流程页面分工：

1. 设计页（FlowDesigner）
   - BPMN 设计/导入/保存/发布。
   - 用户任务节点配置：业务应用绑定、状态映射、自动推进规则、任务分派。
2. 运行页（AppRuntime，workflow 类型）
   - 左侧流程图查看（NavigatedViewer）。
   - 右侧 Tab：员工页 / 管理员页 / 配置页（super_admin 可见）。
   - 支持发起实例、推进实例、查看实例与事件日志。

## 3.2 数据模型与 RPC

核心表：

1. `workflow.definitions`
2. `workflow.instances`
3. `workflow.task_assignments`
4. `workflow.instance_events`
5. `app_center.workflow_state_mappings`

核心函数：

1. `workflow.start_workflow_instance(...)`
2. `workflow.transition_workflow_instance(...)`
3. `workflow.can_execute_task(...)`
4. `workflow.resolve_app_acl_key(...)`
5. `workflow.check_state_transition_permission(...)`

实现特征：

1. 权限校验采用“新码优先 + 旧码回退”的兼容策略（workflow_start/workflow_transition/workflow_complete + create/edit 回退）。
2. 任务分派基于 `task_assignments` 的 `candidate_roles/candidate_users`。
3. 实例审计事件写入 `workflow.instance_events`。

## 3.3 线上数据快照（当前环境）

1. workflow 应用：`1` 个（`入职流程`，`published`）。
2. 对应 definition：`id=4`，`associated_table=hr.archives`。
3. 任务分派：definition `4` 下共 `4` 条。
4. 实例状态：definition `4` 下 `ACTIVE=1`、`COMPLETED=3`。
5. 事件统计：`TASK_TRANSITION=8`、`INSTANCE_STARTED=5`、`INSTANCE_COMPLETED=4`。

## 3.4 当前流程链路的主要缺口（2026-02-23 更新）

1. 已补齐：`workflow_state_mappings` 已形成统一“业务表状态自动写回执行器”，并把写回结果落入 `workflow.instance_events.payload.state_apply`。
2. 运行页的“员工/管理员/配置”信息密度高，学习成本偏高。
3. 业务键（business_key）目前仍以手输为主，和业务表记录联动不够强。
4. 设计页中“业务应用绑定 + 状态映射 + 分派规则”仍分散在节点配置中，对业务管理员不够直观。

## 4. 简化与集成的建议方向（下一阶段）

## 4.1 流程应用简化（UI 层）

建议把运行页简化为“两层视角”：

1. 办理台（员工/管理员共用）
   - 我的待办、可推进实例、实例轨迹。
2. 配置台（管理员/开发）
   - 节点分派、状态映射、流程发布信息。

目标：降低术语暴露和操作入口分散问题。

## 4.2 系统集成（业务表联动）

优先打通“流程实例 -> 业务表记录”闭环：

1. 统一 business_key 生成和绑定规则（优先业务主键）。
2. 已落地：流程启动/推进时按 `workflow_state_mappings` 写回目标表状态字段。
3. 已落地：写回结果与 `instance_events` 串联（可审计、可追踪）。

## 4.3 不可破坏约束

1. 不替换现有权限核心。
2. 不删除既有 `module/app/op/field` 权限码能力。
3. 不绕开现有 RLS/claim 鉴权路径。

## 5. 建议执行顺序

1. P1：流程运行页信息架构简化（先 UI，再文案）
2. P1：business_key 与业务表主键绑定规范
3. P1：状态写回执行器（已完成，试点：`hr.archives`）
4. P2：流程配置页“节点配置向导化”（降低配置门槛）
5. P2：流程可观测性面板（实例、事件、写回结果）

---

本文件是“本体语义完成度 + 流程应用简化集成”联合基线。  
后续流程改造以本基线为验收对照，保持权限核心稳定前提不变。
