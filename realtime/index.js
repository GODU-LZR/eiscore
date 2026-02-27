const http = require('http');
const WebSocket = require('ws');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { AgentConversation, FileWatcher } = require('./agent-core');
const { WorkflowEngine } = require('./workflow-engine');
const { TwinEngine } = require('./twin-engine');
const { createTwinTools, buildTwinSystemPrompt, createPersistence } = require('./twin-tools');

const envText = (value, fallback = '') => String(value ?? fallback).trim();

const port = Number(process.env.PORT || 8078);
const wsPath = envText(process.env.WS_PATH, '/ws') || '/ws';
const rawChannel = envText(process.env.CHANNEL, 'eis_events') || 'eis_events';
const channel = /^[a-zA-Z0-9_]+$/.test(rawChannel) ? rawChannel : 'eis_events';
const workflowChannel = 'workflow_event';
const enableWorkflowAutoTransition = envText(process.env.WORKFLOW_AUTO_TRANSITION, '0') === '1';
const jwtSecret = envText(process.env.PGRST_JWT_SECRET, envText(process.env.JWT_SECRET, ''));
const aiConfigKey = envText(process.env.AI_CONFIG_KEY, 'ai_glm_config') || 'ai_glm_config';
const aiConfigTtlMs = Number(process.env.AI_CONFIG_TTL_MS || 30 * 1000);
const aiUpstreamTimeoutMs = Number(process.env.AI_UPSTREAM_TIMEOUT_MS || 120 * 1000);
const postgrestBaseUrl = envText(process.env.AGENT_POSTGREST_URL, 'http://api:3000').replace(/\/+$/, '');
const flashToolCallTimeoutMs = Number(process.env.FLASH_TOOL_CALL_TIMEOUT_MS || 30 * 1000);
const flashToolIdempotencyTtlMs = Number(process.env.FLASH_TOOL_IDEMPOTENCY_TTL_MS || 10 * 60 * 1000);
const flashCliEnabled = envText(process.env.FLASH_CLINE_ENABLED, 'true').toLowerCase() !== 'false';
const flashCliCommand = envText(process.env.FLASH_CLINE_COMMAND, '/app/node_modules/.bin/cline');
const flashCliProjectPath = envText(process.env.FLASH_CLINE_PROJECT_PATH, 'eiscore-apps/src/views/drafts');
const flashCliWorkdirConfigured = envText(
  process.env.FLASH_CLINE_WORKDIR,
  path.posix.join('/workspace', flashCliProjectPath)
);
const flashCliConfigRoot = envText(process.env.FLASH_CLINE_CONFIG_ROOT, '/tmp/flash-cline');
const flashCliTaskTimeoutMs = Number(process.env.FLASH_CLINE_TASK_TIMEOUT_MS || 8 * 60 * 1000);
const flashCliAuthTimeoutMs = Number(process.env.FLASH_CLINE_AUTH_TIMEOUT_MS || 30 * 1000);
const flashCliProvider = envText(process.env.FLASH_CLINE_PROVIDER, 'openai');
const flashCliHistoryLimit = Number(process.env.FLASH_CLINE_HISTORY_LIMIT || 10);
const flashCliBuildValidateEnabled = envText(process.env.FLASH_CLINE_BUILD_VALIDATE, 'true').toLowerCase() !== 'false';
const flashCliBuildWorkdirConfigured = envText(process.env.FLASH_CLINE_BUILD_WORKDIR, '/workspace/eiscore-apps');
const flashCliBuildTimeoutMs = Number(process.env.FLASH_CLINE_BUILD_TIMEOUT_MS || 180 * 1000);
const flashCliInstallTimeoutMs = Number(process.env.FLASH_CLINE_INSTALL_TIMEOUT_MS || 120 * 1000);
const flashCliSelfHealMaxRounds = Math.max(0, Number(process.env.FLASH_CLINE_SELF_HEAL_ROUNDS || 3));
const flashCliAutoInstallDeps = envText(process.env.FLASH_CLINE_AUTO_INSTALL_DEPS, 'true').toLowerCase() !== 'false';
const flashDraftFileName = envText(process.env.FLASH_DRAFT_FILE, 'FlashDraft.vue');
const flashAttachmentDirName = envText(process.env.FLASH_ATTACHMENT_DIR_NAME, '.uploads') || '.uploads';
const flashAttachmentMaxBytes = Math.max(256 * 1024, Number(process.env.FLASH_ATTACHMENT_MAX_BYTES || 8 * 1024 * 1024));
const flashAttachmentPreviewMaxChars = Math.max(800, Number(process.env.FLASH_ATTACHMENT_PREVIEW_MAX_CHARS || 8000));
const flashSemanticCliScript = envText(process.env.FLASH_SEMANTIC_CLI_SCRIPT, '/app/flash-semantic-tool.js');
const flashAgentBaseUrl = envText(process.env.FLASH_AGENT_BASE_URL, `http://127.0.0.1:${port}`).replace(/\/+$/, '');
const runtimeNodeMajor = Number.parseInt(String(process.versions.node || '0').split('.')[0], 10) || 0;
const flashCliRuntimeReady = runtimeNodeMajor >= 20;

const ensureBashCompat = () => {
  try {
    if (fs.existsSync('/bin/bash')) return true;
    if (!fs.existsSync('/bin/sh')) return false;
    fs.symlinkSync('/bin/sh', '/bin/bash');
    return fs.existsSync('/bin/bash');
  } catch {
    return false;
  }
};

ensureBashCompat();

const resolveFlashCliWorkdir = () => {
  const candidates = [
    flashCliWorkdirConfigured,
    path.resolve(process.cwd(), '..', flashCliProjectPath),
    path.resolve(__dirname, '..', flashCliProjectPath),
    path.resolve(process.cwd(), flashCliProjectPath)
  ]
    .map((item) => envText(item, ''))
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return candidates[0] || flashCliWorkdirConfigured;
};

const resolveFlashBuildWorkdir = (taskWorkdir) => {
  const directCandidates = [
    flashCliBuildWorkdirConfigured,
    taskWorkdir,
    path.resolve(taskWorkdir, '..'),
    path.resolve(taskWorkdir, '..', '..'),
    path.resolve(taskWorkdir, '..', '..', '..'),
    path.resolve(process.cwd(), '..', 'eiscore-apps'),
    path.resolve(__dirname, '..', 'eiscore-apps')
  ]
    .map((item) => envText(item, ''))
    .filter(Boolean);

  for (const candidate of directCandidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    } catch {
      // ignore
    }
  }
  return directCandidates[0] || flashCliBuildWorkdirConfigured;
};

const resolveFlashDraftFilePath = () => {
  const workdir = resolveFlashCliWorkdir();
  const file = flashDraftFileName || 'FlashDraft.vue';
  const resolved = path.resolve(workdir, file);
  const normalizedWorkdir = path.resolve(workdir);
  if (!resolved.startsWith(normalizedWorkdir + path.sep) && resolved !== path.join(normalizedWorkdir, file)) {
    throw new Error('Flash draft path escapes workdir');
  }
  return resolved;
};

const readFlashDraftFingerprintSafe = async () => {
  try {
    const target = resolveFlashDraftFilePath();
    const stat = await fs.promises.stat(target);
    if (!stat?.isFile?.()) return null;
    const buffer = await fs.promises.readFile(target);
    return {
      bytes: Number(stat.size || 0),
      mtimeMs: Number(stat.mtimeMs || 0),
      sha1: crypto.createHash('sha1').update(buffer).digest('hex')
    };
  } catch {
    return null;
  }
};

// In proxy-based environments, Node fetch reads proxy vars when this flag is enabled.
if (!process.env.NODE_USE_ENV_PROXY) {
  process.env.NODE_USE_ENV_PROXY = '1';
}

let pgClient = null;
let reconnectTimer = null;
let shuttingDown = false;
let workflowEngine = null;
let aiConfigCache = null;
let aiConfigLoadedAt = 0;
const flashToolIdempotencyCache = new Map();

const flashSemanticToolRegistryVersion = 'flash-tools-v2';
const flashSemanticToolRegistry = Object.freeze([
  {
    tool_id: 'flash.app.list',
    tool_name_zh: '查询应用列表',
    intent: 'read_list',
    object: 'app_registry',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/apps', method: 'GET', accept_profile: 'app_center' }
  },
  {
    tool_id: 'flash.app.detail',
    tool_name_zh: '查询应用详情',
    intent: 'read_detail',
    object: 'app_registry',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/apps', method: 'GET', accept_profile: 'app_center' }
  },
  {
    tool_id: 'flash.route.resolve',
    tool_name_zh: '查询发布路由',
    intent: 'read_detail',
    object: 'published_route',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/published_routes', method: 'GET', accept_profile: 'app_center' }
  },
  {
    tool_id: 'flash.data.grid.list',
    tool_name_zh: '查询表格列表数据',
    intent: 'read_list',
    object: 'data_table',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/{table}', method: 'GET' }
  },
  {
    tool_id: 'flash.data.grid.detail',
    tool_name_zh: '查询表格单条详情',
    intent: 'read_detail',
    object: 'data_table',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/{table}', method: 'GET' }
  },
  {
    tool_id: 'flash.data.grid.export',
    tool_name_zh: '导出表格数据',
    intent: 'read_export',
    object: 'data_table',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/{table}', method: 'GET' }
  },
  {
    tool_id: 'flash.workflow.definition.list',
    tool_name_zh: '查询流程定义',
    intent: 'read_list',
    object: 'workflow_definition',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/definitions', method: 'GET', accept_profile: 'workflow' }
  },
  {
    tool_id: 'flash.workflow.instance.list',
    tool_name_zh: '查询流程实例',
    intent: 'read_list',
    object: 'workflow_instance',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/instances', method: 'GET', accept_profile: 'workflow' }
  },
  {
    tool_id: 'flash.workflow.event.list',
    tool_name_zh: '查询流程日志',
    intent: 'read_list',
    object: 'workflow_event',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/instance_events', method: 'GET', accept_profile: 'workflow' }
  },
  {
    tool_id: 'flash.workflow.assignment.list',
    tool_name_zh: '查询流程任务分派',
    intent: 'read_list',
    object: 'workflow_task_assignment',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/task_assignments', method: 'GET', accept_profile: 'workflow' }
  },
  {
    tool_id: 'flash.workflow.mapping.list',
    tool_name_zh: '查询流程状态映射',
    intent: 'read_list',
    object: 'workflow_state_mapping',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/workflow_state_mappings', method: 'GET', accept_profile: 'app_center' }
  },
  {
    tool_id: 'flash.inventory.current.list',
    tool_name_zh: '查询当前库存',
    intent: 'read_list',
    object: 'inventory_current',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/v_inventory_current', method: 'GET', accept_profile: 'scm' }
  },
  {
    tool_id: 'flash.inventory.draft.list',
    tool_name_zh: '查询库存草稿',
    intent: 'read_list',
    object: 'inventory_draft',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/v_inventory_drafts', method: 'GET', accept_profile: 'scm' }
  },
  {
    tool_id: 'flash.material.master.list',
    tool_name_zh: '查询物料主数据',
    intent: 'read_list',
    object: 'material_master',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/raw_materials', method: 'GET', accept_profile: 'public' }
  },
  {
    tool_id: 'flash.warehouse.list',
    tool_name_zh: '查询仓库列表',
    intent: 'read_list',
    object: 'warehouse',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/warehouses', method: 'GET', accept_profile: 'scm' }
  },
  {
    tool_id: 'flash.hr.archive.list',
    tool_name_zh: '查询人事档案',
    intent: 'read_list',
    object: 'hr_archive',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/archives', method: 'GET', accept_profile: 'hr' }
  },
  {
    tool_id: 'flash.ontology.relation.list',
    tool_name_zh: '查询本体关系',
    intent: 'read_list',
    object: 'ontology_relation',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/ontology_table_relations', method: 'GET', accept_profile: 'app_data' }
  },
  {
    tool_id: 'flash.ontology.semantic.list',
    tool_name_zh: '查询本体语义',
    intent: 'read_list',
    object: 'ontology_semantic',
    risk_level: 'low',
    confirm_required: false,
    batch: 1,
    api: { path: '/ontology_table_semantics', method: 'GET', accept_profile: 'public' }
  },
  {
    tool_id: 'flash.app.create',
    tool_name_zh: '创建应用',
    intent: 'create_record',
    object: 'app_registry',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/apps', method: 'POST', accept_profile: 'app_center', content_profile: 'app_center' }
  },
  {
    tool_id: 'flash.app.delete',
    tool_name_zh: '删除应用',
    intent: 'delete_record',
    object: 'app_registry',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/apps', method: 'DELETE', accept_profile: 'app_center', content_profile: 'app_center' }
  },
  {
    tool_id: 'flash.data.table.ensure',
    tool_name_zh: '初始化数据应用表',
    intent: 'configure_app',
    object: 'data_table',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/rpc/create_data_app_table', method: 'POST', accept_profile: 'app_center', content_profile: 'app_center' }
  },
  {
    tool_id: 'flash.data.grid.create',
    tool_name_zh: '新增表格记录',
    intent: 'create_record',
    object: 'data_table',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/{table}', method: 'POST' }
  },
  {
    tool_id: 'flash.data.grid.update',
    tool_name_zh: '更新表格记录',
    intent: 'update_record',
    object: 'data_table',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/{table}', method: 'PATCH' }
  },
  {
    tool_id: 'flash.data.grid.delete',
    tool_name_zh: '删除表格记录',
    intent: 'delete_record',
    object: 'data_table',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/{table}', method: 'DELETE' }
  },
  {
    tool_id: 'flash.workflow.definition.upsert',
    tool_name_zh: '写入流程定义',
    intent: 'configure_app',
    object: 'workflow_definition',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/definitions', method: 'POST/PATCH', accept_profile: 'workflow', content_profile: 'workflow' }
  },
  {
    tool_id: 'flash.workflow.assignment.upsert',
    tool_name_zh: '写入流程任务分派',
    intent: 'configure_app',
    object: 'workflow_task_assignment',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/task_assignments', method: 'POST/PATCH', accept_profile: 'workflow', content_profile: 'workflow' }
  },
  {
    tool_id: 'flash.workflow.mapping.upsert',
    tool_name_zh: '写入流程状态映射',
    intent: 'configure_app',
    object: 'workflow_state_mapping',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/workflow_state_mappings', method: 'POST', accept_profile: 'app_center', content_profile: 'app_center' }
  },
  {
    tool_id: 'flash.workflow.instance.start',
    tool_name_zh: '启动流程实例',
    intent: 'start_workflow',
    object: 'workflow_instance',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/rpc/start_workflow_instance', method: 'POST', accept_profile: 'workflow', content_profile: 'workflow' }
  },
  {
    tool_id: 'flash.workflow.instance.transition',
    tool_name_zh: '推进流程实例',
    intent: 'transition_workflow',
    object: 'workflow_instance',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/rpc/transition_workflow_instance', method: 'POST', accept_profile: 'workflow', content_profile: 'workflow' }
  },
  {
    tool_id: 'flash.hr.archive.update',
    tool_name_zh: '更新人事档案',
    intent: 'update_record',
    object: 'hr_archive',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/archives', method: 'PATCH', accept_profile: 'hr', content_profile: 'hr' }
  },
  {
    tool_id: 'flash.hr.attendance.init',
    tool_name_zh: '初始化考勤记录',
    intent: 'configure_app',
    object: 'hr_attendance_record',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/rpc/init_attendance_records', method: 'POST', accept_profile: 'hr', content_profile: 'hr' }
  },
  {
    tool_id: 'flash.inventory.draft.create',
    tool_name_zh: '创建库存草稿',
    intent: 'create_record',
    object: 'inventory_draft',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/inventory_drafts', method: 'POST', accept_profile: 'scm', content_profile: 'scm' }
  },
  {
    tool_id: 'flash.inventory.batchno.generate',
    tool_name_zh: '生成批次号',
    intent: 'configure_app',
    object: 'inventory_draft',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/rpc/generate_batch_no', method: 'POST', accept_profile: 'scm', content_profile: 'scm' }
  },
  {
    tool_id: 'flash.inventory.stock.in',
    tool_name_zh: '执行库存入库',
    intent: 'update_record',
    object: 'inventory_transaction',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/rpc/stock_in', method: 'POST', accept_profile: 'scm', content_profile: 'scm' }
  },
  {
    tool_id: 'flash.inventory.stock.out',
    tool_name_zh: '执行库存出库',
    intent: 'update_record',
    object: 'inventory_transaction',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/rpc/stock_out', method: 'POST', accept_profile: 'scm', content_profile: 'scm' }
  },
  {
    tool_id: 'flash.ontology.semantic.enrich',
    tool_name_zh: '补全本体语义',
    intent: 'semantic_enrich',
    object: 'ontology_semantic',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/ontology_table_semantics', method: 'POST/PATCH', accept_profile: 'public', content_profile: 'public' }
  },
  {
    tool_id: 'flash.draft.read',
    tool_name_zh: '读取闪念草稿',
    intent: 'read',
    object: 'flash_draft',
    risk_level: 'low',
    confirm_required: false,
    batch: 2,
    api: { path: '/agent/flash/draft', method: 'GET' }
  },
  {
    tool_id: 'flash.draft.write',
    tool_name_zh: '写入闪念草稿',
    intent: 'save',
    object: 'flash_draft',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/agent/flash/draft', method: 'POST' }
  },
  {
    tool_id: 'flash.attachment.upload',
    tool_name_zh: '上传闪念附件',
    intent: 'upload',
    object: 'flash_attachment',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/agent/flash/attachments', method: 'POST' }
  },
  {
    tool_id: 'flash.app.save',
    tool_name_zh: '保存闪念应用',
    intent: 'save',
    object: 'flash_application',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/apps', method: 'PATCH', accept_profile: 'app_center', content_profile: 'app_center' }
  },
  {
    tool_id: 'flash.app.publish',
    tool_name_zh: '发布闪念应用',
    intent: 'publish',
    object: 'flash_application',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/apps', method: 'PATCH', accept_profile: 'app_center', content_profile: 'app_center' }
  },
  {
    tool_id: 'flash.route.upsert',
    tool_name_zh: '写入发布路由',
    intent: 'configure_app',
    object: 'published_route',
    risk_level: 'high',
    confirm_required: true,
    batch: 2,
    api: { path: '/published_routes', method: 'POST', accept_profile: 'app_center', content_profile: 'app_center' }
  },
  {
    tool_id: 'flash.audit.write',
    tool_name_zh: '写入执行审计',
    intent: 'audit',
    object: 'execution_log',
    risk_level: 'medium',
    confirm_required: true,
    batch: 2,
    api: { path: '/execution_logs', method: 'POST', accept_profile: 'app_center', content_profile: 'app_center' }
  }
]);

