# EISCore 状态-权限-流程整合矩阵（v1）

文档版本：v1.0  
整理日期：2026-02-16  
适用范围：HR、MMS、应用中心动态表格应用（统一 DataGrid + Workflow Runtime）

## 1. 目标

本规范用于统一三件事：
1. 状态：业务状态的唯一真值与迁移规则。
2. 权限：谁可以做哪种状态迁移。
3. 工作流：流程节点推进如何驱动业务状态变化。

核心原则：
1. 业务状态只认一个真值源。
2. 状态迁移必须显式授权（`op:xxx.status_transition.<from>_<to>`）。
3. 工作流推进与状态迁移必须同时通过，不能单独放行。

## 2. 状态模型与真值源

### 2.1 状态分类

| 类型 | 字段/来源 | 示例值 | 说明 |
|---|---|---|---|
| 业务状态 | 业务表 `status`（主真值） | `created` / `active` / `locked` | 影响记录生命周期与可编辑性 |
| 兼容状态 | `properties.status`（兼容） | `created` / `active` / `locked` | 历史兼容字段，逐步弱化为镜像 |
| 流程实例状态 | `workflow.instances.status` | `ACTIVE` / `COMPLETED` | 反映流程是否结束，不直接替代业务状态 |
| 流程任务位点 | `workflow.instances.current_task_id` | `Task_HRReview` | 反映当前节点，决定可执行人 |

### 2.2 业务状态标准值

| 标准值 | 中文语义 | 默认行为 |
|---|---|---|
| `created` | 创建/草稿 | 可编辑，可发起流程 |
| `active` | 生效/正式 | 默认只读，可按白名单字段维护 |
| `locked` | 锁定/封存 | 全只读，仅特权可解锁 |

### 2.3 历史值兼容映射

| 历史值 | 规范值 |
|---|---|
| `draft` | `created` |
| `disabled` | `locked` |

## 3. 裁决链（必须按顺序执行）

最终放行条件：所有层都通过。

| 顺序 | 校验层 | 规则 | 失败结果 |
|---|---|---|---|
| 1 | 记录硬锁 | 当前记录为 `locked` 时，除解锁迁移外拒绝编辑 | 只读/拒绝 |
| 2 | 流程任务分派 | 当前节点必须命中 `workflow.task_assignments`（角色/用户） | 拒绝推进 |
| 3 | 状态迁移权限 | 必须具备 `op:xxx.status_transition.<from>_<to>` | 拒绝迁移 |
| 4 | 操作权限 | 必须具备 `op:xxx.edit` / `op:xxx.workflow_*` | 拒绝操作 |
| 5 | 字段权限 | `sys_field_acl` 的 `can_view/can_edit` 生效 | 隐藏或只读 |
| 6 | 数据层策略 | RLS/RPC 规则最终兜底 | 403/42501 |

## 4. 状态迁移权限矩阵（核心）

命名规则：`op:xxx.status_transition.<from>_<to>`  
`xxx` 建议取应用权限键，如 `hr_employee`、`hr_change`、`mms_ledger`、`app_<id>`。

| From | To | 迁移语义 | 必需权限码 | 典型触发方式 | 默认角色建议 |
|---|---|---|---|---|---|
| `created` | `active` | 审批通过生效 | `op:xxx.status_transition.created_active` | 流程终审通过/人工确认 | 人事管理员、业务主管 |
| `created` | `locked` | 草稿作废/封存 | `op:xxx.status_transition.created_locked` | 取消流程/作废动作 | 管理员 |
| `active` | `locked` | 生效后封存 | `op:xxx.status_transition.active_locked` | 下线/归档 | 管理员 |
| `active` | `created` | 生效回退草稿 | `op:xxx.status_transition.active_created` | 驳回或回退 | 审批负责人 |
| `locked` | `active` | 解锁恢复生效 | `op:xxx.status_transition.locked_active` | 纠错恢复 | 超级管理员、授权管理员 |
| `locked` | `created` | 解锁回草稿 | `op:xxx.status_transition.locked_created` | 重做流程 | 超级管理员 |

