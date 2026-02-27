<template>
  <div class="tech-dashboard" :class="{ fullscreen: isFullscreen }">
    <!-- Header -->
    <header class="tech-header">
      <div class="header-left">
        <div class="tech-title">INVENTORY COMMAND CENTER</div>
        <div class="tech-subtitle">智能库存监控中枢</div>
      </div>
      <div class="header-center">
        <div class="carousel-indicator">
          <span class="pulse-dot"></span>
          <span class="warehouse-name">{{ selectedWarehouse?.name || '加载中...' }}</span>
          <span class="layer-name" v-if="activeLayer">[{{ activeLayer.area_name || '默认层' }}]</span>
          <span class="counter">W:{{ currentIndex + 1 }}/{{ warehouses.length }} L:{{ currentLayerIndex + 1 }}/{{ layoutLayers.length || 1 }}</span>
        </div>
      </div>
      <div class="header-right">
        <div class="time-display">{{ currentTime }}</div>
        <el-button class="tech-btn" @click="toggleFullscreen" title="全屏">
          <el-icon><FullScreen /></el-icon>
        </el-button>
      </div>
    </header>

    <!-- Body -->
    <div class="tech-body">
      <!-- Left Panel -->
      <div class="tech-panel left-panel">
        <div class="panel-box stats-box">
          <div class="box-title">OVERALL STATS // 总体指标</div>
          <div class="stats-content">
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">总库存量</div>
                <div class="stat-value">{{ stats.totalQty }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">物料种类</div>
                <div class="stat-value">{{ stats.materialCount }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">可用库存</div>
                <div class="stat-value text-success">{{ stats.availableQty }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">锁定库存</div>
                <div class="stat-value text-warning">{{ stats.lockedQty }}</div>
              </div>
            </div>
            <div class="capacity-section">
              <div class="cap-label">整体库容使用率</div>
              <el-progress 
                :percentage="overallCapacityUsage" 
                :color="getUsageColor(overallCapacityUsage)" 
                :stroke-width="12" 
                striped 
                striped-flow 
                :duration="10"
              />
            </div>
          </div>
        </div>
        <div class="panel-box trans-box">
          <div class="box-title">RECENT LOGS // 实时动态</div>
          <div class="auto-scroll-container">
            <div class="scroll-content" :class="{ 'is-scrolling': transactions.length > 5 }" :style="{ animationDuration: Math.max(transactions.length * 2, 10) + 's' }">
              <div class="trans-list">
                <div v-for="tx in transactions" :key="tx.id" class="trans-item">
                  <div class="tx-time">{{ formatTime(tx.transaction_date) }}</div>
                  <div class="tx-type" :class="tx.transaction_type === '入库' ? 'text-success' : 'text-warning'">[{{ tx.transaction_type }}]</div>
                  <div class="tx-mat">{{ tx.material_name }}</div>
                  <div class="tx-qty" :class="tx.transaction_type === '入库' ? 'text-success' : 'text-warning'">
                    {{ tx.transaction_type === '入库' ? '+' : '-' }}{{ tx.quantity }}
                  </div>
                </div>
              </div>
              <!-- Duplicate for seamless scroll -->
              <div class="trans-list" v-if="transactions.length > 5" style="margin-top: 8px;">
                <div v-for="tx in transactions" :key="tx.id + '-dup'" class="trans-item">
                  <div class="tx-time">{{ formatTime(tx.transaction_date) }}</div>
                  <div class="tx-type" :class="tx.transaction_type === '入库' ? 'text-success' : 'text-warning'">[{{ tx.transaction_type }}]</div>
                  <div class="tx-mat">{{ tx.material_name }}</div>
                  <div class="tx-qty" :class="tx.transaction_type === '入库' ? 'text-success' : 'text-warning'">
                    {{ tx.transaction_type === '入库' ? '+' : '-' }}{{ tx.quantity }}
                  </div>
                </div>
              </div>
            </div>
            <el-empty v-if="transactions.length === 0" description="暂无动态" :image-size="60" />
          </div>
        </div>
      </div>

      <!-- Center Panel -->
      <div class="tech-panel center-panel">
        <div class="panel-box canvas-box">
          <div class="box-title">3D SPATIAL VIEW // 空间拓扑</div>
          <div class="canvas-wrapper" ref="canvasWrapperRef">
            <div id="dashboard-konva-stage"></div>
          </div>
          <div class="view-mode-indicator">
            <span class="blink-text">LIVE</span> // {{ viewMode === 'area' ? 'AREA MODE' : 'LOCATION MODE' }}
          </div>
          <el-empty v-if="!hasLayout" description="该仓库暂无布局配置" />
        </div>
      </div>

      <!-- Right Panel -->
      <div class="tech-panel right-panel">
        <div class="panel-box loc-box">
          <div class="box-title">USAGE HEATMAP // 占用热力</div>
          <div class="auto-scroll-container">
            <div class="scroll-content" :class="{ 'is-scrolling': locationStats.length > 10 }" :style="{ animationDuration: Math.max(locationStats.length * 1.5, 10) + 's' }">
              <div class="location-grid">
                <div v-for="loc in locationStats" :key="loc.code" class="location-item">
                  <div class="location-name">
                    <span class="loc-code" :title="loc.name || loc.code">{{ loc.code }}</span>
                    <span class="loc-pct" :style="{ color: getUsageColor(loc.usage) }">{{ loc.usage }}%</span>
                  </div>
                  <el-progress :percentage="loc.usage" :color="getUsageColor(loc.usage)" :show-text="false" :stroke-width="4" />
                </div>
              </div>
              <!-- Duplicate for seamless scroll -->
              <div class="location-grid" v-if="locationStats.length > 10" style="margin-top: 12px;">
                <div v-for="loc in locationStats" :key="loc.code + '-dup'" class="location-item">
                  <div class="location-name">
                    <span class="loc-code" :title="loc.name || loc.code">{{ loc.code }}</span>
                    <span class="loc-pct" :style="{ color: getUsageColor(loc.usage) }">{{ loc.usage }}%</span>
                  </div>
                  <el-progress :percentage="loc.usage" :color="getUsageColor(loc.usage)" :show-text="false" :stroke-width="4" />
                </div>
              </div>
            </div>
            <el-empty v-if="locationStats.length === 0" description="暂无数据" :image-size="60" />
          </div>
        </div>
        <div class="panel-box alert-box">
          <div class="box-title">SYSTEM ALERTS // 预警雷达</div>
          <div class="auto-scroll-container">
            <div class="scroll-content" :class="{ 'is-scrolling': alerts.length > 4 }" :style="{ animationDuration: Math.max(alerts.length * 2, 10) + 's' }">
              <div class="alert-list">
                <div v-for="alert in alerts" :key="alert.id" class="alert-item" :class="'alert-' + alert.level">
                  <div class="alert-icon">!</div>
                  <div class="alert-msg">{{ alert.message }}</div>
                </div>
              </div>
              <!-- Duplicate for seamless scroll -->
              <div class="alert-list" v-if="alerts.length > 4" style="margin-top: 8px;">
                <div v-for="alert in alerts" :key="alert.id + '-dup'" class="alert-item" :class="'alert-' + alert.level">
                  <div class="alert-icon">!</div>
                  <div class="alert-msg">{{ alert.message }}</div>
                </div>
              </div>
            </div>
            <el-empty v-if="alerts.length === 0" description="系统正常" :image-size="60" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as Vue from 'vue'
import { FullScreen } from '@element-plus/icons-vue'
import Konva from 'konva'
import request from '@/utils/request'

const { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch, computed } = Vue

const isFullscreen = ref(false)
const canvasWrapperRef = ref(null)

// Theme Detection
const isDark = ref(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)

// Time
const currentTime = ref('')
let timeTimer = null

// Carousel State
const warehouses = ref([])
const currentIndex = ref(0)
const currentLayerIndex = ref(0)
let masterTimer = null

const selectedWarehouse = computed(() => warehouses.value[currentIndex.value] || null)

const layoutData = ref(null)
const layoutLayers = ref([])
const layoutRules = ref({ thresholds: [50, 80, 100] })
const activeLayerId = ref('')
const viewMode = ref('location') // Auto-toggles between 'location' and 'area'
const inventoryData = ref([])
const transactions = ref([])
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

const overallCapacityUsage = ref(0)
const locationStats = ref([])
const alerts = ref([])

const getLayerKey = (layer) => layer.area_id || 'root'

const activeLayer = computed(() => {
  return layoutLayers.value.find((layer) => getLayerKey(layer) === activeLayerId.value)
})

const activeShapes = computed(() => activeLayer.value?.shapes || [])

const hasLayout = computed(() => {
  return layoutLayers.value.length > 0 && activeShapes.value.length >= 0
})

const formatTime = (isoString) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', { hour12: false })
}

const loadWarehouses = async () => {
  try {
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

    warehouses.value = list.filter(w => w.level === 1).sort((a, b) => a.code.localeCompare(b.code))

    if (warehouses.value.length > 0) {
      await loadCurrentWarehouseData()
      startMasterCarousel()
    }
  } catch (e) {
    console.error('加载仓库失败:', e)
  }
}

const loadCurrentWarehouseData = async () => {
  if (!selectedWarehouse.value) return
  await loadLayout()
  await loadInventoryData()
  await loadTransactions()
}

const startMasterCarousel = () => {
  if (masterTimer) clearInterval(masterTimer)
  // Master tick every 8 seconds
  masterTimer = setInterval(() => {
    // 1. Toggle View Mode occasionally (every 8s)
    viewMode.value = viewMode.value === 'location' ? 'area' : 'location'
    
    // 2. If we just switched back to 'location', move to next layer or warehouse
    if (viewMode.value === 'location') {
      if (layoutLayers.value.length > 1) {
        currentLayerIndex.value = (currentLayerIndex.value + 1) % layoutLayers.value.length
        activeLayerId.value = getLayerKey(layoutLayers.value[currentLayerIndex.value])
        if (currentLayerIndex.value === 0) {
          nextWarehouse()
        }
      } else {
        nextWarehouse()
      }
    }
  }, 8000)
}

const nextWarehouse = async () => {
  if (warehouses.value.length <= 1) return
  currentIndex.value = (currentIndex.value + 1) % warehouses.value.length
  currentLayerIndex.value = 0
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
    if (layoutLayers.value.length > 0) {
      activeLayerId.value = getLayerKey(layoutLayers.value[currentLayerIndex.value])
    } else {
      activeLayerId.value = ''
    }
    await nextTick()
    renderCanvas()
  } catch (e) {
    console.error('加载布局失败:', e)
  }
}

const loadInventoryData = async () => {
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
  }
}

