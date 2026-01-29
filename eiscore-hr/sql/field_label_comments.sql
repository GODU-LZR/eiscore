-- 字段中文注释（作为源头规范）
-- 执行方式（UTF-8）：cat field_label_comments.sql | docker exec -i eiscore-db psql -U postgres -d eiscore

-- hr.archives（人事花名册/调岗）
comment on column hr.archives.id is '编号';
comment on column hr.archives.name is '姓名';
comment on column hr.archives.employee_no is '工号';
comment on column hr.archives.department is '部门';
comment on column hr.archives.position is '岗位';
comment on column hr.archives.phone is '手机号';
comment on column hr.archives.status is '状态';
comment on column hr.archives.base_salary is '基础工资';
comment on column hr.archives.entry_date is '入职日期';

-- hr.attendance_records（考勤日表）
comment on column hr.attendance_records.id is '编号';
comment on column hr.attendance_records.att_date is '日期';
comment on column hr.attendance_records.person_type is '人员类型';
comment on column hr.attendance_records.employee_id is '员工ID';
comment on column hr.attendance_records.employee_name is '员工姓名';
comment on column hr.attendance_records.employee_no is '工号';
comment on column hr.attendance_records.temp_name is '临时工姓名';
comment on column hr.attendance_records.temp_phone is '临时工电话';
comment on column hr.attendance_records.dept_id is '部门ID';
comment on column hr.attendance_records.dept_name is '部门';
comment on column hr.attendance_records.shift_id is '班次ID';
comment on column hr.attendance_records.shift_name is '班次';
comment on column hr.attendance_records.shift_start_time is '上班时间';
comment on column hr.attendance_records.shift_end_time is '下班时间';
comment on column hr.attendance_records.shift_cross_day is '跨天班次';
comment on column hr.attendance_records.late_grace_min is '迟到容忍(分)';
comment on column hr.attendance_records.early_grace_min is '早退容忍(分)';
comment on column hr.attendance_records.ot_break_min is '加班扣除(分)';
comment on column hr.attendance_records.punch_times is '打卡记录';
comment on column hr.attendance_records.late_flag is '迟到';
comment on column hr.attendance_records.early_flag is '早退';
comment on column hr.attendance_records.leave_flag is '请假';
comment on column hr.attendance_records.absent_flag is '缺勤';
comment on column hr.attendance_records.overtime_minutes is '加班分钟';
comment on column hr.attendance_records.remark is '备注';
comment on column hr.attendance_records.created_at is '创建时间';
comment on column hr.attendance_records.updated_at is '更新时间';

-- hr.attendance_month_overrides（考勤月度汇总）
comment on column hr.attendance_month_overrides.id is '编号';
comment on column hr.attendance_month_overrides.att_month is '月份';
comment on column hr.attendance_month_overrides.person_type is '人员类型';
comment on column hr.attendance_month_overrides.employee_id is '员工ID';
comment on column hr.attendance_month_overrides.employee_name is '员工姓名';
comment on column hr.attendance_month_overrides.employee_no is '工号';
comment on column hr.attendance_month_overrides.temp_name is '临时工姓名';
comment on column hr.attendance_month_overrides.temp_phone is '临时工电话';
comment on column hr.attendance_month_overrides.dept_name is '部门';
comment on column hr.attendance_month_overrides.person_key is '人员标识';
comment on column hr.attendance_month_overrides.total_days is '总天数';
comment on column hr.attendance_month_overrides.late_days is '迟到天数';
comment on column hr.attendance_month_overrides.early_days is '早退天数';
comment on column hr.attendance_month_overrides.leave_days is '请假天数';
comment on column hr.attendance_month_overrides.absent_days is '缺勤天数';
comment on column hr.attendance_month_overrides.overtime_minutes is '加班分钟';
comment on column hr.attendance_month_overrides.remark is '备注';
comment on column hr.attendance_month_overrides.created_at is '创建时间';
comment on column hr.attendance_month_overrides.updated_at is '更新时间';

-- public.raw_materials（物料台账）
comment on column public.raw_materials.id is '编号';
comment on column public.raw_materials.batch_no is '批次号';
comment on column public.raw_materials.name is '物料名称';
comment on column public.raw_materials.category is '物料分类';
comment on column public.raw_materials.weight_kg is '重量(kg)';
comment on column public.raw_materials.entry_date is '入库日期';
comment on column public.raw_materials.created_by is '创建人';
