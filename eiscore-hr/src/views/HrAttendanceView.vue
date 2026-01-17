<template>
  <div class="attendance-view">
    <div class="view-header">
      <div class="title-block">
        <h2>考勤管理</h2>
        <p>多班次 + 临时工 + 多次打卡的日常考勤</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <el-card class="filter-card" shadow="never">
      <div class="filter-row">
        <div class="mode-switch">
          <el-button :type="mode === 'day' ? 'primary' : 'default'" @click="setMode('day')">今天</el-button>
          <el-button :type="mode === 'month' ? 'primary' : 'default'" @click="setMode('month')">本月</el-button>
        </div>

        <el-date-picker
          v-if="mode === 'day'"
          v-model="dayValue"
          type="date"
          placeholder="选择日期"
          @change="handleFilterChange"
        />
        <el-date-picker
          v-else
          v-model="monthValue"
          type="month"
          placeholder="选择月份"
          @change="handleFilterChange"
        />

        <el-select
          v-model="deptValue"
          class="dept-select"
          placeholder="全部部门"
          clearable
          popper-class="dept-select-popper"
          @change="handleFilterChange"
        >
          <el-option label="全部部门" value="" />
          <el-option v-for="dept in deptOptions" :key="dept" :label="dept" :value="dept" />
        </el-select>

        <el-button type="primary" @click="applyFilter">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
        <el-button v-if="mode === 'day'" type="success" plain @click="() => initDayRecords(true)">补齐人员</el-button>
        <el-button v-if="mode === 'day'" type="primary" plain @click="openShiftDialog">新增班次</el-button>
      </div>
    </el-card>

    <el-card
      class="grid-card"
      shadow="never"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }"
    >
      <eis-data-grid
        ref="gridRef"
        :view-id="gridViewId"
        :api-url="gridApiUrl"
        :write-url="writeUrl"
        :include-properties="false"
        :write-mode="writeMode"
        :field-defaults="fieldDefaults"
        :patch-required-fields="patchRequiredFields"
        :static-columns="activeColumns"
        :extra-columns="[]"
        :summary="summaryConfig"
        :default-order="defaultOrder"
        @create="handleCreate"
        @config-columns="handleConfigColumns"
      />
    </el-card>

    <el-dialog v-model="shiftDialog.visible" title="新增班次" width="520px" append-to-body @closed="resetShiftForm">
      <el-form label-width="90px">
        <el-form-item label="班次名称">
          <el-input v-model="shiftForm.name" placeholder="例如：白班" />
        </el-form-item>
        <el-form-item label="上班时间">
          <el-time-select
            v-model="shiftForm.start_time"
            start="00:00"
            step="00:30"
            end="23:30"
            placeholder="选择上班时间"
          />
        </el-form-item>
        <el-form-item label="下班时间">
          <el-time-select
            v-model="shiftForm.end_time"
            start="00:00"
            step="00:30"
            end="23:30"
            placeholder="选择下班时间"
          />
        </el-form-item>
        <el-form-item label="跨天班次">
          <el-switch v-model="shiftForm.cross_day" />
        </el-form-item>
        <el-form-item label="迟到容忍(分)">
          <el-input-number v-model="shiftForm.late_grace_min" :min="0" :max="120" />
        </el-form-item>
        <el-form-item label="早退容忍(分)">
          <el-input-number v-model="shiftForm.early_grace_min" :min="0" :max="120" />
        </el-form-item>
        <el-form-item label="加班扣除(分)">
          <el-input-number v-model="shiftForm.ot_break_min" :min="0" :max="240" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shiftDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="shiftDialog.saving" @click="saveShift">保存班次</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'

const router = useRouter()
const gridRef = ref(null)

