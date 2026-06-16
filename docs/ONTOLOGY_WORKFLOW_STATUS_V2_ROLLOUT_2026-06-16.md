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

3. 本体覆盖补丁：`sql/patch_ontology_semantic_coverage_v2.sql`
   - 补齐新增业务表单的表级语义：销售、采购、单据流转、SOP 学习、数字孪生数据表。
   - 补齐 V2 工作流策略表、迁移规则表、任务审批表的语义。
   - 新增 `public.v_app_form_ontology`，把 `app_center.apps` 中的业务表单/流程应用投影为一等语义实体。
   - 新增 `public.v_role_ontology`，把每个角色、授权集合和数据范围投影为一等语义实体。
   - 新增 `public.v_role_permission_ontology`，显式表达角色到权限的 `acl:grantsPermission` 关系。
   - 新增 `public.v_ontology_coverage_audit`，通过 API 返回关系对象、字段、业务表单、角色、权限的本体覆盖率审计结果。
   - 对 API schema 下的表和视图做表级语义兜底，对已激活本体对象做字段级语义兜底，并授权 `web_user` 通过 PostgREST 读取。

4. 知识图谱推理引擎 V1：`sql/patch_ontology_reasoning_engine_v1.sql`
   - 新增 `public.ontology_inference_rules`，保存可启停的推理规则。
   - 新增 `public.ontology_inferred_facts`，保存推理刷新生成的知识图谱事实边。
   - 新增 `public.ontology_reasoning_runs`，记录推理刷新批次、状态、深度和事实数量。
   - 新增 `public.refresh_ontology_inferences(depth)`，按规则刷新推理事实；该函数只写推理表，不写业务表。
   - 新增 `public.v_ontology_reasoning_facts`、`public.v_ontology_reasoning_edges`、`public.v_ontology_reasoning_summary`，用于读取推理事实、图边和摘要。
   - 新增 `public.explain_ontology_path(...)`，用于解释一个语义主体到目标对象之间的推理路径。
   - 当前内置规则覆盖：表/字段语义种子、表间关系种子、应用表单到业务表、角色到权限、角色可访问应用、角色可访问/操作业务表、流程迁移授权、敏感字段可达性、表间传递依赖闭包。
   - 安全边界：不修改业务表、不修改 RLS、不改变工作流执行函数、不改变 ACL 裁决；推理刷新是旁路批处理，业务请求不会自动触发。

5. 本体关系工作台推理入口：`eiscore-apps/src/views/OntologyWorkbench.vue`
   - 新增“知识图谱推理”面板，展示事实总数、推理事实、角色-应用、角色-业务表、敏感可达、传递依赖等摘要。
   - 支持读取/刷新推理事实，事实表默认优先展示推理生成事实，再展示种子事实。
   - 支持按谓词和关键词筛选推理事实，便于查看 `acl:canAccessApp`、`acl:canAccessTable`、`risk:canAccessSensitiveColumn` 等边。
   - 支持从角色/表/应用/权限出发调用 `public.explain_ontology_path(...)` 做路径解释。
   - 新增“推理洞察”面板，读取 `v_ontology_reasoning_health`、角色风险、表影响、规则统计和敏感路径视图。
   - 支持从角色编码调用 `public.explain_role_ontology_access(...)`，展示角色到应用、业务表、应用动作、敏感字段的可解释链路。
   - 开发态基座验证入口：`http://127.0.0.1:8080/apps/ontology-relations/8abc144b-edf0-424a-bdb0-4fbe4c09ddb6`。
   - 修复子应用独立预览时 qiankun dev 生命周期误注册导致的 `window.proxy.vitemount` 噪音。

6. 推理洞察层：`sql/patch_ontology_reasoning_insights_v1.sql`
   - 新增 `public.v_ontology_reasoning_rule_stats`，按规则统计事实数量、推理事实、谓词集合和最近运行状态。
   - 新增 `public.v_ontology_role_access_insights`，按角色聚合可访问应用、业务表、可操作表和敏感字段暴露。
   - 新增 `public.v_ontology_sensitive_access_paths`，展开角色到敏感字段的可达路径和证据。
   - 新增 `public.v_ontology_table_dependency_paths` 与 `public.v_ontology_table_impact_insights`，用于表依赖路径和表影响面分析。
   - 新增 `public.v_ontology_reasoning_health`，合并推理运行状态与语义覆盖审计，输出 `is_healthy/health_code`。
   - 新增 `public.explain_role_ontology_access(...)`，提供角色中心的只读访问解释。
   - 洞察视图本身已纳入本体语义覆盖；API 运行态审计为关系 `133/133`、字段 `1692/1692`、缺口 0；数据库管理员全量审计为字段 `1721/1721`、缺口 0。

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

本体覆盖补丁：

```bash
cat sql/patch_ontology_semantic_coverage_v2.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

PowerShell UTF-8 安全方式：

```powershell
Get-Content sql/patch_ontology_semantic_coverage_v2.sql -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

知识图谱推理引擎补丁：

```bash
cat sql/patch_ontology_reasoning_engine_v1.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

PowerShell UTF-8 安全方式：

```powershell
Get-Content sql/patch_ontology_reasoning_engine_v1.sql -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

知识图谱推理洞察补丁：

```bash
cat sql/patch_ontology_reasoning_insights_v1.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

PowerShell UTF-8 安全方式：

```powershell
Get-Content sql/patch_ontology_reasoning_insights_v1.sql -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

手动刷新推理事实：

```sql
SELECT * FROM public.refresh_ontology_inferences(4);
```

当前本地推理摘要：

| 指标 | 数值 |
|---|---:|
| `facts_total` | 5004 |
| `inferred_facts` | 658 |
| `active_rules` | 16 |
| `role_app_access_facts` | 27 |
| `sensitive_exposure_facts` | 18 |
| `reasoning_health` | healthy |

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
4. 在链路前置检查中读取 `public.v_role_permissions`，确保 strict 就绪检查所需的角色授权视图对运行账号可读。
5. 在链路前置检查中读取 `public.v_app_form_ontology` 和 `public.v_role_ontology`，确保新增业务表单与角色实体已经进入本体语义投影。
6. 在链路前置检查中读取 `public.v_ontology_coverage_audit`，确保 API 关系对象、字段、业务表单、角色、权限的语义覆盖缺口均为 0。
7. 在链路前置检查中读取 `public.v_ontology_reasoning_summary` 和 `public.v_ontology_reasoning_facts`，确保推理引擎已经生成种子事实与推理事实，且角色访问应用、角色访问业务表、传递依赖等规则可读。
8. 在链路前置检查中读取 `public.v_ontology_reasoning_health`、`public.v_ontology_role_access_insights` 与 `public.v_ontology_table_impact_insights`，确保洞察层健康、角色风险面和表影响面可读。
9. 在链路前置检查中调用 `public.explain_role_ontology_access(...)`，确保角色中心的敏感字段路径和表访问路径可解释。
