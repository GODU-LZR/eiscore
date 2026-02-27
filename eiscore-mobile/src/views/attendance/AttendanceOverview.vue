<template>
  <div class="overview">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>考勤中心</p>
      <span />
    </div>

    <div class="home">
      <!-- 全屏加载遮罩 -->
      <div v-if="pageLoading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">{{ loadingMessage || '正在加载数据...' }}</div>
      </div>

      <!-- Hero 区域 -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">Attendance Hub</span>
          <h1>考勤中心</h1>
          <p>查看考勤记录，掌握出勤动态。</p>
        </div>
        <div class="hero-actions">
          <button class="action-btn punch" @click="handlePunchIn">
            <span class="action-title">快速打卡</span>
            <span class="action-desc">{{ currentTime }}</span>
          </button>
        </div>
        <!-- 打卡结果提示 -->
        <div v-if="punchTip.text" class="punch-tip" :class="punchTip.type" @click="punchTip.text = ''">
          <span>{{ punchTip.text }}</span>
          <span class="tip-close">✕</span>
        </div>
        <div class="mode-card">
          <div class="mode-info">
            <div class="mode-title">查看模式</div>
            <div class="mode-desc">
              {{ mode === 'day' ? '按日查看每人考勤详情' : '按月查看汇总统计' }}
            </div>
          </div>
          <button class="mode-toggle" :class="{ month: mode === 'month' }" @click="toggleMode">
            <span class="mode-label">{{ mode === 'day' ? '日视图' : '月视图' }}</span>
            <span class="mode-hint">点击切换</span>
          </button>
        </div>
      </section>

      <!-- 筛选卡片 -->
      <section class="search-card">
        <div class="filter-row">
          <div class="filter-group">
            <label>{{ mode === 'day' ? '日期' : '月份' }}</label>
            <input
              type="date"
              v-if="mode === 'day'"
              v-model="dayValue"
              @change="applyFilter"
            />
            <input
              type="month"
              v-else
              v-model="monthInputValue"
              @change="applyFilter"
            />
          </div>
          <div class="filter-group">
            <label>部门</label>
            <select v-model="deptValue" @change="applyFilter">
              <option value="">全部部门</option>
              <option v-for="dept in deptOptions" :key="dept" :value="dept">{{ dept }}</option>
            </select>
          </div>
        </div>
        <div class="search-row">
          <input
            v-model.trim="searchText"
            type="text"
            placeholder="搜索姓名 / 工号"
            @keyup.enter="applyFilter"
          />
          <button class="search-btn" @click="applyFilter">查询</button>
        </div>
      </section>

      <!-- 统计行 -->
      <section class="stats-row">
        <div class="stat-card">
          <div class="stat-label">总人数</div>
          <div class="stat-value">{{ totalCount }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">{{ mode === 'day' ? '已打卡' : '满勤' }}</div>
          <div class="stat-value">{{ normalCount }}</div>
        </div>
        <div class="stat-card warn">
          <div class="stat-label">{{ mode === 'day' ? '迟到/早退' : '异常' }}</div>
          <div class="stat-value">{{ abnormalCount }}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">{{ mode === 'day' ? '缺勤' : '请假/缺勤' }}</div>
          <div class="stat-value">{{ absentCount }}</div>
        </div>
      </section>

      <!-- 日视图：员工考勤卡片列表 -->
      <section v-if="mode === 'day'" class="record-section">
        <div class="section-head">
          <div>
            <h2>日考勤明细</h2>
            <p>{{ dayValue }} 各员工出勤状况</p>
          </div>
          <button class="ghost-btn" @click="refreshAll">刷新</button>
        </div>

        <div v-if="loading" class="state">正在加载考勤数据...</div>
        <div v-else-if="errorMsg" class="state error">{{ errorMsg }}</div>
        <div v-else-if="filteredRecords.length === 0" class="state empty">暂无考勤记录</div>

        <div v-else class="record-grid">
          <article
            v-for="(rec, index) in filteredRecords"
            :key="rec.id"
            class="record-card"
            :style="{ animationDelay: `${index * 0.04}s` }"
            @click="goDetail(rec)"
          >
            <div class="record-top">
              <div class="record-avatar" :class="statusClass(rec)">
                {{ (rec.employee_name || rec.temp_name || '?').slice(0, 1) }}
              </div>
              <div class="record-info">
                <div class="record-name">{{ rec.employee_name || rec.temp_name || '--' }}</div>
                <div class="record-meta-text">
                  <span v-if="rec.employee_no" class="record-no">{{ rec.employee_no }}</span>
                  <span v-if="rec.person_type === 'temp'" class="temp-badge">临时工</span>
                  <span class="dept-label">{{ rec.dept_name || '未分配' }}</span>
                </div>
              </div>
              <div class="record-status">
                <span class="status-tag" :class="statusClass(rec)">{{ statusLabel(rec) }}</span>
              </div>
            </div>
            <div class="record-body">
              <div class="record-item" v-if="rec.shift_name">
                <span class="item-label">班次</span>
                <span class="item-value">{{ rec.shift_name }}</span>
              </div>
              <div class="record-item">
                <span class="item-label">打卡</span>
                <span class="item-value punch-text">
                  {{ rec.punch_count > 0 ? rec.punch_text : '未打卡' }}
                </span>
              </div>
              <div class="record-item" v-if="rec.punch_count > 0">
                <span class="item-label">首次</span>
                <span class="item-value">{{ fmtTime(rec.first_punch) }}</span>
              </div>
              <div class="record-item" v-if="rec.punch_count > 1">
                <span class="item-label">末次</span>
                <span class="item-value">{{ fmtTime(rec.last_punch) }}</span>
              </div>
              <div class="record-flags">
                <span v-if="rec.late_flag" class="flag warn">迟到</span>
                <span v-if="rec.early_flag" class="flag warn">早退</span>
                <span v-if="rec.leave_flag" class="flag info">请假</span>
                <span v-if="rec.absent_flag" class="flag danger">缺勤</span>
                <span v-if="rec.overtime_minutes > 0" class="flag accent">加班 {{ rec.overtime_minutes }}分</span>
              </div>
            </div>
            <div class="record-foot">
              <span v-if="rec.remark" class="remark-text">{{ rec.remark }}</span>
              <i class="chevron" />
            </div>
          </article>
        </div>
      </section>

      <!-- 月视图：月度汇总卡片列表 -->
      <section v-else class="record-section">
        <div class="section-head">
          <div>
            <h2>月度汇总</h2>
            <p>{{ displayMonth }} 各员工出勤汇总</p>
          </div>
          <button class="ghost-btn" @click="refreshAll">刷新</button>
        </div>

        <div v-if="loading" class="state">正在加载月度数据...</div>
        <div v-else-if="errorMsg" class="state error">{{ errorMsg }}</div>
        <div v-else-if="filteredMonthly.length === 0" class="state empty">暂无月度汇总</div>

        <div v-else class="record-grid">
          <article
            v-for="(rec, index) in filteredMonthly"
            :key="`${rec.employee_id}-${rec.temp_phone}-${rec.att_month}`"
            class="record-card monthly"
            :style="{ animationDelay: `${index * 0.04}s` }"
          >
            <div class="record-top">
              <div class="record-avatar" :class="monthStatusClass(rec)">
                {{ (rec.employee_name || rec.temp_name || '?').slice(0, 1) }}
              </div>
              <div class="record-info">
                <div class="record-name">{{ rec.employee_name || rec.temp_name || '--' }}</div>
                <div class="record-meta-text">
                  <span v-if="rec.employee_no" class="record-no">{{ rec.employee_no }}</span>
                  <span v-if="rec.person_type === 'temp'" class="temp-badge">临时工</span>
                  <span class="dept-label">{{ rec.dept_name || '未分配' }}</span>
                </div>
              </div>
            </div>
            <div class="record-body monthly-body">
              <div class="month-stat-grid">
                <div class="month-stat">
                  <div class="month-stat-val">{{ rec.total_days || 0 }}</div>
                  <div class="month-stat-label">出勤天数</div>
                </div>
                <div class="month-stat warn">
                  <div class="month-stat-val">{{ rec.late_days || 0 }}</div>
                  <div class="month-stat-label">迟到</div>
                </div>
                <div class="month-stat warn">
                  <div class="month-stat-val">{{ rec.early_days || 0 }}</div>
                  <div class="month-stat-label">早退</div>
                </div>
                <div class="month-stat info">
                  <div class="month-stat-val">{{ rec.leave_days || 0 }}</div>
                  <div class="month-stat-label">请假</div>
                </div>
                <div class="month-stat danger">
                  <div class="month-stat-val">{{ rec.absent_days || 0 }}</div>
                  <div class="month-stat-label">缺勤</div>
                </div>
                <div class="month-stat accent">
                  <div class="month-stat-val">{{ fmtOvertimeHours(rec.overtime_minutes) }}</div>
                  <div class="month-stat-label">加班(时)</div>
                </div>
              </div>
              <div v-if="rec.remark" class="month-remark">{{ rec.remark }}</div>
            </div>
          </article>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>

    <!-- 打卡确认弹窗 -->
    <van-dialog
      v-model:show="punchDialogVisible"
      title="确认打卡"
      show-cancel-button
      :message="punchDialogMessage"
      @confirm="doPunchIn"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchDailyAttendance,
  fetchMonthlyAttendance,
  fetchDepartments,
  initTodayRecords,
  punchIn as apiPunchIn,
  formatDate,
  formatMonth,
  formatTime
} from '@/api/attendance'
import { getUserInfo } from '@/utils/auth'

