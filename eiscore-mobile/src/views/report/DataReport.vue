<template>
  <div class="report-page">
    <div class="header-top">
      <span class="back-btn" @click="$router.back()"><i class="back-icon" /></span>
      <p>数据报表</p>
      <span />
    </div>

    <div class="main">
      <!-- 加载 -->
      <div v-if="pageLoading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">{{ loadingMsg }}</div>
      </div>

      <!-- Hero -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">Data Reports</span>
          <h1>数据报表中心</h1>
          <p>库存总览、出入库流水、盘点记录一目了然。</p>
        </div>
        <div class="hero-actions">
          <button class="action-btn refresh" @click="refreshAll">
            <span class="action-title">刷新数据</span>
            <span class="action-desc">从服务器同步最新数据</span>
          </button>
        </div>
      </section>

      <!-- 总览统计 -->
      <section class="stats-row four">
        <div class="stat-card">
          <div class="stat-label">仓库</div>
          <div class="stat-value">{{ stats.warehouseCount }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">物料种类</div>
          <div class="stat-value">{{ stats.materialCount }}</div>
        </div>
        <div class="stat-card fresh">
          <div class="stat-label">库存总量</div>
          <div class="stat-value">{{ fmtNum(stats.totalQty) }}</div>
        </div>
        <div class="stat-card dark">
          <div class="stat-label">盘点单数</div>
          <div class="stat-value">{{ stats.checkCount }}</div>
        </div>
      </section>

      <!-- 库存分布 -->
      <section class="card-section">
        <div class="section-head">
          <div>
            <h2>库存分布</h2>
            <p>各仓库当前库存总量对比。</p>
          </div>
        </div>
        <div class="bar-chart">
          <div
            v-for="item in stockDistribution"
            :key="item.name"
            class="bar-row"
          >
            <div class="bar-label">{{ item.name }}</div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: item.pct + '%' }"
              />
            </div>
            <div class="bar-value">{{ fmtNum(item.qty) }}</div>
          </div>
          <div v-if="stockDistribution.length === 0" class="state empty">暂无数据</div>
        </div>
      </section>

      <!-- 物料 TOP 排行 -->
      <section class="card-section">
        <div class="section-head">
          <div>
            <h2>物料库存 TOP 10</h2>
            <p>按可用库存数量排序。</p>
          </div>
        </div>
        <div class="rank-list">
          <div
            v-for="(item, idx) in materialTop"
            :key="item.code"
            class="rank-row"
          >
            <span class="rank-num" :class="{ top3: idx < 3 }">{{ idx + 1 }}</span>
            <div class="rank-info">
              <div class="rank-name">{{ item.name }}</div>
              <div class="rank-code">{{ item.code }}</div>
            </div>
            <div class="rank-qty">
              <span class="qty-num">{{ fmtNum(item.qty) }}</span>
              <span class="qty-unit">{{ item.unit || '--' }}</span>
            </div>
          </div>
          <div v-if="materialTop.length === 0" class="state empty">暂无数据</div>
        </div>
      </section>

      <!-- 最近出入库流水 -->
      <section class="card-section">
        <div class="section-head">
          <div>
            <h2>最近出入库</h2>
            <p>最近 20 条库存变动记录。</p>
          </div>
        </div>
        <div class="tx-list">
          <div
            v-for="tx in recentTransactions"
            :key="tx.id"
            class="tx-row"
          >
            <div class="tx-type" :class="getTxClass(tx.transaction_type)">
              {{ getTxShort(tx.transaction_type) }}
            </div>
            <div class="tx-info">
              <div class="tx-no">{{ tx.transaction_no || '--' }}</div>
              <div class="tx-date">{{ fmtDate(tx.transaction_date || tx.created_at) }}</div>
            </div>
            <div class="tx-qty">
              <span :class="getTxClass(tx.transaction_type)">
                {{ getTxSign(tx.transaction_type) }}{{ tx.quantity || 0 }}
              </span>
            </div>
          </div>
          <div v-if="recentTransactions.length === 0" class="state empty">暂无流水记录</div>
        </div>
      </section>

      <!-- 盘点记录 -->
      <section class="card-section">
        <div class="section-head">
          <div>
            <h2>盘点记录</h2>
            <p>最近盘点单列表。</p>
          </div>
        </div>
        <div class="check-list">
          <div
            v-for="ck in recentChecks"
            :key="ck.id"
            class="check-row"
          >
            <div class="check-info">
              <div class="check-no">{{ ck.check_no || '--' }}</div>
              <div class="check-meta">
                <span>{{ ck.check_by || '--' }}</span>
                <span>{{ fmtDate(ck.check_date || ck.created_at) }}</span>
              </div>
            </div>
            <span class="check-status" :class="getStatusClass(ck.status)">{{ ck.status || '--' }}</span>
          </div>
          <div v-if="recentChecks.length === 0" class="state empty">暂无盘点记录</div>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { showToast } from 'vant'
