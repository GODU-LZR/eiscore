'use strict';

const visibleAgents = (plugins, user = {}, { pluginIds, capabilityIds } = {}) => {
  const permissions = new Set(Array.isArray(user.permissions) ? user.permissions.map(String) : []);
  const allowedPlugins = pluginIds == null ? null : new Set(pluginIds);
  const allowedCapabilities = capabilityIds == null ? null : new Set(capabilityIds);
  return (Array.isArray(plugins) ? plugins : []).map((plugin) => {
    if (allowedPlugins && !allowedPlugins.has(plugin.plugin_id)) return null;
    const capabilities = (Array.isArray(plugin.capabilities) ? plugin.capabilities : []).filter((capability) => {
      if (allowedCapabilities && !allowedCapabilities.has(capability)) return false;
      const required = plugin.capability_policies?.[capability]?.permissions || plugin.permissions || [];
      return !required.length || permissions.has('*') || required.some((permission) => permissions.has(permission));
    });
    if (!capabilities.length) return null;
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
  }).filter(Boolean);
};

const createHarnessReadHttpHandlers = ({ authorize, registry, fetchSnapshot, sendJson, enabled = false, pluginIds, capabilityIds }) => {
  const visibility = { pluginIds, capabilityIds };
  const handleConfig = (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    sendJson(res, 200, { enabled: !!enabled, provider: 'deepseek-harness', stream: true, agents: visibleAgents(registry.list(), user, visibility) });
  };
  const handleAgents = (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    sendJson(res, 200, { role: user.role || '', agents: visibleAgents(registry.list(), user, visibility) });
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
