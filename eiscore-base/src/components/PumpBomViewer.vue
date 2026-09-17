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
          <p>{{ isEnglish ? 'Parts separate horizontally in BOM order, then return to the assembled pump.' : '零件按 BOM 顺序横向拆分，再回到完整装配。' }}</p>
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
const bomItems = Object.freeze([
  { id: 'base', zh: '底座', en: 'Base plate' },
  { id: 'barrel', zh: '机筒', en: 'Barrel' },
  { id: 'coil', zh: '线圈', en: 'Coil' },
  { id: 'rotor', zh: '转子', en: 'Rotor' },
  { id: 'bearing', zh: '轴承', en: 'Bearing' },
  { id: 'seal', zh: '机械密封', en: 'Mechanical seal' },
  { id: 'impeller', zh: '叶轮', en: 'Impeller' },
  { id: 'pump-head', zh: '泵头', en: 'Pump head' },
  { id: 'oil-cylinder', zh: '油缸', en: 'Oil cylinder' },
  { id: 'cover', zh: '油缸盖', en: 'Cylinder cover' },
  { id: 'tube-plate', zh: '花板', en: 'Tube plate' },
  { id: 'upper-cap', zh: '上帽', en: 'Upper cap' },
  { id: 'cable', zh: '电缆线', en: 'Cable' }
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
let explosionAxis = new THREE.Vector3(1, 0, 0)
const rotorAxis = new THREE.Vector3(1, 0, 0)
let explodedSpan = 0
let assembledSpan = 8

const explodeDelays = Object.freeze({
  base: 0,
  barrel: 0.08,
  'pump-head': 0.14,
  'oil-cylinder': 0.18,
  cover: 0.22,
  'tube-plate': 0.26,
  'upper-cap': 0.3,
  cable: 0.34,
  coil: 0.4,
  rotor: 0.48,
  bearing: 0.54,
  seal: 0.6,
  impeller: 0.66
})

const material = (color, options = {}) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: options.roughness ?? 0.32,
  metalness: options.metalness ?? 0.55,
  side: options.side ?? THREE.FrontSide,
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
  group.userData.explodedPosition = new THREE.Vector3()
  parts.push({ id, group, index: bomItems.indexOf(item) })
  scene.add(group)
  return group
}

const buildPump = () => {
  const steel = material('#b6c3c0', { roughness: 0.2, metalness: 0.76 })
  const shellSteel = material('#b6c3c0', { roughness: 0.2, metalness: 0.76, side: THREE.DoubleSide })
  const darkSteel = material('#445955', { roughness: 0.26, metalness: 0.78 })
  const teal = material(accent.value, { roughness: 0.24, metalness: 0.32, clearcoat: 0.6 })
  const copper = material('#c68143', { roughness: 0.28, metalness: 0.7 })
  const rubber = material('#293632', { roughness: 0.68, metalness: 0.08 })

  // The pump axis runs left-to-right so the assembled product reads as a real pump.
  const baseGroup = new THREE.Group()
  baseGroup.add(mesh(new THREE.BoxGeometry(7.4, 0.28, 2.7), darkSteel, [0, -1.56, 0]))
  baseGroup.add(mesh(new THREE.BoxGeometry(2.3, 0.34, 0.36), darkSteel, [-1.15, -1.32, -0.92]))
  baseGroup.add(mesh(new THREE.BoxGeometry(2.3, 0.34, 0.36), darkSteel, [-1.15, -1.32, 0.92]))
  addPart('base', baseGroup)

  const barrelGroup = new THREE.Group()
  // The casing is built as two clamshells. They meet when assembled and open
  // vertically during the first stage of the BOM animation, leaving a clean
  // path for the internal rotor, coil and seals.
  const upperShell = new THREE.Group()
  const lowerShell = new THREE.Group()
  upperShell.add(mesh(new THREE.CylinderGeometry(1.18, 1.18, 3.7, 48, 1, true, 0, Math.PI), shellSteel, [-0.4, 0, 0], [0, 0, Math.PI / 2]))
  lowerShell.add(mesh(new THREE.CylinderGeometry(1.18, 1.18, 3.7, 48, 1, true, Math.PI, Math.PI), shellSteel, [-0.4, 0, 0], [0, 0, Math.PI / 2]))
  for (const flangeX of [-2.27, 1.47]) {
    upperShell.add(mesh(new THREE.TorusGeometry(1.18, 0.09, 12, 48, Math.PI), darkSteel, [flangeX, 0, 0], [0, Math.PI / 2, 0]))
    const lowerFlange = new THREE.TorusGeometry(1.18, 0.09, 12, 48, Math.PI)
    lowerFlange.rotateZ(Math.PI)
    lowerShell.add(mesh(lowerFlange, darkSteel, [flangeX, 0, 0], [0, Math.PI / 2, 0]))
  }
  barrelGroup.add(upperShell, lowerShell)
  barrelGroup.userData.shells = [upperShell, lowerShell]
  addPart('barrel', barrelGroup)

  const coilGroup = new THREE.Group()
  for (let index = 0; index < 8; index += 1) {
    // Keep the winding inside the barrel wall with a small radial clearance.
    coilGroup.add(mesh(new THREE.TorusGeometry(1.04, 0.075, 10, 32), copper, [-1.65 + index * 0.29, 0, 0], [0, Math.PI / 2, 0]))
  }
  addPart('coil', coilGroup)

  const rotorGroup = new THREE.Group()
  rotorGroup.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 4.35, 32), darkSteel, [-0.15, 0, 0], [0, 0, Math.PI / 2]))
  rotorGroup.add(mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.24, 32), copper, [2.05, 0, 0], [0, 0, Math.PI / 2]))
  rotor = rotorGroup
  addPart('rotor', rotorGroup)

  addPart('bearing', mesh(new THREE.TorusGeometry(0.72, 0.15, 16, 40), steel, [1.72, 0, 0], [0, Math.PI / 2, 0]))
  addPart('seal', mesh(new THREE.TorusGeometry(0.79, 0.1, 14, 40), rubber, [2.04, 0, 0], [0, Math.PI / 2, 0]))

  const impellerGroup = new THREE.Group()
  impellerGroup.add(mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.14, 32), teal, [2.42, 0, 0], [0, 0, Math.PI / 2]))
  for (let index = 0; index < 7; index += 1) {
    const angle = (Math.PI * 2 * index) / 7
    const blade = mesh(new THREE.BoxGeometry(0.09, 0.85, 0.1), teal, [2.42, Math.cos(angle) * 0.34, Math.sin(angle) * 0.34], [angle, 0, -0.38])
    impellerGroup.add(blade)
  }
  addPart('impeller', impellerGroup)

  const head = new THREE.Group()
  head.add(mesh(new THREE.CylinderGeometry(1.36, 1.2, 0.72, 48, 1, true), teal, [2.9, 0, 0], [0, 0, Math.PI / 2]))
  head.add(mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.12, 48), teal, [2.54, 0, 0], [0, 0, Math.PI / 2]))
  head.add(mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.12, 48), teal, [3.26, 0, 0], [0, 0, Math.PI / 2]))
  head.add(mesh(new THREE.TorusGeometry(1.45, 0.06, 12, 48), steel, [3.38, 0, 0], [0, Math.PI / 2, 0]))
  head.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.52, 28), steel, [2.9, 0, 1.42], [Math.PI / 2, 0, 0]))
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6
    head.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 16), darkSteel, [3.36, Math.cos(angle) * 1.12, Math.sin(angle) * 1.12], [0, 0, Math.PI / 2]))
  }
  addPart('pump-head', head)
  addPart('oil-cylinder', mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.48, 40), steel, [3.76, 0, 0], [0, 0, Math.PI / 2]))
  addPart('cover', mesh(new THREE.CylinderGeometry(0.94, 0.94, 0.16, 40), steel, [4.12, 0, 0], [0, 0, Math.PI / 2]))
  addPart('tube-plate', mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.12, 40), darkSteel, [4.34, 0, 0], [0, 0, Math.PI / 2]))
  addPart('upper-cap', mesh(new THREE.ConeGeometry(0.78, 0.3, 40), teal, [4.62, 0, 0], [0, 0, Math.PI / 2]))

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.42, 1.25, 0.72),
    new THREE.Vector3(3.72, 1.95, 0.95),
    new THREE.Vector3(4.35, 2.35, 1.15),
    new THREE.Vector3(5.05, 2.1, 1.22)
  ])
  addPart('cable', mesh(new THREE.TubeGeometry(cableCurve, 36, 0.055, 12, false), rubber))
  arrangeExplodedParts()
}

