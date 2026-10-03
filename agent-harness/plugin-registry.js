'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CONTRACT_PATH = path.join(__dirname, 'plugin-contract.v1.json');
const ALLOWED_RISKS = new Set(['low', 'medium', 'high', 'critical']);
const ID_RE = /^[a-z][a-z0-9_-]{1,63}$/;
const policyForCapability = (plugin, capabilityId) => plugin?.capability_policies?.[capabilityId] || plugin || {};
const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const loadPluginRegistry = (filePath = CONTRACT_PATH) => {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (raw?.contract_version !== '1.0.0' || !Array.isArray(raw.plugins) || raw.plugins.length === 0) {
    throw new Error('Invalid Harness plugin contract');
  }
  const byId = new Map();
  const byAgent = new Map();
  const byCapability = new Map();
  for (const plugin of raw.plugins) {
    if (!ID_RE.test(String(plugin.plugin_id || '')) || !ID_RE.test(String(plugin.agent_id || ''))) {
      throw new Error('Invalid Harness plugin identity');
    }
    if (byId.has(plugin.plugin_id) || byAgent.has(plugin.agent_id)) throw new Error('Duplicate Harness plugin identity');
    if (!Array.isArray(plugin.capabilities) || plugin.capabilities.length === 0) throw new Error('Plugin capabilities required');
    const pluginCapabilities = new Set();
    if (!ALLOWED_RISKS.has(plugin.risk) || !Number.isInteger(plugin.timeout_ms) || plugin.timeout_ms < 1000 || plugin.timeout_ms > 120000) {
      throw new Error(`Invalid plugin risk or timeout: ${plugin.plugin_id}`);
    }
    if (plugin.confirm_required && !plugin.idempotency_required) throw new Error(`Confirmed writes require idempotency: ${plugin.plugin_id}`);
    const capabilityPoliciesInput = plugin.capability_policies || {};
    for (const capability of plugin.capabilities) {
      if (!ID_RE.test(String(capability || ''))) throw new Error(`Invalid Harness capability identity: ${plugin.plugin_id}.${capability}`);
      if (pluginCapabilities.has(capability) || byCapability.has(capability)) throw new Error(`Duplicate Harness capability identity: ${capability}`);
      pluginCapabilities.add(capability);
      const policy = capabilityPoliciesInput[capability];
      if (!policy || !String(policy.intent || '').trim() || !String(policy.object || '').trim() || !policy.input_schema || !policy.output_schema || !Array.isArray(policy.permissions) || policy.permissions.length === 0) {
        throw new Error(`Capability intent and object are required: ${plugin.plugin_id}.${capability}`);
      }
      if (policy.input_schema.type !== 'object' || policy.output_schema.type !== 'object') {
        throw new Error(`Capability schemas must be objects: ${plugin.plugin_id}.${capability}`);
      }
      for (const schemaName of ['chat_input_schema', 'chat_output_schema']) {
        if (policy[schemaName] !== undefined && (!policy[schemaName] || typeof policy[schemaName] !== 'object' || policy[schemaName].type !== 'object')) {
          throw new Error(`Capability ${schemaName} must be an object schema: ${plugin.plugin_id}.${capability}`);
        }
      }
      if (policy.audit_required !== true || !Number.isInteger(policy.timeout_ms) || policy.timeout_ms < 1000 || policy.timeout_ms > plugin.timeout_ms) {
        throw new Error(`Capability audit or timeout policy is invalid: ${plugin.plugin_id}.${capability}`);
      }
      const risk = policy.risk || plugin.risk;
      if ((risk === 'high' || risk === 'critical') && (policy.confirm_required !== true || policy.idempotency_required !== true)) {
        throw new Error(`High-risk capability requires explicit confirmation and idempotency: ${plugin.plugin_id}.${capability}`);
      }
    }
    for (const [capability, policy] of Object.entries(capabilityPoliciesInput)) {
      if (!plugin.capabilities.includes(capability)) throw new Error(`Policy references unregistered capability: ${plugin.plugin_id}.${capability}`);
      if (!ALLOWED_RISKS.has(policy.risk || plugin.risk)) throw new Error(`Invalid capability risk: ${plugin.plugin_id}.${capability}`);
      if ((policy.confirm_required || policy.idempotency_required) && !(policy.idempotency_required || plugin.idempotency_required)) {
        throw new Error(`Confirmed capability requires idempotency: ${plugin.plugin_id}.${capability}`);
      }
      if (policy.confirm_required && !(policy.idempotency_required || plugin.idempotency_required)) throw new Error(`Confirmed capability requires idempotency: ${plugin.plugin_id}.${capability}`);
    }
    const capabilityPolicies = deepFreeze(Object.fromEntries(Object.entries(capabilityPoliciesInput).map(([capability, policy]) => [
      capability,
      deepFreeze({
        ...policy,
        input_schema: cloneJson(policy.input_schema),
        output_schema: cloneJson(policy.output_schema),
        ...(policy.chat_input_schema ? { chat_input_schema: cloneJson(policy.chat_input_schema) } : {}),
        ...(policy.chat_output_schema ? { chat_output_schema: cloneJson(policy.chat_output_schema) } : {}),
        permissions: [...(policy.permissions || [])]
      })
    ])));
    const frozen = deepFreeze({ ...plugin, input_schema: cloneJson(plugin.input_schema), output_schema: cloneJson(plugin.output_schema), capabilities: [...plugin.capabilities], permissions: [...(plugin.permissions || [])], capability_policies: capabilityPolicies });
    byId.set(plugin.plugin_id, frozen);
    byAgent.set(plugin.agent_id, frozen);
    for (const capability of plugin.capabilities) byCapability.set(capability, frozen);
  }
  const capabilityList = Object.freeze([...byId.values()].flatMap((plugin) => plugin.capabilities.map((capabilityId) => {
    const policy = policyForCapability(plugin, capabilityId);
    return Object.freeze({
      plugin_id: plugin.plugin_id,
      agent_id: plugin.agent_id,
      capability_id: capabilityId,
      intent: policy.intent,
      object: policy.object,
      risk: policy.risk,
      permissions: Object.freeze([...(policy.permissions || plugin.permissions || [])]),
      input_schema: policy.input_schema,
      output_schema: policy.output_schema,
      confirm_required: policy.confirm_required === true,
      idempotency_required: policy.idempotency_required === true,
      audit_required: policy.audit_required === true,
      timeout_ms: policy.timeout_ms || plugin.timeout_ms
    });
  })));
  return Object.freeze({
    contractVersion: raw.contract_version,
    list: () => [...byId.values()],
    listCapabilities: () => capabilityList.map((capability) => cloneJson(capability)),
    getById: (id) => byId.get(String(id || '').trim()) || null,
    getByAgent: (id) => byAgent.get(String(id || '').trim()) || null,
    resolveCapability: (capability) => byCapability.get(String(capability || '').trim()) || null
  });
};

module.exports = { CONTRACT_PATH, loadPluginRegistry };