const loadTransactions = async () => {
  try {
    const res = await request({
      url: `/v_inventory_transactions?warehouse_code=like.${selectedWarehouse.value.code}*&order=created_at.desc&limit=15`,
      headers: { 'Accept-Profile': 'scm' }
    })
    transactions.value = res || []
  } catch (e) {
    console.error('加载动态失败:', e)
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
      fill: isDark.value ? '#1e293b' : '#cbd5e1',
      closed: true,
      name: 'bottomFace'
    })

    const rightFace = new Konva.Line({
      points: [w, 0, w + d, d, w + d, h + d, w, h],
      fill: isDark.value ? '#0f172a' : '#94a3b8',
      closed: true,
      name: 'rightFace'
    })

    const topFace = new Konva.Rect({
      width: w,
      height: h,
      fill: isDark.value ? '#334155' : '#f1f5f9',
      stroke: isDark.value ? '#475569' : '#e2e8f0',
      strokeWidth: 1,
      name: 'topFace',
      shadowColor: isDark.value ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0,0,0,0.05)',
      shadowBlur: 4,
      shadowOffset: { x: 2, y: 2 }
    })

    const text = new Konva.Text({
      text: shapeData.code || '货架',
      fontSize: 13,
      fontFamily: 'DIN Alternate, Helvetica Neue, sans-serif',
      fill: isDark.value ? '#94a3b8' : '#475569',
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
      topFace.fill(isDark.value ? '#334155' : '#f8fafc')
      topFace.stroke(isDark.value ? '#475569' : '#e2e8f0')
      rightFace.fill(isDark.value ? '#0f172a' : '#e2e8f0')
      bottomFace.fill(isDark.value ? '#1e293b' : '#f1f5f9')
      text.fill(isDark.value ? '#64748b' : '#64748b')
    } else {
      const usage = viewMode.value === 'area'
        ? (areaUsage[activeLayerId.value] || 0)
        : (inv.capacity > 0 ? (inv.totalQty / inv.capacity) * 100 : 0)

      text.fill('#ffffff')
      if (usage < thresholds[0]) {
        topFace.fill(isDark.value ? '#059669' : '#34d399')
        topFace.stroke(isDark.value ? '#10b981' : '#10b981')
        rightFace.fill(isDark.value ? '#047857' : '#059669')
        bottomFace.fill(isDark.value ? '#065f46' : '#10b981')
      } else if (usage < thresholds[1]) {
        topFace.fill(isDark.value ? '#d97706' : '#fbbf24')
        topFace.stroke(isDark.value ? '#f59e0b' : '#f59e0b')
        rightFace.fill(isDark.value ? '#b45309' : '#d97706')
        bottomFace.fill(isDark.value ? '#92400e' : '#f59e0b')
      } else if (usage < thresholds[2]) {
        topFace.fill(isDark.value ? '#ea580c' : '#fb923c')
        topFace.stroke(isDark.value ? '#f97316' : '#f97316')
        rightFace.fill(isDark.value ? '#c2410c' : '#ea580c')
        bottomFace.fill(isDark.value ? '#9a3412' : '#f97316')
      } else {
        topFace.fill(isDark.value ? '#dc2626' : '#f87171')
        topFace.stroke(isDark.value ? '#ef4444' : '#ef4444')
        rightFace.fill(isDark.value ? '#b91c1c' : '#dc2626')
        bottomFace.fill(isDark.value ? '#991b1b' : '#ef4444')
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
  let totalCapacity = 0

  inventoryData.value.forEach(inv => {
    materials.add(inv.material_id)
    totalQty += parseFloat(inv.total_qty || 0)
    availableQty += parseFloat(inv.available_qty || 0)
    lockedQty += parseFloat(inv.locked_qty || 0)
  })

  // Calculate overall capacity for the warehouse
  Object.values(inventoryIndex.value.byId).forEach(inv => {
    totalCapacity += inv.capacity
  })

  stats.totalQty = totalQty.toFixed(2)
  stats.availableQty = availableQty.toFixed(2)
  stats.lockedQty = lockedQty.toFixed(2)
  stats.materialCount = materials.size

  overallCapacityUsage.value = totalCapacity > 0 ? Math.min(Math.round((totalQty / totalCapacity) * 100), 100) : 0
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
  if (usage < 50) return isDark.value ? '#34d399' : '#10b981'
  if (usage < 80) return isDark.value ? '#fbbf24' : '#f59e0b'
  return isDark.value ? '#f87171' : '#ef4444'
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
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      isDark.value = e.matches
      renderCanvas()
    })
  }

  loadWarehouses()
})

