<template>
  <div class="warehouse-layout-editor">
    <div class="editor-toolbar">
      <el-button-group>
        <el-button :type="tool === 'select' ? 'primary' : ''" @click="tool = 'select'">
          <el-icon><Pointer /></el-icon> 选择
        </el-button>
        <el-button :type="tool === 'rect' ? 'primary' : ''" @click="tool = 'rect'">
          <el-icon><Grid /></el-icon> 添加货架
        </el-button>
      </el-button-group>
      <el-divider direction="vertical" />
      <el-button-group>
        <el-button size="small" @click="alignLeft">左对齐</el-button>
        <el-button size="small" @click="alignRight">右对齐</el-button>
        <el-button size="small" @click="alignTop">顶对齐</el-button>
        <el-button size="small" @click="alignBottom">底对齐</el-button>
        <el-button size="small" @click="distributeHorizontal">横向分布</el-button>
        <el-button size="small" @click="distributeVertical">纵向分布</el-button>
        <el-button size="small" @click="duplicateSelected">复制</el-button>
      </el-button-group>
      <el-divider direction="vertical" />
      <el-switch v-model="snapEnabled" size="small" />
      <span class="toolbar-mini">网格</span>
      <el-input-number v-model="gridSize" size="small" :min="5" :max="50" />
      <el-divider direction="vertical" />
      <el-select v-model="activeLayerId" size="small" class="layer-select" placeholder="选择库区层">
        <el-option
          v-for="layer in layerOptions"
          :key="layer.key"
          :label="layer.name"
          :value="layer.key"
        />
      </el-select>
      <el-divider direction="vertical" />
      <el-button @click="saveLayout" type="success" :loading="saving">
        <el-icon><Check /></el-icon> 保存布局
      </el-button>
      <el-button @click="clearLayout" type="danger">
        <el-icon><Delete /></el-icon> 清空
      </el-button>
      <el-divider direction="vertical" />
      <span class="toolbar-info">画布尺寸: {{ canvasWidth }}x{{ canvasHeight }}px</span>
    </div>

    <div class="editor-main">
      <div class="canvas-container" ref="containerRef">
        <div id="konva-stage" @dragover.prevent @drop="handleCanvasDrop"></div>
      </div>

      <div class="properties-panel" v-if="selectedShape">
        <el-card shadow="never">
          <template #header>
            <div class="panel-header">
              <span>属性面板</span>
              <el-button link type="danger" @click="deleteSelected">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </template>
          
          <el-form label-width="80px" size="small">
            <el-form-item label="绑定位置">
              <el-select v-model="selectedProps.bindId" placeholder="绑定库区/库位" @change="updateBindProps">
                <el-option-group label="库区">
                  <el-option
                    v-for="area in bindOptions.areas"
                    :key="area.id"
                    :label="`${area.code} ${area.name}`"
                    :value="area.id"
                  />
                </el-option-group>
                <el-option-group label="库位">
                  <el-option
                    v-for="loc in bindOptions.locations"
                    :key="loc.id"
                    :label="`${loc.code} ${loc.name}`"
                    :value="loc.id"
                  />
                </el-option-group>
              </el-select>
            </el-form-item>
            <el-form-item label="库位编码">
              <el-input v-model="selectedProps.code" @change="updateShapeProps" />
            </el-form-item>
            <el-form-item label="X坐标">
              <el-input-number v-model="selectedProps.x" :min="0" @change="updateShapePosition" />
            </el-form-item>
            <el-form-item label="Y坐标">
              <el-input-number v-model="selectedProps.y" :min="0" @change="updateShapePosition" />
            </el-form-item>
            <el-form-item label="宽度">
              <el-input-number v-model="selectedProps.width" :min="20" @change="updateShapeSize" />
            </el-form-item>
            <el-form-item label="高度">
              <el-input-number v-model="selectedProps.height" :min="20" @change="updateShapeSize" />
            </el-form-item>
            <el-form-item label="行数">
              <el-input-number v-model="selectedProps.rows" :min="1" :max="10" @change="updateShapeGrid" />
            </el-form-item>
            <el-form-item label="列数">
              <el-input-number v-model="selectedProps.cols" :min="1" :max="10" @change="updateShapeGrid" />
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Pointer, Grid, Check, Delete } from '@element-plus/icons-vue'
import Konva from 'konva'
import request from '@/utils/request'