const flashSemanticToolAliases = Object.freeze({
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

const flashSemanticToolMap = new Map(
  flashSemanticToolRegistry.map((tool) => [tool.tool_id, tool])
);

const getRequestPath = (req) => {
  const rawPath = String(req?.url || '/').split('?')[0] || '/';
  if (rawPath === '/agent') return '/';
  if (rawPath.startsWith('/agent/')) return rawPath.slice('/agent'.length);
  return rawPath;
};

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
};

const sendJson = (res, status, payload, extraHeaders = {}) => {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(payload || {}));
};

const getBearerFromAuthHeader = (req) => {
  const header = req?.headers?.authorization;
  if (!header) return '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const asUser = (payload, token) => ({
  id: payload?.user_id || payload?.sub || payload?.username || payload?.email || '',
  username: payload?.username || '',
  role: payload?.app_role || payload?.role || '',
  permissions: Array.isArray(payload?.permissions) ? payload.permissions.map((p) => String(p)) : [],
  token: token || ''
});

const readJsonBody = (req, maxBytes = 25 * 1024 * 1024) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (error) => reject(error));
  });
};

const normalizeAiText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }
  if (typeof value === 'object') {
    return String(value.text || '').trim();
  }
  return String(value).trim();
};

const normalizeFlashCliError = (value) => {
  const text = normalizeAiText(value);
  if (!text) return '';
  if (/spawn\s+\/bin\/bash\s+ENOENT/i.test(text) || /\/bin\/bash.*not found/i.test(text)) {
    return '自动修复失败：运行环境缺少 /bin/bash，Cline 无法执行命令。请重建 agent-runtime 后重试。';
  }
  return text;
};

const normalizeMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'worker' || mode === 'enterprise' || mode === 'workflow') return mode;
  return '';
};

const normalizeMessageContent = (content) => {
  if (typeof content === 'string') {
    return content.slice(0, 10000);
  }
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'text') {
      const text = normalizeAiText(item.text);
      if (text) parts.push({ type: 'text', text: text.slice(0, 10000) });
      continue;
    }
    if (item.type === 'image_url') {
      const url = normalizeAiText(item?.image_url?.url || item?.url);
      if (url) parts.push({ type: 'image_url', image_url: { url } });
    }
  }
  return parts.length > 0 ? parts : '';
};

const sanitizeConversationMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  const normalized = [];
  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const role = String(item.role || '').toLowerCase();
    // Force system prompt ownership to backend route layer.
    if (role !== 'user' && role !== 'assistant') continue;
    const content = normalizeMessageContent(item.content);
    if (!content || (Array.isArray(content) && content.length === 0)) continue;
    normalized.push({ role, content });
  }
  return normalized.slice(-24);
};

const extractLatestUserText = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const content = message?.content;
    if (typeof content === 'string') {
      return normalizeAiText(content);
    }
    if (Array.isArray(content)) {
      const text = content
        .filter((part) => part?.type === 'text')
        .map((part) => normalizeAiText(part?.text))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) return text;
    }
  }
  return '';
};

const hasAnyKeyword = (text, patterns) => {
  if (!text) return false;
  return patterns.some((p) => p.test(text));
};

const WORKFLOW_INTENT_PATTERNS = [
  /流程|审批|节点|流转|编排|BPMN|workflow|流程图|发布流程|办理路径/i
];

const ENTERPRISE_INTENT_PATTERNS = [
  /经营|报表|收入|利润|毛利|同比|环比|趋势|分析|看板|图表|echarts|KPI|指标/i
];

const FORM_INTENT_PATTERNS = [
  /表单|模板|单据|表格模板|form[-_ ]?template|form/i
];

const MATERIALS_INTENT_PATTERNS = [
  /物料|库存|出入库|台账|分类|批次|仓库/i
];

const detectIntent = (latestUserText, context = {}) => {
  const text = normalizeAiText(latestUserText);
  const aiScene = String(context?.aiScene || '').toLowerCase();

  if (hasAnyKeyword(text, WORKFLOW_INTENT_PATTERNS) || aiScene.includes('workflow')) {
    return 'workflow';
  }
  if (hasAnyKeyword(text, FORM_INTENT_PATTERNS) || aiScene.includes('form')) {
    return 'form';
  }
  if (hasAnyKeyword(text, ENTERPRISE_INTENT_PATTERNS)) {
    return 'enterprise_report';
  }
  if (hasAnyKeyword(text, MATERIALS_INTENT_PATTERNS)) {
    return 'materials_ops';
  }
  return 'general';
};

const canUseWorkflowAgent = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'admin') return true;
  return (user?.permissions || []).some((perm) => String(perm).toLowerCase().includes('workflow'));
};

const resolveDefaultModeByRole = (user) => {
  const role = String(user?.role || '').toLowerCase();
  if (role.includes('viewer') || role.includes('operator') || role.includes('worker')) {
    return 'worker';
  }
  return 'enterprise';
};

const AGENT_LABELS = {
  enterprise_analyst: '企业经营分析智能体',
  worker_assistant: '企业工作助手智能体',
  workflow_orchestrator: '流程编排智能体'
};

const AGENT_RUNTIME_DEFAULTS = {
  enterprise_analyst: {
    temperature: 0.2,
    top_p: 0.8,
    max_tokens: 4096,
    thinking: { type: 'enabled' },
    tools_whitelist: ['echarts']
  },
  worker_assistant: {
    temperature: 0.3,
    top_p: 0.9,
    max_tokens: 4096,
    thinking: { type: 'enabled' },
    tools_whitelist: ['form-template', 'translate', 'map-locate']
  },
  workflow_orchestrator: {
    temperature: 0.1,
    top_p: 0.7,
    max_tokens: 6144,
    thinking: { type: 'enabled' },
    tools_whitelist: ['workflow-meta', 'bpmn-xml', 'mermaid']
  }
};

const pickFirstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const normalizeFiniteNumber = (value, fallback, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (min !== undefined && num < min) return fallback;
  if (max !== undefined && num > max) return fallback;
  return num;
};

const getAgentConfigMap = (cfg) => {
  const value = cfg?.agents || cfg?.agent_profiles || {};
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
};

const normalizeToolsWhitelist = (value, fallback = []) => {
  const list = normalizeStringList(value ?? fallback)
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(list));
};

const resolveAgentRuntimeConfig = (cfg, agentId) => {
  const defaults = AGENT_RUNTIME_DEFAULTS[agentId] || AGENT_RUNTIME_DEFAULTS.enterprise_analyst;
  const customMap = getAgentConfigMap(cfg);
  const custom = (customMap[agentId] && typeof customMap[agentId] === 'object') ? customMap[agentId] : {};
  const thinkingValue = pickFirstDefined(custom.thinking, cfg?.thinking, defaults.thinking);

  return {
    id: agentId,
    label: AGENT_LABELS[agentId] || agentId,
    model: normalizeAiText(
      pickFirstDefined(custom.model, cfg?.model, 'glm-4.6v')
    ) || 'glm-4.6v',
    temperature: normalizeFiniteNumber(
      pickFirstDefined(custom.temperature, defaults.temperature),
      defaults.temperature,
      0,
      2
    ),
    top_p: normalizeFiniteNumber(
      pickFirstDefined(custom.top_p, custom.topP, defaults.top_p),
      defaults.top_p,
      0,
      1
    ),
    max_tokens: normalizeFiniteNumber(
      pickFirstDefined(custom.max_tokens, custom.maxTokens, defaults.max_tokens),
      defaults.max_tokens,
      1,
      65535
    ),
    thinking: (thinkingValue && typeof thinkingValue === 'object')
      ? thinkingValue
      : defaults.thinking,
    tools_whitelist: normalizeToolsWhitelist(
      pickFirstDefined(custom.tools_whitelist, custom.tool_whitelist, custom.allowed_tools, custom.toolWhitelist),
      defaults.tools_whitelist
    )
  };
};

const buildAgentCatalog = (user, cfg) => {
  const ids = ['enterprise_analyst', 'worker_assistant', 'workflow_orchestrator'];
  return ids.map((id) => {
    const runtime = resolveAgentRuntimeConfig(cfg, id);
    const enabled = id === 'workflow_orchestrator' ? canUseWorkflowAgent(user) : true;
    return {
      id,
      label: runtime.label,
      enabled,
      model: runtime.model,
      temperature: runtime.temperature,
      top_p: runtime.top_p,
      max_tokens: runtime.max_tokens,
      tools_whitelist: runtime.tools_whitelist
    };
  });
};

const buildAgentSystemPrompt = ({ agentId, context, user, intent }) => {
  const snapshot = context?.businessSnapshot;
  const semanticCtx = context?.semanticContext;
  const ctxCopy = context ? { ...context } : {};
  delete ctxCopy.businessSnapshot;
  delete ctxCopy.injectBusinessData;
  delete ctxCopy.semanticContext;

  const safeContext = ctxCopy && typeof ctxCopy === 'object' && Object.keys(ctxCopy).length
    ? JSON.stringify(ctxCopy, null, 2).slice(0, 3000)
    : '';

  const contextBlock = safeContext
    ? `\n\n【业务上下文】\n${safeContext}`
    : '';

  const snapshotBlock = snapshot && typeof snapshot === 'object'
    ? `\n\n【企业实时数据快照（${snapshot.snapshotTime || '最新'}）】\n以下是从系统数据库查询到的真实业务数据，请基于这些真实数据进行分析，不要编造数据：\n${JSON.stringify(snapshot, null, 2).slice(0, 8000)}`
    : '';

  // ── 构建语义上下文块（所有 agent 通用） ──
  let semanticBlock = '';
  if (semanticCtx && typeof semanticCtx === 'object') {
    const parts = [];
    parts.push('以下是系统本体语义模型，描述了数据库表、列和关系的业务含义，请利用这些语义信息更准确地理解和分析数据：');

    // 表级语义
    if (Array.isArray(semanticCtx.tables) && semanticCtx.tables.length) {
      const tableLines = semanticCtx.tables.map(t =>
        `  - ${t.schema}.${t.table}（${t.name}）${t.desc ? '：' + t.desc : ''}`
      );
      parts.push(`\n数据表清单（${semanticCtx.tables.length}张）：\n${tableLines.join('\n')}`);
    }

    // 列级语义（按表分组，每表最多显示关键列）
    if (semanticCtx.columns && typeof semanticCtx.columns === 'object') {
      const tableKeys = Object.keys(semanticCtx.columns);
      const colLines = [];
      for (const tbl of tableKeys) {
        const cols = semanticCtx.columns[tbl];
        if (!Array.isArray(cols) || !cols.length) continue;
        const colDesc = cols.slice(0, 15).map(c =>
          `${c.col}=${c.name}${c.cls ? '(' + c.cls + ')' : ''}`
        ).join(', ');
        colLines.push(`  ${tbl}: ${colDesc}${cols.length > 15 ? ` ...共${cols.length}列` : ''}`);
      }
      if (colLines.length) {
        parts.push(`\n列级语义（${tableKeys.length}张表）：\n${colLines.join('\n')}`);
      }
    }

    // 表间关系
    if (Array.isArray(semanticCtx.relations) && semanticCtx.relations.length) {
      const relLines = semanticCtx.relations.map(r =>
        `  - ${r.from}（${r.fromName || ''}）--[${r.predicate}]--> ${r.to}（${r.toName || ''}）`
      );
      parts.push(`\n表间关系（${semanticCtx.relations.length}条）：\n${relLines.join('\n')}`);
    }

    // 权限语义
    if (Array.isArray(semanticCtx.permissions) && semanticCtx.permissions.length) {
      const permLines = semanticCtx.permissions.slice(0, 30).map(p =>
        `  - ${p.code}（${p.kind}${p.entity ? '/' + p.entity : ''}${p.action ? '.' + p.action : ''}）`
      );
      parts.push(`\n权限语义（前${Math.min(30, semanticCtx.permissions.length)}条）：\n${permLines.join('\n')}`);
    }

    const rawSemanticText = parts.join('\n');
    semanticBlock = `\n\n【系统本体语义模型（${semanticCtx.fetchedAt || '最新'}）】\n${rawSemanticText.slice(0, 6000)}`;
  }

  if (agentId === 'workflow_orchestrator') {
    return `你是流程编排智能体。你的职责是把业务需求转换成可落地的流程定义。\n\n【硬性规则】\n1. 必须输出 Mermaid 流程图（\`\`\`mermaid）。\n2. 必须输出 BPMN XML（\`\`\`bpmn-xml）。\n3. 必须输出流程元信息（\`\`\`workflow-meta），包含 name 与 associated_table。\n4. 禁止输出经营分析图表（如 ECharts）和无关内容。\n5. 语气简洁，优先可执行结果。\n6. 利用【系统本体语义模型】中的表结构和关系来选择正确的 associated_table 和字段映射。\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${semanticBlock}${contextBlock}`;
  }

  if (agentId === 'enterprise_analyst') {
    return `你是企业经营分析智能体。你的职责是输出“专业但通俗易懂”的经营分析报告，并给出可执行建议。\n\n【表达风格】\n1. 用业务语言解释指标含义，尽量少术语；若必须用术语，紧跟一句白话解释。\n2. 先给一句结论，再给证据（数据/图表），最后给行动建议。\n3. 每条建议都要可落地（负责人/时点/目标方向）。\n\n【硬性规则】\n1. 回答开头禁止客套语（如“好的/收到/我将”），直接进入“经营分析报告”或“摘要”。\n2. 默认输出结构：摘要 -> 核心指标解读 -> 图表洞察 -> 风险与机会 -> 执行建议。\n3. 图文并茂：当有数据时，优先给 2-4 个图（趋势、结构、对比、相关性）。\n4. 输出 ECharts 时只允许 \`\`\`echarts 代码块，且必须是严格 JSON：双引号、无注释、无尾逗号、禁止函数（如 formatter/itemStyle.color function）。\n5. 严禁输出 BPMN XML、workflow-meta、流程编排内容，除非用户明确要求“流程编排/BPMN审批流设计”。\n6. 结论必须业务可执行，避免空话。\n7. 当系统提供了【企业实时数据快照】时，必须基于真实数据进行分析和图表生成，禁止编造或使用示例假数据。\n8. 利用【系统本体语义模型】理解数据表和字段的业务含义，用语义名称（中文）而非数据库原始字段名来呈现分析结果。\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${semanticBlock}${snapshotBlock}${contextBlock}`;
  }

  return `你是企业一线工作助手。你的职责是帮助用户整理数据、填表、导入、解释字段。\n\n【硬性规则】\n1. 用通俗语句分步骤回答。\n2. 默认不输出流程编排内容（BPMN/workflow-meta），除非用户明确提出流程编排需求。\n3. 当用户要求表单模板时，输出 form-template 代码块。\n4. 关注可直接录入系统的字段结果。\n5. 利用【系统本体语义模型】中的列语义信息帮助用户理解字段含义、正确填写表单。\n\n【当前角色】${user?.role || 'unknown'}\n【识别意图】${intent}${semanticBlock}${contextBlock}`;
};

const resolveAgentRoute = ({ user, body, messages }) => {
  const requestedMode = normalizeMode(body?.assistant_mode || body?.assistantMode || body?.mode);
  const context = (body?.context && typeof body.context === 'object') ? body.context : {};
  const latestUserText = extractLatestUserText(messages);
  const intent = detectIntent(latestUserText, context);
  const fallbackMode = resolveDefaultModeByRole(user);
  const mode = requestedMode || fallbackMode;

  let agentId = mode === 'worker' ? 'worker_assistant' : 'enterprise_analyst';
  if (intent === 'workflow') {
    agentId = canUseWorkflowAgent(user) ? 'workflow_orchestrator' : agentId;
  } else if (mode === 'workflow') {
    agentId = canUseWorkflowAgent(user) ? 'workflow_orchestrator' : 'enterprise_analyst';
  } else if (mode === 'enterprise') {
    agentId = 'enterprise_analyst';
  } else if (mode === 'worker') {
    agentId = 'worker_assistant';
  }

  return {
    requestedMode: mode,
    intent,
    agentId,
    context,
    latestUserText
  };
};

const composeAgentMessages = ({ route, user, messages }) => {
  const systemPrompt = buildAgentSystemPrompt({
    agentId: route.agentId,
    context: route.context,
    user,
    intent: route.intent
  });
  return [{ role: 'system', content: systemPrompt }, ...messages];
};

const extractCompletionText = (data) => {
  const choice = data?.choices?.[0] || {};
  return normalizeAiText(choice?.message?.content || choice?.delta?.content || data?.output_text || '');
};

const cleanModelText = (text) => {
  const trimmed = normalizeAiText(text);
  if (!trimmed) return '';
  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^["“]|["”]$/g, '')
    .trim();
};

