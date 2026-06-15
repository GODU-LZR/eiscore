// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const INSPECTION_TYPE_OPTIONS = [
  { label: '来料检验', value: '来料检验' },
  { label: '过程巡检', value: '过程巡检' },
  { label: '首件检验', value: '首件检验' },
  { label: '成品抽检', value: '成品抽检' }
]

export const RESULT_OPTIONS = [
  { label: '待判定', value: '待判定' },
  { label: '合格', value: '合格' },
  { label: '让步接收', value: '让步接收' },
  { label: '不合格', value: '不合格' }
]

export const NCR_STATUS_OPTIONS = [
  { label: '待整改', value: '待整改' },
  { label: '整改中', value: '整改中' },
  { label: '待验证', value: '待验证' },
  { label: '已关闭', value: '已关闭' }
]

export const SEVERITY_OPTIONS = [
  { label: '一般', value: '一般' },
  { label: '严重', value: '严重' },
  { label: '关键', value: '关键' }
]

export const ACTION_STATUS_OPTIONS = [
  { label: '待处理', value: '待处理' },
  { label: '处理中', value: '处理中' },
  { label: '待验证', value: '待验证' },
  { label: '已完成', value: '已完成' }
]

export const AUDIT_STATUS_OPTIONS = [
  { label: '计划中', value: '计划中' },
  { label: '执行中', value: '执行中' },
  { label: '待整改', value: '待整改' },
  { label: '已关闭', value: '已关闭' }
]

export const STANDARD_STATUS_OPTIONS = [
  { label: '草稿', value: '草稿' },
  { label: '生效', value: '生效' },
  { label: '修订中', value: '修订中' },
  { label: '作废', value: '作废' }
]

const DEFAULT_SUMMARY = {
  label: '总计',
  rules: {},
  expressions: {},
  cellLabels: {}
}

const parseNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const today = () => new Date().toISOString().slice(0, 10)

const opPerms = (module) => ({
  create: `op:${module}.create`,
  edit: `op:${module}.edit`,
  delete: `op:${module}.delete`,
  export: `op:${module}.export`,
  config: `op:${module}.config`
})

export const INSPECTION_COLUMNS = [
  { label: '检验单号', prop: 'doc_no', editable: false, width: 180 },
  { label: '检验类型', prop: 'inspection_type', type: 'select', options: INSPECTION_TYPE_OPTIONS, width: 120 },
  { label: '来源单号', prop: 'source_doc_no', width: 150 },
  { label: '物料编码', prop: 'item_code', width: 130 },
  { label: '物料/产品', prop: 'item_name', width: 180 },
  { label: '供应商/产线', prop: 'source_name', width: 150 },
  { label: '批次号', prop: 'batch_no', width: 150 },
  { label: '抽检数', prop: 'sample_qty', type: 'number', width: 100, valueParser: (params) => parseNumber(params.newValue) },
  { label: '不良数', prop: 'defect_qty', type: 'number', width: 100, valueParser: (params) => parseNumber(params.newValue) },
  { label: '检验结果', prop: 'result', type: 'select', options: RESULT_OPTIONS, width: 120 },
  { label: '检验员', prop: 'inspector', width: 110 },
  { label: '检验日期', prop: 'inspection_date', width: 120 },
  { label: '备注', prop: 'remark', minWidth: 180 }
]

export const NCR_COLUMNS = [
  { label: '异常单号', prop: 'doc_no', editable: false, width: 180 },
  { label: '异常来源', prop: 'source_type', width: 120 },
  { label: '来源单号', prop: 'source_doc_no', width: 150 },
  { label: '问题描述', prop: 'issue_desc', minWidth: 220 },
  { label: '严重度', prop: 'severity', type: 'select', options: SEVERITY_OPTIONS, width: 100 },
  { label: '责任部门', prop: 'owner_dept', width: 120 },
  { label: '责任人', prop: 'owner_name', width: 110 },
  { label: '整改期限', prop: 'deadline', width: 120 },
  { label: '状态', prop: 'ncr_status', type: 'select', options: NCR_STATUS_OPTIONS, width: 120 },
  { label: '纠正措施', prop: 'corrective_action', minWidth: 220 },
  { label: '验证结论', prop: 'verification_result', minWidth: 160 }
]

