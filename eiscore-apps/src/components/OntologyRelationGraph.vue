<template>
  <div class="graph-wrap">
    <el-empty v-if="graphNodes.length === 0" description="暂无可展示关系" />
    <div
      v-else
      ref="graphScrollRef"
      class="graph-scroll"
      :class="{ dragging: dragState.dragging, pressing: dragState.pressing }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
    >
      <div class="graph-viewport" :style="graphViewportStyle">
        <div class="graph-canvas" :style="graphCanvasStyle">
        <svg class="graph-svg" :width="layout.width" :height="layout.height">
          <defs>
            <marker id="or-arrow-ontology" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--or-color-ontology)" />
            </marker>
            <marker id="or-arrow-wf" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--or-color-wf)" />
            </marker>
            <marker id="or-arrow-acl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--or-color-acl)" />
            </marker>
            <marker id="or-arrow-eiscore" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--or-color-eiscore)" />
            </marker>
            <marker id="or-arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--or-color-default)" />
            </marker>
          </defs>

          <g
            v-for="edge in graphEdges"
            :key="edge.id"
            class="graph-edge"
            :class="{ active: edge.active, related: edge.related, muted: edge.muted }"
            @click.stop="$emit('pick-relation', edge.raw)"
          >
            <line
              :x1="edge.startX"
              :y1="edge.startY"
              :x2="edge.endX"
              :y2="edge.endY"
              :stroke="edge.color"
              :stroke-width="edge.active ? 3 : 2"
              :marker-end="`url(#${edge.markerId})`"
            />
            <text v-if="edge.showLabel" :x="edge.labelX" :y="edge.labelY" class="edge-label">
              {{ edge.label }}
            </text>
          </g>
        </svg>

        <button
          v-for="node in graphNodes"
          :key="node.table"
          type="button"
          class="graph-node"
          :class="{ active: node.table === selectedTable, related: node.related, muted: node.muted }"
          :style="node.style"
          @click.stop="$emit('toggle-table', node.table)"
        >
          <div class="node-icon">
            <el-icon><Grid /></el-icon>
          </div>
          <div class="node-title">{{ node.label }}</div>
          <div class="node-sub">{{ node.table }}</div>
        </button>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { Grid } from '@element-plus/icons-vue'

const props = defineProps({
  relations: { type: Array, default: () => [] },
  selectedTable: { type: String, default: '' },
  pickedRelationId: { type: [Number, String], default: null },
  tableLabelMap: { type: Object, default: () => ({}) },
  predicateLabel: { type: Function, required: true },
  hostWidth: { type: Number, default: 1000 },
  zoom: { type: Number, default: 1 }
})

defineEmits(['toggle-table', 'pick-relation'])

const NODE_WIDTH = 172
const NODE_HEIGHT = 86
const HORIZONTAL_SPACING = NODE_WIDTH + 74
const VERTICAL_SPACING = NODE_HEIGHT + 74
const CANVAS_PADDING_X = 180
const CANVAS_PADDING_Y = 150
const LONG_PRESS_MS = 180
const NODE_EDGE_GAP = 10

const graphScrollRef = ref(null)
const dragState = ref({
  pressing: false,
  dragging: false,
  pointerId: null,
  startClientX: 0,
  startClientY: 0,
  startScrollLeft: 0,
  startScrollTop: 0
})
let longPressTimer = null