const WORKFLOW_LEAK_PATTERNS = [
  /```[\t ]*bpmn-xml/i,
  /```[\t ]*workflow-meta/i,
  /```[\t ]*mermaid/i,
  /<bpmn[\s:>]/i,
  /\bworkflow-meta\b/i
];

const shouldApplyEnterpriseOutputGuard = (route) => {
  return route?.agentId === 'enterprise_analyst' && route?.intent !== 'workflow';
};

const containsWorkflowLeak = (text) => {
  const value = normalizeAiText(text);
  if (!value) return false;
  return WORKFLOW_LEAK_PATTERNS.some((pattern) => pattern.test(value));
};

const replaceCompletionText = (data, text) => {
  const safeText = normalizeAiText(text);
  if (!safeText) return data || {};
  const cloned = (data && typeof data === 'object')
    ? JSON.parse(JSON.stringify(data))
    : {};
  if (!Array.isArray(cloned.choices) || cloned.choices.length === 0) {
    cloned.choices = [{ index: 0, message: { role: 'assistant', content: safeText }, finish_reason: 'stop' }];
    return cloned;
  }
  const first = cloned.choices[0] || {};
  if (first.message && typeof first.message === 'object') {
    first.message.content = safeText;
  } else if (first.delta && typeof first.delta === 'object') {
    first.delta.content = safeText;
  } else {
    first.message = { role: 'assistant', content: safeText };
  }
  cloned.choices[0] = first;
  return cloned;
};

const aiAllowedRoles = normalizeStringList(process.env.AI_ALLOWED_ROLES || '').map((role) => String(role).toLowerCase());
const aiAllowAll = String(process.env.AI_ALLOW_ALL || 'true').toLowerCase() !== 'false';

const canUseAi = (user) => {
  if (aiAllowAll) return true;
  if (aiAllowedRoles.length === 0) return true;
  const role = String(user?.role || '').toLowerCase();
  return aiAllowedRoles.includes(role);
};

const getAiConfig = async () => {
  if (!pgClient) throw new Error('Database client not ready');
  const now = Date.now();
  if (aiConfigCache && (now - aiConfigLoadedAt) < aiConfigTtlMs) {
    return aiConfigCache;
  }
  const result = await pgClient.query(
    'SELECT value FROM public.system_configs WHERE key = $1 LIMIT 1',
    [aiConfigKey]
  );
  const cfg = result?.rows?.[0]?.value;
  aiConfigCache = (cfg && typeof cfg === 'object') ? cfg : null;
  aiConfigLoadedAt = now;
  return aiConfigCache;
};

const getToolName = (tool) => {
  if (!tool || typeof tool !== 'object') return '';
  const value = tool?.function?.name || tool?.name || tool?.id || tool?.type || '';
  return String(value).trim().toLowerCase();
};

const applyToolWhitelist = (payload, whitelist) => {
  if (!payload || !Array.isArray(payload.tools)) return;
  const normalized = normalizeToolsWhitelist(whitelist);
  if (normalized.length === 0) {
    delete payload.tools;
    return;
  }
  if (normalized.includes('*')) return;
  payload.tools = payload.tools.filter((tool) => normalized.includes(getToolName(tool)));
  if (payload.tools.length === 0) {
    delete payload.tools;
  }
};

const buildUpstreamPayload = (incoming, cfg, forceStream = false, agentRuntime = null) => {
  const payload = (incoming && typeof incoming === 'object') ? { ...incoming } : {};
  delete payload.api_key;
  delete payload.api_url;
  delete payload.assistant_mode;
  delete payload.assistantMode;
  delete payload.mode;
  delete payload.context;
  delete payload.agent;
  delete payload.agent_id;
  delete payload.agent_target;

  if (!payload.model) payload.model = agentRuntime?.model || cfg?.model || 'glm-4.6v';
  if (payload.temperature === undefined && Number.isFinite(agentRuntime?.temperature)) {
    payload.temperature = agentRuntime.temperature;
  }
  if (payload.top_p === undefined && Number.isFinite(agentRuntime?.top_p)) {
    payload.top_p = agentRuntime.top_p;
  }
  if (payload.max_tokens === undefined && Number.isFinite(agentRuntime?.max_tokens)) {
    payload.max_tokens = agentRuntime.max_tokens;
  }
  if (forceStream) payload.stream = true;
  if (payload.thinking === undefined && agentRuntime?.thinking) payload.thinking = agentRuntime.thinking;
  if (payload.thinking === undefined && cfg?.thinking) payload.thinking = cfg.thinking;
  applyToolWhitelist(payload, agentRuntime?.tools_whitelist);
  return payload;
};

const readResponseText = async (response) => {
  try {
    return await response.text();
  } catch (e) {
    return '';
  }
};

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryUpstream = (result) => {
  if (!result || result.ok) return false;
  const status = Number(result.status || 0);
  if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
  const message = normalizeAiText(result?.payload?.message).toLowerCase();
  return /timeout|upstream|network|failed/.test(message);
};

const callAiUpstream = async (incomingPayload, options = {}) => {
  const forceStream = options?.forceStream === true;
  const cfg = options?.cfg || await getAiConfig();
  const agentRuntime = options?.agentRuntime || null;
  if (!cfg?.api_url || !cfg?.api_key) {
    return {
      ok: false,
      status: 503,
      payload: { code: 'AI_CONFIG_MISSING', message: 'AI configuration is missing in system_configs.ai_glm_config' }
    };
  }

  const payload = buildUpstreamPayload(incomingPayload, cfg, forceStream, agentRuntime);
  const streamMode = !!payload.stream;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiUpstreamTimeoutMs);
  let upstreamRes = null;
  try {
    upstreamRes = await fetch(cfg.api_url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    const endpoint = normalizeAiText(cfg?.api_url || '').slice(0, 200);
    const errCode = normalizeAiText(error?.cause?.code || error?.code || '').slice(0, 64);
    console.warn('[ai-upstream] fetch failed:', JSON.stringify({
      timeout: isTimeout,
      code: errCode || 'N/A',
      message: normalizeAiText(error?.message || 'fetch failed').slice(0, 240),
      endpoint
    }));
    return {
      ok: false,
      status: 502,
      payload: {
        code: 'AI_UPSTREAM_ERROR',
        message: isTimeout
          ? `AI upstream timeout after ${aiUpstreamTimeoutMs}ms`
          : ((errCode ? `${errCode}: ` : '') + (error?.message || 'AI upstream request failed')),
        detail: ''
      }
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!upstreamRes.ok) {
    const detail = (await readResponseText(upstreamRes)).slice(0, 2000);
    return {
      ok: false,
      status: upstreamRes.status || 502,
      payload: {
        code: 'AI_UPSTREAM_ERROR',
        message: 'AI upstream request failed',
        detail
      }
    };
  }

  if (!streamMode) {
    const raw = await readResponseText(upstreamRes);
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        data = { raw };
      }
    }
    return { ok: true, stream: false, data, config: cfg, payload };
  }

  return { ok: true, stream: streamMode, response: upstreamRes, config: cfg, payload };
};

const callAiUpstreamWithRetry = async (incomingPayload, options = {}, retryConfig = {}) => {
  const maxRetries = Number(retryConfig.maxRetries);
  const retries = Number.isFinite(maxRetries) && maxRetries > 0 ? Math.floor(maxRetries) : 2;
  const baseDelayMs = Number(retryConfig.baseDelayMs);
  const delay = Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? Math.floor(baseDelayMs) : 320;

  let attempt = 0;
  let result = await callAiUpstream(incomingPayload, options);
  while (attempt < retries && shouldRetryUpstream(result)) {
    attempt += 1;
    const jitter = Math.floor(Math.random() * 80);
    await waitMs(delay * attempt + jitter);
    result = await callAiUpstream(incomingPayload, options);
  }
  return result;
};

const sendWsJson = (ws, payload) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
};

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const parseJsonMaybe = (rawText) => {
  const text = String(rawText || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const deriveOpenAiBaseUrl = (apiUrl) => {
  const raw = envText(apiUrl, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.endsWith('/chat/completions')) {
      parsed.pathname = parsed.pathname.replace(/\/chat\/completions$/, '');
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
  }
};

const resolveClineBin = () => {
  const candidates = [
    flashCliCommand,
    '/app/node_modules/.bin/cline',
    'cline'
  ];
  for (const candidate of candidates) {
    const cmd = envText(candidate, '');
    if (!cmd) continue;
    if (cmd.includes('/') && fs.existsSync(cmd)) return cmd;
    if (!cmd.includes('/')) return cmd;
  }
  return 'cline';
};

const runSpawnCapture = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || '/app',
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (typeof options.onSpawn === 'function') {
      try {
        options.onSpawn(child);
      } catch {
        // ignore callback errors
      }
    }

    let stdout = '';
    let stderr = '';
    let timer = null;
    let killedByTimeout = false;

    if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        killedByTimeout = true;
        child.kill('SIGKILL');
      }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
      if (stdout.length > 8000) stdout = stdout.slice(-8000);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (typeof options.onDone === 'function') {
        try {
          options.onDone(child);
        } catch {
          // ignore callback errors
        }
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (typeof options.onDone === 'function') {
        try {
          options.onDone(child);
        } catch {
          // ignore callback errors
        }
      }
      resolve({
        code: Number(code || 0),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut: killedByTimeout
      });
    });
  });
};

const buildFlashCliEnv = (token = '') => ({
  ...process.env,
  FLASH_AGENT_TOKEN: String(token || ''),
  FLASH_AGENT_BASE_URL: flashAgentBaseUrl,
  FLASH_SEMANTIC_CLI_SCRIPT: flashSemanticCliScript
});

const summarizeCommandOutput = (stdout, stderr, maxChars = 1800) => {
  const text = `${String(stdout || '')}\n${String(stderr || '')}`.trim();
  if (!text) return '';
  const compact = text
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\r/g, '')
    .trim();
  if (compact.length <= maxChars) return compact;
  return compact.slice(-maxChars);
};

const normalizeImportSpecifier = (value) => {
  const text = String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/[?#].*$/, '')
    .trim();
  return text;
};

const specifierToPackageName = (specifier) => {
  const target = normalizeImportSpecifier(specifier);
  if (!target) return '';
  if (
    target.startsWith('.') ||
    target.startsWith('/') ||
    target.startsWith('@/') ||
    target.startsWith('~/') ||
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('data:') ||
    target.startsWith('node:') ||
    target.startsWith('virtual:')
  ) {
    return '';
  }

  if (target.startsWith('@')) {
    const parts = target.split('/').filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return '';
  }

  return target.split('/')[0] || '';
};

const collectMissingPackagesFromBuildLog = (logText) => {
  const text = String(logText || '');
  if (!text) return [];
  const patterns = [
    /Cannot find package ['"]([^'"\r\n]+)['"]/gi,
    /Cannot find module ['"]([^'"\r\n]+)['"]/gi,
    /Failed to resolve import ["']([^"'\r\n]+)["']/gi,
    /Could not resolve ["']([^"'\r\n]+)["']/gi
  ];

  const names = new Set();
  patterns.forEach((pattern) => {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const pkg = specifierToPackageName(match[1]);
      if (pkg) names.add(pkg);
      match = pattern.exec(text);
    }
  });
  return Array.from(names).slice(0, 6);
};

const isDraftScopedBuildFailure = (logText) => {
  const text = String(logText || '');
  if (!text) return false;
  if (/FlashDraft\.vue/i.test(text)) return true;
  if (/src\/views\/drafts\//i.test(text)) return true;
  const normalizedProject = normalizeProjectPath(flashCliProjectPath);
  if (normalizedProject && text.includes(normalizedProject)) return true;
  return false;
};

const detectPackageManager = (workdir) => {
  const files = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm']
  ];
  for (const [name, manager] of files) {
    try {
      if (fs.existsSync(path.join(workdir, name))) return manager;
    } catch {
      // ignore
    }
  }
  return 'npm';
};

const runBuildCommand = async (workdir, manager, options = {}) => {
  const selected = manager || detectPackageManager(workdir);
  if (selected === 'pnpm') {
    return runSpawnCapture('pnpm', ['build'], {
      cwd: workdir,
      timeoutMs: flashCliBuildTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  if (selected === 'yarn') {
    return runSpawnCapture('yarn', ['build'], {
      cwd: workdir,
      timeoutMs: flashCliBuildTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  return runSpawnCapture('npm', ['run', 'build'], {
    cwd: workdir,
    timeoutMs: flashCliBuildTimeoutMs,
    onSpawn: options.onSpawn,
    onDone: options.onDone
  });
};

const runInstallCommand = async (workdir, manager, packages, options = {}) => {
  const list = Array.isArray(packages) ? packages.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!list.length) return { code: 0, stdout: '', stderr: '', timedOut: false };
  const selected = manager || detectPackageManager(workdir);
  if (selected === 'pnpm') {
    return runSpawnCapture('pnpm', ['add', ...list], {
      cwd: workdir,
      timeoutMs: flashCliInstallTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  if (selected === 'yarn') {
    return runSpawnCapture('yarn', ['add', ...list], {
      cwd: workdir,
      timeoutMs: flashCliInstallTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  }
  return runSpawnCapture('npm', ['install', '--save', '--no-audit', '--no-fund', ...list], {
    cwd: workdir,
    timeoutMs: flashCliInstallTimeoutMs,
    onSpawn: options.onSpawn,
    onDone: options.onDone
  });
};

const runWithManagerFallback = async (fn, manager) => {
  const primary = manager || 'npm';
  try {
    const result = await fn(primary);
    return { manager: primary, result };
  } catch (error) {
    const missingBinary = String(error?.message || '').includes('ENOENT');
    if (!missingBinary || primary === 'npm') throw error;
    const fallbackResult = await fn('npm');
    return { manager: 'npm', result: fallbackResult };
  }
};

const parseClineCapturedEvents = (rawText) => {
  const lines = String(rawText || '').split(/\r?\n/);
  const assistantChunks = [];
  let taskId = '';
  let errorText = '';

  lines.forEach((line) => {
    const parsed = parseJsonMaybe(line);
    if (!parsed || typeof parsed !== 'object') return;
    if (parsed.type === 'task_started' && parsed.taskId) {
      taskId = String(parsed.taskId);
      return;
    }
    if (!errorText && parsed.type === 'error') {
      errorText = normalizeAiText(parsed.message || parsed.text || '');
      return;
    }
    if (parsed.type === 'say') {
      const sayText = normalizeAiText(parsed.text);
      if (!shouldForwardClineSay(parsed.say, sayText)) return;
      assistantChunks.push(sayText);
    }
  });

  return { assistantChunks, taskId, errorText };
};

const buildFlashSelfHealPrompt = (originalPrompt, buildLog) => {
  const safePrompt = normalizeAiText(originalPrompt) || '继续修复当前草稿';
  const safeLog = summarizeCommandOutput(buildLog, '', 1600) || '构建失败但未返回详细日志。';
  return [
    '上一轮生成后执行前端构建失败，请直接修复问题直到构建通过。',
    '仅允许修改当前草稿目录文件，不要触碰路由、鉴权、基座。',
    '若错误来自导入路径/语法/类型，请直接修复代码。',
    '禁止输出思考过程、上下文复述、环境信息。',
    `原始需求：${safePrompt}`,
    '构建失败摘要：',
    safeLog
  ].join('\n');
};

const runFlashBuildSelfHeal = async ({
  ws,
  sessionId,
  session,
  clineBin,
  configDir,
  model,
  prompt,
  taskWorkdir,
  clineEnv
}) => {
  if (!flashCliBuildValidateEnabled) {
    return { success: true, skipped: true };
  }
  if (!ensureBashCompat()) {
    return {
      success: false,
      error: '自动修复失败：运行环境缺少 /bin/bash，无法执行命令。请重建 agent-runtime 后重试。'
    };
  }

  const buildWorkdir = resolveFlashBuildWorkdir(taskWorkdir);
  const packageJson = path.join(buildWorkdir, 'package.json');
  if (!fs.existsSync(packageJson)) {
    return { success: true, skipped: true };
  }

  let manager = detectPackageManager(buildWorkdir);
  const installedPackages = new Set();
  let round = 0;
  let lastBuildLog = '';
  const bindSessionProcess = {
    onSpawn: (child) => {
      session.process = child;
    },
    onDone: (child) => {
      if (session.process === child) {
        session.process = null;
      }
    }
  };

  while (round <= flashCliSelfHealMaxRounds) {
    sendWsJson(ws, {
      type: 'flash:cline_status',
      sessionId,
      status: 'validating',
      message: round === 0 ? '正在校验草稿编译结果...' : `正在验证修复结果（第 ${round} 轮）...`
    });

    const buildRun = await runWithManagerFallback(
      (selected) => runBuildCommand(buildWorkdir, selected, bindSessionProcess),
      manager
    );
    manager = buildRun.manager;
    const buildResult = buildRun.result;

    if (!buildResult.timedOut && Number(buildResult.code || 0) === 0) {
      if (installedPackages.size > 0) {
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'deps_installed',
          message: `已自动安装依赖：${Array.from(installedPackages).join(', ')}`
        });
      }
      return { success: true, installedPackages: Array.from(installedPackages), rounds: round };
    }

    lastBuildLog = summarizeCommandOutput(buildResult.stdout, buildResult.stderr, 2200);
    const missingPackages = flashCliAutoInstallDeps
      ? collectMissingPackagesFromBuildLog(lastBuildLog).filter((pkg) => !installedPackages.has(pkg))
      : [];
    const draftScopedFailure = isDraftScopedBuildFailure(lastBuildLog);

    if (!draftScopedFailure && missingPackages.length === 0) {
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'validate_warn',
        message: '检测到非草稿历史构建错误，已跳过阻塞式修复，不影响当前草稿输出。'
      });
      return { success: true, skipped: true };
    }

    if (missingPackages.length > 0) {
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'installing',
        message: `检测到缺失依赖，自动安装：${missingPackages.join(', ')}`
      });

      const installRun = await runWithManagerFallback(
        (selected) => runInstallCommand(buildWorkdir, selected, missingPackages, bindSessionProcess),
        manager
      );
      manager = installRun.manager;
      const installResult = installRun.result;
      if (installResult.timedOut || Number(installResult.code || 0) !== 0) {
        const installError = normalizeFlashCliError(
          summarizeCommandOutput(installResult.stdout, installResult.stderr, 800)
        );
        return {
          success: false,
          error: `自动安装依赖失败：${installError || 'unknown error'}`
        };
      }
      missingPackages.forEach((pkg) => installedPackages.add(pkg));
      continue;
    }

    if (round >= flashCliSelfHealMaxRounds) {
      return {
        success: false,
        error: `自动修复后仍构建失败：${lastBuildLog || 'no build output'}`
      };
    }

    round += 1;
    sendWsJson(ws, {
      type: 'flash:cline_status',
      sessionId,
      status: 'self_heal',
      message: `检测到构建失败，正在自动修复（${round}/${flashCliSelfHealMaxRounds}）...`
    });

    const repairPrompt = buildFlashSelfHealPrompt(prompt, lastBuildLog);
    const repairArgs = buildFlashCliArgs({
      configDir,
      model,
      taskId: session.taskId,
      prompt: repairPrompt,
      workdir: taskWorkdir
    });
    const repairResult = await runSpawnCapture(clineBin, repairArgs, {
      cwd: '/app',
      env: clineEnv || process.env,
      timeoutMs: flashCliTaskTimeoutMs,
      onSpawn: bindSessionProcess.onSpawn,
      onDone: bindSessionProcess.onDone
    });
    const repairEvents = parseClineCapturedEvents(`${repairResult.stdout}\n${repairResult.stderr}`);
    if (repairEvents.taskId) {
      session.taskId = repairEvents.taskId;
    }
    repairEvents.assistantChunks.forEach((chunk) => {
      sendWsJson(ws, {
        type: 'flash:cline_output',
        sessionId,
        role: 'assistant',
        content: chunk,
        eventType: 'say',
        say: 'self_heal'
      });
    });

    if (repairResult.timedOut) {
      return {
        success: false,
        error: `自动修复超时（>${flashCliTaskTimeoutMs}ms）`
      };
    }
    if (Number(repairResult.code || 0) !== 0) {
      const repairError = normalizeFlashCliError(
        repairEvents.errorText || summarizeCommandOutput(repairResult.stdout, repairResult.stderr, 900)
      );
      return {
        success: false,
        error: `自动修复失败：${repairError || 'unknown error'}`
      };
    }
  }

  return {
    success: false,
    error: `自动修复达到上限（${flashCliSelfHealMaxRounds}）仍未通过构建`
  };
};

const clampFlashHistory = (history) => {
  if (!Array.isArray(history)) return [];
  const items = history
    .map((item) => {
      const role = String(item?.role || '').toLowerCase();
      const content = normalizeAiText(item?.content);
      if ((role !== 'user' && role !== 'assistant') || !content) return null;
      return { role, content: content.slice(0, 1600) };
    })
    .filter(Boolean);
  const limit = Number.isFinite(flashCliHistoryLimit) && flashCliHistoryLimit > 0
    ? Math.floor(flashCliHistoryLimit)
    : 10;
  return items.slice(-limit);
};

const normalizeFlashAttachmentList = (attachments, taskWorkdir) => {
  if (!Array.isArray(attachments) || !taskWorkdir) return [];
  const workdirResolved = path.resolve(taskWorkdir);
  let totalPreviewChars = 0;

  return attachments
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const relativePath = normalizeRelativeAgentPath(item.relativePath || item.path);
      if (!relativePath) return null;
      const absolutePath = path.resolve(workdirResolved, relativePath);
      if (absolutePath !== workdirResolved && !absolutePath.startsWith(`${workdirResolved}${path.sep}`)) {
        return null;
      }
      if (!fs.existsSync(absolutePath)) return null;

      const name = sanitizeUploadFileName(item.name || path.posix.basename(relativePath));
      const mimeType = normalizeAiText(item.mimeType || item.type).slice(0, 120) || 'application/octet-stream';
      const size = Number.isFinite(Number(item.size)) ? Number(item.size) : 0;
      let textPreview = normalizeAiText(item.textPreview || item.preview || '');
      if (textPreview) {
        const remaining = Math.max(0, flashAttachmentPreviewMaxChars - totalPreviewChars);
        if (remaining <= 0) {
          textPreview = '';
        } else if (textPreview.length > remaining) {
          textPreview = `${textPreview.slice(0, remaining)}...`;
          totalPreviewChars = flashAttachmentPreviewMaxChars;
        } else {
          totalPreviewChars += textPreview.length;
        }
      }

      return {
        name,
        mimeType,
        size: Math.max(0, Math.floor(size)),
        relativePath,
        textPreview
      };
    })
    .filter(Boolean)
    .slice(0, 8);
};

const buildFlashCliPrompt = (prompt, history = [], attachments = []) => {
  const cleanPrompt = normalizeAiText(prompt);
  const lines = [
    '你是闪念应用开发助手，只允许在当前工作目录内编辑应用草稿。',
    '硬性约束：只能修改 FlashDraft.vue 及其同目录草稿文件，不要触碰路由/鉴权/核心基座文件。',
    '输出要求：先给结果，再给关键变更点，尽量简洁。',
    '严禁输出思考过程、任务计划、系统提示、工作目录、环境信息和历史上下文原文。',
    '禁止出现“用户要求”“当前用户请求”“以下是最近上下文”“从环境信息来看”等复述语句。',
    `可调用系统语义接口：使用命令 \`node ${flashSemanticCliScript}\`。`,
    `先运行 \`node ${flashSemanticCliScript} --registry\` 查看可用 tool_id。`,
    `读接口示例：\`node ${flashSemanticCliScript} flash.app.detail --args '{"appId":"<APP_ID>"}'\`。`,
    `写接口必须添加 --confirm，例如：\`node ${flashSemanticCliScript} flash.audit.write --args '{"payload":{"event_type":"test"}}' --confirm\`。`
  ];

  if (history.length > 0) {
    lines.push('以下是最近上下文：');
    history.forEach((item, idx) => {
      lines.push(`${idx + 1}. [${item.role}] ${item.content}`);
    });
  }

  if (attachments.length > 0) {
    lines.push('本次用户上传了附件，请结合附件内容完成界面设计和代码生成：');
    attachments.forEach((item, idx) => {
      lines.push(`${idx + 1}. 文件: ${item.name} | 类型: ${item.mimeType || 'unknown'} | 大小: ${item.size || 0} bytes`);
      lines.push(`   路径: ${item.relativePath}`);
      if (item.textPreview) {
        lines.push('   文本摘要(可能截断):');
        lines.push(`   ${item.textPreview.replace(/\n/g, '\n   ')}`);
      }
    });
    lines.push('你可以读取上述文件路径获取完整内容，但写入修改仍仅限草稿目录。');
  }

  lines.push('当前用户请求：');
  lines.push(cleanPrompt || '请继续优化当前草稿。');
  return lines.join('\n');
};

