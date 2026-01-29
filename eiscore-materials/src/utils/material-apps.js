export const BASE_STATIC_COLUMNS = [
  { label: '编号', prop: 'id', editable: false, width: 80 },
  { label: '批次号', prop: 'batch_no', width: 140 },
  { label: '物料名称', prop: 'name', width: 160 },
  { label: '物料分类', prop: 'category', width: 140 },
  { label: '重量(kg)', prop: 'weight_kg', type: 'number', width: 120 },
  { label: '入库日期', prop: 'entry_date', width: 120 },
  { label: '创建人', prop: 'created_by', editable: false, width: 120 }
]

const DEFAULT_SUMMARY = {
  label: '总计',
  rules: {},
  expressions: {},
  cellLabels: { weight_kg: '重量合计' }
}

export const MATERIAL_APPS = [
  {
    key: 'a',
    name: '物料台账',
    desc: '原料与批次基础信息管理',
    route: '/app/a',
    perm: 'app:mms_ledger',
    aclModule: 'mms_ledger',
    apiUrl: '/raw_materials',
    viewId: 'materials_list',
    configKey: 'materials_table_cols',
    icon: 'Box',
    tone: 'blue',
    enableDetail: true,
    includeProperties: true,
    ops: {
      create: 'op:mms_ledger.create',
      edit: 'op:mms_ledger.edit',
      delete: 'op:mms_ledger.delete',
      import: 'op:mms_ledger.import',
      export: 'op:mms_ledger.export',
      config: 'op:mms_ledger.config'
    },
    staticColumns: BASE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '规格', prop: 'spec', type: 'text' },
      { label: '单位', prop: 'unit', type: 'text' },
      { label: '计量单位', prop: 'measure_unit', type: 'text' },
      { label: '换算关系', prop: 'conversion', type: 'text' },
      { label: '财务属性', prop: 'finance_attribute', type: 'text' }
    ]
  }
]

export const findMaterialApp = (key) => {
  return MATERIAL_APPS.find((app) => app.key === key)
}