const props = defineProps({
  warehouseId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['saved'])

const containerRef = ref(null)
const tool = ref('select')
const saving = ref(false)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const layoutLayers = ref([])
const layoutRules = ref({ thresholds: [50, 80, 100] })
const activeLayerId = ref('')
const warehouseRoot = ref(null)
const warehouseNodes = ref([])
const areaOptions = ref([])
const locationOptions = ref([])
const snapEnabled = ref(true)
const gridSize = ref(10)

let stage = null
let layer = null
let transformer = null
let resizeObserver = null
let lastSize = { width: 0, height: 0 }
let areaGroupMap = new Map()

const selectedShape = ref(null)
const selectedProps = reactive({
  code: '',
  bindId: '',
  bindLevel: null,
  bindName: '',
  shapeType: 'location',
  areaId: '',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  rows: 3,
  cols: 4
})

const getLayerKey = (layer) => {
  return layer.area_id || 'root'
}

const layerOptions = computed(() => {
  return layoutLayers.value.map((layer) => ({
    key: getLayerKey(layer),
    name: layer.area_name || '默认',
    area_id: layer.area_id || null
  }))
})

const activeLayer = computed(() => {
  return layoutLayers.value.find((layer) => getLayerKey(layer) === activeLayerId.value)
})

const bindOptions = computed(() => {
  return {
    areas: areaOptions.value || [],
    locations: locationOptions.value || []
  }
})


const getContentSize = (container) => {
  const rect = container.getBoundingClientRect()
  const style = getComputedStyle(container)
  const paddingX = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0)
  const paddingY = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0)
  const width = Math.max(rect.width - paddingX, 0)
  const height = Math.max(rect.height - paddingY, 0)
  return { width, height }
}

const resizeStage = () => {
  if (!containerRef.value || !stage) return
  const { width, height } = getContentSize(containerRef.value)
  const nextWidth = Math.floor(width)
  const nextHeight = Math.floor(height)
  if (!nextWidth || !nextHeight) return
  if (lastSize.width === nextWidth && lastSize.height === nextHeight) return
  lastSize = { width: nextWidth, height: nextHeight }
  canvasWidth.value = nextWidth
  canvasHeight.value = nextHeight
  stage.size({ width: nextWidth, height: nextHeight })
  layer.draw()
}

const initKonva = () => {
  if (!containerRef.value) return

  const container = containerRef.value
  const size = getContentSize(container)
  canvasWidth.value = size.width
  canvasHeight.value = size.height

  stage = new Konva.Stage({
    container: 'konva-stage',
    width: canvasWidth.value,
    height: canvasHeight.value
  })

  layer = new Konva.Layer()
  stage.add(layer)

  transformer = new Konva.Transformer({
    boundBoxFunc: (oldBox, newBox) => {
      if (newBox.width < 20 || newBox.height < 20) {
        return oldBox
      }
      return newBox
    }
  })
  layer.add(transformer)

  stage.on('click', (e) => {
    const isStage = e.target === stage
    if (tool.value === 'rect' && isStage) {
      const pos = stage.getPointerPosition()
      if (pos) addShelf(pos.x, pos.y)
      return
    }
    if (isStage) {
      setSelection([])
    }
  })

  loadLayout()
}

const snapValue = (value) => {
  const size = gridSize.value || 1
  return Math.round(value / size) * size
}

const snapPoint = (x, y) => {
  if (!snapEnabled.value) return { x, y }
  return { x: snapValue(x), y: snapValue(y) }
}

const getGroupSize = (group) => {
  const rect = group.findOne('Rect')
  const width = Math.round((rect?.width() || 0) * (group.scaleX() || 1))
  const height = Math.round((rect?.height() || 0) * (group.scaleY() || 1))
  return { width, height }
}

const setSelection = (groups) => {
  transformer.nodes(groups)
  if (groups.length === 1) {
    selectedShape.value = groups[0]
    updateSelectedProps(groups[0])
  } else {
    selectedShape.value = null
  }
  layer.draw()
}

const toggleSelection = (group) => {
  const nodes = transformer.nodes()
  const exists = nodes.includes(group)
  const next = exists ? nodes.filter((node) => node !== group) : [...nodes, group]
  setSelection(next)
}