const graphTables = computed(() => {
  const set = new Set()
  props.relations.forEach((item) => {
    if (item.subject_table) set.add(item.subject_table)
    if (item.object_table) set.add(item.object_table)
  })
  if (props.selectedTable) set.add(props.selectedTable)
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const layout = computed(() => {
  const tables = graphTables.value
  const hostWidth = Math.max(920, props.hostWidth || 0)
  if (!tables.length) return { width: hostWidth, height: 560, positions: {} }

  const positions = {}
  if (props.selectedTable && tables.includes(props.selectedTable)) {
    const neighbors = tables.filter((item) => item !== props.selectedTable)
    const circumferenceNeed = neighbors.length * HORIZONTAL_SPACING
    const radius = Math.max(240, Math.ceil(circumferenceNeed / (2 * Math.PI)))
    const width = Math.max(hostWidth, radius * 2 + CANVAS_PADDING_X * 2)
    const height = Math.max(760, radius * 2 + CANVAS_PADDING_Y * 2)
    const centerX = width / 2
    const centerY = height / 2
    positions[props.selectedTable] = { x: centerX, y: centerY }
    neighbors.forEach((table, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / Math.max(1, neighbors.length))
      positions[table] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      }
    })
    return { width, height, positions }
  }

  const ringGap = VERTICAL_SPACING
  const baseRadius = 220
  const rings = []
  const remaining = tables.slice()
  let ringIndex = 0
  while (remaining.length > 0) {
    const radius = baseRadius + ringIndex * ringGap
    const circumference = 2 * Math.PI * radius
    const capacity = Math.max(4, Math.floor(circumference / HORIZONTAL_SPACING))
    const take = Math.min(remaining.length, capacity)
    const ring = remaining.splice(0, take)
    rings.push({ radius, tables: ring })
    ringIndex += 1
  }

  const maxRadius = rings[rings.length - 1]?.radius || baseRadius
  const width = Math.max(hostWidth, Math.ceil(maxRadius * 2 + CANVAS_PADDING_X * 2))
  const height = Math.max(820, Math.ceil(maxRadius * 2 + CANVAS_PADDING_Y * 2))
  const centerX = width / 2
  const centerY = height / 2

  rings.forEach((ringInfo) => {
    const radius = ringInfo.radius
    ringInfo.tables.forEach((table, i) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * i) / ringInfo.tables.length)
      positions[table] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      }
    })
  })
  return { width, height, positions }
})

const graphCanvasStyle = computed(() => ({
  width: `${layout.value.width}px`,
  height: `${layout.value.height}px`,
  transform: `scale(${props.zoom || 1})`,
  transformOrigin: 'left top'
}))

const graphViewportStyle = computed(() => ({
  width: `${Math.round(layout.value.width * (props.zoom || 1))}px`,
  height: `${Math.round(layout.value.height * (props.zoom || 1))}px`
}))

const graphNodes = computed(() => {
  const relatedTables = new Set()
  if (props.selectedTable) {
    relatedTables.add(props.selectedTable)
    props.relations.forEach((item) => {
      if (item.subject_table === props.selectedTable && item.object_table) relatedTables.add(item.object_table)
      if (item.object_table === props.selectedTable && item.subject_table) relatedTables.add(item.subject_table)
    })
  }
  return graphTables.value.map((table) => {
    const pos = layout.value.positions[table]
    if (!pos) return null
    const related = props.selectedTable ? relatedTables.has(table) : true
    return {
      table,
      label: props.tableLabelMap[table] || table,
      related,
      muted: !!props.selectedTable && !related,
      style: {
        left: `${Math.round(pos.x - NODE_WIDTH / 2)}px`,
        top: `${Math.round(pos.y - NODE_HEIGHT / 2)}px`,
        width: `${NODE_WIDTH}px`,
        height: `${NODE_HEIGHT}px`
      }
    }
  }).filter(Boolean)
})

const nodeRectMap = computed(() => {
  const map = {}
  graphTables.value.forEach((table) => {
    const pos = layout.value.positions[table]
    if (!pos) return
    map[table] = {
      left: pos.x - NODE_WIDTH / 2,
      right: pos.x + NODE_WIDTH / 2,
      top: pos.y - NODE_HEIGHT / 2,
      bottom: pos.y + NODE_HEIGHT / 2
    }
  })
  return map
})

const getExitDistance = (ux, uy) => {
  const halfW = NODE_WIDTH / 2
  const halfH = NODE_HEIGHT / 2
  const dxLimit = Math.abs(ux) < 1e-6 ? Number.POSITIVE_INFINITY : halfW / Math.abs(ux)
  const dyLimit = Math.abs(uy) < 1e-6 ? Number.POSITIVE_INFINITY : halfH / Math.abs(uy)
  return Math.min(dxLimit, dyLimit)
}

const intersectsNodeRect = (box) => {
  const rects = Object.values(nodeRectMap.value)
  return rects.some((rect) => (
    box.left < rect.right + 4 &&
    box.right > rect.left - 4 &&
    box.top < rect.bottom + 4 &&
    box.bottom > rect.top - 4
  ))
}

