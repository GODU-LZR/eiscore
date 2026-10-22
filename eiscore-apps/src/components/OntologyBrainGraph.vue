<template>
  <section
    class="ontology-brain"
    data-testid="ontology-brain"
    :data-node-count="graph.nodes?.length || 0"
    :data-edge-count="graph.edges?.length || 0"
    :data-ready="ready"
    :aria-busy="loading || !ready"
    aria-label="本体大脑展示面板"
  >
    <div class="brain-toolbar" role="toolbar" aria-label="大脑视图操作">
      <div class="brain-actions">
        <button type="button" title="复位视角" aria-label="复位视角" :disabled="!ready" @click="scene?.reset()"><el-icon><RefreshRight /></el-icon></button>
        <button type="button" title="正面视角" aria-label="正面视角" :disabled="!ready" @click="scene?.front()"><el-icon><View /></el-icon></button>
        <button type="button" title="透视脑壳" aria-label="透视脑壳" :aria-pressed="transparent" :disabled="!ready" @click="toggleTransparent"><el-icon><Hide /></el-icon></button>
        <button type="button" title="聚焦选中节点" aria-label="聚焦选中节点" :disabled="!ready || !selectedNodeId" @click="scene?.focus(selectedNodeId)"><el-icon><Aim /></el-icon></button>
        <button type="button" title="显示/隐藏空间网格" aria-label="显示/隐藏空间网格" :aria-pressed="gridVisible" :disabled="!ready" @click="toggleGrid"><el-icon><Grid /></el-icon></button>
      </div>
      <span class="brain-stat">{{ graph.nodes?.length || 0 }} 个节点 · {{ graph.edges?.length || 0 }} 条关系</span>
      <label class="brain-edge-picker">
        <span class="sr-only">选择本体关系</span>
        <select aria-label="选择本体关系" :value="selectedEdgeId" @change="pickEdgeId($event.target.value)">
          <option value="">选择关系</option>
          <option v-for="edge in graph.edges || []" :key="edge.id" :value="edge.id">{{ edgeOptionLabel(edge) }}</option>
        </select>
      </label>
    </div>
    <div class="brain-stage">
      <div ref="host" class="brain-canvas-host"></div>
      <div class="brain-labels" aria-hidden="true">
        <button
          v-for="label in labels"
          :key="label.id"
          type="button"
          tabindex="-1"
          class="brain-node-label"
          :class="{ selected: label.id === selectedNodeId }"
          :style="{ left: `${label.x}px`, top: `${label.y}px`, '--node-color': label.color }"
          :title="label.label"
          @click="pickNodeId(label.id)"
        >{{ label.label }}</button>
      </div>
      <div v-if="loading || !ready" class="brain-status" role="status">{{ unavailableReason || '正在载入本体图谱…' }}</div>
      <div v-else-if="error" class="brain-status brain-error" role="alert">{{ error }}</div>
      <div v-else-if="!graph.nodes?.length" class="brain-status" role="status">当前筛选下暂无可展示的本体节点</div>
      <div v-if="hoverLabel && ready && !error" class="brain-hover" role="status">{{ hoverLabel }}</div>
    </div>
    <footer class="brain-legend" aria-label="业务域图例">
      <span v-for="domain in legend" :key="domain.id" class="brain-domain"><i :style="{ backgroundColor: domain.color }"></i>{{ domain.label }}<small v-if="domain.count != null">{{ domain.count }}</small></span>
      <span class="brain-layout-note">业务域空间布局</span>
    </footer>
  </section>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef, watch } from 'vue'
import { Aim, Grid, Hide, RefreshRight, View } from '@element-plus/icons-vue'

const props = defineProps({
  graph: { type: Object, default: () => ({ nodes: [], edges: [], domains: [], stats: {} }) },
  selectedNodeId: { type: String, default: '' },
  selectedEdgeId: { type: String, default: '' },
  active: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})
const emit = defineEmits(['pick-node', 'pick-edge', 'unavailable'])
const host = ref(null)
const ready = ref(false)
const transparent = ref(false)
const gridVisible = ref(true)
const unavailableReason = ref('')
const hoverLabel = ref('')
const labels = shallowRef([])
const domainDefinitions = shallowRef({})
let scene = null
let disposed = false
let keptActive = true
let media = null

