<template>
  <div class="check-overview">
    <!-- Loading Mask -->
    <div v-if="pageLoading" class="page-mask">
      <div class="spinner" />
      <span class="mask-text">{{ loadingMessage }}</span>
    </div>

    <div class="home">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">EIS 库存盘点</span>
          <h1>仓库盘点总览</h1>
          <p>选择仓库 → 展开库位 → 扫码/录入实盘数 → 提交</p>
        </div>
        <div class="hero-actions">
          <button class="action-btn scan" @click="handleScan">
            <span class="action-title">扫码盘点</span>
            <span class="action-desc">支持仓库码 / 库位码 / 物料码</span>
          </button>
        </div>
        <!-- Cold Mode -->
        <div class="mode-card">
          <div class="mode-info">
            <div class="mode-title">冷库离线模式</div>
            <div class="mode-desc">进入冷库前缓存全部数据, 离线盘点后统一提交</div>
            <div v-if="coldMode" class="mode-meta">
              <span>待提交: {{ pendingCount }}</span>
              <span v-if="cacheMeta.updatedAt">缓存于: {{ fmtTime(cacheMeta.updatedAt) }}</span>
            </div>
          </div>
          <button class="mode-toggle" :class="{ cold: coldMode }" @click="toggleColdMode">
            <span class="mode-label">{{ coldMode ? '退出冷库' : '进入冷库' }}</span>
            <span class="mode-hint">{{ coldMode ? '提交数据并恢复在线' : '缓存后进入离线' }}</span>
          </button>
        </div>
      </section>

      <!-- Search -->
      <section class="search-card">
        <div class="search-row">
          <input v-model.trim="searchText" placeholder="搜索仓库 / 库位 / 物料" @keyup.enter="handleSearch" />
          <button class="search-btn" @click="handleSearch">搜索</button>
        </div>
        <div class="search-meta">
          <span v-if="lastScan.code" class="last-scan"><span class="dot" /> 最近: {{ lastScan.typeLabel }} {{ lastScan.code }}</span>
          <span v-if="activeSearch" class="meta-pill">筛选: {{ activeSearch }}</span>
          <button v-if="activeSearch" class="clear-btn" @click="clearSearch">清除</button>
        </div>
      </section>

      <!-- Stats -->
      <section class="stats-row">
        <div class="stat-card accent"><div class="stat-label">仓库</div><div class="stat-value">{{ warehouses.length }}</div></div>
        <div class="stat-card dark"><div class="stat-label">库位</div><div class="stat-value">{{ locationTotal }}</div></div>
        <div class="stat-card"><div class="stat-label">物料</div><div class="stat-value">{{ materialTotal }}</div></div>
      </section>

      <!-- Warehouse List -->
      <section class="warehouse-section">
        <div class="section-head">
          <div><h2>仓库列表</h2><p>点击展开查看库位与物料</p></div>
          <button class="ghost-btn" @click="refreshAll">刷新数据</button>
        </div>
        <div v-if="loading" class="state">正在加载仓库数据...</div>
        <div v-else-if="error" class="state error">{{ error }}</div>
        <div v-else class="warehouse-grid">
          <article v-for="wh in filteredWarehouses" :key="wh.id" class="warehouse-card">
            <div class="warehouse-top" @click="toggleWarehouse(wh)">
              <div class="warehouse-info">
                <div class="warehouse-name">{{ wh.name }}</div>
                <div class="warehouse-code">{{ wh.code }}</div>
              </div>
              <div class="warehouse-meta">
                <span class="meta-chip">库位 {{ wh.locationCount }}</span>
                <span class="meta-chip">物料 {{ wh.materialCount }}</span>
                <button class="link-btn" @click.stop="goWarehouse(wh.code)">详情</button>
                <span class="toggle"><i class="chevron" :class="{ open: wh.expanded }" /></span>
              </div>
            </div>
            <transition name="panel">
              <div v-if="wh.expanded" class="warehouse-body">
                <div v-if="wh.loading" class="state">正在加载库位...</div>
                <div v-else-if="wh.error" class="state error">{{ wh.error }}</div>
                <div v-else class="location-list">
                  <div v-for="loc in getDisplayLocations(wh)" :key="loc.id" class="location-card">
                    <div class="location-head" @click="toggleLocation(loc)">
                      <div>
                        <div class="location-name">{{ loc.name }}</div>
                        <div class="location-code">{{ loc.code }}</div>
                      </div>
                      <div class="location-meta">
                        <span>物料 {{ loc.materials?.length ?? 0 }}</span>
                        <button class="mini-btn" @click.stop="goLocation(loc.code)">盘点</button>
                      </div>
                    </div>
                    <transition name="panel">
                      <div v-if="loc.expanded" class="material-list">
                        <div v-for="mat in getDisplayMaterials(loc)" :key="mat.material_id" class="material-row">
                          <div class="material-info">
                            <div class="material-name">{{ mat.material_name || '--' }}</div>
                            <div class="material-code">{{ mat.material_code || '--' }}</div>
                          </div>
                          <div class="material-meta">
                            <span>{{ fmtQty(mat.available_qty) }} {{ mat.unit || '' }}</span>
                            <button class="text-btn" @click.stop="goMaterial(mat.material_id)">详情</button>
                          </div>
                        </div>
                        <div v-if="!loc.materials?.length" class="state empty">当前库位暂无物料</div>
                      </div>
                    </transition>
                  </div>
                  <div v-if="!wh.locations?.length" class="state empty">该仓库暂无库位</div>
                </div>
              </div>
            </transition>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
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

