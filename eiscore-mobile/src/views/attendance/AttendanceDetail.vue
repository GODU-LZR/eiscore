<template>
  <div class="overview">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>考勤详情</p>
      <span />
    </div>

    <div class="home">
      <!-- 全屏加载遮罩 -->
      <div v-if="pageLoading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">正在加载数据...</div>
      </div>

      <!-- 员工信息 Hero -->
      <section class="hero" v-if="employeeInfo">
        <div class="hero-copy">
          <span class="hero-badge">{{ employeeInfo.dept_name || '未分配' }}</span>
          <h1>{{ employeeInfo.employee_name || '--' }}</h1>
          <p>工号：{{ employeeInfo.employee_no || '--' }}</p>
        </div>
        <div class="month-nav">
          <button class="nav-btn" @click="prevMonth">◀</button>
          <span class="nav-label">{{ displayMonth }}</span>
          <button class="nav-btn" @click="nextMonth">▶</button>
        </div>
      </section>

      <!-- 月度统计 -->
      <section class="stats-row" v-if="monthSummary">
        <div class="stat-card">
          <div class="stat-label">出勤</div>
          <div class="stat-value">{{ monthSummary.totalDays }}</div>
        </div>
        <div class="stat-card warn">
          <div class="stat-label">迟到</div>
          <div class="stat-value">{{ monthSummary.lateDays }}</div>
        </div>
        <div class="stat-card warn">
          <div class="stat-label">早退</div>
          <div class="stat-value">{{ monthSummary.earlyDays }}</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">请假</div>
          <div class="stat-value">{{ monthSummary.leaveDays }}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">缺勤</div>
          <div class="stat-value">{{ monthSummary.absentDays }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">加班(h)</div>
          <div class="stat-value">{{ monthSummary.overtimeHours }}</div>
        </div>
      </section>

      <!-- 日考勤列表 -->
      <section class="record-section">
        <div class="section-head">
          <div>
            <h2>日明细</h2>
            <p>{{ displayMonth }} 逐日考勤记录</p>
          </div>
        </div>

        <div v-if="loading" class="state">正在加载...</div>
        <div v-else-if="errorMsg" class="state error">{{ errorMsg }}</div>
        <div v-else-if="records.length === 0" class="state empty">暂无考勤记录</div>

        <div v-else class="record-grid">
          <article
            v-for="(rec, index) in records"
            :key="rec.id"
            class="day-card"
            :style="{ animationDelay: `${index * 0.03}s` }"
          >
            <div class="day-left">
              <div class="day-date">
                <span class="day-num">{{ dayNum(rec.att_date) }}</span>
                <span class="day-week">{{ dayWeek(rec.att_date) }}</span>
              </div>
            </div>
            <div class="day-center">
              <div class="day-punches" v-if="rec.punch_count > 0">
                <span class="punch-time first">{{ fmtTime(rec.first_punch) }}</span>
                <span class="punch-arrow">→</span>
                <span class="punch-time last">{{ rec.punch_count > 1 ? fmtTime(rec.last_punch) : '--' }}</span>
              </div>
              <div v-else class="day-punches empty-punch">未打卡</div>
              <div class="day-shift" v-if="rec.shift_name">{{ rec.shift_name }}</div>
            </div>
            <div class="day-right">
              <div class="day-flags">
                <span v-if="rec.late_flag" class="flag warn">迟</span>
                <span v-if="rec.early_flag" class="flag warn">早</span>
                <span v-if="rec.leave_flag" class="flag info">假</span>
                <span v-if="rec.absent_flag" class="flag danger">缺</span>
                <span v-if="rec.overtime_minutes > 0" class="flag accent">加{{ Math.round(rec.overtime_minutes / 60 * 10) / 10 }}h</span>
                <span v-if="!rec.late_flag && !rec.early_flag && !rec.leave_flag && !rec.absent_flag && rec.punch_count > 0" class="flag success">✓</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  fetchDailyAttendance,
  formatDate,
  formatTime
} from '@/api/attendance'
import { getToken } from '@/utils/auth'

const route = useRoute()
const employeeId = computed(() => route.params.id)

const pageLoading = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const currentMonth = ref(new Date())
const records = ref([])
const employeeInfo = ref(null)

const displayMonth = computed(() => {
  const d = currentMonth.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const monthSummary = computed(() => {
  if (!records.value.length) return null
  const totalDays = records.value.length
  const lateDays = records.value.filter(r => r.late_flag).length
  const earlyDays = records.value.filter(r => r.early_flag).length
  const leaveDays = records.value.filter(r => r.leave_flag).length
  const absentDays = records.value.filter(r => r.absent_flag).length
  const overtimeMin = records.value.reduce((s, r) => s + (r.overtime_minutes || 0), 0)
  return {
    totalDays,
    lateDays,
    earlyDays,
    leaveDays,
    absentDays,
    overtimeHours: (overtimeMin / 60).toFixed(1)
  }
})

onMounted(() => { loadMonth() })

function prevMonth() {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() - 1)
  currentMonth.value = d
  loadMonth()
}

function nextMonth() {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() + 1)
  currentMonth.value = d
  loadMonth()
}

