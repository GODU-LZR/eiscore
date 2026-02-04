# 反复问题汇总与处理方式

更新时间：2026-02-01

## 1) 应用表格列权限初次进入出现重复
**现象**：首次进入“应用表格列权限”时，列列表重复；切换筛选后恢复正常。

**根因**：首次加载时允许字段列表尚未准备好，接口未加列过滤导致全量字段回显。

**处理方式**：
- 允许字段准备完成后再刷新列表。
- 在允许字段为空时直接返回空结果，避免初次全量加载。

相关实现：
- [eiscore-hr/src/views/HrAclView.vue](eiscore-hr/src/views/HrAclView.vue)


## 2) 表格列权限出现“???”或无效列（含已丢弃列）
**现象**：列列表出现“???”，或显示已丢弃字段（如编号、重量、入库日期）。

**根因**：
- 物料模块字段来源混入 FIELD_LABELS/v_field_labels 的历史字段。
- ensure_field_acl 在补齐时把历史字段加入 sys_field_acl。

**处理方式**：
- 物料模块仅使用白名单字段 + 当前配置列进行权限补齐与展示。
- 列中文映射按允许字段过滤，忽略异常或占位文案。

相关实现：
- [eiscore-hr/src/views/HrAclView.vue](eiscore-hr/src/views/HrAclView.vue)
- [eiscore-hr/src/utils/field-labels.js](eiscore-hr/src/utils/field-labels.js)


## 3) “可见”列样式显示成锁定条纹
**现象**：权限管理里的“可见”列显示为锁定条纹样式（应为灰底样式）。

**根因**：权限管理表格不需要列锁功能，但列锁状态被恢复，触发锁定条纹样式。

**处理方式**：
- 在权限管理相关表格中禁用列锁。

相关实现：
- [eiscore-hr/src/views/HrAclView.vue](eiscore-hr/src/views/HrAclView.vue)
- [eiscore-hr/src/components/eis-data-grid-v2/index.vue](eiscore-hr/src/components/eis-data-grid-v2/index.vue)
- [eiscore-hr/src/components/eis-data-grid-v2/composables/useGridCore.js](eiscore-hr/src/components/eis-data-grid-v2/composables/useGridCore.js)
- [eiscore-hr/src/components/eis-data-grid-v2/composables/useGridFormula.js](eiscore-hr/src/components/eis-data-grid-v2/composables/useGridFormula.js)


## 4) 工作助手图表回复出现很矮的小条
**现象**：含图表回复时，气泡内出现多余的很矮小条。

**根因**：空的图表占位节点被渲染进消息内容。

**处理方式**：
- 隐藏空的图表占位节点。

相关实现：
- [eiscore-base/src/components/AiCopilot.vue](eiscore-base/src/components/AiCopilot.vue)


## 5) 快速排查清单
1. 先确认当前模块的字段来源是否只包含“允许字段”。
2. 检查权限页面是否禁用了列锁功能。
3. 若列表仍异常，确认是否有历史配置残留（system_configs / v_field_labels）。
4. 若图表回复异常，检查图表节点是否为空。
