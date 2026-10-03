'use strict';

const { filterVisibleFields, prepareFieldAclRead, stripFieldAcl } = require('./flash-field-acl');

const DATASETS = Object.freeze({
  materials: Object.freeze({ path: '/raw_materials', profile: 'public', module: 'mms_ledger', permissions: ['module:materials', 'app:mms_ledger'], fields: ['id', 'name', 'category', 'weight_kg', 'entry_date', 'updated_at'], order: 'updated_at.desc' }),
  inventory: Object.freeze({ path: '/v_inventory_current', profile: 'scm', module: 'mms_ledger', permissions: ['module:materials', 'app:mms_ledger'], fields: ['id', 'material_code', 'material_name', 'warehouse_name', 'available_qty', 'total_qty', 'unit', 'status', 'last_transaction_at'], order: 'material_name.asc' }),
  sales_orders: Object.freeze({ path: '/sales_orders', profile: 'public', module: 'sales', permissions: ['module:sales', 'app:sales_dashboard', 'app:sales_order'], fields: ['id', 'order_no', 'customer_name', 'product_name', 'quantity', 'total_amount', 'order_date', 'delivery_date', 'order_status'], order: 'order_date.desc' }),
  production_orders: Object.freeze({ path: '/production_orders', profile: 'production', module: 'production', permissions: ['module:production', 'app:production_plan', 'app:production_work_order'], fields: ['id', 'work_order_no', 'product_material_name', 'planned_qty', 'planned_start_date', 'planned_finish_date', 'work_order_status', 'priority'], order: 'planned_finish_date.asc' }),
  employees: Object.freeze({ path: '/archives', profile: 'hr', module: 'hr_employee', permissions: ['module:hr', 'app:hr_employee', 'op:hr_employee.view'], fields: ['id', 'employee_no', 'name', 'department', 'position', 'entry_date', 'status'], order: 'entry_date.desc' }),
  apps: Object.freeze({ path: '/apps', profile: 'app_center', module: 'app_center', permissions: ['module:app', 'app:app_center'], fields: ['id', 'name', 'app_type', 'status', 'version', 'created_at', 'updated_at'], order: 'created_at.desc' })
});

const text = (value) => String(value ?? '').trim();
const identifier = (value) => /^[a-z][a-z0-9_]{0,63}$/.test(text(value));
const isSafeFilterValue = (value) => {
  const raw = text(value);
  return Boolean(raw) && raw.length <= 200 && !/[\r\n;&,(){}]/.test(raw);
};
const reject = (message, code = 'HARNESS_QUERY_INVALID') => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = 400;
  throw error;
};

const createHarnessQueryTools = ({ callPostgrestWithUser, fetchSemanticContext, maxLimit = 100 } = {}) => {
  if (typeof callPostgrestWithUser !== 'function') throw new TypeError('Harness query PostgREST adapter is required');
  if (typeof fetchSemanticContext !== 'function') throw new TypeError('Harness query semantic context loader is required');

  const execute = async (user, payload = {}, pluginId = '') => {
    const datasetId = text(payload.dataset || payload.dataset_id || payload.dataSet);
    const dataset = DATASETS[datasetId];
    if (!dataset) reject('dataset is not available');
    if (pluginId === 'worker-grid' && !['materials', 'inventory', 'production_orders', 'employees'].includes(datasetId)) reject('dataset is not available');
    if (payload.table || payload.table_name || payload.schema || payload.sql || payload.url || payload.tenant_id || payload.user_id || payload.jwt) {
      reject('query contains an unsupported authorization or database field');
    }
    const context = await fetchSemanticContext(user);
    if (!context?.accessPolicy?.roleScoped || context.fieldAclAvailable !== true) reject('role-scoped field permissions are unavailable', 'HARNESS_PERMISSION_DENIED');
    const effectivePermissions = new Set((Array.isArray(context.permissions) ? context.permissions : [])
      .map((permission) => text(permission?.code || permission).toLowerCase()).filter(Boolean));
    if (context.accessPolicy?.superUser !== true && !dataset.permissions.some((permission) => effectivePermissions.has(permission.toLowerCase()))) {
      reject('dataset permission is not granted', 'HARNESS_PERMISSION_DENIED');
    }
    const requestedFields = Array.isArray(payload.select) ? payload.select.map(text) : text(payload.select).split(',').map(text).filter(Boolean);
    const fields = requestedFields.length ? requestedFields : dataset.fields;
    if (fields.some((field) => !dataset.fields.includes(field) || !identifier(field))) reject('query selects a field outside the dataset contract');
    const visibleFields = filterVisibleFields(fields, context, dataset.module);
    if (!visibleFields.length) reject('no requested fields are visible', 'HARNESS_PERMISSION_DENIED');

    const query = { select: visibleFields.join(','), limit: String(Math.min(Math.max(Number(payload.limit) || 20, 1), maxLimit)), order: dataset.order };
    const order = text(payload.order);
    if (order) {
      const [field, direction = 'asc'] = order.split('.');
      if (!dataset.fields.includes(field) || !['asc', 'desc'].includes(direction)) reject('query order is outside the dataset contract');
      query.order = `${field}.${direction}`;
    }
    const filters = payload.filters && typeof payload.filters === 'object' && !Array.isArray(payload.filters) ? payload.filters : {};
    for (const [field, value] of Object.entries(filters)) {
      if (!dataset.fields.includes(field) || !identifier(field) || typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') reject('query filter is outside the dataset contract');
      const raw = text(value);
      if (!isSafeFilterValue(raw)) reject('query filter value is invalid');
      query[field] = `eq.${raw}`;
    }
    const fieldPolicy = prepareFieldAclRead(query, context, dataset.path.slice(1), dataset.module);
    const result = await callPostgrestWithUser(user, { method: 'GET', path: dataset.path, query: fieldPolicy.query, acceptProfile: dataset.profile, timeoutMs: 8000 });
    return { dataset: datasetId, rows: stripFieldAcl(Array.isArray(result?.data) ? result.data : [], context, fieldPolicy.module), limit: Number(query.limit) };
  };

  return Object.freeze({ execute, datasets: DATASETS });
};

module.exports = { DATASETS, createHarnessQueryTools };
