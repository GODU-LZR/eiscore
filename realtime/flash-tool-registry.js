// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const REGISTRY_VERSION = 'flash-tools-v2';

const defineTool = (
  tool_id,
  tool_name_zh,
  intent,
  object,
  risk_level,
  confirm_required,
  batch,
  path,
  method,
  accept_profile = '',
  content_profile = ''
) => {
  const api = { path, method };
  if (accept_profile) api.accept_profile = accept_profile;
  if (content_profile) api.content_profile = content_profile;
  return {
    tool_id,
    tool_name_zh,
    intent,
    object,
    risk_level,
    confirm_required,
    batch,
    api
  };
};

const TOOL_REGISTRY = Object.freeze([
  defineTool('flash.app.list', '查询应用列表', 'read_list', 'app_registry', 'low', false, 1, '/apps', 'GET', 'app_center'),
  defineTool('flash.app.detail', '查询应用详情', 'read_detail', 'app_registry', 'low', false, 1, '/apps', 'GET', 'app_center'),
  defineTool('flash.route.resolve', '查询发布路由', 'read_detail', 'published_route', 'low', false, 1, '/published_routes', 'GET', 'app_center'),
  defineTool('flash.data.grid.list', '查询表格列表数据', 'read_list', 'data_table', 'low', false, 1, '/{table}', 'GET'),
  defineTool('flash.data.grid.detail', '查询表格单条详情', 'read_detail', 'data_table', 'low', false, 1, '/{table}', 'GET'),
  defineTool('flash.data.grid.export', '导出表格数据', 'read_export', 'data_table', 'low', false, 1, '/{table}', 'GET'),
  defineTool('flash.workflow.definition.list', '查询流程定义', 'read_list', 'workflow_definition', 'low', false, 1, '/definitions', 'GET', 'workflow'),
  defineTool('flash.workflow.instance.list', '查询流程实例', 'read_list', 'workflow_instance', 'low', false, 1, '/instances', 'GET', 'workflow'),
  defineTool('flash.workflow.event.list', '查询流程日志', 'read_list', 'workflow_event', 'low', false, 1, '/instance_events', 'GET', 'workflow'),
  defineTool('flash.workflow.assignment.list', '查询流程任务分派', 'read_list', 'workflow_task_assignment', 'low', false, 1, '/task_assignments', 'GET', 'workflow'),
  defineTool('flash.workflow.mapping.list', '查询流程状态映射', 'read_list', 'workflow_state_mapping', 'low', false, 1, '/workflow_state_mappings', 'GET', 'app_center'),
  defineTool('flash.inventory.current.list', '查询当前库存', 'read_list', 'inventory_current', 'low', false, 1, '/v_inventory_current', 'GET', 'scm'),
  defineTool('flash.inventory.draft.list', '查询库存草稿', 'read_list', 'inventory_draft', 'low', false, 1, '/v_inventory_drafts', 'GET', 'scm'),
  defineTool('flash.material.master.list', '查询物料主数据', 'read_list', 'material_master', 'low', false, 1, '/raw_materials', 'GET', 'public'),
  defineTool('flash.warehouse.list', '查询仓库列表', 'read_list', 'warehouse', 'low', false, 1, '/warehouses', 'GET', 'scm'),
  defineTool('flash.hr.archive.list', '查询人事档案', 'read_list', 'hr_archive', 'low', false, 1, '/archives', 'GET', 'hr'),
  defineTool('flash.ontology.relation.list', '查询本体关系', 'read_list', 'ontology_relation', 'low', false, 1, '/ontology_table_relations', 'GET', 'app_data'),
  defineTool('flash.ontology.semantic.list', '查询本体语义', 'read_list', 'ontology_semantic', 'low', false, 1, '/ontology_table_semantics', 'GET', 'public'),
  defineTool('flash.app.create', '创建应用', 'create_record', 'app_registry', 'high', true, 2, '/apps', 'POST', 'app_center', 'app_center'),
  defineTool('flash.app.delete', '删除应用', 'delete_record', 'app_registry', 'high', true, 2, '/apps', 'DELETE', 'app_center', 'app_center'),
  defineTool('flash.data.table.ensure', '初始化数据应用表', 'configure_app', 'data_table', 'medium', true, 2, '/rpc/create_data_app_table', 'POST', 'app_center', 'app_center'),
  defineTool('flash.data.grid.create', '新增表格记录', 'create_record', 'data_table', 'medium', true, 2, '/{table}', 'POST'),
  defineTool('flash.data.grid.update', '更新表格记录', 'update_record', 'data_table', 'medium', true, 2, '/{table}', 'PATCH'),
  defineTool('flash.data.grid.delete', '删除表格记录', 'delete_record', 'data_table', 'high', true, 2, '/{table}', 'DELETE'),
  defineTool('flash.workflow.definition.upsert', '写入流程定义', 'configure_app', 'workflow_definition', 'high', true, 2, '/definitions', 'POST/PATCH', 'workflow', 'workflow'),
  defineTool('flash.workflow.assignment.upsert', '写入流程任务分派', 'configure_app', 'workflow_task_assignment', 'high', true, 2, '/task_assignments', 'POST/PATCH', 'workflow', 'workflow'),
  defineTool('flash.workflow.mapping.upsert', '写入流程状态映射', 'configure_app', 'workflow_state_mapping', 'high', true, 2, '/workflow_state_mappings', 'POST', 'app_center', 'app_center'),
  defineTool('flash.workflow.instance.start', '启动流程实例', 'start_workflow', 'workflow_instance', 'high', true, 2, '/rpc/start_workflow_instance', 'POST', 'workflow', 'workflow'),
  defineTool('flash.workflow.instance.transition', '推进流程实例', 'transition_workflow', 'workflow_instance', 'high', true, 2, '/rpc/transition_workflow_instance', 'POST', 'workflow', 'workflow'),
  defineTool('flash.hr.archive.update', '更新人事档案', 'update_record', 'hr_archive', 'medium', true, 2, '/archives', 'PATCH', 'hr', 'hr'),
  defineTool('flash.hr.attendance.init', '初始化考勤记录', 'configure_app', 'hr_attendance_record', 'high', true, 2, '/rpc/init_attendance_records', 'POST', 'hr', 'hr'),
  defineTool('flash.inventory.draft.create', '创建库存草稿', 'create_record', 'inventory_draft', 'medium', true, 2, '/inventory_drafts', 'POST', 'scm', 'scm'),
  defineTool('flash.inventory.batchno.generate', '生成批次号', 'configure_app', 'inventory_draft', 'medium', true, 2, '/rpc/generate_batch_no', 'POST', 'scm', 'scm'),
  defineTool('flash.inventory.stock.in', '执行库存入库', 'update_record', 'inventory_transaction', 'high', true, 2, '/rpc/stock_in', 'POST', 'scm', 'scm'),
  defineTool('flash.inventory.stock.out', '执行库存出库', 'update_record', 'inventory_transaction', 'high', true, 2, '/rpc/stock_out', 'POST', 'scm', 'scm'),
  defineTool('flash.ontology.semantic.enrich', '补全本体语义', 'semantic_enrich', 'ontology_semantic', 'medium', true, 2, '/ontology_table_semantics', 'POST/PATCH', 'public', 'public'),
  defineTool('flash.draft.read', '读取闪念草稿', 'read', 'flash_draft', 'low', false, 2, '/agent/flash/draft', 'GET'),
  defineTool('flash.draft.write', '写入闪念草稿', 'save', 'flash_draft', 'medium', true, 2, '/agent/flash/draft', 'POST'),
  defineTool('flash.attachment.upload', '上传闪念附件', 'upload', 'flash_attachment', 'medium', true, 2, '/agent/flash/attachments', 'POST'),
  defineTool('flash.app.save', '保存闪念应用', 'save', 'flash_application', 'medium', true, 2, '/apps', 'PATCH', 'app_center', 'app_center'),
  defineTool('flash.app.publish', '发布闪念应用', 'publish', 'flash_application', 'high', true, 2, '/apps', 'PATCH', 'app_center', 'app_center'),
  defineTool('flash.route.upsert', '写入发布路由', 'configure_app', 'published_route', 'high', true, 2, '/published_routes', 'POST', 'app_center', 'app_center'),
  defineTool('flash.audit.write', '写入执行审计', 'audit', 'execution_log', 'medium', true, 2, '/execution_logs', 'POST', 'app_center', 'app_center')
]);