const arrangeExplodedParts = () => {
  const intervals = parts.map((part) => {
    part.group.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(part.group)
    const center = bounds.getCenter(new THREE.Vector3())
    const halfSize = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5)
    const radius = Math.abs(explosionAxis.x) * halfSize.x + Math.abs(explosionAxis.y) * halfSize.y + Math.abs(explosionAxis.z) * halfSize.z
    return { part, bounds, center, radius, centerDistance: center.dot(explosionAxis) }
  })
  const gap = 0.14
  const totalWidth = intervals.reduce((sum, item) => sum + item.radius * 2, 0) + gap * Math.max(0, intervals.length - 1)
  const assembledMin = Math.min(...intervals.map(({ center, radius }) => center.x - radius))
  const assembledMax = Math.max(...intervals.map(({ center, radius }) => center.x + radius))
  assembledSpan = Math.max(8, assembledMax - assembledMin)
  explodedSpan = totalWidth
  const clearanceSeeds = {
    base: [0, 0.15, 0],
    barrel: [0, 1.15, -1.7],
    coil: [0, 1.8, 3.2],
    rotor: [0, 1.8, -3.2],
    bearing: [0, 2.35, 4.4],
    seal: [0, 2.35, -4.4],
    impeller: [0, 2.9, 5.6],
    'pump-head': [0, 1.15, -2.5],
    'oil-cylinder': [0, 1.6, -3.3],
    cover: [0, 2.05, -4.1],
    'tube-plate': [0, 2.5, -4.9],
    'upper-cap': [0, 2.95, -5.7],
    cable: [0, 3.25, 2.1]
  }
  const clearanceGap = 0.1
  const laneSpacing = 3.05
  const placedClearances = []
  const intersects = (first, second) => (
    first.min.x < second.max.x && first.max.x > second.min.x &&
    first.min.y < second.max.y && first.max.y > second.min.y &&
    first.min.z < second.max.z && first.max.z > second.min.z
  )
  const clearanceCandidates = (seed) => {
    const candidates = [new THREE.Vector3(...seed)]
    for (let ring = 1; ring <= 8; ring += 1) {
      const distance = ring * laneSpacing
      candidates.push(
        new THREE.Vector3(seed[0], seed[1], seed[2] + distance),
        new THREE.Vector3(seed[0], seed[1], seed[2] - distance),
        new THREE.Vector3(seed[0], seed[1] + distance, seed[2]),
        new THREE.Vector3(seed[0], Math.max(0.15, seed[1] - distance), seed[2]),
        new THREE.Vector3(seed[0], seed[1] + distance, seed[2] + distance),
        new THREE.Vector3(seed[0], seed[1] + distance, seed[2] - distance),
        new THREE.Vector3(seed[0], Math.max(0.15, seed[1] - distance), seed[2] + distance),
        new THREE.Vector3(seed[0], Math.max(0.15, seed[1] - distance), seed[2] - distance)
      )
    }
    return candidates
  }
  let cursor = -totalWidth / 2
  intervals.forEach(({ part, bounds, radius, centerDistance }) => {
    const targetDistance = cursor + radius
    part.group.userData.explodedPosition.copy(explosionAxis).multiplyScalar(targetDistance - centerDistance)
    const seed = clearanceSeeds[part.id] || [0, 0, 0]
    const clearance = clearanceCandidates(seed).find((candidate) => {
      const candidateBounds = bounds.clone().translate(candidate).expandByScalar(clearanceGap)
      return !placedClearances.some((placed) => intersects(candidateBounds, placed.bounds))
    }) || new THREE.Vector3(...seed)
    part.group.userData.clearancePosition = clearance
    placedClearances.push({ bounds: bounds.clone().translate(clearance).expandByScalar(clearanceGap) })
    cursor += radius * 2 + gap
  })
}

