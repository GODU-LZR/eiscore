# EISCore 最小本体词汇表（v1）

文档版本：v1.0  
整理日期：2026-02-16  
适用范围：EISCore 全域（Base/HR/MMS/应用中心/工作流）

## 1. 定位与边界

本文件采用“轻本体”策略，不替换现有 PostgreSQL 表结构，只做统一语义层。

目标：
1. 统一术语：避免同义不同名、同名不同义。
2. 统一关系：明确“谁-对什么-可做什么”。
3. 统一规则：支撑状态、权限、流程协同与 AI 生成约束。

非目标：
1. 当前阶段不引入重型 RDF 三元组存储。
2. 当前阶段不要求 OWL 完整推理引擎。

## 2. 命名空间与标识

建议命名空间：
1. `eiscore:` 基础业务概念。
2. `acl:` 权限概念。
3. `wf:` 工作流概念。
4. `org:` 组织概念。
5. `data:` 数据记录与状态概念。

标识建议：
1. 类（Class）：`eiscore:User`、`wf:WorkflowInstance`。
2. 关系（Object Property）：`acl:hasRole`、`wf:instanceOf`。
3. 属性（Data Property）：`eiscore:code`、`data:statusValue`。

## 3. 核心类词汇（Class Vocabulary）

| 类标识 | 中文名 | 语义说明 | 对应表（当前） |
|---|---|---|---|
| `eiscore:User` | 用户 | 系统登录主体 | `public.users` |
| `acl:Role` | 角色 | 权责集合 | `public.roles` |
| `acl:Permission` | 权限点 | 模块/应用/操作/迁移权限编码 | `public.permissions` |
| `eiscore:Application` | 应用 | 可被访问的业务应用 | `app_center.apps` |
| `org:Department` | 部门 | 组织单元 | `public.departments` |
| `data:BusinessRecord` | 业务记录 | 业务实体行（人事档案、库存草稿等） | `hr.archives`、`scm.inventory_drafts`、`app_data.*` |
| `data:BusinessStatus` | 业务状态 | 记录生命周期状态 | 各业务表 `status` |
| `wf:WorkflowDefinition` | 流程定义 | BPMN 定义版本 | `workflow.definitions` |
| `wf:WorkflowInstance` | 流程实例 | 运行中的流程对象 | `workflow.instances` |
| `wf:TaskAssignment` | 任务分派 | 节点可执行主体定义 | `workflow.task_assignments` |
| `wf:StateMapping` | 节点状态映射 | 节点到业务字段值映射 | `app_center.workflow_state_mappings` |
| `acl:FieldAclRule` | 字段权限规则 | 字段可见/可编辑约束 | `public.sys_field_acl` |

## 4. 关系词汇（Object Property Vocabulary）

| 关系标识 | 主体 -> 客体 | 语义说明 | 对应落点 |
|---|---|---|---|
| `acl:hasRole` | `User -> Role` | 用户拥有角色 | `public.user_roles` |
| `acl:grantsPermission` | `Role -> Permission` | 角色授予权限点 | `public.role_permissions` |
| `eiscore:ownsRecord` | `Department -> BusinessRecord` | 部门拥有记录（按数据范围） | `dept_id`/数据范围策略 |
| `data:hasStatus` | `BusinessRecord -> BusinessStatus` | 记录当前业务状态 | `status`（主） |
| `wf:instanceOf` | `WorkflowInstance -> WorkflowDefinition` | 实例属于定义 | `workflow.instances.definition_id` |
| `wf:hasCurrentTask` | `WorkflowInstance -> TaskNode` | 当前任务节点 | `workflow.instances.current_task_id` |
| `wf:assignedRole` | `TaskAssignment -> Role` | 节点候选角色 | `candidate_roles[]` |
| `wf:assignedUser` | `TaskAssignment -> User` | 节点候选用户 | `candidate_users[]` |
| `wf:mapsToStatus` | `StateMapping -> BusinessStatus` | 节点映射到目标状态值 | `state_field/state_value` |
| `acl:fieldRuleForRole` | `FieldAclRule -> Role` | 字段规则关联角色 | `role_id` |
| `acl:fieldRuleForModule` | `FieldAclRule -> Module` | 字段规则关联模块 | `module` |
| `acl:allowsTransition` | `Role -> StatusTransition` | 角色允许状态迁移 | `op:xxx.status_transition.*` |

注：
1. `TaskNode` 和 `StatusTransition` 可先作为受控值对象（字符串/代码），后续再实体化。

## 5. 数据属性词汇（Data Property Vocabulary）