const TOOL_ALIASES = Object.freeze({
  'cap.app.list': 'flash.app.list',
  'cap.app.detail': 'flash.app.detail',
  'cap.app.create': 'flash.app.create',
  'cap.app.update': 'flash.app.save',
  'cap.app.delete': 'flash.app.delete',
  'cap.route.resolve': 'flash.route.resolve',
  'cap.route.upsert': 'flash.route.upsert',
  'cap.data.table.ensure': 'flash.data.table.ensure',
  'cap.data.grid.list': 'flash.data.grid.list',
  'cap.data.grid.detail': 'flash.data.grid.detail',
  'cap.data.grid.create': 'flash.data.grid.create',
  'cap.data.grid.update': 'flash.data.grid.update',
  'cap.data.grid.delete': 'flash.data.grid.delete',
  'cap.data.grid.export': 'flash.data.grid.export',
  'cap.workflow.definition.list': 'flash.workflow.definition.list',
  'cap.workflow.definition.upsert': 'flash.workflow.definition.upsert',
  'cap.workflow.assignment.list': 'flash.workflow.assignment.list',
  'cap.workflow.assignment.upsert': 'flash.workflow.assignment.upsert',
  'cap.workflow.mapping.list': 'flash.workflow.mapping.list',
  'cap.workflow.mapping.upsert': 'flash.workflow.mapping.upsert',
  'cap.workflow.instance.list': 'flash.workflow.instance.list',
  'cap.workflow.event.list': 'flash.workflow.event.list',
  'cap.workflow.instance.start': 'flash.workflow.instance.start',
  'cap.workflow.instance.transition': 'flash.workflow.instance.transition',
  'cap.hr.archive.list': 'flash.hr.archive.list',
  'cap.hr.archive.update': 'flash.hr.archive.update',
  'cap.hr.attendance.init': 'flash.hr.attendance.init',
  'cap.inventory.current.list': 'flash.inventory.current.list',
  'cap.inventory.draft.list': 'flash.inventory.draft.list',
  'cap.inventory.draft.create': 'flash.inventory.draft.create',
  'cap.inventory.batchno.generate': 'flash.inventory.batchno.generate',
  'cap.inventory.stock.in': 'flash.inventory.stock.in',
  'cap.inventory.stock.out': 'flash.inventory.stock.out',
  'cap.material.master.list': 'flash.material.master.list',
  'cap.warehouse.list': 'flash.warehouse.list',
  'cap.ontology.relation.list': 'flash.ontology.relation.list',
  'cap.ontology.semantic.list': 'flash.ontology.semantic.list',
  'cap.ontology.semantic.enrich': 'flash.ontology.semantic.enrich',
  'flash.app.read': 'flash.app.detail'
});