const selectShape = (group, evt) => {
  if (evt?.evt?.shiftKey) {
    toggleSelection(group)
    return
  }
  setSelection([group])
}

const clampPosition = (value, min, max) => {
  return Math.max(min, Math.min(value, max))
}

const createAreaGroup = (shapeData) => {
  const group = new Konva.Group({
    x: shapeData.x,
    y: shapeData.y,
    draggable: true
  })

  const rect = new Konva.Rect({
    width: shapeData.width,
    height: shapeData.height,
    fill: '#f8fafc',
    stroke: '#1f2937',
    strokeWidth: 2,
    cornerRadius: 6
  })

  const text = new Konva.Text({
    text: shapeData.code || '库区',
    fontSize: 14,
    fill: '#0f172a',
    width: shapeData.width,
    height: shapeData.height,
    align: 'center',
    verticalAlign: 'middle'
  })

  group.add(rect)
  group.add(text)

  group.on('click', (evt) => {
    selectShape(group, evt)
  })

  group.on('dragend', () => {
    const pos = snapPoint(group.x(), group.y())
    group.x(pos.x)
    group.y(pos.y)
    if (selectedShape.value === group) {
      updateSelectedProps(group)
    }
  })

  group.on('transformend', () => {
    if (selectedShape.value === group) {
      updateSelectedProps(group)
    }
  })

  group.attrs.shapeType = 'area'
  group.attrs.areaData = {
    warehouse_id: shapeData.warehouse_id || null,
    code: shapeData.code || '',
    name: shapeData.name || ''
  }

  return group
}

const createLocationGroup = (shapeData, areaGroup) => {
  const group = new Konva.Group({
    x: shapeData.x,
    y: shapeData.y,
    draggable: true
  })

  const rect = new Konva.Rect({
    width: shapeData.width,
    height: shapeData.height,
    fill: '#ffffff',
    stroke: '#1f2937',
    strokeWidth: 2,
    cornerRadius: 4
  })

  const text = new Konva.Text({
    text: shapeData.code || '库位',
    fontSize: 12,
    fill: '#0f172a',
    width: shapeData.width,
    height: shapeData.height,
    align: 'center',
    verticalAlign: 'middle'
  })

  group.add(rect)
  group.add(text)

  group.on('click', (evt) => {
    selectShape(group, evt)
  })

  if (areaGroup) {
    const areaRect = areaGroup.findOne('Rect')
    group.dragBoundFunc((pos) => {
      if (!areaRect) return pos
      const maxX = areaRect.width() - rect.width()
      const maxY = areaRect.height() - rect.height()
      return {
        x: clampPosition(pos.x, 0, Math.max(0, maxX)),
        y: clampPosition(pos.y, 0, Math.max(0, maxY))
      }
    })
  }

  group.on('dragend', () => {
    const pos = snapPoint(group.x(), group.y())
    group.x(pos.x)
    group.y(pos.y)
    if (selectedShape.value === group) {
      updateSelectedProps(group)
    }
  })

  group.on('transformend', () => {
    if (selectedShape.value === group) {
      updateSelectedProps(group)
    }
  })

  group.attrs.shapeType = 'location'
  group.attrs.areaId = shapeData.area_id || null
  group.attrs.shelfData = {
    code: shapeData.code || `LOC-${Date.now()}`,
    rows: shapeData.rows || 1,
    cols: shapeData.cols || 1
  }
  group.attrs.bindData = {
    warehouse_id: shapeData.warehouse_id || null,
    level: shapeData.level || null,
    code: shapeData.code || '',
    name: shapeData.name || ''
  }

  return group
}

const addShelf = (x, y, node, areaGroup) => {
  const snapped = snapPoint(x, y)
  if (node?.level === 2 || node?.shapeType === 'area') {
    const shapeData = {
      x: snapped.x,
      y: snapped.y,
      width: 260,
      height: 180,
      code: node?.code || `AREA-${Date.now()}`,
      warehouse_id: node?.id || null,
      name: node?.name || ''
    }
    const group = createAreaGroup(shapeData)
    layer.add(group)
    if (node?.id) {
      areaGroupMap.set(node.id, group)
    }
    layer.draw()
    setSelection([group])
    return
  }

  const shapeData = {
    x: snapped.x,
    y: snapped.y,
    width: 90,
    height: 50,
    code: node?.code || `LOC-${Date.now()}`,
    rows: 1,
    cols: 1,
    warehouse_id: node?.id || null,
    level: node?.level || null,
    name: node?.name || '',
    area_id: node?.parent_id || null
  }
  const group = createLocationGroup(shapeData, areaGroup)
  if (areaGroup) {
    areaGroup.add(group)
  } else {
    layer.add(group)
  }
  layer.draw()
  setSelection([group])
}