const mode = ref('day')
const dayValue = ref(new Date())
const monthValue = ref(new Date())
const deptValue = ref('')
const deptOptions = ref([])
const shiftOptions = ref([])
const initCache = new Set()
const shiftDialog = ref({ visible: false, saving: false })
const shiftForm = ref({
  name: '',
  start_time: '08:30',
  end_time: '17:30',
  cross_day: false,
  late_grace_min: 0,
  early_grace_min: 0,
  ot_break_min: 0
})
const fieldDefaults = {
  punch_times: [],
  late_flag: false,
  early_flag: false,
  leave_flag: false,
  absent_flag: false,
  overtime_minutes: 0,
  total_days: 0,
  late_days: 0,
  early_days: 0,
  leave_days: 0,
  absent_days: 0,
  remark: '',
  dept_name: '未分配'
}
const patchRequiredFields = ['att_date', 'person_type', 'dept_name']

const summaryConfig = { label: '合计', rules: {}, expressions: {} }

const formatDate = (date) => {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatMonth = (date) => {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

const currentDay = computed(() => formatDate(dayValue.value))
const currentMonth = computed(() => formatMonth(monthValue.value))

const gridViewId = computed(() => (mode.value === 'day' ? 'attendance_day' : 'attendance_month'))

const gridApiUrl = computed(() => {
  const dept = deptValue.value ? encodeURIComponent(deptValue.value) : ''
  if (mode.value === 'day') {
    const base = `/attendance_records?att_date=eq.${currentDay.value}`
    return dept ? `${base}&dept_name=eq.${dept}` : base
  }
  const base = `/v_attendance_monthly?att_month=eq.${currentMonth.value}`
  return dept ? `${base}&dept_name=eq.${dept}` : base
})

const writeUrl = computed(() => {
  if (mode.value === 'day') return '/attendance_records'
  return '/attendance_month_overrides?on_conflict=att_month,person_key'
})

const writeMode = computed(() => (mode.value === 'day' ? 'patch' : 'upsert'))

const defaultOrder = computed(() => {
  if (mode.value === 'day') return 'dept_name.asc,employee_name.asc'
  return 'dept_name.asc,employee_name.asc'
})

const shiftMap = computed(() => {
  const map = new Map()
  shiftOptions.value.forEach((opt) => {
    map.set(String(opt.value), opt)
  })
  return map
})

const normalizePunchTimes = (val) => {
  if (Array.isArray(val)) {
    return val.map(item => String(item).trim()).filter(Boolean)
  }
  if (val === null || val === undefined) return []
  const text = String(val).trim()
  if (!text) return []
  return text.split(/[\s,;，、]+/).filter(Boolean)
}

const formatPunchTimes = (params) => {
  const val = params.value ?? params.data?.punch_times
  const list = normalizePunchTimes(val)
  return list.join(' / ')
}

const punchTimesValueParser = (params) => normalizePunchTimes(params.newValue)
const parseNumber = (val) => {
  const num = Number(val)
  return Number.isFinite(num) ? num : 0
}

const normalizeName = (row) => row.employee_name || row.temp_name || ''
const normalizeNo = (row) => row.employee_no || row.temp_phone || ''

const nameValueGetter = (params) => normalizeName(params.data || {})
const nameValueSetter = (params) => {
  const text = params.newValue === null || params.newValue === undefined ? '' : String(params.newValue).trim()
  params.data.employee_name = text
  if (params.data.person_type === 'temp') {
    params.data.temp_name = text
  }
  return true
}

const noValueGetter = (params) => normalizeNo(params.data || {})
const noValueSetter = (params) => {
  const text = params.newValue === null || params.newValue === undefined ? '' : String(params.newValue).trim()
  if (params.data.person_type === 'temp') {
    params.data.temp_phone = text
  } else {
    params.data.employee_no = text
  }
  return true
}

const shiftValueSetter = (params) => {
  const next = params.newValue
  params.data.shift_id = next
  const shift = shiftMap.value.get(String(next))
  if (shift) {
    params.data.shift_name = shift.label
    params.data.shift_start_time = shift.start_time
    params.data.shift_end_time = shift.end_time
    params.data.shift_cross_day = shift.cross_day
    params.data.late_grace_min = shift.late_grace_min
    params.data.early_grace_min = shift.early_grace_min
    params.data.ot_break_min = shift.ot_break_min
  }
  return true
}

const yesNoOptions = [
  { label: '否', value: false },
  { label: '是', value: true }
]

const dayColumns = computed(() => [
  { label: '姓名', prop: 'employee_name', width: 120, valueGetter: nameValueGetter, valueSetter: nameValueSetter },
  { label: '工号/电话', prop: 'employee_no', width: 120, valueGetter: noValueGetter, valueSetter: noValueSetter },
  { label: '部门', prop: 'dept_name', width: 120 },
  { label: '日期', prop: 'att_date', width: 110, editable: false },
  {
    label: '班次',
    prop: 'shift_id',
    width: 140,
    type: 'select',
    options: shiftOptions.value,
    valueSetter: shiftValueSetter,
    syncFields: [
      'shift_name',
      'shift_start_time',
      'shift_end_time',
      'shift_cross_day',
      'late_grace_min',
      'early_grace_min',
      'ot_break_min'
    ]
  },
  {
    label: '打卡记录',
    prop: 'punch_times',
    minWidth: 220,
    formatter: formatPunchTimes,
    valueParser: punchTimesValueParser
  },
  {
    label: '打卡次数',
    prop: 'punch_times',
    width: 90,
    editable: false,
    valueGetter: (p) => normalizePunchTimes(p.data?.punch_times).length
  },
  { label: '迟到', prop: 'late_flag', width: 80, type: 'select', options: yesNoOptions, allowClear: false },
  { label: '早退', prop: 'early_flag', width: 80, type: 'select', options: yesNoOptions, allowClear: false },
  { label: '请假', prop: 'leave_flag', width: 80, type: 'select', options: yesNoOptions, allowClear: false },
  { label: '缺勤', prop: 'absent_flag', width: 80, type: 'select', options: yesNoOptions, allowClear: false },
  { label: '加班(分钟)', prop: 'overtime_minutes', width: 110 },
  { label: '备注', prop: 'remark', minWidth: 160 }
])

const monthColumns = computed(() => [
  { label: '姓名', prop: 'employee_name', width: 120, editable: false, valueGetter: nameValueGetter },
  { label: '工号/电话', prop: 'employee_no', width: 120, editable: false, valueGetter: noValueGetter },
  { label: '部门', prop: 'dept_name', width: 120, editable: false },
  { label: '月份', prop: 'att_month', width: 110, editable: false },
  { label: '总天数', prop: 'total_days', width: 90, valueParser: params => parseNumber(params.newValue) },
  { label: '迟到', prop: 'late_days', width: 80, valueParser: params => parseNumber(params.newValue) },
  { label: '早退', prop: 'early_days', width: 80, valueParser: params => parseNumber(params.newValue) },
  { label: '请假', prop: 'leave_days', width: 80, valueParser: params => parseNumber(params.newValue) },
  { label: '缺勤', prop: 'absent_days', width: 80, valueParser: params => parseNumber(params.newValue) },
  { label: '加班(分钟)', prop: 'overtime_minutes', width: 110, valueParser: params => parseNumber(params.newValue) },
  { label: '备注', prop: 'remark', minWidth: 160 }
])

const activeColumns = computed(() => (mode.value === 'day' ? dayColumns.value : monthColumns.value))

const fetchDepartments = async () => {
  try {
    const res = await request({
      url: '/departments?select=name&order=sort.asc',
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    deptOptions.value = Array.isArray(res) ? res.map(item => item.name) : []
  } catch (e) {
    deptOptions.value = []
  }
}

const fetchShifts = async () => {
  try {
    const res = await request({
      url: '/attendance_shifts?is_active=is.true&order=sort.asc',
      method: 'get'
    })
    shiftOptions.value = Array.isArray(res)
      ? res.map(item => ({
          label: item.name,
          value: item.id,
          start_time: item.start_time,
          end_time: item.end_time,
          cross_day: item.cross_day,
          late_grace_min: item.late_grace_min,
          early_grace_min: item.early_grace_min,
        ot_break_min: item.ot_break_min
      }))
      : []
  } catch (e) {
    shiftOptions.value = []
  }
}

const goApps = () => {
  router.push('/apps')
}

const setMode = (next) => {
  if (mode.value === next) return
  mode.value = next
  applyFilter()
}

const handleFilterChange = () => {}

const applyFilter = async () => {
  if (mode.value === 'day') {
    await initDayRecords()
  }
  if (gridRef.value?.loadData) {
    gridRef.value.loadData()
  }
}

const resetFilter = () => {
  deptValue.value = ''
  dayValue.value = new Date()
  monthValue.value = new Date()
  applyFilter()
}

const initDayRecords = async (force = false) => {
  const key = `${currentDay.value}|${deptValue.value || 'all'}`
  if (!force && initCache.has(key)) return
  try {
    await request({
      url: '/rpc/init_attendance_records',
      method: 'post',
      data: {
        p_date: currentDay.value,
        p_dept_name: deptValue.value || null
      }
    })
    initCache.add(key)
  } catch (e) {
    ElMessage.error('初始化人员失败')
  }
}

const handleCreate = async () => {
  if (mode.value !== 'day') {
    ElMessage.info('月统计不支持新增')
    return
  }
  try {
    await request({
      url: '/attendance_records',
      method: 'post',
      data: {
        att_date: currentDay.value,
        person_type: 'temp',
        temp_name: '临时工',
        dept_name: deptValue.value || '未分配'
      }
    })
    gridRef.value?.loadData()
  } catch (e) {
    ElMessage.error('新增失败')
  }
}

const handleConfigColumns = () => {
  ElMessage.info('考勤表暂不支持自定义列')
}

const openShiftDialog = () => {
  shiftDialog.value.visible = true
}

const resetShiftForm = () => {
  shiftForm.value = {
    name: '',
    start_time: '08:30',
    end_time: '17:30',
    cross_day: false,
    late_grace_min: 0,
    early_grace_min: 0,
    ot_break_min: 0
  }
}

const saveShift = async () => {
  const form = shiftForm.value
  if (!form.name || !form.start_time || !form.end_time) {
    ElMessage.warning('请填写班次名称与上下班时间')
    return
  }
  try {
    shiftDialog.value.saving = true
    await request({
      url: '/attendance_shifts',
      method: 'post',
      data: {
        name: form.name,
        start_time: form.start_time,
        end_time: form.end_time,
        cross_day: form.cross_day,
        late_grace_min: Number(form.late_grace_min) || 0,
        early_grace_min: Number(form.early_grace_min) || 0,
        ot_break_min: Number(form.ot_break_min) || 0,
        is_active: true,
        sort: 0
      }
    })
    await fetchShifts()
    ElMessage.success('班次已新增')
    shiftDialog.value.visible = false
    resetShiftForm()
  } catch (e) {
    ElMessage.error('新增班次失败')
  } finally {
    shiftDialog.value.saving = false
  }
}

onMounted(async () => {
  await Promise.allSettled([fetchDepartments(), fetchShifts()])
  await applyFilter()
})
</script>

<style scoped>
.attendance-view {
  padding: 20px;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.title-block h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.title-block p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.filter-card { margin-bottom: 12px; }

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.mode-switch { display: flex; gap: 6px; }

.dept-select {
  width: 220px;
}

.dept-select-popper .el-select-dropdown__wrap {
  max-height: none;
  overflow-y: visible;
}

.grid-card {
  min-height: 520px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.grid-card :deep(.eis-grid-wrapper) {
  flex: 1;
  min-height: 0;
}
</style>
