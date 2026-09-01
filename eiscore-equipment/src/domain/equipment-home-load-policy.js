// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const equipmentHomeQueryRequests = [
  { url: '/equipment_assets?status=neq.deleted&order=asset_no.asc&limit=500', method: 'get' },
  { url: '/equipment_checks?status=neq.deleted&order=check_date.desc&limit=500', method: 'get' },
  { url: '/equipment_issues?status=neq.deleted&order=deadline.asc&limit=500', method: 'get' },
  { url: '/equipment_work_orders?status=neq.deleted&order=plan_date.asc&limit=500', method: 'get' },
  { url: '/equipment_maintenance_plans?status=neq.deleted&order=next_execute_date.asc&limit=300', method: 'get' },
  { url: '/equipment_standards?status=neq.deleted&order=effective_date.desc&limit=300', method: 'get' }
]

export const buildEquipmentHomeQueryRequests = () => equipmentHomeQueryRequests.map((config) => ({ ...config }))

export const EQUIPMENT_HOME_FALLBACK_SNAPSHOT = {
  assets: [
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
      status: 'active'
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
      status: 'active'
    },
    {
      id: 'demo-asset-3',
      asset_no: 'EQ-PACK-004',
      asset_name: '四号封箱机',
      asset_type: '包装设备',
      location_name: '包装一线',
      asset_level: '重要',
      run_status: '停机',
      owner_dept: '生产部',
      owner_name: '刘铭',
      commission_date: '2025-02-18',
      last_maint_date: '2026-05-30',
      next_maint_date: '2026-06-15',
      health_score: 74,
      status: 'active'
    }
  ],
  checks: [
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
      check_date: '2026-06-05'
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
      check_date: '2026-06-04'
    },
    {
      id: 'demo-check-3',
      check_no: 'EC-20260604-008',
      asset_no: 'EQ-PACK-004',
      asset_name: '四号封箱机',
      check_type: '专项点检',
      check_item_count: 10,
      abnormal_count: 2,
      check_result: '停机',
      checker: '王浩',
      check_date: '2026-06-04'
    }
  ],
  issues: [
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
      issue_status: '处理中'
    }
  ],
  workOrders: [
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
      work_status: '处理中'
    }
  ],
  plans: [
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
      completion_rate: 62
    }
  ],
  standards: [
    {
      id: 'demo-standard-1',
      standard_no: 'ES-FILL-001',
      standard_name: '灌装机日常点检标准',
      asset_type: '灌装设备',
      standard_status: '生效'
    }
  ]
}

export const shouldApplyEquipmentHomeFallback = ({
  assets = [],
  checks = [],
  issues = [],
  workOrders = [],
  plans = [],
  standards = []
} = {}) => !(
  assets?.length || checks?.length || issues?.length || workOrders?.length || plans?.length || standards?.length
)
