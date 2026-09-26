// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const STATIC_POLICIES = Object.freeze({
  'flash.draft.read': { public: true },
  'flash.draft.write': { public: true },
  'flash.attachment.upload': { public: true },
  'flash.app.list': { permissions: ['module:app'] },
  'flash.app.detail': { app: 'read' },
  'flash.app.create': { superOnly: true },
  'flash.app.delete': { superOnly: true },
  'flash.app.save': { app: 'config' },
  'flash.app.publish': { app: 'config' },
  'flash.route.resolve': { permissions: ['module:app'] },
  'flash.route.upsert': { app: 'config' },
  'flash.data.table.ensure': { app: 'config' },
  'flash.data.grid.list': { table: 'read', fieldAcl: true },
  'flash.data.grid.detail': { table: 'read', fieldAcl: true },
  'flash.data.grid.export': { table: 'export', fieldAcl: true },
  'flash.data.grid.create': { table: 'create', fieldAcl: true },
  'flash.data.grid.update': { table: 'edit', fieldAcl: true },
  'flash.data.grid.delete': { table: 'delete', fieldAcl: true },
  'flash.workflow.definition.list': { app: 'read' },
  'flash.workflow.instance.list': { app: 'read' },
  'flash.workflow.event.list': { app: 'read' },
  'flash.workflow.assignment.list': { app: 'read' },
  'flash.workflow.mapping.list': { app: 'read' },
  'flash.workflow.definition.upsert': { app: 'config' },
  'flash.workflow.assignment.upsert': { app: 'config' },
  'flash.workflow.mapping.upsert': { app: 'config' },
  'flash.workflow.instance.start': { app: 'workflow_start' },
  'flash.workflow.instance.transition': { app: 'workflow_transition' },
  'flash.hr.archive.list': { tableName: 'hr.archives', permissions: ['module:hr', 'app:hr_employee', 'op:hr_employee.view'], fieldAcl: true },
  'flash.hr.archive.update': { permissions: ['op:hr_employee.edit'], fieldAcl: true },
  'flash.hr.attendance.init': { permissions: ['op:hr_attendance.config'], fieldAcl: true },
  'flash.inventory.current.list': { permissions: ['app:mms_ledger', 'module:materials'], fieldAcl: true },
  'flash.inventory.draft.list': { permissions: ['app:mms_ledger', 'module:materials'], fieldAcl: true },
  'flash.inventory.draft.create': { permissions: ['op:mms_ledger.create'], fieldAcl: true },
  'flash.inventory.batchno.generate': { permissions: ['op:mms_ledger.edit'], fieldAcl: true },
  'flash.inventory.stock.in': { permissions: ['op:mms_ledger.workflow_transition', 'op:mms_ledger.edit'], fieldAcl: true },
  'flash.inventory.stock.out': { permissions: ['op:mms_ledger.workflow_transition', 'op:mms_ledger.edit'], fieldAcl: true },
  'flash.material.master.list': { permissions: ['app:mms_ledger', 'module:materials'], fieldAcl: true },
  'flash.warehouse.list': { permissions: ['app:mms_ledger', 'module:materials'], fieldAcl: true },
  'flash.ontology.relation.list': { permissions: ['app:ontology_workbench'] },
  'flash.ontology.semantic.list': { permissions: ['app:ontology_workbench'] },
  'flash.ontology.semantic.enrich': { permissions: ['op:ontology_workbench.config'] },
  'flash.audit.write': { permissions: ['op:app_center.audit', 'op:app_center.config'] }
});

const normalizeTableId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.includes('.') ? raw : `app_data.${raw}`;
};

