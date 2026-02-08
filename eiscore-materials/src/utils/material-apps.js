import { FINANCE_ATTRIBUTE_SELECT_OPTIONS } from '@/constants/financeAttributes'

const UNIT_SELECT_OPTIONS = [
  { label: '个', value: '个' },
  { label: '件', value: '件' },
  { label: '箱', value: '箱' },
  { label: '袋', value: '袋' },
  { label: '盒', value: '盒' },
  { label: '瓶', value: '瓶' },
  { label: '吨', value: '吨' },
  { label: '千克', value: '千克' },
  { label: '克', value: '克' },
  { label: '斤', value: '斤' },
  { label: '米', value: '米' },
  { label: '平方米', value: '平方米' },
  { label: '立方米', value: '立方米' }
]

export const BASE_STATIC_COLUMNS = [
  { label: '物料编码', prop: 'batch_no', editable: false, width: 160 },
  { label: '物料名称', prop: 'name', width: 160 },
  { label: '物料分类编码', prop: 'category', editable: false, width: 160 },
  { label: '规格', prop: 'spec', width: 160, storeInProperties: true },
  {
    label: '单位',
    prop: 'unit',
    type: 'select',
    options: UNIT_SELECT_OPTIONS,
    width: 120,
    storeInProperties: true
  },
  {
    label: '计量单位',
    prop: 'measure_unit',
    type: 'select',
    options: UNIT_SELECT_OPTIONS,
    width: 120,
    storeInProperties: true
  },
  {
    label: '换算比例',
    prop: 'conversion_ratio',
    type: 'number',
    width: 120,
    storeInProperties: true
  },
  {
    label: '换算关系',
    prop: 'conversion',
    editable: false,
    width: 180,
    storeInProperties: true,
    valueGetter: (params) => {
      const unit = params?.data?.properties?.unit || ''
      const measureUnit = params?.data?.properties?.measure_unit || ''
      const ratio = params?.data?.properties?.conversion_ratio
      if (unit && measureUnit && ratio !== undefined && ratio !== null && ratio !== '') {
        return `1 ${measureUnit} = ${ratio} ${unit}`
      }
      if (unit && measureUnit) {
        return `${measureUnit} ↔ ${unit}`
      }
      return ''
    }
  },
  {
    label: '财务属性',
    prop: 'finance_attribute',
    type: 'select',
    options: FINANCE_ATTRIBUTE_SELECT_OPTIONS,
    width: 200,
    storeInProperties: true
  },
  { label: '创建人', prop: 'created_by', editable: false, width: 120 }
]

const DEFAULT_SUMMARY = {
  label: '总计',
  rules: {},
  expressions: {},
  cellLabels: {}
}

export const MATERIAL_APPS = [
  {
    key: 'a',
    name: '物料',
    desc: '物料基础信息管理',
    route: '/app/a',
    perm: 'app:mms_ledger',
    aclModule: 'mms_ledger',
    apiUrl: '/raw_materials',
    writeMode: 'patch',
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
    patchRequiredFields: ['batch_no', 'name', 'category'],
    staticColumns: BASE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: []
  },
  {
    key: 'batch-rules',
    name: '批次号规则',
    desc: '配置批次号生成规则',
    route: '/batch-rules',
    perm: 'app:mms_batch_rule',
    icon: 'Setting',
    tone: 'purple'
  },
  {
    key: 'warehouses',
    name: '仓库管理',
    desc: '仓库/库区/库位管理',
    route: '/warehouses',
    perm: 'app:mms_warehouse',
    icon: 'OfficeBuilding',
    tone: 'orange'
  },
  {
    key: 'inventory-ledger',
    name: '库存台账',
    desc: '入库出库流水记录',
    route: '/inventory-ledger',
    perm: 'app:mms_inventory',
    icon: 'Notebook',
    tone: 'green'
  },
  {
    key: 'inventory-current',
    name: '库存查询',
    desc: '实时库存汇总',
    route: '/inventory-current',
    perm: 'app:mms_inventory',
    icon: 'Search',
    tone: 'cyan'
  },
  {
    key: 'inventory-dashboard',
    name: '库存大屏',
    desc: '可视化库存监控',
    route: '/inventory-dashboard',
    perm: 'app:mms_dashboard',
    icon: 'Monitor',
    tone: 'indigo'
  }
]

export const findMaterialApp = (key) => {
  return MATERIAL_APPS.find((app) => app.key === key)
}