/* ---- state ---- */
const pageLoading = ref(false)
const loadingMessage = ref('')
const searchText = ref('')
const activeSearch = ref('')
const warehouses = ref([])
const loading = ref(false)
const error = ref('')
const coldMode = ref(getColdMode())
const pendingCount = ref(0)
const cacheMeta = reactive({ updatedAt: 0, complete: false })
const lastScan = reactive({ code: '', type: 'unknown', typeLabel: '' })

/* ---- computed ---- */
const locationTotal = computed(() => warehouses.value.reduce((s, w) => s + (w.locationCount || 0), 0))
const materialTotal = computed(() => {
  const codes = new Set()
  warehouses.value.forEach(wh => {
    (wh.locations || []).forEach(loc => {
      (loc.materials || []).forEach(m => { if (m.material_code) codes.add(m.material_code) })
    })
  })
  return codes.size || warehouses.value.reduce((s, w) => s + (w.materialCount || 0), 0)
})
const keyword = computed(() => (activeSearch.value || '').toLowerCase())
const filteredWarehouses = computed(() => {
  if (!keyword.value) return warehouses.value
  return warehouses.value.filter(wh => {
    if (match(wh.name, keyword.value) || match(wh.code, keyword.value)) return true
    return (wh.locations || []).some(loc =>
      match(loc.name, keyword.value) || match(loc.code, keyword.value) ||
      (loc.materials || []).some(m => match(m.material_name, keyword.value) || match(m.material_code, keyword.value))
    )
  })
})

const match = (val, kw) => val && String(val).toLowerCase().includes(kw)

/* ---- lifecycle ---- */
onMounted(() => {
  refreshPending()
  const cached = getCheckCache()
  if (cached) {
    applyCache(cached)
    if (!coldMode.value) loadAll(true)
  } else {
    if (coldMode.value) { error.value = '冷库模式请先缓存数据'; return }
    loadAll(true)
  }
})

/* ---- methods ---- */
function refreshPending () { pendingCount.value = getPendingChecks().length }

function applyCache (cache) {
  cacheMeta.updatedAt = cache.updatedAt || 0
  cacheMeta.complete = cache.meta?.complete || false
  warehouses.value = (cache.warehouses || []).map(w => ({
    ...w, expanded: false, loading: false, error: ''
  }))
}

async function loadAll (complete = false) {
  loading.value = true
  error.value = ''
  try {
    const list = await fetchWarehouses()
    const whs = (Array.isArray(list) ? list : []).map(w => ({
      id: w.id, code: w.code, name: w.name,
      manager_id: w.manager_id,
      locationCount: 0, materialCount: 0,
      locations: [], expanded: false, loaded: false, loading: false, error: ''
    }))
    warehouses.value = whs
    if (complete) {
      for (const wh of whs) await loadWarehouseLocations(wh, true)
      persistCache(true)
    }
  } catch (e) {
    error.value = '加载仓库列表失败'
  } finally {
    loading.value = false
  }
}

