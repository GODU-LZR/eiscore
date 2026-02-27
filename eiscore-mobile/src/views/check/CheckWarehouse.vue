<template>
  <div class="warehouse-detail">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()">
        <i class="back-icon" />
      </span>
      <p>仓库详情</p>
      <span />
    </div>

    <div class="content">
      <!-- 加载态 -->
      <div v-if="loading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">{{ loadingMsg }}</div>
      </div>

      <!-- 错误态 -->
      <div v-if="errorMsg" class="state error">{{ errorMsg }}</div>

      <!-- 汇总面板 -->
      <section v-if="warehouse" class="summary-panel">
        <div class="title-row">
          <h2>{{ warehouse.name || '未命名仓库' }}</h2>
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">仓库编码</span>
            <span class="meta-value mono">{{ warehouse.code || '--' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">库位数量</span>
            <span class="meta-value">{{ locations.length }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">物料种类</span>
            <span class="meta-value">{{ materialTotal }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">状态</span>
            <span class="meta-value status-ok">正常</span>
          </div>
        </div>
      </section>

      <!-- 库位列表 -->
      <section class="location-section">
        <div class="section-title">
          <h3>库位列表</h3>
          <span class="count-badge">{{ locations.length }}</span>
        </div>

        <div v-if="locations.length === 0 && !loading" class="state empty">暂无库位信息</div>

        <div class="location-list">
          <article
            v-for="(loc, index) in locations"
            :key="loc.id"
            class="location-card"
            :style="{ animationDelay: `${index * 0.05}s` }"
          >
            <div class="location-head" @click="toggleLocation(loc)">
              <div class="location-info">
                <div class="location-name">{{ loc.name || '未命名库位' }}</div>
                <div class="location-code">{{ loc.code || '--' }}</div>
              </div>
              <div class="location-meta">
                <span class="meta-chip">
                  物料 <strong>{{ (loc.materials || []).length }}</strong>
                </span>
                <button class="mini-btn primary" @click.stop="goLocation(loc.code)">盘点</button>
                <i class="chevron" :class="{ open: loc.expanded }" />
              </div>
            </div>

            <transition name="panel">
              <div v-show="loc.expanded" class="material-body">
                <div v-if="(loc.materials || []).length === 0" class="state empty">当前库位暂无物料</div>
                <div
                  v-for="mat in loc.materials || []"
                  :key="mat.material_id"
                  class="material-row"
                >
                  <div class="material-info">
                    <div class="material-name">{{ mat.material_name || '--' }}</div>
                    <div class="material-code">{{ mat.material_code || '--' }}</div>
                  </div>
                  <div class="material-qty">
                    <span class="qty-main">{{ fmtQty(mat.available_qty) }}</span>
                    <span class="qty-unit">{{ mat.unit || '--' }}</span>
                    <button class="text-btn" @click="goMaterial(mat.material_id)">详情</button>
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  fetchWarehouses, fetchLocationsByWarehouse,
  fetchInventoryByLocation
} from '@/api/check'
import { getCheckCache, getColdMode } from '@/utils/check-cache'

const route = useRoute()
const router = useRouter()

const warehouseCode = computed(() => route.params.code)
const warehouse = ref(null)
const locations = ref([])
const loading = ref(false)
const loadingMsg = ref('正在加载仓库详情...')
const errorMsg = ref('')

const materialTotal = computed(() => {
  const codes = new Set()
  locations.value.forEach(l =>
    (l.materials || []).forEach(m => { if (m.material_code) codes.add(m.material_code) })
  )
  return codes.size
})

onMounted(() => loadWarehouse())

async function loadWarehouse() {
  loading.value = true
  errorMsg.value = ''
  try {
    // 冷库模式优先取缓存
    if (getColdMode()) {
      const cache = getCheckCache()
      if (cache) {
        const wh = (cache.warehouses || []).find(w => w.code === warehouseCode.value)
        if (wh) {
          warehouse.value = wh
          locations.value = (wh.locations || []).map(l => ({ ...l, expanded: false }))
          loading.value = false
          return
        }
      }
    }

    // 在线搜索
    const list = await fetchWarehouses()
    const wh = (Array.isArray(list) ? list : []).find(w => w.code === warehouseCode.value)
    if (!wh) { errorMsg.value = `未找到仓库 ${warehouseCode.value}`; return }
    warehouse.value = wh

    const rawLocs = await fetchLocationsByWarehouse(wh.id)
    const locArr = (Array.isArray(rawLocs) ? rawLocs : []).map(l => ({
      id: l.id, code: l.code, name: l.name, level: l.level,
      materials: [], expanded: false, loaded: false
    }))

    // 处理 level-2 嵌套
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

    // 加载物料
    for (const loc of flattened) {
      try {
        const inv = await fetchInventoryByLocation(loc.id)
        loc.materials = Array.isArray(inv) ? inv : []
        loc.loaded = true
      } catch { loc.materials = [] }
    }

    locations.value = flattened
  } catch {
    errorMsg.value = '加载仓库详情失败'
  } finally {
    loading.value = false
  }
}

function toggleLocation(loc) { loc.expanded = !loc.expanded }
function goLocation(code) { router.push(`/check/location/${code}`) }
function goMaterial(id) { router.push(`/check/material/${id}`) }
function fmtQty(v) { return v == null || v === '' ? '--' : v }
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

/* ===== Content ===== */
.warehouse-detail {
  min-height: 100vh;
  background: #f5f8f9;
}
.content {
  --ink: #1d2433;
  --muted: #5a6b7c;
  --line: #e3e9f2;
  --accent: #1b6dff;
  --accent-dark: #0e3fa5;
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  color: var(--ink);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

/* ===== Summary Panel ===== */
.summary-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 18px;
  padding: 16px 18px;
  box-shadow: 0 14px 30px rgba(20, 37, 90, 0.1);
  animation: riseIn 0.5s ease both;
}
.title-row h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 14px;
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.meta-label {
  font-size: 12px;
  color: var(--muted);
}
.meta-value {
  font-size: 14px;
  font-weight: 600;
}
.meta-value.mono {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.meta-value.status-ok {
  color: #21c189;
}

/* ===== Section Title ===== */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title h3 {
  margin: 0;
  font-size: 16px;
}
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  background: var(--accent);
  padding: 0 6px;
}

/* ===== Location Card ===== */
.location-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.location-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(227, 233, 242, 0.8);
  box-shadow: 0 8px 20px rgba(20, 37, 90, 0.07);
  overflow: hidden;
  animation: riseIn 0.5s ease both;
}
.location-head {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}
.location-info {
  flex: 1;
}
.location-name {
  font-size: 15px;
  font-weight: 600;
}
.location-code {
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
}
.location-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}
.meta-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #f3f6fb;
  padding: 4px 10px;
  border-radius: 999px;
}
.mini-btn {
  border: none;
  border-radius: 10px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}
.mini-btn.primary {
  background: rgba(27, 109, 255, 0.12);
  color: var(--accent-dark);
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

/* ===== Material Body ===== */
.material-body {
  border-top: 1px dashed rgba(227, 233, 242, 0.7);
  padding: 8px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fafcff;
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
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
.material-qty {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.qty-main {
  font-weight: 700;
  color: var(--ink);
}
.qty-unit {
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
  padding: 14px;
  color: var(--muted);
}
.state.error { color: #ff4d4f; }
.state.empty { color: #94a3b8; }

/* ===== Animations ===== */
.panel-enter-active,
.panel-leave-active { transition: all 0.2s ease; }
.panel-enter-from,
.panel-leave-to { opacity: 0; transform: translateY(-6px); }

@keyframes riseIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