const shouldForwardClineSay = (sayType, text) => {
  const key = String(sayType || '').trim().toLowerCase();
  if (!text) return false;
  const blocked = new Set([
    'task',
    'reasoning',
    'tool',
    'task_progress',
    'api_req_started',
    'api_req_finished',
    'api_req_retried',
    'api_req_completed',
    'command',
    'command_output'
  ]);
  if (blocked.has(key)) return false;
  if (text.includes('<environment_details>') || text.includes('<task>')) return false;
  return true;
};

const parseClineRetryMessage = (event) => {
  if (event?.type !== 'say' || event?.say !== 'error_retry') return '';
  const parsed = parseJsonMaybe(event?.text);
  if (!parsed) return '上游请求失败，正在重试...';
  const attempt = Number(parsed.attempt || 0);
  const maxAttempts = Number(parsed.maxAttempts || 0);
  if (attempt > 0 && maxAttempts > 0) {
    return `上游请求失败，自动重试 ${attempt}/${maxAttempts}...`;
  }
  return '上游请求失败，正在重试...';
};

const createFlashCliSession = () => ({
  taskId: '',
  running: false,
  process: null
});

const killFlashCliSessionProcess = (session) => {
  if (!session?.process) return;
  try {
    session.process.kill('SIGKILL');
  } catch {
    // ignore
  } finally {
    session.process = null;
    session.running = false;
  }
};

const buildFlashCliArgs = ({ configDir, model, taskId, prompt, workdir }) => {
  const args = [
    'task',
    '--json',
    '--act',
    '--yolo',
    '--timeout',
    String(Math.max(30, Math.floor(flashCliTaskTimeoutMs / 1000))),
    '--config',
    configDir,
    '--cwd',
    workdir
  ];
  if (model) {
    args.push('--model', model);
  }
  if (taskId) {
    args.push('-T', taskId);
  }
  args.push(prompt);
  return args;
};

const ENTERPRISE_FILLER_LINE_RE = /^(好的|当然|收到|已收到|明白|了解|下面|以下|我将|我会|先给出|先汇总|请查看|这里是).{0,100}(经营分析|经营报告|分析报告|报告|图表|洞察|结论)/;
const ENTERPRISE_FILLER_SENTENCE_RE = /(好的|当然|收到|已收到|明白|了解)[，,。！!\s].{0,90}(经营分析|经营报告|分析报告|报告)/g;
const ECHARTS_FENCE_RE_GLOBAL = /```[\t ]*echarts[^\r\n]*\r?\n([\s\S]*?)```/gi;
const ECHARTS_FENCE_RE_SINGLE = /```[\t ]*echarts[^\r\n]*\r?\n([\s\S]*?)```/i;

const stripEnterprisePreambleText = (rawText) => {
  const source = normalizeAiText(rawText);
  if (!source) return '';

  const lines = source.split(/\r?\n/);
  const cleaned = [];
  let removedLineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleaned.push(line);
      continue;
    }
    if (
      removedLineCount < 5 &&
      ENTERPRISE_FILLER_LINE_RE.test(trimmed) &&
      trimmed.length <= 180 &&
      !trimmed.startsWith('```')
    ) {
      removedLineCount += 1;
      continue;
    }
    cleaned.push(line.replace(ENTERPRISE_FILLER_SENTENCE_RE, '').trimEnd());
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const sanitizeJsonLikeText = (raw) => {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  cleaned = cleaned.replace(/^\uFEFF/, '');
  cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  cleaned = cleaned.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
  cleaned = cleaned.replace(/^\s*[^={[]*=\s*/, '');

  const firstBrace = cleaned.search(/[{[]/);
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
  const lastCurly = cleaned.lastIndexOf('}');
  const lastSquare = cleaned.lastIndexOf(']');
  const lastBrace = Math.max(lastCurly, lastSquare);
  if (lastBrace > 0) cleaned = cleaned.slice(0, lastBrace + 1);
  return cleaned.trim();
};

const parseJsonSafe = (raw) => {
  const text = sanitizeJsonLikeText(raw);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/'/g, '"'));
    } catch {
      return null;
    }
  }
};

const stripFunctionValueBlocks = (input) => {
  const text = String(input || '');
  if (!text.includes(': function')) return text;
  let out = '';
  let cursor = 0;
  while (cursor < text.length) {
    const fnToken = text.indexOf(': function', cursor);
    if (fnToken < 0) {
      out += text.slice(cursor);
      break;
    }

    out += text.slice(cursor, fnToken) + ': null';
    let i = fnToken + 1;
    const keyword = text.indexOf('function', i);
    if (keyword < 0) {
      cursor = fnToken + 1;
      continue;
    }
    i = keyword + 'function'.length;
    while (i < text.length && text[i] !== '{') i += 1;
    if (i >= text.length) {
      cursor = text.length;
      break;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
    }
    cursor = i;
  }
  return out;
};

const normalizeEchartsOption = (option) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
  const cloned = JSON.parse(JSON.stringify(option));

  if (cloned.series && !Array.isArray(cloned.series)) {
    cloned.series = [cloned.series];
  }
  if (!Array.isArray(cloned.series)) return null;
  cloned.series = cloned.series.filter((item) => item && typeof item === 'object');
  if (cloned.series.length === 0) return null;

  cloned.series = cloned.series.map((series) => {
    const next = { ...series };
    if (!normalizeAiText(next.type)) next.type = 'line';
    return next;
  });

  const needsAxis = cloned.series.some((series) => {
    const type = String(series.type || '').toLowerCase();
    return ['line', 'bar', 'scatter'].includes(type);
  });
  if (needsAxis) {
    if (!cloned.xAxis) cloned.xAxis = { type: 'category', data: [] };
    if (!cloned.yAxis) cloned.yAxis = { type: 'value' };
  }
  if (!cloned.tooltip) {
    cloned.tooltip = { trigger: needsAxis ? 'axis' : 'item' };
  }

  return cloned;
};

const validateEchartsOption = (option) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return false;
  if (!Array.isArray(option.series) || option.series.length === 0) return false;
  return option.series.every((series) => {
    if (!series || typeof series !== 'object') return false;
    return !!normalizeAiText(series.type);
  });
};

const buildFallbackEchartsOption = () => ({
  animation: false,
  grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
  xAxis: { type: 'category', show: false, data: [''] },
  yAxis: { type: 'value', show: false },
  tooltip: { show: false },
  series: [{
    name: '',
    type: 'line',
    data: [0],
    showSymbol: false,
    lineStyle: { opacity: 0 },
    itemStyle: { opacity: 0 },
    areaStyle: { opacity: 0 }
  }]
});

const extractEchartsBlocks = (text) => {
  const source = normalizeAiText(text);
  if (!source) return [];
  ECHARTS_FENCE_RE_GLOBAL.lastIndex = 0;
  const blocks = [];
  let match;
  while ((match = ECHARTS_FENCE_RE_GLOBAL.exec(source)) !== null) {
    blocks.push({
      start: match.index,
      end: ECHARTS_FENCE_RE_GLOBAL.lastIndex,
      full: match[0],
      body: match[1] || ''
    });
  }
  return blocks;
};

const extractEchartsJsonPayload = (rawText) => {
  const source = normalizeAiText(rawText);
  if (!source) return '';
  const blockMatch = source.match(ECHARTS_FENCE_RE_SINGLE);
  if (blockMatch?.[1]) return blockMatch[1].trim();
  const firstCurly = source.indexOf('{');
  const lastCurly = source.lastIndexOf('}');
  if (firstCurly >= 0 && lastCurly > firstCurly) {
    return source.slice(firstCurly, lastCurly + 1);
  }
  return source.trim();
};

const repairEchartsBlockWithAi = async ({ cfg, agentRuntime, latestUserText, rawBlock, reason }) => {
  const question = normalizeAiText(latestUserText).slice(0, 1200);
  const source = normalizeAiText(rawBlock).slice(0, 8000);
  if (!source) return null;

  const guardPrompt = [
    '你是 ECharts JSON 修复器。',
    '只输出严格合法的 JSON 对象，不要输出解释，不要输出 markdown 代码块。',
    '输出必须可直接 JSON.parse，并可被 ECharts setOption 使用。',
    '必须包含非空 series 数组；每个 series 必须有 type。',
    '禁止注释、禁止尾逗号、禁止单引号键名。',
    '禁止输出任何函数（formatter、itemStyle.color function 等）；需要格式化时改为静态字符串或数组。'
  ].join('\n');

  const upstream = await callAiUpstreamWithRetry({
    stream: false,
    messages: [
      { role: 'system', content: guardPrompt },
      {
        role: 'user',
        content: `用户问题：${question || '（未提供）'}\n修复原因：${normalizeAiText(reason) || 'JSON不可解析'}\n原始 ECharts 内容：\n${source}`
      }
    ]
  }, { cfg, agentRuntime, forceStream: false }, { maxRetries: 3, baseDelayMs: 260 });

  if (!upstream.ok || upstream.stream) return null;
  const candidate = stripFunctionValueBlocks(
    extractEchartsJsonPayload(cleanModelText(extractCompletionText(upstream.data)))
  );
  const parsed = parseJsonSafe(candidate);
  const normalized = normalizeEchartsOption(parsed);
  if (!validateEchartsOption(normalized)) return null;
  return normalized;
};

const normalizeEnterpriseEchartsBlocks = async ({ rawText, cfg, agentRuntime, latestUserText }) => {
  const source = normalizeAiText(rawText);
  if (!source) return { text: '', changed: false };
  const blocks = extractEchartsBlocks(source);
  if (blocks.length === 0) return { text: source, changed: false };

  let cursor = 0;
  let output = '';
  let changed = false;

  for (const block of blocks) {
    output += source.slice(cursor, block.start);
    cursor = block.end;

    let option = normalizeEchartsOption(parseJsonSafe(stripFunctionValueBlocks(block.body)));
    if (!validateEchartsOption(option)) {
      for (let attempt = 0; attempt < 6 && !validateEchartsOption(option); attempt += 1) {
        option = await repairEchartsBlockWithAi({
          cfg,
          agentRuntime,
          latestUserText,
          rawBlock: block.body,
          reason: `ECharts JSON parse/validate failed (attempt ${attempt + 1})`
        });
      }
    }
    if (!validateEchartsOption(option)) {
      option = buildFallbackEchartsOption();
    }

    const replacement = `\`\`\`echarts\n${JSON.stringify(option, null, 2)}\n\`\`\``;
    if (replacement !== block.full) changed = true;
    output += replacement;
  }

  output += source.slice(cursor);
  return { text: output, changed };
};

const rewriteEnterpriseResponse = async ({ cfg, agentRuntime, latestUserText, rawAnswer }) => {
  const answer = normalizeAiText(rawAnswer).slice(0, 20000);
  if (!answer) return '';
  const question = normalizeAiText(latestUserText).slice(0, 4000);
  const guardPrompt = [
    '你是企业经营分析智能体的输出守卫。',
    '你需要把回答改写为经营分析结果，禁止任何流程编排相关内容。',
    '严格删除：BPMN XML、workflow-meta、Mermaid流程图、审批节点定义。',
    '去掉客套开场语（如“好的、收到、我将…”），直接给报告正文。',
    '保持原回答中的经营分析结论和可执行建议。',
    '只输出最终正文，不要解释你做了什么。'
  ].join('\n');

  const upstream = await callAiUpstreamWithRetry({
    stream: false,
    messages: [
      { role: 'system', content: guardPrompt },
      {
        role: 'user',
        content: `用户问题：${question || '（未提供）'}\n\n原始回答：\n${answer}`
      }
    ]
  }, { cfg, agentRuntime, forceStream: false }, { maxRetries: 1, baseDelayMs: 240 });

  if (!upstream.ok || upstream.stream) return '';
  return cleanModelText(extractCompletionText(upstream.data));
};

const applyEnterpriseOutputGuard = async ({ data, route, cfg, agentRuntime }) => {
  if (!shouldApplyEnterpriseOutputGuard(route)) {
    return { guardedData: data, guardApplied: false };
  }

  const rawText = extractCompletionText(data);
  let guardedText = normalizeAiText(rawText);
  if (!guardedText) {
    return { guardedData: data, guardApplied: false };
  }

  let guardApplied = false;

  if (containsWorkflowLeak(guardedText)) {
    const rewritten = await rewriteEnterpriseResponse({
      cfg,
      agentRuntime,
      latestUserText: route?.latestUserText,
      rawAnswer: guardedText
    });
    if (rewritten) {
      guardedText = rewritten;
      guardApplied = true;
    }
  }

  const noPreambleText = stripEnterprisePreambleText(guardedText);
  if (noPreambleText && noPreambleText !== guardedText) {
    guardedText = noPreambleText;
    guardApplied = true;
  }

  const chartGuarded = await normalizeEnterpriseEchartsBlocks({
    rawText: guardedText,
    cfg,
    agentRuntime,
    latestUserText: route?.latestUserText
  });
  if (chartGuarded.changed && chartGuarded.text) {
    guardedText = chartGuarded.text;
    guardApplied = true;
  }

  if (!guardApplied) {
    return { guardedData: data, guardApplied: false };
  }

  return {
    guardedData: replaceCompletionText(data, guardedText),
    guardApplied: true
  };
};

const writeSsePayload = (res, payload) => {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};

const writeSseDone = (res) => {
  if (!res.writableEnded) {
    res.write('data: [DONE]\n\n');
    res.end();
  }
};

const streamTextAsSse = (res, text, chunkSize = 800) => {
  const output = normalizeAiText(text);
  if (!output) {
    writeSseDone(res);
    return;
  }
  for (let start = 0; start < output.length; start += chunkSize) {
    const chunk = output.slice(start, start + chunkSize);
    writeSsePayload(res, { choices: [{ delta: { content: chunk } }] });
  }
  writeSseDone(res);
};

const authorizeHttpRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload, token);
  if (!canUseAi(user)) {
    sendJson(res, 403, { code: 'FORBIDDEN', message: 'AI access denied for current role' });
    return null;
  }
  return user;
};

const handleAiConfig = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  try {
    const cfg = await getAiConfig();
    const agents = buildAgentCatalog(user, cfg);
    sendJson(res, 200, {
      enabled: !!(cfg?.api_url && cfg?.api_key),
      model: cfg?.model || 'glm-4.6v',
      provider: cfg?.provider || 'glm',
      stream: true,
      agents
    });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_CONFIG_LOAD_FAILED', message: error.message || 'Failed to load AI config' });
  }
};

const handleAiAgents = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;
  try {
    const cfg = await getAiConfig();
    const agents = buildAgentCatalog(user, cfg);
    sendJson(res, 200, { role: user.role || '', agents });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_CONFIG_LOAD_FAILED', message: error.message || 'Failed to load AI config' });
  }
};

