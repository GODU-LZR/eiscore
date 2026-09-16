<template>
  <section
    ref="root"
    class="pump-bom-viewer"
    :style="{ '--viewer-accent': accent }"
    :aria-label="viewerLabel"
    data-pump-bom-viewer
  >
    <div class="pump-bom-stage">
      <canvas ref="canvas" :aria-label="canvasLabel" />

      <header class="pump-bom-heading">
        <div>
          <span class="pump-bom-kicker">{{ isEnglish ? 'PUMP / BOM ANIMATION' : '水泵 / BOM 动画' }}</span>
          <h2>{{ displayName }}</h2>
          <p>{{ isEnglish ? 'Parts separate in sequence, then return to the assembled pump.' : '零件按 BOM 顺序拆分，再回到完整装配。' }}</p>
        </div>
        <span class="pump-bom-status" :class="{ 'is-ready': ready }">
          <i aria-hidden="true" />{{ ready ? (isEnglish ? 'READY' : '已就绪') : (isEnglish ? 'LOADING' : '载入中') }}
        </span>
      </header>

      <aside class="pump-bom-list" :aria-label="isEnglish ? 'Pump BOM parts' : '水泵 BOM 零件'">
        <span class="pump-bom-list-title">BOM / {{ bomItems.length }}</span>
        <ol>
          <li v-for="(item, index) in bomItems" :key="item.id" :class="{ 'is-active': activePartIndex === index }">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ isEnglish ? item.en : item.zh }}</strong>
          </li>
        </ol>
      </aside>

      <footer class="pump-bom-footer">
        <div class="pump-bom-progress" aria-hidden="true"><span :style="{ transform: `scaleX(${progress})` }" /></div>
        <div class="pump-bom-controls" role="group" :aria-label="isEnglish ? 'Animation controls' : '动画控制'">
          <button type="button" :title="isEnglish ? 'Play or pause' : '播放或暂停'" :aria-label="playLabel" @click="togglePlaying">
            <span aria-hidden="true">{{ playing ? 'Ⅱ' : '▶' }}</span>
          </button>
          <button type="button" :title="isEnglish ? 'Explode parts' : '拆分零件'" :aria-label="explodeLabel" @click="setExploded(true)">
            <span aria-hidden="true">↗</span>
          </button>
          <button type="button" :title="isEnglish ? 'Assemble parts' : '组装零件'" :aria-label="assembleLabel" @click="setExploded(false)">
            <span aria-hidden="true">↙</span>
          </button>
          <button type="button" :title="isEnglish ? 'Reset view' : '重置视角'" :aria-label="resetLabel" @click="resetView">
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </footer>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps({
  productName: { type: String, default: '' },
  category: { type: String, default: '' },
  accentColor: { type: String, default: '#0b6e69' },
  locale: { type: String, default: 'zh-CN' }
})

const root = ref(null)
const canvas = ref(null)
const ready = ref(false)
const playing = ref(true)
const progress = ref(0)
const activePartIndex = ref(-1)

