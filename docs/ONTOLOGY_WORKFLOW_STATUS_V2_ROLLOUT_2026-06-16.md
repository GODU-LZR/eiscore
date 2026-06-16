# EISCore 本体/流程/状态权限 V2 推进记录

日期：2026-06-16

## 本次推进范围

本次先落地 V2 的最小可运行闭环，目标是让流程权限从“固定 compat 兜底”升级为“按应用策略裁决”，同时保持默认行为不破坏现有流程。

## 已新增内容

1. SQL 补丁：`sql/patch_workflow_policy_v2.sql`
   - 新增 `app_center.workflow_permission_policies`
   - 新增 `app_center.workflow_transition_rules`
   - 扩展 `app_center.workflow_state_mappings.from_state`
   - 扩展 `app_center.workflow_state_mappings.mapping_mode`
   - 新增 `workflow.resolve_workflow_permission_policy(...)`
   - 新增 `workflow.resolve_transition_rule(...)`
   - 重定义 `workflow.check_state_transition_permission(...)`
   - 重定义 `workflow.start_workflow_instance(...)`
   - 重定义 `workflow.transition_workflow_instance(...)`
   - 授权 `web_user` 读取 `public.v_role_permissions`，支撑 strict 就绪检查中的角色授权缺口分析。

2. 前端配置入口：`eiscore-apps/src/views/AppRuntime.vue`
   - 流程配置页签展示当前 V2 策略。
   - 展示 `compat/strict`、权限域、任务分派、流程权限、状态迁移、旧码兜底状态。
   - 支持编辑并保存单应用 V2 策略。
   - 支持新增、编辑、停用、启用、删除显式迁移规则。
   - 支持按 BPMN 连线和状态映射一键生成显式迁移规则，便于从 `compat` 迁移到 `strict`。
   - 支持 strict 就绪检查，展示缺失迁移规则、缺失权限定义与候选角色授权缺口。
   - 支持从就绪检查结果补齐缺失的 `workflow_transition_rules`，并重新启用同名停用规则。
   - 支持从就绪检查结果补齐缺失的 `permissions` 定义；该动作不会写入 `role_permissions`。
   - 支持从就绪检查结果补齐候选角色缺失的 `role_permissions` 授权关系；该动作只覆盖当前报告中的角色与权限码。
   - 支持在就绪检查通过后显式切换 strict：启用任务分派、流程操作、状态迁移校验，并关闭旧码兜底。
   - 若后端尚未应用 V2 SQL 补丁，前端回落显示默认 `compat`，不阻断流程运行。

## 默认策略

默认策略保持旧行为：

| 字段 | 默认值 |
|---|---|
| `permission_mode` | `compat` |
| `enforce_assignment` | `true` |
| `enforce_workflow_op_perm` | `true` |
| `enforce_status_transition_perm` | `true` |
| `legacy_fallback_enabled` | `true` |

这意味着应用补丁后，旧角色仍可依赖 `create/edit` 兜底，不会被突然切断。

## strict 行为

当单个应用策略切到 `permission_mode='strict'` 且关闭 `legacy_fallback_enabled` 后：

1. 流程发起必须命中 `op:{aclModule}.workflow_start`。
2. 流程推进必须命中 `op:{aclModule}.workflow_transition` 或完成时的 `workflow_complete`。
3. 状态迁移必须配置显式规则，否则拒绝推进。
4. 状态迁移必须命中 `required_permission`，或按 `from_state -> to_state` 推导出的 `status_transition` 权限。

## 执行命令

```bash
cat sql/patch_workflow_policy_v2.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

PowerShell UTF-8 安全方式：

```powershell
Get-Content sql/patch_workflow_policy_v2.sql -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

## 后续建议

1. 先在一个低风险流程应用插入 `workflow_transition_rules`，保持 `compat` 验证事件日志。
2. 给目标角色补齐 `workflow_*` 与 `status_transition.*` 权限。
3. 再把该应用策略切到 `strict`，关闭 `legacy_fallback_enabled`。
4. 执行 `test:business-chain` 和 UI 业务链路测试，确认状态写回与权限拒绝都可追溯。

在流程配置页签中，可先使用“生成规则”从现有 BPMN 连线和状态映射批量生成 `workflow_transition_rules`；系统会跳过已存在的同名规则，并重新启用已停用的同名规则。中文状态会生成稳定的 ASCII `required_permission`，便于后续给角色授予精确权限。

切换 `strict` 前，先执行“就绪检查”。该检查本身只读，不会修改数据库；它会汇总当前应用还缺少的显式迁移规则、`permissions` 定义，以及任务候选角色在 `v_role_permissions` 中缺少的授权码。若缺显式迁移规则，可在检查结果里点击“补齐迁移规则”写入 `app_center.workflow_transition_rules`，并重新启用同名停用规则。若只缺 `permissions` 定义，可点击“补齐权限定义”批量 upsert 到 `public.permissions`。权限定义齐备后，可再点击“补齐角色授权”写入 `public.role_permissions`；该动作只给当前报告中的候选角色补齐当前报告中的缺失权限，不会创建角色、不会创建权限定义。所有缺口清零后，“切换 strict”会把该流程应用策略写为 `permission_mode='strict'`、`legacy_fallback_enabled=false`，并启用任务分派、流程操作、状态迁移三类校验。

## 回归覆盖

本机 Docker 栈可用以下命令回归：

```bash
EISCORE_CHAIN_BASE_URL=http://localhost npm run test:business-chain
```

该回归现在会额外覆盖一条 V2 strict 链路：

1. 流程启动后切换测试应用策略为 `strict` 且关闭旧码兜底。
2. 在没有显式 `workflow_transition_rules` 时尝试 `Task_Review -> Task_Done`，预期返回 403，业务状态保持 `FLOW_REVIEW`。
3. 插入显式状态迁移规则后再次推进，预期迁移成功并写回 `FLOW_DONE`。
