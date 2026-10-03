'use strict';

const { formatMultimodalResult, sanitizeMultimodalPayload } = require('./harness-multimodal');

const text = (value) => String(value ?? '').trim();
const TOOL_ERROR_CODES = new Set([
  'HARNESS_REQUEST_CANCELLED',
  'HARNESS_PERMISSION_DENIED', 'HARNESS_TOOL_UNAVAILABLE', 'HARNESS_TOOL_NOT_ALLOWED', 'HARNESS_TOOL_ID_REQUIRED',
  'HARNESS_TOOL_EXECUTION_FAILED', 'HARNESS_CONTEXT_INVALID', 'HARNESS_QUERY_INVALID', 'HARNESS_PLAN_ID_REQUIRED',
  'HARNESS_CAPACITY_EXCEEDED',
  'HARNESS_PLAN_ID_INVALID', 'HARNESS_PLAN_VERSION_REQUIRED', 'HARNESS_PLAN_NOT_FOUND', 'HARNESS_PLAN_VERSION_MISMATCH',
  'HARNESS_PLAN_NOT_PLANNED', 'HARNESS_PLAN_TARGET_UNSUPPORTED', 'HARNESS_PLAN_COMMIT_CONFLICT', 'HARNESS_SALES_WRITE_FAILED',
  'HARNESS_SALES_OPERATION_INVALID', 'HARNESS_SALES_RESOURCE_ID_INVALID', 'HARNESS_SALES_OBJECT_TYPE_INVALID',
  'HARNESS_TWIN_PERSISTENCE_UNAVAILABLE', 'HARNESS_TWIN_PERSISTENCE_FAILED', 'MESSAGE_REQUIRED', 'SESSION_ID_INVALID',
  'SESSION_ACCESS_DENIED', 'HARNESS_CONFIRMATION_REQUIRED', 'HARNESS_IDEMPOTENCY_REQUIRED',
  'HARNESS_MULTIMODAL_INVALID', 'TEXT_REQUIRED'
]);
const TOOL_ERROR_ALIASES = Object.freeze({
  PERMISSION_DENIED: 'HARNESS_PERMISSION_DENIED',
  CONFIRM_REQUIRED: 'HARNESS_CONFIRMATION_REQUIRED',
  VALIDATION_FAILED: 'HARNESS_TOOL_EXECUTION_FAILED',
  TOOL_NOT_FOUND: 'HARNESS_TOOL_UNAVAILABLE',
  CLI_ERROR: 'HARNESS_TOOL_EXECUTION_FAILED',
  CAPACITY_EXCEEDED: 'HARNESS_CAPACITY_EXCEEDED'
});
const TOOL_GATEWAY_CAPABILITIES = Object.freeze([
  'eiscore_document_plan', 'eiscore_document_commit', 'eiscore_enterprise_snapshot', 'eiscore_enterprise_query',
  'eiscore_grid_query', 'eiscore_flash_read', 'eiscore_flash_write', 'eiscore_twin_context', 'eiscore_twin_chat',
  'eiscore_workflow_context', 'eiscore_workflow_write', 'eiscore_sales_context', 'eiscore_sales_write',
  'eiscore_engineering_context', 'eiscore_site_sales', 'eiscore_multimodal_translate',
  'eiscore_multimodal_ocr', 'eiscore_multimodal_map_locate'
]);
const MULTIMODAL_CAPABILITIES = new Set([
  'eiscore_multimodal_translate', 'eiscore_multimodal_ocr', 'eiscore_multimodal_map_locate'
]);
const safeToolError = (errorOrCode, status = 502) => {
  const rawCode = text(typeof errorOrCode === 'string' ? errorOrCode : errorOrCode?.code);
  const code = TOOL_ERROR_ALIASES[rawCode] || rawCode;
  const resolvedStatus = Number(typeof errorOrCode === 'object' ? errorOrCode?.httpStatus || errorOrCode?.status || status : status);
  const safeStatus = Number.isFinite(resolvedStatus) && resolvedStatus >= 400 && resolvedStatus <= 599 ? resolvedStatus : 502;
  const safeCode = TOOL_ERROR_CODES.has(code) ? code : (safeStatus === 403 ? 'HARNESS_PERMISSION_DENIED' : 'HARNESS_TOOL_EXECUTION_FAILED');
  return {
    code: safeCode,
    status: safeStatus,
    message: safeStatus >= 500 ? 'Harness tool execution failed' : (safeCode === 'HARNESS_PERMISSION_DENIED' ? 'Harness capability is not permitted' : 'Harness tool request rejected')
  };
};
const stableToolError = (errorOrCode, status = 502, stableError) => {
  const normalized = safeToolError(errorOrCode, status);
  return stableError(normalized.code, normalized.status, normalized.message);
};
const wrapDirectResult = (raw, stableError, status = 502) => {
  if (raw && typeof raw === 'object' && raw.ok === false) {
    return stableToolError(raw, status, stableError);
  }
  return { ok: true, status: 200, data: raw };
};

