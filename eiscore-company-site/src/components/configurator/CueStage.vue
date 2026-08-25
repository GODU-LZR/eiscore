<template>
  <div ref="stageRoot" class="cue-stage" :class="{ 'is-unavailable': unavailable }">
    <canvas ref="canvas" aria-label="Interactive prototype cue preview"></canvas>
    <div v-if="unavailable" class="stage-fallback">
      <span class="fallback-kicker">3D FALLBACK</span>
      <strong>Interactive 3D is unavailable on this device.</strong>
      <span>The configuration, price and BOM remain available below.</span>
    </div>
    <div class="stage-corner stage-corner-top">PARAMETRIC / P01</div>
    <div class="stage-corner stage-corner-bottom">{{ exploded ? 'EXPLODED VIEW' : detailMode ? 'DETAIL VIEW' : 'FULL CUE VIEW' }}</div>
    <div class="stage-focus-line" :class="{ 'is-active': focusSlot }">
      <span>{{ focusSlot ? `FOCUS / ${focusSlot}` : 'DRAG TO ROTATE · SCROLL TO ZOOM' }}</span>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getVariant } from '@/configurator/catalog'

const props = defineProps({
  design: { type: Object, required: true },
  focusSlot: { type: String, default: '' },
  exploded: { type: Boolean, default: false },
  detailMode: { type: Boolean, default: false },
  assemblePulse: { type: Number, default: 0 }
})

const emit = defineEmits(['ready', 'error'])

const stageRoot = ref(null)
const canvas = ref(null)
const unavailable = ref(false)

let renderer = null
let scene = null
let camera = null
let controls = null
let animationFrame = 0
let resizeObserver = null
let cueGroup = null
let focusTarget = new THREE.Vector3(0, 0, 0)
let focusTargetGoal = new THREE.Vector3(0, 0, 0)
let cameraGoal = new THREE.Vector3(0, 1.8, 24)
let cameraLookAtGoal = new THREE.Vector3(0, 0, 0)
let fullCameraDistance = 24
let pulseStartedAt = 0
let reducedMotion = false

// Keep the cue slender enough to read as a real 57-58 inch cue at a glance.
const CUE_DISPLAY_SCALE = new THREE.Vector3(0.98, 1.82, 1.82)
const CUE_DISPLAY_ROTATION = { x: 0.10, y: -0.18, z: 0.12 }

const PART_LAYOUT = {
  // Coordinates are in a scaled cue-length space: tip at +X, butt at -X.
  // The diameter-to-length relationship is intentionally close to a real cue.
  TIP: { x: 7.86, length: 0.20, leftRadius: 0.062, rightRadius: 0.056, axis: 1 },
  FERRULE: { x: 7.65, length: 0.22, leftRadius: 0.064, rightRadius: 0.068, axis: 1 },
  SHAFT: { x: 3.81, length: 7.52, leftRadius: 0.125, rightRadius: 0.058, axis: 1 },
  JOINT: { x: -0.15, length: 0.40, leftRadius: 0.145, rightRadius: 0.120, axis: 0 },
  FOREARM: { x: -1.91, length: 3.12, leftRadius: 0.185, rightRadius: 0.145, axis: -1 },
  INLAY: { x: -1.91, length: 2.24, leftRadius: 0.185, rightRadius: 0.145, axis: -1 },
  HANDLE: { x: -4.64, length: 2.34, leftRadius: 0.158, rightRadius: 0.158, axis: -1 },
  WRAP: { x: -4.64, length: 2.34, leftRadius: 0.170, rightRadius: 0.170, axis: -1 },
  BUTT_SLEEVE: { x: -6.68, length: 1.74, leftRadius: 0.225, rightRadius: 0.178, axis: -1 },
  BUTT_PLATE: { x: -7.64, length: 0.14, leftRadius: 0.205, rightRadius: 0.205, axis: -1 },
  BUMPER: { x: -7.84, length: 0.24, leftRadius: 0.195, rightRadius: 0.195, axis: -1 }
}

const PART_ORDER = ['TIP', 'FERRULE', 'SHAFT', 'JOINT', 'FOREARM', 'INLAY', 'HANDLE', 'WRAP', 'BUTT_SLEEVE', 'BUTT_PLATE', 'BUMPER']