// ── 轻量本体语义上下文采集 ───────────────────────────────────
const fetchSemanticContext = async (user) => {
  const semantic = {};
  const safeQuery = async (label, opts) => {
    try {
      const result = await callPostgrestWithUser(user, { ...opts, timeoutMs: 5000 });
      return result?.data;
    } catch (e) {
      console.warn(`[semantic-ctx] ${label} failed:`, e?.message || e);
      return null;
    }
  };

  // 1. 表级语义（仅激活的）
  const tables = await safeQuery('table_semantics', {
    method: 'GET', path: '/ontology_table_semantics',
    query: { select: 'table_schema,table_name,semantic_name,semantic_description,tags', is_active: 'eq.true', order: 'table_schema.asc,table_name.asc', limit: '200' },
    acceptProfile: 'public'
  });
  if (Array.isArray(tables) && tables.length) {
    semantic.tables = tables.map(t => ({
      schema: t.table_schema,
      table: t.table_name,
      name: t.semantic_name,
      desc: t.semantic_description || '',
      tags: t.tags || []
    }));
  }

  // 2. 列级语义（仅激活的，按表分组压缩）
  const columns = await safeQuery('column_semantics', {
    method: 'GET', path: '/ontology_column_semantics',
    query: { select: 'table_schema,table_name,column_name,semantic_name,semantic_class,data_type,ui_type', is_active: 'eq.true', order: 'table_schema.asc,table_name.asc,column_name.asc', limit: '1000' },
    acceptProfile: 'public'
  });
  if (Array.isArray(columns) && columns.length) {
    const grouped = {};
    for (const c of columns) {
      const key = `${c.table_schema}.${c.table_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        col: c.column_name,
        name: c.semantic_name,
        cls: c.semantic_class || '',
        type: c.data_type || '',
        ui: c.ui_type || ''
      });
    }
    semantic.columns = grouped;
  }

  // 3. 表间关系
  const relations = await safeQuery('table_relations', {
    method: 'GET', path: '/ontology_table_relations',
    query: { select: 'subject_table,predicate,object_table,subject_semantic_name,object_semantic_name,relation_type', relation_type: 'eq.ontology', limit: '200' },
    acceptProfile: 'app_data'
  });
  if (Array.isArray(relations) && relations.length) {
    semantic.relations = relations.map(r => ({
      from: r.subject_table,
      to: r.object_table,
      predicate: r.predicate || '',
      fromName: r.subject_semantic_name || '',
      toName: r.object_semantic_name || ''
    }));
  }

  // 4. 权限语义视图（压缩输出）
  const permissions = await safeQuery('permission_ontology', {
    method: 'GET', path: '/v_permission_ontology',
    query: { select: 'code,scope,semantic_kind,entity_key,action_key', limit: '200' },
    acceptProfile: 'public'
  });
  if (Array.isArray(permissions) && permissions.length) {
    semantic.permissions = permissions.map(p => ({
      code: p.code,
      scope: p.scope,
      kind: p.semantic_kind,
      entity: p.entity_key || '',
      action: p.action_key || ''
    }));
  }

  semantic.fetchedAt = new Date().toISOString();

  const tableCnt = semantic.tables?.length || 0;
  const colCnt = columns?.length || 0;
  const relCnt = semantic.relations?.length || 0;
  const permCnt = semantic.permissions?.length || 0;
  console.log(`[semantic-ctx] user=${user?.username || '?'} => tables:${tableCnt}, columns:${colCnt}, relations:${relCnt}, permissions:${permCnt}`);

  return (tableCnt + colCnt + relCnt + permCnt) > 0 ? semantic : null;
};

// ── 企业经营助手：业务数据快照采集 ───────────────────────────
const fetchBusinessSnapshot = async (user) => {
  const snapshot = {};
  const safeQuery = async (label, opts) => {
    try {
      const result = await callPostgrestWithUser(user, { ...opts, timeoutMs: 5000 });
      return result?.data;
    } catch (e) {
      console.warn(`[biz-snapshot] ${label} failed:`, e?.message || e);
      return null;
    }
  };

  // 1. 仓库列表（含全级别，按 level+sort 排序）
  const warehouses = await safeQuery('warehouses', {
    method: 'GET', path: '/warehouses',
    query: { select: 'id,code,name,level,status', order: 'level.asc,sort.asc', limit: '50' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(warehouses)) {
    snapshot.warehouses = { total: warehouses.length, list: warehouses.map(w => ({ code: w.code, name: w.name, level: w.level, status: w.status })) };
  }

  // 2. 库存汇总 (v_inventory_current)
  const inventory = await safeQuery('inventory', {
    method: 'GET', path: '/v_inventory_current',
    query: { select: 'warehouse_name,material_name,material_code,available_qty,unit', limit: '200', order: 'available_qty.desc' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(inventory)) {
    const totalQty = inventory.reduce((s, r) => s + (Number(r.available_qty) || 0), 0);
    const materialCount = new Set(inventory.map(r => r.material_code)).size;
    const warehouseNames = [...new Set(inventory.map(r => r.warehouse_name))];
    const top10 = inventory.slice(0, 10).map(r => ({
      warehouse: r.warehouse_name, material: r.material_name,
      code: r.material_code, qty: r.available_qty, unit: r.unit
    }));
    snapshot.inventory = { totalRecords: inventory.length, totalQty, materialCount, warehouseNames, top10 };
  }

  // 3. 最近出入库流水（使用视图 v_inventory_transactions，含物料名称和仓库名称）
  const transactions = await safeQuery('transactions', {
    method: 'GET', path: '/v_inventory_transactions',
    query: { select: 'id,transaction_type,io_type,material_name,material_code,quantity,unit,warehouse_name,transaction_date', order: 'transaction_date.desc', limit: '30' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(transactions)) {
    const inCount = transactions.filter(t => t.transaction_type === '入库').length;
    const outCount = transactions.filter(t => t.transaction_type === '出库').length;
    snapshot.recentTransactions = {
      total: transactions.length, inCount, outCount,
      latest: transactions.slice(0, 10).map(t => ({
        type: t.transaction_type, ioType: t.io_type, material: t.material_name,
        code: t.material_code, qty: t.quantity, unit: t.unit,
        warehouse: t.warehouse_name, date: t.transaction_date
      }))
    };
  }

  // 4. 物料主数据统计
  const materials = await safeQuery('materials', {
    method: 'GET', path: '/raw_materials',
    query: { select: 'id,name,category', limit: '500' },
    acceptProfile: 'public'
  });
  if (Array.isArray(materials)) {
    const categories = {};
    materials.forEach(m => { const c = m.category || '未分类'; categories[c] = (categories[c] || 0) + 1; });
    snapshot.materials = { total: materials.length, byCategory: categories };
  }

  // 5. 员工统计
  const employees = await safeQuery('employees', {
    method: 'GET', path: '/employees',
    query: { select: 'id,department', limit: '500' },
    acceptProfile: 'public'
  });
  if (Array.isArray(employees)) {
    const depts = {};
    employees.forEach(e => { const d = e.department || '未分配'; depts[d] = (depts[d] || 0) + 1; });
    snapshot.employees = { total: employees.length, byDepartment: depts };
  }

  // 6. 盘点单统计
  const checks = await safeQuery('checks', {
    method: 'GET', path: '/inventory_checks',
    query: { select: 'id,check_no,status,check_date,total_items,diff_count,created_at', order: 'created_at.desc', limit: '50' },
    acceptProfile: 'scm'
  });
  if (Array.isArray(checks)) {
    const statusCount = {};
    checks.forEach(c => { const s = c.status || '未知'; statusCount[s] = (statusCount[s] || 0) + 1; });
    snapshot.inventoryChecks = { total: checks.length, byStatus: statusCount };
  }

  // 7. 应用列表
  const apps = await safeQuery('apps', {
    method: 'GET', path: '/apps',
    query: { select: 'id,name,app_type,status', order: 'created_at.desc', limit: '50' },
    acceptProfile: 'app_center'
  });
  if (Array.isArray(apps)) {
    snapshot.apps = { total: apps.length, list: apps.slice(0, 20).map(a => ({ name: a.name, type: a.app_type, status: a.status })) };
  }

  snapshot.snapshotTime = new Date().toISOString();

  // 输出快照摘要日志（方便调试）
  const keys = Object.keys(snapshot).filter(k => k !== 'snapshotTime');
  const summary = keys.map(k => {
    const v = snapshot[k];
    return `${k}:${v?.total ?? (v?.totalRecords ?? '?')}`;
  }).join(', ');
  console.log(`[biz-snapshot] user=${user?.username || '?'} => ${summary}`);

  return snapshot;
};

const handleAiChat = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  try {
    const cfg = await getAiConfig();
    const sanitizedMessages = sanitizeConversationMessages(body?.messages);
    const route = resolveAgentRoute({ user, body, messages: sanitizedMessages });

    // ── 所有 agent：注入本体语义上下文 ──
    try {
      const semanticCtx = await fetchSemanticContext(user);
      if (semanticCtx) {
        if (!route.context) route.context = {};
        route.context.semanticContext = semanticCtx;
      }
    } catch (semErr) {
      console.warn('[ai-chat] semantic context fetch failed:', semErr?.message || semErr);
    }

    // ── 企业经营助手：自动注入业务数据快照 ──
    if (route.agentId === 'enterprise_analyst') {
      try {
        const snapshot = await fetchBusinessSnapshot(user);
        if (!route.context) route.context = {};
        route.context.businessSnapshot = snapshot;
      } catch (snapErr) {
        console.warn('[ai-chat] business snapshot fetch failed:', snapErr?.message || snapErr);
      }
    }

    const agentRuntime = resolveAgentRuntimeConfig(cfg, route.agentId);
    const useStream = body?.stream === true;
    const requiresGuard = shouldApplyEnterpriseOutputGuard(route);
    const upstreamPayload = {
      ...body,
      messages: composeAgentMessages({ route, user, messages: sanitizedMessages })
    };
    console.log('[ai-route]', JSON.stringify({
      role: user.role || '',
      mode: route.requestedMode,
      intent: route.intent,
      agent: route.agentId,
      model: agentRuntime.model,
      guard: requiresGuard,
      sample: route.latestUserText.slice(0, 120)
    }));

    const upstream = await callAiUpstreamWithRetry(upstreamPayload, {
      forceStream: useStream && !requiresGuard,
      cfg,
      agentRuntime
    }, {
      maxRetries: 2,
      baseDelayMs: 320
    });
    if (!upstream.ok) {
      sendJson(res, upstream.status, upstream.payload);
      return;
    }

    if (!upstream.stream) {
      const guarded = await applyEnterpriseOutputGuard({
        data: upstream.data || {},
        route,
        cfg,
        agentRuntime
      });
      const headers = {
        'X-Eis-Ai-Agent': route.agentId,
        'X-Eis-Ai-Intent': route.intent,
        'X-Eis-Ai-Guard': guarded.guardApplied ? 'rewrite' : 'pass'
      };

      if (!useStream) {
        sendJson(res, 200, guarded.guardedData || {}, headers);
        return;
      }

      setCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...headers
      });
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      streamTextAsSse(res, extractCompletionText(guarded.guardedData || {}));
      return;
    }

    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Eis-Ai-Agent': route.agentId,
      'X-Eis-Ai-Intent': route.intent,
      'X-Eis-Ai-Guard': 'stream-pass'
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const stream = upstream.response.body;
    if (!stream || typeof stream.getReader !== 'function') {
      sendJson(res, 502, { code: 'AI_STREAM_FAILED', message: 'AI upstream stream is unavailable' });
      return;
    }

    const reader = stream.getReader();
    const abortStream = () => {
      reader.cancel().catch(() => {});
    };
    req.on('close', abortStream);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && !res.writableEnded) {
          res.write(Buffer.from(value));
        }
      }
      if (!res.writableEnded) res.end();
    } catch (e) {
      if (!res.writableEnded) {
        res.write('data: {"error":"stream_failed"}\n\n');
        res.end();
      }
    } finally {
      req.off('close', abortStream);
      try {
        reader.releaseLock();
      } catch (err) {
        // ignore
      }
    }
  } catch (error) {
    sendJson(res, 500, { code: 'AI_CHAT_FAILED', message: error.message || 'AI chat failed' });
  }
};

const handleAiTranslate = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const text = normalizeAiText(body?.text);
  if (!text) {
    sendJson(res, 400, { code: 'TEXT_REQUIRED', message: 'text is required' });
    return;
  }

  const systemPrompt = normalizeAiText(body?.prompt) ||
    '你是翻译助手。把用户输入翻译成简洁、自然的中文地址，只输出翻译结果，不要添加任何解释。若输入已是中文，原样输出。';

  try {
    const upstream = await callAiUpstreamWithRetry({
      model: body?.model,
      stream: false,
      thinking: body?.thinking || { type: 'disabled' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    }, { forceStream: false }, { maxRetries: 1, baseDelayMs: 260 });

    if (!upstream.ok) {
      sendJson(res, upstream.status, upstream.payload);
      return;
    }

    const translated = cleanModelText(extractCompletionText(upstream.data));
    sendJson(res, 200, { text: translated || text });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_TRANSLATE_FAILED', message: error.message || 'Translate failed' });
  }
};

const handleAiMapLocate = async (req, res) => {
  const user = authorizeHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const imageUrl = normalizeAiText(body?.imageUrl || body?.image_url);
  const lat = body?.lat;
  const lng = body?.lng;
  if (!imageUrl) {
    sendJson(res, 400, { code: 'IMAGE_REQUIRED', message: 'imageUrl is required' });
    return;
  }

  const prompt = normalizeAiText(body?.prompt) ||
    `请根据地图截图上的中文地名，且以蓝色圆点为用户当前位置，找出离蓝点最近的街道级位置。输出严格格式的中文位置：“省-市-区/县/县级市-街道/乡镇”。必须包含街道级；如果无法确定街道，请用“某街道”或“附近街道”占位，但仍要输出四段。只输出位置，不要解释，不要多余的话。坐标：${lng},${lat}`;

  try {
    const upstream = await callAiUpstreamWithRetry({
      model: body?.model,
      stream: false,
      thinking: body?.thinking || { type: 'disabled' },
      messages: [
        { role: 'system', content: '你是位置识别助手，只输出中文位置名称。' },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ]
    }, { forceStream: false }, { maxRetries: 1, baseDelayMs: 260 });

    if (!upstream.ok) {
      sendJson(res, upstream.status, upstream.payload);
      return;
    }

    const address = cleanModelText(extractCompletionText(upstream.data));
    sendJson(res, 200, { address });
  } catch (error) {
    sendJson(res, 500, { code: 'AI_MAP_LOCATE_FAILED', message: error.message || 'Map locate failed' });
  }
};

const authorizeAgentHttpRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  const user = asUser(payload);
  if (!canUseAgent(user)) {
    sendJson(res, 403, { code: 'FORBIDDEN', message: 'Agent access denied for current role' });
    return null;
  }
  user.token = token;
  return user;
};

function requireNonEmptyText(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    throw new FlashToolError('VALIDATION_FAILED', `${fieldName} is required`, { httpStatus: 400 });
  }
  return text;
}

async function readFlashDraftSource() {
  const target = resolveFlashDraftFilePath();
  const content = await fs.promises.readFile(target, 'utf8');
  return {
    path: normalizeProjectPath(`${flashCliProjectPath}/${flashDraftFileName}`),
    content,
    bytes: Buffer.byteLength(content, 'utf8')
  };
}

async function writeFlashDraftSource(content, reason = '', user = null) {
  const text = String(content || '');
  if (!text.trim()) {
    throw new FlashToolError('VALIDATION_FAILED', 'content is required', { httpStatus: 400 });
  }
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > 1024 * 1024) {
    throw new FlashToolError('VALIDATION_FAILED', 'content exceeds 1MB limit', { httpStatus: 400 });
  }

  const target = resolveFlashDraftFilePath();
  await ensureDir(path.dirname(target));
  await fs.promises.writeFile(target, text, 'utf8');
  if (user) {
    logAgentEvent('flash:draft_write', user, {
      bytes,
      reason: normalizeAiText(reason).slice(0, 80)
    });
  }
  return {
    path: normalizeProjectPath(`${flashCliProjectPath}/${flashDraftFileName}`),
    bytes
  };
}

async function uploadFlashAttachment(body = {}, user = null) {
  const appId = sanitizePathToken(body?.appId, 'app');
  const conversationId = sanitizePathToken(body?.conversationId, 'default');
  const fileName = sanitizeUploadFileName(body?.fileName);
  const mimeType = normalizeAiText(body?.mimeType || body?.contentType).slice(0, 120) || 'application/octet-stream';
  const binary = decodeBase64Payload(body?.contentBase64 || body?.base64);

  if (!binary.length) {
    throw new FlashToolError('VALIDATION_FAILED', 'contentBase64 is required', { httpStatus: 400 });
  }
  if (binary.length > flashAttachmentMaxBytes) {
    throw new FlashToolError('VALIDATION_FAILED', `attachment exceeds ${flashAttachmentMaxBytes} bytes`, { httpStatus: 400 });
  }

  const taskWorkdir = resolveFlashCliWorkdir();
  const targetInfo = buildSafeUploadPath(taskWorkdir, appId, conversationId, fileName);
  await ensureDir(targetInfo.baseDir);

  let finalName = targetInfo.safeName;
  let targetPath = targetInfo.candidate;
  let suffix = 1;
  while (fs.existsSync(targetPath)) {
    const ext = path.extname(targetInfo.safeName);
    const stem = targetInfo.safeName.slice(0, Math.max(1, targetInfo.safeName.length - ext.length));
    finalName = `${stem}-${suffix}${ext}`;
    targetPath = path.resolve(targetInfo.baseDir, finalName);
    suffix += 1;
  }

  await fs.promises.writeFile(targetPath, binary);
  const relativePath = path.relative(path.resolve(taskWorkdir), targetPath).replace(/\\/g, '/');
  const uploadedAt = new Date().toISOString();

  let textPreview = '';
  if (isTextLikeAttachment(finalName, mimeType)) {
    try {
      const utf8 = binary.toString('utf8');
      textPreview = normalizeAiText(utf8).slice(0, flashAttachmentPreviewMaxChars);
    } catch {
      textPreview = '';
    }
  }

  if (user) {
    logAgentEvent('flash:attachment_upload', user, {
      appId,
      conversationId,
      name: finalName,
      mimeType,
      size: binary.length
    });
  }

  return {
    id: `att-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    appId,
    conversationId,
    name: finalName,
    mimeType,
    size: binary.length,
    relativePath,
    textPreview,
    uploadedAt
  };
}

function normalizeFlashToolCallEnvelope(rawInput = {}) {
  const payload = toPlainObject(rawInput);
  const args = toPlainObject(payload.arguments);
  const context = toPlainObject(payload.context);
  const traceId = sanitizeTraceId(payload.trace_id || payload.traceId || payload.trace) || generateTraceId('tr');
  const toolId = resolveFlashToolId(payload.tool_id || payload.toolId);
  const idempotencyKey = sanitizeIdempotencyKey(payload.idempotency_key || payload.idempotencyKey);
  const sessionId = sanitizePathToken(payload.session_id || payload.sessionId || context.sessionId, 'default');
  const appId = String(payload.app_id || payload.appId || args.appId || '').trim();
  const confirmed = normalizeToolCallBoolean(
    payload.confirmed ?? payload.confirm ?? context.confirmed ?? context.confirm
  );
  return {
    traceId,
    toolId,
    idempotencyKey,
    sessionId,
    appId,
    arguments: args,
    context,
    confirmed
  };
}

async function executeFlashSemanticTool(toolId, args, user, callContext) {
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
      const { schema, table } = resolveDataTableTarget(requestArgs.table);
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 50, 500);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: `/${table}`,
        query,
        acceptProfile: schema,
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '表格列表查询成功', data: { schema, table, items }, rowsAffected: items.length };
    }
    case 'flash.data.grid.detail': {
      const { schema, table } = resolveDataTableTarget(requestArgs.table);
      const recordId = requireNonEmptyText(requestArgs.id || requestArgs.recordId, 'id');
      const query = sanitizeQueryParams(requestArgs.query);
      query.id = `eq.${recordId}`;
      if (!query.limit) query.limit = '1';
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: `/${table}`,
        query,
        acceptProfile: schema,
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: item ? '表格详情查询成功' : '数据不存在', data: { schema, table, item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.data.grid.export': {
      const { schema, table } = resolveDataTableTarget(requestArgs.table);
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 500, 5000);
      if (!query.order && requestArgs.order) query.order = String(requestArgs.order);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: `/${table}`,
        query,
        acceptProfile: schema,
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
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
      return { message: '数据应用表初始化成功', data: { table: normalizeAiText(tableFqn) }, rowsAffected: 1 };
    }
    case 'flash.data.grid.create': {
      const { schema, table } = resolveDataTableTarget(requestArgs.table);
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.record);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.data.grid.create', { httpStatus: 400 });
      }
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: `/${table}`,
        body: payload,
        acceptProfile: schema,
        contentProfile: schema,
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '表格记录创建成功', data: { schema, table, item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.data.grid.update': {
      const { schema, table } = resolveDataTableTarget(requestArgs.table);
      const recordId = requireNonEmptyText(requestArgs.id || requestArgs.recordId, 'id');
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.patch);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.data.grid.update', { httpStatus: 400 });
      }
      const upstream = await callPostgrestWithUser(user, {
        method: 'PATCH',
        path: `/${table}`,
        query: { id: `eq.${recordId}` },
        body: payload,
        acceptProfile: schema,
        contentProfile: schema,
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '表格记录更新成功', data: { schema, table, item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.data.grid.delete': {
      const { schema, table } = resolveDataTableTarget(requestArgs.table);
      const recordId = requireNonEmptyText(requestArgs.id || requestArgs.recordId, 'id');
      const upstream = await callPostgrestWithUser(user, {
        method: 'DELETE',
        path: `/${table}`,
        query: { id: `eq.${recordId}` },
        acceptProfile: schema,
        contentProfile: schema,
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
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
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/v_inventory_current',
        query,
        acceptProfile: 'scm',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '库存查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.inventory.draft.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      const draftType = String(requestArgs.draftType || requestArgs.draft_type || '').trim();
      if (draftType && !query.draft_type) query.draft_type = `eq.${draftType}`;
      if (!query.order) query.order = 'created_at.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 80, 500);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/v_inventory_drafts',
        query,
        acceptProfile: 'scm',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '库存草稿查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.material.master.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.order) query.order = 'id.asc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 100, 500);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/raw_materials',
        query,
        acceptProfile: 'public',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '物料主数据查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.warehouse.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.order) query.order = 'code.asc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 100, 500);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/warehouses',
        query,
        acceptProfile: 'scm',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '仓库列表查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.hr.archive.list': {
      const query = sanitizeQueryParams(requestArgs.query || requestArgs.filters);
      if (!query.order) query.order = 'id.desc';
      if (!query.limit) query.limit = normalizeLimit(requestArgs.limit, 80, 500);
      const upstream = await callPostgrestWithUser(user, {
        method: 'GET',
        path: '/archives',
        query,
        acceptProfile: 'hr',
        traceId: callContext.traceId
      });
      const items = Array.isArray(upstream.data) ? upstream.data : [];
      return { message: '人事档案查询成功', data: { items }, rowsAffected: items.length };
    }
    case 'flash.hr.archive.update': {
      const archiveId = requireNonEmptyText(requestArgs.id || requestArgs.archiveId || requestArgs.recordId, 'id');
      const payload = toPlainObject(requestArgs.payload || requestArgs.data || requestArgs.patch);
      if (!Object.keys(payload).length) {
        throw new FlashToolError('VALIDATION_FAILED', 'payload is required for flash.hr.archive.update', { httpStatus: 400 });
      }
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
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '人事档案更新成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.hr.attendance.init': {
      const date = requireNonEmptyText(requestArgs.date || requestArgs.attDate || requestArgs.p_date, 'date');
      const dept = requestArgs.deptName ?? requestArgs.dept_name ?? requestArgs.p_dept_name ?? null;
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
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: '/inventory_drafts',
        body: payload,
        acceptProfile: 'scm',
        contentProfile: 'scm',
        prefer: 'return=representation',
        traceId: callContext.traceId
      });
      const item = Array.isArray(upstream.data) ? (upstream.data[0] || null) : null;
      return { message: '库存草稿创建成功', data: { item }, rowsAffected: item ? 1 : 0 };
    }
    case 'flash.inventory.batchno.generate': {
      const payload = {
        p_rule_id: requestArgs.ruleId ?? requestArgs.rule_id ?? requestArgs.p_rule_id,
        p_material_id: requestArgs.materialId ?? requestArgs.material_id ?? requestArgs.p_material_id,
        p_manual_override: requestArgs.manualOverride ?? requestArgs.manual_override ?? requestArgs.p_manual_override ?? null
      };
      payload.p_rule_id = requireNonEmptyText(payload.p_rule_id, 'ruleId');
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
      const batchNo = normalizeAiText(upstream.data);
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
      const rpcPath = toolId === 'flash.inventory.stock.out' ? '/rpc/stock_out' : '/rpc/stock_in';
      const upstream = await callPostgrestWithUser(user, {
        method: 'POST',
        path: rpcPath,
        body: payload,
        acceptProfile: 'scm',
        contentProfile: 'scm',
        traceId: callContext.traceId
      });
      const item = toPlainObject(upstream.data);
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
      const data = await readFlashDraftSource();
      return { message: '草稿读取成功', data, rowsAffected: 1 };
    }
    case 'flash.draft.write': {
      const content = requestArgs.content;
      const reason = requestArgs.reason || callContext.context.reason || '';
      const data = await writeFlashDraftSource(content, reason, user);
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
}

async function executeFlashToolCall(user, rawPayload = {}, source = 'http') {
  const startedAt = Date.now();
  const call = normalizeFlashToolCallEnvelope(rawPayload);
  if (!call.toolId) {
    const errorResponse = {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'tool_id is required',
      tool_id: '',
      trace_id: call.traceId,
      error: { reason_code: 'VALIDATION_FAILED', http_status: 400 }
    };
    return { status: 400, payload: errorResponse };
  }

  const tool = flashSemanticToolMap.get(call.toolId);
  if (!tool) {
    const errorResponse = {
      ok: false,
      code: 'TOOL_NOT_FOUND',
      message: `tool_id not found: ${call.toolId}`,
      tool_id: call.toolId,
      trace_id: call.traceId,
      error: { reason_code: 'TOOL_NOT_FOUND', http_status: 404 }
    };
    return { status: 404, payload: errorResponse };
  }

  const isWriteTool = tool.confirm_required || tool.risk_level !== 'low';
  if (isWriteTool && !call.confirmed) {
    const errorResponse = {
      ok: false,
      code: 'PERMISSION_DENIED',
      message: 'write tool requires confirmed=true',
      tool_id: call.toolId,
      trace_id: call.traceId,
      error: { reason_code: 'PERMISSION_DENIED', http_status: 403 }
    };
    return { status: 403, payload: errorResponse };
  }

  if (isWriteTool && !call.idempotencyKey) {
    const errorResponse = {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: 'idempotency_key is required for write tools',
      tool_id: call.toolId,
      trace_id: call.traceId,
      error: { reason_code: 'VALIDATION_FAILED', http_status: 400 }
    };
    return { status: 400, payload: errorResponse };
  }

  cleanupFlashToolIdempotencyCache();
  let cacheKey = '';
  if (isWriteTool && call.idempotencyKey) {
    cacheKey = makeFlashToolIdempotencyCacheKey(user, call.toolId, call.idempotencyKey);
    const cached = flashToolIdempotencyCache.get(cacheKey);
    if (cached && cached.expireAt > Date.now()) {
      const replay = cloneJsonValue(cached.payload);
      replay.meta = {
        ...(toPlainObject(replay.meta)),
        idempotent_replay: true
      };
      return { status: 200, payload: replay };
    }
  }

  try {
    const result = await executeFlashSemanticTool(call.toolId, call.arguments, user, call);
    const responsePayload = {
      ok: true,
      code: 'OK',
      message: normalizeAiText(result?.message) || 'OK',
      tool_id: call.toolId,
      trace_id: call.traceId,
      registry_version: flashSemanticToolRegistryVersion,
      registry_tools_count_actual: flashSemanticToolRegistry.length,
      data: cloneJsonValue(result?.data),
      meta: {
        risk_level: tool.risk_level,
        duration_ms: Date.now() - startedAt,
        rows_affected: Number(result?.rowsAffected || 0),
        source
      }
    };
    if (cacheKey) {
      flashToolIdempotencyCache.set(cacheKey, {
        expireAt: Date.now() + flashToolIdempotencyTtlMs,
        payload: cloneJsonValue(responsePayload)
      });
    }
    logAgentEvent('flash:tool_call_ok', user, {
      tool_id: call.toolId,
      trace_id: call.traceId,
      source,
      duration_ms: responsePayload.meta.duration_ms
    });
    return { status: 200, payload: responsePayload };
  } catch (error) {
    const isTypedError = error instanceof FlashToolError;
    const code = isTypedError ? error.code : 'INTERNAL_ERROR';
    const httpStatus = isTypedError ? error.httpStatus : 500;
    const responsePayload = {
      ok: false,
      code,
      message: normalizeAiText(error?.message) || 'Tool execution failed',
      tool_id: call.toolId,
      trace_id: call.traceId,
      registry_version: flashSemanticToolRegistryVersion,
      registry_tools_count_actual: flashSemanticToolRegistry.length,
      error: {
        reason_code: isTypedError ? error.reasonCode : code,
        http_status: httpStatus,
        data: cloneJsonValue(isTypedError ? error.data : null)
      }
    };
    logAgentEvent('flash:tool_call_fail', user, {
      tool_id: call.toolId,
      trace_id: call.traceId,
      source,
      code,
      message: responsePayload.message
    });
    return { status: httpStatus, payload: responsePayload };
  }
}

const handleFlashToolsRegistryGet = async (req, res) => {
  const user = authorizeAgentHttpRequest(req, res);
  if (!user) return;
  sendJson(res, 200, getFlashToolRegistryPayload());
};

const handleFlashToolCallHttp = async (req, res) => {
  const user = authorizeAgentHttpRequest(req, res);
  if (!user) return;
  let body = {};
  try {
    body = await readJsonBody(req, 4 * 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }
  const result = await executeFlashToolCall(user, body, 'http');
  sendJson(res, result.status, result.payload);
};

const handleFlashToolCallWs = async (ws, payload) => {
  if (!canUseAgent(ws.user)) {
    sendWsJson(ws, {
      type: 'flash:tool_result',
      ok: false,
      code: 'PERMISSION_DENIED',
      message: 'Forbidden: agent access denied'
    });
    return;
  }
  const requestId = String(payload?.requestId || payload?.request_id || '').trim();
  const body = payload?.payload && typeof payload.payload === 'object' ? payload.payload : payload;
  const result = await executeFlashToolCall(ws.user, body, 'ws');
  sendWsJson(ws, {
    type: 'flash:tool_result',
    requestId,
    ...result.payload
  });
};

const handleFlashDraftGet = async (req, res) => {
  const user = authorizeAgentHttpRequest(req, res);
  if (!user) return;
  try {
    const data = await readFlashDraftSource();
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, {
      code: 'FLASH_DRAFT_READ_FAILED',
      message: error?.message || 'Read flash draft failed'
    });
  }
};

const handleFlashDraftWrite = async (req, res) => {
  const user = authorizeAgentHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  try {
    const data = await writeFlashDraftSource(body?.content, body?.reason, user);
    sendJson(res, 200, { ok: true, ...data });
  } catch (error) {
    const status = error instanceof FlashToolError ? error.httpStatus : 500;
    sendJson(res, status, {
      code: status === 400 ? 'BAD_REQUEST' : 'FLASH_DRAFT_WRITE_FAILED',
      message: error?.message || 'Write flash draft failed'
    });
  }
};

const handleFlashAttachmentUpload = async (req, res) => {
  const user = authorizeAgentHttpRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req, Math.max(2 * 1024 * 1024, flashAttachmentMaxBytes * 2));
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  try {
    const file = await uploadFlashAttachment(body, user);
    sendJson(res, 200, { ok: true, file });
  } catch (error) {
    const status = error instanceof FlashToolError ? error.httpStatus : 500;
    sendJson(res, status, {
      code: status === 400 ? 'BAD_REQUEST' : 'FLASH_ATTACHMENT_UPLOAD_FAILED',
      message: error?.message || 'Attachment upload failed'
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// ── 员工数字分身 (Digital Twin) API Handlers ─────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * 数字分身授权（复用 authorizeHttpRequest 逻辑但也允许普通员工角色）
 */
const authorizeTwinRequest = (req, res) => {
  const token = getBearerFromAuthHeader(req);
  const payload = verifyToken(token);
  if (!payload) {
    sendJson(res, 401, { code: 'UNAUTHORIZED', message: 'Invalid or missing token' });
    return null;
  }
  return asUser(payload, token);
};

/**
 * 为指定用户创建绑定到其 JWT 的 PostgREST 查询函数
 */
const bindPgQueryForUser = (user) => {
  return (options) => callPostgrestWithUser(user, options);
};

/**
 * POST /twin/chat — 数字分身对话（SSE 流式）
 *
 * Body: {
 *   message: string,           // 用户消息
 *   session_id?: string,       // 可选，复用已有会话
 *   history?: [{role,content}] // 可选，前端传入的历史消息（若无 session_id）
 * }
 */
const handleTwinChat = async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }

  const userMessage = normalizeAiText(body?.message || body?.content || '');
  if (!userMessage) {
    sendJson(res, 400, { code: 'MESSAGE_REQUIRED', message: 'message is required' });
    return;
  }

  try {
    const cfg = await getAiConfig();
    if (!cfg?.api_url || !cfg?.api_key) {
      sendJson(res, 503, { code: 'AI_CONFIG_MISSING', message: 'AI configuration not available' });
      return;
    }

    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);

    // 会话管理：复用或创建
    let sessionId = body.session_id || null;
    if (!sessionId) {
      try {
        sessionId = await persistence.createSession(
          userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '')
        );
      } catch (e) {
        console.warn('[twin-chat] create session failed:', e?.message);
      }
    }

    // 加载历史（从数据库或前端传入）
    let history = [];
    if (sessionId) {
      try {
        history = await persistence.loadHistory(sessionId, 12);
      } catch (e) {
        console.warn('[twin-chat] load history failed:', e?.message);
      }
    }
    if (!history.length && Array.isArray(body.history)) {
      history = body.history
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .slice(-12)
        .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    }

    // 语义上下文
    let semanticCtx = null;
    try {
      semanticCtx = await fetchSemanticContext(user);
    } catch (e) {
      console.warn('[twin-chat] semantic context failed:', e?.message);
    }

    // 构建工具集 & 系统提示
    const tools = createTwinTools(pgQuery, user);
    const systemPrompt = buildTwinSystemPrompt(user, semanticCtx);

    // 构建 AI 调用器（非流式，用于 ReAct 中间推理 / 工具选择）
    const aiCaller = async ({ model, messages, stream }) => {
      const payload = {
        model: model || cfg.model || 'glm-4.6v',
        stream: false,
        messages
      };
      const result = await callAiUpstreamWithRetry(
        payload,
        { forceStream: false, cfg },
        { maxRetries: 3, baseDelayMs: 320 }
      );
      if (!result.ok) {
        throw new Error(result.payload?.message || 'AI upstream failed');
      }
      return result.data;
    };

    // SSE 事件推送
    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Eis-Agent': 'digital_twin',
      'X-Eis-Session': sessionId || ''
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const sendSseEvent = (eventType, data) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`);
      }
    };

    // 目标断开则提前结束
    let aborted = false;
    req.on('close', () => { aborted = true; });

    // 流式 AI 调用器 — 用于最终回答的实时 token 推送
    const streamingAiCaller = async ({ model, messages }) => {
      const payload = {
        model: model || cfg.model || 'glm-4.6v',
        stream: true,
        messages
      };
      const upstream = await callAiUpstreamWithRetry(
        payload,
        { forceStream: true, cfg },
        { maxRetries: 3, baseDelayMs: 320 }
      );
      if (!upstream.ok) {
        throw new Error(upstream.payload?.message || 'AI upstream failed');
      }

      // 非流式回退（上游未返回流）
      if (!upstream.stream) {
        const text = extractCompletionText(upstream.data || {});
        // 非流式结果用小分块 + 延迟模拟逐字效果
        const chunkSize = 20;
        for (let i = 0; i < text.length; i += chunkSize) {
          if (aborted) break;
          writeSsePayload(res, { choices: [{ delta: { content: text.slice(i, i + chunkSize) } }] });
          await waitMs(25);
        }
        return text;
      }

      // 真正的流式：逐 chunk 透传
      const upstreamBody = upstream.response.body;
      if (!upstreamBody || typeof upstreamBody.getReader !== 'function') {
        throw new Error('AI upstream stream is unavailable');
      }

      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let sseBuffer = '';

      // 安全超时：防止流式响应无限挂起
      const streamTimeout = setTimeout(() => {
        console.warn('[twin-stream] stream read timeout, cancelling');
        try { reader.cancel(); } catch { /* ignore */ }
      }, aiUpstreamTimeoutMs || 60000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || aborted) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed?.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                if (!res.writableEnded) {
                  writeSsePayload(res, { choices: [{ delta: { content: delta } }] });
                }
              }
            } catch { /* skip unparseable chunk */ }
          }
        }
      } finally {
        clearTimeout(streamTimeout);
        try { reader.releaseLock(); } catch { /* ignore */ }
      }

      return fullText;
    };

    // ── 启动 ReAct 推理循环 ──
    const engine = new TwinEngine({
      aiCaller,
      streamingAiCaller,
      tools,
      systemPrompt,
      model: cfg.model || 'glm-4.6v',
      maxTurns: 6,
      turnDelayMs: 120,
      onEvent: (event) => {
        if (aborted) return;
        sendSseEvent(event.type, event);
      },
      persistence
    });

    console.log('[twin-chat]', JSON.stringify({
      user: user.username,
      session: sessionId,
      msgLen: userMessage.length,
      tools: Object.keys(tools).length
    }));

    const result = await engine.run(userMessage, history, { sessionId });

    // 发送最终回答：如果流式已在 engine 内完成，跳过；否则回退到分块发送
    if (!aborted && !res.writableEnded) {
      if (!result.streamed) {
        // 非流式回退：小分块 + 延迟模拟逐字效果
        const answer = result.answer || '';
        const chunkSize = 20;
        for (let i = 0; i < answer.length; i += chunkSize) {
          if (aborted) break;
          const chunk = answer.slice(i, i + chunkSize);
          writeSsePayload(res, { choices: [{ delta: { content: chunk } }] });
          await waitMs(25);
        }
      }
      // 发送元信息
      sendSseEvent('meta', {
        session_id: sessionId,
        turns: result.turns,
        tool_calls: result.toolLogs.length
      });
      writeSseDone(res);
    }

  } catch (error) {
    console.error('[twin-chat] error:', error?.message || error);
    if (!res.headersSent) {
      sendJson(res, 500, { code: 'TWIN_CHAT_FAILED', message: error?.message || 'Digital twin chat failed' });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error?.message || 'Internal error' })}\n\n`);
      res.end();
    }
  }
};