const createHarnessToolGateway = ({
  executeFlashToolCall,
  executeEnterpriseSnapshot,
  executeDigitalTwinContext,
  executeDigitalTwinChat,
  executeConstrainedQuery,
  executeWorkflowContext,
  executeWorkflowWrite,
  executeSalesContext,
  executeSalesWrite,
  executeDocumentPlan,
  executeDocumentCommit,
  executeEngineeringContext,
  executeSiteSales,
  executeMultimodal,
  normalizeToolCallBoolean = (value) => value === true,
  stableError = (code, status, message) => ({ ok: false, code, status, message })
} = {}) => {
  if (typeof executeFlashToolCall !== 'function') throw new TypeError('Harness Flash tool executor is required');

  const execute = async (request = {}) => {
    const capability = text(request.capability_id || request.capabilityId);
    if (MULTIMODAL_CAPABILITIES.has(capability)) {
      if (typeof executeMultimodal !== 'function') return stableError('HARNESS_TOOL_UNAVAILABLE', 404, 'Harness multimodal tool is unavailable');
      try {
        const payload = sanitizeMultimodalPayload(capability, request.payload || {});
        const result = await executeMultimodal(capability, request.user, payload, request);
        return wrapDirectResult(result && typeof result === 'object' && result.ok === false
          ? result
          : formatMultimodalResult(capability, result), stableError);
      } catch (error) {
        return stableToolError(error, 502, stableError);
      }
    }
    if (capability === 'eiscore_enterprise_snapshot') {
      if (typeof executeEnterpriseSnapshot !== 'function') return stableError('HARNESS_TOOL_UNAVAILABLE', 404, 'Harness enterprise snapshot tool is unavailable');
      try {
        return wrapDirectResult(await executeEnterpriseSnapshot(request.user, request.payload || {}), stableError);
      } catch (error) {
        return stableToolError(error, 502, stableError);
      }
    }
    if (capability === 'eiscore_twin_context') {
      if (typeof executeDigitalTwinContext !== 'function') return stableError('HARNESS_TOOL_UNAVAILABLE', 404, 'Harness digital twin context tool is unavailable');
      try {
        return wrapDirectResult(await executeDigitalTwinContext(request.user, request.payload || {}), stableError);
      } catch (error) {
        return stableToolError(error, 502, stableError);
      }
    }
    if (capability === 'eiscore_twin_chat') {
      if (typeof executeDigitalTwinChat !== 'function') return stableError('HARNESS_TOOL_UNAVAILABLE', 404, 'Harness digital twin chat tool is unavailable');
      try {
        return wrapDirectResult(await executeDigitalTwinChat(request.user, request.payload || {}, request), stableError);
      } catch (error) {
        return stableToolError(error, 502, stableError);
      }
    }
    if (capability === 'eiscore_enterprise_query' || capability === 'eiscore_grid_query') {
      if (typeof executeConstrainedQuery !== 'function') return stableError('HARNESS_TOOL_UNAVAILABLE', 404, 'Harness query tool is unavailable');
      try {
        return wrapDirectResult(await executeConstrainedQuery(request.user, request.payload || {}, request.plugin?.plugin_id || request.plugin_id), stableError);
      } catch (error) {
        return stableToolError(error, 502, stableError);
      }
    }
    const directExecutors = {
      eiscore_workflow_context: executeWorkflowContext,
      eiscore_workflow_write: executeWorkflowWrite,
      eiscore_sales_context: executeSalesContext,
      eiscore_sales_write: executeSalesWrite,
      eiscore_document_plan: executeDocumentPlan,
      eiscore_document_commit: executeDocumentCommit,
      eiscore_engineering_context: executeEngineeringContext,
      eiscore_site_sales: executeSiteSales
    };
    const directExecutor = directExecutors[capability];
    if (typeof directExecutor === 'function') {
      try {
        return wrapDirectResult(await directExecutor(request.user, request.payload || {}, request), stableError);
      } catch (error) {
        return stableToolError(error, 502, stableError);
      }
    }
    if (capability !== 'eiscore_flash_read' && capability !== 'eiscore_flash_write') {
      return stableError('HARNESS_TOOL_UNAVAILABLE', 404, 'Harness tool capability is not available');
    }
    const payload = request.payload && typeof request.payload === 'object' ? request.payload : {};
    const toolId = text(payload.tool_id || payload.toolId);
    if (!toolId) return stableError('HARNESS_TOOL_ID_REQUIRED', 400, 'tool_id is required');
    const args = payload.arguments && typeof payload.arguments === 'object' ? payload.arguments : payload.args || {};
    const confirmed = normalizeToolCallBoolean(request.confirmed);
    const idempotencyKey = text(request.idempotency_key || request.idempotencyKey);
    try {
      const result = await executeFlashToolCall(request.user, {
        ...payload,
        tool_id: toolId,
        arguments: args,
        confirmed,
        idempotency_key: idempotencyKey,
        trace_id: text(request.request_id || request.requestId),
        session_id: text(request.session_id || request.sessionId)
      }, 'harness');
      if (result?.payload?.ok === false) {
        const normalized = safeToolError({ code: result?.payload?.code, status: result?.status }, Number(result?.status || 502));
        return stableError(normalized.code, normalized.status, normalized.message);
      }
      return { ok: true, status: Number(result?.status || 200), data: result?.payload?.data, code: result?.payload?.code, message: result?.payload?.message };
    } catch (error) {
      return stableToolError(error, 502, stableError);
    }
  };

  return Object.freeze({ execute });
};

module.exports = { MULTIMODAL_CAPABILITIES, TOOL_GATEWAY_CAPABILITIES, createHarnessToolGateway };