const selectedVariantFor = (slot) => {
  const selected = props.design?.components?.find((item) => item.slot === slot)
  return getVariant(slot, selected?.variantId)
}

const colorFor = (slot) => {
  const variant = selectedVariantFor(slot)
  return variant?.color || '#b48a50'
}

const woodTextureCache = new Map()

const textureSeedFor = (value) => [...String(value || '')].reduce((seed, char, index) => (seed + char.charCodeAt(0) * (index + 7)) % 997, 17)

const generatedWoodTexture = (baseColor, variantKey = '') => {
  if (typeof document === 'undefined') return null
  const cacheKey = `${baseColor}:${variantKey}`
  const cached = woodTextureCache.get(cacheKey)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 160
  const context = canvas.getContext('2d')
  const color = new THREE.Color(baseColor)
  const light = color.clone().offsetHSL(0, 0.02, 0.075)
  const dark = color.clone().offsetHSL(0, 0.01, -0.09)
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, `#${light.getHexString()}`)
  gradient.addColorStop(0.5, `#${color.getHexString()}`)
  gradient.addColorStop(1, `#${dark.getHexString()}`)
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  const seed = textureSeedFor(variantKey)
  const isDark = color.getHSL({}).l < 0.35
  for (let index = 0; index < 58; index += 1) {
    const start = (index * 47 + seed * 3) % canvas.width
    const drift = 2.5 + ((index + seed) % 7)
    context.beginPath()
    for (let y = -8; y <= canvas.height + 8; y += 5) {
      const x = start + Math.sin(y * 0.042 + index * 1.7 + seed) * drift + Math.sin(y * 0.13 + index) * 2.4
      if (y === -8) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    const darkGrain = isDark ? 'rgba(255, 235, 199, .16)' : 'rgba(55, 29, 17, .26)'
    const lightGrain = isDark ? 'rgba(255, 245, 220, .08)' : 'rgba(255, 239, 202, .18)'
    context.strokeStyle = index % 6 === 0 ? darkGrain : lightGrain
    context.lineWidth = index % 6 === 0 ? 2.2 : 0.9
    context.stroke()
  }
  context.globalAlpha = isDark ? 0.16 : 0.12
  for (let index = 0; index < 12; index += 1) {
    const y = ((index * 31 + seed) % canvas.height)
    context.fillStyle = isDark ? '#e8c99c' : '#5b3420'
    context.fillRect(0, y, canvas.width, 1)
  }
  context.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(1.8, 1)
  texture.anisotropy = 4
  woodTextureCache.set(cacheKey, texture)
  return texture
}

const materialFor = (slot) => {
  const color = colorFor(slot)
  const variant = selectedVariantFor(slot)
  const isMetal = slot === 'JOINT' || variant?.materialFamily === 'stainless_steel' || variant?.materialFamily === 'brass'
  const isCarbon = variant?.materialFamily === 'carbon'
  const isWood = ['SHAFT', 'FOREARM', 'HANDLE', 'BUTT_SLEEVE'].includes(slot) && !isCarbon
  const isLeatherTip = slot === 'TIP' && !variant?.variantId?.includes('PHENOLIC')
  const material = new THREE.MeshPhysicalMaterial({
    color: isLeatherTip || isWood ? '#ffffff' : color,
    roughness: isLeatherTip ? 0.78 : (isMetal ? 0.24 : (isCarbon ? 0.34 : 0.48)),
    metalness: isMetal ? 0.82 : (isCarbon ? 0.18 : 0.02),
    clearcoat: isLeatherTip ? 0.05 : (isMetal || isCarbon ? 0.18 : 0.46),
    clearcoatRoughness: 0.24
  })
  if (isWood) material.map = generatedWoodTexture(color, variant?.materialAssetId || variant?.variantId || slot)
  if (isLeatherTip) material.color.set('#3c2c25')
  return material
}

const axisGeometry = (layout) => {
  const geometry = new THREE.CylinderGeometry(layout.rightRadius, layout.leftRadius, layout.length, 48, 1, false)
  geometry.rotateZ(-Math.PI / 2)
  return geometry
}

