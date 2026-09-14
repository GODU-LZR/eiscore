<template>
  <section
    ref="root"
    class="pineapple-process-viewer"
    :style="{ '--process-accent': accent }"
    :aria-label="viewerLabel"
    data-pineapple-process-viewer
  >
    <div class="process-stage">
      <canvas ref="canvas" :aria-label="canvasLabel" />

      <header class="process-heading">
        <div class="process-heading-copy">
          <span class="process-kicker">{{ processKicker }}</span>
          <h2>{{ processTitle }}</h2>
          <p>{{ processPathLabel }}</p>
        </div>
        <span class="process-status" :class="{ 'is-ready': ready }" aria-live="polite">
          <i aria-hidden="true" />
          {{ statusLabel }}
        </span>
      </header>

      <div v-if="unavailable" class="process-fallback" role="status">
        <span class="process-fallback-mark">3D</span>
        <strong>{{ unavailableLabel }}</strong>
        <span>{{ fallbackHint }}</span>
      </div>

      <div v-else class="process-insight-layer">
        <article class="process-station-card" :class="{ 'is-expanded': stationCardExpanded }">
          <span>{{ activeStation ? activeStageLabel : overviewLabel }}</span>
          <div class="process-station-summary">
            <strong>{{ activeStation ? activeStation.label : overviewTitle }}</strong>
            <button
              v-if="mobileView"
              type="button"
              class="process-station-toggle"
              :aria-expanded="stationCardExpanded"
              :aria-label="stationCardToggleLabel"
              @click="toggleStationCard"
            >
              <span aria-hidden="true">{{ stationCardExpanded ? '−' : '+' }}</span>
              <b>{{ stationCardToggleText }}</b>
            </button>
          </div>
          <p class="process-station-state" aria-live="polite" aria-atomic="true">{{ activeStation ? activeStation.status : overviewStatus }}</p>
          <div class="process-station-detail">
            <p>{{ activeStation ? activeStation.detail : overviewDetail }}</p>
            <small>{{ conceptNote }}</small>
          </div>
        </article>

        <aside class="process-branch-legend" :aria-label="branchLegendLabel">
          <span class="branch-legend-title">OUTPUT / 04</span>
          <ul>
            <li v-for="branch in branchItems" :key="branch.id">
              <i :style="{ '--branch-color': branch.color }" aria-hidden="true" />
              <span>{{ branch.label }}</span>
            </li>
          </ul>
        </aside>
      </div>

      <div class="process-interaction-hint">
        <span aria-hidden="true">↔</span>
        {{ interactionHint }}
      </div>

      <footer class="process-footer">
        <div class="process-navigation">
          <div class="process-navigation-meta">
            <span>{{ timelineLabel }}</span>
            <strong>{{ activeStation ? activeStation.label : overviewLabel }}</strong>
          </div>
          <nav :aria-label="timelineAriaLabel">
            <ol>
              <li v-for="(station, index) in stationItems" :key="station.id">
                <button
                  type="button"
                  :class="{ 'is-active': activeStationIndex === index }"
                  :aria-current="activeStationIndex === index ? 'step' : null"
                  @click="focusStation(index)"
                >
                  <span>{{ String(index + 1).padStart(2, '0') }}</span>
                  <strong>{{ station.label }}</strong>
                </button>
              </li>
            </ol>
          </nav>
        </div>

        <div class="process-controls" role="group" :aria-label="controlLabel">
          <button
            type="button"
            class="process-overview-button"
            :class="{ 'is-active': activeStationIndex < 0 }"
            :title="overviewLabel"
            :aria-label="overviewLabel"
            @click="showOverview"
          >
            <span aria-hidden="true">⌁</span>
            <b>{{ overviewLabel }}</b>
          </button>
          <button
            type="button"
            class="process-inspection-button"
            :class="{ 'is-active': autoInspecting }"
            :disabled="reducedMotionActive"
            :title="autoInspectionLabel"
            :aria-label="autoInspectionLabel"
            :aria-pressed="autoInspecting"
            @click="toggleAutoInspection"
          >
            <span aria-hidden="true">◌</span>
            <b>{{ autoInspectionLabel }}</b>
          </button>
          <button
            type="button"
            :title="playing ? pauseLabel : playLabel"
            :aria-label="playing ? pauseLabel : playLabel"
            @click="togglePlaying"
          >
            <span aria-hidden="true">{{ playing ? 'Ⅱ' : '▶' }}</span>
          </button>
          <button type="button" :title="zoomInLabel" :aria-label="zoomInLabel" @click="zoom(0.84)">+</button>
          <button type="button" :title="zoomOutLabel" :aria-label="zoomOutLabel" @click="zoom(1.19)">−</button>
          <button type="button" :title="resetLabel" :aria-label="resetLabel" @click="resetView">↻</button>
        </div>
      </footer>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  PINEAPPLE_BRANCHES,
  PINEAPPLE_PROCESS_STATIONS,
  createPineappleProcessScene,
  updatePineappleProcessScene
} from './product-3d/pineapple-process-scene.js'

