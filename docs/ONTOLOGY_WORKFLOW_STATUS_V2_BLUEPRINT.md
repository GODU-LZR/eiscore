# EISCore 本体/流程/状态权限设计蓝图（V2）

文档版本：v2.0-draft  
整理日期：2026-02-16  
适用范围：`eiscore-base`、`eiscore-apps`、`eiscore-hr`、`eiscore-materials`

## 1. 目标

在已上线的 V1 基础上，V2 的目标是把“兼容可用”升级为“强约束可治理”：
1. 明确每个应用的状态机，不再只靠隐式映射推断迁移。
2. 明确每个节点推进的权限来源，避免 `edit` 过宽兜底长期存在。
3. 明确同一条业务记录在表格、流程、权限中的唯一语义。

## 2. V1 到 V2 的核心变化

| 维度 | V1（当前） | V2（目标） |
|---|---|---|
| 状态迁移判定 | 主要依赖 `to_task` 映射，缺少显式 `from_state` | 显式 `from_state -> to_state` 规则 |
| 权限模式 | 新码优先 + 旧码 `edit/create` 回退 | 按应用切换 `compat` / `strict` |
| 流程推进鉴权 | 任务分派 + 操作权限 | 任务分派 + 操作权限 + 迁移权限 + 状态机规则 |
| 应用策略 | 全局默认策略 | 每个应用独立策略 |
| 治理结果 | 可运行 | 可审计、可追责、可回放 |

## 3. V2 设计原则

1. 单一真值：业务状态只认主表 `status` 字段。
2. 显式规则：所有允许的迁移都必须在规则表可查。
3. 按应用收敛：每个应用独立开启严格模式，避免“一刀切”。
4. 可回滚：每个策略升级都可回退到 `compat`。
5. 最小侵入：不推翻现有 `module/app/op`，只增量扩展。

## 4. 建议的数据模型扩展

## 4.1 应用级策略表

建议新增：`app_center.workflow_permission_policies`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | serial pk | 主键 |
| `workflow_app_id` | uuid fk->`app_center.apps.id` | 流程应用 |
| `acl_module` | text | 权限域（如 `hr_employee` 或 `app_xxx`） |
| `permission_mode` | text | `compat` / `strict` |
| `enforce_assignment` | boolean | 是否强制任务分派 |
| `enforce_workflow_op_perm` | boolean | 是否强制 `workflow_start/transition/complete` |
| `enforce_status_transition_perm` | boolean | 是否强制 `status_transition` |
| `legacy_fallback_enabled` | boolean | 是否允许 `create/edit` 兜底 |
| `created_at/updated_at` | timestamptz | 时间戳 |

约束建议：
1. `unique(workflow_app_id)`。
2. `permission_mode in ('compat','strict')`。

## 4.2 迁移规则表

建议新增：`app_center.workflow_transition_rules`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | serial pk | 主键 |
| `workflow_app_id` | uuid fk | 所属流程应用 |
| `from_task_id` | text | 来源 BPMN 节点 |
| `to_task_id` | text | 目标 BPMN 节点 |
| `from_state` | text | 来源业务状态 |
| `to_state` | text | 目标业务状态 |
| `required_permission` | text | 必需权限码（可空=按模板推导） |
| `is_active` | boolean | 是否启用 |
| `created_at/updated_at` | timestamptz | 时间戳 |

约束建议：
1. `unique(workflow_app_id, from_task_id, to_task_id, from_state, to_state)`。
2. `from_state <> to_state`（若为空迁移则显式标注）。

## 4.3 映射表增强

现有：`app_center.workflow_state_mappings`  
建议增量字段：
1. `from_state text null`
2. `mapping_mode text default 'task_arrival'`（`task_arrival` / `transition`）

意义：
1. 避免一个任务被多个来源状态进入时无法精确判定。
2. 兼容当前只配置 `to_state` 的场景。

## 5. 权限判定链（V2）

一次流程推进（`transition_workflow_instance`）的建议判定顺序：

1. 读取应用策略（policy）。
2. 判定任务分派（候选角色/用户）。
3. 判定流程操作权限（`workflow_transition` 或 `workflow_complete`）。
4. 解析候选状态迁移（`from_state -> to_state`）。
5. 判定迁移权限（`status_transition.from_to`）。
6. 判定字段级编辑权限（`sys_field_acl`）。
7. 执行状态写回与审计日志落库。

失败语义建议：
1. `assignment_denied`
2. `workflow_permission_denied`
3. `status_transition_denied`
4. `field_acl_denied`
5. `policy_missing`

## 6. 本体词汇扩展（V2）

在 `EISCORE_MINIMAL_ONTOLOGY_V1` 基础上建议新增：

| 标识 | 类型 | 说明 |
|---|---|---|
| `wf:WorkflowPermissionPolicy` | Class | 应用级权限策略 |
| `wf:TransitionRule` | Class | 显式迁移规则 |
| `wf:hasPolicy` | Object Property | `Application -> WorkflowPermissionPolicy` |
| `wf:allowsTransitionByRule` | Object Property | `WorkflowPermissionPolicy -> TransitionRule` |
| `wf:policyMode` | Data Property | `compat` / `strict` |

## 7. 角色模板建议（入职流程示例）

| 角色 | 必需权限（最小） |
|---|---|
| `employee` | `app:hr_employee`, `op:hr_employee.workflow_start` |
| `hr_clerk` | `app:hr_employee`, `op:hr_employee.workflow_transition` |
| `dept_manager` | `app:hr_employee`, `op:hr_employee.workflow_transition` |
| `hr_admin` | `app:hr_employee`, `op:hr_employee.workflow_complete`, `op:hr_employee.status_transition.created_active` |
| `super_admin` | 全量 + 解锁类迁移权限 |

## 8. 分阶段上线策略

### 阶段 A（当前）
1. 全应用 `compat`。
2. 新权限码已种子化。
3. 旧码兜底保证业务不断。

### 阶段 B
1. 先对单个应用（如入职流程）开启 `strict`。
2. 关闭该应用 `legacy_fallback_enabled`。
3. 补齐角色缺失的新权限码。

### 阶段 C
1. 扩展到 HR 全流程应用。
2. 建立审计看板（拒绝原因、角色命中率、迁移失败率）。

### 阶段 D
1. 对成熟域（HR/MMS）全面 strict。
2. 动态应用默认 strict，新建时可临时回落 compat。

## 9. 验收标准（V2）

1. 任意一次流程推进都能追溯到明确规则与权限命中记录。
2. 不再出现“有 edit 就能做所有迁移”的长期隐性越权。
3. 状态字段在表格展示、流程推进、数据库审计三处一致。
4. 严格模式下，未配置迁移规则必须拒绝执行。

## 10. 与当前代码的衔接建议

当前已具备：
1. `workflow.start_workflow_instance` / `workflow.transition_workflow_instance` 权限钩子。
2. `v_permission_ontology` 语义视图。
3. `workflow/status_transition` 权限码体系。

下一步最小改动：
1. 先补策略表与迁移规则表。
2. 在 RPC 中读取策略表决定 `compat`/`strict` 分支。
3. 前端流程页增加“当前策略模式”只读显示，便于测试。

---

本文件与以下文档配套：
1. `docs/EISCORE_MINIMAL_ONTOLOGY_V1.md`
2. `docs/STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`
3. `docs/LIGHTWEIGHT_ONTOLOGY_ROLLOUT.md`
