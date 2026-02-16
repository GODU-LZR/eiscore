# EISCore 语义模式治理矩阵（兼容优先）

文档版本：v1.0  
整理日期：2026-02-16  
适用范围：全量流程应用与表格应用（含动态创建应用）

## 1. 已确认决策

1. 系统默认采用 `permission_mode=compat`（兼容模式）。
2. 语义定义支持三种模式：
   - `ai_defined`
   - `creator_defined`
   - `none`
3. 允许 `none` 模式（非本体运行），用于快速试验或早期建设阶段。

## 2. 两层模式定义

系统建议区分两层开关：

1. 权限执行模式 `permission_mode`
   - `compat`：新权限优先，旧权限兜底。
   - `strict`：仅按新权限与显式迁移规则放行。
2. 语义来源模式 `semantics_mode`
   - `ai_defined`：由 Agent 先生成语义草案，人确认后生效。
   - `creator_defined`：由应用创建者直接定义语义。
   - `none`：不启用本体语义约束，仅保留基础运行。

## 3. 语义模式矩阵

| `semantics_mode` | 语义定义人 | 状态词表 | 流程节点-状态映射 | 状态迁移规则 | 发布门槛 |
|---|---|---|---|---|---|
| `ai_defined` | Agent（草案）+ 人工确认 | 必须有 | 必须有 | 建议有（strict 时必须） | 必须人工确认 |
| `creator_defined` | 应用创建者 | 必须有 | 必须有 | 建议有（strict 时必须） | 创建者确认 |
| `none` | 无 | 可无 | 可无 | 可无 | 可直接发布（建议仅内部） |

## 4. 兼容模式下的执行规则（当前推荐）

当 `permission_mode=compat` 时：

1. 流程发起：
   - 优先检查 `op:{appKey}.workflow_start`
   - 缺失时回退 `op:{appKey}.create`
2. 流程推进/完成：
   - 优先检查 `workflow_transition/workflow_complete`
   - 缺失时回退 `op:{appKey}.edit`
3. 状态迁移：
   - 优先检查 `op:{appKey}.status_transition.{from}_{to}`
   - 缺失时回退 `op:{appKey}.edit`

解释：
1. 兼容模式保证老角色不立刻失效。
2. 新语义逐步补齐后，可单应用切 strict。

## 5. strict 模式启用前置条件

单个应用切换到 `strict` 前，至少满足：

1. 已明确 `semantics_mode`（不能为未配置）。
2. 已配置状态标准值（至少 `created/active/locked` 或定义兼容映射）。
3. 已配置流程节点分派规则（`task_assignments`）。
4. 已配置状态迁移规则（显式 `from -> to`）。
5. 目标角色已授予对应 `status_transition` 权限。
6. 已完成一轮角色验收测试并记录结果。

## 6. 模式选择建议

### 6.1 全局建议（当前阶段）

1. 全局 `permission_mode` 固定为 `compat`。
2. 新建关键业务应用默认 `semantics_mode=ai_defined`，但发布前必须人工确认。
3. 高风险核心应用（HR 入职、库存出入库）优先走 `creator_defined`。
4. `none` 仅用于原型、测试、临时应用，不建议长期运行。

### 6.2 业务成熟后

1. 先按应用逐步切换 `compat -> strict`。
2. 每次只切一个应用，观察 1~2 天再扩展。

## 7. 审计与治理要求

每次语义相关变更，至少记录：

1. 应用 ID / 应用名称
2. 变更前后 `permission_mode`
3. 变更前后 `semantics_mode`
4. 变更操作者
5. 变更时间
6. 变更原因

建议审计事件类型：

1. `SEMANTICS_MODE_CHANGED`
2. `PERMISSION_MODE_CHANGED`
3. `TRANSITION_RULE_CHANGED`
4. `STATE_VOCAB_CHANGED`

## 8. 最小发布检查清单

发布前勾选：

1. 已选定 `semantics_mode`
2. 已确认 `permission_mode`
3. 关键角色可完成主路径流程
4. 非授权角色无法越权推进
5. 状态变化与流程日志一致
6. 错误提示可被业务人员理解

---

本文件与以下文档配套：

1. `docs/EISCORE_MINIMAL_ONTOLOGY_V1.md`
2. `docs/STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`
3. `docs/ONTOLOGY_WORKFLOW_STATUS_V2_BLUEPRINT.md`