async function loadWarehouseLocations (wh, silent = false) {
  if (!silent) wh.loading = true
  wh.error = ''
  try {
    const locs = await fetchLocationsByWarehouse(wh.id)
    const locArr = (Array.isArray(locs) ? locs : []).map(l => ({
      id: l.id, code: l.code, name: l.name, level: l.level,
      materials: [], expanded: false, loaded: false
    }))
    // load deeper children if level=2 (areas)
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
    // load inventory for each location
    for (const loc of flattened) {
      try {
        const inv = await fetchInventoryByLocation(loc.id)
        loc.materials = Array.isArray(inv) ? inv : []
        loc.loaded = true
      } catch { loc.materials = [] }
    }
    wh.locations = flattened
    wh.locationCount = flattened.length
    wh.materialCount = new Set(flattened.flatMap(l => (l.materials || []).map(m => m.material_code)).filter(Boolean)).size
    wh.loaded = true
  } catch (e) {
    wh.error = '加载库位失败'
  } finally {
    if (!silent) wh.loading = false
  }
}

function persistCache (complete) {
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
    meta: { complete: Boolean(complete || cacheMeta.complete) }
  }
  const c = setCheckCache(payload)
  cacheMeta.updatedAt = c.updatedAt
  cacheMeta.complete = payload.meta.complete
}

async function refreshAll () {
  pageLoading.value = true
  loadingMessage.value = '正在刷新仓库数据...'
  await loadAll(true)
  pageLoading.value = false
  loadingMessage.value = ''
}

function toggleWarehouse (wh) {
  wh.expanded = !wh.expanded
  if (wh.expanded && !wh.loaded && !coldMode.value) {
    loadWarehouseLocations(wh)
  }
}

function toggleLocation (loc) { loc.expanded = !loc.expanded }

function getDisplayLocations (wh) {
  if (!keyword.value) return wh.locations || []
  return (wh.locations || []).filter(l =>
    match(l.name, keyword.value) || match(l.code, keyword.value) ||
    (l.materials || []).some(m => match(m.material_name, keyword.value) || match(m.material_code, keyword.value))
  )
}
function getDisplayMaterials (loc) {
  if (!keyword.value) return loc.materials || []
  return (loc.materials || []).filter(m =>
    match(m.material_name, keyword.value) || match(m.material_code, keyword.value)
  )
}

async function toggleColdMode () {
  if (coldMode.value) {
    const pending = getPendingChecks()
    if (pending.length) {
      try {
        await ElMessageBox.confirm(`有 ${pending.length} 条盘点数据未提交，退出冷库模式将丢失未提交数据，确定退出？`, '冷库盘点')
      } catch { return }
    }
    coldMode.value = false
    setColdModeFlag(false)
    ElMessage.success('已退出冷库模式')
    loadAll(true)
  } else {
    try {
      await ElMessageBox.confirm('进入冷库模式前将缓存全部仓库数据，是否开始？', '冷库盘点')
    } catch { return }
    pageLoading.value = true
    loadingMessage.value = '正在缓存冷库数据...'
    await loadAll(true)
    coldMode.value = true
    setColdModeFlag(true)
    pageLoading.value = false
    loadingMessage.value = ''
    ElMessage.success('冷库模式已开启')
  }
}

function handleSearch () {
  if (!searchText.value) { ElMessage.warning('请输入查询内容'); return }
  activeSearch.value = searchText.value
}
function clearSearch () { searchText.value = ''; activeSearch.value = '' }

function handleScan () {
  // 浏览器端暂用手动输入模式
  ElMessageBox.prompt('请输入或粘贴二维码内容', '扫码盘点', {
    confirmButtonText: '查询', cancelButtonText: '取消'
  }).then(({ value }) => {
    if (!value) return
    routeByCode(value.trim())
  }).catch(() => {})
}

function routeByCode (raw) {
  const upper = raw.toUpperCase()
  lastScan.code = raw
  if (upper.startsWith('WH-') || upper.startsWith('WH_') || upper.startsWith('WH')) {
    lastScan.type = 'warehouse'; lastScan.typeLabel = '仓库'
    goWarehouse(raw); return
  }
  if (upper.startsWith('LOC-') || upper.startsWith('LOC_')) {
    lastScan.type = 'location'; lastScan.typeLabel = '库位'
    goLocation(raw); return
  }
  if (upper.startsWith('MAT-') || upper.startsWith('MAT_')) {
    lastScan.type = 'material'; lastScan.typeLabel = '物料'
    // 通过code查找material_id
    const found = findMaterialByCode(raw)
    if (found) { goMaterial(found.material_id); return }
  }
  // 尝试搜索
  lastScan.type = 'unknown'; lastScan.typeLabel = '未知'
  searchText.value = raw
  activeSearch.value = raw
}