const router = useRouter()

/* ----------- 状态 ----------- */
const pageLoading = ref(false)
const loadingMessage = ref('')
const loading = ref(false)
const errorMsg = ref('')
const searchText = ref('')
const mode = ref('day')

// 日期
const today = new Date()
const dayValue = ref(formatDate(today))
const monthInputValue = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
const deptValue = ref('')
const deptOptions = ref([])

// 数据
const dailyRecords = ref([])
const monthlyRecords = ref([])

// 当前时间
const currentTime = ref('')
let clockTimer = null

// 打卡确认弹窗
const punchDialogVisible = ref(false)
const punchDialogMessage = ref('')

// 页面内提示（替代 showToast 避免空白弹窗）
const punchTip = reactive({ text: '', type: 'success' })
let tipTimer = null
function showTip(text, type = 'success', duration = 3000) {
  clearTimeout(tipTimer)
  punchTip.text = text
  punchTip.type = type
  if (duration > 0) {
    tipTimer = setTimeout(() => { punchTip.text = '' }, duration)
  }
}

/* ----------- computed ----------- */
const keyword = computed(() => (searchText.value || '').toLowerCase())

const displayMonth = computed(() => {
  const parts = monthInputValue.value.split('-')
  return parts.length >= 2 ? `${parts[0]}年${parseInt(parts[1])}月` : monthInputValue.value
})

