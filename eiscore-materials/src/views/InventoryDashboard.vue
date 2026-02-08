<template>
  <div class="inventory-dashboard" :class="{ fullscreen: isFullscreen }">
    <div class="dashboard-header">
      <h2>库存监控大屏</h2>
      <div class="header-actions">
        <el-button @click="toggleFullscreen" :icon="isFullscreen ? 'Close' : 'FullScreen'">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
        <el-button @click="loadData" :icon="'Refresh'" :loading="loading">刷新</el-button>
      </div>
    </div>

    <div class="dashboard-body">
      <!-- 左侧仓库选择 -->
      <div class="warehouse-selector">
        <el-card shadow="never">
          <template #header>选择仓库</template>
          <el-tree
            :data="warehouseTree"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            @node-click="handleWarehouseSelect"
            highlight-current
          />
        </el-card>
      </div>

      <!-- 中间可视化布局 -->
      <div class="layout-canvas">
        <el-card shadow="never" v-if="selectedWarehouse">
          <template #header>
            <div class="layout-header">
              <div class="layout-title">{{ selectedWarehouse.name }} - 库位布局</div>
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
        <el-empty v-else description="请选择仓库查看布局" />
      </div>

      <!-- 右侧数据面板 -->
      <div class="data-panel">
        <el-card shadow="never" class="panel-card">
          <template #header>库存统计</template>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">总库存</div>
              <div class="stat-value">{{ stats.totalQty }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">可用库存</div>
              <div class="stat-value" style="color: #67c23a;">{{ stats.availableQty }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">锁定库存</div>
              <div class="stat-value" style="color: #e6a23c;">{{ stats.lockedQty }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">物料种类</div>
              <div class="stat-value">{{ stats.materialCount }}</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>{{ viewMode === 'area' ? '库区占用率' : '库位占用率' }}</template>
          <div class="location-list">
            <div v-for="loc in locationStats" :key="loc.code" class="location-item">
              <div class="location-name">{{ loc.code }}</div>
              <el-progress :percentage="loc.usage" :color="getUsageColor(loc.usage)" />
            </div>
          </div>
          <el-empty v-if="locationStats.length === 0" description="暂无数据" />
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>预警信息</template>
          <div class="alert-list">
            <div v-for="alert in alerts" :key="alert.id" class="alert-item" :class="'alert-' + alert.level">
              <el-icon><WarningFilled /></el-icon>
              <span>{{ alert.message }}</span>
            </div>
          </div>
          <el-empty v-if="alerts.length === 0" description="无预警" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import Konva from 'konva'
import request from '@/utils/request'

const loading = ref(false)
const isFullscreen = ref(false)
const canvasWrapperRef = ref(null)
const selectedWarehouse = ref(null)
const warehouseTree = ref([])
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
let wsConnection = null

const stats = reactive({
  totalQty: 0,
  availableQty: 0,
  lockedQty: 0,
  materialCount: 0
})

const locationStats = ref([])
const alerts = ref([])

const getLayerKey = (layer) => {
  return layer.area_id || 'root'
}

const layerOptions = computed(() => {
  return layoutLayers.value.map((layer) => ({
    key: getLayerKey(layer),
    name: layer.area_name || '默认'
  }))
})

const activeLayer = computed(() => {
  return layoutLayers.value.find((layer) => getLayerKey(layer) === activeLayerId.value)
})

const activeShapes = computed(() => {
  return activeLayer.value?.shapes || []
})

const hasLayout = computed(() => {
  return layoutLayers.value.length > 0 && activeShapes.value.length >= 0
})

const loadWarehouses = async () => {
  try {
    const res = await request({
      url: '/warehouses?order=code.asc',
      headers: { 'Accept-Profile': 'scm' }
    })
    const list = res || []
    warehouseTree.value = buildTree(list)
    const byId = {}
    const byCode = {}
    list.forEach((item) => {
      byId[item.id] = item
      if (item.code) byCode[item.code] = item
    })
    warehouseIndex.value = { byId, byCode }
  } catch (e) {
    console.error('加载仓库失败:', e)
  }
}

const buildTree = (flatData) => {
  const map = {}
  const roots = []
  
  flatData.forEach(item => {
    map[item.id] = { ...item, children: [] }
  })
  
  flatData.forEach(item => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id])
    } else {
      roots.push(map[item.id])
    }
  })
  
  return roots
}

const handleWarehouseSelect = async (warehouse) => {
  if (warehouse.level !== 1) {
    ElMessage.warning('请选择一级仓库查看布局')
    return
  }
  selectedWarehouse.value = warehouse
  await loadLayout()
  await loadInventoryData()
}

