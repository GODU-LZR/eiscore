// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const EQUIPMENT_STATUS_OPTIONS = [
  { label: '运行', value: '运行' },
  { label: '停机', value: '停机' },
  { label: '维修中', value: '维修中' },
  { label: '待验收', value: '待验收' },
  { label: '报废', value: '报废' }
]

export const EQUIPMENT_LEVEL_OPTIONS = [
  { label: '关键', value: '关键' },
  { label: '重要', value: '重要' },
  { label: '一般', value: '一般' }
]

export const CHECK_RESULT_OPTIONS = [
  { label: '待处理', value: '待处理' },
  { label: '正常', value: '正常' },
  { label: '异常', value: '异常' },
  { label: '停机', value: '停机' }
]

export const ISSUE_LEVEL_OPTIONS = [
  { label: '一般', value: '一般' },
  { label: '严重', value: '严重' },
  { label: '紧急', value: '紧急' }
]

export const ISSUE_STATUS_OPTIONS = [
  { label: '待处理', value: '待处理' },
  { label: '处理中', value: '处理中' },
  { label: '待验收', value: '待验收' },
  { label: '已关闭', value: '已关闭' }
]

export const WORK_ORDER_STATUS_OPTIONS = [
  { label: '待派工', value: '待派工' },
  { label: '处理中', value: '处理中' },
  { label: '待验收', value: '待验收' },
  { label: '已完成', value: '已完成' }
]

export const PLAN_STATUS_OPTIONS = [
  { label: '计划中', value: '计划中' },
  { label: '执行中', value: '执行中' },
  { label: '已完成', value: '已完成' },
  { label: '已暂停', value: '已暂停' }
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

export const ASSET_COLUMNS = [
  { label: '设备编号', prop: 'asset_no', editable: false, width: 170 },
  { label: '设备名称', prop: 'asset_name', minWidth: 180 },
  { label: '设备类型', prop: 'asset_type', width: 120 },
  { label: '产线/区域', prop: 'location_name', width: 150 },
  { label: '重要等级', prop: 'asset_level', type: 'select', options: EQUIPMENT_LEVEL_OPTIONS, width: 110 },
  { label: '运行状态', prop: 'run_status', type: 'select', options: EQUIPMENT_STATUS_OPTIONS, width: 110 },
  { label: '责任部门', prop: 'owner_dept', width: 120 },
  { label: '责任人', prop: 'owner_name', width: 110 },
  { label: '启用日期', prop: 'commission_date', width: 120 },
  { label: '上次保养', prop: 'last_maint_date', width: 120 },
  { label: '下次保养', prop: 'next_maint_date', width: 120 },
  { label: '健康评分', prop: 'health_score', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '备注', prop: 'remark', minWidth: 180 }
]

export const CHECK_COLUMNS = [
  { label: '点检单号', prop: 'check_no', editable: false, width: 170 },
  { label: '设备编号', prop: 'asset_no', width: 150 },
  { label: '设备名称', prop: 'asset_name', minWidth: 180 },
  { label: '点检类型', prop: 'check_type', type: 'select', options: [
    { label: '班前点检', value: '班前点检' },
    { label: '日常巡检', value: '日常巡检' },
    { label: '专项点检', value: '专项点检' }
  ], width: 120 },
  { label: '点检项数', prop: 'check_item_count', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '异常项数', prop: 'abnormal_count', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) },
  { label: '点检结果', prop: 'check_result', type: 'select', options: CHECK_RESULT_OPTIONS, width: 110 },
  { label: '点检人', prop: 'checker', width: 110 },
  { label: '点检日期', prop: 'check_date', width: 120 },
  { label: '备注', prop: 'remark', minWidth: 180 }
]

