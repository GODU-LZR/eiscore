'use strict';

const TWIN_CONTEXT_TOOL_IDS = new Set([
  'query_employees', 'query_departments', 'query_materials', 'query_inventory', 'query_warehouses', 'query_apps', 'get_my_info',
  'search_knowledge', 'list_knowledge', 'read_knowledge_file'
]);

const twinToolError = (code, status, message) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = status;
  return error;
};

const createHarnessTwinContextExecutor = ({ fetchSemanticContext, createTools, queryForUser } = {}) => {
  if (typeof fetchSemanticContext !== 'function' || typeof createTools !== 'function' || typeof queryForUser !== 'function') {
    throw new TypeError('Harness digital twin context dependencies are required');
  }

  return async (user, payload = {}) => {
    const toolId = String(payload.tool_id || payload.toolId || payload.tool_name || payload.toolName || '').trim();
    if (!TWIN_CONTEXT_TOOL_IDS.has(toolId)) {
      throw twinToolError('HARNESS_TOOL_UNAVAILABLE', 404, 'Digital twin context tool is not available');
    }

    const accessContext = await fetchSemanticContext(user);
    const tools = createTools(queryForUser(user), user, accessContext);
    const tool = tools[toolId];
    if (typeof tool?.execute !== 'function') {
      throw twinToolError('HARNESS_PERMISSION_DENIED', 403, 'Digital twin context tool is not permitted');
    }
    const args = payload.arguments && typeof payload.arguments === 'object' && !Array.isArray(payload.arguments)
      ? payload.arguments
      : {};
    return { tool_id: toolId, result: await tool.execute(args, accessContext) };
  };
};

module.exports = { TWIN_CONTEXT_TOOL_IDS, createHarnessTwinContextExecutor };