const loadLayout = async () => {
  if (!selectedWarehouse.value) return
  
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
  if (!selectedWarehouse.value) return
  
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

  if (stage) {
    stage.destroy()
  }

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

    const rect = new Konva.Rect({
      width: shapeData.width,
      height: shapeData.height,
      fill: '#e0f7fa',
      stroke: '#00acc1',
      strokeWidth: 2,
      cornerRadius: 4
    })

    const text = new Konva.Text({
      text: shapeData.code || '货架',
      fontSize: 14,
      fill: '#00695c',
      width: shapeData.width,
      height: shapeData.height,
      align: 'center',
      verticalAlign: 'middle'
    })

    group.add(rect)
    group.add(text)

    group.attrs.shelfData = shapeData

    // 鼠标悬停显示详情
    group.on('mouseenter', () => {
      stage.container().style.cursor = 'pointer'
      const inv = getInventoryForShape(shapeData)
      if (inv) {
        // TODO: 显示Tooltip
      }
    })

    group.on('mouseleave', () => {
      stage.container().style.cursor = 'default'
    })

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
    const rect = group.findOne('Rect')
    
    if (!inv || inv.totalQty === 0) {
      rect.fill('#e0f7fa')  // 空闲 - 绿色
    } else {
      const usage = viewMode.value === 'area'
        ? (areaUsage[activeLayerId.value] || 0)
        : (inv.capacity > 0 ? (inv.totalQty / inv.capacity) * 100 : 0)

      if (usage < thresholds[0]) {
        rect.fill('#c8e6c9')  // 绿色
      } else if (usage < thresholds[1]) {
        rect.fill('#fff9c4')  // 黄色
      } else if (usage < thresholds[2]) {
        rect.fill('#ffcc80')  // 橙色
      } else {
        rect.fill('#ef9a9a')  // 红色
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
      if (!byId[id]) {
        byId[id] = { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
      }
      byId[id].totalQty += parseFloat(inv.total_qty || 0)
      byId[id].availableQty += parseFloat(inv.available_qty || 0)
      byId[id].lockedQty += parseFloat(inv.locked_qty || 0)
    }
    if (code) {
      if (!byCode[code]) {
        byCode[code] = { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
      }
      byCode[code].totalQty += parseFloat(inv.total_qty || 0)
      byCode[code].availableQty += parseFloat(inv.available_qty || 0)
      byCode[code].lockedQty += parseFloat(inv.locked_qty || 0)
    }
  })

  Object.keys(byId).forEach((id) => {
    const node = warehouseIndex.value.byId[id]
    const capacity = node?.capacity ? parseFloat(node.capacity) : 0
    byId[id].capacity = capacity
  })

  Object.keys(byCode).forEach((code) => {
    const node = warehouseIndex.value.byCode[code]
    const capacity = node?.capacity ? parseFloat(node.capacity) : 0
    byCode[code].capacity = capacity
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
  if (usage < 50) return '#67c23a'
  if (usage < 80) return '#e6a23c'
  return '#f56c6c'
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

const loadData = () => {
  if (selectedWarehouse.value) {
    loadInventoryData()
  }
}

watch([activeLayerId, viewMode], async () => {
  if (layoutData.value) {
    await nextTick()
    renderCanvas()
    updateLocationStats()
  }
})

const initWebSocket = () => {
  // TODO: 实现WebSocket连接，监听库存变化实时刷新
  // const wsUrl = 'ws://localhost:8078/inventory-updates'
  // wsConnection = new WebSocket(wsUrl)
  // wsConnection.onmessage = (event) => {
  //   loadInventoryData()
  // }
}

onMounted(() => {
  loadWarehouses()
  initWebSocket()
})

onBeforeUnmount(() => {
  if (stage) {
    stage.destroy()
  }
  if (wsConnection) {
    wsConnection.close()
  }
})
</script>

<style scoped>
.inventory-dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0a0e27;
  color: #fff;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.dashboard-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.dashboard-body {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.warehouse-selector {
  width: 240px;
  flex-shrink: 0;
}

.warehouse-selector :deep(.el-card) {
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
}

.layout-canvas {
  flex: 1;
  overflow: hidden;
}

.layout-canvas :deep(.el-card) {
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.layout-title {
  font-weight: 600;
}

.layout-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.layout-layer-select {
  width: 160px;
}

.canvas-wrapper {
  flex: 1;
  overflow: hidden;
}

#dashboard-konva-stage {
  width: 100%;
  height: 100%;
}

.data-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.panel-card :deep(.el-card) {
  background: rgba(255, 255, 255, 0.95);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #409eff;
}

.location-list {
  max-height: 300px;
  overflow-y: auto;
}

.location-item {
  margin-bottom: 12px;
}

.location-name {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}

.alert-list {
  max-height: 200px;
  overflow-y: auto;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 13px;
}

.alert-danger {
  background: #fef0f0;
  color: #f56c6c;
}

.alert-warning {
  background: #fdf6ec;
  color: #e6a23c;
}
</style>
