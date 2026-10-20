'use strict';

const crypto = require('node:crypto');

const PROFILE_IDS = Object.freeze(['business', 'flash']);
const PERSONA_IDS = Object.freeze(['work-assistant', 'workbench', 'flash']);
const PROFILE_PLUGINS = Object.freeze({
  business: Object.freeze([
    'enterprise-bi', 'worker-grid', 'digital-twin', 'workflow', 'company-sales',
    'document-intake', 'engineering', 'independent-site-sales'
  ]),
  flash: Object.freeze(['flash-builder'])
});
// Runtime profile (business/flash) is a deployment boundary. Persona is the
// trusted surface within that boundary; it is selected by the service
// environment, never by browser-provided plugin or mode fields.
const PERSONA_PLUGINS = Object.freeze({
  'work-assistant': Object.freeze([
    'worker-grid', 'enterprise-bi', 'document-intake', 'workflow', 'company-sales'
  ]),
  workbench: Object.freeze(['enterprise-bi', 'digital-twin', 'workflow', 'company-sales', 'engineering', 'independent-site-sales']),
  flash: Object.freeze(['flash-builder'])
});
const PERSONA_CAPABILITIES = Object.freeze({
  'work-assistant': Object.freeze({
    'worker-grid': Object.freeze(['eiscore_grid_query']),
    'enterprise-bi': Object.freeze([
      'eiscore_multimodal_translate', 'eiscore_multimodal_ocr', 'eiscore_multimodal_map_locate'
    ]),
    'document-intake': Object.freeze(['eiscore_document_plan', 'eiscore_document_commit']),
    workflow: Object.freeze(['eiscore_workflow_context', 'eiscore_workflow_write']),
    'company-sales': Object.freeze(['eiscore_sales_context', 'eiscore_sales_write'])
  }),
  workbench: Object.freeze({
    'enterprise-bi': Object.freeze([
      'eiscore_enterprise_snapshot', 'eiscore_enterprise_query',
      'eiscore_multimodal_translate', 'eiscore_multimodal_ocr', 'eiscore_multimodal_map_locate'
    ]),
    'digital-twin': Object.freeze(['eiscore_twin_context', 'eiscore_twin_chat']),
    workflow: Object.freeze(['eiscore_workflow_context', 'eiscore_workflow_write']),
    'company-sales': Object.freeze(['eiscore_sales_context']),
    engineering: Object.freeze(['eiscore_engineering_context']),
    'independent-site-sales': Object.freeze(['eiscore_site_sales'])
  }),
  flash: Object.freeze({
    'flash-builder': Object.freeze(['eiscore_flash_read', 'eiscore_flash_write'])
  })
});
// Workbench inherits the legacy business workspace so existing user sessions
// remain visible. Work-assistant receives a new namespace; Flash is separate.
const PERSONA_WORKSPACE_PROFILES = Object.freeze({
  'work-assistant': 'work-assistant',
  workbench: 'business',
  flash: 'flash'
});
const PERSONA_AUDIENCES = Object.freeze({
  'work-assistant': 'work-assistant',
  workbench: 'workbench',
  flash: 'flash'
});
const PERSONA_PROMPTS = Object.freeze({
  'work-assistant': '你是 EISCore 工作助手。帮助用户完成日常办公、资料整理、表格查询、文档解析和受控业务操作。只使用当前工作助手服务端授予的工具；遵守用户权限、租户隔离、字段访问控制、写确认、幂等和审计要求。不要访问工作台分析、数字分身、闪念编程工作区或其工具。',
  workbench: '你是 EISCore 工作台助手，负责数字分身、智能 BI、经营分析、指标解释和受控业务流程。只使用当前工作台服务端授予的工具；遵守用户权限、租户隔离、字段访问控制、写确认、幂等和审计要求。图表或网页只输出可渲染且不携带凭据的内容。不要访问工作助手的独立会话或闪念编程工作区。',
  flash: '你是 EISCore 闪念编程助手。只在当前闪念应用工作区内编程、预览和发布受控应用，只使用 flash-builder 工具。不要读取或写入业务数据，不要访问工作助手、数字分身、智能 BI 或工作台插件。'
});

