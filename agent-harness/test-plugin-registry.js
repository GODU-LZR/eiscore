'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadPluginRegistry } = require('./plugin-registry');

const registry = loadPluginRegistry();
assert.equal(registry.contractVersion, '1.0.0');
assert.equal(registry.list().length, 9);
assert.equal(registry.getById('enterprise-bi').agent_id, 'enterprise_analyst');
assert.equal(registry.getByAgent('digital_twin').plugin_id, 'digital-twin');
assert.equal(registry.resolveCapability('eiscore_flash_write').plugin_id, 'flash-builder');
assert.deepEqual(registry.getById('flash-builder').capability_policies.eiscore_flash_write.permissions, ['flash:write']);
assert.throws(() => registry.getById('flash-builder').capability_policies.eiscore_flash_write.permissions.push('admin'), TypeError);
assert.throws(() => { registry.getById('flash-builder').capability_policies.eiscore_flash_write.input_schema.oneOf = []; }, TypeError);
assert.equal(registry.getById('flash-builder').capability_policies.eiscore_flash_write.input_schema.oneOf.length, 2);
assert.equal(registry.getById('document-intake').capability_policies.eiscore_document_plan.risk, 'low');
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.intent, 'query_business_dataset');
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.object, 'enterprise_dataset');
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.audit_required, true);
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.timeout_ms, 30000);
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.input_schema.additionalProperties, false);
assert.deepEqual(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.input_schema.required, ['dataset']);
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.output_schema.additionalProperties, false);
assert.deepEqual(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.output_schema.required, ['dataset', 'rows', 'limit']);
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.chat_input_schema.additionalProperties, false);
assert.equal(registry.getById('enterprise-bi').capability_policies.eiscore_enterprise_query.chat_output_schema.type, 'object');
assert.equal(registry.getById('worker-grid').capability_policies.eiscore_grid_query.input_schema.additionalProperties, false);
for (const capabilityId of [
  'eiscore_enterprise_query', 'eiscore_grid_query', 'eiscore_twin_chat',
  'eiscore_workflow_context', 'eiscore_sales_context', 'eiscore_document_plan',
  'eiscore_flash_read', 'eiscore_engineering_context', 'eiscore_site_sales'
]) {
  const policy = registry.resolveCapability(capabilityId).capability_policies[capabilityId];
  assert.equal(policy.chat_input_schema.additionalProperties, false, `${capabilityId} chat input must be closed`);
  assert.deepEqual(policy.chat_input_schema.required, ['messages']);
  assert.equal(policy.chat_output_schema.type, 'object');
}
assert.equal(registry.listCapabilities().length, 18);
for (const capability of registry.listCapabilities()) {
  assert.equal(capability.input_schema.type, 'object');
  assert.equal(capability.output_schema.type, 'object');
}
assert.deepEqual(registry.listCapabilities().find(({ capability_id }) => capability_id === 'eiscore_flash_write'), {
  plugin_id: 'flash-builder',
  agent_id: 'flash_builder',
  capability_id: 'eiscore_flash_write',
  intent: 'execute_flash_tool',
  object: 'flash_tool',
  risk: 'high',
  permissions: ['flash:write'],
  input_schema: registry.getById('flash-builder').capability_policies.eiscore_flash_write.input_schema,
  output_schema: { type: 'object', additionalProperties: true },
  confirm_required: true,
  idempotency_required: true,
  audit_required: true,
  timeout_ms: 60000
});
const capabilityView = registry.listCapabilities();
capabilityView.find(({ capability_id }) => capability_id === 'eiscore_flash_write').input_schema.oneOf = [];
assert.equal(registry.listCapabilities().find(({ capability_id }) => capability_id === 'eiscore_flash_write').input_schema.oneOf.length, 2);
assert.equal(registry.getById('document-intake').capability_policies.eiscore_document_commit.confirm_required, true);
assert.deepEqual(registry.listCapabilities().filter(({ plugin_id }) => plugin_id === 'workflow').map(({ capability_id, confirm_required, idempotency_required }) => ({ capability_id, confirm_required, idempotency_required })), [
  { capability_id: 'eiscore_workflow_context', confirm_required: false, idempotency_required: false },
  { capability_id: 'eiscore_workflow_write', confirm_required: true, idempotency_required: true }
]);
assert.deepEqual(registry.listCapabilities().filter(({ plugin_id }) => plugin_id === 'document-intake').map(({ capability_id, confirm_required, idempotency_required }) => ({ capability_id, confirm_required, idempotency_required })), [
  { capability_id: 'eiscore_document_plan', confirm_required: false, idempotency_required: false },
  { capability_id: 'eiscore_document_commit', confirm_required: true, idempotency_required: true }
]);
assert.equal(Object.isFrozen(registry.list()[0]), true);
assert.equal(registry.getById('missing'), null);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eiscore-harness-contract-'));
try {
  const invalidContract = JSON.parse(fs.readFileSync(require.resolve('./plugin-contract.v1.json'), 'utf8'));
  delete invalidContract.plugins[0].capability_policies.eiscore_enterprise_snapshot.input_schema;
  const invalidPath = path.join(tempDir, 'invalid.json');
  fs.writeFileSync(invalidPath, JSON.stringify(invalidContract));
  assert.throws(() => loadPluginRegistry(invalidPath), /Capability intent and object are required/);
  const duplicateContract = JSON.parse(fs.readFileSync(require.resolve('./plugin-contract.v1.json'), 'utf8'));
  duplicateContract.plugins[1].capabilities.push('eiscore_enterprise_snapshot');
  const duplicatePath = path.join(tempDir, 'duplicate.json');
  fs.writeFileSync(duplicatePath, JSON.stringify(duplicateContract));
  assert.throws(() => loadPluginRegistry(duplicatePath), /Duplicate Harness capability identity/);
  const weakPolicyContract = JSON.parse(fs.readFileSync(require.resolve('./plugin-contract.v1.json'), 'utf8'));
  weakPolicyContract.plugins[0].capability_policies.eiscore_enterprise_query.permissions = [];
  const weakPolicyPath = path.join(tempDir, 'weak-policy.json');
  fs.writeFileSync(weakPolicyPath, JSON.stringify(weakPolicyContract));
  assert.throws(() => loadPluginRegistry(weakPolicyPath), /Capability intent and object are required/);
  const weakSchemaContract = JSON.parse(fs.readFileSync(require.resolve('./plugin-contract.v1.json'), 'utf8'));
  weakSchemaContract.plugins[0].capability_policies.eiscore_enterprise_query.input_schema.type = 'array';
  const weakSchemaPath = path.join(tempDir, 'weak-schema.json');
  fs.writeFileSync(weakSchemaPath, JSON.stringify(weakSchemaContract));
  assert.throws(() => loadPluginRegistry(weakSchemaPath), /Capability schemas must be objects/);
  const weakWritePolicyContract = JSON.parse(fs.readFileSync(require.resolve('./plugin-contract.v1.json'), 'utf8'));
  weakWritePolicyContract.plugins.find(({ plugin_id }) => plugin_id === 'workflow').capability_policies.eiscore_workflow_write.confirm_required = false;
  const weakWritePolicyPath = path.join(tempDir, 'weak-write-policy.json');
  fs.writeFileSync(weakWritePolicyPath, JSON.stringify(weakWritePolicyContract));
  assert.throws(() => loadPluginRegistry(weakWritePolicyPath), /High-risk capability requires explicit confirmation and idempotency/);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
console.log('PASS: Harness plugin registry contract');
