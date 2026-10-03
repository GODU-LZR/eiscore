'use strict';

const text = (value) => String(value ?? '').trim();

const CONTEXTS = Object.freeze({
  engineering: Object.freeze({
    permission: 'engineering:read',
    views: Object.freeze({
      equipment: Object.freeze([
        Object.freeze({ key: 'assets', path: '/equipment_assets', profile: 'public', fields: 'id,asset_no,asset_name,asset_type,location_name,asset_level,run_status,owner_dept,owner_name,next_maint_date,health_score,status', order: 'created_at.desc', limit: 100 }),
        Object.freeze({ key: 'checks', path: '/equipment_checks', profile: 'public', fields: 'id,check_no,asset_no,asset_name,check_type,check_item_count,abnormal_count,check_result,checker,check_date,status', order: 'check_date.desc', limit: 100 }),
        Object.freeze({ key: 'issues', path: '/equipment_issues', profile: 'public', fields: 'id,issue_no,asset_no,asset_name,issue_level,owner_dept,owner_name,occurred_date,deadline,issue_status,status', order: 'occurred_date.desc', limit: 100 })
      ]),
      bom: Object.freeze([
        Object.freeze({ key: 'boms', path: '/v_boms', profile: 'scm', fields: 'id,bom_no,bom_name,parent_material_code,parent_material_name,version,bom_type,status,base_qty,item_count', order: 'bom_no.asc', limit: 100 }),
        Object.freeze({ key: 'items', path: '/v_bom_items', profile: 'scm', fields: 'bom_id,bom_no,bom_name,parent_material_code,parent_material_name,component_material_code,component_material_name,qty,unit,loss_rate,issue_method,line_no', order: 'bom_no.asc,line_no.asc', limit: 200 })
      ]),
      production: Object.freeze([
        Object.freeze({ key: 'work_orders', path: '/v_production_work_orders', profile: 'scm', fields: 'work_order_no,product_material_code,product_material_name,planned_qty,unit,planned_start_date,planned_finish_date,work_order_status,priority,item_count,shortage_item_count,source_order_nos', order: 'planned_finish_date.asc', limit: 100 })
      ])
    })
  }),
  site_sales: Object.freeze({
    permission: 'site:sales',
    views: Object.freeze({
      site: Object.freeze([
        Object.freeze({ key: 'site', path: '/site_config', profile: 'company_site', fields: 'site_key,domain,default_locale,enabled_locales,status,published_snapshot,updated_at', order: 'site_key.asc', limit: 1 })
      ]),
      catalog: Object.freeze([
        Object.freeze({ key: 'products', path: '/products', profile: 'company_site', fields: 'id,slug,status,sort_order,category,cover_image,updated_at', order: 'sort_order.asc,updated_at.desc', limit: 100 })
      ]),
      knowledge: Object.freeze([
        Object.freeze({ key: 'knowledge', path: '/knowledge_documents', profile: 'company_site', fields: 'id,locale,document_type,title,content,citations,forbidden_claims,status,version,updated_at', order: 'updated_at.desc', limit: 30 })
      ])
    })
  })
});

const reject = (message, code = 'HARNESS_CONTEXT_INVALID', status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = status;
  throw error;
};

const createHarnessContextCapabilities = ({ callPostgrestWithUser } = {}) => {
  if (typeof callPostgrestWithUser !== 'function') throw new TypeError('Harness context PostgREST adapter is required');

  const execute = async (kind, user, payload = {}) => {
    const context = CONTEXTS[kind];
    if (!context) return reject('Harness context is unavailable', 'HARNESS_TOOL_UNAVAILABLE', 404);
    const input = payload && typeof payload === 'object' ? payload : {};
    if (input.table || input.table_name || input.schema || input.sql || input.url || input.tenant_id || input.user_id || input.jwt || input.site_key) {
      return reject('context contains an unsupported authorization or database field');
    }
    const view = text(input.view || input.view_id || Object.keys(context.views)[0]);
    const requests = context.views[view];
    if (!requests) return reject('context view is not available');
    const result = {};
    for (const definition of requests) {
      const response = await callPostgrestWithUser(user, {
        method: 'GET',
        path: definition.path,
        query: { select: definition.fields, limit: String(definition.limit), order: definition.order, ...(kind === 'site_sales' ? { site_key: 'eq.primary', status: 'eq.published' } : {}) },
        acceptProfile: definition.profile,
        timeoutMs: 8000
      });
      result[definition.key] = Array.isArray(response?.data) ? response.data : [];
    }
    return { context: kind, view, data: result };
  };

  return Object.freeze({
    executeEngineering: (user, payload) => execute('engineering', user, payload),
    executeSiteSales: (user, payload) => execute('site_sales', user, payload),
    contexts: CONTEXTS
  });
};

module.exports = { CONTEXTS, createHarnessContextCapabilities };