const isEnglish = computed(() => props.locale.toLowerCase().startsWith('en'))
const accent = computed(() => /^#[0-9a-f]{6}$/i.test(props.accentColor) ? props.accentColor : '#0b6e69')
const displayName = computed(() => String(props.productName || '').trim() || (isEnglish.value ? 'Centrifugal pump' : '管道离心泵'))
const viewerLabel = computed(() => isEnglish.value ? `${displayName.value} BOM animation` : `${displayName.value} BOM 三维动画`)
const canvasLabel = computed(() => isEnglish.value ? 'Interactive pump assembly. Drag to rotate and scroll to zoom.' : '交互式水泵装配动画，可拖动旋转并滚动缩放。')
const playLabel = computed(() => playing.value ? (isEnglish.value ? 'Pause animation' : '暂停动画') : (isEnglish.value ? 'Play animation' : '播放动画'))
const explodeLabel = computed(() => isEnglish.value ? 'Explode BOM' : '拆分 BOM')
const assembleLabel = computed(() => isEnglish.value ? 'Assemble BOM' : '组装 BOM')
const resetLabel = computed(() => isEnglish.value ? 'Reset view' : '重置视角')
const explodedScale = 0.52

const bomItems = Object.freeze([
  { id: 'base', zh: '底座', en: 'Base plate', offset: [-0.2, -2.2, 0.25] },
  { id: 'barrel', zh: '机筒', en: 'Barrel', offset: [0.12, -1.55, 0.2] },
  { id: 'coil', zh: '线圈', en: 'Coil', offset: [-0.1, -0.95, 0.34] },
  { id: 'rotor', zh: '转子', en: 'Rotor', offset: [0.08, -0.35, 0.5] },
  { id: 'bearing', zh: '轴承', en: 'Bearing', offset: [-0.12, 0.25, 0.58] },
  { id: 'seal', zh: '机械密封', en: 'Mechanical seal', offset: [0.15, 0.85, 0.5] },
  { id: 'impeller', zh: '叶轮', en: 'Impeller', offset: [-0.18, 1.4, 0.35] },
  { id: 'pump-head', zh: '泵头', en: 'Pump head', offset: [0.2, 2.05, 0.25] },
  { id: 'oil-cylinder', zh: '油缸', en: 'Oil cylinder', offset: [-0.3, 2.65, 0.05] },
  { id: 'cover', zh: '油缸盖', en: 'Cylinder cover', offset: [0.22, 3.15, -0.08] },
  { id: 'tube-plate', zh: '花板', en: 'Tube plate', offset: [-0.16, 3.62, -0.18] },
  { id: 'upper-cap', zh: '上帽', en: 'Upper cap', offset: [0.12, 4.05, -0.22] },
  { id: 'cable', zh: '电缆线', en: 'Cable', offset: [0.38, 1.4, 1.1] }
])

let renderer
let scene
let camera
let controls
let resizeObserver
let animationFrame = 0
let lastTime = 0
let animationClock = 0
let targetProgress = null
let parts = []
let rotor

const material = (color, options = {}) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: options.roughness ?? 0.32,
  metalness: options.metalness ?? 0.55,
  clearcoat: options.clearcoat ?? 0.4,
  clearcoatRoughness: 0.18,
  emissive: options.emissive || '#000000',
  emissiveIntensity: options.emissiveIntensity ?? 0
})

const mesh = (geometry, surface, position = [0, 0, 0], rotation = [0, 0, 0]) => {
  const object = new THREE.Mesh(geometry, surface)
  object.position.set(...position)
  object.rotation.set(...rotation)
  object.castShadow = true
  object.receiveShadow = true
  return object
}

const addPart = (id, object) => {
  const item = bomItems.find((entry) => entry.id === id)
  const group = new THREE.Group()
  group.name = `bom-${id}`
  group.add(object)
  group.userData.basePosition = group.position.clone()
  group.userData.explodedPosition = new THREE.Vector3(...item.offset)
  parts.push({ id, group, index: bomItems.indexOf(item) })
  scene.add(group)
  return group
}