const edgeColor = (predicate, relationType) => {
  if (relationType === 'foreign_key') return { color: 'var(--or-color-default)', markerId: 'or-arrow-default' }
  const value = String(predicate || '')
  if (value.startsWith('acl:')) return { color: 'var(--or-color-acl)', markerId: 'or-arrow-acl' }
  if (value.startsWith('wf:')) return { color: 'var(--or-color-wf)', markerId: 'or-arrow-wf' }
  if (value.startsWith('ontology:')) return { color: 'var(--or-color-ontology)', markerId: 'or-arrow-ontology' }
  if (value.startsWith('eiscore:')) return { color: 'var(--or-color-eiscore)', markerId: 'or-arrow-eiscore' }
  return { color: 'var(--or-color-default)', markerId: 'or-arrow-default' }
}

const graphEdges = computed(() => {
  const labelBoxes = []
  const placed = []
  const relations = [...props.relations].sort((a, b) => {
    const ap = String(a.predicate || '')
    const bp = String(b.predicate || '')
    return ap.localeCompare(bp)
  })
  relations.forEach((item) => {
    const from = layout.value.positions[item.subject_table]
    const to = layout.value.positions[item.object_table]
    if (!from || !to) return
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const ux = dx / distance
    const uy = dy / distance
    const startOffset = getExitDistance(ux, uy) + NODE_EDGE_GAP
    const endOffset = getExitDistance(ux, uy) + NODE_EDGE_GAP
    const startX = from.x + ux * startOffset
    const startY = from.y + uy * startOffset
    const endX = to.x - ux * endOffset
    const endY = to.y - uy * endOffset
    const visibleDistance = Math.max(1, Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2))
    const { color, markerId } = edgeColor(item.predicate, item.relation_type)
    const label = props.predicateLabel(item.predicate)
    const angle = Math.atan2(dy, dx)
    const normalX = -Math.sin(angle)
    const normalY = Math.cos(angle)
    const baseX = (startX + endX) / 2
    const baseY = (startY + endY) / 2 - 6
    const textLength = String(label || '').length
    const estWidth = Math.min(160, Math.max(56, textLength * 11))
    const estHeight = 18
    const offsets = [0, 16, -16, 30, -30, 44, -44]
    let labelX = Math.round(baseX)
    let labelY = Math.round(baseY)
    let showLabel = visibleDistance > 96
    if (showLabel) {
      let placedLabel = false
      for (const offset of offsets) {
        const cx = Math.round(baseX + normalX * offset)
        const cy = Math.round(baseY + normalY * offset)
        const box = {
          left: cx - estWidth / 2 - 3,
          right: cx + estWidth / 2 + 3,
          top: cy - estHeight + 1,
          bottom: cy + 5
        }
        const hasCollision = labelBoxes.some((itemBox) => (
          box.left < itemBox.right &&
          box.right > itemBox.left &&
          box.top < itemBox.bottom &&
          box.bottom > itemBox.top
        ))
        const collidesNode = intersectsNodeRect(box)
        if (!hasCollision && !collidesNode) {
          labelX = cx
          labelY = cy
          labelBoxes.push(box)
          placedLabel = true
          break
        }
      }
      if (!placedLabel) showLabel = false
    }
    const active = String(props.pickedRelationId ?? '') === String(item.id)
    const related = !props.selectedTable || item.subject_table === props.selectedTable || item.object_table === props.selectedTable
    const muted = !!props.selectedTable && !related
    placed.push({
      ...item,
      raw: item,
      active,
      related,
      muted,
      label,
      color,
      markerId,
      startX,
      startY,
      endX,
      endY,
      labelX,
      labelY,
      showLabel
    })
  })
  return placed.sort((a, b) => {
    const rank = (edge) => {
      if (edge.active) return 3
      if (edge.related) return 2
      return 1
    }
    return rank(a) - rank(b)
  })
})

const clearLongPressTimer = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const resetDragState = () => {
  clearLongPressTimer()
  dragState.value.pressing = false
  dragState.value.dragging = false
  dragState.value.pointerId = null
}