onBeforeUnmount(() => {
  if (masterTimer) clearInterval(masterTimer)
  if (timeTimer) clearInterval(timeTimer)
  if (stage) stage.destroy()
})
</script>

<style scoped>
/* CSS Variables for Theme Adaptation */
:root {
  --bg-main: #f0f4f8;
  --bg-panel: rgba(255, 255, 255, 0.85);
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: rgba(14, 165, 233, 0.3);
  --tech-primary: #0ea5e9;
  --tech-glow: rgba(14, 165, 233, 0.15);
  --tech-accent: #3b82f6;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --grid-color: rgba(14, 165, 233, 0.05);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-main: #020617;
    --bg-panel: rgba(15, 23, 42, 0.75);
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --border-color: rgba(56, 189, 248, 0.4);
    --tech-primary: #38bdf8;
    --tech-glow: rgba(56, 189, 248, 0.2);
    --tech-accent: #818cf8;
    --success: #34d399;
    --warning: #fbbf24;
    --danger: #f87171;
    --grid-color: rgba(56, 189, 248, 0.05);
  }
}

.tech-dashboard {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-main);
  background-image: 
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
  background-size: 30px 30px;
  color: var(--text-primary);
  overflow: hidden;
  font-family: 'DIN Alternate', 'Helvetica Neue', sans-serif;
  transition: background-color 0.3s, color 0.3s;
}