const panelReserveForWidth = (width) => width >= 760
  ? Math.min(340, Math.max(280, width * 0.24))
  : 0

const defaultTargetX = () => {
  const stage = root.value?.querySelector('.pump-bom-stage')
  const width = Math.max(1, stage?.clientWidth || 1)
  return width >= 760 ? 3.2 : 0.55
}

const resize = () => {
  if (!renderer || !camera || !root.value) return
  const stage = root.value.querySelector('.pump-bom-stage')
  const width = Math.max(1, stage?.clientWidth || 1)
  const height = Math.max(1, stage?.clientHeight || 1)
  const panelReserve = panelReserveForWidth(width)
  const availableWidth = Math.max(1, width - panelReserve)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.setViewOffset(width, height, 0, 0, availableWidth, height)
  camera.updateProjectionMatrix()
  fitCameraToProgress(progress.value, true)
}

const cameraDistanceForProgress = (value) => {
  if (!camera || !root.value || !explodedSpan) return 24
  const stage = root.value.querySelector('.pump-bom-stage')
  const width = Math.max(1, stage?.clientWidth || 1)
  const height = Math.max(1, stage?.clientHeight || 1)
  const panelReserve = panelReserveForWidth(width)
  const aspect = Math.max(1, width - panelReserve) / height
  const span = THREE.MathUtils.lerp(assembledSpan, explodedSpan, THREE.MathUtils.clamp(value, 0, 1)) + 3.4
  const visibleWidthFactor = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.max(aspect, 0.35)
  const framingScale = panelReserve > 0
    ? THREE.MathUtils.lerp(1.12, 1.34, THREE.MathUtils.clamp(value, 0, 1))
    : 1.08
  return THREE.MathUtils.clamp((span / visibleWidthFactor) * framingScale, 12, 105)
}