const normalizeProfile = (value) => String(value || '').trim().toLowerCase();
const isHarnessProfile = (value) => PROFILE_IDS.includes(normalizeProfile(value));
const requireHarnessProfile = (value, name = 'HARNESS_PROFILE') => {
  const profile = normalizeProfile(value);
  if (!PROFILE_IDS.includes(profile)) {
    const error = new Error(`${name} must be one of: ${PROFILE_IDS.join(', ')}`);
    error.code = 'HARNESS_PROFILE_INVALID';
    throw error;
  }
  return profile;
};
const normalizePersona = (value) => String(value || '').trim().toLowerCase();
const isHarnessPersona = (value) => PERSONA_IDS.includes(normalizePersona(value));
const requireHarnessPersona = (value, name = 'HARNESS_PERSONA') => {
  const persona = normalizePersona(value);
  if (!PERSONA_IDS.includes(persona)) {
    const error = new Error(`${name} must be one of: ${PERSONA_IDS.join(', ')}`);
    error.code = 'HARNESS_PERSONA_INVALID';
    throw error;
  }
  return persona;
};
const validateHarnessPersonaProfile = (profile, persona) => {
  const normalizedProfile = requireHarnessProfile(profile, 'runtime profile');
  const normalizedPersona = requireHarnessPersona(persona);
  const compatible = normalizedProfile === 'flash'
    ? normalizedPersona === 'flash'
    : normalizedPersona !== 'flash';
  if (!compatible) {
    const error = new Error(`HARNESS_PERSONA ${normalizedPersona} is incompatible with ${normalizedProfile} runtime profile`);
    error.code = 'HARNESS_PERSONA_PROFILE_MISMATCH';
    throw error;
  }
  return normalizedPersona;
};
const pluginsForPersona = (persona) => PERSONA_PLUGINS[requireHarnessPersona(persona)];
const capabilitiesForPersona = (persona) => Object.freeze(
  Object.values(PERSONA_CAPABILITIES[requireHarnessPersona(persona)]).flat()
);
const audienceForPersona = (persona) => PERSONA_AUDIENCES[requireHarnessPersona(persona)];
const promptForPersona = (persona) => PERSONA_PROMPTS[requireHarnessPersona(persona)];
const pluginsForProfile = (profile) => PROFILE_PLUGINS[requireHarnessProfile(profile)];
const workspaceForProfileOwner = (profile, subject, tenant) => {
  const normalizedProfile = requireHarnessProfile(profile, 'runtime profile');
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify([normalizedProfile, String(tenant || ''), String(subject || '')]))
    .digest('hex');
  return `${normalizedProfile}_ws_${digest}`;
};
const workspaceForPersonaOwner = (persona, subject, tenant) => {
  const normalizedPersona = requireHarnessPersona(persona, 'runtime persona');
  const workspaceProfile = PERSONA_WORKSPACE_PROFILES[normalizedPersona];
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify([workspaceProfile, String(tenant || ''), String(subject || '')]))
    .digest('hex');
  return `${workspaceProfile}_ws_${digest}`;
};

module.exports = {
  PROFILE_IDS,
  PROFILE_PLUGINS,
  PERSONA_IDS,
  PERSONA_PLUGINS,
  PERSONA_CAPABILITIES,
  PERSONA_AUDIENCES,
  PERSONA_PROMPTS,
  PERSONA_WORKSPACE_PROFILES,
  normalizeProfile,
  isHarnessProfile,
  requireHarnessProfile,
  pluginsForProfile,
  normalizePersona,
  isHarnessPersona,
  requireHarnessPersona,
  validateHarnessPersonaProfile,
  pluginsForPersona,
  capabilitiesForPersona,
  audienceForPersona,
  promptForPersona,
  workspaceForProfileOwner,
  workspaceForPersonaOwner
};