/**
 * GET /twin/sessions — 列出会话历史
 */
const handleTwinSessionsList = async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;
  try {
    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);
    const sessions = await persistence.listSessions(30);
    sendJson(res, 200, { sessions });
  } catch (error) {
    sendJson(res, 500, { code: 'TWIN_SESSIONS_FAILED', message: error?.message || 'Failed to list sessions' });
  }
};

/**
 * DELETE /twin/sessions?id=xxx — 删除会话
 */
const handleTwinSessionDelete = async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const sessionId = url.searchParams.get('id') || '';
    if (!sessionId) {
      sendJson(res, 400, { code: 'ID_REQUIRED', message: 'session id is required' });
      return;
    }
    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);
    await persistence.deleteSession(sessionId);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('[twin-session-delete] error:', error);
    sendJson(res, 500, { code: 'TWIN_DELETE_FAILED', message: error?.message || 'Failed to delete session' });
  }
};

/**
 * GET /twin/messages?session_id=xxx — 加载会话消息
 */
const handleTwinMessagesGet = async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const sessionId = url.searchParams.get('session_id') || '';
    if (!sessionId) {
      sendJson(res, 400, { code: 'SESSION_ID_REQUIRED', message: 'session_id is required' });
      return;
    }
    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);
    const messages = await persistence.loadHistory(sessionId, 50);
    sendJson(res, 200, { messages });
  } catch (error) {
    sendJson(res, 500, { code: 'TWIN_MESSAGES_FAILED', message: error?.message || 'Failed to load messages' });
  }
};

