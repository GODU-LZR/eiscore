// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const KNOWLEDGE_NAMESPACE = 'knowledge';
const KNOWLEDGE_PROFILE = 'knowledge';
const CONTEXT_SOURCE = 'agent_ontology_context_v1';
const CONTEXT_LIMIT = 200;
const MAX_COLUMNS = 2000;
const MAX_RELATIONS = 2000;

const asText = (value) => String(value == null ? '' : value).trim();

const safeId = (value, fallback = '') => {
  const text = asText(value);
  return text || fallback;
};

const uniqueById = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const id = asText(item?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const mapContext = (context = {}) => {
  const nodes = [];
  const edges = [];
  const tables = Array.isArray(context.tables) ? context.tables.slice(0, CONTEXT_LIMIT) : [];
  const columns = context.columns && typeof context.columns === 'object' && !Array.isArray(context.columns)
    ? context.columns
    : {};

  let columnCount = 0;
  for (const table of tables) {
    const schema = safeId(table?.table_schema, 'public');
    const tableName = safeId(table?.table_name);
    if (!tableName) continue;
    const tableId = `table:${schema}.${tableName}`;
    nodes.push({
      id: tableId,
      label: safeId(table?.semantic_name, tableName),
      type: 'table',
      parentId: null,
      metadata: {
        schema,
        table: tableName,
        description: asText(table?.semantic_description),
        tags: Array.isArray(table?.tags) ? table.tags.slice(0, 20) : [],
        access: safeId(table?.access_level, 'read')
      }
    });

    const key = `${schema}.${tableName}`;
    const tableColumns = Array.isArray(columns[key]) ? columns[key] : [];
    for (const column of tableColumns) {
      if (columnCount >= MAX_COLUMNS) break;
      const columnName = safeId(column?.col || column?.column_name || column?.name);
      if (!columnName) continue;
      columnCount += 1;
      const columnId = `column:${key}.${columnName}`;
      nodes.push({
        id: columnId,
        label: safeId(column?.name || column?.semantic_name, columnName),
        type: 'column',
        parentId: tableId,
        metadata: {
          schema,
          table: tableName,
          column: columnName,
          dataType: safeId(column?.type || column?.data_type),
          semanticClass: safeId(column?.cls || column?.semantic_class),
          uiType: safeId(column?.ui || column?.ui_type),
          sensitive: column?.sensitive === true || column?.is_sensitive === true
        }
      });
      edges.push({
        id: `contains:${tableId}:${columnId}`,
        source: tableId,
        target: columnId,
        label: '包含',
        type: 'contains'
      });
    }
  }

  const tableNodeIds = new Set(nodes.filter((node) => node.type === 'table').map((node) => node.id));
  const relations = Array.isArray(context.relations) ? context.relations.slice(0, MAX_RELATIONS) : [];
  relations.forEach((relation, index) => {
    const subject = safeId(relation?.subject_table || relation?.from);
    const object = safeId(relation?.object_table || relation?.to);
    if (!subject || !object) return;
    const subjectId = subject.includes(':') ? subject : `table:${subject}`;
    const objectId = object.includes(':') ? object : `table:${object}`;
    if (!tableNodeIds.has(subjectId) || !tableNodeIds.has(objectId)) return;
    const predicate = safeId(relation?.predicate, '关联');
    edges.push({
      id: `relation:${safeId(relation?.id, `${index}:${subjectId}:${objectId}:${predicate}`)}`,
      source: subjectId,
      target: objectId,
      label: predicate,
      type: safeId(relation?.relation_type, 'ontology')
    });
  });

  const apps = Array.isArray(context.apps) ? context.apps.slice(0, CONTEXT_LIMIT) : [];
  apps.forEach((app) => {
    const appKey = safeId(app?.app_id || app?.id);
    if (!appKey) return;
    const appId = `app:${appKey}`;
    nodes.push({
      id: appId,
      label: safeId(app?.name || app?.app_name, appKey),
      type: 'app',
      parentId: null,
      metadata: {
        appId: appKey,
        appType: safeId(app?.app_type),
        status: safeId(app?.status),
        qualifiedTable: safeId(app?.qualified_table)
      }
    });
    const qualifiedTable = safeId(app?.qualified_table);
    if (!qualifiedTable) return;
    const tableId = qualifiedTable.includes(':') ? qualifiedTable : `table:${qualifiedTable}`;
    edges.push({
      id: `app-table:${appId}:${tableId}`,
      source: appId,
      target: tableId,
      label: '对应数据',
      type: 'app_table'
    });
  });

  const files = (Array.isArray(context.files) ? context.files.slice(0, CONTEXT_LIMIT) : [])
    .map((file) => ({
      id: safeId(file?.id),
      name: safeId(file?.name || file?.filename || file?.title),
      type: safeId(file?.type || file?.mime_type),
      updatedAt: safeId(file?.updated_at || file?.updatedAt),
        size: Number.isFinite(Number(file?.size)) && Number(file.size) >= 0 ? Number(file.size) : null
    }))
    .filter((file) => file.id && file.name);

  return {
    nodes: uniqueById(nodes),
    edges: uniqueById(edges),
    files: uniqueById(files)
  };
};

const createKnowledgeOntologyHttpHandlers = ({
  authorize,
  bindPgQueryForUser,
  sendJson,
  log = console,
  timeoutMs = 8000
} = {}) => {
  if (typeof authorize !== 'function') throw new TypeError('authorize is required');
  if (typeof bindPgQueryForUser !== 'function') throw new TypeError('bindPgQueryForUser is required');
  if (typeof sendJson !== 'function') throw new TypeError('sendJson is required');

  const handleKnowledgeContext = async (req, res) => {
    const user = authorize(req, res);
    if (!user) return;

    try {
      const pgQuery = bindPgQueryForUser({ ...user, harness_namespace: KNOWLEDGE_NAMESPACE });
      const result = await pgQuery({
        method: 'POST',
        path: '/rpc/agent_ontology_context',
        body: { p_query: '', p_limit: CONTEXT_LIMIT },
        acceptProfile: 'public',
        contentProfile: 'public',
        timeoutMs
      });
      const context = result?.data;
      if (!context || typeof context !== 'object' || Array.isArray(context)
        || context.source !== CONTEXT_SOURCE
        || context.accessPolicy?.roleScoped !== true) {
        sendJson(res, 403, { code: 'KNOWLEDGE_ONTOLOGY_SCOPE_REQUIRED', message: 'Knowledge ontology scope is unavailable' });
        return;
      }

      sendJson(res, 200, {
        data: mapContext(context),
        meta: {
          namespace: KNOWLEDGE_NAMESPACE,
          profile: KNOWLEDGE_PROFILE,
          readOnly: true
        }
      });
    } catch (error) {
      log.warn?.('[knowledge-ontology] scoped context failed:', error?.message || error);
      sendJson(res, 503, { code: 'KNOWLEDGE_ONTOLOGY_UNAVAILABLE', message: 'Knowledge ontology is temporarily unavailable' });
    }
  };

  return Object.freeze({ handleKnowledgeContext });
};

module.exports = {
  CONTEXT_SOURCE,
  KNOWLEDGE_NAMESPACE,
  KNOWLEDGE_PROFILE,
  createKnowledgeOntologyHttpHandlers,
  mapContext
};
