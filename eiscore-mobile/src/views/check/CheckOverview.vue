<template>
  <div class="overview">
    <!-- 顶部导航 (对齐独立项目 CommonHeader) -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>库存盘点中枢</p>
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
          <span class="hero-badge">Inventory Hub</span>
          <h1>库存盘点中枢</h1>
          <p>扫码、查询，快速掌控仓库与库位动态。</p>
        </div>
        <div class="hero-actions">
          <button class="action-btn scan" @click="handleScan">
            <span class="action-title">扫码盘点</span>
            <span class="action-desc">仓库 / 库位 / 物料</span>
          </button>
        </div>
        <div class="mode-card">
          <div class="mode-info">
            <div class="mode-title">盘点模式</div>
            <div class="mode-desc">
              {{ coldMode ? '冷库离线盘点中，数据将保存在本地。' : '在线模式，数据实时同步更新。' }}
            </div>
            <div class="mode-meta">
              <span v-if="cacheMeta.updatedAt">缓存更新 {{ formatTime(cacheMeta.updatedAt) }}</span>
              <span v-if="pendingCount">待提交 {{ pendingCount }}</span>
            </div>
          </div>
          <button class="mode-toggle" :class="{ cold: coldMode }" @click="toggleColdMode">
            <span class="mode-label">{{ coldMode ? '冷库模式' : '正常模式' }}</span>
            <span class="mode-hint">{{ coldMode ? '离线盘点' : '在线可同步' }}</span>
          </button>
        </div>
      </section>

      <!-- 搜索卡片 -->
      <section class="search-card">
        <div class="search-row">
          <input
            v-model.trim="searchText"
            type="text"
            placeholder="输入仓库 / 库位 / 物料编码或名称"
            @keyup.enter="handleSearch"
          />
          <button class="search-btn" @click="handleSearch">查询</button>
        </div>
        <div class="search-meta">
          <span class="meta-pill">WH- / LOC- / MAT-</span>
          <button v-if="searchText" class="clear-btn" @click="clearSearch">清空</button>
          <div v-if="lastScan.code" class="last-scan">
            <span class="dot" />
            最近扫码：{{ lastScan.typeLabel }} {{ lastScan.code }}
          </div>
        </div>
      </section>

      <!-- 统计行 -->
      <section class="stats-row">
        <div class="stat-card">
          <div class="stat-label">仓库数量</div>
          <div class="stat-value">{{ warehouses.length }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">库位数量</div>
          <div class="stat-value">{{ locationTotal }}</div>
        </div>
        <div class="stat-card dark">
          <div class="stat-label">物料种类</div>
          <div class="stat-value">{{ materialTotal }}</div>
        </div>
      </section>

      <!-- 仓库总览 -->
      <section class="warehouse-section">
        <div class="section-head">
          <div>
            <h2>仓库总览</h2>
            <p>点击仓库卡片，展开查看库位与物料。</p>
          </div>
          <button class="ghost-btn" @click="refreshAll">刷新</button>
        </div>

        <div v-if="loading" class="state">正在加载仓库...</div>
        <div v-else-if="errorMsg" class="state error">{{ errorMsg }}</div>
        <div v-else-if="filteredWarehouses.length === 0" class="state empty">暂无匹配仓库</div>

        <div v-else class="warehouse-grid">
          <article
            v-for="(wh, index) in filteredWarehouses"
            :key="wh.id"
            class="warehouse-card"
            :class="{ expanded: wh.expanded }"
            :style="{ animationDelay: `${index * 0.06}s` }"
          >
            <div class="warehouse-top" @click="toggleWarehouse(wh)">
              <div class="warehouse-info">
                <div class="warehouse-name">{{ wh.name || '未命名仓库' }}</div>
                <div class="warehouse-code">{{ wh.code || '--' }}</div>
              </div>
              <div class="warehouse-meta">
                <div class="meta-chip">
                  <span>库位</span>
                  <strong>{{ wh.locationCount }}</strong>
                </div>
                <div class="meta-chip">
                  <span>物料种类</span>
                  <strong>{{ wh.materialCount }}</strong>
                </div>
                <button class="link-btn" @click.stop="goWarehouse(wh.code)">详情</button>
                <div class="toggle">
                  <span>{{ wh.expanded ? '收起' : '展开' }}</span>
                  <i class="chevron" :class="{ open: wh.expanded }" />
                </div>
              </div>
            </div>

            <transition name="panel">
              <div v-show="wh.expanded" class="warehouse-body">
                <div v-if="wh.loading" class="state">加载库位...</div>
                <div v-else-if="wh.error" class="state error">{{ wh.error }}</div>
                <div v-else-if="getDisplayLocations(wh).length === 0" class="state empty">暂无库位信息</div>
                <div v-else class="location-list">
                  <div
                    v-for="loc in getDisplayLocations(wh)"
                    :key="loc.id"
                    class="location-card"
                  >
                    <div class="location-head" @click="toggleLocation(loc)">
                      <div>
                        <div class="location-name">{{ loc.name || '未命名库位' }}</div>
                        <div class="location-code">{{ loc.code || '--' }}</div>
                      </div>
                      <div class="location-meta">
                        <span>物料种类 {{ (loc.materials || []).length }}</span>
                        <button class="mini-btn" @click.stop="goLocation(loc.code)">盘点</button>
                      </div>
                    </div>
                    <transition name="panel">
                      <div v-show="loc.expanded" class="material-list">
                        <div
                          v-for="mat in getDisplayMaterials(loc)"
                          :key="mat.material_id"
                          class="material-row"
                        >
                          <div class="material-info">
                            <div class="material-name">{{ mat.material_name || '--' }}</div>
                            <div class="material-code">{{ mat.material_code || '--' }}</div>
                          </div>
                          <div class="material-meta">
                            <span>{{ fmtQty(mat.available_qty) }} {{ mat.unit || '--' }}</span>
                            <button class="text-btn" @click.stop="goMaterial(mat.material_id)">详情</button>
                          </div>
                        </div>
                        <div v-if="getDisplayMaterials(loc).length === 0" class="state empty">当前库位暂无物料</div>
                      </div>
                    </transition>
                  </div>
                </div>
              </div>
            </transition>
          </article>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import {
  fetchWarehouses, fetchLocationsByWarehouse,
  fetchInventoryByLocation
} from '@/api/check'
import {
  getCheckCache, setCheckCache,
  getColdMode, setColdMode as setColdModeFlag,
  getPendingChecks, clearPendingChecks
} from '@/utils/check-cache'

const router = useRouter()

const pageLoading = ref(false)
const loadingMessage = ref('')
const searchText = ref('')
const activeSearch = ref('')
const warehouses = ref([])
const loading = ref(false)
const errorMsg = ref('')
const coldMode = ref(getColdMode())
const pendingCount = ref(0)
const cacheMeta = reactive({ updatedAt: 0, complete: false })
const lastScan = reactive({ code: '', type: 'unknown', typeLabel: '' })

/* ----------- computed ----------- */
const keyword = computed(() => (activeSearch.value || '').toLowerCase())

const locationTotal = computed(() =>
  warehouses.value.reduce((s, w) => s + (w.locationCount || 0), 0)
)

const materialTotal = computed(() => {
  const codes = new Set()
  warehouses.value.forEach(wh =>
    (wh.locations || []).forEach(loc =>
      (loc.materials || []).forEach(m => { if (m.material_code) codes.add(m.material_code) })
    )
  )
  return codes.size || warehouses.value.reduce((s, w) => s + (w.materialCount || 0), 0)
})

const filteredWarehouses = computed(() => {
  if (!keyword.value) return warehouses.value
  return warehouses.value.filter(wh => {
    if (match(wh.name, keyword.value) || match(wh.code, keyword.value)) return true
    return (wh.locations || []).some(loc =>
      match(loc.name, keyword.value) || match(loc.code, keyword.value) ||
      (loc.materials || []).some(m =>
        match(m.material_name, keyword.value) || match(m.material_code, keyword.value)
      )
    )
  })
})

/* ----------- lifecycle ----------- */
onMounted(() => {
  refreshPending()
  const cached = getCheckCache()
  if (cached) {
    applyCache(cached)
    if (!coldMode.value) loadAll(true)
  } else {
    if (coldMode.value) { errorMsg.value = '冷库模式请先缓存数据'; return }
    loadAll(true)
  }
})

onActivated(() => {
  coldMode.value = getColdMode()
  refreshPending()
})

/* ----------- helpers ----------- */
const match = (val, kw) => val && String(val).toLowerCase().includes(kw)
function refreshPending() { pendingCount.value = getPendingChecks().length }

function applyCache(cache) {
  cacheMeta.updatedAt = cache.updatedAt || 0
  cacheMeta.complete = Boolean(cache.meta?.complete)
  warehouses.value = (cache.warehouses || []).map(w => ({
    ...w, expanded: false, loading: false, error: '',
    locations: (w.locations || []).map(l => ({ ...l, expanded: false }))
  }))
}

async function loadAll(complete = false) {
  loading.value = true
  setPageLoading('正在加载仓库数据...')
  errorMsg.value = ''
  try {
    const list = await fetchWarehouses()
    const whs = (Array.isArray(list) ? list : []).map(w => ({
      id: w.id, code: w.code, name: w.name,
      locationCount: 0, materialCount: 0,
      locations: [], expanded: false, loaded: false, loading: false, error: ''
    }))
    warehouses.value = whs
    if (complete) {
      for (const wh of whs) await loadWarehouseLocations(wh, true)
      persistCache(true)
    }
  } catch {
    errorMsg.value = '加载仓库列表失败'
  } finally {
    loading.value = false
    clearPageLoading()
  }
}

async function loadWarehouseLocations(wh, silent = false) {
  if (!silent) wh.loading = true
  wh.error = ''
  try {
    const locs = await fetchLocationsByWarehouse(wh.id)
    const locArr = (Array.isArray(locs) ? locs : []).map(l => ({
      id: l.id, code: l.code, name: l.name, level: l.level,
      materials: [], expanded: false, loaded: false
    }))
    const flattened = []
    for (const loc of locArr) {
      if (loc.level === 2) {
        const children = await fetchLocationsByWarehouse(loc.id)
        ;(Array.isArray(children) ? children : []).forEach(c => {
          flattened.push({
            id: c.id, code: c.code, name: `${loc.name} / ${c.name}`, level: c.level,
            materials: [], expanded: false, loaded: false
          })
        })
      } else {
        flattened.push(loc)
      }
    }
    for (const loc of flattened) {
      try {
        const inv = await fetchInventoryByLocation(loc.id)
        loc.materials = Array.isArray(inv) ? inv : []
        loc.loaded = true
      } catch { loc.materials = [] }
    }
    wh.locations = flattened
    wh.locationCount = flattened.length
    wh.materialCount = new Set(
      flattened.flatMap(l => (l.materials || []).map(m => m.material_code)).filter(Boolean)
    ).size
    wh.loaded = true
  } catch {
    wh.error = '加载库位失败'
  } finally {
    if (!silent) wh.loading = false
  }
}

function persistCache(complete) {
  const payload = {
    warehouses: warehouses.value.map(w => ({
      id: w.id, code: w.code, name: w.name,
      locationCount: w.locationCount, materialCount: w.materialCount,
      locations: (w.locations || []).map(l => ({
        id: l.id, code: l.code, name: l.name, level: l.level,
        materials: (l.materials || []).map(m => ({
          material_id: m.material_id, material_code: m.material_code,
          material_name: m.material_name, available_qty: m.available_qty,
          batch_no: m.batch_no, unit: m.unit, warehouse_id: m.warehouse_id,
          warehouse_code: m.warehouse_code, batch_id: m.batch_id
        }))
      }))
    })),
    meta: { complete: Boolean(complete) }
  }
  const c = setCheckCache(payload)
  cacheMeta.updatedAt = c.updatedAt
  cacheMeta.complete = Boolean(complete)
}

function setPageLoading(msg) { loadingMessage.value = msg || ''; pageLoading.value = true }
function clearPageLoading() { pageLoading.value = false; loadingMessage.value = '' }

async function refreshAll() {
  setPageLoading('正在刷新仓库数据...')
  await loadAll(true)
  showToast({ message: '刷新完成', icon: 'success' })
}

function toggleWarehouse(wh) {
  wh.expanded = !wh.expanded
  if (wh.expanded && !wh.loaded && !coldMode.value) {
    loadWarehouseLocations(wh)
  }
}
function toggleLocation(loc) { loc.expanded = !loc.expanded }

function getDisplayLocations(wh) {
  if (!keyword.value) return wh.locations || []
  return (wh.locations || []).filter(l =>
    match(l.name, keyword.value) || match(l.code, keyword.value) ||
    (l.materials || []).some(m =>
      match(m.material_name, keyword.value) || match(m.material_code, keyword.value)
    )
  )
}
function getDisplayMaterials(loc) {
  if (!keyword.value) return loc.materials || []
  return (loc.materials || []).filter(m =>
    match(m.material_name, keyword.value) || match(m.material_code, keyword.value)
  )
}

/* ----------- 冷库模式 ----------- */
async function toggleColdMode() {
  if (coldMode.value) {
    const pending = getPendingChecks()
    if (pending.length) {
      try {
        await showConfirmDialog({
          title: '冷库盘点',
          message: `检测到 ${pending.length} 条盘点数据未提交，退出将丢失，确定？`
        })
      } catch { return }
    }
    coldMode.value = false
    setColdModeFlag(false)
    showToast({ message: '已退出冷库模式', icon: 'success' })
    loadAll(true)
  } else {
    try {
      await showConfirmDialog({
        title: '冷库盘点',
        message: '进入冷库模式前请在网络良好的环境缓存全部仓库、库位与物料信息，是否开始缓存？'
      })
    } catch { return }
    setPageLoading('正在缓存冷库数据...')
    await loadAll(true)
    coldMode.value = true
    setColdModeFlag(true)
    clearPageLoading()
    showToast({ message: '冷库模式已开启', icon: 'success' })
  }
}

/* ----------- 扫码 & 搜索 ----------- */
function handleScan() {
  const code = prompt('请输入或粘贴二维码内容')
  if (!code) return
  routeByCode(code.trim())
}

function routeByCode(raw) {
  const parsed = parseCode(raw)
  lastScan.code = parsed.raw
  lastScan.type = parsed.type
  lastScan.typeLabel = parsed.typeLabel

  if (parsed.type === 'warehouse') { goWarehouse(raw); return }
  if (parsed.type === 'location') { goLocation(raw); return }
  if (parsed.type === 'material') {
    const found = findMaterialByCode(raw)
    if (found) { goMaterial(found.material_id); return }
  }
  searchText.value = raw
  activeSearch.value = raw
}

function parseCode(rawCode) {
  const raw = (rawCode || '').trim()
  const upper = raw.toUpperCase()
  if (upper.startsWith('WH-') || upper.startsWith('WH_')) return { raw, type: 'warehouse', typeLabel: '仓库' }
  if (upper.startsWith('LOC-') || upper.startsWith('LOC_')) return { raw, type: 'location', typeLabel: '库位' }
  if (upper.startsWith('MAT-') || upper.startsWith('MAT_')) return { raw, type: 'material', typeLabel: '物料' }
  return { raw, type: 'unknown', typeLabel: '未知' }
}

function findMaterialByCode(code) {
  const target = code.toUpperCase()
  for (const wh of warehouses.value) {
    for (const loc of (wh.locations || [])) {
      const m = (loc.materials || []).find(i => String(i.material_code).toUpperCase() === target)
      if (m) return m
    }
  }
  return null
}

function handleSearch() {
  if (!searchText.value) { showToast('请输入查询内容'); return }
  activeSearch.value = searchText.value
  if (coldMode.value && !cacheMeta.complete) showToast('冷库模式请先缓存完整数据')
}
function clearSearch() { searchText.value = ''; activeSearch.value = '' }

/* ----------- 导航 ----------- */
function goWarehouse(code) { router.push(`/check/warehouse/${code}`) }
function goLocation(code) { router.push(`/check/location/${code}`) }
function goMaterial(id) { router.push(`/check/material/${id}`) }

function fmtQty(v) { return v == null || v === '' ? '--' : v }
function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '--'
  const y = d.getFullYear()
  const mo = `${d.getMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getDate()}`.padStart(2, '0')
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mm = `${d.getMinutes()}`.padStart(2, '0')
  return `${y}-${mo}-${dd} ${hh}:${mm}`
}
</script>