/**
 * POST /twin/knowledge/upload — 上传文件到个人知识库
 * Body: { fileName, fileType, fileSize, contentText, contentB64, tags, summary }
 */
const handleTwinKnowledgeUpload = async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { code: 'BAD_REQUEST', message: error.message || 'Invalid request body' });
    return;
  }
  try {
    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);
    const file = await persistence.uploadKnowledgeFile(body);
    sendJson(res, 200, { ok: true, file });
  } catch (error) {
    sendJson(res, 500, { code: 'TWIN_UPLOAD_FAILED', message: error?.message || 'Failed to upload file' });
  }
};

/**
 * GET /twin/knowledge — 列出知识库文件
 */
const handleTwinKnowledgeList = async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;
  try {
    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);
    const files = await persistence.listKnowledgeFiles(50);
    sendJson(res, 200, { files });
  } catch (error) {
    sendJson(res, 500, { code: 'TWIN_KB_LIST_FAILED', message: error?.message || 'Failed to list knowledge files' });
  }
};

/**
 * DELETE /twin/knowledge?id=xxx — 删除知识库文件
 */
const handleTwinKnowledgeDelete = async (req, res) => {
  const user = authorizeTwinRequest(req, res);
  if (!user) return;
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const fileId = url.searchParams.get('id') || '';
    if (!fileId) {
      sendJson(res, 400, { code: 'ID_REQUIRED', message: 'file id is required' });
      return;
    }
    const pgQuery = bindPgQueryForUser(user);
    const persistence = createPersistence(pgQuery, user.username);
    await persistence.deleteKnowledgeFile(fileId);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { code: 'TWIN_KB_DELETE_FAILED', message: error?.message || 'Failed to delete knowledge file' });
  }
};

const server = http.createServer(async (req, res) => {
  const method = String(req.method || 'GET').toUpperCase();
  const pathname = getRequestPath(req);

  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/health') {
    sendJson(res, 200, { ok: true, channel });
    return;
  }

  if (pathname === '/ai/config' && method === 'GET') {
    await handleAiConfig(req, res);
    return;
  }

  if (pathname === '/ai/agents' && method === 'GET') {
    await handleAiAgents(req, res);
    return;
  }

  if (pathname === '/ai/chat/completions' && method === 'POST') {
    await handleAiChat(req, res);
    return;
  }

  if (pathname === '/ai/translate' && method === 'POST') {
    await handleAiTranslate(req, res);
    return;
  }

  if (pathname === '/ai/map-locate' && method === 'POST') {
    await handleAiMapLocate(req, res);
    return;
  }

  if (pathname === '/flash/draft' && method === 'GET') {
    await handleFlashDraftGet(req, res);
    return;
  }

  if (pathname === '/flash/draft' && method === 'POST') {
    await handleFlashDraftWrite(req, res);
    return;
  }

  if (pathname === '/flash/attachments' && method === 'POST') {
    await handleFlashAttachmentUpload(req, res);
    return;
  }

  if (pathname === '/flash/tools/registry' && method === 'GET') {
    await handleFlashToolsRegistryGet(req, res);
    return;
  }

  if (pathname === '/flash/tools/call' && method === 'POST') {
    await handleFlashToolCallHttp(req, res);
    return;
  }

  // ── 数字分身 API 路由 ──
  if (pathname === '/twin/chat' && method === 'POST') {
    await handleTwinChat(req, res);
    return;
  }

  if (pathname === '/twin/sessions' && method === 'GET') {
    await handleTwinSessionsList(req, res);
    return;
  }

  if (pathname === '/twin/sessions' && method === 'DELETE') {
    await handleTwinSessionDelete(req, res);
    return;
  }

  if (pathname === '/twin/messages' && method === 'GET') {
    await handleTwinMessagesGet(req, res);
    return;
  }

  if (pathname === '/twin/knowledge' && method === 'GET') {
    await handleTwinKnowledgeList(req, res);
    return;
  }

  if (pathname === '/twin/knowledge/upload' && method === 'POST') {
    await handleTwinKnowledgeUpload(req, res);
    return;
  }

  if (pathname === '/twin/knowledge' && method === 'DELETE') {
    await handleTwinKnowledgeDelete(req, res);
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server, path: wsPath });

function extractToken(req) {
  const header = req.headers['sec-websocket-protocol'];
  if (!header) return '';
  const items = String(header)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (items.length === 0) return '';
  const bearer = items.find((v) => v.toLowerCase().startsWith('bearer '));
  if (bearer) return bearer.slice(7).trim();
  return items[items.length - 1] || '';
}

function verifyToken(token) {
  if (!token || !jwtSecret) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch (e) {
    return null;
  }
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeRelativeAgentPath(value) {
  const raw = String(value || '').replace(/\\/g, '/').trim();
  if (!raw || raw.startsWith('/')) return '';
  const normalized = path.posix.normalize(raw).replace(/^\.\/+/, '');
  if (!normalized || normalized === '.') return '';
  if (normalized.startsWith('../') || normalized.includes('/../')) return '';
  return normalized;
}

function normalizeProjectPath(value) {
  const normalized = normalizeRelativeAgentPath(value);
  return normalized.replace(/\/+$/, '');
}

function generateTraceId(prefix = 'tr') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

function sanitizeIdempotencyKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 128);
}

function sanitizeToolId(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[^a-zA-Z0-9._-]/g, '');
}

function sanitizeQueryParams(query = {}) {
  const out = {};
  if (!query || typeof query !== 'object') return out;
  for (const [key, value] of Object.entries(query)) {
    const k = String(key || '').trim();
    if (!k) continue;
    if (value === undefined || value === null) continue;
    out[k] = String(value);
  }
  return out;
}

function isValidDbObjectName(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(text);
}

class FlashToolError extends Error {
  constructor(code, message, options = {}) {
    super(message || code || 'Flash tool error');
    this.name = 'FlashToolError';
    this.code = String(code || 'INTERNAL_ERROR');
    this.httpStatus = Number(options.httpStatus || 500);
    this.reasonCode = String(options.reasonCode || this.code);
    this.data = options.data === undefined ? null : options.data;
  }
}

function toPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cloneJsonValue(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function sanitizeTraceId(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 128);
}

function normalizeToolCallBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return text === '1' || text === 'true' || text === 'yes' || text === 'y';
}

function normalizeLimit(value, fallback = 50, max = 500) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return String(fallback);
  return String(Math.min(parsed, max));
}

function cleanupFlashToolIdempotencyCache(now = Date.now()) {
  for (const [key, record] of flashToolIdempotencyCache.entries()) {
    if (!record || !record.expireAt || record.expireAt <= now) {
      flashToolIdempotencyCache.delete(key);
    }
  }
}

function makeFlashToolIdempotencyCacheKey(user, toolId, idempotencyKey) {
  const userId = String(user?.id || 'anonymous');
  return `${userId}:${toolId}:${idempotencyKey}`;
}

function resolveFlashToolId(rawToolId) {
  const cleaned = sanitizeToolId(rawToolId);
  if (!cleaned) return '';
  return flashSemanticToolAliases[cleaned] || cleaned;
}

function resolveDataTableTarget(tableInput) {
  const raw = String(tableInput || '').trim();
  if (!raw) {
    throw new FlashToolError('VALIDATION_FAILED', 'table is required', { httpStatus: 400 });
  }
  if (!isValidDbObjectName(raw)) {
    throw new FlashToolError('VALIDATION_FAILED', 'table is invalid', { httpStatus: 400 });
  }
  const [schema, table] = raw.includes('.') ? raw.split('.', 2) : ['app_data', raw];
  if (!schema || !table || !isValidDbObjectName(`${schema}.${table}`)) {
    throw new FlashToolError('VALIDATION_FAILED', 'table is invalid', { httpStatus: 400 });
  }
  return { schema, table };
}

function normalizeExecutionLogStatus(rawStatus = '') {
  const value = String(rawStatus || '').trim().toLowerCase();
  if (value === 'pending' || value === 'running' || value === 'completed' || value === 'failed') {
    return value;
  }
  return '';
}

function toJsonObjectOrNull(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return null;
}

function normalizeExecutionLogPayload(rawPayload = {}, callContext = {}, user = null) {
  const src = toPlainObject(rawPayload);
  const out = {};

  // Keep only real app_center.execution_logs columns to avoid PGRST204.
  if (src.app_id !== undefined) out.app_id = src.app_id;
  if (src.execution_id !== undefined) out.execution_id = src.execution_id;
  if (src.task_id !== undefined) out.task_id = src.task_id;
  if (src.status !== undefined) out.status = src.status;
  if (src.input_data !== undefined) out.input_data = src.input_data;
  if (src.output_data !== undefined) out.output_data = src.output_data;
  if (src.error_message !== undefined) out.error_message = src.error_message;
  if (src.executed_by !== undefined) out.executed_by = src.executed_by;
  if (src.executed_at !== undefined) out.executed_at = src.executed_at;

  if (!out.app_id) out.app_id = src.appId || callContext.appId || '';
  if (!out.task_id) out.task_id = src.event_type || src.eventType || 'flash.audit.write';

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
}

function encodeInList(values = []) {
  const list = values
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => item.replace(/[,()]/g, ''));
  if (!list.length) return '';
  return `in.(${list.join(',')})`;
}

function mapPostgrestErrorCode(status, payload) {
  if (status === 400) return 'VALIDATION_FAILED';
  if (status === 401 || status === 403) {
    const code = String(payload?.code || '').trim();
    const message = String(payload?.message || '').toLowerCase();
    if (code === '42501' || message.includes('permission denied')) return 'RLS_DENIED';
    return 'PERMISSION_DENIED';
  }
  if (status === 404) return 'BAD_REQUEST';
  if (status === 409) return 'CONFLICT';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status >= 500) return 'UPSTREAM_ERROR';
  return 'UPSTREAM_ERROR';
}

