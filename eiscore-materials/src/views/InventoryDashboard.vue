<template>
  <div class="hud" :class="{ fullscreen: isFullscreen }">
    <div class="hud-bg"></div>
    <div class="scan-line"></div>

    <header class="hud-header">
      <div class="hdr-left">
        <div class="hdr-title"><span class="hdr-icon">&#9672;</span> &#26234;&#33021;&#24211;&#23384;&#30417;&#25511;&#20013;&#26530;</div>
        <div class="hdr-sub">INVENTORY COMMAND CENTER</div>
      </div>
      <div class="hdr-center">
        <div class="carousel-badge">
          <span class="pulse-dot"></span>
          <span class="wh-name">{{ currentWarehouse?.name || '\u2014' }}</span>

          <span class="carousel-counter">{{ warehouseIdx + 1 }}/{{ topWarehouses.length || 1 }}</span>
        </div>
      </div>
      <div class="hdr-right">
        <div class="clock">{{ clock }}</div>
        <button class="fs-btn" @click="toggleFs" title="\u5168\u5c4f">&#9974;</button>
      </div>
    </header>

    <div class="hud-body">
      <!-- LEFT COLUMN -->
      <div class="col col-left">
        <section class="box kpi-box">
          <div class="box-hdr">&#24635;&#20307;&#25351;&#26631;</div>
          <div class="kpi-grid">
            <div class="kpi" v-for="k in kpiList" :key="k.label">
              <div class="kpi-val" :style="{ color: k.color }">{{ k.value }}</div>
              <div class="kpi-label">{{ k.label }}</div>
            </div>
          </div>
        </section>

        <section class="box gauge-box">
          <div class="box-hdr">&#24211;&#23481;&#20351;&#29992;</div>
          <div class="gauge-wrap">
            <svg viewBox="0 0 200 120" class="gauge-svg">
              <path d="M20 100 A80 80 0 0 1 180 100" fill="none" :stroke="gaugeTrackColor" stroke-width="14" stroke-linecap="round"/>
              <path d="M20 100 A80 80 0 0 1 180 100" fill="none" :stroke="gaugeColor" stroke-width="14" stroke-linecap="round" :stroke-dasharray="gaugeDash" class="gauge-fill"/>
              <text x="100" y="80" text-anchor="middle" :fill="gaugePctColor" font-size="30" font-weight="900" font-family="monospace">{{ capacityPct }}%</text>
              <text x="100" y="102" text-anchor="middle" :fill="gaugeSubColor" font-size="11" font-family="sans-serif">&#25972;&#20307;&#24211;&#23481;</text>
            </svg>
          </div>
        </section>

        <section class="box logs-box">
          <div class="box-hdr">&#20986;&#20837;&#24211;&#21160;&#24577;</div>
          <div class="marquee-container">
            <div class="marquee-content" :class="{ scrolling: txList.length > 4 }" :style="{ animationDuration: Math.max(txList.length * 3, 12) + 's' }">
              <div class="tx-track">
                <div v-for="(tx, i) in txList" :key="'a'+i" class="tx-row">
                  <span class="tx-time">{{ fmtTime(tx.transaction_date) }}</span>
                  <span class="tx-badge" :class="txType(tx) === 'in' ? 'badge-in' : 'badge-out'">{{ tx.transaction_type }}</span>
                  <span class="tx-name">{{ tx.material_name }}</span>
                  <span class="tx-qty" :class="txType(tx) === 'in' ? 'text-green' : 'text-amber'">{{ txType(tx) === 'in' ? '+' : '' }}{{ tx.quantity }}</span>
                  <span class="tx-wh">{{ tx.warehouse_name }}</span>
                </div>
              </div>
              <div class="tx-track" v-if="txList.length > 4">
                <div v-for="(tx, i) in txList" :key="'b'+i" class="tx-row">
                  <span class="tx-time">{{ fmtTime(tx.transaction_date) }}</span>
                  <span class="tx-badge" :class="txType(tx) === 'in' ? 'badge-in' : 'badge-out'">{{ tx.transaction_type }}</span>
                  <span class="tx-name">{{ tx.material_name }}</span>
                  <span class="tx-qty" :class="txType(tx) === 'in' ? 'text-green' : 'text-amber'">{{ txType(tx) === 'in' ? '+' : '' }}{{ tx.quantity }}</span>
                  <span class="tx-wh">{{ tx.warehouse_name }}</span>
                </div>
              </div>
            </div>
            <div v-if="txList.length === 0" class="empty-tip">&#26242;&#26080;&#35760;&#24405;</div>
          </div>
        </section>
      </div>

      <!-- CENTER COLUMN -->
      <div class="col col-center">
        <section class="box canvas-box">
          <div class="box-hdr">
            &#31354;&#38388;&#25299;&#25169;
            <span class="live-tag"><span class="blink-dot">&#9679;</span> &#23454;&#26102;</span>
          </div>
          <div class="canvas-body" ref="canvasRef">
            <div id="dashboard-konva-stage"></div>
          </div>
          <div class="legend-bar">
            <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> &lt;50% &#31354;&#38386;</div>
            <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span> 50-80% &#27491;&#24120;</div>
            <div class="legend-item"><span class="legend-dot" style="background:#f97316"></span> 80-100% &#32039;&#24352;</div>
            <div class="legend-item"><span class="legend-dot" style="background:#ef4444"></span> 100% &#28385;&#36733;</div>
            <div class="legend-item"><span class="legend-dot" style="background:var(--shelf-empty)"></span> &#31354;</div>
          </div>
        </section>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="col col-right">
        <section class="box tree-box">
          <div class="box-hdr">&#20179;&#24211;&#32467;&#26500;<span class="carousel-counter">{{ treeIdx + 1 }}/{{ topWarehouses.length || 1 }}</span></div>
          <div class="tree-content">
            <div v-for="wh in currentTreeGroup" :key="wh.id" class="tree-node" :class="{ active: wh.id === currentWarehouse?.id }" :style="{ paddingLeft: (wh.level - 1) * 16 + 8 + 'px' }">
              <span class="tree-icon">{{ wh.level === 1 ? '\u25C6' : wh.level === 2 ? '\u25C7' : '\u00B7' }}</span>
              <span class="tree-name">{{ wh.name }}</span>
              <span class="tree-status" :class="'st-' + (wh.status === '\u542F\u7528' ? 'on' : 'off')">{{ wh.status }}</span>
            </div>
          </div>
        </section>

        <section class="box heat-box">
          <div class="box-hdr">&#21344;&#29992;&#29575;</div>
          <div class="heat-content">
            <div v-for="loc in locStats" :key="loc.code" class="heat-cell">
              <div class="heat-top">
                <span class="heat-code">{{ loc.code }}</span>
                <span class="heat-pct" :style="{ color: usageColor(loc.usage) }">{{ loc.usage }}%</span>
              </div>
              <div class="heat-bar-track">
                <div class="heat-bar-fill" :style="{ width: loc.usage + '%', background: usageColor(loc.usage) }"></div>
              </div>
            </div>
            <div v-if="locStats.length === 0" class="empty-tip">&#26242;&#26080;&#25968;&#25454;</div>
          </div>
        </section>

        <section class="box alert-box">
          <div class="box-hdr">&#39044;&#35686;&#38647;&#36798;</div>
          <div class="alert-content">
            <div v-for="a in alertList" :key="a.id" class="alert-row" :class="'alert-' + a.level">
              <span class="alert-icon">{{ a.level === 'danger' ? '\u2715' : '\u26A0' }}</span>
              <span class="alert-msg">{{ a.message }}</span>
            </div>
            <div v-if="alertList.length === 0" class="system-ok">
              <span class="ok-icon">&#10003;</span> &#31995;&#32479;&#27491;&#24120;
            </div>
          </div>
        </section>

        <section class="box summary-box">
          <div class="box-hdr">&#20986;&#20837;&#24211;&#27719;&#24635;</div>
          <div class="summary-grid">
            <div class="sum-item sum-in">
              <div class="sum-label">&#20837;&#24211;&#31508;&#25968;</div>
              <div class="sum-val">{{ txSummary.inCount }}</div>
            </div>
            <div class="sum-item sum-in">
              <div class="sum-label">&#20837;&#24211;&#24635;&#37327;</div>
              <div class="sum-val">{{ txSummary.inQty }}</div>
            </div>
            <div class="sum-item sum-out">
              <div class="sum-label">&#20986;&#24211;&#31508;&#25968;</div>
              <div class="sum-val">{{ txSummary.outCount }}</div>
            </div>
            <div class="sum-item sum-out">
              <div class="sum-label">&#20986;&#24211;&#24635;&#37327;</div>
              <div class="sum-val">{{ txSummary.outQty }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import Konva from 'konva'
import request from '@/utils/request'

const isFullscreen = ref(false)
const canvasRef = ref(null)
const clock = ref('')
let clockTimer = null

const isDark = ref(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)

const allWarehouses = ref([])
const topWarehouses = ref([])
const warehouseIdx = ref(0)
const currentWarehouse = computed(() => topWarehouses.value[warehouseIdx.value] || null)

const layoutData = ref(null)
const layoutLayers = ref([])
const layoutRules = ref({ thresholds: [50, 80, 100] })
const activeLayerId = ref('')

const inventoryData = ref([])
const txList = ref([])
const whIndex = ref({ byId: {}, byCode: {} })
const invIndex = ref({ byId: {}, byCode: {} })

let stage = null
let konvaLayer = null
let masterTimer = null
let treeTimer = null

const treeIdx = ref(0)
const currentTreeGroup = computed(() => {
  const top = topWarehouses.value[treeIdx.value]
  if (!top) return []
  return allWarehouses.value.filter(w => w.id === top.id || w.parent_id === top.id || allWarehouses.value.some(p => p.parent_id === top.id && p.id === w.parent_id))
})

const layerKey = (l) => l.area_id || 'root'
const activeLayer = computed(() => layoutLayers.value.find(l => layerKey(l) === activeLayerId.value))
const activeShapes = computed(() => activeLayer.value?.shapes || [])

const stats = reactive({ totalQty: 0, availableQty: 0, lockedQty: 0, materialCount: 0, batchCount: 0, locationCount: 0 })
const capacityPct = ref(0)

const kpiList = computed(() => [
  { label: '\u603B\u5E93\u5B58\u91CF', value: stats.totalQty, color: 'var(--c-primary)' },
  { label: '\u7269\u6599\u79CD\u7C7B', value: stats.materialCount, color: 'var(--c-accent)' },
  { label: '\u53EF\u7528\u5E93\u5B58', value: stats.availableQty, color: 'var(--c-green)' },
  { label: '\u9501\u5B9A\u5E93\u5B58', value: stats.lockedQty, color: 'var(--c-amber)' },
  { label: '\u6279\u6B21\u603B\u6570', value: stats.batchCount, color: 'var(--c-primary)' },
  { label: '\u5E93\u4F4D\u603B\u6570', value: stats.locationCount, color: 'var(--c-accent)' },
])

const txType = (tx) => tx.transaction_type === '\u5165\u5E93' ? 'in' : 'out'

const txSummary = computed(() => {
  let inCount = 0, inQty = 0, outCount = 0, outQty = 0
  txList.value.forEach(tx => {
    if (txType(tx) === 'in') { inCount++; inQty += Math.abs(parseFloat(tx.quantity || 0)) }
    else { outCount++; outQty += Math.abs(parseFloat(tx.quantity || 0)) }
  })
  return { inCount, inQty: inQty.toFixed(2), outCount, outQty: outQty.toFixed(2) }
})

const locStats = ref([])
const alertList = ref([])

const gaugeTrackColor = computed(() => isDark.value ? '#1e293b' : '#e2e8f0')
const gaugeColor = computed(() => usageColor(capacityPct.value))
const gaugeDash = computed(() => {
  const total = 251.33
  const filled = total * capacityPct.value / 100
  return filled + ' ' + (total - filled)
})
const gaugePctColor = computed(() => isDark.value ? '#f8fafc' : '#0f172a')
const gaugeSubColor = computed(() => isDark.value ? '#94a3b8' : '#64748b')

const loadWarehouses = async () => {
  try {
    const list = await request({ url: '/warehouses?order=code.asc', headers: { 'Accept-Profile': 'scm' } }) || []
    allWarehouses.value = list
    topWarehouses.value = list.filter(w => w.level === 1)
    const byId = {}, byCode = {}
    list.forEach(w => { byId[w.id] = w; if (w.code) byCode[w.code] = w })
    whIndex.value = { byId, byCode }
    stats.locationCount = list.filter(w => w.level === 3).length
    if (topWarehouses.value.length) {
      await refresh()
      startCarousel()
    }
  } catch (e) { console.error('loadWarehouses:', e) }
}

const refresh = async () => {
  if (!currentWarehouse.value) return
  await Promise.all([loadLayout(), loadInventory(), loadTransactions()])
}

const loadLayout = async () => {
  try {
    const res = await request({ url: '/warehouse_layouts?warehouse_id=eq.' + currentWarehouse.value.id, headers: { 'Accept-Profile': 'scm' } })
    const rec = res?.[0]
    layoutData.value = rec || null
    layoutRules.value = rec?.rules || { thresholds: [50, 80, 100] }
    layoutLayers.value = rec?.layers || []
    activeLayerId.value = layoutLayers.value.length ? layerKey(layoutLayers.value[0]) : ''
    await nextTick()
    renderCanvas()
  } catch (e) { console.error('loadLayout:', e) }
}

const loadInventory = async () => {
  try {
    const res = await request({ url: '/v_inventory_current?warehouse_code=like.' + currentWarehouse.value.code + '*', headers: { 'Accept-Profile': 'scm' } }) || []
    inventoryData.value = res
    invIndex.value = buildInvIndex(res)
    computeStats()
    computeLocStats()
    computeAlerts()
    if (layoutData.value) { await nextTick(); renderCanvas() }
  } catch (e) { console.error('loadInventory:', e) }
}

const loadTransactions = async () => {
  try {
    const res = await request({ url: '/v_inventory_transactions?warehouse_code=like.' + currentWarehouse.value.code + '*&order=transaction_date.desc&limit=20', headers: { 'Accept-Profile': 'scm' } }) || []
    txList.value = res
  } catch (e) { console.error('loadTransactions:', e) }
}

const startCarousel = () => {
  if (masterTimer) clearInterval(masterTimer)
  masterTimer = setInterval(async () => {
    if (topWarehouses.value.length > 1) {
      warehouseIdx.value = (warehouseIdx.value + 1) % topWarehouses.value.length
    }
    await refresh()
  }, 12000)
  if (treeTimer) clearInterval(treeTimer)
  treeTimer = setInterval(() => {
    if (topWarehouses.value.length > 1) {
      treeIdx.value = (treeIdx.value + 1) % topWarehouses.value.length
    }
  }, 6000)
}

const renderCanvas = () => {
  if (!canvasRef.value) return
  if (stage) stage.destroy()
  const w = canvasRef.value.clientWidth
  const h = canvasRef.value.clientHeight
  if (w < 10 || h < 10) return

  stage = new Konva.Stage({ container: 'dashboard-konva-stage', width: w, height: h })
  konvaLayer = new Konva.Layer()
  stage.add(konvaLayer)

  const shapes = activeShapes.value || []
  if (shapes.length === 0) {
    // No shapes — draw placeholder grid
    const dark = isDark.value
    konvaLayer.add(new Konva.Text({
      x: 0, y: h / 2 - 20, width: w,
      text: currentWarehouse.value ? '\u6682\u65E0\u5E03\u5C40\u6570\u636E' : '\u52A0\u8F7D\u4E2D...',
      fontSize: 16, fill: dark ? '#475569' : '#94a3b8', align: 'center'
    }))
    konvaLayer.draw()
    return
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  shapes.forEach(s => {
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + s.width + 12)
    maxY = Math.max(maxY, s.y + s.height + 12)
  })
  const bw = maxX - minX || 200
  const bh = maxY - minY || 100
  const scale = Math.min((w - 80) / bw, (h - 80) / bh, 3)
  const offsetX = (w - bw * scale) / 2 - minX * scale
  const offsetY = (h - bh * scale) / 2 - minY * scale

  shapes.forEach(s => {
    const sx = s.x * scale + offsetX
    const sy = s.y * scale + offsetY
    const sw = s.width * scale
    const sh = s.height * scale
    const d = 10 * scale
    const dark = isDark.value
    const g = new Konva.Group({ x: sx, y: sy })

    g.add(new Konva.Line({ points: [0, sh, d, sh + d, sw + d, sh + d, sw, sh], fill: dark ? '#1e293b' : '#cbd5e1', closed: true, name: 'bottom' }))
    g.add(new Konva.Line({ points: [sw, 0, sw + d, d, sw + d, sh + d, sw, sh], fill: dark ? '#0f172a' : '#94a3b8', closed: true, name: 'right' }))
    g.add(new Konva.Rect({ width: sw, height: sh, fill: dark ? '#334155' : '#f1f5f9', stroke: dark ? '#475569' : '#e2e8f0', strokeWidth: 1, name: 'top', shadowColor: dark ? 'rgba(56,189,248,0.15)' : 'rgba(0,0,0,0.06)', shadowBlur: 8, shadowOffset: { x: 3, y: 3 } }))
    const fontSize = Math.max(11, Math.min(14 * scale, 22))
    const shelfName = (s.code && whIndex.value.byCode[s.code]?.name) || s.name || s.code || s.type || ''
    g.add(new Konva.Text({ text: shelfName, fontSize, fontStyle: 'bold', fill: dark ? '#94a3b8' : '#475569', width: sw, height: sh * 0.45, y: sh * 0.08, align: 'center', verticalAlign: 'middle', name: 'label' }))
    const mats = getTopMaterials(s)
    const matText = mats.length > 0 ? mats.join('\n') : ''
    const matFS = Math.max(9, Math.min(11 * scale, 16))
    g.add(new Konva.Text({ text: matText, fontSize: matFS, fill: dark ? '#64748b' : '#94a3b8', width: sw, height: sh * 0.5, y: sh * 0.48, align: 'center', verticalAlign: 'top', name: 'matLabel', lineHeight: 1.3 }))
    g.attrs.shelfData = s
    konvaLayer.add(g)
  })
  konvaLayer.draw()
  updateShelfColors()
}

const updateShelfColors = () => {
  if (!konvaLayer) return
  const th = layoutRules.value?.thresholds || [50, 80, 100]
  const dark = isDark.value
  konvaLayer.find('Group').forEach(g => {
    const sd = g.attrs.shelfData
    if (!sd) return
    const inv = getInv(sd)
    const top = g.findOne('.top'), right = g.findOne('.right'), bottom = g.findOne('.bottom'), label = g.findOne('.label')
    const matLabel = g.findOne('.matLabel')
    if (!top || !right || !bottom || !label) return
    // Update name label (code -> Chinese name)
    const shelfName = (sd.code && whIndex.value.byCode[sd.code]?.name) || sd.name || sd.code || sd.type || ''
    label.text(shelfName)
    // Update material text
    if (matLabel) {
      const mats = getTopMaterials(sd)
      matLabel.text(mats.length > 0 ? mats.join('\n') : '')
    }
    if (!inv || inv.totalQty === 0) {
      top.fill(dark ? '#334155' : '#f8fafc'); top.stroke(dark ? '#475569' : '#e2e8f0')
      right.fill(dark ? '#0f172a' : '#e2e8f0'); bottom.fill(dark ? '#1e293b' : '#f1f5f9')
      label.fill(dark ? '#64748b' : '#94a3b8')
      if (matLabel) matLabel.fill(dark ? '#475569' : '#cbd5e1')
    } else {
      const u = inv.capacity > 0 ? (inv.totalQty / inv.capacity) * 100 : 0
      label.fill('#fff')
      if (matLabel) matLabel.fill('rgba(255,255,255,0.75)')
      const c = u < th[0] ? ['#34d399','#10b981','#059669','#10b981'] : u < th[1] ? ['#fbbf24','#f59e0b','#d97706','#f59e0b'] : u < th[2] ? ['#fb923c','#f97316','#ea580c','#f97316'] : ['#f87171','#ef4444','#dc2626','#ef4444']
      top.fill(c[0]); top.stroke(c[1]); right.fill(c[2]); bottom.fill(c[3])
    }
  })
  konvaLayer.draw()
}

const buildInvIndex = (list) => {
  const byId = {}, byCode = {}
  list.forEach(inv => {
    const id = inv.warehouse_id, code = inv.warehouse_code
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
  Object.keys(byId).forEach(id => { const n = whIndex.value.byId[id]; byId[id].capacity = n?.capacity ? parseFloat(n.capacity) : 0 })
  Object.keys(byCode).forEach(c => { const n = whIndex.value.byCode[c]; byCode[c].capacity = n?.capacity ? parseFloat(n.capacity) : 0 })
  return { byId, byCode }
}

const getInv = (shape) => {
  if (!shape) return { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
  return (shape.warehouse_id && invIndex.value.byId[shape.warehouse_id]) || (shape.code && invIndex.value.byCode[shape.code]) || { totalQty: 0, availableQty: 0, lockedQty: 0, capacity: 0 }
}

const getTopMaterials = (shape, limit = 2) => {
  if (!shape) return []
  const matched = inventoryData.value.filter(inv => {
    if (shape.warehouse_id && inv.warehouse_id === shape.warehouse_id) return true
    if (shape.code && inv.warehouse_code === shape.code) return true
    if (shape.code && inv.warehouse_code?.startsWith(shape.code + '.')) return true
    return false
  })
  const map = {}
  matched.forEach(inv => {
    const name = inv.material_name || '?'
    const qty = parseFloat(inv.total_qty || 0)
    if (!map[name]) map[name] = 0
    map[name] += qty
  })
  return Object.entries(map)
    .filter(([, q]) => q > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, qty]) => name + ' ' + qty)
}

const computeStats = () => {
  const materials = new Set(), batches = new Set()
  let tq = 0, aq = 0, lq = 0, totalCap = 0
  inventoryData.value.forEach(inv => {
    materials.add(inv.material_id)
    batches.add(inv.batch_no)
    tq += parseFloat(inv.total_qty || 0)
    aq += parseFloat(inv.available_qty || 0)
    lq += parseFloat(inv.locked_qty || 0)
  })
  Object.values(invIndex.value.byId).forEach(v => totalCap += v.capacity)
  stats.totalQty = tq.toFixed(2)
  stats.availableQty = aq.toFixed(2)
  stats.lockedQty = lq.toFixed(2)
  stats.materialCount = materials.size
  stats.batchCount = batches.size
  capacityPct.value = totalCap > 0 ? Math.min(Math.round(tq / totalCap * 100), 100) : 0
}

const computeLocStats = () => {
  locStats.value = activeShapes.value.map(s => {
    const inv = getInv(s)
    const name = (s.code && whIndex.value.byCode[s.code]?.name) || s.name || s.code || '?'
    return { code: name, usage: inv.capacity > 0 ? Math.min(Math.round(inv.totalQty / inv.capacity * 100), 100) : 0 }
  })
}

const computeAlerts = () => {
  const a = []
  inventoryData.value.forEach(inv => {
    if (!inv.expiry_date) return
    const days = (new Date(inv.expiry_date) - new Date()) / 864e5
    if (days < 0) a.push({ id: 'e' + inv.material_id, level: 'danger', message: inv.material_name + ' \u5DF2\u8FC7\u671F' })
    else if (days < 7) a.push({ id: 'w' + inv.material_id, level: 'warning', message: inv.material_name + ' ' + Math.ceil(days) + '\u5929\u540E\u8FC7\u671F' })
  })
  alertList.value = a
}

const usageColor = (u) => u < 50 ? 'var(--c-green)' : u < 80 ? 'var(--c-amber)' : 'var(--c-red)'
const fmtTime = (s) => { if (!s) return ''; const d = new Date(s); return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') }
const updateClock = () => { clock.value = new Date().toLocaleString('zh-CN', { hour12: false }) }
const toggleFs = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) document.documentElement.requestFullscreen?.()
  else document.exitFullscreen?.()
}

watch(activeLayerId, async () => { if (layoutData.value) { await nextTick(); renderCanvas(); computeLocStats() } })

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (mq) mq.addEventListener('change', e => { isDark.value = e.matches; renderCanvas() })
  loadWarehouses()
})