const buildPump = () => {
  const steel = material('#b6c3c0', { roughness: 0.2, metalness: 0.76 })
  const darkSteel = material('#445955', { roughness: 0.26, metalness: 0.78 })
  const teal = material(accent.value, { roughness: 0.24, metalness: 0.32, clearcoat: 0.6 })
  const copper = material('#c68143', { roughness: 0.28, metalness: 0.7 })
  const rubber = material('#293632', { roughness: 0.68, metalness: 0.08 })

  addPart('base', mesh(new THREE.BoxGeometry(3.2, 0.22, 1.85), darkSteel, [0, -1.15, 0]))
  addPart('barrel', mesh(new THREE.CylinderGeometry(1.06, 1.06, 1.75, 48), steel, [0, -0.12, 0], [Math.PI / 2, 0, 0]))

  const coilGroup = new THREE.Group()
  for (let index = 0; index < 8; index += 1) {
    coilGroup.add(mesh(new THREE.TorusGeometry(0.82, 0.075, 10, 32), copper, [0, -0.42 + index * 0.12, 0], [Math.PI / 2, 0, 0]))
  }
  addPart('coil', coilGroup)

  rotor = mesh(new THREE.CylinderGeometry(0.26, 0.26, 2.5, 32), darkSteel, [0, 0, 0], [Math.PI / 2, 0, 0])
  rotor.add(mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.22, 32), copper, [0, 0.15, 0], [Math.PI / 2, 0, 0]))
  addPart('rotor', rotor)

  addPart('bearing', mesh(new THREE.TorusGeometry(0.68, 0.15, 16, 40), steel, [0, 0.88, 0], [Math.PI / 2, 0, 0]))
  addPart('seal', mesh(new THREE.TorusGeometry(0.7, 0.1, 14, 40), rubber, [0, 1.24, 0], [Math.PI / 2, 0, 0]))

  const impellerGroup = new THREE.Group()
  impellerGroup.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.13, 32), teal, [0, 0, 0], [Math.PI / 2, 0, 0]))
  for (let index = 0; index < 7; index += 1) {
    const blade = mesh(new THREE.BoxGeometry(0.11, 0.8, 0.06), teal, [0, 0.22, 0], [0, (Math.PI * 2 * index) / 7, -0.4])
    impellerGroup.add(blade)
  }
  addPart('impeller', impellerGroup)

  const head = new THREE.Group()
  head.add(mesh(new THREE.CylinderGeometry(1.2, 1.12, 0.6, 48), teal, [0, 0, 0], [Math.PI / 2, 0, 0]))
  head.add(mesh(new THREE.TorusGeometry(1.03, 0.07, 12, 48), steel, [0, 0.08, 0], [Math.PI / 2, 0, 0]))
  head.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.48, 28), steel, [0.2, 0.05, 0.86], [Math.PI / 2, 0, 0]))
  addPart('pump-head', head)
  addPart('oil-cylinder', mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.4, 40), steel, [0, 0, 0], [Math.PI / 2, 0, 0]))
  addPart('cover', mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.16, 40), steel, [0, 0, 0], [Math.PI / 2, 0, 0]))
  addPart('tube-plate', mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 40), darkSteel, [0, 0, 0], [Math.PI / 2, 0, 0]))
  addPart('upper-cap', mesh(new THREE.ConeGeometry(0.72, 0.22, 40), teal, [0, 0, 0], [Math.PI / 2, 0, 0]))

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.85, -0.72, 0.35),
    new THREE.Vector3(1.45, -0.2, 0.72),
    new THREE.Vector3(1.15, 0.55, 1.05),
    new THREE.Vector3(0.72, 1.25, 1.08)
  ])
  addPart('cable', mesh(new THREE.TubeGeometry(cableCurve, 36, 0.055, 12, false), rubber))
}