const createWrapHelix = (layout, direction, color) => {
  const curve = new THREE.Curve()
  curve.getPoint = (progress, target = new THREE.Vector3()) => {
    const angle = direction * progress * Math.PI * 2 * 9
    const radius = layout.leftRadius * 1.02
    return target.set(
      -layout.length / 2 + layout.length * progress,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    )
  }
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 160, 0.011, 8, false),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 })
  )
}

const addCueRing = (group, x, radius, tube, color, name) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 12, 40),
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.24, metalness: 0.76, clearcoat: 0.3 })
  )
  ring.rotation.y = Math.PI / 2
  ring.position.x = x
  ring.name = name
  ring.castShadow = true
  group.add(ring)
}

const createInlayPart = () => {
  const selected = props.design?.components?.find((item) => item.slot === 'INLAY')
  const variant = getVariant('INLAY', selected?.variantId)
  if (!variant || variant.variantId === 'INLAY-NONE-01') return null

  const group = new THREE.Group()
  group.name = 'GEO_CUE_INLAY'
  group.userData.slot = 'INLAY'
  group.userData.baseX = PART_LAYOUT.FOREARM.x
  group.userData.axis = PART_LAYOUT.INLAY.axis
  // Eight slim points sit on the forearm surface. The default cue has no
  // points at all, so the silhouette remains a clean production cue until an
  // inlay is explicitly selected.
  ;[-0.98, -0.30, 0.38, 1.06].forEach((offset, index) => {
    ;[0, Math.PI].forEach((angle, side) => {
      const point = createPointAccent(PART_LAYOUT.FOREARM, offset, variant.color, angle, '#d8b777')
      point.name = `GEO_CUE_INLAY_POINT_${index * 2 + side + 1}`
      point.scale.setScalar(0.82)
      group.add(point)
    })
  })
  group.position.set(PART_LAYOUT.FOREARM.x, 0, 0)
  return group
}

const createPointAccent = (layout, offset, color, angle = 0, insetColor = '#b47747') => {
  const shape = new THREE.Shape()
  shape.moveTo(-0.68, -0.075)
  shape.lineTo(-0.68, 0.075)
  shape.lineTo(0.68, 0)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.006, bevelSegments: 2 })
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.04, clearcoat: 0.58, clearcoatRoughness: 0.18 })
  )
  const radius = (layout.leftRadius + layout.rightRadius) / 2
  mesh.rotation.x = angle
  mesh.position.set(offset, -Math.sin(angle) * radius * 0.985, Math.cos(angle) * radius * 0.985)
  mesh.castShadow = true
  const inset = new THREE.Mesh(geometry.clone(), new THREE.MeshPhysicalMaterial({ color: insetColor, roughness: 0.34, metalness: 0.02, clearcoat: 0.48, clearcoatRoughness: 0.2 }))
  inset.name = 'GEO_CUE_POINT_INSET'
  inset.rotation.x = angle
  inset.position.copy(mesh.position)
  inset.position.z += Math.cos(angle) * 0.022
  inset.position.y -= Math.sin(angle) * 0.022
  inset.scale.set(0.78, 0.55, 0.72)
  inset.castShadow = true
  const group = new THREE.Group()
  group.add(mesh, inset)
  return group
}