onBeforeUnmount(() => {
  if (masterTimer) clearInterval(masterTimer)
  if (treeTimer) clearInterval(treeTimer)
  if (clockTimer) clearInterval(clockTimer)
  if (stage) stage.destroy()
})
</script>

<style scoped>
.hud {
  --bg: #f0f4f8;
  --panel: rgba(255,255,255,0.82);
  --border: rgba(14,165,233,0.25);
  --glow: rgba(14,165,233,0.08);
  --glow-strong: rgba(14,165,233,0.2);
  --text1: #0f172a;
  --text2: #64748b;
  --text3: #94a3b8;
  --c-primary: #0ea5e9;
  --c-accent: #8b5cf6;
  --c-green: #10b981;
  --c-amber: #f59e0b;
  --c-red: #ef4444;
  --grid-line: rgba(14,165,233,0.06);
  --shelf-empty: #e2e8f0;
  --scan-color: rgba(14,165,233,0.04);
}
@media (prefers-color-scheme: dark) {
  .hud {
    --bg: #020617;
    --panel: rgba(15,23,42,0.72);
    --border: rgba(56,189,248,0.35);
    --glow: rgba(56,189,248,0.1);
    --glow-strong: rgba(56,189,248,0.25);
    --text1: #f8fafc;
    --text2: #94a3b8;
    --text3: #64748b;
    --c-primary: #38bdf8;
    --c-accent: #a78bfa;
    --c-green: #34d399;
    --c-amber: #fbbf24;
    --c-red: #f87171;
    --grid-line: rgba(56,189,248,0.06);
    --shelf-empty: #334155;
    --scan-color: rgba(56,189,248,0.03);
  }
}
.hud {
  position: relative;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text1);
  font-family: 'DIN Alternate','Helvetica Neue','PingFang SC',sans-serif;
}
.hud.fullscreen { position: fixed; inset: 0; z-index: 9999; }
.hud-bg {
  position: absolute; inset: 0; z-index: 0;
  background-color: var(--bg);
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 40px 40px;
  animation: bgShift 20s linear infinite;
}
@keyframes bgShift { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
.scan-line {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent 0px, var(--scan-color) 2px, transparent 4px);
}
.hud-header {
  position: relative; z-index: 10;
  height: 56px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 0 20px var(--glow);
  backdrop-filter: blur(12px);
  flex-shrink: 0;
}
.hdr-left { display: flex; flex-direction: column; justify-content: center; }
.hdr-title { font-size: 18px; font-weight: 900; color: var(--c-primary); letter-spacing: 2px; text-shadow: 0 0 10px var(--glow-strong); }
.hdr-icon { font-size: 14px; margin-right: 6px; }
.hdr-sub { font-size: 11px; color: var(--text3); letter-spacing: 4px; }
.hdr-center { flex: 1; display: flex; justify-content: center; }
.hdr-right { display: flex; align-items: center; gap: 16px; }
.carousel-badge {
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; color: var(--c-primary);
  background: var(--glow); padding: 6px 24px;
  border-radius: 4px; border: 1px solid var(--border);
  box-shadow: inset 0 0 12px var(--glow);
}
.pulse-dot { width: 8px; height: 8px; background: var(--c-green); border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); } 70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
.wh-name { font-weight: 700; letter-spacing: 1px; }
.wh-code { color: var(--text2); font-size: 13px; }
.carousel-counter { font-size: 12px; color: var(--text3); margin-left: 4px; }
.clock { font-size: 18px; font-weight: 700; color: var(--c-primary); letter-spacing: 1px; }
.fs-btn {
  width: 32px; height: 32px;
  background: transparent; border: 1px solid var(--border); color: var(--c-primary);
  border-radius: 4px; cursor: pointer; font-size: 16px;
}
.fs-btn:hover { background: var(--glow); }
.hud-body {
  position: relative; z-index: 10;
  flex: 1; display: flex; gap: 12px; padding: 12px;
  overflow: hidden; box-sizing: border-box;
  min-height: 0;
}
.col { display: flex; flex-direction: column; gap: 12px; min-height: 0; height: 100%; }
.col-left { width: 22%; flex-shrink: 0; }
.col-center { flex: 1; min-width: 0; }
.col-right { width: 28%; flex-shrink: 0; }
.box {
  position: relative;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex; flex-direction: column;
  overflow: hidden; backdrop-filter: blur(12px);
  box-shadow: inset 0 0 20px var(--glow);
  min-height: 0;
}
.box::before, .box::after {
  content: ''; position: absolute;
  width: 14px; height: 14px;
  border: 2px solid var(--c-primary);
  pointer-events: none; z-index: 3; opacity: 0.6;
}
.box::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.box::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }
.box-hdr {
  padding: 6px 12px; font-size: 11px; font-weight: 700;
  color: var(--c-primary); border-bottom: 1px solid var(--border);
  background: linear-gradient(90deg, var(--glow) 0%, transparent 100%);
  letter-spacing: 1px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
}
.kpi-box { flex: 3; }
.gauge-box { flex: 2; }
.logs-box { flex: 5; }
.canvas-box { flex: 1; }
.tree-box { flex: 2; }
.heat-box { flex: 3; }
.alert-box { flex: 2; }
.summary-box { flex: 2; }
.kpi-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px; }
.kpi {
  background: var(--glow); border: 1px solid var(--border); border-radius: 4px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 2px;
}
.kpi-val { font-size: 18px; font-weight: 800; line-height: 1.2; }
.kpi-label { font-size: 10px; color: var(--text2); margin-top: 1px; }
.gauge-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2px; }
.gauge-svg { width: 100%; max-width: 200px; height: auto; }
.gauge-fill { transition: stroke-dasharray 1s ease; }
.marquee-container { flex: 1; overflow: hidden; position: relative; padding: 6px; min-height: 0; }
.marquee-content { display: flex; flex-direction: column; }
.scrolling { animation: scrollUp linear infinite; }
@keyframes scrollUp { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
.tx-track { display: flex; flex-direction: column; gap: 4px; }
.tx-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; background: var(--glow);
  border: 1px solid var(--border); border-radius: 3px;
  font-size: 12px; line-height: 1.2;
}
.tx-time { color: var(--text3); width: 34px; flex-shrink: 0; font-size: 11px; }
.tx-badge { padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.badge-in { background: rgba(16,185,129,0.15); color: var(--c-green); }
.badge-out { background: rgba(245,158,11,0.15); color: var(--c-amber); }
.tx-name { flex: 1; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx-qty { font-weight: 700; font-size: 12px; width: 36px; text-align: right; flex-shrink: 0; }
.tx-wh { font-size: 10px; color: var(--text3); max-width: 50px; text-align: right; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.text-green { color: var(--c-green) !important; }
.text-amber { color: var(--c-amber) !important; }
.empty-tip { color: var(--text3); font-size: 12px; text-align: center; padding: 12px 0; }
.canvas-body { flex: 1; position: relative; overflow: hidden; background: radial-gradient(circle at center, var(--glow) 0%, transparent 70%); min-height: 0; }
#dashboard-konva-stage { width: 100%; height: 100%; }
.live-tag { font-size: 10px; color: var(--c-red); letter-spacing: 1px; }
.blink-dot { animation: blink 1s infinite; }
@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
.legend-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 4px 10px; border-top: 1px solid var(--border);
  font-size: 10px; color: var(--text2); flex-shrink: 0;
}
.legend-item { display: flex; align-items: center; gap: 3px; }
.legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.tree-content { flex: 1; padding: 4px 6px; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
.tree-node { display: flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
.tree-node.active { background: var(--glow-strong); border: 1px solid var(--border); }
.tree-icon { font-size: 10px; color: var(--c-primary); flex-shrink: 0; }
.tree-name { flex: 1; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tree-code { font-size: 10px; color: var(--text3); font-family: monospace; flex-shrink: 0; }
.tree-status { font-size: 9px; padding: 1px 4px; border-radius: 2px; flex-shrink: 0; }
.st-on { background: rgba(16,185,129,0.15); color: var(--c-green); }
.st-off { background: rgba(239,68,68,0.15); color: var(--c-red); }
.heat-content { flex: 1; padding: 6px; overflow: hidden; display: flex; flex-direction: column; gap: 6px; }
.heat-cell { background: var(--glow); border: 1px solid var(--border); border-radius: 4px; padding: 5px 8px; }
.heat-top { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 3px; }
.heat-code { color: var(--text1); font-weight: 500; }
.heat-pct { font-weight: 700; font-size: 12px; }
.heat-bar-track { height: 4px; background: var(--shelf-empty); border-radius: 2px; overflow: hidden; }
.heat-bar-fill { height: 100%; border-radius: 2px; transition: width 1s ease; }
.alert-content { flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.alert-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 4px; font-size: 12px; }
.alert-danger { background: rgba(239,68,68,0.1); border-left: 3px solid var(--c-red); color: var(--c-red); }
.alert-warning { background: rgba(245,158,11,0.1); border-left: 3px solid var(--c-amber); color: var(--c-amber); }
.alert-icon { font-weight: 900; font-size: 13px; }
.alert-msg { flex: 1; }
.system-ok {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  flex: 1; color: var(--c-green); font-size: 13px; font-weight: 600;
}
.ok-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background: rgba(16,185,129,0.15); border-radius: 50%; font-size: 13px; }
.summary-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 8px; }
.sum-item {
  background: var(--glow); border: 1px solid var(--border); border-radius: 4px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3px;
}
.sum-label { font-size: 10px; color: var(--text2); }
.sum-val { font-size: 16px; font-weight: 800; }
.sum-in .sum-val { color: var(--c-green); }
.sum-out .sum-val { color: var(--c-amber); }
</style>
