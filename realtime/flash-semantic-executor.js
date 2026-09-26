// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const { FlashToolError } = require('./flash-postgrest-adapter');
const { assertFieldAclWrite, prepareFieldAclRead, stripFieldAcl } = require('./flash-field-acl');

const createFlashSemanticExecutor = ({
  callPostgrestWithFlashTableEnsure,
  callPostgrestWithUser,
  inferFlashDataColumnsFromPayload,
  normalizeText,
  normalizeToolCallBoolean,
  readFlashDraftSource,
  requireNonEmptyText,
  resolveDataTableTarget,
  sanitizeQueryParams,
  uploadFlashAttachment,
  writeFlashDraftSource
}) => {
  const toPlainObject = (value) => {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };

  const normalizeLimit = (value, fallback = 50, max = 500) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return String(fallback);
    return String(Math.min(parsed, max));
  };

  const normalizeExecutionLogStatus = (rawStatus = '') => {
    const value = String(rawStatus || '').trim().toLowerCase();
    if (value === 'pending' || value === 'running' || value === 'completed' || value === 'failed') {
      return value;
    }
    return '';
  };

  const firstNonEmptyText = (...values) => {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  };

  const toJsonObjectOrNull = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return null;
  };

  const authorizationContext = (callContext) => callContext?.authorizationContext || {};
  const protectRead = (query, table, callContext, moduleFallback = '') =>
    prepareFieldAclRead(query, authorizationContext(callContext), table, moduleFallback);
  const protectWrite = (payload, table, callContext, moduleFallback = '') =>
    assertFieldAclWrite(payload, authorizationContext(callContext), table, moduleFallback);
  const protectResult = (value, module, callContext) =>
    stripFieldAcl(value, authorizationContext(callContext), module);
  const protectRpcWrite = (payload, module, callContext) => {
    const aclPayload = Object.fromEntries(Object.entries(payload || {}).map(([field, value]) => [
      field.replace(/^p_/, ''), value
    ]));
    return protectWrite(aclPayload, `public.${module}`, callContext, module);
  };

  const normalizeOperationLocation = (src = {}, callContext = {}) => {
    const explicit = toJsonObjectOrNull(src.operation_location) || toJsonObjectOrNull(src.operationLocation);
    if (explicit) return explicit;

    const moduleName = firstNonEmptyText(src.module_name, src.moduleName, src.module, callContext.context?.module_name, callContext.context?.moduleName, callContext.context?.module);
    const appName = firstNonEmptyText(src.app_name, src.appName, src.app, callContext.context?.app_name, callContext.context?.appName, callContext.context?.app);
    const actionName = firstNonEmptyText(src.action_name, src.actionName, src.action, src.event_message, src.eventMessage, src.event_type, src.eventType, src.task_id);
    const appId = firstNonEmptyText(src.app_id, src.appId, callContext.appId);
    const routePath = firstNonEmptyText(src.route_path, src.routePath, src.path, callContext.context?.route_path, callContext.context?.routePath, callContext.context?.path);

    const parts = [];
    if (moduleName) parts.push(`模块:${moduleName}`);
    if (appName) parts.push(`应用:${appName}`);
    if (actionName) parts.push(`操作:${actionName}`);
    if (!parts.length && appId) parts.push(`应用ID:${appId}`);
    if (!parts.length && routePath) parts.push(`路径:${routePath}`);
    if (!parts.length) return null;

    return {
      address: parts.join(' / '),
      module: moduleName || '',
      app: appName || '',
      action: actionName || '',
      app_id: appId || '',
      route_path: routePath || '',
      source: 'system_audit'
    };
  };

  const normalizeExecutionLogPayload = (rawPayload = {}, callContext = {}, user = null) => {
    const src = toPlainObject(rawPayload);
    const out = {};

    if (src.app_id !== undefined) out.app_id = src.app_id;
    if (src.execution_id !== undefined) out.execution_id = src.execution_id;
    if (src.task_id !== undefined) out.task_id = src.task_id;
    if (src.status !== undefined) out.status = src.status;
    if (src.input_data !== undefined) out.input_data = src.input_data;
    if (src.output_data !== undefined) out.output_data = src.output_data;
    if (src.error_message !== undefined) out.error_message = src.error_message;
    if (src.executed_by !== undefined) out.executed_by = src.executed_by;
    if (src.executed_at !== undefined) out.executed_at = src.executed_at;
    if (src.operation_location !== undefined) out.operation_location = src.operation_location;
    else if (src.operationLocation !== undefined) out.operation_location = src.operationLocation;

    if (!out.app_id) out.app_id = src.appId || callContext.appId || '';
    if (!out.task_id) out.task_id = src.event_type || src.eventType || 'flash.audit.write';
    if (!out.operation_location) {
      const location = normalizeOperationLocation(src, callContext);
      if (location) out.operation_location = location;
    }

    const normalizedStatus = normalizeExecutionLogStatus(out.status);
    if (normalizedStatus) {
      out.status = normalizedStatus;
    } else {
      const severity = String(src.severity || '').trim().toLowerCase();
      out.status = severity === 'error' || severity === 'fatal' ? 'failed' : 'completed';
    }

    if (!out.executed_by) {
      out.executed_by = String(src.operator || user?.id || 'flash_agent');
    }

    const mergedOutput = toJsonObjectOrNull(out.output_data) || {};
    if (src.event_message !== undefined && src.event_message !== null) {
      mergedOutput.event_message = String(src.event_message);
    }
    if (src.severity !== undefined && src.severity !== null) {
      mergedOutput.severity = String(src.severity);
    }
    if (callContext.traceId) {
      mergedOutput.trace_id = String(callContext.traceId);
    }
    if (Object.keys(mergedOutput).length > 0) {
      out.output_data = mergedOutput;
    }

    if (!out.app_id) {
      delete out.app_id;
    } else {
      out.app_id = String(out.app_id);
    }
    out.task_id = String(out.task_id).slice(0, 100);
    out.executed_by = String(out.executed_by).slice(0, 120);

    return out;
  };

  const encodeInList = (values = []) => {
    const list = values
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => item.replace(/[,()]/g, ''));
    if (!list.length) return '';
    return `in.(${list.join(',')})`;
  };

  const executeFlashSemanticTool = async (toolId, args, user, callContext) => {
  const requestArgs = toPlainObject(args);
  switch (toolId) {
    case 'flash.app.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.order) query.order = 'id.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 50, 200);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/apps',
        query,
        acceptProfile: 'app_center',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '应用列表查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.app.detail': {
      const appId = requireNonEmptyText(requestArgs.appId || requestArgs.id || callContext.appId, 'appId');
      const query = sanitizeQueryParams(requestArgs.query);
      query.id = `eq.${appId}`;
      if (!query.limit) query.limit = '1';
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/apps',
        query,
        acceptProfile: 'app_center',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: item ? '应用详情查询成功' : '应用不存在', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.app.create': {
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.record);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.app.create', { httpStatus: 400 });
      }
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/apps',
        body: payload,
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '应用创建成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.app.delete': {
      const appId = requireNonEmptyText(requestArgs.appId || requestArgs.id || callContext.appId, 'appId');
      const upstream = await callPostgrestWithUser(user, {
        method: 'DELETE',
        path: '/apps',
        query: { id: `eq.${appId}` },
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '应用删除成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.route.resolve': {
      const query = sanitizeQueryParams(requestArgs.query);
      const routePath = String(requestArgs.routePath || requestArgs.path || '').trim();
      const appId = String(requestArgs.appId || requestArgs.id || '').trim();
      if (!routePath && !appId) {
        throw new FlashToolError('VALIDATION_FAILED', 'routePath or appId is required', { httpStatus: 400 });
      }
      if (routePath) query.route_path = `eq.${routePath}`;
      if (appId) query.app_id = `eq.${appId}`;
      if (!query.order) query.order = 'id.desc';
      if (!query.limit) query.limit = '1';
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/published_routes',
        query,
        acceptProfile: 'app_center',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '发布路由查询成功', data: { items, item: items[0] || null }, rowsAffected: items.length };
    }
    case 'flash.data.grid.list': {
      const target = resolveDataTableTarget(requestArgs.table);
      const { schema, table } = target;
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 50, 500);
      const fieldPolicy = protectRead(query, `${schema}.${table}`, callContext);
      const upstream = await callPostgrestWithFlashTableEnsure(user, target, callContext.appId, {
        method: 'GET',
        path: `/${table}`,
        query: fieldPolicy.query,
        acceptProfile: schema,
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '表格列表查询成功', data: { schema, table, items }, rowsAffected: items.length };
    }
    case 'flash.data.grid.detail': {
      const target = resolveDataTableTarget(requestArgs.table);
      const { schema, table } = target;
      const recordId = requireNonEmptyText(requestArgs.id || requestArgs.recordId, 'id');
      const query = sanitizeQueryParams(requestArgs.query);
      query.id = `eq.${recordId}`;
      if (!query.limit) query.limit = '1';
      const fieldPolicy = protectRead(query, `${schema}.${table}`, callContext);
      const upstream = await callPostgrestWithFlashTableEnsure(user, target, callContext.appId, {
        method: 'GET',
        path: `/${table}`,
        query: fieldPolicy.query,
        acceptProfile: schema,
        traceId: callContext.traceId
      });
      const item = protectResult(Array.isArray(upstream.data) ? (upstream.data[0] || null) : null, fieldPolicy.module, callContext);
      return { message: item ? '表格详情查询成功' : '数据不存在', data: { schema, table, item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.data.grid.export': {
      const target = resolveDataTableTarget(requestArgs.table);
      const { schema, table } = target;
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 500, 5000);
      if (!query.order && requestArgs.order) query.order = String(requestArgs.order);
      const fieldPolicy = protectRead(query, `${schema}.${table}`, callContext);
      const upstream = await callPostgrestWithFlashTableEnsure(user, target, callContext.appId, {
        method: 'GET',
        path: `/${table}`,
        query: fieldPolicy.query,
        acceptProfile: schema,
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '表格导出数据查询成功', data: { schema, table, items }, rowsAffected: items.length };
    }
    case 'flash.data.table.ensure': {
      const appId = requireNonEmptyText(requestArgs.appId || requestArgs.id || callContext.appId, 'appId');
      const tableName = String(requestArgs.tableName || requestArgs.table || '').trim() || null;
      const columns = Array.isArray(requestArgs.columns)
        ? requestArgs.columns
        : Array.isArray(requestArgs.payload?.columns)
          ? requestArgs.payload.columns
          : [];
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/rpc/create_data_app_table',
        body: {
          app_id: appId,
          table_name: tableName,
          columns
        },
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        traceId: callContext.traceId
      });
      const tableFqn = typeof upstream.data === 'string'
        ? upstream.data
        : Array.isArray(upstream.data)
          ? upstream.data[0] || ''
          : String(upstream.data || '');
      return { message: '数据应用表初始化成功', data: { table: normalizeText(tableFqn) }, rowsAffected: 1 };
    }
    case 'flash.data.grid.create': {
      const target = resolveDataTableTarget(requestArgs.table);
      const { schema, table } = target;
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.record);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.data.grid.create', { httpStatus: 400 });
      }
      const fieldModule = protectWrite(payload, `${schema}.${table}`, callContext);
      const ensureColumns = inferFlashDataColumnsFromPayload(payload);
      const upstream = await callPostgrestWithFlashTableEnsure(user, target, callContext.appId, {
        method: 'POST',
        path: `/${table}`,
        body: payload,
        acceptProfile: schema,
        contentProfile: schema,
        prefer: 'return=representation',
        traceId: callContext.traceId
      }, ensureColumns);
      const item = protectResult(Array.isArray(upstream.data) ? (upstream.data[0] || null) : null, fieldModule, callContext);
      return { message: '表格记录创建成功', data: { schema, table, item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.data.grid.update': {
      const target = resolveDataTableTarget(requestArgs.table);
      const { schema, table } = target;
      const recordId = requireNonEmptyText(requestArgs.id || requestArgs.recordId, 'id');
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.patch);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.data.grid.update', { httpStatus: 400 });
      }
      const fieldModule = protectWrite(payload, `${schema}.${table}`, callContext);
      const ensureColumns = inferFlashDataColumnsFromPayload(payload);
      const upstream = await callPostgrestWithFlashTableEnsure(user, target, callContext.appId, {
        method: 'PATCH',
        path: `/${table}`,
        query: { id: `eq.${recordId}` },
        body: payload,
        acceptProfile: schema,
        contentProfile: schema,
        prefer: 'return=representation',
        traceId: callContext.traceId
      }, ensureColumns);
      const item = protectResult(Array.isArray(upstream.data) ? (upstream.data[0] || null) : null, fieldModule, callContext);
      return { message: '表格记录更新成功', data: { schema, table, item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.data.grid.delete': {
      const target = resolveDataTableTarget(requestArgs.table);
      const { schema, table } = target;
      const recordId = requireNonEmptyText(requestArgs.id || requestArgs.recordId, 'id');
      const fieldPolicy = protectRead({ id: `eq.${recordId}` }, `${schema}.${table}`, callContext);
      const upstream = await callPostgrestWithFlashTableEnsure(user, target, callContext.appId, {
        method: 'DELETE',
        path: `/${table}`,
        query: { id: `eq.${recordId}` },
        acceptProfile: schema,
        contentProfile: schema,
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '表格记录删除成功', data: { schema, table, items }, rowsAffected: items.length };
    }
    case 'flash.workflow.definition.list': {
      const appId = requireNonEmptyText(requestArgs.appId || callContext.appId, 'appId');
      const query = sanitizeQueryParams(requestArgs.query);
      query.app_id = `eq.${appId}`;
      if (!query.order) query.order = 'id.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 20, 200);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/definitions',
        query,
        acceptProfile: 'workflow',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '流程定义查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.workflow.instance.list': {
      const definitionId = requireNonEmptyText(requestArgs.definitionId || requestArgs.id, 'definitionId');
      const query = sanitizeQueryParams(requestArgs.query);
      query.definition_id = `eq.${definitionId}`;
      if (!query.order) query.order = 'started_at.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 40, 300);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/instances',
        query,
        acceptProfile: 'workflow',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '流程实例查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.workflow.event.list': {
      const query = sanitizeQueryParams(requestArgs.query);
      const definitionId = String(requestArgs.definitionId || '').trim();
      const instanceId = String(requestArgs.instanceId || requestArgs.id || '').trim();
      const instanceIds = Array.isArray(requestArgs.instanceIds) ? requestArgs.instanceIds : [];
      if (instanceIds.length) {
        const inExpr = encodeInList(instanceIds);
        if (!inExpr) {
          throw new FlashToolError('VALIDATION_FAILED', 'instanceIds is invalid', { httpStatus: 400 });
        }
        query.instance_id = inExpr;
      } else if (instanceId) {
        query.instance_id = `eq.${instanceId}`;
      } else if (definitionId) {
        query.definition_id = `eq.${definitionId}`;
      } else {
        throw new FlashToolError('VALIDATION_FAILED', 'instanceId, instanceIds or definitionId is required', { httpStatus: 400 });
      }
      if (!query.order) query.order = 'created_at.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 50, 300);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/instance_events',
        query,
        acceptProfile: 'workflow',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '流程日志查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.workflow.assignment.list': {
      const definitionId = requireNonEmptyText(requestArgs.definitionId || requestArgs.id, 'definitionId');
      const query = sanitizeQueryParams(requestArgs.query);
      query.definition_id = `eq.${definitionId}`;
      const taskId = String(requestArgs.taskId || requestArgs.bpmnTaskId || '').trim();
      if (taskId) query.task_id = `eq.${taskId}`;
      if (!query.order) query.order = 'id.asc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 100, 500);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/task_assignments',
        query,
        acceptProfile: 'workflow',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '流程任务分派查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.workflow.mapping.list': {
      const workflowAppId = requireNonEmptyText(
        requestArgs.workflowAppId || requestArgs.workflow_app_id || requestArgs.appId || callContext.appId,
        'workflowAppId'
      );
      const query = sanitizeQueryParams(requestArgs.query);
      query.workflow_app_id = `eq.${workflowAppId}`;
      const bpmnTaskId = String(requestArgs.bpmnTaskId || requestArgs.taskId || requestArgs.bpmn_task_id || '').trim();
      if (bpmnTaskId) query.bpmn_task_id = `eq.${bpmnTaskId}`;
      if (!query.order) query.order = 'id.asc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 100, 500);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/workflow_state_mappings',
        query,
        acceptProfile: 'app_center',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '流程状态映射查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.workflow.definition.upsert': {
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || {});
      const definitionId = String(requestArgs.definitionId || requestArgs.id || payload.id || '').trim();
      if (!definitionId && !payload.app_id && (requestArgs.appId || callContext.appId)) {
        payload.app_id = requestArgs.appId || callContext.appId;
      }
      if (!definitionId && !String(payload.app_id || '').trim()) {
        throw new FlashToolError('VALIDATION_FAILED', 'definitionId or payload.app_id is required', { httpStatus: 400 });
      }

      if (definitionId) {
        const patchBody = { ...payload };
        delete patchBody.id;
        const upstream = await callPostgrestWithUser(user, {
          method: 'PATCH',
          path: '/definitions',
          query: { id: `eq.${definitionId}` },
          body: patchBody,
          acceptProfile: 'workflow',
          contentProfile: 'workflow',
          prefer: 'return=representation',
          traceId: callContext.traceId
        });
        const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
        return { message: '流程定义已更新', data: { item }, rowsAffected: item ? 1 : 0 };
      }

      const existing = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/definitions',
        query: {
          app_id: `eq.${String(payload.app_id || '').trim()}`,
          order: 'id.desc',
          limit: '1'
        },
        acceptProfile: 'workflow',
        traceId: callContext.traceId
      });
      const existingRow = Array.isArray(existing.data) ? existing.data[0] : null;
      if (existingRow?.id) {
        const patchBody = { ...payload };
        delete patchBody.id;
        const upstream = await callPostgrestWithUser(user, {
          method: 'PATCH',
          path: '/definitions',
          query: { id: `eq.${existingRow.id}` },
          body: patchBody,
          acceptProfile: 'workflow',
          contentProfile: 'workflow',
          prefer: 'return=representation',
          traceId: callContext.traceId
        });
        const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
        return { message: '流程定义已更新', data: { item }, rowsAffected: item ? 1 : 0 };
      }

      const createBody = { ...payload };
      delete createBody.id;
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/definitions',
        body: createBody,
        acceptProfile: 'workflow',
        contentProfile: 'workflow',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '流程定义已创建', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.workflow.assignment.upsert': {
      const payload = {
        ...toPlainObject(requestArgs.payload || requestArgs.data || {})
      };
      if (!payload.definition_id) payload.definition_id = requestArgs.definitionId || requestArgs.definition_id;
      if (!payload.task_id) payload.task_id = requestArgs.taskId || requestArgs.task_id;
      payload.definition_id = requireNonEmptyText(payload.definition_id, 'definitionId');
      payload.task_id = requireNonEmptyText(payload.task_id, 'taskId');

      const explicitId = String(requestArgs.id || requestArgs.assignmentId || payload.id || '').trim();
      if (explicitId) {
        const patchBody = { ...payload };
        delete patchBody.id;
        const upstream = await callPostgrestWithUser(user, {
          method: 'PATCH',
          path: '/task_assignments',
          query: { id: `eq.${explicitId}` },
          body: patchBody,
          acceptProfile: 'workflow',
          contentProfile: 'workflow',
          prefer: 'return=representation',
          traceId: callContext.traceId
        });
        const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
        return { message: '流程任务分派已更新', data: { item }, rowsAffected: item ? 1 : 0 };
      }

      const existing = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/task_assignments',
        query: {
          definition_id: `eq.${payload.definition_id}`,
          task_id: `eq.${payload.task_id}`,
          order: 'id.desc',
          limit: '1'
        },
        acceptProfile: 'workflow',
        traceId: callContext.traceId
      });
      const existingRow = Array.isArray(existing.data) ? existing.data[0] : null;
      if (existingRow?.id) {
        const patchBody = { ...payload };
        delete patchBody.id;
        const upstream = await callPostgrestWithUser(user, {
          method: 'PATCH',
          path: '/task_assignments',
          query: { id: `eq.${existingRow.id}` },
          body: patchBody,
          acceptProfile: 'workflow',
          contentProfile: 'workflow',
          prefer: 'return=representation',
          traceId: callContext.traceId
        });
        const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
        return { message: '流程任务分派已更新', data: { item }, rowsAffected: item ? 1 : 0 };
      }

      const createBody = { ...payload };
      delete createBody.id;
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/task_assignments',
        body: createBody,
        acceptProfile: 'workflow',
        contentProfile: 'workflow',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '流程任务分派已创建', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.workflow.mapping.upsert': {
      const payload = {
        ...toPlainObject(requestArgs.payload || requestArgs.data || {})
      };
      if (!payload.workflow_app_id) payload.workflow_app_id = requestArgs.workflowAppId || requestArgs.workflow_app_id || requestArgs.appId || callContext.appId;
      if (!payload.bpmn_task_id) payload.bpmn_task_id = requestArgs.bpmnTaskId || requestArgs.bpmn_task_id || requestArgs.taskId;
      payload.workflow_app_id = requireNonEmptyText(payload.workflow_app_id, 'workflowAppId');
      payload.bpmn_task_id = requireNonEmptyText(payload.bpmn_task_id, 'bpmnTaskId');

      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/workflow_state_mappings',
        query: {
          on_conflict: 'workflow_app_id,bpmn_task_id'
        },
        body: payload,
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        prefer: 'resolution=merge-duplicates,return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '流程状态映射已保存', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.workflow.instance.start': {
      const definitionIdRaw = requestArgs.definitionId || requestArgs.id || requestArgs.p_definition_id;
      const definitionId = Number.parseInt(String(definitionIdRaw || ''), 10);
      if (!Number.isFinite(definitionId) || definitionId <= 0) {
        throw new FlashToolError('VALIDATION_FAILED', 'definitionId must be a positive integer', { httpStatus: 400 });
      }
      const body = {
        p_definition_id: definitionId,
        p_business_key: requestArgs.businessKey ?? requestArgs.p_business_key ?? null,
        p_initial_task_id: requestArgs.initialTaskId ?? requestArgs.p_initial_task_id ?? null,
        p_variables: requestArgs.variables ?? requestArgs.p_variables ?? {}
      };
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/rpc/start_workflow_instance',
        body,
        acceptProfile: 'workflow',
        contentProfile: 'workflow',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : toPlainObject(upstream.data);
      return { message: '流程实例启动成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.workflow.instance.transition': {
      const instanceIdRaw = requestArgs.instanceId || requestArgs.id || requestArgs.p_instance_id;
      const instanceId = Number.parseInt(String(instanceIdRaw || ''), 10);
      if (!Number.isFinite(instanceId) || instanceId <= 0) {
        throw new FlashToolError('VALIDATION_FAILED', 'instanceId must be a positive integer', { httpStatus: 400 });
      }
      const complete = normalizeToolCallBoolean(requestArgs.complete ?? requestArgs.p_complete);
      const nextTaskId = requestArgs.nextTaskId ?? requestArgs.p_next_task_id ?? null;
      const body = {
        p_instance_id: instanceId,
        p_next_task_id: complete ? null : nextTaskId,
        p_complete: complete,
        p_variables: requestArgs.variables ?? requestArgs.p_variables ?? null
      };
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/rpc/transition_workflow_instance',
        body,
        acceptProfile: 'workflow',
        contentProfile: 'workflow',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : toPlainObject(upstream.data);
      return { message: '流程实例推进成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.inventory.current.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 80, 500);
      const fieldPolicy = protectRead(query, 'scm.v_inventory_current', callContext, 'mms_ledger');
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/v_inventory_current',
        query: fieldPolicy.query,
        acceptProfile: 'scm',
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '库存查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.inventory.draft.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      const draftType = String(requestArgs.draftType || requestArgs.draft_type || '').trim();
      if (draftType && !query.draft_type) query.draft_type = `eq.${draftType}`;
      if (!query.order) query.order = 'created_at.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 80, 500);
      const fieldPolicy = protectRead(query, 'scm.v_inventory_drafts', callContext, 'mms_ledger');
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/v_inventory_drafts',
        query: fieldPolicy.query,
        acceptProfile: 'scm',
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '库存草稿查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.material.master.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.order) query.order = 'id.asc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 100, 500);
      const fieldPolicy = protectRead(query, 'public.raw_materials', callContext, 'mms_ledger');
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/raw_materials',
        query: fieldPolicy.query,
        acceptProfile: 'public',
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '物料主数据查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.warehouse.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.order) query.order = 'code.asc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 100, 500);
      const fieldPolicy = protectRead(query, 'scm.warehouses', callContext, 'mms_ledger');
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/warehouses',
        query: fieldPolicy.query,
        acceptProfile: 'scm',
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '仓库列表查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.hr.archive.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.order) query.order = 'id.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 80, 500);
      const fieldPolicy = protectRead(query, 'hr.archives', callContext, 'hr_employee');
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/archives',
        query: fieldPolicy.query,
        acceptProfile: 'hr',
        traceId: callContext.traceId
      });
      const items = protectResult(Array.isArray(upstream.data) ? upstream.data : [], fieldPolicy.module, callContext);
      return { message: '人事档案查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.hr.archive.update': {
      const archiveId = requireNonEmptyText(requestArgs.id || requestArgs.archiveId || requestArgs.recordId, 'id');
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.patch);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.hr.archive.update', { httpStatus: 400 });
      }
      const fieldModule = protectWrite(payload, 'hr.archives', callContext, 'hr_employee');
      const upstream = await callPostgrestWithUser(user, {
        method: 'PATCH',
        path: '/archives',
        query: { id: `eq.${archiveId}` },
        body: payload,
        acceptProfile: 'hr',
        contentProfile: 'hr',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = protectResult(Array.isArray(upstream.data) ? (upstream.data[0] || null) : null, fieldModule, callContext);
      return { message: '人事档案更新成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.hr.attendance.init': {
      const date = requireNonEmptyText(requestArgs.date || requestArgs.attDate || requestArgs.p_date, 'date');
      const dept = requestArgs.deptName ?? requestArgs.dept_name ?? requestArgs.p_dept_name ?? null;
      protectRpcWrite({ p_date: date, p_dept_name: dept }, 'hr_attendance', callContext);
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/rpc/init_attendance_records',
        body: {
          p_date: date,
          p_dept_name: dept
        },
        acceptProfile: 'hr',
        contentProfile: 'hr',
        traceId: callContext.traceId
      });
      const inserted = Number(upstream.data);
      return { message: '考勤初始化完成', data: { inserted: Number.isFinite(inserted) ? inserted : upstream.data }, rowsAffected: 1 };
    }
    case 'flash.inventory.draft.create': {
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.record);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.inventory.draft.create', { httpStatus: 400 });
      }
      const fieldModule = protectWrite(payload, 'scm.inventory_drafts', callContext, 'mms_ledger');
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/inventory_drafts',
        body: payload,
        acceptProfile: 'scm',
        contentProfile: 'scm',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = protectResult(Array.isArray(upstream.data) ? (upstream.data[0] || null) : null, fieldModule, callContext);
      return { message: '库存草稿创建成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.inventory.batchno.generate': {
      const payload = {
        p_rule_id: requestArgs.ruleId ?? requestArgs.rule_id ?? requestArgs.p_rule_id,
        p_material_id: requestArgs.materialId ?? requestArgs.material_id ?? requestArgs.p_material_id,
        p_manual_override: requestArgs.manualOverride ?? requestArgs.manual_override ?? requestArgs.p_manual_override ?? null
      };
      payload.p_rule_id = requireNonEmptyText(payload.p_rule_id, 'ruleId');
      protectRpcWrite(payload, 'mms_ledger', callContext);
      const materialId = Number.parseInt(String(payload.p_material_id || ''), 10);
      if (!Number.isFinite(materialId) || materialId <= 0) {
        throw new FlashToolError('VALIDATION_FAILED', 'materialId must be a positive integer', { httpStatus: 400 });
      }
      payload.p_material_id = materialId;
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/rpc/generate_batch_no',
        body: payload,
        acceptProfile: 'scm',
        contentProfile: 'scm',
        traceId: callContext.traceId
      });
      const batchNo = normalizeText(upstream.data);
      return { message: '批次号生成成功', data: { batch_no: batchNo }, rowsAffected: batchNo ? 1 : 0 };
    }
    case 'flash.inventory.stock.in':
    case 'flash.inventory.stock.out': {
      const sourcePayload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.record);
      const payload = {
        p_material_id: sourcePayload.p_material_id ?? requestArgs.materialId ?? requestArgs.material_id ?? requestArgs.p_material_id,
        p_warehouse_id: sourcePayload.p_warehouse_id ?? requestArgs.warehouseId ?? requestArgs.warehouse_id ?? requestArgs.p_warehouse_id,
        p_quantity: sourcePayload.p_quantity ?? requestArgs.quantity ?? requestArgs.p_quantity,
        p_unit: sourcePayload.p_unit ?? requestArgs.unit ?? requestArgs.p_unit,
        p_batch_no: sourcePayload.p_batch_no ?? requestArgs.batchNo ?? requestArgs.batch_no ?? requestArgs.p_batch_no,
        p_transaction_no: sourcePayload.p_transaction_no ?? requestArgs.transactionNo ?? requestArgs.transaction_no ?? requestArgs.p_transaction_no ?? null,
        p_operator: sourcePayload.p_operator ?? requestArgs.operator ?? requestArgs.p_operator ?? null,
        p_production_date: sourcePayload.p_production_date ?? requestArgs.productionDate ?? requestArgs.production_date ?? requestArgs.p_production_date ?? null,
        p_remark: sourcePayload.p_remark ?? requestArgs.remark ?? requestArgs.p_remark ?? null
      };
      const materialId = Number.parseInt(String(payload.p_material_id || ''), 10);
      if (!Number.isFinite(materialId) || materialId <= 0) {
        throw new FlashToolError('VALIDATION_FAILED', 'materialId must be a positive integer', { httpStatus: 400 });
      }
      payload.p_material_id = materialId;
      payload.p_warehouse_id = requireNonEmptyText(payload.p_warehouse_id, 'warehouseId');
      payload.p_unit = requireNonEmptyText(payload.p_unit, 'unit');
      payload.p_batch_no = requireNonEmptyText(payload.p_batch_no, 'batchNo');
      const quantity = Number(payload.p_quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new FlashToolError('VALIDATION_FAILED', 'quantity must be a positive number', { httpStatus: 400 });
      }
      payload.p_quantity = quantity;
      if (toolId === 'flash.inventory.stock.out') {
        delete payload.p_production_date;
      }
      protectRpcWrite(payload, 'mms_ledger', callContext);
      const rpcPath = toolId === 'flash.inventory.stock.out' ? '/rpc/stock_out' : '/rpc/stock_in';
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: rpcPath,
        body: payload,
        acceptProfile: 'scm',
        contentProfile: 'scm',
        traceId: callContext.traceId
      });
      const item = protectResult(toPlainObject(upstream.data), 'mms_ledger', callContext);
      return {
        message: toolId === 'flash.inventory.stock.out' ? '库存出库执行成功' : '库存入库执行成功',
        data: { item },
        rowsAffected: Object.keys(item).length ? 1 : 0
      };
    }
    case 'flash.ontology.relation.list': {
      const query = sanitizeQueryParams(requestArgs.query);
      if (!query.relation_type) query.relation_type = 'eq.ontology';
      if (!query.order) query.order = 'relation_type.asc,id.asc';
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/ontology_table_relations',
        query,
        acceptProfile: 'app_data',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '本体关系查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.ontology.semantic.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.is_active) query.is_active = 'eq.true';
      if (!query.order) query.order = 'table_schema.asc,table_name.asc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 200, 2000);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/ontology_table_semantics',
        query,
        acceptProfile: 'public',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '本体语义查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.ontology.semantic.enrich': {
      const payload = {
        ...toPlainObject(requestArgs.payload || requestArgs.data || {})
      };
      const tableInput = String(requestArgs.table || payload.table || '').trim();
      if ((!payload.table_schema || !payload.table_name) && tableInput) {
        const resolved = resolveDataTableTarget(tableInput);
        payload.table_schema = payload.table_schema || resolved.schema;
        payload.table_name = payload.table_name || resolved.table;
      }
      payload.table_schema = requireNonEmptyText(payload.table_schema, 'table_schema');
      payload.table_name = requireNonEmptyText(payload.table_name, 'table_name');
      if (payload.is_active === undefined) payload.is_active = true;

      const lookup = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/ontology_table_semantics',
        query: {
          table_schema: `eq.${payload.table_schema}`,
          table_name: `eq.${payload.table_name}`,
          limit: '1'
        },
        acceptProfile: 'public',
        traceId: callContext.traceId
      });
      const existing = Array.isArray(lookup.data) ? lookup.data[0] : null;
      if (existing) {
        const patchBody = { ...payload };
        delete patchBody.created_at;
        const upstream = await callPostgrestWithUser(user, {
          method: 'PATCH',
          path: '/ontology_table_semantics',
          query: {
            table_schema: `eq.${payload.table_schema}`,
            table_name: `eq.${payload.table_name}`
          },
          body: patchBody,
          acceptProfile: 'public',
          contentProfile: 'public',
          prefer: 'return=representation',
          traceId: callContext.traceId
        });
        const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
        return { message: '本体语义已更新', data: { item }, rowsAffected: item ? 1 : 0 };
      }

      const createBody = { ...payload };
      delete createBody.created_at;
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/ontology_table_semantics',
        body: createBody,
        acceptProfile: 'public',
        contentProfile: 'public',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '本体语义已创建', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.draft.read': {
      const data = await readFlashDraftSource(requestArgs.appId || requestArgs.app_id || callContext.appId);
      return { message: '草稿读取成功', data, rowsAffected: 1 };
    }
    case 'flash.draft.write': {
      const content = requestArgs.content;
      const reason = requestArgs.reason || callContext.context.reason || '';
      const data = await writeFlashDraftSource(content, reason, user, requestArgs.appId || requestArgs.app_id || callContext.appId);
      return { message: '草稿已保存', data, rowsAffected: 1 };
    }
    case 'flash.attachment.upload': {
      const data = await uploadFlashAttachment(requestArgs, user);
      return { message: '附件上传成功', data: { file: data }, rowsAffected: 1 };
    }
    case 'flash.app.save': {
      const appId = requireNonEmptyText(requestArgs.appId || requestArgs.id || callContext.appId, 'appId');
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.patch);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.app.save', { httpStatus: 400 });
      }
      const upstream = await callPostgrestWithUser(user, {
        method: 'PATCH',
        path: '/apps',
        query: { id: `eq.${appId}` },
        body: payload,
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '应用保存成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.app.publish': {
      const appId = requireNonEmptyText(requestArgs.appId || requestArgs.id || callContext.appId, 'appId');
      const payload = {
        ...toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.patch),
        status: 'published'
      };
      // app_center.apps has no top-level published_* columns; publish metadata stays in source_code/config.
      delete payload.published_at;
      delete payload.published_by;
      const upstream = await callPostgrestWithUser(user, {
        method: 'PATCH',
        path: '/apps',
        query: { id: `eq.${appId}` },
        body: payload,
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '应用发布成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.route.upsert': {
      const payload = {
        ...toPlainObject(requestArgs.payload || requestArgs.data || {})
      };
      if (!payload.app_id) {
        payload.app_id = requestArgs.appId || requestArgs.app_id || requestArgs.payload?.app_id || requestArgs.data?.app_id;
      }
      if (!payload.route_path) {
        payload.route_path =
          requestArgs.routePath ||
          requestArgs.path ||
          requestArgs.route_path ||
          requestArgs.payload?.route_path ||
          requestArgs.data?.route_path;
      }
      payload.app_id = requireNonEmptyText(payload.app_id, 'appId');
      payload.route_path = requireNonEmptyText(payload.route_path, 'routePath');
      if (payload.is_active === undefined) payload.is_active = true;

      const explicitId = String(requestArgs.id || requestArgs.routeId || payload.id || '').trim();
      if (explicitId) {
        const patchBody = { ...payload };
        delete patchBody.id;
        const upstream = await callPostgrestWithUser(user, {
          method: 'PATCH',
          path: '/published_routes',
          query: { id: `eq.${explicitId}` },
          body: patchBody,
          acceptProfile: 'app_center',
          contentProfile: 'app_center',
          prefer: 'return=representation',
          traceId: callContext.traceId
        });
        const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
        return { message: '发布路由已更新', data: { item }, rowsAffected: item ? 1 : 0 };
      }

      const existing = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/published_routes',
        query: {
          app_id: `eq.${payload.app_id}`,
          route_path: `eq.${payload.route_path}`,
          order: 'id.desc',
          limit: '1'
        },
        acceptProfile: 'app_center',
        traceId: callContext.traceId
      });
      const existingRow = Array.isArray(existing.data) ? existing.data[0] : null;
      if (existingRow?.id) {
        const patchBody = { ...payload };
        delete patchBody.id;
        const upstream = await callPostgrestWithUser(user, {
          method: 'PATCH',
          path: '/published_routes',
          query: { id: `eq.${existingRow.id}` },
          body: patchBody,
          acceptProfile: 'app_center',
          contentProfile: 'app_center',
          prefer: 'return=representation',
          traceId: callContext.traceId
        });
        const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
        return { message: '发布路由已更新', data: { item }, rowsAffected: item ? 1 : 0 };
      }

      const createBody = { ...payload };
      delete createBody.id;
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/published_routes',
        body: createBody,
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '发布路由已创建', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.audit.write': {
      const rawPayload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.log);
      if (!Object.keys(rawPayload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.audit.write', { httpStatus: 400 });
      }
      const payload = normalizeExecutionLogPayload(rawPayload, callContext, user);
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/execution_logs',
        body: payload,
        acceptProfile: 'app_center',
        contentProfile: 'app_center',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '审计日志写入成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    default:
      throw new FlashToolError('TOOL_NOT_FOUND', `Unsupported tool_id: ${toolId}`, { httpStatus: 404 });
  }
  };


  return Object.freeze({
    executeFlashSemanticTool
  });
};

module.exports = {
  createFlashSemanticExecutor
};