export const ISSUE_COLUMNS = [
  { label: '异常单号', prop: 'issue_no', editable: false, width: 170 },
  { label: '设备编号', prop: 'asset_no', width: 150 },
  { label: '设备名称', prop: 'asset_name', minWidth: 180 },
  { label: '异常来源', prop: 'source_type', width: 120 },
  { label: '异常描述', prop: 'issue_desc', minWidth: 220 },
  { label: '紧急程度', prop: 'issue_level', type: 'select', options: ISSUE_LEVEL_OPTIONS, width: 110 },
  { label: '责任部门', prop: 'owner_dept', width: 120 },
  { label: '责任人', prop: 'owner_name', width: 110 },
  { label: '发生日期', prop: 'occurred_date', width: 120 },
  { label: '处理期限', prop: 'deadline', width: 120 },
  { label: '状态', prop: 'issue_status', type: 'select', options: ISSUE_STATUS_OPTIONS, width: 110 },
  { label: '处理措施', prop: 'repair_action', minWidth: 220 }
]

export const WORK_ORDER_COLUMNS = [
  { label: '工单号', prop: 'work_order_no', editable: false, width: 170 },
  { label: '异常单号', prop: 'issue_no', width: 170 },
  { label: '设备编号', prop: 'asset_no', width: 150 },
  { label: '设备名称', prop: 'asset_name', minWidth: 180 },
  { label: '工单类型', prop: 'work_type', type: 'select', options: [
    { label: '故障维修', value: '故障维修' },
    { label: '预防保养', value: '预防保养' },
    { label: '备件更换', value: '备件更换' },
    { label: '校准验收', value: '校准验收' }
  ], width: 120 },
  { label: '任务内容', prop: 'task_desc', minWidth: 220 },
  { label: '维修人员', prop: 'maintainer', width: 110 },
  { label: '计划日期', prop: 'plan_date', width: 120 },
  { label: '完成日期', prop: 'finish_date', width: 120 },
  { label: '停机时长(h)', prop: 'downtime_hours', type: 'number', width: 120, valueParser: (params) => parseNumber(params.newValue) },
  { label: '工单状态', prop: 'work_status', type: 'select', options: WORK_ORDER_STATUS_OPTIONS, width: 110 },
  { label: '验收结果', prop: 'acceptance_result', minWidth: 160 }
]

export const PLAN_COLUMNS = [
  { label: '计划编号', prop: 'plan_no', editable: false, width: 170 },
  { label: '计划名称', prop: 'plan_name', minWidth: 190 },
  { label: '设备范围', prop: 'asset_scope', minWidth: 180 },
  { label: '计划类型', prop: 'plan_type', type: 'select', options: [
    { label: '月度保养', value: '月度保养' },
    { label: '季度保养', value: '季度保养' },
    { label: '年度大修', value: '年度大修' },
    { label: '专项巡检', value: '专项巡检' }
  ], width: 120 },
  { label: '周期', prop: 'cycle_name', width: 100 },
  { label: '开始日期', prop: 'start_date', width: 120 },
  { label: '下次执行', prop: 'next_execute_date', width: 120 },
  { label: '负责人', prop: 'owner_name', width: 110 },
  { label: '计划状态', prop: 'plan_status', type: 'select', options: PLAN_STATUS_OPTIONS, width: 110 },
  { label: '完成率(%)', prop: 'completion_rate', type: 'number', width: 110, valueParser: (params) => parseNumber(params.newValue) }
]

export const STANDARD_COLUMNS = [
  { label: '标准编号', prop: 'standard_no', editable: false, width: 170 },
  { label: '标准名称', prop: 'standard_name', minWidth: 200 },
  { label: '适用设备', prop: 'asset_type', width: 140 },
  { label: '版本', prop: 'version', width: 90 },
  { label: '生效日期', prop: 'effective_date', width: 120 },
  { label: '负责人', prop: 'owner_name', width: 110 },
  { label: '状态', prop: 'standard_status', type: 'select', options: STANDARD_STATUS_OPTIONS, width: 100 },
  { label: '关键项目', prop: 'key_items', minWidth: 220 }
]