const filteredRecords = computed(() => {
  let list = dailyRecords.value
  if (keyword.value) {
    list = list.filter(r =>
      matchStr(r.employee_name, keyword.value) ||
      matchStr(r.employee_no, keyword.value) ||
      matchStr(r.temp_name, keyword.value) ||
      matchStr(r.dept_name, keyword.value)
    )
  }
  return list
})

const filteredMonthly = computed(() => {
  let list = monthlyRecords.value
  if (keyword.value) {
    list = list.filter(r =>
      matchStr(r.employee_name, keyword.value) ||
      matchStr(r.employee_no, keyword.value) ||
      matchStr(r.temp_name, keyword.value) ||
      matchStr(r.dept_name, keyword.value)
    )
  }
  return list
})

const totalCount = computed(() =>
  mode.value === 'day' ? filteredRecords.value.length : filteredMonthly.value.length
)

const normalCount = computed(() => {
  if (mode.value === 'day') {
    return filteredRecords.value.filter(r =>
      r.punch_count > 0 && !r.late_flag && !r.early_flag && !r.absent_flag && !r.leave_flag
    ).length
  }
  return filteredMonthly.value.filter(r =>
    (r.late_days || 0) === 0 && (r.early_days || 0) === 0 &&
    (r.absent_days || 0) === 0 && (r.leave_days || 0) === 0
  ).length
})

const abnormalCount = computed(() => {
  if (mode.value === 'day') {
    return filteredRecords.value.filter(r => r.late_flag || r.early_flag).length
  }
  return filteredMonthly.value.filter(r =>
    (r.late_days || 0) > 0 || (r.early_days || 0) > 0
  ).length
})

const absentCount = computed(() => {
  if (mode.value === 'day') {
    return filteredRecords.value.filter(r => r.absent_flag || r.leave_flag).length
  }
  return filteredMonthly.value.filter(r =>
    (r.absent_days || 0) > 0 || (r.leave_days || 0) > 0
  ).length
})

/* ----------- lifecycle ----------- */
onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  loadDepartments()
  loadData()
})

/* ----------- 方法 ----------- */
function matchStr(val, kw) { return val && String(val).toLowerCase().includes(kw) }