.tech-dashboard.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

/* Header */
.tech-header {
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 0 15px var(--tech-glow);
  backdrop-filter: blur(10px);
  z-index: 10;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tech-title {
  font-size: 20px;
  font-weight: 900;
  color: var(--tech-primary);
  letter-spacing: 2px;
  text-shadow: 0 0 8px var(--tech-glow);
}

.tech-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: 4px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.carousel-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  color: var(--tech-primary);
  background: rgba(0, 0, 0, 0.2);
  padding: 6px 24px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  box-shadow: inset 0 0 10px var(--tech-glow);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.warehouse-name {
  font-weight: 700;
  letter-spacing: 1px;
}

.layer-name {
  color: var(--text-secondary);
}

.counter {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-display {
  font-size: 18px;
  font-weight: 700;
  color: var(--tech-primary);
  letter-spacing: 1px;
}

.tech-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--tech-primary);
}
.tech-btn:hover {
  background: var(--tech-glow);
  color: var(--text-primary);
}

/* Body */
.tech-body {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  height: calc(100vh - 64px);
  box-sizing: border-box;
}

.tech-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.left-panel { width: 25%; }
.center-panel { width: 50%; }
.right-panel { width: 25%; }

/* Panel Box (HUD Style) */
.panel-box {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 20px var(--tech-glow);
}