const fitCameraToProgress = (value, immediate = false) => {
  if (!camera) return
  const distance = cameraDistanceForProgress(value)
  const focus = controls?.target || new THREE.Vector3(0.55, 0.05, 0)
  const offset = camera.position.clone().sub(focus)
  const currentDepth = Math.max(Math.abs(offset.z), 0.001)
  const nextDepth = immediate ? distance : THREE.MathUtils.damp(currentDepth, distance, 4, 1 / 60)
  // Scale the complete orbit vector so the camera keeps its elevation and
  // azimuth while the horizontal BOM span changes.
  camera.position.copy(focus).add(offset.multiplyScalar(nextDepth / currentDepth))
}

const resetView = () => {
  if (!camera || !controls) return
  controls.target.set(defaultTargetX(), 0.05, 0)
  const focus = controls.target
  const baseOffset = new THREE.Vector3(5, 5.5, 24).sub(new THREE.Vector3(defaultTargetX(), 0.05, 0))
  camera.position.copy(focus).add(baseOffset.multiplyScalar(cameraDistanceForProgress(progress.value) / 24))
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

const disposeResources = () => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect?.()
  controls?.dispose?.()
  const geometries = new Set()
  const materials = new Set()
  scene?.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry)
    const surfaces = Array.isArray(child.material) ? child.material : [child.material]
    surfaces.filter(Boolean).forEach((surface) => materials.add(surface))
  })
  geometries.forEach((geometry) => geometry.dispose?.())
  materials.forEach((surface) => surface.dispose?.())
  renderer?.dispose?.()
  animationFrame = 0
  resizeObserver = undefined
  controls = undefined
  renderer = undefined
  scene = undefined
  camera = undefined
  parts = []
  rotor = undefined
}

