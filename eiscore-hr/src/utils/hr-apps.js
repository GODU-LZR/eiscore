export const BASE_STATIC_COLUMNS = [
  { label: '编号', prop: 'id', editable: false, width: 80 },
  { label: '姓名', prop: 'name', width: 120 },
  { label: '工号', prop: 'employee_no', editable: false, width: 120 },
  { label: '部门', prop: 'department', width: 120 },
  { label: '状态', prop: 'status', width: 100 }
]

const EMPLOYEE_STATIC_COLUMNS = BASE_STATIC_COLUMNS.filter((col) => col.prop !== 'status')

const DEFAULT_SUMMARY = {
  label: '总计',
  rules: {},
  expressions: {}
}

export const HR_APPS = [
  {
    key: 'a',
    name: '人事花名册',
    desc: '员工档案与基础信息管理',
    route: '/employee',
    perm: 'app:hr_employee',
    aclModule: 'hr_employee',
    viewId: 'employee_list',
    configKey: 'hr_table_cols',
    icon: 'User',
    tone: 'blue',
    enableDetail: true,
    ops: {
      create: 'op:hr_employee.create',
      edit: 'op:hr_employee.edit',
      delete: 'op:hr_employee.delete',
      export: 'op:hr_employee.export',
      config: 'op:hr_employee.config'
    },
    staticColumns: EMPLOYEE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '性别', prop: 'gender', type: 'select', options: [
        { label: '男', value: '男' },
        { label: '女', value: '女' }
      ] },
      { label: '手机号', prop: 'phone', type: 'text' },
      { label: '身份证', prop: 'id_card', type: 'text' },
      { label: '籍贯', prop: 'native_place', type: 'text' },
      { label: '岗位', prop: 'position', type: 'text' },
      { label: '工资', prop: 'salary', type: 'text' },
      { label: '绩效', prop: 'performance', type: 'text' },
      { label: '总工资', prop: 'total_salary', type: 'formula', expression: '{工资}+{绩效}' }
    ]
  },
  {
    key: 'org',
    name: '部门架构图',
    desc: '多级部门结构与成员查看',
    route: '/org',
    perm: 'app:hr_org',
    aclModule: 'hr_org',
    viewId: 'hr_org_chart',
    configKey: 'hr_org_bpmn',
    icon: 'OfficeBuilding',
    tone: 'blue',
    enableDetail: false,
    ops: {
      create: 'op:hr_org.create',
      edit: 'op:hr_org.edit',
      delete: 'op:hr_org.delete',
      saveLayout: 'op:hr_org.save_layout',
      memberManage: 'op:hr_org.member_manage'
    },
    staticColumns: BASE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: []
  },
  {
    key: 'acl',
    name: '权限管理',
    desc: '角色、权限与数据范围配置',
    route: '/acl',
    perm: 'app:hr_acl',
    aclModule: 'hr_acl',
    viewId: 'hr_acl',
    configKey: 'hr_acl_config',
    icon: 'Document',
    tone: 'blue',
    enableDetail: false,
    ops: {
      create: 'op:hr_acl.create',
      edit: 'op:hr_acl.edit',
      delete: 'op:hr_acl.delete'
    },
    staticColumns: BASE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: []
  },
  {
    key: 'user',
    name: '用户管理',
    desc: '系统用户与角色绑定管理',
    route: '/users',
    perm: 'app:hr_user',
    aclModule: 'hr_user',
    viewId: 'hr_user_manage',
    configKey: 'hr_user_cols',
    icon: 'User',
    tone: 'blue',
    enableDetail: false,
    ops: {
      create: 'op:hr_user.create',
      edit: 'op:hr_user.edit',
      delete: 'op:hr_user.delete',
      export: 'op:hr_user.export',
      config: 'op:hr_user.config'
    },
    staticColumns: BASE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: []
  },
  {
    key: 'b',
    name: '调岗记录',
    desc: '岗位变动与调岗审批留痕',
    route: '/app/b',
    perm: 'app:hr_change',
    aclModule: 'hr_change',
    viewId: 'hr_transfer',
    configKey: 'hr_transfer_cols',
    icon: 'Document',
    tone: 'orange',
    enableDetail: true,
    ops: {
      create: 'op:hr_change.create',
      edit: 'op:hr_change.edit',
      delete: 'op:hr_change.delete',
      export: 'op:hr_change.export',
      config: 'op:hr_change.config'
    },
    staticColumns: BASE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '原部门', prop: 'from_dept', type: 'text' },
      { label: '新部门', prop: 'to_dept', type: 'text' },
      { label: '原岗位', prop: 'from_position', type: 'text' },
      { label: '新岗位', prop: 'to_position', type: 'text' },
      { label: '生效日期', prop: 'effective_date', type: 'text' },
      { label: '调岗类型', prop: 'transfer_type', type: 'select', options: [
        { label: '平调', value: '平调' },
        { label: '晋升', value: '晋升' },
        { label: '降级', value: '降级' }
      ] },
      { label: '调岗原因', prop: 'transfer_reason', type: 'text' },
      { label: '审批人', prop: 'approver', type: 'text' }
    ]
  },
  {
    key: 'c',
    name: '考勤管理',
    desc: '签到签退与出勤记录台账',
    route: '/app/c',
    perm: 'app:hr_attendance',
    aclModule: 'hr_attendance',
    viewId: 'hr_attendance',
    configKey: 'hr_attendance_cols',
    icon: 'Calendar',
    tone: 'green',
    enableDetail: false,
    ops: {
      create: 'op:hr_attendance.create',
      edit: 'op:hr_attendance.edit',
      delete: 'op:hr_attendance.delete',
      export: 'op:hr_attendance.export',
      config: 'op:hr_attendance.config',
      shiftManage: 'op:hr_attendance.shift_manage',
      shiftCreate: 'op:hr_attendance.shift_create'
    },
    staticColumns: BASE_STATIC_COLUMNS,
    summaryConfig: DEFAULT_SUMMARY,
    defaultExtraColumns: [
      { label: '日期', prop: 'att_date', type: 'text' },
      { label: '签到时间', prop: 'check_in', type: 'text' },
      { label: '签退时间', prop: 'check_out', type: 'text' },
      { label: '考勤状态', prop: 'att_status', type: 'select', options: [
        { label: '正常', value: '正常' },
        { label: '迟到', value: '迟到' },
        { label: '早退', value: '早退' },
        { label: '缺勤', value: '缺勤' },
        { label: '请假', value: '请假' }
      ] },
      { label: '加班时长', prop: 'ot_hours', type: 'text' },
      { label: '备注', prop: 'att_note', type: 'text' }
    ]
  }
]

export const findHrApp = (key) => {
  return HR_APPS.find((app) => app.key === key)
}