export const ACTION_COLUMNS = [
  { label: '任务单号', prop: 'action_no', editable: false, width: 180 },
  { label: '异常单号', prop: 'ncr_doc_no', width: 180 },
  { label: '任务类型', prop: 'action_type', type: 'select', options: [
    { label: '纠正', value: '纠正' },
    { label: '预防', value: '预防' },
    { label: '验证', value: '验证' }
  ], width: 100 },
  { label: '任务内容', prop: 'task_desc', minWidth: 240 },
  { label: '责任部门', prop: 'owner_dept', width: 120 },
  { label: '责任人', prop: 'owner_name', width: 110 },
  { label: '到期日期', prop: 'due_date', width: 120 },
  { label: '任务状态', prop: 'action_status', type: 'select', options: ACTION_STATUS_OPTIONS, width: 120 },
  { label: '验证人', prop: 'verify_owner', width: 110 },
  { label: '验证日期', prop: 'verify_date', width: 120 },
  { label: '验证结果', prop: 'verify_result', minWidth: 160 }
]

export const AUDIT_COLUMNS = [
  { label: '审核单号', prop: 'audit_no', editable: false, width: 180 },
  { label: '审核类型', prop: 'audit_type', type: 'select', options: [
    { label: '过程审核', value: '过程审核' },
    { label: '体系审核', value: '体系审核' },
    { label: '供应商审核', value: '供应商审核' },
    { label: '客户审核', value: '客户审核' }
  ], width: 120 },
  { label: '审核范围', prop: 'audit_scope', minWidth: 180 },
  { label: '计划日期', prop: 'plan_date', width: 120 },
  { label: '审核员', prop: 'auditor', width: 110 },
  { label: '发现项数', prop: 'finding_count', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '状态', prop: 'audit_status', type: 'select', options: AUDIT_STATUS_OPTIONS, width: 120 },
  { label: '结论', prop: 'conclusion', minWidth: 180 }
]

export const STANDARD_COLUMNS = [
  { label: '标准编号', prop: 'standard_no', editable: false, width: 180 },
  { label: '标准名称', prop: 'standard_name', minWidth: 200 },
  { label: '适用品类', prop: 'item_category', width: 140 },
  { label: '版本', prop: 'version', width: 90 },
  { label: '生效日期', prop: 'effective_date', width: 120 },
  { label: '负责人', prop: 'owner_name', width: 110 },
  { label: '状态', prop: 'standard_status', type: 'select', options: STANDARD_STATUS_OPTIONS, width: 100 },
  { label: '关键指标', prop: 'key_metrics', minWidth: 220 }
]