const props = defineProps({
  productName: { type: String, default: '' },
  category: { type: String, default: '' },
  summary: { type: String, default: '' },
  accentColor: { type: String, default: '#3b8061' },
  locale: { type: String, default: 'zh-CN' }
})

const root = ref(null)
const canvas = ref(null)
const ready = ref(false)
const unavailable = ref(false)
const playing = ref(true)
const mobileView = ref(false)
const activeStationIndex = ref(-1)
const stationCardExpanded = ref(false)
const autoInspecting = ref(false)
const reducedMotionActive = ref(false)

const isEnglish = computed(() => String(props.locale || '').toLowerCase().startsWith('en'))
const accent = computed(() => /^#[0-9a-f]{6}$/i.test(props.accentColor) ? props.accentColor : '#3b8061')
const stationStatuses = Object.freeze({
  raw: { zh: '原料入线', en: 'Raw fruit infeed' },
  prepare: { zh: '清洗切分', en: 'Washing & cutting' },
  extract: { zh: '螺旋压榨', en: 'Spiral pressing' },
  split: { zh: '四路分配', en: 'Four-way distribution' },
  pack: { zh: '包装下线', en: 'Finished-pack outfeed' }
})
const stationItems = computed(() => PINEAPPLE_PROCESS_STATIONS.map((station) => ({
  ...station,
  label: isEnglish.value ? station.labelEn : station.labelZh,
  detail: isEnglish.value ? station.detailEn : station.detailZh,
  status: isEnglish.value ? stationStatuses[station.id]?.en : stationStatuses[station.id]?.zh
})))
const branchItems = computed(() => PINEAPPLE_BRANCHES.map((branch) => ({
  ...branch,
  label: isEnglish.value ? branch.labelEn : branch.labelZh
})))
const activeStation = computed(() => activeStationIndex.value >= 0 ? stationItems.value[activeStationIndex.value] : null)

const processKicker = computed(() => isEnglish.value ? 'PROCESS PATH / DIGITAL TWIN' : 'PROCESS PATH / 数字工艺路径')
const processTitle = computed(() => isEnglish.value ? 'Pineapple · from raw fruit to finished packs' : '菠萝 · 从原料到包装成品')
const processPathLabel = computed(() => isEnglish.value
  ? 'Raw fruit → Preparation → Juice / pulping → 4 product streams → Finished packs'
  : '菠萝原料 → 预处理 → 榨汁 / 打浆 → 果汁、果泥、果粒、果馅分流 → 包装成品')
const overviewTitle = computed(() => isEnglish.value ? 'Full process overview' : '菠萝加工全链路')
const overviewDetail = computed(() => isEnglish.value
  ? 'Follow one material stream as it separates into juice, puree, pieces and filling.'
  : '沿一条物料主线观察加工过程，并在后段分流为果汁、果泥、果粒与果馅。')
const overviewStatus = computed(() => isEnglish.value ? 'Full line ready for inspection' : '全链路待巡检')
const conceptNote = computed(() => isEnglish.value
  ? 'Concept model · sequence, equipment and pack specifications are subject to enterprise confirmation.'
  : '加工路径概念模型 · 工序、设备形态及包装规格以企业最终确认为准。')
const viewerLabel = computed(() => isEnglish.value
  ? 'Interactive 3D pineapple processing path'
  : '菠萝从原料到包装成品的交互式 3D 加工路径')
const canvasLabel = computed(() => isEnglish.value
  ? 'Interactive 3D scene. Drag to rotate, and pinch or scroll to zoom.'
  : '交互式 3D 场景，可拖动旋转，并通过双指或滚轮缩放。')
const interactionHint = computed(() => mobileView.value
  ? (isEnglish.value ? 'Drag to rotate · pinch to zoom' : '单指拖动旋转 · 双指缩放')
  : (isEnglish.value ? 'Drag to rotate · scroll to zoom' : '拖动旋转 · 滚轮缩放'))
const statusLabel = computed(() => {
  if (!ready.value) return isEnglish.value ? 'Loading model' : '模型载入中'
  if (!playing.value) return isEnglish.value ? 'Flow paused' : '物料流已暂停'
  return isEnglish.value ? 'Model online' : '模型运行中'
})
const activeStageLabel = computed(() => (isEnglish.value ? 'STAGE ' : '工序 ') + String(activeStationIndex.value + 1).padStart(2, '0') + ' / 05')
const overviewLabel = computed(() => isEnglish.value ? 'Overview' : '全链路')
const timelineLabel = computed(() => isEnglish.value ? 'PROCESS SEQUENCE · 05' : '加工序列 · 05')
const timelineAriaLabel = computed(() => isEnglish.value ? 'Processing stages' : '菠萝加工阶段')
const branchLegendLabel = computed(() => isEnglish.value ? 'Four output product streams' : '四类产品分流')
const controlLabel = computed(() => isEnglish.value ? '3D view controls' : '3D 视图控制')
const unavailableLabel = computed(() => isEnglish.value ? '3D preview is unavailable' : '当前设备无法启用 3D 预览')
const fallbackHint = computed(() => isEnglish.value ? 'The process description remains available.' : '加工路径说明仍然可用。')
const zoomInLabel = computed(() => isEnglish.value ? 'Zoom in' : '放大')
const zoomOutLabel = computed(() => isEnglish.value ? 'Zoom out' : '缩小')
const resetLabel = computed(() => isEnglish.value ? 'Reset view' : '重置视角')
const playLabel = computed(() => isEnglish.value ? 'Play material flow' : '播放物料流')
const pauseLabel = computed(() => isEnglish.value ? 'Pause material flow' : '暂停物料流')
const startInspectionLabel = computed(() => isEnglish.value ? 'Start automatic inspection' : '自动巡检')
const stopInspectionLabel = computed(() => isEnglish.value ? 'Stop automatic inspection' : '停止巡检')
const autoInspectionLabel = computed(() => reducedMotionActive.value
  ? (isEnglish.value ? 'Automatic inspection follows motion settings' : '自动巡检已遵循系统动效设置关闭')
  : (autoInspecting.value ? stopInspectionLabel.value : startInspectionLabel.value))
const stationCardToggleText = computed(() => stationCardExpanded.value
  ? (isEnglish.value ? 'Hide detail' : '收起详情')
  : (isEnglish.value ? 'View detail' : '查看详情'))
const stationCardToggleLabel = computed(() => stationCardToggleText.value)

let renderer
let scene
let camera
let controls
let processRuntime
let rimLight
let keyLight
let hemisphereLight
let fillLight
let animationFrame = 0
let resizeObserver
let intersectionObserver
let isInViewport = true
let isDocumentVisible = true
let reducedMotion = false
let reducedMotionQuery
let cameraTween = null
let autoInspectionTimer = 0
let lastFrameTime = null
let qualitySampleFrames = 0
let qualitySampleTotal = 0
let qualityDpr = 0
let qualityDprMin = 0.5
let qualityDprMax = 1.45
let qualityDegraded = false
let qualityFrameInterval = 0
let lastRenderTime = null

const canRender = () => Boolean(renderer && scene && camera && isInViewport && isDocumentVisible)

const requestRender = () => {
  if (!animationFrame && canRender()) animationFrame = window.requestAnimationFrame(animate)
}

const cancelRender = () => {
  if (!animationFrame) return
  window.cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

const shouldUseStandardMaterials = () => {
  const isMobileDevice = window.innerWidth <= 760 || window.matchMedia?.('(pointer: coarse)')?.matches
  if (isMobileDevice || qualityDegraded) return true
  const gl = renderer?.getContext?.()
  const debugInfo = gl?.getExtension?.('WEBGL_debug_renderer_info')
  const rendererName = debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
    : ''
  return /swiftshader|llvmpipe|softpipe|software rasterizer|angle \(.*software/i.test(rendererName)
}

const isSoftwareRenderer = () => {
  const gl = renderer?.getContext?.()
  const debugInfo = gl?.getExtension?.('WEBGL_debug_renderer_info')
  const rendererName = debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
    : ''
  return /swiftshader|llvmpipe|softpipe|software rasterizer|angle \(.*software/i.test(rendererName)
}

const downgradeMaterialsForPerformance = () => {
  if (!scene || !shouldUseStandardMaterials()) return
  const fallbackCache = new Map()
  const MaterialClass = isSoftwareRenderer() ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial
  scene.traverse((object) => {
    if (!object.isMesh || !object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const optimized = materials.map((material) => {
      if (!material?.isMeshPhysicalMaterial || material.userData?.standardFallback) return material
      if (fallbackCache.has(material)) return fallbackCache.get(material)
      const fallback = new MaterialClass({
        color: material.color,
        roughness: material.roughness,
        metalness: material.metalness,
        emissive: material.emissive,
        emissiveIntensity: material.emissiveIntensity,
        transparent: material.transparent,
        opacity: material.opacity,
        side: material.side,
        depthWrite: material.depthWrite,
        map: material.map,
        bumpMap: material.bumpMap,
        bumpScale: material.bumpScale,
        envMapIntensity: material.envMapIntensity,
        toneMapped: material.toneMapped
      })
      fallback.name = `${material.name || 'physical'}-standard-fallback`
      fallback.userData.standardFallback = true
      fallbackCache.set(material, fallback)
      material.dispose()
      return fallback
    })
    object.material = Array.isArray(object.material) ? optimized : optimized[0]
  })
}

const applyRenderQuality = () => {
  if (!renderer) return
  const isMobile = mobileView.value
  const deviceDpr = window.devicePixelRatio || 1
  qualityDprMax = isMobile ? 1.05 : 1.35
  qualityDprMin = isMobile ? 0.55 : 0.5
  qualityDpr = THREE.MathUtils.clamp(
    qualityDpr || Math.min(deviceDpr, qualityDprMax),
    qualityDprMin,
    qualityDprMax
  )
  renderer.setPixelRatio(qualityDpr)
  qualityFrameInterval = qualityDegraded ? (isMobile ? 1000 / 24 : 1000 / 30) : 0
  if (keyLight) {
    const shadowsEnabled = !isMobile && !qualityDegraded
    renderer.shadowMap.enabled = shadowsEnabled
    renderer.shadowMap.autoUpdate = shadowsEnabled
    keyLight.castShadow = shadowsEnabled
    keyLight.shadow.mapSize.set(isMobile ? 256 : (qualityDegraded ? 384 : 768), isMobile ? 256 : (qualityDegraded ? 384 : 768))
    renderer.shadowMap.needsUpdate = true
  }
  const lightScale = qualityDegraded ? (isSoftwareRenderer() ? 0.62 : 0.82) : 1
  if (hemisphereLight) hemisphereLight.intensity = 2.55 * lightScale
  if (keyLight) keyLight.intensity = 4.1 * lightScale
  if (fillLight) fillLight.intensity = 2.15 * lightScale
  if (rimLight) rimLight.intensity = 2.35 * lightScale
}

const sampleRenderQuality = (time) => {
  if (lastFrameTime == null) {
    lastFrameTime = time
    return
  }
  const frameDuration = time - lastFrameTime
  lastFrameTime = time
  if (frameDuration <= 0) return
  qualitySampleFrames += 1
  qualitySampleTotal += Math.min(frameDuration, 250)
  if (qualitySampleFrames < 18) return
  const average = qualitySampleTotal / qualitySampleFrames
  const shouldDegrade = average > 28
  if (shouldDegrade && !qualityDegraded) {
    qualityDegraded = true
    downgradeMaterialsForPerformance()
    applyRenderQuality()
  }
  const targetDpr = average > 25
    ? qualityDpr - 0.1
    : (average < 14 ? qualityDpr + 0.05 : qualityDpr)
  const nextDpr = THREE.MathUtils.clamp(targetDpr, qualityDprMin, qualityDprMax)
  qualitySampleFrames = 0
  qualitySampleTotal = 0
  if (Math.abs(nextDpr - qualityDpr) < 0.01) return
  qualityDpr = nextDpr
  renderer?.setPixelRatio(qualityDpr)
  const stage = root.value?.querySelector('.process-stage')
  if (stage && renderer) renderer.setSize(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight || 360), false)
}

const stopAutoInspection = () => {
  if (autoInspectionTimer) window.clearInterval(autoInspectionTimer)
  autoInspectionTimer = 0
  autoInspecting.value = false
}

const advanceAutoInspection = () => {
  const nextIndex = activeStationIndex.value < 0
    ? 0
    : (activeStationIndex.value + 1) % PINEAPPLE_PROCESS_STATIONS.length
  focusStation(nextIndex, false, true)
}

const startAutoInspection = () => {
  if (reducedMotion || !camera || !controls) return
  stopAutoInspection()
  autoInspecting.value = true
  advanceAutoInspection()
  autoInspectionTimer = window.setInterval(advanceAutoInspection, 5200)
}

const toggleAutoInspection = () => {
  if (autoInspecting.value) stopAutoInspection()
  else startAutoInspection()
}

const toggleStationCard = () => {
  stopAutoInspection()
  stationCardExpanded.value = !stationCardExpanded.value
}

const disposeObject = (object) => {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  object?.traverse?.((child) => {
    if (child.geometry && !geometries.has(child.geometry)) {
      geometries.add(child.geometry)
      child.geometry.dispose?.()
    }
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
    childMaterials.filter(Boolean).forEach((material) => {
      if (materials.has(material)) return
      materials.add(material)
      ;['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap'].forEach((mapKey) => {
        const texture = material[mapKey]
        if (!texture || textures.has(texture)) return
        textures.add(texture)
        texture.dispose?.()
      })
      material.dispose?.()
    })
  })
}

const setCameraPose = (position, target, immediate = false) => {
  if (!camera || !controls) return
  if (immediate || reducedMotion) {
    camera.position.copy(position)
    controls.target.copy(target)
    controls.update()
    cameraTween = null
    requestRender()
    return
  }
  cameraTween = {
    startedAt: performance.now(),
    duration: 760,
    fromPosition: camera.position.clone(),
    toPosition: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone()
  }
  requestRender()
}

const showOverview = (immediate = false) => {
  if (!camera || !controls) return
  stopAutoInspection()
  activeStationIndex.value = -1
  if (processRuntime) processRuntime.activeStationIndex = -1
  stationCardExpanded.value = false
  const position = mobileView.value
    ? new THREE.Vector3(0.7, 28, 86)
    : new THREE.Vector3(0.7, 11.8, 30)
  setCameraPose(position, new THREE.Vector3(0.7, 0.15, 0), immediate)
}

const focusStation = (index, immediate = false, fromAutoInspection = false) => {
  const station = PINEAPPLE_PROCESS_STATIONS[index]
  if (!station || !camera || !controls) return
  if (!fromAutoInspection) stopAutoInspection()
  activeStationIndex.value = index
  if (processRuntime) processRuntime.activeStationIndex = index
  if (!fromAutoInspection) stationCardExpanded.value = false
  const isWideStation = station.id === 'split' || station.id === 'pack'
  const position = mobileView.value
    ? new THREE.Vector3(station.x + (isWideStation ? 5.4 : 3.3), isWideStation ? 8.8 : 6.8, isWideStation ? 16.4 : 12.8)
    : new THREE.Vector3(station.x + (isWideStation ? 5.6 : 3.2), isWideStation ? 7.2 : 5.8, isWideStation ? 14.2 : 11.8)
  setCameraPose(position, new THREE.Vector3(station.x, 0.25, 0), immediate)
}

const resetView = (immediate = false) => {
  stopAutoInspection()
  if (mobileView.value) focusStation(0, immediate)
  else showOverview(immediate)
}

const resize = () => {
  if (!renderer || !camera || !root.value) return
  const stage = root.value.querySelector('.process-stage')
  const width = Math.max(1, stage?.clientWidth || root.value.clientWidth)
  const height = Math.max(1, stage?.clientHeight || 360)
  const wasMobile = mobileView.value
  mobileView.value = width <= 760
  if (wasMobile !== mobileView.value || !qualityDpr) {
    qualityDpr = Math.min(window.devicePixelRatio || 1, mobileView.value ? 1.05 : 1.35)
  }
  applyRenderQuality()
  if (mobileView.value) downgradeMaterialsForPerformance()
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  if (ready.value && wasMobile !== mobileView.value) resetView(true)
  requestRender()
}

const zoom = (factor) => {
  if (!camera || !controls) return
  stopAutoInspection()
  cameraTween = null
  const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor)
  const distance = THREE.MathUtils.clamp(offset.length(), 5.2, 110)
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance))
  controls.update()
  requestRender()
}

const togglePlaying = () => {
  stopAutoInspection()
  playing.value = !playing.value
  requestRender()
}

const handleReducedMotionChange = (event) => {
  reducedMotion = event.matches === true
  reducedMotionActive.value = reducedMotion
  if (reducedMotion) {
    stopAutoInspection()
    cameraTween = null
    playing.value = false
  }
  requestRender()
}

const updateCameraTween = (time) => {
  if (!cameraTween || !camera || !controls) return
  const progress = THREE.MathUtils.clamp((time - cameraTween.startedAt) / cameraTween.duration, 0, 1)
  const eased = 1 - Math.pow(1 - progress, 3)
  camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased)
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased)
  if (progress >= 1) cameraTween = null
}

