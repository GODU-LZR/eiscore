<template>
  <div class="wh-details">
    <div class="header-bar">
      <button class="back-btn" @click="goBack"><i class="back-icon" /> 返回</button>
      <h2>仓库详情</h2>
      <span />
    </div>
    <div class="body">
      <!-- Summary -->
      <section class="panel summary">
        <div class="title-row">
          <h2>{{ whInfo.name || '仓库信息' }}</h2>
          <span class="code">{{ whCode }}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span class="label">仓库编码</span><span class="value">{{ whInfo.code || whCode }}</span></div>
          <div class="meta-item"><span class="label">状态</span><span class="value">{{ whInfo.status || '--' }}</span></div>
          <div class="meta-item"><span class="label">容量</span><span class="value">{{ whInfo.capacity ? `${whInfo.capacity} ${whInfo.unit||''}` : '--' }}</span></div>
        </div>
      </section>

      <!-- Location Tree -->
      <section class="panel tree">
        <div class="section-title">
          <h3>库位与物料层级</h3>
          <span class="total">库位数: {{ locations.length }}</span>
        </div>
        <div v-if="loading" class="state">正在加载...</div>
        <div v-else-if="error" class="state error">{{ error }}</div>
        <div v-else-if="locations.length === 0" class="state empty">暂无库位或物料数据</div>
        <div v-else class="location-list">
          <div v-for="loc in locations" :key="loc.id" class="location-card">
            <div class="location-header" @click="expanded[loc.id] = !expanded[loc.id]">
              <div>
                <div class="location-name">{{ loc.name || '--' }}</div>
                <div class="location-code">{{ loc.code || '--' }}</div>
              </div>
              <div class="location-meta">
                <span>物料: {{ loc.materials.length }}</span>
                <button class="ghost" @click.stop="goLocation(loc.code)">盘点</button>
              </div>
            </div>
            <div v-show="expanded[loc.id]" class="material-list">
              <div v-for="mat in loc.materials" :key="mat.material_id" class="material-row">
                <div class="material-main">
                  <div class="material-name">{{ mat.material_name || '--' }}</div>
                  <div class="material-code">{{ mat.material_code || '--' }}</div>
                </div>
                <div class="material-meta">
                  <span class="qty">{{ fmtQty(mat.available_qty) }} {{ mat.unit || '--' }}</span>
                </div>
              </div>
              <div v-if="loc.materials.length === 0" class="state empty">当前库位暂无物料</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchWarehouseByCode, fetchLocationsByWarehouse, fetchInventoryByLocation } from '@/api/check'
import { getCheckCache, getColdMode } from '@/utils/check-cache'

const route = useRoute()
const router = useRouter()
const whCode = ref(route.params.code || '')
const whInfo = ref({})
const locations = ref([])
const expanded = reactive({})
const loading = ref(false)
const error = ref('')

onMounted(() => loadAll())

async function loadAll () {
  loading.value = true; error.value = ''
  try {
    if (getColdMode()) {
      const cached = getFromCache(); if (cached) { whInfo.value = cached.whInfo; locations.value = cached.locations; return }
      error.value = '冷库模式未找到缓存数据'; return
    }
    const res = await fetchWarehouseByCode(whCode.value)
    const wh = Array.isArray(res) && res.length ? res[0] : null
    if (!wh) { error.value = '未找到仓库'; return }
    whInfo.value = wh
    // load locations
    const locs = await fetchLocationsByWarehouse(wh.id)
    const locArr = Array.isArray(locs) ? locs : []
    const flattened = []
    for (const l of locArr) {
      if (l.level === 2) {
        const children = await fetchLocationsByWarehouse(l.id)
        ;(Array.isArray(children) ? children : []).forEach(c => {
          flattened.push({ id: c.id, code: c.code, name: `${l.name} / ${c.name}`, materials: [] })
        })
      } else {
        flattened.push({ id: l.id, code: l.code, name: l.name, materials: [] })
      }
    }
    for (const loc of flattened) {
      try { const inv = await fetchInventoryByLocation(loc.id); loc.materials = Array.isArray(inv) ? inv : [] } catch { loc.materials = [] }
    }
    locations.value = flattened
  } catch { error.value = '加载仓库信息失败' } finally { loading.value = false }
}

function getFromCache () {
  const cache = getCheckCache()
  if (!cache) return null
  const wh = (cache.warehouses || []).find(w => w.code === whCode.value)
  if (!wh) return null
  return {
    whInfo: { code: wh.code, name: wh.name, status: '启用' },
    locations: (wh.locations || []).map(l => ({
      id: l.id, code: l.code, name: l.name,
      materials: l.materials || []
    }))
  }
}

function goBack () { router.back() }
function goLocation (code) { router.push({ name: 'InventoryCheckLocation', params: { code } }) }
function fmtQty (v) { return v == null || v === '' ? '--' : v }
</script>

<style lang="scss" scoped>
.wh-details {
  font-family: 'Source Han Sans CN', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  min-height: 100vh; background: #f5f8f9;
}
.header-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.06);
  h2 { margin: 0; font-size: 16px; }
}
.back-btn {
  border: none; background: none; color: #1b6dff; font-size: 14px; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}
.back-icon {
  display: inline-block; width: 8px; height: 8px;
  border-left: 2px solid #1b6dff; border-bottom: 2px solid #1b6dff; transform: rotate(45deg);
}
.body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.panel {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 6px 16px rgba(27,46,94,.06);
}
.title-row { display: flex; align-items: center; justify-content: space-between; }
.title-row h2 { margin: 0; font-size: 18px; }
.code { font-family: Consolas, monospace; color: #5a6b7c; }
.meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 12px; }
.meta-item { display: flex; flex-direction: column; }
.meta-item .label { font-size: 12px; color: #8a97a6; }
.meta-item .value { margin-top: 4px; font-size: 14px; color: #1f2d3d; }
.section-title {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
  h3 { margin: 0; font-size: 16px; }
  .total { font-size: 12px; color: #8a97a6; }
}
.state { padding: 16px 0; text-align: center; color: #8a97a6; &.error { color: #ff4d4f; } }
.location-card { border: 1px solid #eef1f6; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
.location-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 14px; background: #f7f9fc; cursor: pointer;
}
.location-name { font-size: 15px; font-weight: 500; }
.location-code { font-size: 12px; color: #7f8c9a; }
.location-meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #5f6d7a; }
.ghost {
  background: #edf3ff; border: none; border-radius: 8px; padding: 4px 10px; font-size: 12px; color: #1e6fff; cursor: pointer;
}
.material-list { padding: 8px 14px 12px; }
.material-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px dashed #e9edf3;
}
.material-row:last-child { border-bottom: none; }
.material-name { font-size: 14px; color: #1f2d3d; }
.material-code { font-size: 12px; color: #7f8c9a; margin-top: 2px; }
.material-meta { font-size: 12px; color: #5f6d7a; }
.qty { font-weight: 600; }
</style>
