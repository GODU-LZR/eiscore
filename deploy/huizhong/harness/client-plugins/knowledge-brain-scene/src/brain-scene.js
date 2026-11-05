import * as THREE from 'three'
import { createVoxelBrain, createOntologySpaceGrid } from '../../../../../../eiscore-apps/src/visualization/ontology-brain-scene.js'

export const createBrainScene = (canvas) => {
  if (!canvas) return { ready: false, setMode() {}, dispose() {} }
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
  } catch {
    canvas.dataset.brainWebglUnavailable = 'true'
    return { ready: false, setMode() {}, dispose() {} }
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60)
  camera.position.set(0, 1.12, 7.8)
  camera.lookAt(0, 0, 0)
  renderer.setClearColor(0xffffff, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const root = new THREE.Group()
  root.position.y = 0.12
  scene.add(root)
  scene.add(new THREE.AmbientLight(0xffffff, 1.45))
  const key = new THREE.DirectionalLight(0xffffff, 1.05)
  key.position.set(-3, 5, 7)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xd5e2ed, 0.35)
  fill.position.set(4, 1, -4)
  scene.add(fill)

  const grid = createOntologySpaceGrid()
  grid.scale.setScalar(0.1)
  grid.traverse(object => { if (object.material) object.material.opacity *= 0.32 })
  grid.rotation.set(0.12, 0.30, 0)
  scene.add(grid)

  const cortex = createVoxelBrain()
  cortex.scale.setScalar(0.095)
  cortex.traverse(object => {
    if (object.material) {
      object.material.color.set('#718185')
      object.material.opacity = 0.14
    }
  })
  root.add(cortex)

  const random = (() => {
    let seed = 20261105
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
  })()
  const nodeCount = 280
  const nodePositions = new Float32Array(nodeCount * 3)
  const nodeColors = new Float32Array(nodeCount * 3)
  for (let index = 0; index < nodeCount; index++) {
    const angle = random() * Math.PI * 2
    const vertical = (random() * 2 - 1) * 0.92
    const ring = Math.sqrt(1 - vertical * vertical)
    const scale = 0.38 + random() * 0.60
    nodePositions[index * 3] = Math.cos(angle) * 1.28 * ring * scale
    nodePositions[index * 3 + 1] = vertical * 1.04 * scale + 0.20
    nodePositions[index * 3 + 2] = Math.sin(angle) * 0.97 * ring * scale
    nodeColors[index * 3] = 0.48
    nodeColors[index * 3 + 1] = 0.57
    nodeColors[index * 3 + 2] = 0.63
  }
  const nodesGeometry = new THREE.BufferGeometry()
  nodesGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3))
  const colorsAttribute = new THREE.BufferAttribute(nodeColors, 3)
  nodesGeometry.setAttribute('color', colorsAttribute)
  const nodes = new THREE.Points(nodesGeometry, new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.78, sizeAttenuation: true, depthWrite: false, depthTest: false }))
  nodes.renderOrder = 3
  root.add(nodes)

  const edgePositions = new Float32Array(nodeCount * 2 * 3)
  for (let index = 0; index < nodeCount; index++) {
    const neighbor = (index + 17 + Math.floor(random() * 23)) % nodeCount
    edgePositions.set(nodePositions.subarray(index * 3, index * 3 + 3), index * 6)
    edgePositions.set(nodePositions.subarray(neighbor * 3, neighbor * 3 + 3), index * 6 + 3)
  }
  const edgesGeometry = new THREE.BufferGeometry()
  edgesGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
  const edges = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({ color: 0x8ca3b2, transparent: true, opacity: 0.12, depthWrite: false, depthTest: false }))
  edges.renderOrder = 2
  root.add(edges)

  const pulsePositions = new Float32Array(24 * 3)
  const pulseGeometry = new THREE.BufferGeometry()
  const pulseAttribute = new THREE.BufferAttribute(pulsePositions, 3)
  pulseGeometry.setAttribute('position', pulseAttribute)
  const pulses = new THREE.Points(pulseGeometry, new THREE.PointsMaterial({ color: 0x1096c5, size: 0.10, depthTest: false, depthWrite: false }))
  pulses.renderOrder = 4
  root.add(pulses)

  let mode = 'idle'
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let renders = 0
  let frame = 0
  let lastFrame = 0
  let width = 1
  let height = 1
  const resize = () => {
    width = Math.max(1, canvas.clientWidth)
    height = Math.max(1, canvas.clientHeight)
    camera.aspect = width / height
    camera.position.z = Math.max(6.2, 4.8 / camera.aspect)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    if (mode !== 'idle') renderer.render(scene, camera)
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  resizeObserver?.observe(canvas)
  window.addEventListener('resize', resize)
  resize()

  const render = (time) => {
    frame = 0
    if (mode === 'idle' || document.hidden || time - lastFrame < 1000 / 24) {
      if (mode !== 'idle' && !document.hidden) frame = window.requestAnimationFrame(render)
      return
    }
    lastFrame = time
    const thinking = mode === 'thinking'
    const colors = colorsAttribute.array
    for (let index = 0; index < nodeCount; index++) {
      const pulse = thinking ? Math.max(0, Math.sin(time * 0.004 - index * 0.31)) : 0
      colors[index * 3] = 0.40 - pulse * 0.30
      colors[index * 3 + 1] = 0.53 + pulse * 0.18
      colors[index * 3 + 2] = 0.62 + pulse * 0.28
    }
    colorsAttribute.needsUpdate = true
    if (thinking) {
      for (let i = 0; i < 24; i++) {
        const edge = (i * 11) % nodeCount
        const progress = (time * 0.0006 + i / 24) % 1
        for (let axis = 0; axis < 3; axis++) {
          const from = edgePositions[edge * 6 + axis]
          pulsePositions[i * 3 + axis] = from + (edgePositions[edge * 6 + 3 + axis] - from) * progress
        }
      }
      pulseAttribute.needsUpdate = true
    }
    if (!reducedMotion) root.rotation.y = 0.12 + Math.sin(time * 0.00012) * 0.09
    renderer.render(scene, camera)
    canvas.dataset.renderCount = String(++renders)
    if (!reducedMotion) frame = window.requestAnimationFrame(render)
  }

  const setMode = (next) => {
    mode = ['hero', 'thinking', 'settling'].includes(next) ? next : 'idle'
    edges.material.opacity = mode === 'thinking' ? 0.23 : 0.06
    nodes.material.size = mode === 'thinking' ? 0.07 : 0.035
    pulses.visible = mode === 'thinking'
    root.visible = mode !== 'idle'
    grid.visible = mode !== 'idle'
    if (mode !== 'idle' && !frame) frame = window.requestAnimationFrame(render)
    if (mode === 'idle') {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      renderer.render(scene, camera)
    }
  }
  const onVisibility = () => setMode(mode)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    setMode,
    ready: true,
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility)
      setMode('idle')
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      const resources = new Set()
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) resources.add(material)
        if (object.isInstancedMesh) object.dispose()
      })
      resources.forEach(resource => resource.dispose())
      renderer.dispose()
    }
  }
}
