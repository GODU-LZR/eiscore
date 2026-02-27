# EISCore 轻量本体落地说明（兼容旧权限码）

整理日期：2026-02-16  
适用范围：`module/app/op` 既有权限体系 + Workflow Runtime

## 1. 落地目标

本次落地采用“只增不改”的方式：
1. 保留现有权限码与角色权限关系，不做破坏性重构。
2. 新增“状态-权限-流程”语义层，支持后续细粒度治理。
3. Workflow RPC 接入兼容校验：优先新码，旧码兜底。

## 2. 已落地内容

对应补丁文件：`sql/patch_lightweight_ontology_runtime.sql`

包含四类能力：
1. 语义视图：`public.v_permission_ontology`
2. 权限种子函数：`public.seed_workflow_status_permissions(text[])`
3. Workflow 权限辅助函数：
   - `workflow.claim_permissions(jsonb)`
   - `workflow.claim_has_permission(jsonb, text)`
   - `workflow.claim_has_any_permission(jsonb, text[])`
   - `workflow.resolve_app_acl_key(int)`
   - `workflow.resolve_mapped_state_value(int, text)`
   - `workflow.check_state_transition_permission(...)`
4. RPC 权限接入（兼容模式）：
   - `workflow.start_workflow_instance(...)`
   - `workflow.transition_workflow_instance(...)`

## 3. 兼容策略

### 3.1 流程发起权限

优先新码：`op:{appKey}.workflow_start`  
回退旧码：`op:{appKey}.create`

### 3.2 流程推进权限

推进中优先新码：`op:{appKey}.workflow_transition`  
完成时优先新码：`op:{appKey}.workflow_complete`  
回退旧码：`op:{appKey}.edit`

### 3.3 状态迁移权限

优先新码：`op:{appKey}.status_transition.{from}_{to}`  
回退旧码：`op:{appKey}.edit`

说明：
1. 若任务未配置状态映射（`workflow_state_mappings`），不强制状态迁移码。
2. 若流程定义未绑定应用（`workflow.definitions.app_id` 为空），不强制应用权限码。

## 4. 执行步骤

### 4.1 执行补丁

```bash
cat sql/patch_lightweight_ontology_runtime.sql | docker exec -i eiscore-db psql -U postgres -d eiscore
```

PowerShell（UTF-8 安全）：

```powershell
Get-Content sql/patch_lightweight_ontology_runtime.sql -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

执行规范：
1. 统一遵守 `docs/SQL_PATCH_UTF8_EXECUTION_STANDARD.md`。
2. 含中文语义文本的补丁执行后，必须跑乱码校验 SQL。

### 4.2 验证语义视图

```sql
select code, scope, semantic_kind, entity_key, action_key, transition_from, transition_to
from public.v_permission_ontology
where code like 'op:%'
order by code
limit 30;
```

### 4.3 验证新权限已生成

```sql
select code
from public.permissions
where code like 'op:%workflow_%'
   or code like 'op:%.status_transition.%'
order by code;
```

### 4.4 验证 super_admin 已拿到新权限

```sql
select r.code as role_code, p.code as permission_code
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
where r.code = 'super_admin'
  and (p.code like 'op:%workflow_%' or p.code like 'op:%.status_transition.%')
order by p.code;
```

## 5. 与前端协同

前端错误提示已支持透传后端自定义权限错误关键字（流程发起/推进/状态迁移）。
对应文件：`eiscore-apps/src/views/AppRuntime.vue`

## 6. 后续建议

1. 先按兼容模式跑一轮角色测试，确认老角色不受影响。
2. 再逐角色补齐新权限码，逐步从“旧码兜底”切到“新码强校验”。
3. 若要严格状态迁移，建议在 `workflow_state_mappings` 增补 `from_state` 字段，减少隐式推断。
