<template>
  <section
    ref="root"
    class="product-3d-viewer"
    :class="{ 'is-unavailable': unavailable }"
    :style="{ '--viewer-accent': accent }"
    :aria-label="viewerLabel"
    data-product-viewer
  >
    <div class="viewer-stage">
      <canvas ref="canvas" :aria-label="canvasLabel"></canvas>
      <div class="viewer-heading">
        <div>
          <span class="viewer-kicker">PRODUCT SYSTEM / 3D</span>
          <h2>{{ productName || fallbackProductName }}</h2>
        </div>
        <span class="viewer-status" :class="{ 'is-ready': ready }">{{ ready ? readyLabel : loadingLabel }}</span>
      </div>
      <div v-if="unavailable" class="viewer-fallback" role="status">
        <span class="viewer-fallback-mark">3D</span>
        <strong>{{ unavailableLabel }}</strong>
        <span>{{ fallbackHint }}</span>
      </div>
      <div class="viewer-axis viewer-axis-x">X</div>
      <div class="viewer-axis viewer-axis-y">Y</div>
      <div class="viewer-axis viewer-axis-z">Z</div>
      <div class="viewer-corner viewer-corner-top">LIVE PREVIEW</div>
      <div class="viewer-corner viewer-corner-bottom">{{ category || fallbackCategory }}</div>
      <div class="viewer-footer">
        <div class="viewer-copy">
          <span>{{ viewerModeLabel }}</span>
          <strong>{{ productSummary }}</strong>
        </div>
        <div class="viewer-controls" role="group" :aria-label="controlLabel">
          <button type="button" title="放大" :aria-label="zoomInLabel" @click="zoom(0.82)">+</button>
          <button type="button" title="缩小" :aria-label="zoomOutLabel" @click="zoom(1.22)">−</button>
          <button type="button" title="重置视角" :aria-label="resetLabel" @click="resetView">↻</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps({
  productName: { type: String, default: '' },
  category: { type: String, default: '' },
  summary: { type: String, default: '' },
  accentColor: { type: String, default: '#3b82f6' },
  locale: { type: String, default: 'zh-CN' }
})

const root = ref(null)
const canvas = ref(null)
const ready = ref(false)
const unavailable = ref(false)

const isEnglish = computed(() => props.locale.toLowerCase().startsWith('en'))
const accent = computed(() => /^#[0-9a-f]{6}$/i.test(props.accentColor) ? props.accentColor : '#3b82f6')
const fallbackProductName = computed(() => isEnglish.value ? 'Product preview' : '产品预览')
const fallbackCategory = computed(() => isEnglish.value ? 'CONFIGURABLE PRODUCT' : '可配置产品')
const productName = computed(() => String(props.productName || '').trim())
const productSummary = computed(() => String(props.summary || '').trim() || (isEnglish.value ? 'Explore the product before you enter the workspace.' : '先了解产品，再进入企业工作台。'))
const viewerLabel = computed(() => isEnglish.value ? `3D product preview for ${productName.value || fallbackProductName.value}` : `${productName.value || fallbackProductName.value} 3D 产品预览`)
const canvasLabel = computed(() => isEnglish.value ? 'Interactive 3D product preview. Drag to rotate and scroll to zoom.' : '交互式 3D 产品预览，可拖动旋转并滚动缩放。')
const controlLabel = computed(() => isEnglish.value ? '3D view controls' : '3D 视图控制')
const loadingLabel = computed(() => isEnglish.value ? 'Loading' : '载入中')
const readyLabel = computed(() => isEnglish.value ? 'Ready' : '已就绪')
const unavailableLabel = computed(() => isEnglish.value ? '3D preview is unavailable' : '当前设备无法启用 3D 预览')
const fallbackHint = computed(() => isEnglish.value ? 'The product information remains available.' : '产品信息仍然可用。')
const zoomInLabel = computed(() => isEnglish.value ? 'Zoom in' : '放大')
const zoomOutLabel = computed(() => isEnglish.value ? 'Zoom out' : '缩小')
const resetLabel = computed(() => isEnglish.value ? 'Reset view' : '重置视角')
const viewerModeLabel = computed(() => isEnglish.value ? 'STANDARD VIEWER' : '标准展示框架')

let renderer
let scene
let camera
let controls
let productGroup
let animationFrame = 0
let resizeObserver
let reducedMotion = false

const disposeObject = (object) => {
  object.traverse((child) => {
    child.geometry?.dispose?.()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.filter(Boolean).forEach((material) => {
      material.map?.dispose?.()
      material.dispose?.()
    })
  })
}

const material = (color, options = {}) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: options.roughness ?? 0.38,
  metalness: options.metalness ?? 0.12,
  clearcoat: options.clearcoat ?? 0.3,
  clearcoatRoughness: 0.22
})