const onPointerDown = (event) => {
  if (event.button !== undefined && event.button !== 0) return
  const target = event.target
  if (target?.closest?.('.graph-node') || target?.closest?.('.graph-edge')) return
  const scroller = graphScrollRef.value
  if (!scroller) return
  clearLongPressTimer()
  dragState.value.pressing = true
  dragState.value.dragging = false
  dragState.value.pointerId = event.pointerId
  dragState.value.startClientX = event.clientX
  dragState.value.startClientY = event.clientY
  dragState.value.startScrollLeft = scroller.scrollLeft
  dragState.value.startScrollTop = scroller.scrollTop
  if (scroller.setPointerCapture && event.pointerId != null) {
    scroller.setPointerCapture(event.pointerId)
  }
  longPressTimer = setTimeout(() => {
    if (!dragState.value.pressing) return
    dragState.value.dragging = true
  }, LONG_PRESS_MS)
}

const onPointerMove = (event) => {
  if (!dragState.value.pressing || !dragState.value.dragging) return
  if (dragState.value.pointerId !== null && event.pointerId !== dragState.value.pointerId) return
  const scroller = graphScrollRef.value
  if (!scroller) return
  const deltaX = event.clientX - dragState.value.startClientX
  const deltaY = event.clientY - dragState.value.startClientY
  scroller.scrollLeft = dragState.value.startScrollLeft - deltaX
  scroller.scrollTop = dragState.value.startScrollTop - deltaY
  event.preventDefault()
}

const onPointerUp = (event) => {
  const scroller = graphScrollRef.value
  if (dragState.value.dragging) event.preventDefault()
  clearLongPressTimer()
  if (scroller?.releasePointerCapture && event.pointerId != null) {
    try {
      scroller.releasePointerCapture(event.pointerId)
    } catch {
      // ignore release failures
    }
  }
  resetDragState()
}

const onPointerLeave = () => {
  if (!dragState.value.dragging) {
    clearLongPressTimer()
    dragState.value.pressing = false
  }
}

onBeforeUnmount(() => {
  clearLongPressTimer()
})
</script>

<style scoped>
.graph-wrap {
  min-height: 460px;
  --or-color-ontology: color-mix(in srgb, var(--el-color-primary) 84%, #0f172a);
  --or-color-wf: color-mix(in srgb, var(--el-color-success) 86%, #0f172a);
  --or-color-acl: color-mix(in srgb, var(--el-color-warning) 86%, #0f172a);
  --or-color-eiscore: color-mix(in srgb, var(--el-color-info) 86%, #0f172a);
  --or-color-default: color-mix(in srgb, var(--el-text-color-secondary) 90%, #0f172a);
}
.graph-scroll {
  height: clamp(500px, 66vh, 880px);
  max-height: 880px;
  overflow: auto;
  cursor: default;
}
.graph-scroll.pressing { cursor: grab; }
.graph-scroll.dragging {
  cursor: grabbing;
  user-select: none;
}
.graph-viewport {
  position: relative;
}
.graph-canvas { position: relative; }
.graph-svg { display: block; }
.graph-edge { cursor: pointer; }
.graph-edge line,
.graph-edge .edge-label {
  transition: opacity 0.18s ease, stroke-width 0.18s ease, filter 0.18s ease;
}
.graph-edge.related line {
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.12));
}
.graph-edge.muted line,
.graph-edge.muted .edge-label {
  opacity: 0.22;
}
.graph-edge.related .edge-label {
  opacity: 0.98;
}
.graph-edge.active line {
  stroke-width: 3.2;
}
.edge-label {
  fill: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.95);
  stroke-width: 4px;
  stroke-linejoin: round;
}
.graph-node {
  position: absolute;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
  text-align: left;
  padding: 10px;
  display: grid;
  grid-template-columns: 28px 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  row-gap: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.graph-node:hover {
  transform: translateY(-2px);
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.13);
}
.graph-node.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 14px 26px rgba(64, 158, 255, 0.2);
  background: color-mix(in srgb, var(--el-color-primary-light-9) 56%, var(--el-fill-color-blank));
}
.graph-node.related {
  border-color: color-mix(in srgb, var(--el-color-primary) 46%, var(--el-border-color));
}
.graph-node.muted {
  opacity: 0.42;
}
.node-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--el-color-primary-light-8) 78%, var(--el-fill-color-blank));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  grid-row: 1 / span 2;
}
.node-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.25;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.node-sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