export const QUALITY_APPS = [
  {
    key: 'dashboard',
    name: '质量总览',
    desc: '查看待检、合格率、异常和整改闭环',
    route: '/dashboard',
    perm: 'app:quality_dashboard',
    icon: 'DataBoard',
    tone: 'slate',
    appType: 'dashboard'
  },
  {
    key: 'inspections',
    name: '检验台账',
    desc: '来料、过程、首件和成品检验记录',
    route: '/app/inspections',
    perm: 'app:quality_inspection',
    aclModule: 'quality_inspection',
    apiUrl: '/quality_inspections?status=neq.deleted',
    writeUrl: '/quality_inspections',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'quality_inspections',
    configKey: 'quality_inspections_cols',
    icon: 'Search',
    tone: 'blue',
    enableDetail: true,
    staticColumns: INSPECTION_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { sample_qty: 'sum', defect_qty: 'sum' }
    },
    defaultExtraColumns: [
      { label: '检验标准', prop: 'standard', type: 'text' },
      { label: '处置建议', prop: 'disposition', type: 'select', options: [
        { label: '放行', value: '放行' },
        { label: '返工', value: '返工' },
        { label: '退货', value: '退货' },
        { label: '报废', value: '报废' }
      ] },
      { label: '不良率', prop: 'defect_rate', type: 'formula', expression: '{不良数}/{抽检数}*100' }
    ],
    ops: opPerms('quality_inspection'),
    createPayload: () => ({
      doc_no: `QI${Date.now().toString().slice(-8)}`,
      inspection_type: '来料检验',
      source_doc_no: '',
      item_code: '',
      item_name: '新检验对象',
      source_name: '',
      batch_no: '',
      sample_qty: 0,
      defect_qty: 0,
      result: '待判定',
      inspector: '',
      inspection_date: today(),
      remark: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-qc-1',
        doc_no: 'QI-20260605-001',
        inspection_type: '来料检验',
        source_doc_no: 'PA-20260605-001',
        item_code: 'PK-BOX-500',
        item_name: '食品级纸盒 500ml',
        source_name: '江门绿田包装材料',
        batch_no: 'B20260605-A01',
        sample_qty: 80,
        defect_qty: 1,
        result: '待判定',
        inspector: '张晓',
        inspection_date: '2026-06-05',
        remark: '外观轻微压痕',
        status: 'active',
        properties: { standard: 'GB/T 6543', disposition: '放行' }
      },
      {
        id: 'demo-qc-2',
        doc_no: 'QI-20260604-012',
        inspection_type: '成品抽检',
        source_doc_no: 'WO-20260604-008',
        item_code: 'FG-YOG-012',
        item_name: '常温酸奶 12瓶装',
        source_name: '包装二线',
        batch_no: 'FG20260604-08',
        sample_qty: 120,
        defect_qty: 2,
        result: '合格',
        inspector: '陈雨',
        inspection_date: '2026-06-04',
        remark: '',
        status: 'active',
        properties: { standard: '成品放行标准', disposition: '放行' }
      },
      {
        id: 'demo-qc-3',
        doc_no: 'QI-20260604-009',
        inspection_type: '过程巡检',
        source_doc_no: 'WO-20260604-003',
        item_code: 'LINE-L2',
        item_name: '灌装线 L2',
        source_name: '灌装车间',
        batch_no: 'CAP20260604-02',
        sample_qty: 45,
        defect_qty: 5,
        result: '不合格',
        inspector: '刘铭',
        inspection_date: '2026-06-04',
        remark: '瓶盖扭矩偏低',
        status: 'active',
        properties: { standard: '灌装线过程巡检标准', disposition: '返工' }
      }
    ]
  },
  {
    key: 'inspection_orders',
    name: '检验单',
    desc: '进入检验台账处理来料、过程和成品检验单',
    route: '/app/inspection_orders',
    perm: 'app:quality_inspection',
    icon: 'Search',
    tone: 'blue',
    sourceAppKey: 'inspections'
  },
  {
    key: 'production_inspections',
    name: '生产检验',
    desc: '面向生产过程和成品放行的检验记录入口',
    route: '/app/production_inspections',
    perm: 'app:quality_inspection',
    icon: 'Search',
    tone: 'cyan',
    sourceAppKey: 'inspections'
  },
  {
    key: 'ncr',
    name: '质量异常',
    desc: '不合格、责任归属、整改和验证关闭',
    route: '/app/ncr',
    perm: 'app:quality_ncr',
    aclModule: 'quality_ncr',
    apiUrl: '/quality_ncrs?status=neq.deleted',
    writeUrl: '/quality_ncrs',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'quality_ncrs',
    configKey: 'quality_ncrs_cols',
    icon: 'Warning',
    tone: 'red',
    enableDetail: true,
    staticColumns: NCR_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '根因分类', prop: 'root_cause_type', type: 'select', options: [
        { label: '人员', value: '人员' },
        { label: '设备', value: '设备' },
        { label: '物料', value: '物料' },
        { label: '方法', value: '方法' },
        { label: '环境', value: '环境' }
      ] }
    ],
    ops: opPerms('quality_ncr'),
    createPayload: () => ({
      doc_no: `NCR${Date.now().toString().slice(-8)}`,
      source_type: '检验异常',
      source_doc_no: '',
      issue_desc: '新质量异常',
      severity: '一般',
      owner_dept: '',
      owner_name: '',
      deadline: today(),
      ncr_status: '待整改',
      corrective_action: '',
      verification_result: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-ncr-1',
        doc_no: 'NCR-20260604-003',
        source_type: '过程巡检',
        source_doc_no: 'QI-20260604-009',
        issue_desc: '瓶盖扭矩偏低',
        severity: '严重',
        owner_dept: '生产部',
        owner_name: '王浩',
        deadline: '2026-06-05',
        ncr_status: '待整改',
        corrective_action: '复核旋盖机参数并追加抽检',
        verification_result: '',
        status: 'active',
        properties: { root_cause_type: '设备' }
      }
    ]
  },
  {
    key: 'actions',
    name: '整改任务',
    desc: '跟踪异常整改、预防措施和验证结果',
    route: '/app/actions',
    perm: 'app:quality_action',
    aclModule: 'quality_action',
    apiUrl: '/quality_corrective_actions?status=neq.deleted',
    writeUrl: '/quality_corrective_actions',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'quality_corrective_actions',
    configKey: 'quality_corrective_actions_cols',
    icon: 'CircleCheck',
    tone: 'green',
    enableDetail: true,
    staticColumns: ACTION_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '完成证据', prop: 'evidence', type: 'file', fileMaxCount: 5, fileMaxSizeMb: 20 }
    ],
    ops: opPerms('quality_action'),
    createPayload: () => ({
      action_no: `QA${Date.now().toString().slice(-8)}`,
      ncr_doc_no: '',
      action_type: '纠正',
      task_desc: '新整改任务',
      owner_dept: '',
      owner_name: '',
      due_date: today(),
      action_status: '待处理',
      verify_owner: '',
      verify_date: null,
      verify_result: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-action-1',
        action_no: 'QA-20260604-003-01',
        ncr_doc_no: 'NCR-20260604-003',
        action_type: '纠正',
        task_desc: '调整旋盖机扭矩参数并记录复测结果',
        owner_dept: '生产部',
        owner_name: '王浩',
        due_date: '2026-06-05',
        action_status: '处理中',
        verify_owner: '张晓',
        verify_date: '',
        verify_result: '',
        status: 'active',
        properties: {}
      }
    ]
  },
  {
    key: 'audits',
    name: '质量审核',
    desc: '体系、过程、供应商审核计划和发现项',
    route: '/app/audits',
    perm: 'app:quality_audit',
    aclModule: 'quality_audit',
    apiUrl: '/quality_audits?status=neq.deleted',
    writeUrl: '/quality_audits',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'quality_audits',
    configKey: 'quality_audits_cols',
    icon: 'Tickets',
    tone: 'orange',
    enableDetail: true,
    staticColumns: AUDIT_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { finding_count: 'sum' }
    },
    defaultExtraColumns: [
      { label: '审核地点', prop: 'audit_location', type: 'text' }
    ],
    ops: opPerms('quality_audit'),
    createPayload: () => ({
      audit_no: `AUD${Date.now().toString().slice(-8)}`,
      audit_type: '过程审核',
      audit_scope: '新审核范围',
      plan_date: today(),
      auditor: '',
      finding_count: 0,
      audit_status: '计划中',
      conclusion: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-audit-1',
        audit_no: 'AUD-20260603-001',
        audit_type: '过程审核',
        audit_scope: '灌装二线首件确认',
        plan_date: '2026-06-06',
        auditor: '陈雨',
        finding_count: 2,
        audit_status: '待整改',
        conclusion: '设备点检记录不完整',
        status: 'active',
        properties: { audit_location: '灌装车间' }
      }
    ]
  },
  {
    key: 'standards',
    name: '检验标准',
    desc: '维护品类检验标准、版本和关键指标',
    route: '/app/standards',
    perm: 'app:quality_standard',
    aclModule: 'quality_standard',
    apiUrl: '/quality_standards?status=neq.deleted',
    writeUrl: '/quality_standards',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'quality_standards',
    configKey: 'quality_standards_cols',
    icon: 'DocumentChecked',
    tone: 'purple',
    enableDetail: true,
    staticColumns: STANDARD_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '附件', prop: 'attachments', type: 'file', fileMaxCount: 5, fileMaxSizeMb: 20 }
    ],
    ops: opPerms('quality_standard'),
    createPayload: () => ({
      standard_no: `STD${Date.now().toString().slice(-8)}`,
      standard_name: '新检验标准',
      item_category: '',
      version: 'V1',
      effective_date: today(),
      owner_name: '',
      standard_status: '草稿',
      key_metrics: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-standard-1',
        standard_no: 'STD-PKG-001',
        standard_name: '食品级纸盒来料检验标准',
        item_category: '包装材料',
        version: 'V2',
        effective_date: '2026-05-20',
        owner_name: '张晓',
        standard_status: '生效',
        key_metrics: '外观、尺寸、耐压、异味',
        status: 'active',
        properties: {}
      }
    ]
  }
]

export const findQualityApp = (key) => {
  const matched = QUALITY_APPS.find((app) => app.key === key)
  if (!matched?.sourceAppKey) return matched
  const source = QUALITY_APPS.find((app) => app.key === matched.sourceAppKey)
  if (!source) return matched
  const queryFilter = key === 'production_inspections'
    ? '&inspection_type=in.(过程巡检,首件检验,成品抽检)'
    : ''
  return {
    ...source,
    ...matched,
    key,
    route: matched.route,
    apiUrl: `${source.apiUrl}${queryFilter}`,
    viewId: `quality_${key}`,
    configKey: `quality_${key}_cols`
  }
}

export const QUALITY_GRID_APPS = QUALITY_APPS.filter((app) => app.appType !== 'dashboard')