const updateSelectedProps = (shape) => {
  const data = shape.attrs.shelfData || {}
  const bind = shape.attrs.bindData || {}
  const areaData = shape.attrs.areaData || {}
  const shapeType = shape.attrs.shapeType || 'location'
  selectedProps.code = data.code || ''
  selectedProps.shapeType = shapeType
  selectedProps.areaId = shape.attrs.areaId || ''
  if (shapeType === 'area') {
    selectedProps.bindId = areaData.warehouse_id || ''
    selectedProps.bindLevel = 2
    selectedProps.bindName = areaData.name || ''
  } else {
    selectedProps.bindId = bind.warehouse_id || ''
    selectedProps.bindLevel = bind.level || null
    selectedProps.bindName = bind.name || ''
  }
  selectedProps.x = Math.round(shape.x())
  selectedProps.y = Math.round(shape.y())
  selectedProps.width = Math.round(shape.width() * (shape.scaleX() || 1))
  selectedProps.height = Math.round(shape.height() * (shape.scaleY() || 1))
  selectedProps.rows = data.rows || 3
  selectedProps.cols = data.cols || 4
}

const updateShapeProps = () => {
  if (!selectedShape.value) return
  if (selectedProps.shapeType === 'area') {
    selectedShape.value.attrs.areaData = {
      ...(selectedShape.value.attrs.areaData || {}),
      code: selectedProps.code
    }
  } else {
    selectedShape.value.attrs.shelfData.code = selectedProps.code
  }
  const text = selectedShape.value.findOne('Text')
  if (text) {
    text.text(selectedProps.code || (selectedProps.shapeType === 'area' ? '库区' : '库位'))
  }
  layer.draw()
}

const updateBindProps = () => {
  if (!selectedShape.value) return
  const node = warehouseNodes.value.find((item) => item.id === selectedProps.bindId)
  if (!node) {
    if (selectedProps.shapeType === 'area') {
      selectedShape.value.attrs.areaData = {
        warehouse_id: null,
        code: '',
        name: ''
      }
    } else {
      selectedShape.value.attrs.bindData = {
        warehouse_id: null,
        level: null,
        code: '',
        name: ''
      }
    }
    updateShapeProps()
    return
  }
  if (selectedProps.shapeType === 'area' && node.level !== 2) {
    ElMessage.warning('库区仅能绑定二级库区节点')
    return
  }
  if (selectedProps.shapeType !== 'area' && node.level !== 3) {
    ElMessage.warning('库位仅能绑定三级库位节点')
    return
  }
  if (selectedProps.shapeType === 'area') {
    selectedShape.value.attrs.areaData = {
      warehouse_id: node.id,
      code: node.code,
      name: node.name
    }
    selectedProps.code = node.code
    selectedProps.bindLevel = 2
    selectedProps.bindName = node.name
    const text = selectedShape.value.findOne('Text')
    if (text) {
      text.text(node.code || '库区')
    }
    layer.draw()
    return
  }
  selectedShape.value.attrs.bindData = {
    warehouse_id: node.id,
    level: node.level,
    code: node.code,
    name: node.name
  }
  selectedShape.value.attrs.areaId = node.parent_id || ''
  selectedShape.value.attrs.shelfData.code = node.code
  selectedProps.code = node.code
  selectedProps.bindLevel = node.level
  selectedProps.bindName = node.name
  const text = selectedShape.value.findOne('Text')
  if (text) {
    text.text(node.code || '货架')
  }
  layer.draw()
}