const createPart = (slot) => {
  const layout = PART_LAYOUT[slot]
  if (!layout) return null
  if (slot === 'INLAY') return createInlayPart()
  if (slot === 'WRAP' && selectedVariantFor('WRAP')?.variantId === 'WRAP-NONE-01') return null
  const group = new THREE.Group()
  group.name = `GEO_CUE_${slot}`
  group.userData.slot = slot
  group.userData.baseX = layout.x
  group.userData.axis = layout.axis
  const mesh = new THREE.Mesh(axisGeometry(layout), materialFor(slot))
  mesh.name = `GEO_CUE_${slot}_MESH`
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  if (slot === 'WRAP') {
    const wrapDetail = new THREE.Group()
    wrapDetail.name = 'GEO_CUE_WRAP_DETAIL'
    const wrapColor = colorFor('WRAP')
    wrapDetail.add(createWrapHelix(layout, 1, wrapColor))
    wrapDetail.add(createWrapHelix(layout, -1, '#18191a'))
    ;[-layout.length / 2, layout.length / 2].forEach((x) => {
      const edgeRing = new THREE.Mesh(
        new THREE.TorusGeometry(layout.leftRadius * 1.02, 0.011, 10, 28),
        new THREE.MeshPhysicalMaterial({ color: '#8b7864', roughness: 0.78, metalness: 0.04 })
      )
      edgeRing.rotation.y = Math.PI / 2
      edgeRing.position.x = x
      wrapDetail.add(edgeRing)
    })
    group.add(wrapDetail)
  }
  if (slot === 'FERRULE') {
    const ferruleBand = new THREE.Mesh(
      new THREE.TorusGeometry(layout.rightRadius * 1.01, 0.012, 10, 28),
      new THREE.MeshPhysicalMaterial({ color: '#c5a86f', roughness: 0.26, metalness: 0.62 })
    )
    ferruleBand.rotation.y = Math.PI / 2
    ferruleBand.position.x = layout.length * 0.28
    group.add(ferruleBand)
    addCueRing(group, layout.length * 0.45, layout.rightRadius * 1.02, 0.009, '#e9dfca', 'GEO_CUE_FERRULE_EDGE')
  }
  if (slot === 'JOINT') {
    const jointInsert = new THREE.Mesh(
      new THREE.CylinderGeometry(layout.rightRadius * 0.76, layout.leftRadius * 0.76, 0.12, 40),
      new THREE.MeshPhysicalMaterial({ color: '#1a1d1e', roughness: 0.34, metalness: 0.28, clearcoat: 0.22 })
    )
    jointInsert.rotation.z = -Math.PI / 2
    jointInsert.position.x = layout.length * 0.08
    jointInsert.name = 'GEO_CUE_JOINT_DARK_SEPARATION'
    jointInsert.castShadow = true
    group.add(jointInsert)
  }
  if (slot === 'TIP') {
    const tipEnd = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#5b3b2b', roughness: 0.9, metalness: 0.02 }))
    tipEnd.name = 'GEO_CUE_TIP_END'
    tipEnd.scale.set(0.05, layout.rightRadius * 0.98, layout.rightRadius * 0.98)
    tipEnd.position.x = layout.length * 0.49
    tipEnd.castShadow = true
    group.add(tipEnd)
  }
  if (slot === 'BUTT_PLATE') {
    const edge = new THREE.Mesh(
      new THREE.CylinderGeometry(layout.rightRadius * 1.02, layout.leftRadius * 1.02, 0.025, 40),
      new THREE.MeshPhysicalMaterial({ color: '#c7a76a', roughness: 0.25, metalness: 0.68 })
    )
    edge.rotation.z = -Math.PI / 2
    edge.position.x = layout.length * 0.46
    edge.name = 'GEO_CUE_BUTT_PLATE_EDGE'
    group.add(edge)
  }
  group.position.set(layout.x, 0, 0)
  return group
}

const disposeObject = (object) => {
  object.traverse((child) => {
    if (!child.isMesh) return
    child.geometry?.dispose?.()
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.())
    else child.material?.dispose?.()
  })
}