const updateParts = (value) => {
  let nearest = -1
  let nearestDistance = Number.POSITIVE_INFINITY
  parts.forEach(({ group, index }) => {
    const stagger = 0.24 * (index / Math.max(1, bomItems.length - 1))
    const delay = explodeDelays[group.name.replace('bom-', '')] ?? stagger
    const partValue = THREE.MathUtils.clamp((value - delay) / (1 - delay), 0, 1)
    const partEased = partValue * partValue * (3 - 2 * partValue)
    const clearance = group.userData.clearancePosition || new THREE.Vector3()
    const exploded = group.userData.explodedPosition
    const release = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(partValue / 0.22, 0, 1), 0, 1)
    const horizontal = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((partValue - 0.22) / 0.56, 0, 1), 0, 1)
    const settle = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((partValue - 0.78) / 0.22, 0, 1), 0, 1)
    const position = new THREE.Vector3()
    if (clearance.lengthSq() > 0) {
      if (partValue <= 0.22) {
        position.copy(clearance).multiplyScalar(release)
      } else if (partValue < 0.78) {
        position.set(exploded.x * horizontal, clearance.y, clearance.z)
      } else {
        position.set(exploded.x, clearance.y * (1 - settle), clearance.z * (1 - settle))
      }
    } else {
      position.copy(exploded).multiplyScalar(partEased)
    }
    group.position.copy(position)
    if (group.name === 'bom-barrel' && group.userData.shells) {
      const shellSpread = 0.28 * release
      group.userData.shells[0].position.y = shellSpread
      group.userData.shells[1].position.y = -shellSpread
    }
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
  fitCameraToProgress(progress.value)
  if (rotor && playing.value) rotor.rotateOnAxis(rotorAxis, delta * 1.6)
  controls?.update()
  renderer?.render(scene, camera)
}

onMounted(() => {
  try {
    scene = new THREE.Scene()
    scene.background = new THREE.Color('#f5f8f6')
    // The narrow layout needs a longer camera distance for the horizontal BOM.
    // Keep the far clip and fog beyond that distance so the exploded parts stay visible.
    scene.fog = new THREE.Fog('#f5f8f6', 34, 180)
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180)
    camera.position.set(5, 5.5, 24)
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
    controls.maxDistance = 120
    controls.target.set(defaultTargetX(), 0.05, 0)
    explosionAxis.set(1, 0, 0)
    scene.add(new THREE.HemisphereLight('#ffffff', '#c4d4ce', 2.5))
    const key = new THREE.DirectionalLight('#ffffff', 4.2)
    key.position.set(6, 9, 7)
    key.castShadow = true
    scene.add(key)
    const fill = new THREE.DirectionalLight(accent.value, 1.8)
    fill.position.set(-6, 3, 5)
    scene.add(fill)
    const ground = new THREE.Mesh(new THREE.CircleGeometry(18, 96), new THREE.MeshStandardMaterial({ color: '#e9f0ec', roughness: 0.9, metalness: 0 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.72
    ground.receiveShadow = true
    scene.add(ground)
    const grid = new THREE.GridHelper(32, 48, '#cddbd4', '#e4ece7')
    grid.position.y = -1.7
    grid.material.transparent = true
    grid.material.opacity = 0.42
    scene.add(grid)
    buildPump()
    updateParts(0)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(root.value)
    }
    resize()
    ready.value = true
    lastTime = performance.now()
    animate(lastTime)
  } catch (error) {
    ready.value = false
    disposeResources()
    console.warn('[pump-bom-viewer] WebGL unavailable', error)
  }
})

onBeforeUnmount(disposeResources)
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
.pump-bom-list { position: absolute; top: clamp(104px, 14vh, 144px); right: clamp(20px, 4vw, 68px); z-index: 2; width: min(220px, 20vw); padding: 12px 14px; border: 1px solid rgba(23, 50, 43, .12); background: rgba(255, 255, 255, .56); box-shadow: 0 20px 60px rgba(41, 77, 63, .08); backdrop-filter: blur(8px); }
.pump-bom-list ol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 12px; margin: 8px 0 0; padding: 0; list-style: none; }
.pump-bom-list li { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 3px 0; color: rgba(23, 50, 43, .56); font-size: 10px; transition: color 160ms ease, transform 160ms ease; }
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
  .pump-bom-list { top: auto; right: 12px; bottom: 108px; left: 12px; width: auto; padding: 8px 10px; }
  .pump-bom-list ol { grid-template-columns: repeat(4, minmax(0, 1fr)); display: grid; gap: 2px 8px; margin-top: 6px; }
  .pump-bom-list li { padding: 3px 0; font-size: 8px; }
  .pump-bom-footer { padding: 54px 12px max(18px, calc(env(safe-area-inset-bottom) + 8px)); }
  .pump-bom-progress { right: 12px; bottom: 72px; left: 12px; }
  .pump-bom-controls button { width: 42px; height: 42px; }
}
@media (prefers-reduced-motion: reduce) { .pump-bom-stage canvas { cursor: default; } }
</style>