const updateShapePosition = () => {
  if (!selectedShape.value) return
  const snapped = snapPoint(selectedProps.x, selectedProps.y)
  let nextX = snapped.x
  let nextY = snapped.y
  if (selectedProps.shapeType === 'location' && selectedProps.areaId) {
    const areaGroup = areaGroupMap.get(selectedProps.areaId)
    const areaRect = areaGroup?.findOne('Rect')
    const rect = selectedShape.value.findOne('Rect')
    if (areaRect && rect) {
      const maxX = areaRect.width() - rect.width()
      const maxY = areaRect.height() - rect.height()
      nextX = clampPosition(nextX, 0, Math.max(0, maxX))
      nextY = clampPosition(nextY, 0, Math.max(0, maxY))
    }
  }
  selectedShape.value.x(nextX)
  selectedShape.value.y(nextY)
  selectedProps.x = nextX
  selectedProps.y = nextY
  layer.draw()
}

const updateShapeSize = () => {
  if (!selectedShape.value) return
  const rect = selectedShape.value.findOne('Rect')
  const text = selectedShape.value.findOne('Text')
  if (rect) {
    rect.width(selectedProps.width)
    rect.height(selectedProps.height)
  }
  if (text) {
    text.width(selectedProps.width)
    text.height(selectedProps.height)
  }
  selectedShape.value.scaleX(1)
  selectedShape.value.scaleY(1)
  if (selectedProps.shapeType === 'area') {
    const areaRect = selectedShape.value.findOne('Rect')
    selectedShape.value.getChildren((node) => node.attrs?.shapeType === 'location').forEach((loc) => {
      const locRect = loc.findOne('Rect')
      if (!areaRect || !locRect) return
      const maxX = areaRect.width() - locRect.width()
      const maxY = areaRect.height() - locRect.height()
      loc.x(clampPosition(loc.x(), 0, Math.max(0, maxX)))
      loc.y(clampPosition(loc.y(), 0, Math.max(0, maxY)))
    })
  }
  layer.draw()
}

const updateShapeGrid = () => {
  if (!selectedShape.value) return
  selectedShape.value.attrs.shelfData.rows = selectedProps.rows
  selectedShape.value.attrs.shelfData.cols = selectedProps.cols
}

const deleteSelected = () => {
  const nodes = transformer.nodes()
  if (!nodes.length) return
  nodes.forEach((node) => {
    if (node.attrs.shapeType === 'area') {
      const areaId = node.attrs.areaData?.warehouse_id
      if (areaId) areaGroupMap.delete(areaId)
    }
    node.destroy()
  })
  transformer.nodes([])
  selectedShape.value = null
  layer.draw()
}

const clearLayout = () => {
  layer.find('Group').forEach(group => group.destroy())
  transformer.nodes([])
  selectedShape.value = null
  areaGroupMap.clear()
  if (activeLayer.value) {
    activeLayer.value.shapes = []
  }
  layer.draw()
}

const collectShapes = () => {
  const shapes = []
  layer.find('Group').forEach(group => {
    const rect = group.findOne('Rect')
    const width = Math.round((rect?.width() || 0) * (group.scaleX() || 1))
    const height = Math.round((rect?.height() || 0) * (group.scaleY() || 1))
    if (group.attrs.shapeType === 'area') {
      const area = group.attrs.areaData || {}
      shapes.push({
        shape_type: 'area',
        code: area.code,
        x: Math.round(group.x()),
        y: Math.round(group.y()),
        width,
        height,
        warehouse_id: area.warehouse_id || null,
        level: 2,
        name: area.name || null
      })
      return
    }
    if (group.attrs.shapeType === 'location') {
      const data = group.attrs.shelfData || {}
      const bind = group.attrs.bindData || {}
      shapes.push({
        shape_type: 'location',
        code: data.code,
        x: Math.round(group.x()),
        y: Math.round(group.y()),
        width,
        height,
        rows: data.rows || 1,
        cols: data.cols || 1,
        warehouse_id: bind.warehouse_id || null,
        level: bind.level || 3,
        name: bind.name || null,
        area_id: group.attrs.areaId || null
      })
    }
  })
  return shapes
}

const syncActiveLayerShapes = () => {
  if (!activeLayer.value) return
  activeLayer.value.shapes = collectShapes()
}