const rebuildCue = () => {
  if (!scene) return
  if (cueGroup) {
    disposeObject(cueGroup)
    scene.remove(cueGroup)
  }
  cueGroup = new THREE.Group()
  cueGroup.name = 'GEO_CUE_MASTER_P01'
  cueGroup.scale.copy(CUE_DISPLAY_SCALE)
  cueGroup.rotation.set(CUE_DISPLAY_ROTATION.x, CUE_DISPLAY_ROTATION.y, CUE_DISPLAY_ROTATION.z)
  PART_ORDER.forEach((slot) => {
    const part = createPart(slot)
    if (part) cueGroup.add(part)
  })
  const ringColor = colorFor('JOINT')
  ;[
    { x: 7.50, radius: 0.067, tube: 0.014, name: 'GEO_CUE_RING_TIP' },
    { x: -0.34, radius: 0.145, tube: 0.022, name: 'GEO_CUE_RING_JOINT_A' },
    { x: -0.15, radius: 0.147, tube: 0.012, name: 'GEO_CUE_RING_JOINT_B' },
    { x: 0.04, radius: 0.137, tube: 0.011, name: 'GEO_CUE_RING_JOINT_C' },
    { x: -3.47, radius: 0.157, tube: 0.014, name: 'GEO_CUE_RING_FOREARM' },
    { x: -5.81, radius: 0.180, tube: 0.014, name: 'GEO_CUE_RING_HANDLE' },
    { x: -7.57, radius: 0.207, tube: 0.014, name: 'GEO_CUE_RING_BUTT' }
  ].forEach(({ x, radius, tube }, index) => {
    addCueRing(cueGroup, x, radius, tube, ringColor, `GEO_CUE_RINGWORK_${index + 1}`)
  })
  const buttCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.195, 0.195, 0.22, 32),
    new THREE.MeshPhysicalMaterial({ color: colorFor('BUMPER'), roughness: 0.42, metalness: 0.04, clearcoat: 0.18 })
  )
  buttCap.rotation.z = -Math.PI / 2
  buttCap.position.x = -7.84
  buttCap.name = 'GEO_CUE_BUTT_CAP'
  buttCap.castShadow = true
  cueGroup.add(buttCap)
  const buttEnd = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.175, 0.028, 32),
    new THREE.MeshPhysicalMaterial({ color: '#090b0d', roughness: 0.58, metalness: 0.02 })
  )
  buttEnd.rotation.z = -Math.PI / 2
  buttEnd.position.x = -7.965
  buttEnd.name = 'GEO_CUE_BUMPER_END_FACE'
  buttEnd.castShadow = true
  cueGroup.add(buttEnd)
  scene.add(cueGroup)
  cueGroup.position.y = 0.28
  updatePartPositions()
}

const focusXFor = (slot) => {
  if (!slot) return 0
  const layout = PART_LAYOUT[slot]
  return layout ? layout.x : 0
}

const updatePartPositions = () => {
  if (!cueGroup) return
  const focusX = focusXFor(props.focusSlot)
  focusTargetGoal.set(focusX * 0.35, 0.14, 0)
  cameraLookAtGoal.set(focusX * 0.35, 0.14, 0)
  cameraGoal.set(focusX * 0.35, props.detailMode ? 1.55 : 1.95, props.detailMode ? 10.5 : fullCameraDistance)
  cueGroup.children.forEach((part, index) => {
    if (!part.userData?.slot) return
    const layout = PART_LAYOUT[part.userData.slot]
    const amount = props.exploded ? ((index - 4.5) * 0.13) : 0
    part.position.x = layout.x + amount * layout.axis
    part.position.y = props.focusSlot === part.userData.slot ? 0.08 : 0
    const selected = props.design?.components?.find((item) => item.slot === part.userData.slot)
    const variant = getVariant(part.userData.slot, selected?.variantId)
    part.scale.setScalar(props.focusSlot && props.focusSlot === part.userData.slot ? 1.08 : 1)
    part.userData.variantId = variant?.variantId || ''
  })
}

const triggerPulse = () => {
  pulseStartedAt = performance.now()
}

const renderFrame = (time) => {
  if (!renderer || !scene || !camera) return
  animationFrame = window.requestAnimationFrame(renderFrame)
  if (cueGroup && !reducedMotion && !props.exploded && !props.focusSlot) cueGroup.rotation.y = CUE_DISPLAY_ROTATION.y + Math.sin(time * 0.00016) * 0.035
  if (cueGroup && pulseStartedAt) {
    const progress = Math.min(1, (time - pulseStartedAt) / 650)
    const wave = Math.sin(progress * Math.PI)
    cueGroup.position.y = 0.28 + wave * 0.05
    if (progress >= 1) {
      pulseStartedAt = 0
      cueGroup.position.y = 0.28
    }
  }
  focusTarget.lerp(focusTargetGoal, reducedMotion ? 1 : 0.08)
  camera.position.lerp(cameraGoal, reducedMotion ? 1 : 0.06)
  controls?.target.lerp(cameraLookAtGoal, reducedMotion ? 1 : 0.08)
  controls?.update()
  renderer.render(scene, camera)
}