未出现在矩阵中的迁移：默认禁止。

## 5. 工作流与状态绑定矩阵（入职流程示例）

示例流程：提交资料 -> HR 初审 -> 部门确认 -> 建档开通 -> 完成。

| BPMN 节点 | 执行角色来源 | 必需操作权限 | 建议状态迁移 | 结果 |
|---|---|---|---|---|
| `Task_SubmitProfile` | `candidate_roles=['employee']` | `op:xxx.workflow_start` | 无（保持 `created`） | 进入 HR 初审 |
| `Task_HRReview` | `candidate_roles=['hr_clerk']` | `op:xxx.workflow_transition` | 拒绝时 `active->created` 或 `created->created` | 进入部门确认或回退 |
| `Task_ManagerReview` | `candidate_roles=['dept_manager']` | `op:xxx.workflow_transition` | 通过后保持 `created` | 进入建档开通 |
| `Task_AccountProvision` | `candidate_roles=['hr_admin']` | `op:xxx.workflow_complete` | `created->active` | 实例完成 |
| 归档动作 | 管理员角色 | `op:xxx.status_transition.active_locked` | `active->locked` | 封存 |

补充：
1. 节点可执行人由 `workflow.task_assignments` 控制。
2. 节点推进成功后，业务状态写回由 `app_center.workflow_state_mappings` 控制。

## 6. 配置落点与责任矩阵

| 能力 | 配置表/位置 | 当前实现基础 | 责任角色 |
|---|---|---|---|
| 权限点定义 | `public.permissions` | 已有 module/app/op 体系 | 架构/后端 |
| 角色绑定权限 | `public.role_permissions`、`public.user_roles` | 已落地 | 管理员 |
| 字段可见编辑 | `public.sys_field_acl` | 已落地 | 权限管理员 |
| 流程任务分派 | `workflow.task_assignments` | 已落地 | 流程管理员 |
| 节点到状态映射 | `app_center.workflow_state_mappings` | 已落地 | 流程管理员 |
| 流程推进执行 | `workflow.start_workflow_instance` / `workflow.transition_workflow_instance` | 已落地 | 后端/RPC |

## 7. 权限种子建议（可直接落库）

以下以 `xxx=hr_employee` 为例：

| 权限码 | 用途 |
|---|---|
| `op:hr_employee.workflow_start` | 发起流程 |
| `op:hr_employee.workflow_transition` | 推进任务 |
| `op:hr_employee.workflow_complete` | 完成流程 |
| `op:hr_employee.status_transition.created_active` | 草稿生效 |
| `op:hr_employee.status_transition.created_locked` | 草稿封存 |
| `op:hr_employee.status_transition.active_locked` | 生效封存 |
| `op:hr_employee.status_transition.active_created` | 生效回退 |
| `op:hr_employee.status_transition.locked_active` | 解锁生效 |
| `op:hr_employee.status_transition.locked_created` | 解锁回草稿 |

其他应用按同样模板替换 `xxx`。

## 8. 验收测试矩阵（最小集）

| 场景 | 前置状态 | 操作角色 | 预期 |
|---|---|---|---|
| 无迁移权限尝试迁移 | `created` | 普通查看角色 | 被拒绝（403/提示无权限） |
| 有迁移权限但非任务执行人 | `created` + 流程中 | 非候选角色 | 被拒绝（任务未分配） |
| 任务执行人且有迁移权限 | `created` + 流程中 | 候选角色 | 迁移成功并记录审计 |
| `active` 记录编辑受限 | `active` | 普通编辑角色 | 非白名单字段只读 |
| `locked` 记录保护 | `locked` | 非解锁权限角色 | 全只读 |
| 管理员解锁 | `locked` | 管理员 | `locked->active` 成功 |

## 9. 结论

该模型将“谁能推进流程”与“谁能改业务状态”拆成两道闸门，再叠加字段权限与数据层策略，能避免：
1. 流程推进成功但状态未授权。
2. 有编辑权限却绕过流程乱改状态。
3. 前端可点、后端拒绝导致体验不一致。

推荐作为后续所有流程应用与表格应用的统一基线。