function updateClock() {
  const now = new Date()
  currentTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

function setPageLoading(msg) { loadingMessage.value = msg || ''; pageLoading.value = true }
function clearPageLoading() { pageLoading.value = false; loadingMessage.value = '' }

function toggleMode() {
  mode.value = mode.value === 'day' ? 'month' : 'day'
  loadData()
}

async function loadDepartments() {
  try {
    deptOptions.value = await fetchDepartments()
  } catch { /* ignore */ }
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    if (mode.value === 'day') {
      dailyRecords.value = await fetchDailyAttendance(dayValue.value, deptValue.value || null)
    } else {
      const month = `${monthInputValue.value}-01`
      monthlyRecords.value = await fetchMonthlyAttendance(month, deptValue.value || null)
    }
  } catch (e) {
    errorMsg.value = `加载失败：${e.message || '未知错误'}`
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  loadData()
}

async function refreshAll() {
  setPageLoading('正在刷新考勤数据...')
  await loadData()
  clearPageLoading()
  showTip('刷新完成', 'success')
}

/* ----------- 打卡 ----------- */
function handlePunchIn() {
  const userInfo = getUserInfo()
  if (!userInfo) {
    showTip('请先登录', 'error')
    return
  }
  punchDialogMessage.value = `当前时间 ${currentTime.value}，确认打卡？`
  punchDialogVisible.value = true
}

async function doPunchIn() {
  const userInfo = getUserInfo()
  setPageLoading('正在提交打卡...')
  try {
    // 先确保今天有记录
    const todayStr = formatDate(new Date())
    await initTodayRecords(todayStr)

    // 重新加载今日数据找到自己的记录
    const records = await fetchDailyAttendance(todayStr, null)
    const myRecord = records.find(r =>
      r.employee_id && userInfo.employee_id && r.employee_id === userInfo.employee_id
    ) || records.find(r =>
      r.employee_name === (userInfo.full_name || userInfo.username)
    )

    if (!myRecord) {
      showTip('未找到您的考勤记录，请联系管理员', 'error')
      clearPageLoading()
      return
    }

    const now = new Date()
    const punchTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    await apiPunchIn(myRecord.id, punchTime)

    showTip(`打卡成功 ${punchTime}`, 'success')
    // 刷新数据
    if (mode.value === 'day' && dayValue.value === todayStr) {
      await loadData()
    }
  } catch (e) {
    showTip(`打卡失败：${e.message || '未知错误'}`, 'error')
  } finally {
    clearPageLoading()
  }
}

/* ----------- 导航 ----------- */
function goDetail(rec) {
  if (rec.employee_id) {
    router.push(`/attendance/detail/${rec.employee_id}`)
  }
}

/* ----------- 状态判断 ----------- */
function statusClass(rec) {
  if (rec.absent_flag) return 'danger'
  if (rec.leave_flag) return 'info'
  if (rec.late_flag || rec.early_flag) return 'warn'
  if (rec.punch_count > 0) return 'success'
  return 'muted'
}

function statusLabel(rec) {
  if (rec.absent_flag) return '缺勤'
  if (rec.leave_flag) return '请假'
  if (rec.late_flag && rec.early_flag) return '迟到+早退'
  if (rec.late_flag) return '迟到'
  if (rec.early_flag) return '早退'
  if (rec.punch_count > 0) return '正常'
  return '未打卡'
}

function monthStatusClass(rec) {
  if ((rec.absent_days || 0) > 0) return 'danger'
  if ((rec.late_days || 0) > 0 || (rec.early_days || 0) > 0) return 'warn'
  return 'success'
}

function fmtTime(val) { return formatTime(val) }
function fmtOvertimeHours(min) {
  if (!min) return '0'
  return (min / 60).toFixed(1)
}
</script>

<style scoped>
/* ===== Header ===== */
.header-top {
  width: 100%;
  height: 44px;
  background: #007cff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-sizing: border-box;
  font-size: 16px;
  font-weight: 400;
  color: #ffffff;
  position: sticky;
  top: 0;
  z-index: 20;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.back-icon {
  width: 10px;
  height: 10px;
  border-left: 2px solid #ffffff;
  border-bottom: 2px solid #ffffff;
  transform: rotate(45deg);
}

/* ===== Main Container ===== */
.overview {
  min-height: 100vh;
  background: #f5f8f9;
}
.home {
  --ink: #1d2433;
  --muted: #5a6b7c;
  --line: #e3e9f2;
  --accent: #1b6dff;
  --accent-dark: #0e3fa5;
  --accent-soft: rgba(27, 109, 255, 0.12);
  --fresh: #21c189;
  --sunny: #ffb24a;
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  color: var(--ink);
  position: relative;
  padding: 16px;
  flex: 0 0 auto;
  background:
    radial-gradient(700px 280px at 10% -10%, rgba(27, 109, 255, 0.16), transparent 65%),
    radial-gradient(600px 260px at 100% 20%, rgba(33, 193, 137, 0.14), transparent 60%),
    linear-gradient(140deg, #f9fbff 0%, #f1f6ff 50%, #f6fbf8 100%);
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.home::before,
.home::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.home::before {
  background: radial-gradient(500px 320px at 90% -10%, rgba(255, 178, 74, 0.25), transparent 70%);
  opacity: 0.6;
}
.home::after {
  background-image: repeating-linear-gradient(120deg, rgba(12, 34, 64, 0.03) 0, rgba(12, 34, 64, 0.03) 1px, transparent 1px, transparent 64px);
  opacity: 0.4;
}
.home > * {
  position: relative;
  z-index: 1;
}

/* ===== Loading Mask ===== */
.page-mask {
  position: fixed;
  inset: 0;
  background: rgba(247, 249, 252, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 30;
  backdrop-filter: blur(6px);
}
.spinner {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid rgba(27, 109, 255, 0.2);
  border-top-color: var(--accent);
  animation: spin 0.9s linear infinite;
}
.mask-text {
  font-size: 13px;
  color: var(--muted);
  letter-spacing: 0.5px;
}

/* ===== Punch Tip (inline notification) ===== */
.punch-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  animation: riseIn 0.3s ease both;
  cursor: pointer;
}
.punch-tip.success {
  background: rgba(33, 193, 137, 0.14);
  color: #0f7b52;
}
.punch-tip.error {
  background: rgba(239, 68, 68, 0.14);
  color: #dc2626;
}
.tip-close {
  font-size: 12px;
  opacity: 0.6;
  margin-left: 8px;
}

/* ===== Hero ===== */
.hero {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 18px 40px rgba(20, 37, 90, 0.12);
  animation: riseIn 0.6s ease both;
}
.hero-copy h1 {
  margin: 8px 0 6px;
  font-size: 22px;
  letter-spacing: 0.5px;
}
.hero-copy p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--accent-dark);
  background: rgba(27, 109, 255, 0.12);
  letter-spacing: 0.4px;
}
.hero-actions {
  display: grid;
  gap: 12px;
}
.action-btn {
  border: none;
  border-radius: 16px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.action-btn.punch {
  background: linear-gradient(135deg, #21c189 0%, #0fb87a 100%);
  box-shadow: 0 12px 24px rgba(33, 193, 137, 0.24);
}
.action-btn:active {
  transform: translateY(1px);
}
.action-title {
  font-size: 16px;
  font-weight: 600;
}
.action-desc {
  font-size: 14px;
  opacity: 0.9;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  letter-spacing: 1px;
}

/* ===== Mode Card ===== */
.mode-card {
  margin-top: 6px;
  background: rgba(15, 30, 56, 0.06);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  grid-column: 1 / -1;
}
.mode-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mode-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
.mode-desc {
  font-size: 12px;
  color: var(--muted);
}
.mode-toggle {
  border: none;
  border-radius: 14px;
  padding: 10px 12px;
  min-width: 100px;
  background: #e8eef7;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mode-toggle.month {
  background: linear-gradient(135deg, #1b6dff 0%, #4b8bff 100%);
  color: #ffffff;
}
.mode-label {
  font-size: 13px;
  font-weight: 600;
}
.mode-hint {
  font-size: 11px;
  opacity: 0.8;
}

/* ===== Filter Card ===== */
.search-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 10px 24px rgba(20, 37, 90, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: riseIn 0.7s ease both;
}
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.filter-group label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.filter-group input,
.filter-group select {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  background: #f7f9fc;
  color: var(--ink);
  outline: none;
  box-sizing: border-box;
  width: 100%;
}
.search-row {
  display: flex;
  gap: 10px;
  box-sizing: border-box;
}
.search-row input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  background: #f7f9fc;
  color: var(--ink);
  outline: none;
  box-sizing: border-box;
}
.search-btn {
  flex-shrink: 0;
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-sizing: border-box;
}

/* ===== Stats Row ===== */
.stats-row {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, 1fr);
  animation: riseIn 0.8s ease both;
}
.stat-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 12px 10px;
  box-shadow: 0 8px 20px rgba(20, 37, 90, 0.08);
  text-align: center;
}
.stat-card.accent {
  background: linear-gradient(135deg, #21c189 0%, #0fb87a 100%);
  color: #ffffff;
}
.stat-card.warn {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #ffffff;
}
.stat-card.danger {
  background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
  color: #ffffff;
}
.stat-label {
  font-size: 11px;
  opacity: 0.85;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
  margin-top: 4px;
}

/* ===== Section ===== */
.record-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.section-head h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.section-head p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
.ghost-btn {
  border: 1px solid var(--line);
  background: #ffffff;
  color: var(--muted);
  border-radius: 12px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
}
.record-grid {
  display: grid;
  gap: 12px;
}

/* ===== Record Card (Daily) ===== */
.record-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(227, 233, 242, 0.8);
  box-shadow: 0 10px 24px rgba(20, 37, 90, 0.07);
  overflow: hidden;
  animation: riseIn 0.5s ease both;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.record-card:active {
  transform: translateY(1px);
}
.record-top {
  padding: 14px 16px 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.record-avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
  background: #94a3b8;
}
.record-avatar.success { background: linear-gradient(135deg, #21c189, #0fb87a); }
.record-avatar.warn { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.record-avatar.danger { background: linear-gradient(135deg, #ef4444, #f87171); }
.record-avatar.info { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
.record-avatar.muted { background: #cbd5e1; }
.record-info {
  flex: 1;
  min-width: 0;
}
.record-name {
  font-size: 15px;
  font-weight: 600;
}
.record-meta-text {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
}
.record-no {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.temp-badge {
  background: rgba(245, 158, 11, 0.15);
  color: #92600a;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}
.dept-label {
  background: rgba(27, 109, 255, 0.08);
  color: var(--accent-dark);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
}
.record-status {
  flex-shrink: 0;
}
.status-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #f1f5f9;
  color: #64748b;
}
.status-tag.success { background: rgba(33, 193, 137, 0.12); color: #0f7b52; }
.status-tag.warn { background: rgba(245, 158, 11, 0.12); color: #92600a; }
.status-tag.danger { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.status-tag.info { background: rgba(59, 130, 246, 0.12); color: #1d4ed8; }
.status-tag.muted { background: #f1f5f9; color: #94a3b8; }

.record-body {
  padding: 0 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.item-label {
  color: var(--muted);
  font-size: 12px;
  flex-shrink: 0;
}
.item-value {
  color: var(--ink);
  text-align: right;
}
.item-value.punch-text {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.5px;
}
.record-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}
.flag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.flag.warn { background: rgba(245, 158, 11, 0.12); color: #92600a; }
.flag.danger { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.flag.info { background: rgba(59, 130, 246, 0.12); color: #1d4ed8; }
.flag.accent { background: rgba(27, 109, 255, 0.1); color: var(--accent-dark); }

.record-foot {
  padding: 8px 16px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed rgba(227, 233, 242, 0.6);
}
.remark-text {
  font-size: 12px;
  color: var(--muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(-45deg);
  display: inline-block;
  flex-shrink: 0;
}

/* ===== Monthly Card ===== */
.record-card.monthly {
  cursor: default;
}
.record-card.monthly:active {
  transform: none;
}
.monthly-body {
  padding: 0 16px 14px;
}
.month-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.month-stat {
  background: #f7f9fc;
  border-radius: 12px;
  padding: 10px 8px;
  text-align: center;
}
.month-stat.warn { background: rgba(245, 158, 11, 0.08); }
.month-stat.danger { background: rgba(239, 68, 68, 0.08); }
.month-stat.info { background: rgba(59, 130, 246, 0.08); }
.month-stat.accent { background: rgba(27, 109, 255, 0.08); }
.month-stat-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}
.month-stat.warn .month-stat-val { color: #b45309; }
.month-stat.danger .month-stat-val { color: #dc2626; }
.month-stat.info .month-stat-val { color: #1d4ed8; }
.month-stat.accent .month-stat-val { color: var(--accent-dark); }
.month-stat-label {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
.month-remark {
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(245, 158, 11, 0.06);
  border-radius: 8px;
  font-size: 12px;
  color: var(--muted);
}

/* ===== States ===== */
.state {
  text-align: center;
  padding: 24px 12px;
  color: var(--muted);
  font-size: 14px;
}
.state.error { color: #ff4d4f; }
.state.empty { color: #94a3b8; }

/* ===== Animations ===== */
@keyframes riseIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
