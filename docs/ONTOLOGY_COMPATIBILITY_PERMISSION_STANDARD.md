# EISCore 本体兼容落地规范（权限核心不变）

文档版本：v1.0  
整理日期：2026-02-17  
适用范围：全系统（HR/MMS/应用中心/流程应用/动态表格应用）

## 1. 目标与边界

本规范用于在引入本体语义能力时，确保既有权限体系不被破坏。

强约束目标：
1. 本体语义改造必须兼容现有权限系统。
2. 历史权限码、角色绑定、RLS 主链路不得被替换或删除。
3. 允许新增语义能力，但不得以语义层直接覆盖核心鉴权结果。

## 2. 规则来源（已确认基线）

本规范汇总并继承以下文档中的既有规则：
1. `docs/LEGACY_SPECIFICATIONS_SUMMARY.md`
2. `docs/LIGHTWEIGHT_ONTOLOGY_ROLLOUT.md`
3. `docs/STATUS_PERMISSION_WORKFLOW_INTEGRATION_MATRIX.md`
4. `docs/SEMANTICS_MODE_GOVERNANCE_MATRIX.md`
5. `docs/EISCORE_MINIMAL_ONTOLOGY_V1.md`

若本规范与其他新文档冲突，以“保留既有权限规则”优先。

## 3. 不可变条款（禁止破坏）

### 3.1 既有权限模型不可变

沿用四级模型，不得删除既有层级语义：
1. `module:{moduleKey}`
2. `app:{appKey}`
3. `op:{appKey}.{actionKey}`
4. `field:{appKey}.{fieldKey}.{actionKey}`（字段权限语义层）

### 3.2 落库分层不可变

1. `public.permissions`：仅承载 `module/app/op` 权限点。
2. 字段权限继续在 `public.sys_field_acl` 承载，不回灌 `permissions`。
3. 角色绑定继续使用 `public.role_permissions`、`public.user_roles`。

### 3.3 核心鉴权链路不可变

1. 不删除历史权限码，不批量重命名历史 `op` 码。
2. 不绕过或替换现有 RLS/RPC 鉴权分支。
3. 现有模块入口、应用入口、操作权限的放行逻辑保持有效。

### 3.4 模式策略不可变（当前阶段）

1. 全局 `permission_mode=compat`。
2. 禁止未经专项验收直接全局切换 `strict`。
3. `semantics_mode` 可选：`ai_defined`、`creator_defined`、`none`。

## 4. 兼容执行规则（必须保持）

在 `compat` 模式下，流程与状态权限采用“新码优先、旧码兜底”：

1. 流程发起：
   - 优先：`op:{appKey}.workflow_start`
   - 回退：`op:{appKey}.create`
2. 流程推进/完成：
   - 优先：`op:{appKey}.workflow_transition` / `op:{appKey}.workflow_complete`
   - 回退：`op:{appKey}.edit`
3. 状态迁移：
   - 优先：`op:{appKey}.status_transition.{from}_{to}`
   - 回退：`op:{appKey}.edit`

## 5. 本体语义的兼容定位

本体只做“语义增强层”，不替代“权限裁决层”。

允许新增：
1. 语义词汇与关系（表语义名、关系谓词、领域分类）。
2. 本体关系工作台（中文展示、关系分析、影响范围分析）。
3. 语义治理审计（谁定义、何时变更、变更原因）。

禁止新增：
1. 仅凭语义关系直接放行高风险操作。
2. 在未配置兼容回退时强制拦截旧权限链路。

## 6. 变更实施清单（每次发布必查）

1. 历史权限码集合是否保持可用（module/app/op）。
2. `public.permissions` 与 `public.sys_field_acl` 是否仍按分层职责运行。
3. 关键 RPC 是否保留 compat 回退分支。
4. 新增本体能力是否仅影响展示/治理，不替换核心裁决。
5. 角色验收是否覆盖“旧角色不新增授权也可按原路径运行”。

## 7. 回归验证（建议 SQL）

### 7.1 核验历史权限码仍存在

```sql
select code
from public.permissions
where code like 'module:%'
   or code like 'app:%'
   or code like 'op:%'
order by code;
```

### 7.2 核验流程/状态新码已增量存在（不替代旧码）

```sql
select code
from public.permissions
where code like 'op:%workflow_%'
   or code like 'op:%.status_transition.%'
order by code;
```

### 7.3 核验角色绑定未丢失

```sql
select r.code as role_code, p.code as permission_code
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
order by r.code, p.code;
```

## 8. 发布与回滚策略

1. 发布策略：先语义展示，后语义治理，最后才考虑单应用 strict 试点。
2. 回滚策略：任何异常优先回退到 `compat`，不得先删除历史权限点。
3. 事故处置：若出现权限回归，先锁定语义新功能入口，不动旧鉴权主链路。

## 8.1 SQL 执行编码要求（新增）

1. 执行任何含中文语义文本的 SQL 补丁，必须遵守 `docs/SQL_PATCH_UTF8_EXECUTION_STANDARD.md`。
2. PowerShell 环境下必须使用 `Get-Content -Raw -Encoding UTF8 | docker exec ... psql`。
3. 发布后必须执行乱码校验 SQL，确认语义字段中 `?` 计数为 0。

## 9. 结论

EISCore 的本体化应遵循“权限核心稳定、语义能力渐进”的原则：  
本体是增强层，权限是裁决层。  
在兼容模式下推进本体，不会破坏你既有的权限设计核心。