const createFlashAuthorization = ({ callPostgrestWithUser }) => {
  if (typeof callPostgrestWithUser !== 'function') {
    throw new Error('callPostgrestWithUser is required');
  }

  const loadAccessContext = async (user) => {
    const result = await callPostgrestWithUser(user, {
      method: 'POST',
      path: '/rpc/agent_ontology_context',
      body: { p_query: '', p_limit: 200 },
      acceptProfile: 'public',
      contentProfile: 'public',
      timeoutMs: 5000
    });
    const context = result?.data;
    if (!context || context.source !== 'agent_ontology_context_v1' || context.accessPolicy?.roleScoped !== true) {
      throw new Error('Role-scoped authorization context is unavailable');
    }
    let fieldAcl = context.fieldAcl && typeof context.fieldAcl === 'object' ? context.fieldAcl : {};
    let fieldAclAvailable = context.fieldAclAvailable === true;
    const roleCodes = [...new Set((Array.isArray(context.accessPolicy?.roles) ? context.accessPolicy.roles : [])
      .map((role) => String(role || '').trim())
      .filter((role) => /^[a-zA-Z0-9_-]+$/.test(role)))];
    if (!fieldAclAvailable && roleCodes.length) {
      try {
        const roleResult = await callPostgrestWithUser(user, {
          method: 'GET',
          path: '/roles',
          query: { select: 'id,code', code: `in.(${roleCodes.join(',')})`, limit: String(roleCodes.length) },
          acceptProfile: 'public',
          timeoutMs: 5000
        });
        const roleRows = Array.isArray(roleResult?.data) ? roleResult.data : [];
        const resolvedRoleCodes = new Set(roleRows.map((role) => String(role?.code || '').trim().toLowerCase()));
        if (roleCodes.some((role) => !resolvedRoleCodes.has(role.toLowerCase()))) {
          throw new Error('Not all effective roles resolved for field permissions');
        }
        const roleIds = [...new Set(roleRows
          .map((role) => String(role?.id || '').trim())
          .filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
        if (!roleIds.length) throw new Error('No persisted role ids resolved for effective roles');

        const aclResult = await callPostgrestWithUser(user, {
          method: 'GET',
          path: '/sys_field_acl',
          query: { select: 'module,field_code,can_view,can_edit', role_id: `in.(${roleIds.join(',')})`, limit: '5001' },
          acceptProfile: 'public',
          timeoutMs: 5000
        });
        fieldAcl = {};
        const aclRows = Array.isArray(aclResult?.data) ? aclResult.data : [];
        if (aclRows.length > 5000) throw new Error('Field ACL result exceeded the safe limit');
        for (const row of aclRows) {
          const module = String(row?.module || '').trim();
          const field = String(row?.field_code || '').trim();
          if (!module || !field) continue;
          const entry = fieldAcl[module]?.[field] || { canView: false, canEdit: false };
          entry.canView ||= row.can_view === true;
          entry.canEdit ||= row.can_edit === true;
          (fieldAcl[module] ||= {})[field] = entry;
        }
        fieldAclAvailable = true;
      } catch {
        fieldAclAvailable = false;
      }
    }

    return {
      permissions: new Set((Array.isArray(context.permissions) ? context.permissions : []).map((item) => String(item?.code || ''))),
      roles: new Set((Array.isArray(context.accessPolicy?.roles) ? context.accessPolicy.roles : []).map((role) => String(role || '').toLowerCase())),
      superUser: context.accessPolicy?.superUser === true,
      apps: Array.isArray(context.apps) ? context.apps : [],
      tables: Array.isArray(context.tables) ? context.tables : [],
      columns: context.columns && typeof context.columns === 'object' ? context.columns : {},
      fieldAcl,
      fieldAclAvailable
    };
  };

  const hasPermission = (context, codes = []) => codes.some((code) => context.permissions.has(code));
  const findApp = (context, args = {}, call = {}) => {
    const appId = String(args.appId || args.app_id || call.appId || '').trim();
    if (appId) return context.apps.find((app) => String(app?.app_id || '') === appId) || null;
    const tableId = normalizeTableId(args.table || args.tableName || args.table_name);
    if (tableId) return context.apps.find((app) => String(app?.qualified_table || '').toLowerCase() === tableId) || null;
    return null;
  };

  const appPermission = (app, context, action) => {
    if (!app) return false;
    if (context.superUser) return true;
    const module = String(app.acl_module || '').trim();
    if (!module) return false;
    if (action === 'read') return true;
    if (action === 'workflow_start') {
      return hasPermission(context, [`op:${module}.workflow_start`, `op:${module}.create`]);
    }
    if (action === 'workflow_transition') {
      return hasPermission(context, [`op:${module}.workflow_transition`, `op:${module}.edit`]);
    }
    return hasPermission(context, [`op:${module}.${action}`]);
  };

  const canUseTool = (toolId, context, args = {}, call = {}) => {
    const policy = STATIC_POLICIES[toolId];
    if (!policy) return false;
    if (policy.fieldAcl && context.fieldAclAvailable !== true) return false;
    if (context.superUser) return true;
    if (policy.public) return true;
    if (policy.superOnly) return false;
    if (policy.permissions) return hasPermission(context, policy.permissions);
    if (policy.tableName) {
      return hasPermission(context, policy.permissions) && context.tables.some((table) =>
        `${table.table_schema}.${table.table_name}`.toLowerCase() === policy.tableName
      );
    }
    if (policy.app) return appPermission(findApp(context, args, call), context, policy.app);
    if (policy.table) {
      const tableId = normalizeTableId(args.table || args.tableName || args.table_name);
      const table = context.tables.find((item) => `${item.table_schema}.${item.table_name}`.toLowerCase() === tableId);
      if (!table) return false;
      const app = findApp(context, args, call);
      if (policy.table === 'read') return true;
      return appPermission(app, context, policy.table);
    }
    return false;
  };

  const getVisibleToolIds = async (user) => {
    const context = await loadAccessContext(user);
    return Object.keys(STATIC_POLICIES).filter((toolId) => {
      const policy = STATIC_POLICIES[toolId];
      if (policy.fieldAcl && context.fieldAclAvailable !== true) return false;
      if (policy.public || context.superUser) return true;
      if (policy.superOnly) return false;
      if (policy.permissions) return hasPermission(context, policy.permissions);
      if (policy.tableName) {
        return hasPermission(context, policy.permissions) && context.tables.some((table) =>
          `${table.table_schema}.${table.table_name}`.toLowerCase() === policy.tableName
        );
      }
      if (policy.app) return context.apps.some((app) => appPermission(app, context, policy.app));
      if (policy.table) {
        return context.tables.some((table) => {
          const tableId = `${table.table_schema}.${table.table_name}`.toLowerCase();
          if (policy.table === 'read') return true;
          const app = context.apps.find((item) => String(item?.qualified_table || '').toLowerCase() === tableId);
          return appPermission(app, context, policy.table);
        });
      }
      return false;
    });
  };

  const authorizeFlashTool = async (user, toolId, args = {}, call = {}) => {
    try {
      const context = await loadAccessContext(user);
      return { allowed: canUseTool(toolId, context, args, call), context };
    } catch {
      return { allowed: false, context: null };
    }
  };

  return Object.freeze({ authorizeFlashTool, getVisibleToolIds, loadAccessContext });
};

module.exports = { createFlashAuthorization, STATIC_POLICIES };