| 属性标识 | 适用类 | 说明 | 示例 |
|---|---|---|---|
| `eiscore:id` | 全部 | 主键标识 | `811`、`dbfc12ce-...` |
| `eiscore:code` | `Role/Permission/Application` | 业务编码 | `hr_employee`、`op:hr_employee.edit` |
| `eiscore:name` | 全部 | 展示名称 | `人事花名册` |
| `eiscore:username` | `User` | 用户名 | `admin` |
| `data:statusValue` | `BusinessStatus` | 状态枚举值 | `created` |
| `wf:taskId` | `TaskAssignment/WorkflowInstance` | BPMN 节点 ID | `Task_HRReview` |
| `wf:businessKey` | `WorkflowInstance` | 业务键 | `EMP20260001` |
| `wf:instanceStatus` | `WorkflowInstance` | 实例状态 | `ACTIVE`、`COMPLETED` |
| `acl:canView` | `FieldAclRule` | 字段可见 | `true/false` |
| `acl:canEdit` | `FieldAclRule` | 字段可编辑 | `true/false` |

## 6. 受控词表（Controlled Vocabularies）

### 6.1 业务状态词表

| 规范值 | 语义 |
|---|---|
| `created` | 草稿/待处理 |
| `active` | 生效/正式 |
| `locked` | 锁定/封存 |

兼容映射：
1. `draft -> created`
2. `disabled -> locked`

### 6.2 流程实例状态词表

| 值 | 语义 |
|---|---|
| `ACTIVE` | 实例进行中 |
| `COMPLETED` | 实例已完成 |

### 6.3 权限编码词表

| 类型 | 编码模式 |
|---|---|
| 模块权限 | `module:{moduleKey}` |
| 应用权限 | `app:{appKey}` |
| 操作权限 | `op:{appKey}.{actionKey}` |
| 状态迁移权限 | `op:{appKey}.status_transition.{from}_{to}` |

## 7. 规则词汇（Rule Vocabulary）

用于约束执行的最小规则：

| 规则ID | 规则描述 |
|---|---|
| `R1` | 若记录 `status=locked`，则除解锁迁移外拒绝编辑。 |
| `R2` | 用户推进流程任务前，必须满足 `wf:assignedRole/assignedUser`。 |
| `R3` | 状态迁移必须命中 `acl:allowsTransition`（`op:xxx.status_transition.from_to`）。 |
| `R4` | 流程节点推进后，若存在 `wf:StateMapping`，则写回目标业务表 `state_field=state_value`。 |
| `R5` | 字段展示与编辑受 `acl:FieldAclRule` 约束（不可见遮蔽、可见不可编辑只读）。 |

## 8. 本体到现有库的映射矩阵（最小落地）

| 本体对象 | 关系/属性 | 数据库落点 |
|---|---|---|
| `User` | `hasRole` | `public.user_roles(user_id, role_id)` |
| `Role` | `grantsPermission` | `public.role_permissions(role_id, permission_id)` |
| `Permission` | `code/name` | `public.permissions(code, name)` |
| `BusinessRecord` | `hasStatus` | 业务表 `status`（如 `hr.archives.status`、`scm.inventory_drafts.status`） |
| `WorkflowInstance` | `instanceOf` | `workflow.instances.definition_id` |
| `WorkflowInstance` | `hasCurrentTask` | `workflow.instances.current_task_id` |
| `TaskAssignment` | `assignedRole/assignedUser` | `workflow.task_assignments(candidate_roles, candidate_users)` |
| `StateMapping` | `mapsToStatus` | `app_center.workflow_state_mappings(state_field, state_value)` |
| `FieldAclRule` | `canView/canEdit` | `public.sys_field_acl(can_view, can_edit)` |

## 9. 与 AI 生成链路的结合建议

建议将本词汇表作为 AI 提示约束：
1. 生成字段时优先对齐 `BusinessStatus` 词表。
2. 生成权限时必须输出标准编码模式。
3. 生成流程映射时必须包含 `task_id -> state_field/state_value`。

生成结果验收基线：
1. 不允许出现未定义状态值。
2. 不允许出现非标准权限码。
3. 不允许流程节点无分派、无状态映射（除明确说明无需映射）。

## 10. 治理与版本化

治理建议：
1. 架构负责人维护本体词汇主版本。
2. 模块负责人维护本模块扩展词汇。
3. 变更必须带兼容策略（旧值映射/迁移脚本/回滚方案）。

版本规则：
1. `v1.x`：增量扩展，保持向后兼容。
2. `v2.0`：发生破坏性变更时升级主版本。

---

本文件作为 EISCore 的语义基线，和下列文档配套使用：
1. `docs/STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`
2. `docs/LEGACY_SPECIFICATIONS_SUMMARY.md`

