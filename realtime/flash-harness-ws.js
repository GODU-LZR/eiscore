'use strict';

const text = (value) => String(value ?? '').trim();

const createHarnessFlashToolCallHandler = ({ execute, getToolDefinition, resolveToolId, sendWsJson, enabled = true }) => {
  if (typeof execute !== 'function' || typeof getToolDefinition !== 'function' || typeof resolveToolId !== 'function' || typeof sendWsJson !== 'function') {
    throw new TypeError('Harness Flash WebSocket handler dependencies are required');
  }
  return async (ws, payload = {}) => {
    const requestId = text(payload.requestId || payload.request_id);
    const sessionId = text(payload.sessionId || payload.session_id);
    if (!enabled) {
      sendWsJson(ws, {
        type: 'flash:tool_result', requestId, ok: false, code: 'HARNESS_DISABLED',
        message: 'DeepSeek Harness is disabled'
      });
      return;
    }
    const body = payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload) ? payload.payload : payload;
    const toolId = resolveToolId(body.tool_id || body.toolId);
    const definition = getToolDefinition(toolId);
    const capabilityId = definition?.confirm_required === true || definition?.risk_level !== 'low' ? 'eiscore_flash_write' : 'eiscore_flash_read';
    const rawArguments = body.arguments && typeof body.arguments === 'object' && !Array.isArray(body.arguments)
      ? body.arguments
      : (body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {});
    let result;
    try {
      result = await execute({
        kind: 'tool', request_id: requestId || undefined, session_id: sessionId || undefined,
        plugin_id: 'flash-builder', agent_id: 'flash_builder', capability_id: capabilityId,
        confirmed: payload.confirmed === true, idempotency_key: text(payload.idempotencyKey || payload.idempotency_key),
        user: ws.user, payload: { tool_id: toolId, arguments: rawArguments }
      });
    } catch {
      result = { ok: false, code: 'HARNESS_TOOL_EXECUTION_FAILED', message: 'Harness tool execution failed' };
    }
    sendWsJson(ws, {
      type: 'flash:tool_result', requestId: result?.request_id || requestId,
      ok: result?.ok === true, code: result?.code || (result?.ok ? 'OK' : 'HARNESS_TOOL_EXECUTION_FAILED'),
      message: result?.message, tool_id: toolId, data: result?.ok ? (result.data || {}) : undefined
    });
  };
};

module.exports = { createHarnessFlashToolCallHandler };
