// SPDX-License-Identifier: AGPL-3.0-or-later
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export const BRAIN_DOMAINS = Object.freeze({
  sales: { label: '销售', color: '#187c91', center: [-6.5, 7, 2.8] },
  hr: { label: '人事', color: '#9b527c', center: [6.5, 7, 2.8] },
  materials: { label: '仓储物料', color: '#29815e', center: [-6.5, 0, 3.5] },
  apps: { label: '应用中心', color: '#b47719', center: [6.5, 0, 3.5] },
  shared: { label: '公共基础', color: '#62728d', center: [0, 4, -4.2] }
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const gaussian = (value, center, width) => Math.exp(-(((value - center) / width) ** 2))
const groove = (distance, width) => gaussian(distance, 0, width)

function fraction(value, salt) {
  let hash = 2166136261
  for (const char of `${salt}:${value}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) / 4294967296
}

export function getBrainNodePosition(node) {
  const domain = BRAIN_DOMAINS[node.domain] || BRAIN_DOMAINS.shared
  const theta = fraction(node.id, 'angle') * Math.PI * 2
  const latitude = fraction(node.id, 'latitude') * 2 - 1
  const radius = 0.55 + fraction(node.id, 'radius') * 0.45
  const ring = Math.sqrt(1 - latitude * latitude)
  return [
    domain.center[0] + Math.cos(theta) * ring * radius * 3.4,
    domain.center[1] + latitude * radius * 3.2,
    domain.center[2] + Math.sin(theta) * ring * radius * 3.2
  ]
}

// Reuses the desktop cognitive-knowledge prototype's voxel hemisphere, folia,
// and tapering brainstem equations, without its demo graph or animation loop.
export function createVoxelBrain() {
  const group = new THREE.Group()
  const geometry = new THREE.BoxGeometry(0.43, 0.43, 0.43)
  const material = new THREE.MeshLambertMaterial({
    color: '#869496', transparent: true, opacity: 0.2, depthWrite: false
  })
  function addVoxels(points, name) {
    const mesh = new THREE.InstancedMesh(geometry, material, points.length)
    const dummy = new THREE.Object3D()
    points.forEach((point, index) => {
      dummy.position.set(...point)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.name = name
    mesh.renderOrder = 0
    group.add(mesh)
  }
  for (const side of [-1, 1]) {
    const points = []
    const centerX = side * 5.15
    for (let ti = 0; ti < 72; ti += 1) {
      const theta = Math.PI * ti / 71
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)
      const ringCount = Math.max(1, Math.round(116 * Math.max(0.036, sinT)))
      for (let pi = 0; pi < ringCount; pi += 1) {
        const phi = Math.PI * 2 * pi / ringCount + (ti % 2) * Math.PI / Math.max(3, ringCount)
        const sinP = Math.sin(phi)
        const lower = Math.max(0, -cosT)
        const rx = 9.2 * (1 - lower * 0.13) * (1 + Math.max(0, cosT) * 0.03)
        const ry = 12 * (1 + Math.max(0, cosT) * 0.02)
        const rz = 9.8 * (1 - lower * 0.1) * (1 + Math.max(0, sinP) * 0.09 - Math.max(0, -sinP) * 0.05)
        let x = centerX + rx * sinT * Math.cos(phi)
        let y = 2.65 + ry * cosT
        let z = rz * sinT * sinP
        const fissure = 0.34 + 0.23 * gaussian(y, 8.8, 5.4) + 0.07 * gaussian(z, 0, 7)
        x += side * gaussian(Math.abs(x), 0, 2.1) * (0.78 + 0.18 * gaussian(y, 8, 5))
        const xN = clamp((x - centerX) / 10.5, -1, 1)
        const yN = clamp((y - 2.65) / 12, -1, 1)
        const zN = clamp(z / 10.2, -1, 1)
        const fade = clamp((sinT - 0.12) / 0.22, 0, 1)
        const crown = gaussian(theta, Math.PI * 0.12, Math.PI * 0.12) * gaussian(y, 12.4, 3.4)
        const lateral = clamp((Math.abs(x) - 3.6) / 6.6, 0, 1)
        const frontal = clamp((zN + 0.12) / 1.08, 0, 1)
        const superior = clamp((yN + 0.12) / 1.08, 0, 1)
        const temporal = clamp((-yN + 0.2) / 1.12, 0, 1) * lateral
        let displacement = (
          frontal * (0.2 * Math.sin((zN * 5 - yN * 1.15 + side * 0.13) * Math.PI) + 0.105 * Math.sin((zN * 8.6 + xN * 1.1 - yN * 0.45) * Math.PI)) +
          superior * (0.235 * Math.sin((xN * 4.45 + zN * 0.46 + side * 0.1) * Math.PI) + 0.105 * Math.sin((xN * 7.9 - zN * 0.85 + yN * 0.33) * Math.PI)) +
          temporal * (0.195 * Math.sin((yN * 3.15 + zN * 2.48 + xN * 0.33) * Math.PI) + 0.092 * Math.sin((zN * 5.35 - yN * 1.12 - side * 0.16) * Math.PI))
        ) * 0.64 * fade * (1 - crown * 0.43)
        const central = 2 + 0.95 * Math.sin(x * 0.115) - 0.085 * (y - 5.5) + 0.16 * Math.sin(y * 0.28)
        displacement -= groove(z - central, 0.56) * gaussian(y, 6.2, 5.8) * (0.3 + 0.7 * Math.min(1, Math.abs(x) / 9.2)) * fade * (1 - crown * 0.8) * 1.34
        displacement -= groove(z + 0.35 - 0.72 * Math.sin(x * 0.1 + 0.35) + 0.055 * (y - 5), 0.43) * gaussian(y, 6.6, 4.7) * lateral * fade * 0.62
        displacement -= groove(z + 2.6 - 0.55 * Math.sin(x * 0.13) - 0.1 * (y - 7), 0.39) * gaussian(y, 8.1, 3.5) * lateral * fade * 0.56
        const lateralTarget = 0.85 + 0.58 * Math.sin(z * 0.19) - 0.035 * (Math.abs(x) - 7)
        displacement -= groove(y - lateralTarget, 0.48) * gaussian(z, 2, 5.9) * lateral * fade * (1 - crown * 0.77) * 1.36
        displacement -= groove(y + 0.95 - 0.42 * Math.sin(z * 0.2 + 0.65), 0.36) * gaussian(z, 1.2, 5.4) * lateral * 0.54
        displacement -= groove(z + 5.75 - 0.34 * Math.sin(x * 0.16), 0.48) * gaussian(y, 7.3, 4) * fade * 0.96
        if (crown > 0.1 && displacement < -0.16) displacement = -0.16 + (displacement + 0.16) * 0.11
        displacement = Math.max(displacement, -1.42)
        const normal = new THREE.Vector3((x - centerX) / (rx * rx), (y - 2.65) / (ry * ry), z / (rz * rz)).normalize()
        x += normal.x * displacement
        y += normal.y * displacement
        z += normal.z * displacement
        if ((y < -5.5 && Math.abs(x) > 8 && z > 1) || y < -7.6 || (z > 12 && Math.abs(x) > 8.2) || (Math.abs(x) < fissure && y > -0.5)) continue
        points.push([x, y, z])
      }
    }
    addVoxels(points, side < 0 ? 'left-hemisphere' : 'right-hemisphere')
    const cerebellum = []
    for (let ti = 3; ti < 39; ti += 1) {
      const theta = Math.PI * ti / 41
      for (let pi = 0; pi < 68; pi += 1) {
        const phi = Math.PI * 2 * pi / 68
        const cx = side * 4
        let x = cx + 4 * Math.sin(theta) * Math.cos(phi)
        let y = -6.7 + 2.65 * Math.cos(theta)
        let z = -6.9 + 3.1 * Math.sin(theta) * Math.sin(phi)
        const stripe = Math.sin(theta * 22 + Math.sin(phi * 2.2)) * 0.22 + Math.sin(phi * 6) * 0.05
        const normal = new THREE.Vector3((x - cx) / 16, (y + 6.7) / 2.65 ** 2, (z + 6.9) / 3.1 ** 2).normalize()
        x += normal.x * stripe
        y += normal.y * stripe
        z += normal.z * stripe
        cerebellum.push([x, y, z])
      }
    }
    addVoxels(cerebellum, side < 0 ? 'left-cerebellum' : 'right-cerebellum')
  }
  const stem = []
  for (let y = -7.3; y >= -15.6; y -= 0.3) {
    const t = Math.abs(y + 7.3) / 8.3
    const radius = 0.95 - t * 0.42 + Math.sin(t * 7) * 0.04
    for (let i = 0; i < 16; i += 1) {
      const angle = Math.PI * 2 * i / 16
      stem.push([Math.cos(angle) * radius * 0.72, y, -5.9 + Math.sin(angle) * radius * 0.52])
    }
  }
  addVoxels(stem, 'brainstem')
  return group
}

function disposeGroup(group) {
  const geometries = new Set()
  const materials = new Set()
  group.traverse((item) => {
    if (item.geometry) geometries.add(item.geometry)
    for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
      if (material) materials.add(material)
    }
    if (item.isInstancedMesh) item.dispose()
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  group.clear()
}

export function createOntologyBrainScene(host, callbacks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  const canvas = renderer.domElement
  canvas.setAttribute('aria-label', '本体三维大脑图谱')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('tabindex', '0')
  canvas.dataset.ready = 'false'
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor('#f5f8f9', 1)
  host.appendChild(canvas)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = false
  controls.minDistance = 12
  controls.maxDistance = 140
  controls.target.set(0, -0.4, 0)
  scene.add(new THREE.AmbientLight('#ffffff', 2.1))
  const light = new THREE.DirectionalLight('#ffffff', 2)
  light.position.set(-15, 25, 30)
  scene.add(light)
  const brain = createVoxelBrain()
  scene.add(brain)
  const graphGroup = new THREE.Group()
  scene.add(graphGroup)
  let nodes = new Map()
  let edgeMeshes = []
  let nodeMeshes = []
  let graph = { nodes: [], edges: [] }
  let selectedNodeId = ''
  let selectedEdgeId = ''
  let active = true
  let destroyed = false
  let frame = 0
  let renderCount = 0
  let lastSize = { width: 0, height: 0 }
  const raycaster = new THREE.Raycaster()
  raycaster.params.Line.threshold = 0.2
  const pointer = new THREE.Vector2()
  let pressedAt = null
  let labels = []

  function renderLabels() {
    const occupied = []
    const selectedEdge = edgeMeshes.find((mesh) => mesh.userData.item.id === selectedEdgeId)?.userData.item
    const priority = [...nodeMeshes].sort((a, b) => {
      const score = (mesh) => mesh.userData.item.id === selectedNodeId ? 2 : selectedEdge && [selectedEdge.source, selectedEdge.target].includes(mesh.userData.item.id) ? 1 : 0
      return score(b) - score(a) || String(a.userData.item.id).localeCompare(String(b.userData.item.id))
    })
    labels = []
    for (const mesh of priority) {
      const point = mesh.position.clone().project(camera)
      if (point.z < -1 || point.z > 1) continue
      const x = (point.x + 1) * lastSize.width / 2
      const y = (1 - point.y) * lastSize.height / 2
      const item = mesh.userData.item
      const labelWidth = Math.min(160, Math.max(56, [...String(item.label)].length * 12 + 14))
      if (x < 12 || x > lastSize.width - 12 || y < 18 || y > lastSize.height - 28) continue
      if (occupied.some((rect) => Math.abs(rect.x - x) < (rect.width + labelWidth) / 2 && Math.abs(rect.y - y) < 26)) continue
      if (labels.length >= 16) break
      labels.push({ id: item.id, label: item.label, x, y: y + 8, color: BRAIN_DOMAINS[item.domain]?.color || BRAIN_DOMAINS.shared.color })
      occupied.push({ x, y, width: labelWidth })
    }
    callbacks.onLabels?.(labels)
  }

  function render() {
    frame = 0
    if (destroyed || !active || document.hidden || !lastSize.width || !lastSize.height) return
    renderer.render(scene, camera)
    renderCount += 1
    canvas.dataset.renderCount = String(renderCount)
    renderLabels()
  }
  function invalidate() {
    if (!destroyed && active && !document.hidden && !frame) frame = requestAnimationFrame(render)
  }
  function resize() {
    if (destroyed) return
    const width = Math.round(host.clientWidth)
    const height = Math.round(host.clientHeight)
    if (!width || !height) return
    lastSize = { width, height }
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    invalidate()
  }
  function reset(front = false) {
    const distance = Math.max(58, 44 / (camera.aspect || 1))
    controls.target.set(0, -0.4, 0)
    camera.position.copy(new THREE.Vector3(front ? 0 : 0.43, front ? 0.09 : 0.24, 1).normalize().multiplyScalar(distance))
    controls.update()
    invalidate()
  }
  function selection(nodeId, edgeId) {
    selectedNodeId = String(nodeId || '')
    selectedEdgeId = String(edgeId || '')
    const neighbors = new Set([selectedNodeId])
    for (const mesh of edgeMeshes) {
      const edge = mesh.userData.item
      if (edge.source === selectedNodeId || edge.target === selectedNodeId || edge.id === selectedEdgeId) {
        neighbors.add(edge.source)
        neighbors.add(edge.target)
      }
      const highlighted = edge.id === selectedEdgeId || (selectedNodeId && [edge.source, edge.target].includes(selectedNodeId))
      mesh.material.color.set(highlighted ? '#d37b17' : '#8198a4')
      mesh.material.opacity = highlighted ? 1 : selectedNodeId || selectedEdgeId ? 0.13 : 0.32
      mesh.renderOrder = highlighted ? 4 : 1
    }
    for (const mesh of nodeMeshes) {
      const node = mesh.userData.item
      const chosen = node.id === selectedNodeId
      mesh.scale.setScalar(chosen ? 1.8 : neighbors.has(node.id) ? 1.3 : 1)
      mesh.material.opacity = !selectedNodeId && !selectedEdgeId || neighbors.has(node.id) ? 1 : 0.28
      mesh.material.color.set(chosen ? '#d37512' : BRAIN_DOMAINS[node.domain]?.color || BRAIN_DOMAINS.shared.color)
    }
    canvas.dataset.selectedNodeId = selectedNodeId
    canvas.dataset.selectedEdgeId = selectedEdgeId
    invalidate()
  }
  function setGraph(next) {
    disposeGroup(graphGroup)
    graph = next || { nodes: [], edges: [] }
    nodeMeshes = []
    edgeMeshes = []
    nodes = new Map()
    for (const item of graph.nodes || []) {
      if (!item.id || nodes.has(item.id)) continue
      const geometry = ['permission', 'role'].includes(item.type) ? new THREE.OctahedronGeometry(0.38) : item.type === 'field' ? new THREE.BoxGeometry(0.44, 0.44, 0.44) : new THREE.SphereGeometry(0.34, 12, 8)
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: BRAIN_DOMAINS[item.domain]?.color || BRAIN_DOMAINS.shared.color, transparent: true, depthTest: false }))
      mesh.position.set(...getBrainNodePosition(item))
      mesh.userData.item = item
      mesh.renderOrder = 3
      graphGroup.add(mesh)
      nodes.set(item.id, mesh)
      nodeMeshes.push(mesh)
    }
    for (const item of graph.edges || []) {
      const source = nodes.get(item.source)
      const target = nodes.get(item.target)
      if (!source || !target) continue
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([source.position, target.position]), new THREE.LineBasicMaterial({ color: '#8198a4', transparent: true, opacity: 0.32, depthTest: false }))
      line.userData.item = item
      graphGroup.add(line)
      edgeMeshes.push(line)
    }
    canvas.dataset.nodeCount = String(nodeMeshes.length)
    canvas.dataset.edgeCount = String(edgeMeshes.length)
    canvas.dataset.ready = 'true'
    selection(selectedNodeId, selectedEdgeId)
  }
  function intersect(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObjects(nodeMeshes, false)[0] || raycaster.intersectObjects(edgeMeshes, false)[0]
  }
  function pointerDown(event) { pressedAt = { x: event.clientX, y: event.clientY } }
  function pick(event) {
    if (!pressedAt || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > 5) return
    pressedAt = null
    const hit = intersect(event)
    if (!hit) return
    if (hit.object.isLine) callbacks.onPickEdge?.(hit.object.userData.item)
    else callbacks.onPickNode?.(hit.object.userData.item)
  }
  function hover(event) {
    const hit = intersect(event)
    canvas.style.cursor = hit ? 'pointer' : 'grab'
    callbacks.onHover?.(hit?.object.userData.item?.label || '')
  }
  function keydown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') return reset()
    const offset = camera.position.clone().sub(controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    if (event.key === 'ArrowLeft') spherical.theta -= 0.12
    if (event.key === 'ArrowRight') spherical.theta += 0.12
    if (event.key === 'ArrowUp') spherical.phi -= 0.12
    if (event.key === 'ArrowDown') spherical.phi += 0.12
    if (['+', '='].includes(event.key)) spherical.radius *= 0.9
    if (event.key === '-') spherical.radius *= 1.1
    spherical.radius = clamp(spherical.radius, controls.minDistance, controls.maxDistance)
    spherical.makeSafe()
    camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(controls.target))
    controls.update()
    invalidate()
  }
  function contextLost(event) {
    event.preventDefault()
    active = false
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    canvas.dataset.ready = 'false'
    callbacks.onUnavailable?.('图形上下文已中断，已切换到二维关系视图。')
  }
  function visibility() {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0 }
    else invalidate()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  controls.addEventListener('change', invalidate)
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('click', pick)
  canvas.addEventListener('pointermove', hover)
  canvas.addEventListener('keydown', keydown)
  canvas.addEventListener('webglcontextlost', contextLost)
  document.addEventListener('visibilitychange', visibility)
  resize()
  reset()
  return {
    setGraph,
    setSelection: selection,
    setActive(value) {
      active = Boolean(value)
      controls.enabled = active
      if (!active && frame) { cancelAnimationFrame(frame); frame = 0 }
      if (active) { resize(); invalidate() }
    },
    reset: () => reset(false),
    front: () => reset(true),
    setTransparent(value) { brain.children.forEach((mesh) => { mesh.material.opacity = value ? 0.09 : 0.2 }); invalidate() },
    focus(id) {
      const mesh = nodes.get(id)
      if (!mesh) return
      const direction = camera.position.clone().sub(controls.target).normalize()
      controls.target.copy(mesh.position)
      camera.position.copy(mesh.position).add(direction.multiplyScalar(21))
      controls.update()
      invalidate()
    },
    dispose() {
      if (destroyed) return
      destroyed = true
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      controls.removeEventListener('change', invalidate)
      controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('click', pick)
      canvas.removeEventListener('pointermove', hover)
      canvas.removeEventListener('keydown', keydown)
      canvas.removeEventListener('webglcontextlost', contextLost)
      document.removeEventListener('visibilitychange', visibility)
      disposeGroup(brain)
      disposeGroup(graphGroup)
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      callbacks.onLabels?.([])
    }
  }
}
