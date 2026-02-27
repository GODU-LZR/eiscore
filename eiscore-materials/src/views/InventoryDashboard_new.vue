<template>
  <div class="inventory-dashboard" :class="{ fullscreen: isFullscreen }">
    <div class="dashboard-header">
      <div class="header-left">
        <h2>库存监控大屏</h2>
        <div class="carousel-indicator" v-if="warehouses.length">
          <span class="pulse-dot"></span>
          当前展示: <span class="highlight">{{ selectedWarehouse?.name }}</span>
          <span class="counter">({{ currentIndex + 1 }}/{{ warehouses.length }})</span>
        </div>
      </div>
      <div class="header-actions">
        <el-button @click="toggleCarousel" :type="isCarouselRunning ? 'primary' : 'default'" plain>
          {{ isCarouselRunning ? '暂停轮播' : '开始轮播' }}
        </el-button>
        <el-button @click="nextWarehouse">下一个</el-button>
        <el-button @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
    </div>

    <div class="dashboard-body">
      <!-- 左侧面板：统计与预警 -->
      <div class="side-panel left-panel">
        <el-card shadow="never" class="panel-card stats-card">
          <template #header>实时库存统计</template>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">总库存</div>
              <div class="stat-value">{{ stats.totalQty }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">可用库存</div>
              <div class="stat-value" style="color: #10b981;">{{ stats.availableQty }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">锁定库存</div>
              <div class="stat-value" style="color: #f59e0b;">{{ stats.lockedQty }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">物料种类</div>
              <div class="stat-value">{{ stats.materialCount }}</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="panel-card alerts-card">
          <template #header>预警信息</template>
          <div class="auto-scroll-container">
            <div class="scroll-content" :class="{ 'is-scrolling': alerts.length > 4 }" :style="{ animationDuration: Math.max(alerts.length * 2, 10) + 's' }">
              <div class="alert-list">
                <div v-for="alert in alerts" :key="alert.id" class="alert-item" :class="'alert-' + alert.level">
                  <span>{{ alert.message }}</span>
                </div>
              </div>
              <!-- 复制一份用于无缝滚动 -->
              <div class="alert-list" v-if="alerts.length > 4" style="margin-top: 8px;">
                <div v-for="alert in alerts" :key="alert.id + '-dup'" class="alert-item" :class="'alert-' + alert.level">
                  <span>{{ alert.message }}</span>
                </div>
              </div>
            </div>
            <el-empty v-if="alerts.length === 0" description="无预警" :image-size="60" />
          </div>
        </el-card>
      </div>

      <!-- 中间面板：3D视图 -->
      <div class="center-panel">
        <el-card shadow="never" class="panel-card canvas-card">
          <template #header>
            <div class="layout-header">
              <div class="layout-title">3D 库位布局</div>
              <div class="layout-controls">
                <el-radio-group v-model="viewMode" size="small">
                  <el-radio-button label="location">库位明细</el-radio-button>
                  <el-radio-button label="area">库区汇总</el-radio-button>
                </el-radio-group>
                <el-select
                  v-model="activeLayerId"
                  size="small"
                  class="layout-layer-select"
                  placeholder="选择库区"
                  :disabled="layerOptions.length === 0"
                >
                  <el-option
                    v-for="layer in layerOptions"
                    :key="layer.key"
                    :label="layer.name"
                    :value="layer.key"
                  />
                </el-select>
              </div>
            </div>
          </template>
          <div class="canvas-wrapper" ref="canvasWrapperRef">
            <div id="dashboard-konva-stage"></div>
          </div>
          <el-empty v-if="!hasLayout" description="该仓库暂无布局配置" />
        </el-card>
      </div>

      <!-- 右侧面板：库位占用率 -->
      <div class="side-panel right-panel">
        <el-card shadow="never" class="panel-card locations-card">
          <template #header>{{ viewMode === 'area' ? '库区占用率' : '库位占用率' }}</template>
          <div class="auto-scroll-container">
            <div class="scroll-content" :class="{ 'is-scrolling': locationStats.length > 12 }" :style="{ animationDuration: Math.max(locationStats.length * 1.5, 10) + 's' }">
              <div class="location-grid">
                <div v-for="loc in locationStats" :key="loc.code" class="location-item">
                  <div class="location-name">
                    <span class="loc-code" :title="loc.name || loc.code">{{ loc.code }}</span>
                    <span class="loc-pct" :style="{ color: getUsageColor(loc.usage) }">{{ loc.usage }}%</span>
                  </div>
                  <el-progress :percentage="loc.usage" :color="getUsageColor(loc.usage)" :show-text="false" :stroke-width="6" />
                </div>
              </div>
              <!-- 复制一份用于无缝滚动 -->
              <div class="location-grid" v-if="locationStats.length > 12" style="margin-top: 12px;">
                <div v-for="loc in locationStats" :key="loc.code + '-dup'" class="location-item">
                  <div class="location-name">
                    <span class="loc-code" :title="loc.name || loc.code">{{ loc.code }}</span>
                    <span class="loc-pct" :style="{ color: getUsageColor(loc.usage) }">{{ loc.usage }}%</span>
                  </div>
                  <el-progress :percentage="loc.usage" :color="getUsageColor(loc.usage)" :show-text="false" :stroke-width="6" />
                </div>
              </div>
            </div>
            <el-empty v-if="locationStats.length === 0" description="暂无数据" :image-size="60" />
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as Vue from 'vue'
import { ElMessage } from 'element-plus'
import Konva from 'konva'
import request from '@/utils/request'

const { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch, computed } = Vue

const loading = ref(false)
const isFullscreen = ref(false)
const canvasWrapperRef = ref(null)

// 轮播相关状态
const warehouses = ref([])
const currentIndex = ref(0)
const isCarouselRunning = ref(true)
let carouselTimer = null

const selectedWarehouse = computed(() => warehouses.value[currentIndex.value] || null)

const layoutData = ref(null)
const layoutLayers = ref([])
const layoutRules = ref({ thresholds: [50, 80, 100] })
const activeLayerId = ref('')
const viewMode = ref('location')
const inventoryData = ref([])
const warehouseIndex = ref({ byId: {}, byCode: {} })
const inventoryIndex = ref({ byId: {}, byCode: {} })

let stage = null
let layer = null

const stats = reactive({
  totalQty: 0,
  availableQty: 0,
  lockedQty: 0,
  materialCount: 0
})

const locationStats = ref([])
const alerts = ref([])

const getLayerKey = (layer) => layer.area_id || 'root'

const layerOptions = computed(() => {
  return layoutLayers.value.map((layer) => ({
    key: getLayerKey(layer),
    name: layer.area_name || '默认'
  }))
})

const activeLayer = computed(() => {
  return layoutLayers.value.find((layer) => getLayerKey(layer) === activeLayerId.value)
})

const activeShapes = computed(() => activeLayer.value?.shapes || [])

const hasLayout = computed(() => {
  return layoutLayers.value.length > 0 && activeShapes.value.length >= 0
})

const loadWarehouses = async () => {
  try {
    // 获取所有仓库用于建立容量索引
    const allRes = await request({
      url: '/warehouses',
      headers: { 'Accept-Profile': 'scm' }
    })
    const list = allRes || []
    const byId = {}
    const byCode = {}
    list.forEach((item) => {
      byId[item.id] = item
      if (item.code) byCode[item.code] = item
    })
    warehouseIndex.value = { byId, byCode }

    // 筛选一级仓库用于轮播
    warehouses.value = list.filter(w => w.level === 1).sort((a, b) => a.code.localeCompare(b.code))

    if (warehouses.value.length > 0) {
      await loadCurrentWarehouseData()
      startCarousel()
    }
  } catch (e) {
    console.error('加载仓库失败:', e)
  }
}

const loadCurrentWarehouseData = async () => {
  if (!selectedWarehouse.value) return
  await loadLayout()
  await loadInventoryData()
}

const startCarousel = () => {
  if (carouselTimer) clearInterval(carouselTimer)
  isCarouselRunning.value = true
  carouselTimer = setInterval(() => {
    nextWarehouse()
  }, 15000) // 每15秒切换一次
}

const stopCarousel = () => {
  if (carouselTimer) clearInterval(carouselTimer)
  isCarouselRunning.value = false
}

const toggleCarousel = () => {
  if (isCarouselRunning.value) {
    stopCarousel()
  } else {
    startCarousel()
  }
}

const nextWarehouse = async () => {
  if (warehouses.value.length <= 1) return
  currentIndex.value = (currentIndex.value + 1) % warehouses.value.length
  await loadCurrentWarehouseData()
}

const loadLayout = async () => {
  try {
    const res = await request({
      url: `/warehouse_layouts?warehouse_id=eq.${selectedWarehouse.value.id}`,
      headers: { 'Accept-Profile': 'scm' }
    })

    const record = res?.[0]
    layoutData.value = record || null
    layoutRules.value = record?.rules || { thresholds: [50, 80, 100] }
    layoutLayers.value = record?.layers || []
    activeLayerId.value = layoutLayers.value.length ? getLayerKey(layoutLayers.value[0]) : ''
    await nextTick()
    renderCanvas()
  } catch (e) {
    console.error('加载布局失败:', e)
  }
}

const loadInventoryData = async () => {
  loading.value = true
  try {
    const res = await request({
      url: `/v_inventory_current?warehouse_code=like.${selectedWarehouse.value.code}*`,
      headers: { 'Accept-Profile': 'scm' }
    })
    inventoryData.value = res || []
    inventoryIndex.value = buildInventoryIndex(inventoryData.value)
    updateStats()
    updateLocationStats()
    updateAlerts()
    
    if (stage && layer) {
      updateCanvasColors()
    }
  } catch (e) {
    console.error('加载库存数据失败:', e)
  } finally {
    loading.value = false
  }
}

const renderCanvas = () => {
  if (!canvasWrapperRef.value || !layoutData.value) return

  if (stage) stage.destroy()

  const wrapper = canvasWrapperRef.value
  const width = wrapper.clientWidth
  const height = wrapper.clientHeight

  stage = new Konva.Stage({
    container: 'dashboard-konva-stage',
    width: width,
    height: height
  })

  layer = new Konva.Layer()
  stage.add(layer)

  const shapes = activeShapes.value || []
  shapes.forEach(shapeData => {
    const group = new Konva.Group({
      x: shapeData.x,
      y: shapeData.y
    })

    const d = 8; // 3D depth
    const w = shapeData.width;
    const h = shapeData.height;

    const bottomFace = new Konva.Line({
      points: [0, h, d, h + d, w + d, h + d, w, h],
      fill: '#cbd5e1',
      closed: true,
      name: 'bottomFace'
    })

    const rightFace = new Konva.Line({
      points: [w, 0, w + d, d, w + d, h + d, w, h],
      fill: '#94a3b8',
      closed: true,
      name: 'rightFace'
    })

    const topFace = new Konva.Rect({
      width: w,
      height: h,
      fill: '#f1f5f9',
      stroke: '#e2e8f0',
      strokeWidth: 1,
      name: 'topFace',
      shadowColor: 'rgba(0,0,0,0.05)',
      shadowBlur: 2,
      shadowOffset: { x: 2, y: 2 }
    })

    const text = new Konva.Text({
      text: shapeData.code || '货架',
      fontSize: 13,
      fontFamily: 'Helvetica Neue, sans-serif',
      fill: '#475569',
      width: w,
      height: h,
      align: 'center',
      verticalAlign: 'middle',
      name: 'text'
    })

    group.add(bottomFace)
    group.add(rightFace)
    group.add(topFace)
    group.add(text)

    group.attrs.shelfData = shapeData
    layer.add(group)
  })

  layer.draw()
  updateCanvasColors()
}

const updateCanvasColors = () => {
  if (!layer) return

  const thresholds = layoutRules.value?.thresholds || [50, 80, 100]
  const areaUsage = {}
  if (viewMode.value === 'area') {
    layoutLayers.value.forEach((layerItem) => {
      const shapes = layerItem.shapes || []
      let total = 0
      let capacity = 0
      shapes.forEach((shape) => {
        const inv = getInventoryForShape(shape)
        total += inv.totalQty
        capacity += inv.capacity
      })
      const usage = capacity > 0 ? (total / capacity) * 100 : 0
      areaUsage[getLayerKey(layerItem)] = Math.min(usage, 100)
    })
  }

  layer.find('Group').forEach(group => {
    const shelfData = group.attrs.shelfData
    if (!shelfData) return

    const inv = getInventoryForShape(shelfData)
    const topFace = group.findOne('.topFace')
    const rightFace = group.findOne('.rightFace')
    const bottomFace = group.findOne('.bottomFace')
    const text = group.findOne('.text')
    
    if (!inv || inv.totalQty === 0) {
      topFace.fill('#f8fafc')
      topFace.stroke('#e2e8f0')
      rightFace.fill('#e2e8f0')
      bottomFace.fill('#f1f5f9')
      text.fill('#64748b')
    } else {
      const usage = viewMode.value === 'area'
        ? (areaUsage[activeLayerId.value] || 0)
        : (inv.capacity > 0 ? (inv.totalQty / inv.capacity) * 100 : 0)

      text.fill('#ffffff')
      if (usage < thresholds[0]) {
        topFace.fill('#34d399')
        topFace.stroke('#10b981')
        rightFace.fill('#059669')
        bottomFace.fill('#10b981')
      } else if (usage < thresholds[1]) {
        topFace.fill('#fbbf24')
        topFace.stroke('#f59e0b')
        rightFace.fill('#d97706')
        bottomFace.fill('#f59e0b')
      } else if (usage < thresholds[2]) {
        topFace.fill('#fb923c')
        topFace.stroke('#f97316')
        rightFace.fill('#ea580c')
        bottomFace.fill('#f97316')
      } else {
        topFace.fill('#f87171')
        topFace.stroke('#ef4444')
        rightFace.fill('#dc2626')
        bottomFace.fill('#ef4444')
      }
    }
  })

  layer.draw()
}

const buildInventoryIndex = (list) => {
  const byId = {}
  const byCode = {}
  list.forEach((inv) => {
    const id = inv.warehouse_id
    const code = inv.warehouse_code
    if (id) {
      if (!byId[id]) byId[id] = { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
      byId[id].totalQty += parseFloat(inv.total_qty || 0)
      byId[id].availableQty += parseFloat(inv.available_qty || 0)
      byId[id].lockedQty += parseFloat(inv.locked_qty || 0)
    }
    if (code) {
      if (!byCode[code]) byCode[code] = { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
      byCode[code].totalQty += parseFloat(inv.total_qty || 0)
      byCode[code].availableQty += parseFloat(inv.available_qty || 0)
      byCode[code].lockedQty += parseFloat(inv.locked_qty || 0)
    }
  })

  Object.keys(byId).forEach((id) => {
    const node = warehouseIndex.value.byId[id]
    byId[id].capacity = node?.capacity ? parseFloat(node.capacity) : 0
  })

  Object.keys(byCode).forEach((code) => {
    const node = warehouseIndex.value.byCode[code]
    byCode[code].capacity = node?.capacity ? parseFloat(node.capacity) : 0
  })

  return { byId, byCode }
}

const getInventoryForShape = (shape) => {
  if (!shape) return { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
  if (shape.warehouse_id && inventoryIndex.value.byId[shape.warehouse_id]) {
    return inventoryIndex.value.byId[shape.warehouse_id]
  }
  if (shape.code && inventoryIndex.value.byCode[shape.code]) {
    return inventoryIndex.value.byCode[shape.code]
  }
  return { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
}

const updateStats = () => {
  const materials = new Set()
  let totalQty = 0
  let availableQty = 0
  let lockedQty = 0

  inventoryData.value.forEach(inv => {
    materials.add(inv.material_id)
    totalQty += parseFloat(inv.total_qty || 0)
    availableQty += parseFloat(inv.available_qty || 0)
    lockedQty += parseFloat(inv.locked_qty || 0)
  })

  stats.totalQty = totalQty.toFixed(2)
  stats.availableQty = availableQty.toFixed(2)
  stats.lockedQty = lockedQty.toFixed(2)
  stats.materialCount = materials.size
}

const updateLocationStats = () => {
  if (viewMode.value === 'area') {
    locationStats.value = layoutLayers.value.map((layerItem) => {
      const shapes = layerItem.shapes || []
      let totalQty = 0
      let capacity = 0
      shapes.forEach((shape) => {
        const inv = getInventoryForShape(shape)
        totalQty += inv.totalQty
        capacity += inv.capacity
      })
      const usage = capacity > 0 ? Math.min(Math.round((totalQty / capacity) * 100), 100) : 0
      return {
        code: layerItem.area_code || layerItem.area_name || '默认',
        name: layerItem.area_name || '默认',
        usage
      }
    })
    return
  }

  const shapes = activeShapes.value
  locationStats.value = shapes.map((shape) => {
    const inv = getInventoryForShape(shape)
    const usage = inv.capacity > 0 ? Math.min(Math.round((inv.totalQty / inv.capacity) * 100), 100) : 0
    return {
      code: shape.code || '未命名',
      name: shape.name || '',
      usage
    }
  })
}

const updateAlerts = () => {
  const newAlerts = []
  inventoryData.value.forEach(inv => {
    if (inv.expiry_date) {
      const expiry = new Date(inv.expiry_date)
      const now = new Date()
      const days = (expiry - now) / (1000 * 60 * 60 * 24)
      
      if (days < 0) {
        newAlerts.push({
          id: `exp-${inv.material_id}-${inv.batch_no}`,
          level: 'danger',
          message: `${inv.material_name} 批次 ${inv.batch_no} 已过期`
        })
      } else if (days < 7) {
        newAlerts.push({
          id: `exp-${inv.material_id}-${inv.batch_no}`,
          level: 'warning',
          message: `${inv.material_name} 批次 ${inv.batch_no} 即将过期`
        })
      }
    }
  })
  alerts.value = newAlerts
}

const getUsageColor = (usage) => {
  if (usage < 50) return '#10b981'
  if (usage < 80) return '#f59e0b'
  return '#ef4444'
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

watch([activeLayerId, viewMode], async () => {
  if (layoutData.value) {
    await nextTick()
    renderCanvas()
    updateLocationStats()
  }
})

onMounted(() => {
  loadWarehouses()
})

onBeforeUnmount(() => {
  stopCarousel()
  if (stage) stage.destroy()
})
</script>

<style scoped>
.inventory-dashboard {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  color: #334155;
  overflow: hidden;
}

.inventory-dashboard.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.dashboard-header {
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}

.carousel-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #64748b;
  background: #f1f5f9;
  padding: 6px 16px;
  border-radius: 20px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.highlight {
  color: #0ea5e9;
  font-weight: 600;
}

.counter {
  font-family: 'DIN Alternate', 'Helvetica Neue', sans-serif;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.dashboard-body {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  height: calc(100vh - 60px);
  box-sizing: border-box;
}

.side-panel {
  width: 25%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.center-panel {
  width: 50%;
  height: 100%;
}

.panel-card {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.stats-card { height: 35%; }
.alerts-card { height: 65%; }
.canvas-card { height: 100%; }
.locations-card { height: 100%; }

.panel-card :deep(.el-card__header) {
  border-bottom: 1px solid #e2e8f0;
  padding: 12px 16px;
  font-weight: 600;
  color: #1e293b;
  flex-shrink: 0;
}

.panel-card :deep(.el-card__body) {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.canvas-card :deep(.el-card__body) {
  padding: 0;
}

/* Auto Scroll Container */
.auto-scroll-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.scroll-content {
  display: flex;
  flex-direction: column;
}

.is-scrolling {
  animation: scroll-up linear infinite;
}

.is-scrolling:hover {
  animation-play-state: paused;
}

@keyframes scroll-up {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  height: 100%;
}

.stat-item {
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #0284c7;
  font-family: 'DIN Alternate', 'Helvetica Neue', sans-serif;
}

/* Location Grid */
.location-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.location-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #f1f5f9;
}

.location-name {
  font-size: 12px;
  color: #475569;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loc-code {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
  font-weight: 500;
}

.loc-pct {
  font-weight: 600;
  font-family: 'DIN Alternate', 'Helvetica Neue', sans-serif;
}

/* Alerts */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
}

.alert-danger {
  background: #fef2f2;
  color: #ef4444;
  border-left: 3px solid #ef4444;
}

.alert-warning {
  background: #fffbeb;
  color: #f59e0b;
  border-left: 3px solid #f59e0b;
}

/* Canvas */
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.layout-title {
  font-size: 16px;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.layout-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 16px;
  background: #0ea5e9;
  border-radius: 2px;
}

.layout-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.canvas-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, #ffffff 0%, #f1f5f9 100%);
}

#dashboard-konva-stage {
  width: 100%;
  height: 100%;
}
</style>