.panel-box::before, .panel-box::after {
  content: '';
  position: absolute;
  width: 15px;
  height: 15px;
  border: 2px solid var(--tech-primary);
  pointer-events: none;
  z-index: 2;
}
.panel-box::before {
  top: -1px; left: -1px;
  border-right: none; border-bottom: none;
}
.panel-box::after {
  bottom: -1px; right: -1px;
  border-left: none; border-top: none;
}

.box-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--tech-primary);
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(90deg, var(--tech-glow) 0%, transparent 100%);
  letter-spacing: 1px;
  flex-shrink: 0;
}

.stats-box { height: 40%; }
.trans-box { height: 60%; }
.canvas-box { height: 100%; }
.loc-box { height: 60%; }
.alert-box { height: 40%; }

/* Stats Content */
.stats-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
}

.stat-item {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 8px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--tech-primary);
}

.text-success { color: var(--success) !important; }
.text-warning { color: var(--warning) !important; }
.text-danger { color: var(--danger) !important; }

.capacity-section {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 12px;
}

.cap-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

/* Auto Scroll Container */
.auto-scroll-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  padding: 12px;
}

.scroll-content {
  display: flex;
  flex-direction: column;
}

.is-scrolling {
  animation: scroll-up linear infinite;
}

@keyframes scroll-up {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

/* Transactions */
.trans-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trans-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
}

.tx-time { color: var(--text-secondary); width: 40px; }
.tx-type { font-weight: 700; width: 40px; }
.tx-mat { flex: 1; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx-qty { font-weight: 700; font-size: 14px; width: 40px; text-align: right; }

/* Locations */
.location-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.location-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(0, 0, 0, 0.1);
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.location-name {
  font-size: 12px;
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loc-code {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.loc-pct {
  font-weight: 700;
}

/* Alerts */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 13px;
  border: 1px solid transparent;
}

.alert-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  flex-shrink: 0;
}

.alert-danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--danger);
}
.alert-danger .alert-icon { background: var(--danger); color: #fff; }

.alert-warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: var(--warning);
}
.alert-warning .alert-icon { background: var(--warning); color: #fff; }

.alert-msg { flex: 1; }

/* Canvas */
.canvas-wrapper {
  position: absolute;
  top: 33px; /* Below box-title */
  left: 0;
  right: 0;
  bottom: 0;
}

#dashboard-konva-stage {
  width: 100%;
  height: 100%;
}

.view-mode-indicator {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--tech-primary);
  padding: 4px 12px;
  border-radius: 4px;
  color: var(--tech-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  pointer-events: none;
}

.blink-text {
  animation: blink 1s infinite;
  color: var(--danger);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>