import {
  fetchWarehouses, fetchChildren, fetchInventory,
  fetchRecentTransactions, fetchChecks, fetchAllInventory
} from '@/api/warehouse'

const pageLoading = ref(false)
const loadingMsg = ref('正在加载报表数据...')

const stats = reactive({
  warehouseCount: 0,
  materialCount: 0,
  totalQty: 0,
  checkCount: 0
})

const stockDistribution = ref([])
const materialTop = ref([])
const recentTransactions = ref([])
const recentChecks = ref([])

onMounted(() => loadAll())

async function loadAll() {
  pageLoading.value = true
  loadingMsg.value = '正在加载报表数据...'
  try {
    await Promise.all([
      loadStats(),
      loadTransactions(),
      loadChecks()
    ])
  } catch { /* handled individually */ }
  finally { pageLoading.value = false }
}

async function loadStats() {
  try {
    // 仓库列表
    const whs = await fetchWarehouses()
    const whList = Array.isArray(whs) ? whs : []
    stats.warehouseCount = whList.length

    // 各仓库库存汇总
    const whStocks = []
    const allMaterials = new Map() // code -> { name, code, unit, qty }

    for (const wh of whList) {
      let whQty = 0
      const locs = await fetchChildren(wh.id)
      const locArr = Array.isArray(locs) ? locs : []

      const flat = []
      for (const loc of locArr) {
        if (loc.level === 2) {
          const children = await fetchChildren(loc.id)
          ;(Array.isArray(children) ? children : []).forEach(c => flat.push(c))
        } else {
          flat.push(loc)
        }
      }

      for (const loc of flat) {
        try {
          const inv = await fetchInventory(loc.id)
          ;(Array.isArray(inv) ? inv : []).forEach(m => {
            const qty = Number(m.available_qty || 0)
            whQty += qty
            const existing = allMaterials.get(m.material_code)
            if (existing) {
              existing.qty += qty
            } else {
              allMaterials.set(m.material_code, {
                name: m.material_name || '--',
                code: m.material_code || '--',
                unit: m.unit || '',
                qty
              })
            }
          })
        } catch { /* skip */ }
      }

      whStocks.push({ name: wh.name || wh.code, qty: whQty })
    }

    // 统计
    stats.materialCount = allMaterials.size
    stats.totalQty = [...allMaterials.values()].reduce((s, m) => s + m.qty, 0)

    // 库存分布
    const maxQty = Math.max(...whStocks.map(s => s.qty), 1)
    stockDistribution.value = whStocks.map(s => ({
      ...s,
      pct: Math.round((s.qty / maxQty) * 100)
    }))

    // 物料 TOP 10
    materialTop.value = [...allMaterials.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
  } catch {
    showToast('加载统计数据失败')
  }
}

async function loadTransactions() {
  try {
    const list = await fetchRecentTransactions(20)
    recentTransactions.value = Array.isArray(list) ? list : []
  } catch {
    recentTransactions.value = []
  }
}

async function loadChecks() {
  try {
    const list = await fetchChecks({ limit: 15 })
    recentChecks.value = Array.isArray(list) ? list : []
    stats.checkCount = recentChecks.value.length
  } catch {
    recentChecks.value = []
  }
}

async function refreshAll() {
  await loadAll()
  showToast({ message: '刷新完成', icon: 'success' })
}

/* 辅助 */
function fmtNum(v) {
  if (v == null || v === '') return '0'
  const n = Number(v)
  if (isNaN(n)) return v
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

function fmtDate(d) {
  if (!d) return '--'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function getTxClass(type) {
  if (!type) return ''
  if (type.includes('入库') || type.includes('盘盈')) return 'tx-in'
  if (type.includes('出库') || type.includes('盘亏')) return 'tx-out'
  return ''
}
function getTxShort(type) {
  if (!type) return '?'
  if (type.includes('盘盈')) return '盈'
  if (type.includes('盘亏')) return '亏'
  if (type.includes('入库')) return '入'
  if (type.includes('出库')) return '出'
  return type.slice(0, 1)
}
function getTxSign(type) {
  if (!type) return ''
  if (type.includes('入库') || type.includes('盘盈')) return '+'
  return '-'
}
function getStatusClass(status) {
  if (!status) return ''
  if (status === '已完成') return 'done'
  if (status === '进行中') return 'ing'
  return 'pending'
}
</script>

<style scoped>
.header-top{width:100%;height:44px;background:#007cff;display:flex;justify-content:space-between;align-items:center;padding:0 20px;box-sizing:border-box;font-size:16px;font-weight:400;color:#fff;position:sticky;top:0;z-index:20}
.back-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer}
.back-icon{width:10px;height:10px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg)}

.report-page{min-height:100vh;background:#f5f8f9}
.main{--ink:#1d2433;--muted:#5a6b7c;--line:#e3e9f2;--accent:#1b6dff;--accent-dark:#0e3fa5;--fresh:#21c189;--sunny:#ffb24a;font-family:'Source Han Sans CN','Noto Sans SC','Microsoft YaHei',sans-serif;color:var(--ink);padding:16px;display:flex;flex-direction:column;gap:16px;position:relative;background:radial-gradient(700px 280px at 10% -10%,rgba(27,109,255,.16),transparent 65%),radial-gradient(600px 260px at 100% 20%,rgba(33,193,137,.14),transparent 60%),linear-gradient(140deg,#f9fbff 0%,#f1f6ff 50%,#f6fbf8 100%)}
.main::before,.main::after{content:'';position:absolute;inset:0;pointer-events:none}
.main::before{background:radial-gradient(500px 320px at 90% -10%,rgba(255,178,74,.25),transparent 70%);opacity:.6}
.main::after{background-image:repeating-linear-gradient(120deg,rgba(12,34,64,.03) 0,rgba(12,34,64,.03) 1px,transparent 1px,transparent 64px);opacity:.4}
.main>*{position:relative;z-index:1}

.page-mask{position:fixed;inset:0;background:rgba(247,249,252,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:30;backdrop-filter:blur(6px)}
.spinner{width:42px;height:42px;border-radius:50%;border:3px solid rgba(27,109,255,.2);border-top-color:var(--accent);animation:spin .9s linear infinite}
.mask-text{font-size:13px;color:var(--muted)}

.hero{display:grid;gap:16px;padding:18px;border-radius:18px;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.7);box-shadow:0 18px 40px rgba(20,37,90,.12);animation:riseIn .6s ease both}
.hero-copy h1{margin:8px 0 6px;font-size:22px;letter-spacing:.5px}
.hero-copy p{margin:0;color:var(--muted);font-size:14px}
.hero-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:12px;color:var(--accent-dark);background:rgba(27,109,255,.12);letter-spacing:.4px}
.hero-actions{display:grid;gap:12px}
.action-btn{border:none;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:6px;color:#fff;cursor:pointer;text-align:left;transition:transform .2s ease}
.action-btn.refresh{background:linear-gradient(135deg,#1b6dff 0%,#4b8bff 100%);box-shadow:0 12px 24px rgba(27,109,255,.24)}
.action-btn:active{transform:translateY(1px)}
.action-title{font-size:16px;font-weight:600}
.action-desc{font-size:12px;opacity:.9}

.stats-row{display:grid;gap:12px;grid-template-columns:repeat(2,1fr);animation:riseIn .7s ease both}
.stats-row.four{grid-template-columns:repeat(2,1fr)}
.stat-card{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 8px 20px rgba(20,37,90,.08)}
.stat-card.accent{background:linear-gradient(135deg,#1b6dff 0%,#4b8bff 100%);color:#fff}
.stat-card.fresh{background:linear-gradient(135deg,#15a366 0%,#21c189 100%);color:#fff}
.stat-card.dark{background:linear-gradient(135deg,#1f2d3d 0%,#44556b 100%);color:#fff}
.stat-label{font-size:12px;opacity:.8}
.stat-value{font-size:20px;font-weight:700;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 卡片区块 */
.card-section{background:#fff;border-radius:18px;padding:16px 18px;box-shadow:0 12px 26px rgba(20,37,90,.08);animation:riseIn .5s ease both}
.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.section-head h2{margin:0 0 4px;font-size:17px}
.section-head p{margin:0;font-size:12px;color:var(--muted)}

/* 柱状图 */
.bar-chart{display:flex;flex-direction:column;gap:10px}
.bar-row{display:flex;align-items:center;gap:10px}
.bar-label{font-size:13px;font-weight:600;min-width:72px;text-align:right}
.bar-track{flex:1;height:22px;background:#f0f3f8;border-radius:12px;overflow:hidden;min-width:0}
.bar-fill{height:100%;border-radius:12px;background:linear-gradient(90deg,#1b6dff,#4b8bff);transition:width .6s ease;min-width:4px}
.bar-value{font-size:13px;font-weight:700;min-width:50px;color:var(--ink)}

/* 排行 */
.rank-list{display:flex;flex-direction:column;gap:6px}
.rank-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(227,233,242,.6)}
.rank-row:last-child{border-bottom:none}
.rank-num{width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:#f0f3f8;color:var(--muted);flex-shrink:0}
.rank-num.top3{background:linear-gradient(135deg,#1b6dff,#4b8bff);color:#fff}
.rank-info{flex:1;min-width:0}
.rank-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rank-code{font-size:11px;color:var(--muted);margin-top:2px;font-family:'JetBrains Mono','SFMono-Regular',Consolas,monospace}
.rank-qty{display:flex;align-items:baseline;gap:4px;flex-shrink:0}
.qty-num{font-size:15px;font-weight:700;color:var(--ink)}
.qty-unit{font-size:11px;color:var(--muted)}

/* 流水 */
.tx-list{display:flex;flex-direction:column;gap:6px}
.tx-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(227,233,242,.6)}
.tx-row:last-child{border-bottom:none}
.tx-type{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:#f0f3f8;color:var(--muted);flex-shrink:0}
.tx-type.tx-in{background:rgba(33,193,137,.12);color:#0f7b52}
.tx-type.tx-out{background:rgba(239,68,68,.1);color:#b91c1c}
.tx-info{flex:1;min-width:0}
.tx-no{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tx-date{font-size:11px;color:var(--muted);margin-top:2px}
.tx-qty{font-size:14px;font-weight:700;flex-shrink:0}
.tx-qty .tx-in{color:#0f7b52}
.tx-qty .tx-out{color:#b91c1c}

/* 盘点记录 */
.check-list{display:flex;flex-direction:column;gap:6px}
.check-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px dashed rgba(227,233,242,.6)}
.check-row:last-child{border-bottom:none}
.check-no{font-size:13px;font-weight:600;font-family:'JetBrains Mono','SFMono-Regular',Consolas,monospace}
.check-meta{display:flex;gap:10px;font-size:11px;color:var(--muted);margin-top:3px}
.check-status{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;flex-shrink:0}
.check-status.done{background:rgba(33,193,137,.12);color:#0f7b52}
.check-status.ing{background:rgba(27,109,255,.12);color:var(--accent-dark)}
.check-status.pending{background:rgba(255,178,74,.15);color:#92600a}

.state{text-align:center;padding:12px;color:var(--muted);font-size:13px}
.state.empty{color:#94a3b8}

@keyframes riseIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