<style scoped>
/* ===== Header (对齐独立项目 CommonHeader) ===== */
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

/* ===== Main Container (对齐独立项目 overview .home) ===== */
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
.action-btn.scan {
  background: linear-gradient(135deg, #1b6dff 0%, #4b8bff 100%);
  box-shadow: 0 12px 24px rgba(27, 109, 255, 0.24);
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
.mode-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--accent-dark);
}
.mode-toggle {
  border: none;
  border-radius: 14px;
  padding: 10px 12px;
  min-width: 110px;
  background: #e8eef7;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mode-toggle.cold {
  background: linear-gradient(135deg, #0b3160 0%, #0f6b8f 100%);
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

/* ===== Search Card ===== */
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
.search-row {
  display: flex;
  gap: 10px;
  box-sizing: border-box;
  overflow: hidden;
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
.search-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
}
.meta-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(27, 109, 255, 0.1);
  color: var(--accent-dark);
}
.clear-btn {
  border: none;
  background: #f2f5f9;
  color: var(--muted);
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.last-scan {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-dark);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-block;
}

/* ===== Stats Row ===== */
.stats-row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, 1fr);
  animation: riseIn 0.8s ease both;
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
  font-size: 20px;
  font-weight: 700;
  margin-top: 6px;
}

/* ===== Warehouse Section ===== */
.warehouse-section {
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
.warehouse-grid {
  display: grid;
  gap: 14px;
}

/* ===== Warehouse Card ===== */
.warehouse-card {
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(227, 233, 242, 0.8);
  box-shadow: 0 12px 26px rgba(20, 37, 90, 0.08);
  overflow: hidden;
  animation: riseIn 0.5s ease both;
}
.warehouse-top {
  padding: 14px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.warehouse-info {
  flex: 1 1 140px;
  min-width: 120px;
}
.warehouse-name {
  font-size: 16px;
  font-weight: 600;
}
.warehouse-code {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.warehouse-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
}
.meta-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f3f6fb;
  padding: 4px 10px;
  border-radius: 999px;
  color: var(--ink);
}
.link-btn {
  border: none;
  background: #e9f0ff;
  color: var(--accent);
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.chevron {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  display: inline-block;
}
.chevron.open {
  transform: rotate(-135deg);
}

/* ===== Warehouse Body ===== */
.warehouse-body {
  border-top: 1px solid rgba(227, 233, 242, 0.6);
  padding: 10px 12px 14px;
  background: #fbfcff;
}
.location-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.location-card {
  border: 1px solid rgba(227, 233, 242, 0.8);
  border-radius: 14px;
  background: #ffffff;
  overflow: hidden;
}
.location-head {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}
.location-name {
  font-size: 14px;
  font-weight: 600;
}
.location-code {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.location-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}
.mini-btn {
  border: none;
  background: rgba(27, 109, 255, 0.12);
  color: var(--accent-dark);
  border-radius: 10px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

/* ===== Material List ===== */
.material-list {
  border-top: 1px dashed rgba(227, 233, 242, 0.8);
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
}
.material-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(227, 233, 242, 0.6);
}
.material-row:last-child {
  border-bottom: none;
}
.material-name {
  font-size: 13px;
  font-weight: 600;
}
.material-code {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.material-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}
.text-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
}

/* ===== States ===== */
.state {
  text-align: center;
  padding: 12px;
  color: var(--muted);
}
.state.error {
  color: #ff4d4f;
}
.state.empty {
  color: #94a3b8;
}

/* ===== Transitions & Animations ===== */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.2s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes riseIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