const renderLayer = () => {
  if (!activeLayer.value) return
  layer.find('Group').forEach(group => group.destroy())
  transformer.nodes([])
  selectedShape.value = null
  areaGroupMap.clear()
  const shapes = activeLayer.value.shapes || []
  const areaShapes = shapes.filter((shape) => shape.shape_type === 'area')
  const locationShapes = shapes.filter((shape) => shape.shape_type === 'location')

  areaShapes.forEach((shapeData) => {
    const group = createAreaGroup(shapeData)
    layer.add(group)
    if (shapeData.warehouse_id) {
      areaGroupMap.set(shapeData.warehouse_id, group)
    }
  })

  locationShapes.forEach((shapeData) => {
    const areaGroup = shapeData.area_id ? areaGroupMap.get(shapeData.area_id) : null
    const group = createLocationGroup(shapeData, areaGroup)
    if (areaGroup) {
      areaGroup.add(group)
    } else {
      layer.add(group)
    }
  })
  layer.draw()
}


const handleCanvasDrop = (event) => {
  if (!stage || !event?.dataTransfer) return
  const payload = event.dataTransfer.getData('application/json')
  if (!payload) return
  let node = null
  try {
    const data = JSON.parse(payload)
    node = data
  } catch (e) {
    return
  }
  stage.setPointersPositions(event)
  const pos = stage.getPointerPosition()
  if (!pos) return
  const bound = warehouseNodes.value.find((item) => item.id === node.id)
  addShelf(pos.x, pos.y, bound || node)
}

const getSelectedGroups = () => {
  return transformer.nodes()
}

const alignLeft = () => {
  const nodes = getSelectedGroups()
  if (nodes.length < 2) return
  const minX = Math.min(...nodes.map((node) => node.x()))
  nodes.forEach((node) => node.x(minX))
  layer.draw()
}

const alignRight = () => {
  const nodes = getSelectedGroups()
  if (nodes.length < 2) return
  const maxX = Math.max(...nodes.map((node) => {
    const size = getGroupSize(node)
    return node.x() + size.width
  }))
  nodes.forEach((node) => {
    const size = getGroupSize(node)
    node.x(maxX - size.width)
  })
  layer.draw()
}

const alignTop = () => {
  const nodes = getSelectedGroups()
  if (nodes.length < 2) return
  const minY = Math.min(...nodes.map((node) => node.y()))
  nodes.forEach((node) => node.y(minY))
  layer.draw()
}

const alignBottom = () => {
  const nodes = getSelectedGroups()
  if (nodes.length < 2) return
  const maxY = Math.max(...nodes.map((node) => {
    const size = getGroupSize(node)
    return node.y() + size.height
  }))
  nodes.forEach((node) => {
    const size = getGroupSize(node)
    node.y(maxY - size.height)
  })
  layer.draw()
}

const distributeHorizontal = () => {
  const nodes = getSelectedGroups()
  if (nodes.length < 3) return
  const sorted = [...nodes].sort((a, b) => a.x() - b.x())
  const totalWidth = sorted.reduce((sum, node) => sum + getGroupSize(node).width, 0)
  const minX = sorted[0].x()
  const maxX = sorted[sorted.length - 1].x() + getGroupSize(sorted[sorted.length - 1]).width
  const gap = (maxX - minX - totalWidth) / (sorted.length - 1)
  let cursor = minX
  sorted.forEach((node) => {
    node.x(cursor)
    cursor += getGroupSize(node).width + gap
  })
  layer.draw()
}

const distributeVertical = () => {
  const nodes = getSelectedGroups()
  if (nodes.length < 3) return
  const sorted = [...nodes].sort((a, b) => a.y() - b.y())
  const totalHeight = sorted.reduce((sum, node) => sum + getGroupSize(node).height, 0)
  const minY = sorted[0].y()
  const maxY = sorted[sorted.length - 1].y() + getGroupSize(sorted[sorted.length - 1]).height
  const gap = (maxY - minY - totalHeight) / (sorted.length - 1)
  let cursor = minY
  sorted.forEach((node) => {
    node.y(cursor)
    cursor += getGroupSize(node).height + gap
  })
  layer.draw()
}

const duplicateSelected = () => {
  const nodes = getSelectedGroups()
  if (!nodes.length) return
  const newGroups = []
  nodes.forEach((node) => {
    const data = node.attrs.shelfData || {}
    const bind = node.attrs.bindData || {}
    const size = getGroupSize(node)
    const shapeData = {
      x: node.x() + 20,
      y: node.y() + 20,
      width: size.width,
      height: size.height,
      code: data.code,
      rows: data.rows,
      cols: data.cols,
      warehouse_id: bind.warehouse_id,
      level: bind.level,
      name: bind.name
    }
    const group = createShelfGroup(shapeData)
    layer.add(group)
    newGroups.push(group)
  })
  layer.draw()
  setSelection(newGroups)
}

