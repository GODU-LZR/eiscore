<template>
  <div class="mobile-home">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span />
      <p>工作台</p>
      <span class="header-action" @click="showSettings = true">
        <i class="gear-icon" />
      </span>
    </div>

    <div class="home-body">
      <!-- Hero 区域 -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">EISCore Mobile</span>
          <h1>{{ greetingText }}，{{ displayName }}</h1>
          <p>轻量移动工作台，掌控仓库与业务动态。</p>
        </div>
        <div class="hero-actions">
          <button class="action-btn scan" @click="handleScan">
            <span class="action-title">扫码入口</span>
            <span class="action-desc">仓库 / 库位 / 物料</span>
          </button>
          <button class="action-btn desktop" @click="goDesktop">
            <span class="action-title">桌面版</span>
            <span class="action-desc">切换到完整桌面端</span>
          </button>
        </div>
      </section>

      <!-- 统计行 -->
      <section class="stats-row">
        <div class="stat-card">
          <div class="stat-label">{{ todayLabel }}</div>
          <div class="stat-value">{{ todayDate }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">当前用户</div>
          <div class="stat-value">{{ displayName }}</div>
        </div>
        <div class="stat-card dark">
          <div class="stat-label">应用模块</div>
          <div class="stat-value">{{ apps.length }}</div>
        </div>
      </section>

      <!-- 应用网格 -->
      <section class="app-section">
        <div class="section-head">
          <div>
            <h2>移动应用</h2>
            <p>点击卡片进入对应功能模块。</p>
          </div>
        </div>

        <div class="app-grid">
          <article
            v-for="(app, index) in apps"
            :key="app.key"
            class="app-card"
            :style="{ animationDelay: `${index * 0.06}s` }"
            @click="openApp(app)"
          >
            <div class="app-top">
              <div class="app-icon" :style="{ background: app.bg }">
                <component :is="app.icon" class="el-icon-svg" />
              </div>
              <div class="app-info">
                <div class="app-name">{{ app.label }}</div>
                <div class="app-desc">{{ app.desc }}</div>
              </div>
            </div>
            <div class="app-bottom">
              <span v-if="app.badge" class="badge coming">{{ app.badge }}</span>
              <span v-else class="badge ready">可用</span>
              <i class="chevron" />
            </div>
          </article>
        </div>
      </section>

      <!-- 快捷操作 -->
      <section class="quick-section">
        <div class="section-head">
          <div>
            <h2>快捷操作</h2>
            <p>常用功能，一键直达。</p>
          </div>
        </div>
        <div class="quick-list">
          <div class="quick-card" @click="openApp(apps.find(a => a.key === 'pda'))">
            <div class="quick-icon scan-bg"><List class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">库存盘点</div>
              <div class="quick-desc">扫码盘点仓库与库位物料</div>
            </div>
            <i class="chevron" />
          </div>
          <div class="quick-card" @click="openApp(apps.find(a => a.key === 'stock'))">
            <div class="quick-icon stock-bg"><Upload class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">扫码出入库</div>
              <div class="quick-desc">快速入库与出库登记</div>
            </div>
            <i class="chevron" />
          </div>
          <div class="quick-card" @click="openApp(apps.find(a => a.key === 'printing'))">
            <div class="quick-icon print-bg"><Printer class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">标签打印</div>
              <div class="quick-desc">打印仓库、库位、物料标签</div>
            </div>
            <i class="chevron" />
          </div>
          <div class="quick-card" @click="openApp(apps.find(a => a.key === 'assistant'))">
            <div class="quick-icon assistant-bg"><ChatDotRound class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">仓储助手</div>
              <div class="quick-desc">AI 智能查询库存与数据分析</div>
            </div>
            <i class="chevron" />
          </div>
          <div class="quick-card" @click="openApp(apps.find(a => a.key === 'enterprise'))">
            <div class="quick-icon enterprise-bg"><TrendCharts class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">经营助手</div>
              <div class="quick-desc">AI 全域经营分析与决策洞察</div>
            </div>
            <i class="chevron" />
          </div>
          <div class="quick-card" @click="openApp(apps.find(a => a.key === 'attendance'))">
            <div class="quick-icon attendance-bg"><Clock class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">考勤打卡</div>
              <div class="quick-desc">查看考勤记录与快速打卡</div>
            </div>
            <i class="chevron" />
          </div>
          <div class="quick-card" @click="goDesktop">
            <div class="quick-icon desktop-bg"><Monitor class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">切换到桌面版</div>
              <div class="quick-desc">使用完整桌面端功能</div>
            </div>
            <i class="chevron" />
          </div>
          <div class="quick-card" @click="handleLogout">
            <div class="quick-icon logout-bg"><SwitchButton class="el-icon-svg" /></div>
            <div class="quick-info">
              <div class="quick-name">退出登录</div>
              <div class="quick-desc">退出当前账号</div>
            </div>
            <i class="chevron" />
          </div>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>

    <!-- 设置弹窗 -->
    <van-action-sheet
      v-model:show="showSettings"
      :actions="settingsActions"
      cancel-text="取消"
      close-on-click-action
      @select="onSettingsSelect"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { getUserInfo, clearAuth } from '@/utils/auth'
import { Box, OfficeBuilding, CircleCheck, DataLine, Bell, User, List, Monitor, SwitchButton, Upload, Printer, ChatDotRound, TrendCharts, Clock } from '@element-plus/icons-vue'

const router = useRouter()
const showSettings = ref(false)

// 用户信息
const userInfo = ref(null)
onMounted(() => { userInfo.value = getUserInfo() })

const displayName = computed(() => {
  const u = userInfo.value
  return u?.full_name || u?.username || '用户'
})

const greetingText = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const todayLabel = computed(() => {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[new Date().getDay()]
})
const todayDate = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

// 应用列表
const apps = [
  {
    key: 'pda',
    label: '库存盘点',
    icon: markRaw(Box),
    bg: 'rgba(245, 158, 11, 0.12)',
    desc: '扫码盘点、冷库离线模式',
    route: '/check',
    badge: ''
  },
  {
    key: 'warehouse',
    label: '仓库查询',
    icon: markRaw(OfficeBuilding),
    bg: 'rgba(34, 197, 94, 0.12)',
    desc: '查看仓库与库位信息',
    route: '/warehouse',
    badge: ''
  },
  {
    key: 'stock',
    label: '扫码出入库',
    icon: markRaw(Upload),
    bg: 'rgba(16, 185, 129, 0.12)',
    desc: '扫码入库、出库登记',
    route: '/stock',
    badge: ''
  },
  {
    key: 'printing',
    label: '标签打印',
    icon: markRaw(Printer),
    bg: 'rgba(99, 102, 241, 0.12)',
    desc: '仓库、库位、物料标签',
    route: '/printing',
    badge: ''
  },
  {
    key: 'assistant',
    label: '仓储助手',
    icon: markRaw(ChatDotRound),
    bg: 'rgba(27, 109, 255, 0.12)',
    desc: 'AI 智能查询与图表分析',
    route: '/assistant',
    badge: ''
  },
  {
    key: 'enterprise',
    label: '经营助手',
    icon: markRaw(TrendCharts),
    bg: 'rgba(108, 59, 255, 0.12)',
    desc: 'AI 全域经营分析与洞察',
    route: '/enterprise',
    badge: ''
  },
  {
    key: 'attendance',
    label: '考勤打卡',
    icon: markRaw(Clock),
    bg: 'rgba(34, 197, 94, 0.12)',
    desc: '查看考勤记录、快速打卡',
    route: '/attendance',
    badge: ''
  },
  {
    key: 'approve',
    label: '审批中心',
    icon: markRaw(CircleCheck),
    bg: 'rgba(139, 92, 246, 0.12)',
    desc: '采购、领料等审批流转',
    route: null,
    badge: '即将上线'
  },
  {
    key: 'report',
    label: '数据报表',
    icon: markRaw(DataLine),
    bg: 'rgba(6, 182, 212, 0.12)',
    desc: '库存、出入库数据分析',
    route: '/report',
    badge: ''
  },
  {
    key: 'notice',
    label: '通知公告',
    icon: markRaw(Bell),
    bg: 'rgba(239, 68, 68, 0.12)',
    desc: '系统消息与公告通知',
    route: null,
    badge: '即将上线'
  },
  {
    key: 'contacts',
    label: '通讯录',
    icon: markRaw(User),
    bg: 'rgba(59, 130, 246, 0.12)',
    desc: '企业通讯录与组织架构',
    route: null,
    badge: '即将上线'
  }
]

function openApp(app) {
  if (!app) return
  if (app.route) {
    router.push(app.route)
  } else {
    showToast({ message: `${app.label} 即将上线`, icon: 'info-o' })
  }
}

function handleScan() { router.push('/check') }
function goDesktop() { window.location.href = '/' }

async function handleLogout() {
  try {
    await showConfirmDialog({ title: '确认退出', message: '退出后需重新登录，是否继续？' })
    clearAuth()
    router.replace('/login')
  } catch { /* 取消 */ }
}

// 设置菜单
const settingsActions = [
  { name: '个人信息', value: 'profile' },
  { name: '切换到桌面版', value: 'desktop' },
  { name: '退出登录', value: 'logout', color: '#ee0a24' }
]

async function onSettingsSelect(action) {
  if (action.value === 'logout') { await handleLogout() }
  else if (action.value === 'desktop') { goDesktop() }
  else if (action.value === 'profile') { showToast('个人信息功能即将上线') }
}
</script>

<style scoped>
/* ===== Header (对齐盘点页 CommonHeader) ===== */
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
.header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
}
.gear-icon {
  width: 18px;
  height: 18px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  display: inline-block;
  position: relative;
}
.gear-icon::after {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* ===== Main Body (对齐盘点页 .home) ===== */
.mobile-home {
  min-height: 100vh;
  background: #f5f8f9;
}
.home-body {
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
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  background:
    radial-gradient(700px 280px at 10% -10%, rgba(27, 109, 255, 0.16), transparent 65%),
    radial-gradient(600px 260px at 100% 20%, rgba(33, 193, 137, 0.14), transparent 60%),
    linear-gradient(140deg, #f9fbff 0%, #f1f6ff 50%, #f6fbf8 100%);
}
.home-body::before,
.home-body::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.home-body::before {
  background: radial-gradient(500px 320px at 90% -10%, rgba(255, 178, 74, 0.25), transparent 70%);
  opacity: 0.6;
}
.home-body::after {
  background-image: repeating-linear-gradient(120deg, rgba(12, 34, 64, 0.03) 0, rgba(12, 34, 64, 0.03) 1px, transparent 1px, transparent 64px);
  opacity: 0.4;
}
.home-body > * {
  position: relative;
  z-index: 1;
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
  grid-template-columns: 1fr 1fr;
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
.action-btn.scan {
  background: linear-gradient(135deg, #1b6dff 0%, #4b8bff 100%);
  box-shadow: 0 12px 24px rgba(27, 109, 255, 0.24);
}
.action-btn.desktop {
  background: linear-gradient(135deg, #1f2d3d 0%, #44556b 100%);
  box-shadow: 0 12px 24px rgba(31, 45, 61, 0.24);
}
.action-btn:active {
  transform: translateY(1px);
}
.action-title {
  font-size: 16px;
  font-weight: 600;
}
.action-desc {
  font-size: 12px;
  opacity: 0.9;
}

/* ===== Stats Row ===== */
.stats-row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, 1fr);
  animation: riseIn 0.7s ease both;
}
.stat-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 8px 20px rgba(20, 37, 90, 0.08);
}
.stat-card.accent {
  background: linear-gradient(135deg, #1b6dff 0%, #4b8bff 100%);
  color: #ffffff;
}
.stat-card.dark {
  background: linear-gradient(135deg, #1f2d3d 0%, #44556b 100%);
  color: #ffffff;
}
.stat-label {
  font-size: 12px;
  opacity: 0.8;
}
.stat-value {
  font-size: 16px;
  font-weight: 700;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Section Head ===== */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
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

/* ===== App Grid ===== */
.app-grid {
  display: grid;
  gap: 12px;
}
.app-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(227, 233, 242, 0.8);
  box-shadow: 0 10px 24px rgba(20, 37, 90, 0.07);
  padding: 14px 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  animation: riseIn 0.5s ease both;
}
.app-card:active {
  transform: translateY(1px);
}
.app-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.el-icon-svg {
  width: 24px;
  height: 24px;
  color: inherit;
}
.app-info {
  flex: 1;
  min-width: 0;
}
.app-name {
  font-size: 15px;
  font-weight: 600;
}
.app-desc {
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
}
.app-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(227, 233, 242, 0.7);
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.badge.ready {
  background: rgba(33, 193, 137, 0.12);
  color: #0f7b52;
}
.badge.coming {
  background: rgba(245, 158, 11, 0.12);
  color: #92600a;
}
.chevron {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(-45deg);
  display: inline-block;
}

/* ===== Quick Section ===== */
.quick-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.quick-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(227, 233, 242, 0.8);
  box-shadow: 0 8px 20px rgba(20, 37, 90, 0.06);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.15s ease;
  animation: riseIn 0.5s ease both;
}
.quick-card:active {
  transform: translateY(1px);
}
.quick-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.scan-bg { background: rgba(27, 109, 255, 0.1); }
.stock-bg { background: rgba(16, 185, 129, 0.1); }
.print-bg { background: rgba(99, 102, 241, 0.1); }
.assistant-bg { background: rgba(27, 109, 255, 0.1); }
.enterprise-bg { background: rgba(108, 59, 255, 0.1); }
.attendance-bg { background: rgba(34, 197, 94, 0.1); }
.desktop-bg { background: rgba(31, 45, 61, 0.08); }
.logout-bg { background: rgba(239, 68, 68, 0.1); }
.quick-info {
  flex: 1;
  min-width: 0;
}
.quick-name {
  font-size: 14px;
  font-weight: 600;
}
.quick-desc {
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
}

/* ===== Animations ===== */
@keyframes riseIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
