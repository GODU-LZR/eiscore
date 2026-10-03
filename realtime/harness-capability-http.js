'use strict';

const { formatMultimodalResult } = require('./harness-multimodal');

const ROUTE_CAPABILITIES = Object.freeze({
  '/ai/translate': 'eiscore_multimodal_translate',
  '/ai/ocr': 'eiscore_multimodal_ocr',
  '/ai/map-locate': 'eiscore_multimodal_map_locate'
});

const createHarnessCapabilityHttpHandlers = ({ authorize, gateway, readJsonBody, sendJson, enabled = true }) => {
  const handleCapability = async (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    if (!enabled) { sendJson(res, 503, { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' }); return; }
    let body;
    try { body = await readJsonBody(req); } catch (error) { sendJson(res, 400, { code: 'BAD_REQUEST', message: error?.message === 'Payload too large' ? 'Payload too large' : 'Invalid request body' }); return; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid request body' }); return; }
    const routePath = String(req.url || '').split('?')[0];
    const capabilityId = ROUTE_CAPABILITIES[routePath];
    const requestedCapability = String(body.capability_id || body.capabilityId || '').trim();
    if (!capabilityId) { sendJson(res, 404, { code: 'HARNESS_CAPABILITY_UNAVAILABLE', message: 'Harness capability endpoint is unavailable' }); return; }
    if (requestedCapability && requestedCapability !== capabilityId) {
      sendJson(res, 403, { code: 'HARNESS_CAPABILITY_MISMATCH', message: 'Capability does not match endpoint' });
      return;
    }
    let result;
    try {
      result = await gateway.execute({ request_id: body.request_id || body.requestId, session_id: body.session_id || body.sessionId, plugin_id: 'enterprise-bi', agent_id: 'enterprise_analyst', capability_id: capabilityId, user, payload: body.payload && typeof body.payload === 'object' ? body.payload : body, signal: req.signal });
    } catch {
      sendJson(res, 502, { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' });
      return;
    }
    if (!result.ok) { sendJson(res, result.status || 502, { code: result.code, message: result.message }); return; }
    const data = String(capabilityId).startsWith('eiscore_multimodal_') ? formatMultimodalResult(capabilityId, result.data) : (result.data || {});
    sendJson(res, 200, data, { 'X-Eis-Ai-Backend': 'harness' });
  };
  return Object.freeze({ handleCapability });
};

module.exports = { ROUTE_CAPABILITIES, createHarnessCapabilityHttpHandlers };
