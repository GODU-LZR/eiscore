export const FIELD_LABELS = {
  hr_employee: {
    id: '编号',
    name: '姓名',
    employee_no: '工号',
    department: '部门',
    position: '岗位',
    phone: '手机号',
    status: '状态',
    base_salary: '基础工资',
    entry_date: '入职日期'
  },
  hr_change: {
    id: '编号',
    name: '姓名',
    employee_no: '工号',
    department: '部门',
    status: '状态',
    from_dept: '原部门',
    to_dept: '新部门',
    from_position: '原岗位',
    to_position: '新岗位',
    effective_date: '生效日期',
    transfer_type: '调岗类型',
    transfer_reason: '调岗原因',
    approver: '审批人'
  },
  hr_attendance: {
    id: '编号',
    att_date: '日期',
    person_type: '人员类型',
    employee_id: '员工ID',
    employee_name: '员工姓名',
    employee_no: '工号',
    temp_name: '临时工姓名',
    temp_phone: '临时工电话',
    dept_name: '部门',
    shift_name: '班次',
    shift_start_time: '上班时间',
    shift_end_time: '下班时间',
    late_flag: '迟到',
    early_flag: '早退',
    leave_flag: '请假',
    absent_flag: '缺勤',
    overtime_minutes: '加班分钟',
    remark: '备注'
  },
  mms_ledger: {
    id: '编号',
    batch_no: '批次号',
    name: '物料名称',
    category: '物料分类',
    weight_kg: '重量(kg)',
    entry_date: '入库日期',
    created_by: '创建人'
  }
}
