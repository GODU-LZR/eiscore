# EISCore 本体论与语义关系进度记录（2026-02-23）

> 更新说明（2026-02-27）：本文为语义专项推进快照。  
> 当前整合口径请优先参考：`docs/PROJECT_COMPLETION_INTEGRATED_2026-02-27.md`。

## 1. 本轮阅读结论

已对齐以下规范文档：
1. `docs/ONTOLOGY_COMPATIBILITY_PERMISSION_STANDARD.md`
2. `docs/ONTOLOGY_WORKFLOW_STATUS_V2_BLUEPRINT.md`
3. `docs/SEMANTICS_MODE_GOVERNANCE_MATRIX.md`
4. `docs/AGENT_AUTO_SEMANTICS_NO_TOUCH_SPEC_V1.md`
5. `docs/DATA_APP_COLUMN_SEMANTIC_INCREMENTAL_RULES_V1.md`
6. `docs/AGENT_SEMANTIC_CAPABILITY_CATALOG_V1.md`
7. `docs/STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`
8. `docs/LIGHTWEIGHT_ONTOLOGY_ROLLOUT.md`
9. `docs/EISCORE_MINIMAL_ONTOLOGY_V1.md`

核心共识不变：
1. 权限核心保持不变（`module/app/op/field`）。
2. 全局保持 `permission_mode=compat`。
3. 语义层是增强层，不替代裁决层。
4. 新建应用默认 `semantics_mode=ai_defined`，可兼容 `creator_defined/none`。

## 2. 当前代码现状（阅读后）

已落地：
1. 动态建表后会自动 upsert 表级语义到 `public.ontology_table_semantics`。
2. 动态建表/改列后会自动 upsert 列级语义到 `public.ontology_column_semantics`。
3. 列删除采用失活策略（`is_active=false`），保留语义历史。
2. 本体关系工作台可读取 `app_data.ontology_table_relations` 并显示语义名称。
3. 轻量本体权限语义视图 `public.v_permission_ontology` 已有。

本轮补齐：
1. 本体工作台已增加列级语义可视化（按当前选中表懒加载）。
2. 语义任务审计已统一到 `app_center.execution_logs`（running/completed/failed）。
3. 历史应用配置缺失的 `semantics_mode/permission_mode` 已支持一键回填。

## 3. 本轮已完成改动

### 3.1 新增统一语义配置工具
1. 新增：`eiscore-apps/src/utils/semantics-config.js`
2. 提供 `ensureSemanticConfig(...)`，统一补齐：
   - `permission_mode=compat`
   - `semantics_mode=ai_defined`（可 `forceNone`）

### 3.2 应用创建与保存链路对齐
1. `eiscore-apps/src/views/AppDashboard.vue`
   - 新建应用 payload 默认写入语义模式配置。
   - 数据应用补 ACL 配置时同步补语义模式默认值。
2. `eiscore-apps/src/views/AppConfigCenter.vue`
   - 创建应用默认写入语义模式配置。
   - 保存配置时统一补齐语义模式。
   - 只读系统应用（本体工作台）使用 `forceNone` 兼容策略。
3. `eiscore-apps/src/views/DataApp.vue`
   - 加载配置时补齐语义模式默认值。
   - 保存配置时保证语义模式字段不丢失。
4. `eiscore-apps/src/components/AppCenterGrid.vue`
   - 运行时配置落地前统一补齐语义模式默认值。

### 3.3 数据库语义标签增强
1. `sql/app_center_data_tables.sql`
   - `create_data_app_table(...)` 在 upsert 表语义时读取 `app.config.semantics_mode`。
   - 在 `tags` 中追加 `semantics:{mode}` 便于后续审计/检索。

### 3.4 列级语义增量落地（新增）
1. `sql/app_center_data_tables.sql`
   - 新增表：`public.ontology_column_semantics`。
   - `create_data_app_table(...)` 每次保存列时自动：
     - upsert 新增/修改列语义（`semantic_class/semantic_name/ui_type/data_type`）
     - 将本次未出现的历史列语义标记为 `is_active=false`
   - 保持权限核心不变，不改既有 ACL/RLS 设计。

### 3.5 本体工作台列语义可视化（新增）
1. `eiscore-apps/src/views/OntologyWorkbench.vue`
   - 新增“列级语义”面板，支持：
     - 当前选中表列语义展示
     - 语义类型、语义模式、敏感标记展示
     - 懒加载与按表刷新，避免全量加载导致卡顿
2. 读取源：
   - `public.ontology_column_semantics`（`is_active=true`）

### 3.6 语义审计事件落库（新增）
1. `sql/app_center_data_tables.sql`
   - 新增函数：`app_center.log_semantic_event(...)`
   - `app_center.create_data_app_table(...)` 内置调用：
     - `running`：开始语义补充
     - `completed`：语义补充完成
     - `failed`：异常失败（不阻塞主流程）
2. `sql/patch_app_center_execution_logs_insert_policy.sql`
   - 补齐 `execution_logs` 的 `SELECT/INSERT/UPDATE/DELETE` 策略
   - 兼容 `request.jwt.claim.app_role` 与 `request.jwt.claims` 两种取值方式

### 3.7 历史配置回填（新增）
1. 新增脚本：`sql/backfill_app_semantic_config_defaults.sql`
2. 回填规则：
   - 缺失 `permission_mode` -> `compat`
   - 缺失 `semantics_mode` -> `ai_defined`（`ontology_workbench` -> `none`）
3. 已执行回填并验证缺失项归零。

### 3.8 历史业务表列语义全量回填（新增）
1. 新增脚本：`sql/backfill_ontology_column_semantics_all_tables.sql`
2. 执行范围：
   - `public.ontology_table_semantics` 中 `is_active=true` 且真实存在的基础表（44 张）。
3. 执行结果：
   - upsert 列语义记录：`423` 条
   - 覆盖表数：`44/44`
   - 表级平均覆盖率：`100%`
   - 乱码校验（`?`）计数：`0`
4. 安全边界：
   - 仅写入 `public.ontology_column_semantics`
   - 未修改任何鉴权/RLS/权限码逻辑

## 4. 下一步建议（按优先级）

1. P1：细化审计事件码
   - 区分 `semantic.table.enrich.*` 与 `semantic.column.enrich.*`。
2. P2：本体工作台增加“语义模式过滤/统计”
   - 可按 `semantics:*` 标签筛选。
3. P2：Agent 工具网关接线首批只读能力
   - 对齐 `docs/AGENT_SEMANTIC_CAPABILITY_CATALOG_V1.md`。
