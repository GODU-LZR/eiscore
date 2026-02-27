# EISCore 新增应用无感语义自动补全规范（Agent 驱动，兼容权限核心）

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：应用中心新建应用（workflow/data/flash）及数据应用后续新增列

## 1. 目标

在不改变既有权限主链路的前提下，实现“创建应用时由 Agent 自动补语义，用户无感使用”。

核心目标：
1. 新建应用时默认自动生成语义，不强迫业务用户手填本体字段。
2. 与现有权限模型兼容，保持 `permission_mode=compat` 主策略不变。
3. 语义层只增强解释与治理，不直接替代权限裁决。

## 2. 规范依据（现有文档）

本规范继承以下基线：
1. `docs/ONTOLOGY_COMPATIBILITY_PERMISSION_STANDARD.md`
2. `docs/SEMANTICS_MODE_GOVERNANCE_MATRIX.md`
3. `docs/ONTOLOGY_WORKFLOW_STATUS_V2_BLUEPRINT.md`
4. `docs/EISCORE_MINIMAL_ONTOLOGY_V1.md`
5. `docs/STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`

冲突处理原则：
1. 先保权限核心不变，再扩语义能力。
2. 先兼容可用，再逐步收敛到更严格治理。

## 3. 系统模块解析（基于当前代码）

## 3.1 前端模块

1. 基座与统一入口：`eiscore-base`
   - 路由聚合：`/hr`、`/materials`、`/apps`（`eiscore-base/src/router/index.js`）。
   - AI 入口：`eiscore-base/src/components/AiCopilot.vue`、`eiscore-base/src/utils/ai-bridge.js`。
2. 应用中心：`eiscore-apps`
   - 新建与配置应用：`eiscore-apps/src/views/AppDashboard.vue`、`eiscore-apps/src/views/AppConfigCenter.vue`。
   - 数据应用配置：`eiscore-apps/src/views/DataApp.vue`。
   - 运行时承载：`eiscore-apps/src/views/AppRuntime.vue`。
   - 本体工作台：`eiscore-apps/src/views/OntologyWorkbench.vue`。
3. HR 与物料子应用
   - HR 路由与业务：`eiscore-hr/src/router/index.js`、`eiscore-hr/src/views/*`。
   - 物料路由与业务：`eiscore-materials/src/router/index.js`、`eiscore-materials/src/views/*`。
   - 三套表格实现共享同类 grid 能力（含列配置、公式、导入等）。

## 3.2 Agent 运行时模块

1. 服务入口：`realtime/index.js`
   - AI 对话接口：`/agent/ai/config`、`/agent/ai/agents`、`/agent/ai/chat/completions`。
   - Agent 任务权限：`canUseAgent`（默认角色约束更严）。
   - AI 对话权限：`canUseAi`（用于工作助手/经营助手场景）。
2. 工作流运行时：`realtime/workflow-engine.js`
   - 负责流程实例推进计算。
3. 网关角色
   - 当前已具备“统一入口 + 权限判断 + 模型路由”能力，可承载语义自动生成调用。

## 3.3 数据库与语义模块

1. 应用中心核心：`sql/app_center_schema.sql`
   - `app_center.apps`、`app_center.categories`、`app_center.published_routes`、`app_center.workflow_state_mappings`。
2. 动态建表 RPC：`sql/app_center_data_tables.sql`
   - `app_center.create_data_app_table(...)` 已内置表级语义 upsert 到 `public.ontology_table_semantics`。
3. 本体关系与语义表：`sql/patch_add_ontology_relations_app.sql`
   - `public.ontology_table_semantics`
   - `app_data.ontology_table_relations`
4. 权限语义投影视图：`sql/patch_lightweight_ontology_runtime.sql`
   - `public.v_permission_ontology`（权限码语义解析视图）。

## 3.4 当前能力与缺口

当前已具备：
1. 新建数据应用时可自动补“表级语义”。
2. 本体工作台可展示本体关系与语义名称。

当前缺口：
1. 缺少“列级语义自动补全”规范化流程。
2. 缺少“语义生成结果的状态管理（草案/确认/发布）”统一约束。
3. 缺少“应用创建链路内可观测的 Agent 语义任务审计”标准。

## 4. 目标方案（无感语义）

## 4.1 默认策略

1. 新建应用默认 `semantics_mode=ai_defined`。
2. 用户界面默认不增加复杂配置步骤（保持“无感”）。
3. 若语义生成失败，自动回退到规则模板语义，不阻断应用创建。

## 4.2 语义生成触发点

1. 创建数据应用并建表成功后，触发表级语义生成。
2. 数据应用新增列并保存后，触发增量列级语义生成。
3. 工作流应用发布时，触发流程对象语义补全（流程定义、实例、任务映射）。

## 4.3 生成内容（最小集）

1. 表级语义：`semantic_domain`、`semantic_class`、`semantic_name`、`semantic_description`、`tags`。
2. 列级语义（建议新增独立存储）：列业务含义、数据类型语义、是否敏感、是否流程关键字段。
3. 关系语义：与已存在业务对象的依赖关系谓词（仅语义补充，不改变 FK/ACL 事实）。

## 4.4 权限与边界

1. 保持 `module/app/op/field` 权限体系不变。
2. 语义层不能直接放行写操作，写操作仍走既有权限码和 RLS/RPC。
3. `strict` 切换不在本阶段强推，默认 `compat`。

## 5. 运行流程（V1）

## 5.1 新建应用（无感）

1. 用户在应用中心创建应用。
2. 系统完成 app 元数据与动态表创建（如数据应用）。
3. 后台组装上下文：应用名、描述、类型、字段配置、已有语义词汇。
4. 调用 Agent 生成语义草案。
5. 校验草案结构后写入语义表。
6. 写入审计日志（语义来源、版本、触发人、结果状态）。
7. 前端仅展示“语义已自动补全/降级补全”状态，不要求用户理解本体术语。

## 5.2 新增列（增量）

1. 用户在表格应用新增列并保存。
2. 系统只对新增/变更列触发语义补全。
3. 失败不阻断列生效，记录待补偿任务。
4. 本体工作台可见该列归属语义（或待确认标记）。

## 6. 数据与审计建议（兼容实现）

建议最小扩展：
1. 在应用配置中增加 `semantics_mode`（默认 `ai_defined`）。
2. 增加语义任务审计表（或复用执行日志）：
   - `app_id`
   - `task_type`（table_semantic/column_semantic/relation_semantic）
   - `status`（success/fallback/failed）
   - `source`（agent/rule/manual）
   - `error_message`
   - `created_by/created_at`

## 7. 验收标准（V1）

1. 创建应用后无需手工配置，语义自动出现于本体工作台。
2. 任一语义任务失败不影响应用创建与使用。
3. 权限回归测试通过：原角色能力不因语义功能上线而失效。
4. 审计可追踪：可定位“哪次创建触发了哪次语义生成”。

## 8. 上线顺序

1. 第一阶段：数据应用表级语义全自动（已具备基础能力，补审计与状态展示）。
2. 第二阶段：数据应用列级语义增量自动补全。
3. 第三阶段：工作流/闪念应用语义自动补全与统一治理看板。

## 9. 不在本阶段范围

1. 不重构既有权限表与角色模型。
2. 不要求全局切换 `strict`。
3. 不允许模型直接绕过网关调用任意底层接口。

---

本规范用于指导“新增应用时 Agent 无感补语义”落地，定位为兼容增强，不是权限重构文档。
