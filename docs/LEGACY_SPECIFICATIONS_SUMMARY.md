# EISCore 旧规范文档汇总（来自子目录）

文档版本：v1.0  
整理日期：2026-02-08  
来源文件：
1. `eiscore-hr/docs/权限点规范.md`
2. `eiscore-hr/docs/表格列权限规范.md`
3. `eiscore-hr/docs/字段命名规范.md`

## 1. 权限体系统一规范（四级模型）

权限按四级划分：
1. `module`：模块入口可见性，如 `module:hr`、`module:mms`。
2. `app`：应用页面可进入性，如 `app:hr_employee`。
3. `op`：应用内操作权限，如 `op:hr_employee.create`。
4. `field`：字段可见/可编辑权限，如 `field:hr_employee.id_card.view`。

编码格式统一为：
1. `module:{moduleKey}`
2. `app:{appKey}`
3. `op:{appKey}.{actionKey}`
4. `field:{appKey}.{fieldKey}.{actionKey}`

动作键（actionKey）建议集合：
`view|create|edit|delete|import|export|config|save_layout|member_manage|shift_manage|shift_create`

## 2. 权限落库与职责分层

`public.permissions` 仅存 `module/app/op` 三类权限点。
- 主鉴权字段是 `code`，`name/module/action` 主要用于展示。

字段级权限单独落在 `public.sys_field_acl`：
- 结构：`(role_id, module, field_code, can_view, can_edit)`
- 规则：
1. `can_view=false`：列隐藏。
2. `can_view=true && can_edit=false`：列只读。

结论：字段权限不应混入 `permissions` 表。

## 3. 表格列权限生效链路（必须闭环）

从配置到生效必须完整经过 4 步：
1. 保存列配置到 `system_configs`。
2. 同步列中文到 `field_label_overrides` 或 `v_field_labels` 来源。
3. 调用 `ensure_field_acl(module, field_codes[])` 补齐字段权限记录。
4. 前端 DataGrid 渲染层读取 `sys_field_acl` 并执行“隐藏/只读”。

缺失任一步，都会出现“权限配置了但界面不生效”。

## 4. 字段命名与中文展示规范

统一规则：
1. 字段代码使用 snake_case 英文，如 `employee_no`。
2. 字段中文必须有来源：
   - 静态表字段：数据库列注释（`comment on column ...`）。
   - 动态列：配置中必须填写 `label`。
3. 权限页面展示中文统一走 `v_field_labels`。
4. 若无中文来源，至少 fallback 到字段代码，不应出现不可识别占位。

## 5. 维护与同步建议

建议通过 SQL/RPC 统一维护：
1. `public.upsert_permissions(payload jsonb)`：批量同步 module/app/op。
2. `public.apply_role_permission_templates()`：套用角色模板。
3. `public.ensure_field_acl(module_name text, field_codes text[])`：补齐字段权限。
4. `public.sync_field_acl_from_config()`：由配置变更触发自动同步。

新增模块/应用时建议最小动作：
1. 增加权限种子。
2. 更新前端应用映射配置。
3. 同步字段权限与字段中文。

## 6. 默认角色模板（建议基线）

1. 超级管理员：全部权限。
2. 人事管理员：HR 全操作权限。
3. 部门主管：部门管理相关权限，敏感字段受限。
4. 员工：入口与查看为主的只读权限。

## 7. 与当前根文档关系

本文件用于承接历史规范沉淀，作为以下文档的补充：
1. `docs/PROJECT_BACKGROUND_AND_POSITIONING.md`（战略与立项层）
2. `docs/DOC_CODE_COMPLETION_REVIEW_2026-02-08.md`（实现对照层）

使用建议：
1. 产品/架构层决策先看背景与对照报告。
2. 权限与字段治理落地细则看本文件。