const addCueModel = (group) => {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 4.8, 48), material('#9a6849', { roughness: 0.5 }))
  body.rotation.z = Math.PI / 2
  body.position.x = -0.05
  group.add(body)

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.19, 3.35, 40), material('#d9b882', { roughness: 0.47 }))
  shaft.rotation.z = Math.PI / 2
  shaft.position.x = 3.95
  group.add(shaft)

  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 32), material('#4b3328', { roughness: 0.82 }))
  tip.rotation.z = Math.PI / 2
  tip.position.x = 5.7
  group.add(tip)

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 12, 36), material(accent.value, { metalness: 0.72, roughness: 0.22 }))
  ring.rotation.y = Math.PI / 2
  ring.position.x = 2.38
  group.add(ring)

  const buttCap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 40), material('#1f2937', { metalness: 0.55, roughness: 0.3 }))
  buttCap.rotation.z = Math.PI / 2
  buttCap.position.x = -2.5
  group.add(buttCap)
}

const addGenericModel = (group) => {
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.7, 1.8), material('#e5e7eb', { roughness: 0.29, metalness: 0.24, clearcoat: 0.55 }))
  shell.position.y = 0.45
  group.add(shell)

  const core = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.18, 1.25), material(accent.value, { roughness: 0.32, metalness: 0.18, clearcoat: 0.65 }))
  core.position.set(0, 1.34, 0)
  group.add(core)

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.045, 12, 40), material(accent.value, { metalness: 0.72, roughness: 0.2 }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 1.48
  group.add(ring)

  const feet = [-1, 1].flatMap((x) => [-1, 1].map((z) => [x * 0.95, -0.52, z * 0.55]))
  feet.forEach(([x, y, z]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.24, 20), material('#27313a', { metalness: 0.6, roughness: 0.28 }))
    foot.position.set(x, y, z)
    group.add(foot)
  })
}

const buildModel = () => {
  productGroup = new THREE.Group()
  const haystack = `${productName.value} ${props.category}`.toLowerCase()
  if (/cue|billiard|台球杆|球杆/.test(haystack)) addCueModel(productGroup)
  else addGenericModel(productGroup)
  productGroup.rotation.set(0.12, -0.28, 0.08)
  productGroup.position.y = 0.18
  scene.add(productGroup)
}

const resize = () => {
  if (!renderer || !camera || !root.value) return
  const stage = root.value.querySelector('.viewer-stage')
  const width = Math.max(1, stage?.clientWidth || root.value.clientWidth)
  const height = Math.max(1, stage?.clientHeight || 360)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

const resetView = () => {
  if (!camera || !controls) return
  camera.position.set(0, 2.4, 8.2)
  controls.target.set(0, 0.35, 0)
  controls.update()
}

const zoom = (factor) => {
  if (!camera || !controls) return
  const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor)
  const distance = THREE.MathUtils.clamp(offset.length(), 4.4, 13)
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance))
  controls.update()
}

const animate = () => {
  animationFrame = window.requestAnimationFrame(animate)
  controls?.update()
  renderer?.render(scene, camera)
}

watch([productName, () => props.category, accent], () => {
  if (!scene || !ready.value) return
  if (productGroup) {
    scene.remove(productGroup)
    disposeObject(productGroup)
  }
  buildModel()
})

onMounted(() => {
  reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  try {
    scene = new THREE.Scene()
    scene.background = new THREE.Color('#101b22')
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 2.4, 8.2)
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    controls = new OrbitControls(camera, canvas.value)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 4.4
    controls.maxDistance = 13
    controls.target.set(0, 0.35, 0)
    controls.autoRotate = !reducedMotion
    controls.autoRotateSpeed = 0.75

    scene.add(new THREE.HemisphereLight('#f0f5f7', '#0c1115', 2.2))
    const key = new THREE.DirectionalLight('#ffffff', 3.4)
    key.position.set(4, 7, 5)
    key.castShadow = true
    scene.add(key)
    const rim = new THREE.DirectionalLight(accent.value, 2.2)
    rim.position.set(-5, 3, -4)
    scene.add(rim)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshStandardMaterial({ color: '#15242b', roughness: 0.84, metalness: 0.12 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.67
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(8, 16, '#3b5660', '#21363e')
    grid.position.y = -0.65
    grid.material.transparent = true
    grid.material.opacity = 0.34
    scene.add(grid)
    buildModel()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(root.value)
    resize()
    ready.value = true
    animate()
  } catch (error) {
    unavailable.value = true
    console.warn('[product-3d-viewer] WebGL unavailable', error)
  }
})

onBeforeUnmount(() => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect?.()
  controls?.dispose?.()
  if (productGroup) disposeObject(productGroup)
  renderer?.dispose?.()
  renderer = null
  scene = null
  camera = null
  controls = null
})
</script>