function findMaterialByCode (code) {
  const target = code.toUpperCase()
  for (const wh of warehouses.value) {
    for (const loc of (wh.locations || [])) {
      const m = (loc.materials || []).find(i => String(i.material_code).toUpperCase() === target)
      if (m) return m
    }
  }
  return null
}

function goWarehouse (code) { router.push({ name: 'InventoryCheckWarehouse', params: { code } }) }
function goLocation (code) { router.push({ name: 'InventoryCheckLocation', params: { code } }) }
function goMaterial (id) { router.push({ name: 'InventoryCheckMaterial', params: { id } }) }

function fmtQty (v) { return v == null || v === '' ? '--' : v }
function fmtTime (ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style lang="scss" scoped>
.check-overview {
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
}
.home {
  --ink: #1d2433;
  --muted: #5a6b7c;
  --line: #e3e9f2;
  --accent: #1b6dff;
  --accent-dark: #0e3fa5;
  --accent-soft: rgba(27,109,255,.12);
  --fresh: #21c189;
  color: var(--ink);
  padding: 16px;
  display: flex; flex-direction: column; gap: 16px;
  background: radial-gradient(700px 280px at 10% -10%, rgba(27,109,255,.16), transparent 65%),
              radial-gradient(600px 260px at 100% 20%, rgba(33,193,137,.14), transparent 60%),
              linear-gradient(140deg, #f9fbff 0%, #f1f6ff 50%, #f6fbf8 100%);
  min-height: 100vh; position: relative;
}
.page-mask {
  position: fixed; inset: 0; background: rgba(247,249,252,.92);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 30;
  backdrop-filter: blur(6px);
}
.spinner {
  width: 42px; height: 42px; border-radius: 50%;
  border: 3px solid rgba(27,109,255,.2); border-top-color: var(--accent);
  animation: spin .9s linear infinite;
}
.mask-text { font-size: 13px; color: var(--muted); }

.hero {
  display: grid; gap: 16px; padding: 18px; border-radius: 18px;
  background: rgba(255,255,255,.92); border: 1px solid rgba(255,255,255,.7);
  box-shadow: 0 18px 40px rgba(20,37,90,.12); animation: riseIn .6s ease both;
}
.hero-copy h1 { margin: 8px 0 6px; font-size: 22px; letter-spacing: .5px; }
.hero-copy p { margin: 0; color: var(--muted); font-size: 14px; }
.hero-badge {
  display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px;
  font-size: 12px; color: var(--accent-dark); background: rgba(27,109,255,.12);
}
.hero-actions { display: grid; gap: 12px; }
.action-btn {
  border: none; border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;
  color: #fff; cursor: pointer; text-align: left; transition: transform .2s, box-shadow .2s;
}
.action-btn.scan { background: linear-gradient(135deg, #1b6dff, #4b8bff); box-shadow: 0 12px 24px rgba(27,109,255,.24); }
.action-btn:active { transform: translateY(1px); }
.action-title { font-size: 16px; font-weight: 600; }
.action-desc { font-size: 12px; opacity: .9; }

.mode-card {
  margin-top: 6px; background: rgba(15,30,56,.06); border-radius: 16px; padding: 12px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px; grid-column: 1/-1;
}
.mode-info { display: flex; flex-direction: column; gap: 6px; }
.mode-title { font-size: 13px; font-weight: 600; }
.mode-desc { font-size: 12px; color: var(--muted); }
.mode-meta { display: flex; gap: 10px; font-size: 11px; color: var(--accent-dark); }
.mode-toggle {
  border: none; border-radius: 14px; padding: 10px 12px; min-width: 110px;
  background: #e8eef7; color: var(--ink); text-align: left; cursor: pointer;
  display: flex; flex-direction: column; gap: 4px;
}
.mode-toggle.cold { background: linear-gradient(135deg, #0b3160, #0f6b8f); color: #fff; }
.mode-label { font-size: 13px; font-weight: 600; }
.mode-hint { font-size: 11px; opacity: .8; }

.search-card {
  background: #fff; border-radius: 16px; padding: 14px 16px;
  box-shadow: 0 10px 24px rgba(20,37,90,.08); display: flex; flex-direction: column; gap: 10px;
  animation: riseIn .7s ease both;
}
.search-row { display: flex; gap: 10px; }
.search-row input {
  flex: 1; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px;
  font-size: 14px; background: #f7f9fc; color: var(--ink); outline: none;
}
.search-btn {
  border: none; border-radius: 12px; padding: 10px 16px;
  background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.search-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); }
.meta-pill { padding: 4px 10px; border-radius: 999px; background: rgba(27,109,255,.1); color: var(--accent-dark); }
.clear-btn { border: none; background: #f2f5f9; color: var(--muted); padding: 4px 10px; border-radius: 999px; cursor: pointer; }
.last-scan { display: inline-flex; align-items: center; gap: 6px; color: var(--accent-dark); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block; }

.stats-row { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); animation: riseIn .8s ease both; }
.stat-card { background: #fff; border-radius: 16px; padding: 14px 16px; box-shadow: 0 8px 20px rgba(20,37,90,.08); }
.stat-card.accent { background: linear-gradient(135deg, #1b6dff, #4b8bff); color: #fff; }
.stat-card.dark { background: linear-gradient(135deg, #1f2d3d, #44556b); color: #fff; }
.stat-label { font-size: 12px; opacity: .8; }
.stat-value { font-size: 20px; font-weight: 700; margin-top: 6px; }

.warehouse-section { display: flex; flex-direction: column; gap: 12px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-head h2 { margin: 0 0 4px; font-size: 18px; }
.section-head p { margin: 0; font-size: 12px; color: var(--muted); }
.ghost-btn {
  border: 1px solid var(--line); background: #fff; color: var(--muted);
  border-radius: 12px; padding: 8px 14px; cursor: pointer; font-size: 12px;
}
.warehouse-grid { display: grid; gap: 14px; }
.warehouse-card {
  background: #fff; border-radius: 18px; border: 1px solid rgba(227,233,242,.8);
  box-shadow: 0 12px 26px rgba(20,37,90,.08); overflow: hidden; animation: riseIn .5s ease both;
}
.warehouse-top {
  padding: 14px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; cursor: pointer;
}
.warehouse-info { flex: 1 1 200px; min-width: 160px; }
.warehouse-name { font-size: 16px; font-weight: 600; }
.warehouse-code { font-size: 12px; color: var(--muted); margin-top: 4px; font-family: Consolas, monospace; }
.warehouse-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); }
.meta-chip { display: flex; align-items: center; gap: 6px; background: #f3f6fb; padding: 4px 10px; border-radius: 999px; color: var(--ink); }
.link-btn {
  border: none; background: #e9f0ff; color: var(--accent); border-radius: 10px; padding: 4px 10px; font-size: 12px; cursor: pointer;
}
.toggle { display: inline-flex; align-items: center; gap: 4px; }
.chevron {
  width: 8px; height: 8px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted);
  transform: rotate(45deg); transition: transform .2s; display: inline-block;
}
.chevron.open { transform: rotate(-135deg); }
.warehouse-body { border-top: 1px solid rgba(227,233,242,.6); padding: 10px 12px 14px; background: #fbfcff; }
.location-list { display: flex; flex-direction: column; gap: 10px; }
.location-card { border: 1px solid rgba(227,233,242,.8); border-radius: 14px; background: #fff; overflow: hidden; }
.location-head {
  padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer;
}
.location-name { font-size: 14px; font-weight: 600; }
.location-code { font-size: 12px; color: var(--muted); margin-top: 4px; font-family: Consolas, monospace; }
.location-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.mini-btn {
  border: none; background: rgba(27,109,255,.12); color: var(--accent-dark);
  border-radius: 10px; padding: 4px 8px; font-size: 12px; cursor: pointer;
}
.material-list {
  border-top: 1px dashed rgba(227,233,242,.8); padding: 8px 12px 12px;
  display: flex; flex-direction: column; gap: 8px; background: #fff;
}
.material-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 8px 0; border-bottom: 1px dashed rgba(227,233,242,.6);
}
.material-row:last-child { border-bottom: none; }
.material-name { font-size: 13px; font-weight: 600; }
.material-code { font-size: 12px; color: var(--muted); margin-top: 2px; }
.material-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.text-btn { border: none; background: transparent; color: var(--accent); cursor: pointer; font-size: 12px; }
.state { text-align: center; padding: 12px; color: var(--muted); }
.state.error { color: #ff4d4f; }
.state.empty { color: #94a3b8; }
.panel-enter-active, .panel-leave-active { transition: all .2s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: translateY(-6px); }

@keyframes riseIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }

@media (min-width: 720px) {
  .hero { grid-template-columns: minmax(220px,1fr) minmax(240px,1fr); align-items: center; }
  .hero-actions { grid-template-columns: repeat(2, minmax(160px,1fr)); }
  .warehouse-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (min-width: 1100px) { .warehouse-grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }
</style>