const loadWarehouseNodes = async () => {
  try {
    const rootRes = await request({
      url: `/warehouses?id=eq.${props.warehouseId}&select=id,code,name,level`,
      headers: { 'Accept-Profile': 'scm' }
    })
    const root = rootRes?.[0]
    warehouseRoot.value = root || null
    if (!root?.code) return

    const res = await request({
      url: `/warehouses?select=id,code,name,parent_id,level,capacity,unit&code=like.${encodeURIComponent(root.code)}*&order=code.asc`,
      headers: { 'Accept-Profile': 'scm' }
    })
    warehouseNodes.value = res || []
    areaOptions.value = warehouseNodes.value.filter((item) => item.level === 2 && item.parent_id === root.id)
    locationOptions.value = warehouseNodes.value.filter((item) => item.level === 3)
  } catch (e) {
    console.error('加载仓库节点失败:', e)
  }
}

const buildDefaultLayers = () => {
  if (!areaOptions.value.length) {
    return [{
      area_id: null,
      area_code: '',
      area_name: '默认',
      shapes: []
    }]
  }
  return areaOptions.value.map((area) => ({
    area_id: area.id,
    area_code: area.code,
    area_name: area.name,
    shapes: []
  }))
}

const ensureLayers = (layers) => {
  const layerMap = new Map((layers || []).map((layerItem) => [getLayerKey(layerItem), layerItem]))
  const defaults = buildDefaultLayers()
  defaults.forEach((layerItem) => {
    const key = getLayerKey(layerItem)
    if (!layerMap.has(key)) {
      layerMap.set(key, layerItem)
    }
  })
  return Array.from(layerMap.values())
}

const saveLayout = async () => {
  saving.value = true
  try {
    syncActiveLayerShapes()
    await request({
      url: '/warehouse_layouts?on_conflict=warehouse_id',
      method: 'post',
      headers: {
        'Accept-Profile': 'scm',
        'Content-Profile': 'scm',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      data: {
        warehouse_id: props.warehouseId,
        canvas_width: canvasWidth.value,
        canvas_height: canvasHeight.value,
        layers: layoutLayers.value,
        rules: layoutRules.value
      }
    })

    ElMessage.success('布局已保存')
    emit('saved')
  } catch (e) {
    console.error('保存失败:', e)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const loadLayout = async () => {
  try {
    const res = await request({
      url: `/warehouse_layouts?warehouse_id=eq.${props.warehouseId}`,
      headers: { 'Accept-Profile': 'scm' }
    })

    const record = res?.[0]
    layoutRules.value = record?.rules || { thresholds: [50, 80, 100] }
    layoutLayers.value = ensureLayers(record?.layers || [])
    if (!layoutLayers.value.length) {
      layoutLayers.value = ensureLayers([])
    }
    activeLayerId.value = getLayerKey(layoutLayers.value[0])
    renderLayer()
  } catch (e) {
    console.error('加载布局失败:', e)
  }
}

watch(activeLayerId, (nextId, prevId) => {
  if (!prevId || nextId === prevId) return
  syncActiveLayerShapes()
  renderLayer()
})

onMounted(async () => {
  await loadWarehouseNodes()
  await nextTick()
  initKonva()
  resizeObserver = new ResizeObserver(() => {
    resizeStage()
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  if (stage) {
    stage.destroy()
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.warehouse-layout-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f5f5f5;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border-bottom: 1px solid #dcdfe6;
  flex-wrap: wrap;
}

.layer-select {
  width: 200px;
}

.toolbar-mini {
  font-size: 12px;
  color: #606266;
}

.toolbar-info {
  font-size: 13px;
  color: #606266;
  margin-left: auto;
}

.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.canvas-container {
  flex: 1;
  background: #fff;
  overflow: auto;
  padding: 20px;
  min-height: 0;
  box-sizing: border-box;
}

#konva-stage {
  border: 1px solid #dcdfe6;
  background: #fafafa;
  width: 100%;
  height: 100%;
}

.properties-panel {
  width: 300px;
  background: #f9f9f9;
  border-left: 1px solid #dcdfe6;
  overflow-y: auto;
  padding: 12px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