const resize = () => {
  if (!renderer || !camera || !root.value) return
  const stage = root.value.querySelector('.pump-bom-stage')
  const width = Math.max(1, stage?.clientWidth || 1)
  const height = Math.max(1, stage?.clientHeight || 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

const resetView = () => {
  if (!camera || !controls) return
  camera.position.set(7.8, 4.8, 8.8)
  controls.target.set(0, 0.35, 0)
  controls.update()
}

const setExploded = (value) => {
  targetProgress = value ? 1 : 0
  playing.value = true
  animationClock = value ? 0.9 : 2.1
}

const togglePlaying = () => {
  playing.value = !playing.value
  if (playing.value) lastTime = performance.now()
}

const updateParts = (value) => {
  const eased = value * value * (3 - 2 * value)
  let nearest = -1
  let nearestDistance = Number.POSITIVE_INFINITY
  parts.forEach(({ group, index }) => {
    const item = bomItems[index]
    const position = item.offset.map((coordinate) => coordinate * eased * explodedScale)
    group.position.set(...position)
    const distance = Math.abs(value - ((index + 1) / bomItems.length))
    if (distance < nearestDistance && value > 0.08 && value < 0.92) {
      nearest = index
      nearestDistance = distance
    }
  })
  activePartIndex.value = nearest
  progress.value = value
}

const animate = (time = 0) => {
  animationFrame = window.requestAnimationFrame(animate)
  const delta = Math.min((time - lastTime) / 1000 || 0, 0.05)
  lastTime = time
  if (playing.value) {
    if (targetProgress !== null) {
      const current = progress.value
      const next = THREE.MathUtils.damp(current, targetProgress, 2.8, delta)
      updateParts(next)
      if (Math.abs(next - targetProgress) < 0.008) {
        updateParts(targetProgress)
        targetProgress = null
        playing.value = false
      }
    } else {
      animationClock += delta
      const cycle = animationClock % 12
      const next = cycle < 1.2 ? 0 : cycle < 4.8 ? THREE.MathUtils.smoothstep((cycle - 1.2) / 3.6, 0, 1) : cycle < 7.2 ? 1 : cycle < 10.8 ? 1 - THREE.MathUtils.smoothstep((cycle - 7.2) / 3.6, 0, 1) : 0
      updateParts(next)
    }
  }
  if (rotor && playing.value) rotor.rotation.y += delta * 1.6
  controls?.update()
  renderer?.render(scene, camera)
}

onMounted(() => {
  try {
    scene = new THREE.Scene()
    scene.background = new THREE.Color('#f5f8f6')
    scene.fog = new THREE.Fog('#f5f8f6', 20, 42)
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60)
    camera.position.set(7.8, 4.8, 8.8)
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    controls = new OrbitControls(camera, canvas.value)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 5.4
    controls.maxDistance = 17
    controls.target.set(0, 0.35, 0)
    scene.add(new THREE.HemisphereLight('#ffffff', '#c4d4ce', 2.5))
    const key = new THREE.DirectionalLight('#ffffff', 4.2)
    key.position.set(6, 9, 7)
    key.castShadow = true
    scene.add(key)
    const fill = new THREE.DirectionalLight(accent.value, 1.8)
    fill.position.set(-6, 3, 5)
    scene.add(fill)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(6.4, 64), new THREE.MeshStandardMaterial({ color: '#e9f0ec', roughness: 0.9, metalness: 0 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.28
    ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(10, 20, '#cddbd4', '#e4ece7')
    grid.position.y = -1.26
    grid.material.transparent = true
    grid.material.opacity = 0.42
    scene.add(grid)
    buildPump()
    updateParts(0)
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(root.value)
    resize()
    ready.value = true
    lastTime = performance.now()
    animate(lastTime)
  } catch (error) {
    ready.value = false
    console.warn('[pump-bom-viewer] WebGL unavailable', error)
  }
})

onBeforeUnmount(() => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect?.()
  controls?.dispose?.()
  parts.forEach(({ group }) => group.traverse((child) => {
    child.geometry?.dispose?.()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.filter(Boolean).forEach((surface) => surface.dispose?.())
  }))
  renderer?.dispose?.()
})
</script>

<style scoped>
.pump-bom-viewer { --viewer-accent: #0b6e69; position: relative; width: 100%; height: 100%; min-height: 100svh; color: #17322b; background: #f5f8f6; }
.pump-bom-stage { position: relative; width: 100%; height: 100%; min-height: 100svh; overflow: hidden; background: #f5f8f6; }
.pump-bom-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
.pump-bom-stage canvas:active { cursor: grabbing; }
.pump-bom-heading, .pump-bom-footer { position: absolute; left: 0; right: 0; z-index: 2; display: flex; justify-content: space-between; gap: 20px; box-sizing: border-box; pointer-events: none; }
.pump-bom-heading { top: 0; align-items: flex-start; padding: clamp(22px, 3vw, 42px) clamp(20px, 4vw, 68px) 72px; background: linear-gradient(180deg, rgba(245, 248, 246, .98), rgba(245, 248, 246, .76) 52%, transparent); }
.pump-bom-heading h2 { margin: 8px 0 0; color: #17322b; font-family: "Noto Serif SC", "Source Han Serif SC", serif; font-size: clamp(25px, 2.7vw, 44px); line-height: 1.12; }
.pump-bom-heading p { margin: 10px 0 0; color: rgba(23, 50, 43, .62); font-size: clamp(11px, 1vw, 14px); }
.pump-bom-kicker, .pump-bom-list-title, .pump-bom-status { color: rgba(23, 50, 43, .58); font: 700 10px/1.25 "IBM Plex Mono", Consolas, monospace; letter-spacing: .14em; text-transform: uppercase; }
.pump-bom-status { display: inline-flex; align-items: center; gap: 7px; padding: 9px 12px; border: 1px solid rgba(23, 50, 43, .16); background: rgba(255, 255, 255, .76); white-space: nowrap; }
.pump-bom-status i { width: 6px; height: 6px; border-radius: 50%; background: #9aa8a2; }
.pump-bom-status.is-ready { color: #26734f; }
.pump-bom-status.is-ready i { background: #67c98c; box-shadow: 0 0 0 4px rgba(103, 201, 140, .14); }
.pump-bom-list { position: absolute; top: 50%; right: clamp(20px, 4vw, 68px); z-index: 2; width: min(190px, 18vw); padding: 14px 15px; border: 1px solid rgba(23, 50, 43, .12); background: rgba(255, 255, 255, .8); box-shadow: 0 20px 60px rgba(41, 77, 63, .1); transform: translateY(-50%); backdrop-filter: blur(12px); }
.pump-bom-list ol { display: grid; gap: 5px; margin: 10px 0 0; padding: 0; list-style: none; }
.pump-bom-list li { display: flex; align-items: center; gap: 8px; padding: 5px 0; color: rgba(23, 50, 43, .56); font-size: 10px; transition: color 160ms ease, transform 160ms ease; }
.pump-bom-list li > span { color: rgba(23, 50, 43, .36); font: 9px "IBM Plex Mono", Consolas, monospace; }
.pump-bom-list li.is-active { color: var(--viewer-accent); transform: translateX(-3px); }
.pump-bom-list li.is-active > span { color: var(--viewer-accent); }
.pump-bom-footer { bottom: 0; align-items: flex-end; padding: 82px clamp(20px, 4vw, 68px) clamp(20px, 2.4vw, 34px); background: linear-gradient(0deg, rgba(245, 248, 246, .99), rgba(245, 248, 246, .86) 52%, transparent); }
.pump-bom-progress { position: absolute; right: clamp(20px, 4vw, 68px); bottom: 84px; left: clamp(20px, 4vw, 68px); height: 2px; overflow: hidden; background: rgba(23, 50, 43, .12); }
.pump-bom-progress span { display: block; width: 100%; height: 100%; background: var(--viewer-accent); transform-origin: left; }
.pump-bom-controls { display: flex; gap: 6px; margin-left: auto; pointer-events: auto; }
.pump-bom-controls button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 1px solid rgba(23, 50, 43, .2); color: #17322b; background: rgba(255, 255, 255, .84); font-size: 16px; cursor: pointer; }
.pump-bom-controls button:hover, .pump-bom-controls button:focus-visible { border-color: var(--viewer-accent); color: var(--viewer-accent); outline: none; }
@media (max-width: 760px) {
  .pump-bom-viewer, .pump-bom-stage { min-height: calc(100svh - 68px); }
  .pump-bom-heading { padding: 14px 14px 48px; gap: 10px; }
  .pump-bom-heading h2 { max-width: calc(100vw - 120px); font-size: clamp(20px, 6vw, 25px); }
  .pump-bom-heading p { max-width: calc(100vw - 28px); font-size: 9px; line-height: 1.45; }
  .pump-bom-list { top: 160px; right: 12px; width: 150px; padding: 9px 10px; transform: none; }
  .pump-bom-list ol { grid-template-columns: repeat(2, minmax(0, 1fr)); display: grid; gap: 2px 7px; margin-top: 6px; }
  .pump-bom-list li { padding: 3px 0; font-size: 8px; }
  .pump-bom-footer { padding: 54px 12px max(18px, calc(env(safe-area-inset-bottom) + 8px)); }
  .pump-bom-progress { right: 12px; bottom: 72px; left: 12px; }
  .pump-bom-controls button { width: 42px; height: 42px; }
}
@media (prefers-reduced-motion: reduce) { .pump-bom-stage canvas { cursor: default; } }
</style>