<style scoped>
.product-3d-viewer {
  --viewer-accent: #3b82f6;
  position: relative;
  width: 100vw;
  height: 100%;
  min-height: 100svh;
  max-width: none;
  box-sizing: border-box;
  padding: 0;
  color: #eef5f6;
  border: 0;
  background: rgba(10, 24, 31, .56);
  box-shadow: none;
}
.viewer-heading, .viewer-footer { position: absolute; left: 0; right: 0; z-index: 3; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: clamp(16px, 2vw, 30px); pointer-events: none; }
.viewer-heading { top: 0; background: linear-gradient(180deg, rgba(7, 18, 24, .82), transparent); }
.viewer-footer { bottom: 0; align-items: flex-end; background: linear-gradient(0deg, rgba(7, 18, 24, .86), transparent); }
.viewer-kicker, .viewer-status, .viewer-corner, .viewer-axis, .viewer-copy span { color: rgba(221, 241, 240, .58); font: 700 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }
.viewer-heading h2 { margin: 7px 0 0; max-width: 760px; color: #fff; font-size: clamp(20px, 2vw, 32px); line-height: 1.15; }
.viewer-status { padding: 6px 8px; border: 1px solid rgba(221, 241, 240, .2); white-space: nowrap; }
.viewer-status.is-ready { color: #bdebd3; border-color: rgba(116, 214, 164, .42); }
.viewer-stage { position: relative; width: 100vw; max-width: none; height: 100%; min-height: 100svh; box-sizing: border-box; margin: 0; overflow: hidden; border: 0; background: #101b22; }
canvas { display: block; width: 100vw; max-width: none; height: 100%; cursor: grab; }
canvas:active { cursor: grabbing; }
.viewer-fallback { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 8px; padding: 30px; text-align: center; background: #101b22; }
.viewer-fallback-mark { display: grid; place-items: center; width: 52px; height: 52px; border: 1px solid color-mix(in srgb, var(--viewer-accent) 62%, #fff); color: var(--viewer-accent); font: 800 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
.viewer-fallback strong { color: #fff; font-size: 14px; }
.viewer-fallback > span:last-child { color: rgba(221, 241, 240, .62); font-size: 11px; }
.viewer-corner { position: absolute; left: 10px; pointer-events: none; }
.viewer-corner-top { top: clamp(82px, 9vw, 122px); color: rgba(221, 241, 240, .7); }
.viewer-corner-bottom { bottom: clamp(76px, 8vw, 108px); }
.viewer-axis { position: absolute; right: 10px; pointer-events: none; color: rgba(221, 241, 240, .36); font-size: 8px; }
.viewer-axis-x { bottom: 35px; color: #e48b78; }
.viewer-axis-y { bottom: 48px; color: #77d49b; }
.viewer-axis-z { bottom: 61px; color: #7bb4e9; }
.viewer-copy { display: grid; gap: 5px; min-width: 0; }
.viewer-copy strong { max-width: min(760px, 68vw); overflow: hidden; color: rgba(238, 245, 246, .84); font-size: 11px; font-weight: 500; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.viewer-controls { display: flex; gap: 5px; pointer-events: auto; }
.viewer-controls button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 1px solid rgba(224, 244, 243, .26); color: rgba(238, 245, 246, .84); background: rgba(255, 255, 255, .04); font-size: 17px; line-height: 1; cursor: pointer; }
.viewer-controls button:hover, .viewer-controls button:focus-visible { border-color: var(--viewer-accent); color: #fff; background: color-mix(in srgb, var(--viewer-accent) 18%, transparent); outline: none; }
@media (max-width: 760px) {
  .product-3d-viewer { width: 100%; height: 100%; min-height: 100svh; padding: 0; }
  .viewer-heading, .viewer-footer { padding: 12px; }
  .viewer-heading h2 { font-size: 17px; }
  .viewer-copy strong { max-width: 52vw; }
  .viewer-corner { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  canvas { cursor: default; }
}
</style>