export const EQUIPMENT_APPS = [
  {
    key: 'dashboard',
    name: '设备总览',
    desc: '查看设备运行、点检异常、维保工单和计划达成',
    route: '/dashboard',
    perm: 'app:equipment_dashboard',
    icon: 'DataBoard',
    tone: 'slate',
    appType: 'dashboard'
  },
  {
    key: 'assets',
    name: '设备台账',
    desc: '维护设备档案、责任人、运行状态和保养周期',
    route: '/app/assets',
    perm: 'app:equipment_asset',
    aclModule: 'equipment_asset',
    apiUrl: '/equipment_assets?status=neq.deleted',
    writeUrl: '/equipment_assets',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'equipment_assets',
    configKey: 'equipment_assets_cols',
    icon: 'Monitor',
    tone: 'blue',
    enableDetail: true,
    staticColumns: ASSET_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { health_score: 'avg' }
    },
    defaultExtraColumns: [
      { label: '设备厂家', prop: 'manufacturer', type: 'text' },
      { label: '资产原值', prop: 'asset_value', type: 'number' },
      { label: '设备位置', prop: 'geo_location', type: 'geo', geoAddress: true }
    ],
    ops: opPerms('equipment_asset'),
    createPayload: () => ({
      asset_no: `EQ${Date.now().toString().slice(-8)}`,
      asset_name: '新设备',
      asset_type: '',
      location_name: '',
      asset_level: '一般',
      run_status: '运行',
      owner_dept: '',
      owner_name: '',
      commission_date: today(),
      last_maint_date: '',
      next_maint_date: today(),
      health_score: 100,
      remark: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-asset-1',
        asset_no: 'EQ-FILL-002',
        asset_name: '二号灌装机',
        asset_type: '灌装设备',
        location_name: '灌装二线',
        asset_level: '关键',
        run_status: '运行',
        owner_dept: '生产部',
        owner_name: '王浩',
        commission_date: '2024-05-16',
        last_maint_date: '2026-05-28',
        next_maint_date: '2026-06-12',
        health_score: 92,
        remark: '扭矩参数需持续关注',
        status: 'active',
        properties: { manufacturer: '广州海工自动化', asset_value: 360000 }
      },
      {
        id: 'demo-asset-2',
        asset_no: 'EQ-COLD-001',
        asset_name: '一号冷库压缩机',
        asset_type: '制冷设备',
        location_name: '冷库一区',
        asset_level: '关键',
        run_status: '维修中',
        owner_dept: '设备部',
        owner_name: '陈雨',
        commission_date: '2023-09-02',
        last_maint_date: '2026-05-22',
        next_maint_date: '2026-06-08',
        health_score: 68,
        remark: '油压波动，安排复检',
        status: 'active',
        properties: { manufacturer: '深圳冷源机电', asset_value: 510000 }
      }
    ]
  },
  {
    key: 'checks',
    name: '点检记录',
    desc: '记录班前点检、日常巡检和专项检查结果',
    route: '/app/checks',
    perm: 'app:equipment_check',
    aclModule: 'equipment_check',
    apiUrl: '/equipment_checks?status=neq.deleted',
    writeUrl: '/equipment_checks',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'equipment_checks',
    configKey: 'equipment_checks_cols',
    icon: 'Search',
    tone: 'cyan',
    enableDetail: true,
    staticColumns: CHECK_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { check_item_count: 'sum', abnormal_count: 'sum' }
    },
    defaultExtraColumns: [
      { label: '温度', prop: 'temperature', type: 'number' },
      { label: '振动', prop: 'vibration', type: 'number' },
      { label: '点检照片', prop: 'check_photos', type: 'file', fileMaxCount: 6, fileMaxSizeMb: 20 }
    ],
    ops: opPerms('equipment_check'),
    createPayload: () => ({
      check_no: `EC${Date.now().toString().slice(-8)}`,
      asset_no: '',
      asset_name: '新点检设备',
      check_type: '日常巡检',
      check_item_count: 0,
      abnormal_count: 0,
      check_result: '待处理',
      checker: '',
      check_date: today(),
      remark: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-check-1',
        check_no: 'EC-20260605-001',
        asset_no: 'EQ-FILL-002',
        asset_name: '二号灌装机',
        check_type: '班前点检',
        check_item_count: 18,
        abnormal_count: 1,
        check_result: '异常',
        checker: '刘铭',
        check_date: '2026-06-05',
        remark: '旋盖扭矩偏低',
        status: 'active',
        properties: { temperature: 32, vibration: 2.1 }
      },
      {
        id: 'demo-check-2',
        check_no: 'EC-20260604-012',
        asset_no: 'EQ-COLD-001',
        asset_name: '一号冷库压缩机',
        check_type: '日常巡检',
        check_item_count: 12,
        abnormal_count: 0,
        check_result: '正常',
        checker: '陈雨',
        check_date: '2026-06-04',
        remark: '',
        status: 'active',
        properties: { temperature: -18, vibration: 1.3 }
      }
    ]
  },
  {
    key: 'issues',
    name: '设备异常',
    desc: '登记故障、异常来源、责任归属和处理状态',
    route: '/app/issues',
    perm: 'app:equipment_issue',
    aclModule: 'equipment_issue',
    apiUrl: '/equipment_issues?status=neq.deleted',
    writeUrl: '/equipment_issues',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'equipment_issues',
    configKey: 'equipment_issues_cols',
    icon: 'Warning',
    tone: 'red',
    enableDetail: true,
    staticColumns: ISSUE_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '故障分类', prop: 'fault_type', type: 'select', options: [
        { label: '机械', value: '机械' },
        { label: '电气', value: '电气' },
        { label: '控制', value: '控制' },
        { label: '制冷', value: '制冷' },
        { label: '其他', value: '其他' }
      ] }
    ],
    ops: opPerms('equipment_issue'),
    createPayload: () => ({
      issue_no: `EI${Date.now().toString().slice(-8)}`,
      asset_no: '',
      asset_name: '新异常设备',
      source_type: '点检异常',
      issue_desc: '新设备异常',
      issue_level: '一般',
      owner_dept: '',
      owner_name: '',
      occurred_date: today(),
      deadline: today(),
      issue_status: '待处理',
      repair_action: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-issue-1',
        issue_no: 'EI-20260605-003',
        asset_no: 'EQ-FILL-002',
        asset_name: '二号灌装机',
        source_type: '班前点检',
        issue_desc: '旋盖扭矩持续偏低',
        issue_level: '严重',
        owner_dept: '设备部',
        owner_name: '王浩',
        occurred_date: '2026-06-05',
        deadline: '2026-06-06',
        issue_status: '处理中',
        repair_action: '复核伺服参数并更换夹头垫片',
        status: 'active',
        properties: { fault_type: '机械' }
      }
    ]
  },
  {
    key: 'work_orders',
    name: '维保工单',
    desc: '跟踪维修派工、停机时长、备件更换和验收',
    route: '/app/work_orders',
    perm: 'app:equipment_work_order',
    aclModule: 'equipment_work_order',
    apiUrl: '/equipment_work_orders?status=neq.deleted',
    writeUrl: '/equipment_work_orders',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'equipment_work_orders',
    configKey: 'equipment_work_orders_cols',
    icon: 'Tools',
    tone: 'green',
    enableDetail: true,
    staticColumns: WORK_ORDER_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { downtime_hours: 'sum' }
    },
    defaultExtraColumns: [
      { label: '更换备件', prop: 'spare_parts', type: 'text' },
      { label: '维修照片', prop: 'repair_photos', type: 'file', fileMaxCount: 8, fileMaxSizeMb: 20 }
    ],
    ops: opPerms('equipment_work_order'),
    createPayload: () => ({
      work_order_no: `EW${Date.now().toString().slice(-8)}`,
      issue_no: '',
      asset_no: '',
      asset_name: '新维保设备',
      work_type: '故障维修',
      task_desc: '新维保任务',
      maintainer: '',
      plan_date: today(),
      finish_date: '',
      downtime_hours: 0,
      work_status: '待派工',
      acceptance_result: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-work-1',
        work_order_no: 'EW-20260605-003-01',
        issue_no: 'EI-20260605-003',
        asset_no: 'EQ-FILL-002',
        asset_name: '二号灌装机',
        work_type: '故障维修',
        task_desc: '调整旋盖机扭矩参数并更换夹头垫片',
        maintainer: '王浩',
        plan_date: '2026-06-05',
        finish_date: '',
        downtime_hours: 1.5,
        work_status: '处理中',
        acceptance_result: '',
        status: 'active',
        properties: { spare_parts: '夹头垫片 x2' }
      }
    ]
  },
  {
    key: 'plans',
    name: '巡检计划',
    desc: '维护设备巡检、保养和大修计划',
    route: '/app/plans',
    perm: 'app:equipment_plan',
    aclModule: 'equipment_plan',
    apiUrl: '/equipment_maintenance_plans?status=neq.deleted',
    writeUrl: '/equipment_maintenance_plans',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'equipment_maintenance_plans',
    configKey: 'equipment_maintenance_plans_cols',
    icon: 'Calendar',
    tone: 'orange',
    enableDetail: true,
    staticColumns: PLAN_COLUMNS,
    summaryConfig: {
      ...DEFAULT_SUMMARY,
      rules: { completion_rate: 'avg' }
    },
    defaultExtraColumns: [
      { label: '提醒方式', prop: 'notify_method', type: 'select', options: [
        { label: '系统提醒', value: '系统提醒' },
        { label: '短信', value: '短信' },
        { label: '企业微信', value: '企业微信' }
      ] }
    ],
    ops: opPerms('equipment_plan'),
    createPayload: () => ({
      plan_no: `EP${Date.now().toString().slice(-8)}`,
      plan_name: '新巡检计划',
      asset_scope: '',
      plan_type: '月度保养',
      cycle_name: '月度',
      start_date: today(),
      next_execute_date: today(),
      owner_name: '',
      plan_status: '计划中',
      completion_rate: 0,
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-plan-1',
        plan_no: 'EP-202606-001',
        plan_name: '灌装线月度保养',
        asset_scope: '灌装一线、二线',
        plan_type: '月度保养',
        cycle_name: '月度',
        start_date: '2026-06-01',
        next_execute_date: '2026-06-10',
        owner_name: '陈雨',
        plan_status: '执行中',
        completion_rate: 62,
        status: 'active',
        properties: { notify_method: '系统提醒' }
      }
    ]
  },
  {
    key: 'standards',
    name: '保养标准',
    desc: '维护设备点检标准、保养规范和关键项目',
    route: '/app/standards',
    perm: 'app:equipment_standard',
    aclModule: 'equipment_standard',
    apiUrl: '/equipment_standards?status=neq.deleted',
    writeUrl: '/equipment_standards',
    writeMode: 'patch',
    includeProperties: true,
    viewId: 'equipment_standards',
    configKey: 'equipment_standards_cols',
    icon: 'DocumentChecked',
    tone: 'purple',
    enableDetail: true,
    staticColumns: STANDARD_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '标准附件', prop: 'attachments', type: 'file', fileMaxCount: 5, fileMaxSizeMb: 20 }
    ],
    ops: opPerms('equipment_standard'),
    createPayload: () => ({
      standard_no: `ES${Date.now().toString().slice(-8)}`,
      standard_name: '新保养标准',
      asset_type: '',
      version: 'V1',
      effective_date: today(),
      owner_name: '',
      standard_status: '草稿',
      key_items: '',
      status: 'active',
      properties: {}
    }),
    fallbackRows: [
      {
        id: 'demo-standard-1',
        standard_no: 'ES-FILL-001',
        standard_name: '灌装机日常点检标准',
        asset_type: '灌装设备',
        version: 'V2',
        effective_date: '2026-05-20',
        owner_name: '陈雨',
        standard_status: '生效',
        key_items: '扭矩、气压、泄漏、润滑、异响',
        status: 'active',
        properties: {}
      }
    ]
  }
]

export const findEquipmentApp = (key) => EQUIPMENT_APPS.find((app) => app.key === key)

export const EQUIPMENT_GRID_APPS = EQUIPMENT_APPS.filter((app) => app.appType !== 'dashboard')
