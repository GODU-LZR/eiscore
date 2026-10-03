'use strict';

const { visibleAgents } = require('./harness-read-http');

const createHarnessHttpHandlers = ({ authorize, gateway, enabled, readJsonBody, sendJson }) => {
  const handleExecute = async (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    if (!enabled) { sendJson(res, 503, { code: 'HARNESS_DISABLED', message: 'DeepSeek Harness is disabled' }); return; }
    let body;
    try { body = await readJsonBody(req); } catch (error) { sendJson(res, 400, { code: 'BAD_REQUEST', message: error?.message === 'Payload too large' ? 'Payload too large' : 'Invalid request body' }); return; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { sendJson(res, 400, { code: 'BAD_REQUEST', message: 'Invalid request body' }); return; }
    let result;
    try {
      result = await gateway.execute({ ...body, user, request_id: body.request_id || body.requestId, payload: body.payload || {}, dispatch: undefined, signal: req.signal });
    } catch {
      sendJson(res, 502, { code: 'HARNESS_UPSTREAM_UNAVAILABLE', message: 'DeepSeek Harness is unavailable' });
      return;
    }
    sendJson(res, result.status || (result.ok ? 200 : 502), result.ok ? { request_id: result.request_id, data: result.data } : { code: result.code, message: result.message });
  };

  const handleMetrics = (req, res) => {
    const user = authorize(req, res);
    if (!user) return;
    sendJson(res, 200, { enabled: !!enabled, registry: visibleAgents(gateway.registry.list(), user) });
  };

  return Object.freeze({ handleExecute, handleMetrics });
};

module.exports = { createHarnessHttpHandlers };
