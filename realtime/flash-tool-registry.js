// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const REGISTRY_VERSION = 'flash-tools-v3-programming-only';

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
  defineTool('flash.app.create', '创建应用', 'create_record', 'app_registry', 'high', true, 2, '/apps', 'POST', 'app_center', 'app_center'),
  defineTool('flash.app.delete', '删除应用', 'delete_record', 'app_registry', 'high', true, 2, '/apps', 'DELETE', 'app_center', 'app_center'),
  defineTool('flash.data.table.ensure', '初始化数据应用表', 'configure_app', 'data_table', 'medium', true, 2, '/rpc/create_flash_data_app_table', 'POST', 'app_center', 'app_center'),
  defineTool('flash.data.grid.create', '新增表格记录', 'create_record', 'data_table', 'medium', true, 2, '/{table}', 'POST'),
  defineTool('flash.data.grid.update', '更新表格记录', 'update_record', 'data_table', 'medium', true, 2, '/{table}', 'PATCH'),
  defineTool('flash.data.grid.delete', '删除表格记录', 'delete_record', 'data_table', 'high', true, 2, '/{table}', 'DELETE'),
  defineTool('flash.draft.read', '读取闪念草稿', 'read', 'flash_draft', 'low', false, 2, '/flash/draft', 'GET'),
  defineTool('flash.draft.write', '写入闪念草稿', 'save', 'flash_draft', 'medium', true, 2, '/flash/draft', 'POST'),
  defineTool('flash.attachment.upload', '上传闪念附件', 'upload', 'flash_attachment', 'medium', true, 2, '/flash/attachments', 'POST'),
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