const resize = () => {
  if (!stageRoot.value || !renderer || !camera) return
  const width = Math.max(1, stageRoot.value.clientWidth)
  const height = Math.max(1, stageRoot.value.clientHeight)
  camera.fov = width < 640 ? 38 : 32
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect)
  // Include projected depth from the 3/4 display rotation so both the butt
  // cap and the tip stay inside the stage at narrow widths.
  // Leave enough margin for the angled tip and butt cap; the previous fit
  // used the unrotated length and clipped both ends on narrow stages.
  // The cue geometry is authored in a compact prototype unit space. A
  // calibrated distance keeps the full cue legible without letting the
  // narrow mobile stage clip the tip or butt cap.
  fullCameraDistance = width < 640 ? 23 : 25
  cameraGoal.z = props.detailMode ? 10.5 : fullCameraDistance
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 640 ? 1.5 : 2))
  renderer.setSize(width, height, false)
}

const mountScene = () => {
  if (!canvas.value || !stageRoot.value) return
  try {
    scene = new THREE.Scene()
    scene.background = new THREE.Color('#171817')
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.copy(cameraGoal)
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    controls = new OrbitControls(camera, canvas.value)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 7
    controls.maxDistance = 40
    controls.target.set(0, 0, 0)

    scene.add(new THREE.HemisphereLight('#f7ebd2', '#101314', 2.1))
    const key = new THREE.DirectionalLight('#fff1d8', 4.2)
    key.position.set(2, 6, 8)
    key.castShadow = true
    scene.add(key)
    const rim = new THREE.DirectionalLight('#b5c7d2', 2.2)
    rim.position.set(-8, 2, -5)
    scene.add(rim)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshStandardMaterial({ color: '#111312', roughness: 0.78, metalness: 0.04 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.74
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(26, 26, '#4a4136', '#242723')
    grid.position.y = -0.72
    grid.material.opacity = 0.32
    grid.material.transparent = true
    scene.add(grid)

    reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false
    rebuildCue()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(stageRoot.value)
    resize()
    animationFrame = window.requestAnimationFrame(renderFrame)
    emit('ready')
  } catch (error) {
    unavailable.value = true
    emit('error', error)
  }
}

const unmountScene = () => {
  if (animationFrame) window.cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect?.()
  controls?.dispose?.()
  if (cueGroup) disposeObject(cueGroup)
  renderer?.dispose?.()
  renderer = null
  scene = null
  camera = null
  controls = null
  cueGroup = null
}

onMounted(mountScene)
onBeforeUnmount(unmountScene)
watch(() => props.design, rebuildCue, { deep: true })
watch(() => [props.focusSlot, props.exploded, props.detailMode], updatePartPositions)
watch(() => props.assemblePulse, triggerPulse)
</script>

<style scoped>
.cue-stage { position: relative; min-height: 0; height: 100%; overflow: hidden; background: #171817; border: 1px solid rgba(255,255,255,.12); }
.cue-stage::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, rgba(255,255,255,.05), transparent 34%, rgba(0,0,0,.24)); }
canvas { display: block; width: 100%; height: 100%; min-height: 0; cursor: grab; }
canvas:active { cursor: grabbing; }
.stage-corner { position: absolute; z-index: 2; left: 18px; color: rgba(244,240,232,.55); font-size: 10px; letter-spacing: .16em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; pointer-events: none; }
.stage-corner-top { top: 18px; }.stage-corner-bottom { bottom: 18px; }
.stage-focus-line { position: absolute; z-index: 2; right: 18px; bottom: 18px; color: rgba(244,240,232,.45); font-size: 10px; letter-spacing: .1em; pointer-events: none; }.stage-focus-line.is-active { color: #d6ad72; }
.stage-fallback { position: absolute; inset: 50% 24px auto; z-index: 3; display: grid; gap: 8px; transform: translateY(-50%); color: #f4f0e8; text-align: center; }.stage-fallback span:last-child { color: rgba(244,240,232,.62); font-size: 12px; }.fallback-kicker { color: #d6ad72; font-size: 10px; letter-spacing: .16em; }
@media (max-width: 760px) { .cue-stage, canvas { min-height: 42vh; height: 46vh; }.stage-corner { left: 12px; }.stage-focus-line { right: 12px; } }
</style>
