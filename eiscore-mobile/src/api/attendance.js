/**
 * 考勤模块 API —— 移动端版本（基于 fetch，不依赖 axios）
 *
 * 表对照:
 *   hr.attendance_records          考勤日表
 *   hr.attendance_shifts           班次配置
 *   hr.attendance_month_overrides  月度汇总
 *   hr.v_attendance_daily          日考勤视图
 *   hr.v_attendance_monthly        月考勤汇总视图
 */
import { getToken } from '@/utils/auth'

const API_BASE = '/api'

const hrHeaders = {
  'Accept-Profile': 'hr',
  'Content-Profile': 'hr'
}

/** 内部 fetch 封装 */
async function request(method, path, { params, body, headers: extraHeaders } = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...hrHeaders,
    ...extraHeaders
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let url = `${API_BASE}${path}`
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    window.location.href = '/mobile/login'
    throw new Error('登录已过期')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `请求失败 (${res.status})`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function get(path, opts) { return request('GET', path, opts) }
function post(path, data, opts = {}) { return request('POST', path, { ...opts, body: data }) }
function patch(path, data, opts = {}) { return request('PATCH', path, { ...opts, body: data }) }

/* ============ 日考勤 ============ */

/** 查询日考勤视图（v_attendance_daily），支持按日期和部门过滤 */
export const fetchDailyAttendance = (date, dept) => {
  const params = {
    att_date: `eq.${date}`,
    order: 'dept_name.asc,employee_name.asc'
  }
  if (dept) params.dept_name = `eq.${dept}`
  return get('/v_attendance_daily', { params })
}

/** 查询某员工日期范围的考勤记录 */
export const fetchEmployeeAttendance = (employeeId, startDate, endDate) => {
  const params = {
    employee_id: `eq.${employeeId}`,
    att_date: `gte.${startDate}`,
    order: 'att_date.desc'
  }
  if (endDate) params['att_date'] = `gte.${startDate}&att_date=lte.${endDate}`
  return get('/v_attendance_daily', { params })
}

/* ============ 月汇总 ============ */

/** 查询月考勤汇总视图（v_attendance_monthly） */
export const fetchMonthlyAttendance = (month, dept) => {
  const params = {
    att_month: `eq.${month}`,
    order: 'dept_name.asc,employee_name.asc'
  }
  if (dept) params.dept_name = `eq.${dept}`
  return get('/v_attendance_monthly', { params })
}

/* ============ 班次 ============ */

/** 获取所有启用的班次 */
export const fetchShifts = () =>
  get('/attendance_shifts', { params: { is_active: 'eq.true', order: 'sort.asc,name.asc' } })

/* ============ 打卡 ============ */

/** 提交打卡记录：更新 punch_times 数组 */
export const punchIn = async (recordId, punchTime) => {
  // 先查当前记录
  const records = await get('/attendance_records', { params: { id: `eq.${recordId}`, limit: 1 } })
  const record = Array.isArray(records) && records.length ? records[0] : null
  if (!record) throw new Error('考勤记录不存在')

  const times = Array.isArray(record.punch_times) ? [...record.punch_times] : []
  times.push(punchTime)

  return patch('/attendance_records', { punch_times: times }, {
    params: { id: `eq.${recordId}` },
    headers: { Prefer: 'return=representation' }
  })
}

/** 创建今日考勤记录（调用 init_attendance_records 函数） */
export const initTodayRecords = (date, deptName) =>
  post('/rpc/init_attendance_records', { p_date: date, p_dept_name: deptName || null })

/* ============ 部门列表 ============ */

/** 获取所有有出勤记录的部门 */
export const fetchDepartments = () =>
  get('/attendance_records', {
    params: {
      select: 'dept_name',
      order: 'dept_name.asc',
      limit: 200
    }
  }).then(rows => {
    const set = new Set((rows || []).map(r => r.dept_name).filter(Boolean))
    return [...set].sort()
  })

/* ============ 辅助 ============ */

export function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function formatMonth(d) {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${y}-${m}-01`
}

export function formatTime(ts) {
  if (!ts) return '--'
  // 如果是 HH:mm 或 HH:mm:ss 格式直接返回前5位
  if (/^\d{2}:\d{2}/.test(ts)) return ts.slice(0, 5)
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