function buildPostgrestPath(pathname = '/', query = {}) {
  const basePath = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${pathname}`;
  const params = new URLSearchParams();
  const cleaned = sanitizeQueryParams(query);
  for (const [key, value] of Object.entries(cleaned)) {
    params.set(key, value);
  }
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

async function callPostgrestWithUser(user, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const requestPath = buildPostgrestPath(options.path, options.query);
  const url = `${postgrestBaseUrl}${requestPath}`;
  const headers = {
    Authorization: `Bearer ${user?.token || ''}`,
    Accept: 'application/json'
  };
  if (options.acceptProfile) headers['Accept-Profile'] = options.acceptProfile;
  if (options.traceId) headers['X-Trace-Id'] = options.traceId;
  if (options.prefer) headers.Prefer = options.prefer;

  // Content-Profile must be set for all write operations (POST/PATCH/PUT/DELETE),
  // not just when body is present — PostgREST uses it to resolve the target schema.
  if (options.contentProfile) headers['Content-Profile'] = options.contentProfile;

  let body;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeout = Number(options.timeoutMs || flashToolCallTimeoutMs);
  const timeoutHandle = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new FlashToolError('TIMEOUT', `Tool upstream timeout after ${timeout}ms`, { httpStatus: 504 });
    }
    throw new FlashToolError('UPSTREAM_ERROR', error?.message || 'Tool upstream request failed', { httpStatus: 502 });
  } finally {
    clearTimeout(timeoutHandle);
  }

  const rawText = await response.text();
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  let payload = null;
  if (rawText) {
    if (contentType.includes('json')) payload = parseJsonMaybe(rawText);
    if (payload === null) payload = { raw: rawText };
  }

  if (!response.ok) {
    const reasonCode = mapPostgrestErrorCode(response.status, payload || {});
    const message = normalizeAiText(payload?.message || payload?.details || payload?.hint) ||
      `PostgREST request failed (${response.status})`;
    throw new FlashToolError(reasonCode, message, {
      httpStatus: response.status,
      data: payload
    });
  }

  return {
    status: response.status,
    data: payload,
    path: requestPath
  };
}

function getFlashToolRegistryPayload() {
  return {
    registry_version: flashSemanticToolRegistryVersion,
    tools_count: flashSemanticToolRegistry.length,
    generated_at: new Date().toISOString(),
    domain: 'flash',
    tools: flashSemanticToolRegistry.map((tool) => ({
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
}

function sanitizePathToken(value, fallback = 'default') {
  const raw = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!raw) return fallback;
  return raw.slice(0, 64);
}

function sanitizeUploadFileName(value) {
  const base = path.posix.basename(String(value || '').trim());
  const safe = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 96);
  if (!safe) return `upload-${Date.now()}.bin`;
  return safe;
}

function decodeBase64Payload(value) {
  const raw = String(value || '').trim();
  if (!raw) return Buffer.alloc(0);
  const payload = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  return Buffer.from(payload, 'base64');
}

function isTextLikeAttachment(fileName, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('text/')) return true;
  if (mime.includes('json') || mime.includes('xml') || mime.includes('yaml') || mime.includes('csv')) return true;
  const ext = path.extname(String(fileName || '').toLowerCase());
  const textExt = new Set(['.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm', '.sql', '.js', '.ts', '.vue', '.py']);
  return textExt.has(ext);
}

function buildSafeUploadPath(taskWorkdir, appId, conversationId, fileName) {
  const appPart = sanitizePathToken(appId, 'app');
  const convPart = sanitizePathToken(conversationId, 'default');
  const safeName = sanitizeUploadFileName(fileName);
  const baseDir = path.resolve(taskWorkdir, flashAttachmentDirName, appPart, convPart);
  const candidate = path.resolve(baseDir, safeName);
  const workdirResolved = path.resolve(taskWorkdir);
  if (candidate !== workdirResolved && !candidate.startsWith(`${workdirResolved}${path.sep}`)) {
    throw new Error('Attachment target escapes task workdir');
  }
  return { baseDir, candidate, safeName };
}

function sanitizeWritePolicy(rawPolicy) {
  const policy = (rawPolicy && typeof rawPolicy === 'object') ? rawPolicy : {};
  const allowedFiles = Array.isArray(policy.allowedFiles)
    ? policy.allowedFiles.map(normalizeRelativeAgentPath).filter(Boolean)
    : [];
  const allowedDirs = Array.isArray(policy.allowedDirs)
    ? policy.allowedDirs
      .map(normalizeRelativeAgentPath)
      .map((item) => item.replace(/\/+$/, ''))
      .filter(Boolean)
    : [];
  return { allowedFiles, allowedDirs };
}

function resolveDefaultWritePolicy(projectPath) {
  const normalizedProject = normalizeProjectPath(projectPath);
  if (normalizedProject === 'eiscore-apps/src/views/drafts') {
    return { allowedFiles: ['FlashDraft.vue'], allowedDirs: [] };
  }
  if (normalizedProject === 'eiscore-apps') {
    return { allowedFiles: ['src/views/drafts/FlashDraft.vue'], allowedDirs: [] };
  }
  return { allowedFiles: [], allowedDirs: [] };
}

const agentAllowedRoles = normalizeStringList(process.env.AGENT_ALLOWED_ROLES || 'super_admin')
  .map((role) => String(role).toLowerCase());
const agentAllowedProjects = normalizeStringList(
  process.env.AGENT_ALLOWED_PROJECTS ||
    'eiscore-apps/src/views/drafts,eiscore-apps,eiscore-base,eiscore-hr,eiscore-materials,realtime,scripts,sql,env,nginx,docs'
)
  .map((item) => normalizeProjectPath(item))
  .filter(Boolean);
const agentAllowAll = String(process.env.AGENT_ALLOW_ALL || '').toLowerCase() === 'true';

function canUseAgent(user) {
  if (agentAllowAll) return true;
  const role = String(user?.role || '').toLowerCase();
  return agentAllowedRoles.includes(role);
}

function isAllowedProject(projectPath) {
  const normalized = normalizeProjectPath(projectPath);
  if (!normalized) return false;
  return agentAllowedProjects.some((allowed) => (
    normalized === allowed || normalized.startsWith(`${allowed}/`)
  ));
}

function logAgentEvent(type, user, details) {
  const payload = {
    ts: new Date().toISOString(),
    type,
    user: { id: user?.id || '', role: user?.role || '' },
    details: details || {}
  };
  console.log('[agent]', JSON.stringify(payload));
}

function normalizeAgentTaskErrorMessage(error) {
  const text = String(error?.message || '').trim();
  if (!text) return 'Agent task execution failed';
  const lower = text.toLowerCase();
  if (lower.includes('connection error') || lower.includes('network error') || lower.includes('socket hang up')) {
    return 'AI upstream connection error';
  }
  if (lower.includes('timeout')) {
    return 'AI upstream timeout';
  }
  return text.slice(0, 300);
}

function createAgentTaskAiInvoker(cfg) {
  return async ({ model, maxTokens, systemPrompt, messages }) => {
    const payload = {
      model: String(model || cfg?.model || 'glm-4.6v').trim() || 'glm-4.6v',
      max_tokens: Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : 8192,
      stream: false,
      messages: [
        { role: 'system', content: normalizeAiText(systemPrompt) || '' },
        ...(Array.isArray(messages) ? messages : [])
          .map((item) => {
            const role = String(item?.role || '').trim();
            const content = normalizeAiText(item?.content);
            if (!role || !content) return null;
            return { role, content };
          })
          .filter(Boolean)
      ]
    };

    const upstream = await callAiUpstreamWithRetry(payload, {
      forceStream: false,
      cfg
    }, {
      maxRetries: 2,
      baseDelayMs: 320
    });

    if (!upstream.ok) {
      const detailText = normalizeAiText(upstream?.payload?.detail);
      const message = normalizeAiText(upstream?.payload?.message) || 'AI upstream request failed';
      const error = new Error(detailText ? `${message}: ${detailText}` : message);
      error.code = upstream?.payload?.code || 'AI_UPSTREAM_ERROR';
      error.status = Number(upstream?.status || 502);
      throw error;
    }

    const text = cleanModelText(extractCompletionText(upstream.data));
    if (!text) {
      throw new Error('AI upstream returned empty content');
    }
    return text;
  };
}

async function runFlashClineTask(ws, payload = {}) {
  if (!flashCliEnabled) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: 'Cline CLI shell mode is disabled by server policy'
    });
    return;
  }
  if (!flashCliRuntimeReady) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: `Node.js ${process.versions.node} is not supported by Cline CLI (requires >=20)`
    });
    return;
  }

  if (!canUseAgent(ws.user)) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: 'Forbidden: agent access denied'
    });
    logAgentEvent('flash:cline_denied', ws.user, { reason: 'role_denied' });
    return;
  }

  const normalizedProject = normalizeProjectPath(flashCliProjectPath) || 'eiscore-apps/src/views/drafts';
  if (!isAllowedProject(normalizedProject)) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId: String(payload?.sessionId || 'default'),
      error: 'Forbidden: flash project path not allowed'
    });
    logAgentEvent('flash:cline_denied', ws.user, { reason: 'project_denied', projectPath: normalizedProject });
    return;
  }

  const sessionId = String(payload?.sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
  try {
  if (!ws.flashCliSessions) ws.flashCliSessions = new Map();
  if (!ws.flashCliSessions.has(sessionId)) {
    ws.flashCliSessions.set(sessionId, createFlashCliSession());
  }
  const session = ws.flashCliSessions.get(sessionId);
  if (session.running || session.process) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: '上一条请求尚未完成，请稍后再试'
    });
    return;
  }

  const prompt = normalizeAiText(payload?.prompt);
  if (!prompt) {
    sendWsJson(ws, { type: 'flash:cline_error', sessionId, error: 'Prompt is required' });
    return;
  }

  const cfg = await getAiConfig();
  if (!cfg?.api_key || !cfg?.api_url) {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: 'AI configuration is missing in system_configs.ai_glm_config'
    });
    return;
  }

  const clineBin = resolveClineBin();
  const clineEnv = buildFlashCliEnv(ws?.user?.token || '');
  const model = envText(payload?.model, envText(cfg?.model, 'gpt-4o'));
  const history = clampFlashHistory(payload?.history);
  const configDir = path.posix.join(flashCliConfigRoot, sessionId);
  const taskWorkdir = resolveFlashCliWorkdir();
  const attachments = normalizeFlashAttachmentList(payload?.attachments, taskWorkdir);
  const composedPrompt = buildFlashCliPrompt(prompt, history, attachments);

  await ensureDir(configDir);
  await ensureDir(taskWorkdir);

  const baseUrl = deriveOpenAiBaseUrl(cfg.api_url);
  const authArgs = [
    'auth',
    '-p',
    flashCliProvider,
    '-k',
    String(cfg.api_key),
    '-m',
    model,
    '--config',
    configDir
  ];
  if (baseUrl) {
    authArgs.push('-b', baseUrl);
  }

  const authResult = await runSpawnCapture(clineBin, authArgs, {
    cwd: '/app',
    env: clineEnv,
    timeoutMs: flashCliAuthTimeoutMs
  });
  if (authResult.timedOut || authResult.code !== 0) {
    const authError = normalizeAiText(authResult.stderr || authResult.stdout || 'Cline auth failed');
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: `Cline auth failed: ${authError}`
    });
    logAgentEvent('flash:cline_auth_failed', ws.user, {
      sessionId,
      error: authError.slice(0, 400)
    });
    return;
  }

  const taskArgs = buildFlashCliArgs({
    configDir,
    model,
    taskId: session.taskId,
    prompt: composedPrompt,
    workdir: taskWorkdir
  });
  const draftBefore = await readFlashDraftFingerprintSafe();

  const child = spawn(clineBin, taskArgs, {
    cwd: '/app',
    env: clineEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  session.running = true;
  session.process = child;
  let assistantChunks = [];
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let timeoutTriggered = false;
  const startedAt = Date.now();

  logAgentEvent('flash:cline_start', ws.user, {
    sessionId,
    model,
    workdir: taskWorkdir
  });
  sendWsJson(ws, {
    type: 'flash:cline_status',
    sessionId,
    status: 'running',
    message: 'Cline CLI 正在处理...'
  });
  sendWsJson(ws, {
    type: 'flash:cline_status',
    sessionId,
    status: 'registry_meta',
    registryVersion: flashSemanticToolRegistryVersion,
    registryCount: flashSemanticToolRegistry.length
  });

  const timeoutTimer = setTimeout(() => {
    timeoutTriggered = true;
    killFlashCliSessionProcess(session);
  }, flashCliTaskTimeoutMs);

  const flushCliLine = (line, source) => {
    const text = String(line || '').trim();
    if (!text) return;
    const parsed = parseJsonMaybe(text);
    if (!parsed) {
      if (source === 'stderr') {
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'log',
          message: text.slice(0, 240)
        });
      }
      return;
    }

    if (parsed.type === 'task_started' && parsed.taskId) {
      session.taskId = String(parsed.taskId);
      return;
    }

    if (parsed.type === 'error') {
      const errorText = normalizeFlashCliError(parsed.message || parsed.text || 'Cline task failed');
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId,
        error: errorText
      });
      return;
    }

    const retryText = parseClineRetryMessage(parsed);
    if (retryText) {
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'retry',
        message: retryText
      });
      return;
    }

    if (parsed.type === 'ask' && parsed.ask === 'api_req_failed') {
      const askError = normalizeAiText(parsed.text || 'AI upstream request failed');
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId,
        error: askError
      });
      return;
    }

    if (parsed.type === 'say') {
      const sayText = normalizeAiText(parsed.text);
      if (!shouldForwardClineSay(parsed.say, sayText)) return;
      assistantChunks.push(sayText);
      sendWsJson(ws, {
        type: 'flash:cline_output',
        sessionId,
        role: 'assistant',
        content: sayText,
        eventType: 'say',
        say: parsed.say || ''
      });
    }
  };

  const consumeOutput = (chunk, source) => {
    const data = String(chunk || '');
    if (source === 'stdout') {
      stdoutBuffer += data;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      lines.forEach((line) => flushCliLine(line, source));
      return;
    }
    stderrBuffer += data;
    const lines = stderrBuffer.split(/\r?\n/);
    stderrBuffer = lines.pop() || '';
    lines.forEach((line) => flushCliLine(line, source));
  };

  child.stdout.on('data', (chunk) => consumeOutput(chunk, 'stdout'));
  child.stderr.on('data', (chunk) => consumeOutput(chunk, 'stderr'));

  child.on('error', (error) => {
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: normalizeAiText(error?.message || 'Cline process error')
    });
  });

  child.on('close', (code) => {
    (async () => {
      clearTimeout(timeoutTimer);
      if (stdoutBuffer.trim()) flushCliLine(stdoutBuffer, 'stdout');
      if (stderrBuffer.trim()) flushCliLine(stderrBuffer, 'stderr');

      let success = !timeoutTriggered && Number(code || 0) === 0;
      let exitCode = Number(code || 0);
      const elapsedMs = Date.now() - startedAt;
      const summary = assistantChunks.filter(Boolean).join('\n\n').trim();
      const draftAfter = await readFlashDraftFingerprintSafe();
      const draftChanged = !!(
        draftAfter
        && (
          !draftBefore
          || draftBefore.sha1 !== draftAfter.sha1
          || draftBefore.bytes !== draftAfter.bytes
          || draftBefore.mtimeMs !== draftAfter.mtimeMs
        )
      );

      if (summary) {
        sendWsJson(ws, {
          type: 'flash:cline_summary',
          sessionId,
          role: 'assistant',
          content: summary
        });
      }
      if (timeoutTriggered) {
        sendWsJson(ws, {
          type: 'flash:cline_error',
          sessionId,
          error: `Cline task timeout after ${flashCliTaskTimeoutMs}ms`
        });
      } else if (success) {
        const healResult = await runFlashBuildSelfHeal({
          ws,
          sessionId,
          session,
          clineBin,
          configDir,
          model,
          prompt,
          taskWorkdir,
          clineEnv
        });
        if (!healResult.success) {
          success = false;
          exitCode = 2;
          sendWsJson(ws, {
            type: 'flash:cline_error',
            sessionId,
            error: healResult.error || '草稿构建校验失败'
          });
        }
      }

      session.running = false;
      session.process = null;
      sendWsJson(ws, {
        type: 'flash:cline_done',
        sessionId,
        success,
        exitCode,
        elapsedMs,
        draftChanged,
        draftFingerprint: draftAfter || null
      });
      logAgentEvent('flash:cline_done', ws.user, {
        sessionId,
        success,
        exitCode,
        elapsedMs,
        draftChanged,
        draftBytes: Number(draftAfter?.bytes || 0)
      });
    })().catch((error) => {
      session.running = false;
      session.process = null;
      const safeError = normalizeAiText(error?.message || 'Cline task post-check failed');
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId,
        error: safeError
      });
      sendWsJson(ws, {
        type: 'flash:cline_done',
        sessionId,
        success: false,
        exitCode: 2,
        elapsedMs: Date.now() - startedAt
      });
      logAgentEvent('flash:cline_done', ws.user, {
        sessionId,
        success: false,
        exitCode: 2,
        elapsedMs: Date.now() - startedAt,
        error: safeError
      });
    });
  });
  } catch (error) {
    const safeError = normalizeAiText(error?.message || 'Cline task failed');
    sendWsJson(ws, {
      type: 'flash:cline_error',
      sessionId,
      error: safeError
    });
    logAgentEvent('flash:cline_failed', ws.user, {
      sessionId,
      error: safeError.slice(0, 400)
    });
  }
}

function extractPayloadMeta(rawPayload) {
  if (!rawPayload) return { id: null, targets: [], roles: [] };
  try {
    const parsed = JSON.parse(rawPayload);
    const id = parsed?.id ?? parsed?.record_id ?? parsed?.primary_key ?? null;
    const targets = normalizeStringList(parsed?.targets || parsed?.user_ids || parsed?.users);
    const roles = normalizeStringList(parsed?.roles || parsed?.role || parsed?.app_role);
    return { id, targets, roles };
  } catch {
    return { id: null, targets: [], roles: [] };
  }
}

function shouldSendToClient(client, meta, channelName) {
  if (client.readyState !== WebSocket.OPEN) return false;
  if (client.channels && !client.channels.has(channelName)) return false;
  if (meta.targets?.length) {
    return meta.targets.includes(String(client.user?.id || ''));
  }
  if (meta.roles?.length) {
    return meta.roles.includes(String(client.user?.role || ''));
  }
  return true;
}

function notifyClients(signal, meta) {
  const data = JSON.stringify(signal);
  wss.clients.forEach((client) => {
    if (shouldSendToClient(client, meta, signal.channel)) {
      client.send(data);
    }
  });
}

async function connectPg() {
  if (shuttingDown) return;
  if (pgClient) {
    try {
      await pgClient.end();
    } catch (err) {
      // ignore
    }
    pgClient = null;
  }

  pgClient = new Client({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres'
  });

  pgClient.on('notification', (msg) => {
    if (enableWorkflowAutoTransition && msg.channel === workflowChannel && workflowEngine) {
      workflowEngine.handleWorkflowEvent(msg.payload).catch((error) => {
        console.error('❌ Workflow notify error:', error.message);
      });
      return;
    }
    const meta = extractPayloadMeta(msg.payload);
    notifyClients(
      {
        type: 'db_notify',
        channel: msg.channel,
        id: meta.id,
        ts: new Date().toISOString()
      },
      meta
    );
  });

  pgClient.on('error', () => scheduleReconnect());
  pgClient.on('end', () => scheduleReconnect());

  try {
    await pgClient.connect();
    await pgClient.query(`LISTEN ${channel}`);
    if (enableWorkflowAutoTransition) {
      await pgClient.query(`LISTEN ${workflowChannel}`);

      // Optional auto-transition engine. Disabled by default to avoid overriding
      // explicit workflow state changes made by RPC endpoints/UI actions.
      workflowEngine = new WorkflowEngine({
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'postgres'
      });
      await workflowEngine.initialize();
      console.log('✅ Workflow engine initialized (auto-transition enabled)');
    } else {
      workflowEngine = null;
      console.log('ℹ️ Workflow auto-transition is disabled');
    }
  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (shuttingDown) return;
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectPg();
  }, 1000);
}

function shutdown() {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  wss.clients.forEach((client) => client.close());
  server.close(() => process.exit(0));
  if (pgClient) {
    pgClient.end().catch(() => process.exit(0));
  }
  if (workflowEngine) {
    workflowEngine.shutdown().catch(() => process.exit(0));
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, () => {
  connectPg();
});

wss.on('connection', (ws, req) => {
  const token = extractToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    ws.close(1008, 'unauthorized');
    return;
  }
  ws.user = {
    ...asUser(payload),
    token
  };
  ws.channels = new Set([channel]);
  ws.agentConversation = null; // Will be initialized on agent:task
  ws.fileWatcher = null;
  ws.flashCliSessions = new Map();

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(String(message));
      if (!data || typeof data !== 'object') return;

      // Database notification subscriptions
      if (data.type === 'subscribe') {
        const list = normalizeStringList(data.channels);
        if (list.length) ws.channels = new Set(list);
        return;
      }
      if (data.type === 'unsubscribe') {
        const list = normalizeStringList(data.channels);
        list.forEach((ch) => ws.channels.delete(ch));
        return;
      }

      if (data.type === 'flash:tool_call') {
        await handleFlashToolCallWs(ws, data);
        return;
      }

      if (data.type === 'flash:cline_task') {
        await runFlashClineTask(ws, data);
        return;
      }

      if (data.type === 'flash:cline_stop') {
        const sessionId = String(data?.sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
        const session = ws.flashCliSessions?.get(sessionId);
        if (session) {
          killFlashCliSessionProcess(session);
          sendWsJson(ws, {
            type: 'flash:cline_status',
            sessionId,
            status: 'stopped',
            message: '已停止当前 Cline 任务'
          });
        }
        return;
      }

      if (data.type === 'flash:cline_reset') {
        const sessionId = String(data?.sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
        const session = ws.flashCliSessions?.get(sessionId);
        if (session) {
          killFlashCliSessionProcess(session);
          session.taskId = '';
        } else if (ws.flashCliSessions) {
          ws.flashCliSessions.set(sessionId, createFlashCliSession());
        }
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'reset',
          message: '会话已重置'
        });
        return;
      }

      // Agent: Start new task
      if (data.type === 'agent:task') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath: data.projectPath || '' });
          return;
        }
        const projectPath = normalizeProjectPath(data.projectPath) || 'eiscore-apps';
        if (!isAllowedProject(projectPath)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: project path not allowed'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath });
          return;
        }
        const cfg = await getAiConfig();
        if (!cfg?.api_url || !cfg?.api_key) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'AI configuration is missing in system_configs.ai_glm_config'
          }));
          logAgentEvent('agent:task_denied', ws.user, { projectPath, reason: 'ai_config_missing' });
          return;
        }
        const requestedPolicy = sanitizeWritePolicy(data.writePolicy);
        const defaultPolicy = resolveDefaultWritePolicy(projectPath);
        const hasRequestedRules = requestedPolicy.allowedFiles.length > 0 || requestedPolicy.allowedDirs.length > 0;
        const writePolicy = hasRequestedRules ? requestedPolicy : defaultPolicy;

        logAgentEvent('agent:task_start', ws.user, {
          projectPath,
          writePolicy
        });
        ws.agentConversation = new AgentConversation(projectPath, {
          writePolicy,
          model: cfg?.model || 'glm-4.6v',
          aiInvoker: createAgentTaskAiInvoker(cfg)
        });
        
        // Setup file watcher for HMR feedback
        if (ws.fileWatcher) ws.fileWatcher.stop();
        ws.fileWatcher = new FileWatcher(projectPath, (changeEvent) => {
          ws.send(JSON.stringify({
            type: 'agent:file_change',
            data: changeEvent
          }));
        });
        ws.fileWatcher.start();

        ws.send(JSON.stringify({
          type: 'agent:status',
          status: 'thinking',
          message: 'Processing your request...'
        }));

        try {
          // Execute task asynchronously
          const result = await ws.agentConversation.executeTask(data.prompt);
          ws.send(JSON.stringify({
            type: 'agent:result',
            success: result.success,
            executionLog: result.executionLog,
            totalTurns: result.totalTurns
          }));
          logAgentEvent('agent:task_result', ws.user, {
            projectPath,
            success: result.success,
            totalTurns: result.totalTurns
          });
        } catch (taskError) {
          const safeError = normalizeAgentTaskErrorMessage(taskError);
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: safeError,
            code: 'AGENT_TASK_FAILED'
          }));
          logAgentEvent('agent:task_failed', ws.user, {
            projectPath,
            error: safeError
          });
        }
        return;
      }

      // Agent: Execute specific tool
      if (data.type === 'agent:tool_use') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:tool_denied', ws.user, { tool: data.toolCall?.tool });
          return;
        }
        if (!ws.agentConversation) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'No active conversation. Send agent:task first.'
          }));
          return;
        }

        const result = await ws.agentConversation.executeToolCall(data.toolCall);
        ws.send(JSON.stringify({
          type: 'agent:tool_result',
          result
        }));
        logAgentEvent('agent:tool_result', ws.user, {
          tool: data.toolCall?.tool,
          success: result?.success !== false
        });
        return;
      }

      // Agent: Execute terminal command (limited)
      if (data.type === 'agent:terminal') {
        if (!canUseAgent(ws.user)) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'Forbidden: agent access denied'
          }));
          logAgentEvent('agent:terminal_denied', ws.user, { command: data.command || '' });
          return;
        }
        if (!ws.agentConversation) {
          ws.send(JSON.stringify({
            type: 'agent:error',
            error: 'No active conversation.'
          }));
          return;
        }

        const result = await ws.agentConversation.tools.executeCommand(data.command);
        ws.send(JSON.stringify({
          type: 'agent:terminal_result',
          result
        }));
        logAgentEvent('agent:terminal_result', ws.user, {
          success: result?.success !== false
        });
        return;
      }

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    if (ws.fileWatcher) {
      ws.fileWatcher.stop();
    }
    if (ws.flashCliSessions) {
      ws.flashCliSessions.forEach((session) => killFlashCliSessionProcess(session));
      ws.flashCliSessions.clear();
    }
  });
});