const cloneJsonValue = (value) => {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const sanitizeToolId = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[^a-zA-Z0-9._-]/g, '');
};

const createFlashToolRegistry = ({ now = () => new Date(), getVisibleToolIds } = {}) => {
  const toolMap = new Map(TOOL_REGISTRY.map((tool) => [tool.tool_id, tool]));

  const resolveFlashToolId = (rawToolId) => {
    const cleaned = sanitizeToolId(rawToolId);
    if (!cleaned) return '';
    return TOOL_ALIASES[cleaned] || cleaned;
  };

  const getFlashToolDefinition = (toolId) => toolMap.get(toolId);

  const buildPayload = (visibleToolIds) => {
    const visible = visibleToolIds ? new Set(visibleToolIds) : null;
    const tools = TOOL_REGISTRY.filter((tool) => !visible || visible.has(tool.tool_id));
    return {
      registry_version: REGISTRY_VERSION,
      tools_count: tools.length,
      generated_at: now().toISOString(),
      domain: 'flash',
      tools: tools.map((tool) => ({
      tool_id: tool.tool_id,
      tool_name_zh: tool.tool_name_zh,
      intent: tool.intent,
      object: tool.object,
      risk_level: tool.risk_level,
      confirm_required: tool.confirm_required,
      batch: tool.batch,
      api: cloneJsonValue(tool.api)
      }))
    };
  };

  const getFlashToolRegistryPayload = (user) => {
    if (typeof getVisibleToolIds !== 'function') return buildPayload(null);
    if (!user) return buildPayload([]);
    return Promise.resolve(getVisibleToolIds(user)).then(buildPayload);
  };

  return Object.freeze({
    getFlashToolDefinition,
    getFlashToolRegistryPayload,
    registryCount: TOOL_REGISTRY.length,
    registryVersion: REGISTRY_VERSION,
    resolveFlashToolId
  });
};

module.exports = {
  createFlashToolRegistry
};
