'use strict';

const visibleAgents = (plugins, user = {}) => {
  const permissions = new Set(Array.isArray(user.permissions) ? user.permissions.map(String) : []);
  return (Array.isArray(plugins) ? plugins : []).map((plugin) => {
    const capabilities = (Array.isArray(plugin.capabilities) ? plugin.capabilities : []).filter((capability) => {
      const required = plugin.capability_policies?.[capability]?.permissions || plugin.permissions || [];
      return !required.length || permissions.has('*') || required.some((permission) => permissions.has(permission));
    });
    const capabilityPolicies = Object.fromEntries(capabilities.map((capability) => {
      const policy = plugin.capability_policies?.[capability] || plugin;
      return [capability, {
        intent: policy.intent,
        object: policy.object,
        risk: policy.risk || plugin.risk,
        permissions: [...(policy.permissions || plugin.permissions || [])],
        confirm_required: policy.confirm_required === true,
        idempotency_required: policy.idempotency_required === true,
        audit_required: policy.audit_required === true,
        timeout_ms: policy.timeout_ms || plugin.timeout_ms
      }];
    }));
    return { plugin_id: plugin.plugin_id, agent_id: plugin.agent_id, capabilities, capability_policies: capabilityPolicies, risk: plugin.risk };
  }).filter(({ capabilities }) => capabilities.length > 0);
};

const createHarnessReadHttpHandlers = ({ authorize, registry, fetchSnapshot, sendJson, enabled = false }) => {
  const handleConfig = (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    sendJson(res, 200, { enabled: !!enabled, provider: 'deepseek-harness', stream: true, agents: visibleAgents(registry.list(), user) });
  };
  const handleAgents = (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    sendJson(res, 200, { role: user.role || '', agents: visibleAgents(registry.list(), user) });
  };
  const handleBusinessSnapshot = async (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    if (!enabled) { sendJson(res, 503, { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' }); return; }
    try { sendJson(res, 200, { ok: true, snapshot: await fetchSnapshot(user, { signal: req.signal }) }); }
    catch (error) {
      const permissionDenied = error?.code === 'HARNESS_PERMISSION_DENIED' || Number(error?.httpStatus || error?.status) === 403;
      const cancelled = error?.code === 'HARNESS_REQUEST_CANCELLED';
      sendJson(res, permissionDenied ? 403 : (cancelled ? 499 : 503), {
        code: permissionDenied ? 'HARNESS_PERMISSION_DENIED' : (cancelled ? 'HARNESS_REQUEST_CANCELLED' : 'HARNESS_UPSTREAM_UNAVAILABLE'),
        message: permissionDenied ? 'Harness capability is not permitted' : (cancelled ? 'Harness request was cancelled' : 'DeepSeek Harness is unavailable')
      });
    }
  };
  return Object.freeze({ handleConfig, handleAgents, handleBusinessSnapshot });
};

module.exports = { createHarnessReadHttpHandlers, visibleAgents };