const legend = computed(() => {
  const domains = props.graph.domains || []
  return domains.map((value) => {
    const domain = typeof value === 'string' ? { id: value } : value
    const id = domain.id || domain.key || domain.domain || 'shared'
    const fallback = domainDefinitions.value[id] || domainDefinitions.value.shared || {}
    return { id, label: domain.label || fallback.label || id, color: domain.color || fallback.color || '#62728d', count: domain.count }
  })
})
function unavailable(reason) {
  ready.value = false
  unavailableReason.value = reason
  scene?.setActive(false)
  emit('unavailable', reason)
}
function pickNodeId(id) {
  const node = props.graph.nodes?.find((item) => item.id === id)
  if (node) emit('pick-node', node)
}
function pickEdgeId(id) {
  const edge = props.graph.edges?.find((item) => item.id === id)
  if (edge) emit('pick-edge', edge)
}
function edgeOptionLabel(edge) {
  const source = props.graph.nodes?.find((node) => node.id === edge.source)
  const target = props.graph.nodes?.find((node) => node.id === edge.target)
  return `${source?.label || edge.source} → ${target?.label || edge.target} · ${edge.label || '关系'}`
}
function toggleTransparent() {
  transparent.value = !transparent.value
  scene?.setTransparent(transparent.value)
}
function toggleGrid() {
  gridVisible.value = !gridVisible.value
  scene?.setGridVisible(gridVisible.value)
}
function syncActive() { scene?.setActive(props.active && keptActive) }
function mobileChanged(event) {
  if (event.matches) unavailable('当前窄屏使用二维关系视图，保留相同的本体数据与筛选。')
}
onMounted(async () => {
  media = window.matchMedia('(max-width: 640px)')
  media.addEventListener('change', mobileChanged)
  if (media.matches) return unavailable('当前窄屏使用二维关系视图，保留相同的本体数据与筛选。')
  try {
    const module = await import('../visualization/ontology-brain-scene.js')
    if (disposed || !host.value) return
    domainDefinitions.value = module.BRAIN_DOMAINS
    scene = module.createOntologyBrainScene(host.value, {
      onPickNode: (node) => emit('pick-node', node),
      onPickEdge: (edge) => emit('pick-edge', edge),
      onUnavailable: unavailable,
      onLabels: (value) => { if (!disposed) labels.value = value },
      onHover: (value) => { if (!disposed) hoverLabel.value = value }
    })
    scene.setGraph(props.graph)
    scene.setSelection(props.selectedNodeId, props.selectedEdgeId)
    scene.setGridVisible(gridVisible.value)
    syncActive()
    ready.value = true
  } catch {
    scene?.dispose()
    scene = null
    if (!disposed) unavailable('当前浏览器无法启用三维图形，已切换到二维关系视图。')
  }
})
watch(() => props.graph, (graph) => { scene?.setGraph(graph) })
watch(() => [props.selectedNodeId, props.selectedEdgeId], ([nodeId, edgeId]) => { scene?.setSelection(nodeId, edgeId) })
watch(() => props.active, syncActive)
onActivated(() => { keptActive = true; syncActive() })
onDeactivated(() => { keptActive = false; syncActive() })
onBeforeUnmount(() => {
  disposed = true
  media?.removeEventListener('change', mobileChanged)
  scene?.dispose()
  scene = null
})
</script>

<style scoped>
.ontology-brain { width: 100%; min-width: 0; overflow: hidden; background: #f5f8f9; border: 1px solid #dce4e7; }
.brain-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; min-height: 46px; padding: 7px 12px; border-bottom: 1px solid #dce4e7; background: #fff; }
.brain-actions { display: flex; gap: 3px; }
.brain-actions button { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border: 1px solid transparent; border-radius: 4px; background: transparent; color: #415762; font-size: 17px; cursor: pointer; }
.brain-actions button:hover:not(:disabled), .brain-actions button[aria-pressed='true'] { background: #e7f2f1; border-color: #a7cbc6; color: #146b64; }
.brain-actions button:disabled { opacity: 0.4; cursor: default; }
.brain-actions button:focus-visible, .brain-node-label:focus-visible, select:focus-visible { outline: 2px solid #197c8b; outline-offset: 2px; }
.brain-stat { margin-right: auto; color: #556872; font-size: 12px; white-space: nowrap; }
.brain-toolbar select { max-width: 200px; min-width: 110px; width: 100%; height: 28px; border: 1px solid #cedadd; border-radius: 4px; padding: 0 5px; color: #344952; background: #fff; font: inherit; font-size: 12px; }
.brain-stage { position: relative; width: 100%; height: clamp(460px, 62vh, 720px); min-height: 460px; }
.brain-canvas-host { position: absolute; inset: 0; overflow: hidden; }
.brain-canvas-host :deep(canvas) { display: block; width: 100%; height: 100%; touch-action: none; }
.brain-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.brain-node-label { position: absolute; transform: translateX(-50%); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 5px; border: 0; border-bottom: 1px solid var(--node-color); border-radius: 2px; background: #ffffffeb; color: #2c424d; font-size: 11px; line-height: 17px; cursor: pointer; pointer-events: auto; box-shadow: 0 1px 2px #20354012; }
.brain-node-label.selected { background: #fff1dc; border-color: #c6791e; color: #70450f; font-weight: 600; }
.brain-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; background: #f5f8f9dc; color: #5d7079; font-size: 14px; text-align: center; }
.brain-error { color: #a63838; }
.brain-hover { position: absolute; left: 14px; bottom: 12px; max-width: calc(100% - 28px); padding: 5px 8px; background: #fff; color: #344b55; font-size: 12px; border: 1px solid #d6e1e5; pointer-events: none; overflow-wrap: anywhere; }
.brain-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 17px; padding: 9px 14px; border-top: 1px solid #dce4e7; color: #4a606b; background: #fff; font-size: 12px; }
.brain-domain { display: inline-flex; align-items: center; gap: 6px; }
.brain-domain i { width: 8px; height: 8px; border-radius: 50%; }
.brain-domain small { font-size: 11px; color: #7b8b93; }
.brain-layout-note { margin-left: auto; color: #89969e; font-size: 11px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 900px) { .brain-toolbar { gap: 7px; } .brain-toolbar select { max-width: 150px; } .brain-stage { height: 500px; } }
</style>