const animate = (time = 0) => {
  animationFrame = 0
  if (!canRender()) return
  if (qualityFrameInterval && lastRenderTime != null && time - lastRenderTime < qualityFrameInterval) {
    requestRender()
    return
  }
  lastRenderTime = time
  sampleRenderQuality(time)
  updateCameraTween(time)
  updatePineappleProcessScene(processRuntime, time * 0.001, playing.value && !reducedMotion)
  controls?.update()
  renderer?.render(scene, camera)
  if ((playing.value && !reducedMotion) || cameraTween !== null) requestRender()
}

const rebuildScene = () => {
  if (!scene || !ready.value) return
  if (processRuntime?.group) {
    scene.remove(processRuntime.group)
    disposeObject(processRuntime.group)
  }
  processRuntime = createPineappleProcessScene({ accent: accent.value })
  scene.add(processRuntime.group)
  downgradeMaterialsForPerformance()
  rimLight?.color.set(accent.value)
  resetView(true)
}

watch([() => props.productName, () => props.category, accent], rebuildScene)

onMounted(() => {
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  reducedMotion = reducedMotionQuery?.matches === true
  reducedMotionActive.value = reducedMotion
  playing.value = !reducedMotion
  reducedMotionQuery?.addEventListener?.('change', handleReducedMotionChange)
  try {
    scene = new THREE.Scene()
    // Treat the process as a clean product-lab exhibit: a pure white field
    // keeps the food materials and sanitary-steel silhouettes legible.
    scene.background = new THREE.Color('#ffffff')
    scene.fog = new THREE.Fog('#ffffff', 34, 78)
    camera = new THREE.PerspectiveCamera(31, 1, 0.1, 160)
    renderer = new THREE.WebGLRenderer({
      canvas: canvas.value,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    controls = new OrbitControls(camera, canvas.value)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 5.2
    controls.maxDistance = 110
    controls.minPolarAngle = 0.22
    controls.maxPolarAngle = Math.PI * 0.49
    controls.autoRotate = false
    controls.addEventListener('start', () => {
      cameraTween = null
      stopAutoInspection()
      requestRender()
    })
    controls.addEventListener('change', requestRender)

    hemisphereLight = new THREE.HemisphereLight('#ffffff', '#dce5e1', 2.55)
    scene.add(hemisphereLight)
    keyLight = new THREE.DirectionalLight('#fff8e4', 4.1)
    keyLight.position.set(-6, 13, 10)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(768, 768)
    keyLight.shadow.camera.left = -20
    keyLight.shadow.camera.right = 20
    keyLight.shadow.camera.top = 12
    keyLight.shadow.camera.bottom = -12
    scene.add(keyLight)
    fillLight = new THREE.DirectionalLight('#b8d9d0', 2.15)
    fillLight.position.set(12, 6, -8)
    scene.add(fillLight)
    rimLight = new THREE.DirectionalLight(accent.value, 2.35)
    rimLight.position.set(-14, 5, -6)
    scene.add(rimLight)

    processRuntime = createPineappleProcessScene({ accent: accent.value })
    scene.add(processRuntime.group)
    if (shouldUseStandardMaterials()) qualityDegraded = true
    downgradeMaterialsForPerformance()
    applyRenderQuality()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(root.value)
    if (typeof IntersectionObserver === 'function') {
      intersectionObserver = new IntersectionObserver((entries) => {
        isInViewport = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)
        if (isInViewport) requestRender()
        else cancelRender()
      }, { threshold: 0.01 })
      intersectionObserver.observe(root.value)
    }
    const handleVisibilityChange = () => {
      isDocumentVisible = document.visibilityState !== 'hidden'
      if (isDocumentVisible) {
        lastFrameTime = null
        lastRenderTime = null
        requestRender()
      } else {
        cancelRender()
      }
    }
    root.value.__pineappleVisibilityHandler = handleVisibilityChange
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true })
    resize()
    resetView(true)
    ready.value = true
    requestRender()
  } catch (error) {
    unavailable.value = true
    console.warn('[pineapple-process-viewer] WebGL unavailable', error)
  }
})

onBeforeUnmount(() => {
  cancelRender()
  stopAutoInspection()
  reducedMotionQuery?.removeEventListener?.('change', handleReducedMotionChange)
  resizeObserver?.disconnect?.()
  intersectionObserver?.disconnect?.()
  if (root.value?.__pineappleVisibilityHandler) {
    document.removeEventListener('visibilitychange', root.value.__pineappleVisibilityHandler)
    delete root.value.__pineappleVisibilityHandler
  }
  controls?.dispose?.()
  if (processRuntime?.group) disposeObject(processRuntime.group)
  renderer?.dispose?.()
  renderer = null
  scene = null
  camera = null
  controls = null
  keyLight = null
  hemisphereLight = null
  fillLight = null
  processRuntime = null
})
</script>

<style scoped src="./product-3d/pineapple-process-viewer.css"></style>