async function loadMonth() {
  loading.value = true
  errorMsg.value = ''
  try {
    // 按月查全部日数据，然后前端过滤该员工
    const d = currentMonth.value
    const y = d.getFullYear()
    const m = d.getMonth() + 1

    // 构造日期范围
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // 直接用 fetch 查指定员工的日考勤
    const API_BASE = '/api'
    const token = getToken()
    const params = new URLSearchParams({
      employee_id: `eq.${employeeId.value}`,
      'att_date': `gte.${startDate}`,
      order: 'att_date.asc'
    })
    // 添加 att_date 上限
    params.append('att_date', `lte.${endDate}`)

    const res = await fetch(`${API_BASE}/v_attendance_daily?${params.toString()}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Accept-Profile': 'hr',
        'Content-Profile': 'hr'
      }
    })
    if (!res.ok) throw new Error(`请求失败 (${res.status})`)
    const data = await res.json()
    records.value = Array.isArray(data) ? data : []

    // 提取员工信息
    if (records.value.length > 0) {
      const first = records.value[0]
      employeeInfo.value = {
        employee_name: first.employee_name,
        employee_no: first.employee_no,
        dept_name: first.dept_name
      }
    }
  } catch (e) {
    errorMsg.value = `加载失败：${e.message}`
  } finally {
    loading.value = false
  }
}

function dayNum(dateStr) {
  const d = new Date(dateStr)
  return d.getDate()
}

function dayWeek(dateStr) {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(dateStr)
  return `周${days[d.getDay()]}`
}

function fmtTime(val) { return formatTime(val) }
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
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  color: var(--ink);
  position: relative;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background:
    radial-gradient(700px 280px at 10% -10%, rgba(27, 109, 255, 0.16), transparent 65%),
    radial-gradient(600px 260px at 100% 20%, rgba(33, 193, 137, 0.14), transparent 60%),
    linear-gradient(140deg, #f9fbff 0%, #f1f6ff 50%, #f6fbf8 100%);
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

/* ===== Loading ===== */
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
}

/* ===== Hero ===== */
.hero {
  display: grid;
  gap: 14px;
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
}
.hero-copy p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.hero-badge {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--accent-dark);
  background: rgba(27, 109, 255, 0.12);
}
.month-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.nav-btn {
  border: 1px solid var(--line);
  background: #f7f9fc;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 14px;
  cursor: pointer;
  color: var(--ink);
}
.nav-label {
  font-size: 16px;
  font-weight: 600;
  min-width: 100px;
  text-align: center;
}

/* ===== Stats Row ===== */
.stats-row {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, 1fr);
  animation: riseIn 0.7s ease both;
}
.stat-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 10px 8px;
  box-shadow: 0 6px 16px rgba(20, 37, 90, 0.06);
  text-align: center;
}
.stat-card.warn { background: rgba(245, 158, 11, 0.08); }
.stat-card.danger { background: rgba(239, 68, 68, 0.08); }
.stat-card.info { background: rgba(59, 130, 246, 0.08); }
.stat-card.accent { background: rgba(27, 109, 255, 0.08); }
.stat-label {
  font-size: 11px;
  color: var(--muted);
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  margin-top: 2px;
}
.stat-card.warn .stat-value { color: #b45309; }
.stat-card.danger .stat-value { color: #dc2626; }
.stat-card.info .stat-value { color: #1d4ed8; }
.stat-card.accent .stat-value { color: var(--accent-dark); }

/* ===== Record Section ===== */
.record-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.record-grid {
  display: grid;
  gap: 8px;
}

/* ===== Day Card ===== */
.day-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid rgba(227, 233, 242, 0.8);
  box-shadow: 0 6px 16px rgba(20, 37, 90, 0.05);
  display: flex;
  align-items: center;
  padding: 12px 14px;
  gap: 12px;
  animation: riseIn 0.4s ease both;
}
.day-left {
  flex-shrink: 0;
}
.day-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.day-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
}
.day-week {
  font-size: 11px;
  color: var(--muted);
}
.day-center {
  flex: 1;
  min-width: 0;
}
.day-punches {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.day-punches.empty-punch {
  color: #94a3b8;
  font-size: 13px;
}
.punch-time {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-weight: 600;
}
.punch-time.first { color: #21c189; }
.punch-time.last { color: var(--accent); }
.punch-arrow {
  color: var(--muted);
  font-size: 12px;
}
.day-shift {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
.day-right {
  flex-shrink: 0;
}
.day-flags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  min-width: 22px;
}
.flag.warn { background: rgba(245, 158, 11, 0.12); color: #92600a; }
.flag.danger { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.flag.info { background: rgba(59, 130, 246, 0.12); color: #1d4ed8; }
.flag.accent { background: rgba(27, 109, 255, 0.1); color: var(--accent-dark); }
.flag.success { background: rgba(33, 193, 137, 0.12); color: #0f7b52; }

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
