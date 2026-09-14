// SPDX-License-Identifier: AGPL-3.0-or-later

import * as THREE from 'three'

export const PINEAPPLE_PROCESS_STATIONS = Object.freeze([
  Object.freeze({
    id: 'raw',
    x: -9,
    labelZh: '菠萝原料',
    labelEn: 'Raw pineapple',
    detailZh: '原果进入加工路径，等待分选与预处理。',
    detailEn: 'Whole fruit enters the line for grading and preparation.'
  }),
  Object.freeze({
    id: 'prepare',
    x: -4.6,
    labelZh: '预处理',
    labelEn: 'Preparation',
    detailZh: '以分选、清洗、去皮和切分表达原料预处理。',
    detailEn: 'Grading, washing, peeling and cutting prepare the fruit.'
  }),
  Object.freeze({
    id: 'extract',
    x: 0,
    labelZh: '榨汁 / 打浆',
    labelEn: 'Juice / pulping',
    detailZh: '果肉进入榨汁与打浆单元，形成可继续加工的中间物料。',
    detailEn: 'Fruit enters juice and pulping units to create intermediate material.'
  }),
  Object.freeze({
    id: 'split',
    x: 5.4,
    labelZh: '四路分流',
    labelEn: 'Four-way split',
    detailZh: '物料分流为果汁、果泥、果粒与果馅四种产品形态。',
    detailEn: 'Material separates into juice, puree, fruit pieces and fruit filling.'
  }),
  Object.freeze({
    id: 'pack',
    x: 10.4,
    labelZh: '包装成品',
    labelEn: 'Finished packs',
    detailZh: '四类产品以中性包装形态汇入成品端，实际包装规格待企业确认。',
    detailEn: 'Four neutral pack formats form the finished range; specifications await confirmation.'
  })
])

export const PINEAPPLE_BRANCHES = Object.freeze([
  Object.freeze({ id: 'juice', z: -3, color: '#f6c84f', labelZh: '果汁', labelEn: 'Juice', pipeRadius: 0.055, flowSpeed: 0.082, particleShape: 'droplet' }),
  Object.freeze({ id: 'puree', z: -1, color: '#eaa23c', labelZh: '果泥', labelEn: 'Puree', pipeRadius: 0.072, flowSpeed: 0.066, particleShape: 'pulp' }),
  Object.freeze({ id: 'pieces', z: 1, color: '#ffd979', labelZh: '果粒', labelEn: 'Pieces', pipeRadius: 0.095, flowSpeed: 0.052, particleShape: 'pieces' }),
  Object.freeze({ id: 'filling', z: 3, color: '#d98532', labelZh: '果馅', labelEn: 'Filling', pipeRadius: 0.086, flowSpeed: 0.044, particleShape: 'filling' })
])

const PALETTE = Object.freeze({
  night: '#ffffff',
  floor: '#ffffff',
  steel: '#9aa9a5',
  steelDark: '#53635f',
  steelLight: '#e6eeeb',
  leaf: '#2f7656',
  leafLight: '#5aa474',
  pineapple: '#e7a82f',
  pineappleLight: '#ffd66c',
  belt: '#2b3936',
  glass: '#bde4dd',
  pineappleSkin: '#d89d27',
  pineappleSkinLight: '#f2c554',
  pineappleSkinDark: '#765b21',
  pineappleEye: '#6f5723',
  pineappleEyeLight: '#f0bf49',
  pineappleFlesh: '#f6c967'
})

const physical = (color, options = {}) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: options.roughness ?? 0.34,
  metalness: options.metalness ?? 0.08,
  clearcoat: options.clearcoat ?? 0.25,
  clearcoatRoughness: options.clearcoatRoughness ?? 0.22,
  emissive: options.emissive || '#000000',
  emissiveIntensity: options.emissiveIntensity ?? 0,
  transparent: options.transparent === true,
  opacity: options.opacity ?? 1,
  transmission: options.transmission ?? 0,
  thickness: options.thickness ?? 0,
  side: options.side || THREE.FrontSide,
  depthWrite: options.depthWrite !== false,
  map: options.map || null,
  bumpMap: options.bumpMap || null,
  bumpScale: options.bumpScale ?? 0,
  envMapIntensity: options.envMapIntensity ?? 1,
  iridescence: options.iridescence ?? 0,
  sheen: options.sheen ?? 0,
  sheenColor: options.sheenColor || '#ffffff'
})

const mesh = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(...position)
  item.rotation.set(...rotation)
  item.scale.set(...scale)
  item.castShadow = material?.transparent !== true
  item.receiveShadow = material?.transparent !== true
  return item
}

const canvasTexture = (width, height, painter) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  painter(context, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

const createPineappleSkinTexture = () => {
  const texture = canvasTexture(512, 512, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#f6d266')
    gradient.addColorStop(0.36, '#e3ad38')
    gradient.addColorStop(0.72, '#c98520')
    gradient.addColorStop(1, '#955d17')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    // A restrained, deterministic grain keeps the skin from reading as a
    // perfectly flat digital gradient when the 3D body catches the light.
    for (let index = 0; index < 460; index += 1) {
      const x = (index * 137.7) % width
      const y = (index * 71.3 + (index % 9) * 13) % height
      const radius = 0.8 + (index % 4) * 0.65
      context.beginPath()
      context.fillStyle = index % 3 === 0 ? 'rgba(255, 231, 135, .16)' : 'rgba(78, 61, 18, .13)'
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }

    // Recessed diagonal seams.  The raised eye geometry added below sits on
    // top of these seams, giving each scale a dark, natural-looking border.
    context.lineWidth = 6
    context.strokeStyle = 'rgba(92, 69, 19, .48)'
    for (let offset = -height; offset < width + height; offset += 64) {
      context.beginPath()
      context.moveTo(offset, 0)
      context.lineTo(offset - height, height)
      context.stroke()
      context.beginPath()
      context.moveTo(offset, 0)
      context.lineTo(offset + height, height)
      context.stroke()
    }
    context.fillStyle = 'rgba(249, 205, 81, .78)'
    context.strokeStyle = 'rgba(99, 72, 19, .78)'
    context.lineWidth = 2.4
    for (let row = 0; row < 10; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const x = column * 62 + (row % 2) * 31
        const y = row * 54 + 8
        const widthScale = 0.9 + ((row * 7 + column * 3) % 5) * 0.035
        const heightScale = 0.92 + ((row * 5 + column) % 4) * 0.04
        context.beginPath()
        context.moveTo(x, y - 13 * heightScale)
        context.lineTo(x + 13 * widthScale, y)
        context.lineTo(x, y + 13 * heightScale)
        context.lineTo(x - 13 * widthScale, y)
        context.closePath()
        context.fill()
        context.stroke()

        // The small central notch is a useful visual cue at a distance and
        // remains legible on phones where individual eye meshes are tiny.
        context.beginPath()
        context.strokeStyle = 'rgba(88, 64, 17, .62)'
        context.lineWidth = 2
        context.moveTo(x - 3.5, y)
        context.lineTo(x, y + 4.8)
        context.lineTo(x + 3.5, y)
        context.stroke()
        context.strokeStyle = 'rgba(99, 72, 19, .78)'
        context.lineWidth = 2.4
      }
    }
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.65, 1.15)
  return texture
}

const createLabelTexture = (eyebrow, title, accent, options = {}) => canvasTexture(768, 192, (context, width, height) => {
  context.clearRect(0, 0, width, height)
  context.fillStyle = options.background || 'rgba(6, 19, 22, .94)'
  context.fillRect(0, 0, width, height)
  context.fillStyle = accent
  context.fillRect(0, 0, 12, height)
  context.fillRect(40, height - 13, width - 74, 3)
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(220, 235, 229, .68)'
  context.font = '700 28px sans-serif'
  context.letterSpacing = '5px'
  context.fillText(eyebrow, 54, 53)
  context.fillStyle = '#f8f6e8'
  context.font = '700 58px sans-serif'
  context.fillText(title, 52, 122)
})

const addStationPlaque = (parent, station, index, accent, depth = 3.4) => {
  const texture = createLabelTexture('STAGE ' + String(index + 1).padStart(2, '0'), station.labelZh, accent)
  const plaque = mesh(
    new THREE.PlaneGeometry(2.36, 0.59),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    [station.x, -0.5, depth * 0.5 + 0.018]
  )
  plaque.castShadow = false
  parent.add(plaque)
  return plaque
}

const addPipe = (parent, points, radius = 0.07, color = PALETTE.steel, options = {}) => {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), false, 'catmullrom', 0.3)
  const pipe = mesh(
    new THREE.TubeGeometry(curve, options.segments || 36, radius, options.radialSegments || 12, false),
    physical(color, {
      roughness: options.roughness ?? 0.22,
      metalness: options.metalness ?? 0.72,
      emissive: options.emissive || '#000000',
      emissiveIntensity: options.emissiveIntensity || 0
    })
  )
  pipe.castShadow = options.castShadow !== false
  parent.add(pipe)
  return { pipe, curve }
}

const FLOW_AXIS = new THREE.Vector3(0, 1, 0)

const smoothStep = (value) => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}

const flowParticleGeometry = (shape = 'pulse', size = 0.09) => {
  if (shape === 'whole') return new THREE.SphereGeometry(size, 12, 9)
  if (shape === 'droplet') return new THREE.SphereGeometry(size, 12, 9)
  if (shape === 'pulp') return new THREE.DodecahedronGeometry(size, 0)
  if (shape === 'pieces') return new THREE.BoxGeometry(size * 1.55, size * 0.92, size * 1.18)
  if (shape === 'filling') return new THREE.IcosahedronGeometry(size, 1)
  return new THREE.SphereGeometry(size, 12, 9)
}

const flowParticleScale = (shape = 'pulse', index = 0) => {
  const variation = 0.92 + (index % 3) * 0.075
  if (shape === 'whole') return new THREE.Vector3(0.82, 1.16, 0.82).multiplyScalar(variation)
  if (shape === 'droplet') return new THREE.Vector3(0.66, 1.42, 0.66).multiplyScalar(variation)
  if (shape === 'pulp') return new THREE.Vector3(1.18, 0.86, 1).multiplyScalar(variation)
  if (shape === 'pieces') return new THREE.Vector3(1, 0.88, 1).multiplyScalar(variation)
  if (shape === 'filling') return new THREE.Vector3(1.32, 0.72, 0.94).multiplyScalar(variation)
  return new THREE.Vector3(1, 1, 1).multiplyScalar(variation)
}

const addSanitaryClamp = (parent, position, axis = 'x', radius = 0.13, accent = PALETTE.steelLight) => {
  const clamp = new THREE.Group()
  clamp.position.set(...position)
  if (axis === 'x') clamp.rotation.y = Math.PI / 2
  if (axis === 'y') clamp.rotation.x = Math.PI / 2

  const steel = physical(PALETTE.steelLight, { roughness: 0.16, metalness: 0.88, clearcoat: 0.42 })
  clamp.add(mesh(new THREE.TorusGeometry(radius, 0.022, 7, 20), steel))
  clamp.add(mesh(
    new THREE.BoxGeometry(0.052, 0.12, 0.046),
    physical(accent, { roughness: 0.24, metalness: 0.64, emissive: accent, emissiveIntensity: 0.12 }),
    [0, radius + 0.045, 0]
  ))
  clamp.add(mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.09, 10),
    steel,
    [0, radius + 0.094, 0],
    [0, 0, Math.PI / 2]
  ))
  parent.add(clamp)
  return clamp
}

const addInlineFlowSight = (parent, position, branch, animated, phase = 0, axis = 'y') => {
  const sight = new THREE.Group()
  sight.position.set(...position)
  if (axis === 'x') sight.rotation.z = -Math.PI / 2
  if (axis === 'z') sight.rotation.x = Math.PI / 2
  const height = 0.54
  const radius = Math.max(0.105, branch.pipeRadius * 1.22)
  const steel = physical(PALETTE.steelLight, { roughness: 0.17, metalness: 0.84, clearcoat: 0.46 })
  const glass = physical(PALETTE.glass, {
    roughness: 0.08,
    transparent: true,
    opacity: 0.2,
    transmission: 0.32,
    thickness: 0.12,
    depthWrite: false
  })
  sight.add(mesh(new THREE.CylinderGeometry(radius, radius, height, 16, 1, true), glass))
  sight.add(mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.09, 16), steel, [0, height * 0.5 + 0.02, 0]))
  sight.add(mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.09, 16), steel, [0, -height * 0.5 - 0.02, 0]))
  addSanitaryClamp(sight, [0, height * 0.5 - 0.02, 0], 'y', radius * 1.18, branch.color)
  addSanitaryClamp(sight, [0, -height * 0.5 + 0.02, 0], 'y', radius * 1.18, branch.color)

  const particleGeometry = flowParticleGeometry(branch.particleShape, Math.min(0.052, radius * 0.42))
  const particleMaterial = physical(branch.color, {
    roughness: branch.particleShape === 'pieces' ? 0.38 : 0.14,
    emissive: branch.color,
    emissiveIntensity: 1.45,
    transparent: branch.particleShape !== 'pieces',
    opacity: branch.particleShape === 'droplet' ? 0.82 : 0.94,
    depthWrite: branch.particleShape === 'pieces'
  })
  const particles = []
  const particleCount = branch.particleShape === 'pieces' ? 4 : 3
  for (let index = 0; index < particleCount; index += 1) {
    const particle = mesh(particleGeometry, particleMaterial)
    particle.scale.copy(flowParticleScale(branch.particleShape, index).multiplyScalar(0.72))
    particle.castShadow = false
    sight.add(particle)
    particles.push({ object: particle, baseScale: particle.scale.clone(), offset: index / particleCount })
  }
  animated.sightFlows.push({ particles, height: height * 0.72, speed: branch.flowSpeed * 4.2, phase, shape: branch.particleShape })
  parent.add(sight)
  return sight
}

// Low-poly direction markers make the sanitary route readable at a glance,
// especially when the four branches are viewed from the wide desktop camera.
const addFlowArrow = (parent, position, color, animated, phase = 0, axis = 'x', direction = 1, scale = 1) => {
  const arrow = mesh(
    new THREE.ConeGeometry(0.085 * scale, 0.24 * scale, 4),
    physical(color, { roughness: 0.2, metalness: 0.28, emissive: color, emissiveIntensity: 1.4 }),
    position
  )
  if (axis === 'x') arrow.rotation.z = direction > 0 ? -Math.PI / 2 : Math.PI / 2
  if (axis === 'z') arrow.rotation.x = direction > 0 ? Math.PI / 2 : -Math.PI / 2
  parent.add(arrow)
  animated.flowMarkers.push({ object: arrow, phase, baseIntensity: 1.4 })
  return arrow
}

const addGauge = (parent, position, animated, phase = 0) => {
  const gauge = new THREE.Group()
  gauge.position.set(...position)
  const bezel = mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.09, 32),
    physical(PALETTE.steelDark, { roughness: 0.2, metalness: 0.78 }),
    [0, 0, 0],
    [Math.PI / 2, 0, 0]
  )
  const face = mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshBasicMaterial({ color: '#e8eee8' }),
    [0, 0, 0.052]
  )
  const tickMaterial = new THREE.MeshBasicMaterial({
    color: '#718682',
    transparent: true,
    opacity: 0.72,
    toneMapped: false,
    depthWrite: false
  })
  const tickGeometry = new THREE.BoxGeometry(0.012, 0.034, 0.008)
  const tickCount = 7
  for (let index = 0; index < tickCount; index += 1) {
    const sweep = THREE.MathUtils.lerp(-0.94, 0.94, index / (tickCount - 1))
    const angle = Math.PI / 2 + sweep
    const tick = mesh(
      tickGeometry,
      tickMaterial,
      [Math.cos(angle) * 0.155, Math.sin(angle) * 0.155, 0.062],
      [0, 0, angle - Math.PI / 2]
    )
    tick.castShadow = false
    tick.receiveShadow = false
    gauge.add(tick)
  }
  const unitTexture = canvasTexture(256, 64, (context, width, height) => {
    context.clearRect(0, 0, width, height)
    context.fillStyle = 'rgba(45, 61, 59, .72)'
    context.font = '700 18px monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('FLOW / CONCEPT', width / 2, height / 2)
  })
  const unitLabel = mesh(
    new THREE.PlaneGeometry(0.17, 0.034),
    new THREE.MeshBasicMaterial({ map: unitTexture, transparent: true, toneMapped: false, depthWrite: false }),
    [0, -0.115, 0.062]
  )
  unitLabel.castShadow = false
  unitLabel.receiveShadow = false
  const needlePivot = new THREE.Group()
  needlePivot.position.z = 0.066
  const needle = mesh(
    new THREE.BoxGeometry(0.025, 0.22, 0.018),
    new THREE.MeshBasicMaterial({ color: '#d4673d' }),
    [0, 0.09, 0]
  )
  needlePivot.add(needle)
  gauge.add(bezel, face, unitLabel, needlePivot)
  parent.add(gauge)
  animated.gauges.push({ object: needlePivot, phase, base: -0.92, range: 1.65 })
  return gauge
}

const addSignalTower = (parent, position, animated, phase = 0) => {
  const tower = new THREE.Group()
  tower.position.set(...position)
  const dark = physical('#243638', { roughness: 0.32, metalness: 0.58 })
  tower.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 12), dark, [0, 0.02, 0]))
  tower.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.08, 18), dark, [0, -0.35, 0]))
  const colors = ['#5bd48d', '#f0bd45', '#e86d55']
  colors.forEach((color, index) => {
    const light = mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.16, 20),
      physical(color, { emissive: color, emissiveIntensity: index === 0 ? 2.2 : 0.18, roughness: 0.12 }),
      [0, 0.25 + index * 0.17, 0]
    )
    tower.add(light)
    animated.signals.push({ object: light, phase: phase + index * 0.75, active: index === 0 })
  })
  parent.add(tower)
  return tower
}

const addValveWheel = (parent, position, color, animated, phase = 0, scale = 1) => {
  const valve = new THREE.Group()
  valve.position.set(...position)
  valve.scale.setScalar(scale)
  const metal = physical('#607375', { roughness: 0.25, metalness: 0.78 })
  const wheelMaterial = physical(color, { roughness: 0.3, metalness: 0.55, clearcoat: 0.34 })
  valve.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 14), metal, [0, -0.15, 0]))
  const wheel = new THREE.Group()
  wheel.position.y = 0.08
  wheel.add(mesh(new THREE.TorusGeometry(0.25, 0.035, 9, 28), wheelMaterial))
  for (let index = 0; index < 4; index += 1) {
    wheel.add(mesh(new THREE.BoxGeometry(0.035, 0.43, 0.028), wheelMaterial, [0, 0, 0], [0, 0, index * Math.PI / 4]))
  }
  wheel.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 16), metal, [0, 0, 0], [Math.PI / 2, 0, 0]))
  valve.add(wheel)
  parent.add(valve)
  animated.valves.push({ object: wheel, phase, speed: 0.34 + phase * 0.015 })
  return valve
}

const addSightGlass = (parent, position, color, animated, phase = 0, height = 1.1) => {
  const sight = new THREE.Group()
  sight.position.set(...position)
  const frame = physical('#677b7b', { roughness: 0.22, metalness: 0.76 })
  const glass = physical('#c5e6df', {
    roughness: 0.08,
    metalness: 0.04,
    transparent: true,
    opacity: 0.24,
    transmission: 0.38,
    thickness: 0.18,
    depthWrite: false
  })
  const liquidMaterial = physical(color, {
    roughness: 0.12,
    transparent: true,
    opacity: 0.86,
    emissive: color,
    emissiveIntensity: 0.2,
    depthWrite: false
  })
  sight.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, height, 18, 1, true), glass))
  sight.add(mesh(new THREE.TorusGeometry(0.11, 0.025, 7, 18), frame, [0, height * 0.5, 0], [Math.PI / 2, 0, 0]))
  sight.add(mesh(new THREE.TorusGeometry(0.11, 0.025, 7, 18), frame, [0, -height * 0.5, 0], [Math.PI / 2, 0, 0]))
  const liquid = mesh(new THREE.CylinderGeometry(0.073, 0.073, height * 0.78, 16), liquidMaterial, [0, -height * 0.09, 0])
  liquid.castShadow = false
  sight.add(liquid)
  // A thin meniscus ring and a few micro-bubbles make the sight glass read as
  // a live sanitary vessel instead of a static coloured cylinder.
  const meniscus = mesh(
    new THREE.TorusGeometry(0.074, 0.009, 7, 28),
    physical(color, { roughness: 0.08, transparent: true, opacity: 0.82, emissive: color, emissiveIntensity: 0.55, depthWrite: false }),
    [0, height * 0.3, 0],
    [Math.PI / 2, 0, 0]
  )
  meniscus.castShadow = false
  sight.add(meniscus)
  const bubbles = []
  for (let index = 0; index < 4; index += 1) {
    const bubble = mesh(
      new THREE.SphereGeometry(0.012 + (index % 2) * 0.006, 8, 6),
      physical('#effff6', { roughness: 0.04, transparent: true, opacity: 0.56, transmission: 0.35, depthWrite: false }),
      [(index - 1.5) * 0.022, -height * 0.34, (index % 2 ? 1 : -1) * 0.018]
    )
    bubble.castShadow = false
    sight.add(bubble)
    bubbles.push({ object: bubble, phase: phase + index * 0.63, baseX: bubble.position.x, baseZ: bubble.position.z })
  }
  parent.add(sight)
  animated.liquids.push({
    object: liquid,
    baseHeight: height * 0.78,
    baseY: liquid.position.y,
    phase,
    amplitude: 0.13,
    meniscus,
    bubbles
  })
  return sight
}

const addHelix = (parent, position, length, radius, helixMaterial, animated, speed = 1) => {
  const points = []
  const turns = 5.5
  for (let index = 0; index <= 96; index += 1) {
    const progress = index / 96
    const angle = progress * Math.PI * 2 * turns
    points.push(new THREE.Vector3(
      (progress - 0.5) * length,
      Math.sin(angle) * radius,
      Math.cos(angle) * radius
    ))
  }
  const curve = new THREE.CatmullRomCurve3(points)
  const screw = mesh(new THREE.TubeGeometry(curve, 120, 0.055, 8, false), helixMaterial)
  screw.position.set(...position)
  parent.add(screw)
  animated.rotors.push({ object: screw, axis: 'x', speed })
  return screw
}

const addBranchLabel = (parent, x, y, z, branch) => {
  const texture = createLabelTexture('OUTPUT', branch.labelZh, branch.color, { background: 'rgba(7, 22, 24, .92)' })
  const label = mesh(
    new THREE.PlaneGeometry(1.16, 0.29),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    [x, y, z]
  )
  label.castShadow = false
  parent.add(label)
  return label
}

const addEdges = (parent, source, color = '#9fb7b3', opacity = 0.24) => {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(source.geometry, 28),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  )
  edges.position.copy(source.position)
  edges.rotation.copy(source.rotation)
  edges.scale.copy(source.scale)
  parent.add(edges)
  return edges
}

const addPlatform = (parent, x, z = 0, width = 3.25, depth = 3.25, accent = '#d5aa42') => {
  const base = mesh(
    new THREE.BoxGeometry(width, 0.18, depth),
    physical(PALETTE.floor, { roughness: 0.72, metalness: 0.2 }),
    [x, -0.97, z]
  )
  parent.add(base)
  addEdges(parent, base, accent, 0.34)
  const strip = mesh(
    new THREE.BoxGeometry(width * 0.72, 0.025, 0.035),
    physical(accent, { emissive: accent, emissiveIntensity: 1.8, roughness: 0.22 }),
    [x, -0.865, z + depth * 0.5 - 0.08]
  )
  parent.add(strip)
}

const addConveyor = (parent, animated, x, length = 3.1, z = 0, options = {}) => {
  const width = options.width || 1.25
  const group = new THREE.Group()
  group.position.set(x, -0.2, z)
  const belt = mesh(
    new THREE.BoxGeometry(length, 0.16, width),
    physical(PALETTE.belt, { roughness: 0.76, metalness: 0.22 }),
    [0, 0, 0]
  )
  group.add(belt)
  addEdges(group, belt, PALETTE.steelLight, 0.16)

  const railMaterial = physical(PALETTE.steel, { roughness: 0.23, metalness: 0.78, clearcoat: 0.5 })
  const darkSteel = physical(PALETTE.steelDark, { roughness: 0.31, metalness: 0.68 })
  ;[-1, 1].forEach((side) => {
    group.add(mesh(new THREE.BoxGeometry(length + 0.18, 0.11, 0.065), railMaterial, [0, 0.3, side * (width * 0.5 + 0.08)]))
    group.add(mesh(new THREE.BoxGeometry(length + 0.1, 0.2, 0.08), darkSteel, [0, -0.02, side * (width * 0.5 + 0.04)]))
  })

  const slatEntries = []
  const slatCount = Math.max(10, Math.round(length / 0.18))
  const slatMaterial = physical('#344548', { roughness: 0.64, metalness: 0.32 })
  const slatGeometry = new THREE.BoxGeometry(0.035, 0.025, width * 0.9)
  for (let index = 0; index < slatCount; index += 1) {
    const localX = -length * 0.5 + (index / slatCount) * length
    slatEntries.push(localX)
  }
  const slats = new THREE.InstancedMesh(slatGeometry, slatMaterial, slatCount)
  const slatTransform = new THREE.Object3D()
  slatEntries.forEach((localX, index) => {
    slatTransform.position.set(localX, 0.105, 0)
    slatTransform.updateMatrix()
    slats.setMatrixAt(index, slatTransform.matrix)
  })
  slats.instanceMatrix.needsUpdate = true
  slats.castShadow = false
  slats.receiveShadow = false
  slats.computeBoundingSphere()
  group.add(slats)
  animated.conveyors.push({ slats, basePositions: slatEntries, transform: slatTransform, length, min: -length * 0.5, speed: options.speed || 0.5 })

  ;[-1, 1].forEach((side) => {
    const roller = mesh(new THREE.CylinderGeometry(0.17, 0.17, width * 0.92, 24), darkSteel, [side * length * 0.47, 0.03, 0], [Math.PI / 2, 0, 0])
    group.add(roller)
    animated.rotors.push({ object: roller, axis: 'y', speed: -(options.speed || 0.5) * 2.8 })
  })

  ;[-1, 1].forEach((side) => {
    ;[-1, 1].forEach((depthSide) => {
      const legX = side * length * 0.36
      const legZ = depthSide * width * 0.4
      group.add(mesh(new THREE.BoxGeometry(0.11, 0.72, 0.11), railMaterial, [legX, -0.43, legZ]))
      group.add(mesh(new THREE.BoxGeometry(0.3, 0.055, 0.22), darkSteel, [legX, -0.81, legZ]))
    })
  })

  const motor = new THREE.Group()
  motor.position.set(-length * 0.31, -0.34, -width * 0.68)
  motor.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.48, 20), darkSteel, [0, 0, 0], [Math.PI / 2, 0, 0]))
  for (let index = -2; index <= 2; index += 1) {
    motor.add(mesh(new THREE.TorusGeometry(0.205, 0.018, 6, 20), railMaterial, [0, 0, index * 0.08]))
  }
  group.add(motor)
  parent.add(group)
  return group
}

const pineappleRadiusAtY = (y) => {
  // Radius samples follow the familiar pineapple silhouette: a narrow base,
  // full shoulders and a tapered crown rather than a generic sphere.
  const profile = [
    [-0.8, 0.28], [-0.7, 0.46], [-0.48, 0.62], [-0.18, 0.72],
    [0.16, 0.74], [0.44, 0.66], [0.66, 0.5], [0.8, 0.28]
  ]
  const value = THREE.MathUtils.clamp(y, profile[0][0], profile[profile.length - 1][0])
  for (let index = 0; index < profile.length - 1; index += 1) {
    const [y0, r0] = profile[index]
    const [y1, r1] = profile[index + 1]
    if (value <= y1) return THREE.MathUtils.lerp(r0, r1, (value - y0) / (y1 - y0))
  }
  return profile[profile.length - 1][1]
}

const addPineapple = (parent, position, scale = 1, sharedSkinTexture = null, sharedAssets = null) => {
  const fruit = new THREE.Group()
  fruit.position.set(...position)
  fruit.scale.setScalar(scale)
  const assets = sharedAssets || {}

  const skinTexture = sharedSkinTexture || createPineappleSkinTexture()
  const bodyProfile = [
    new THREE.Vector2(0.28, -0.8),
    new THREE.Vector2(0.46, -0.7),
    new THREE.Vector2(0.62, -0.48),
    new THREE.Vector2(0.72, -0.18),
    new THREE.Vector2(0.74, 0.16),
    new THREE.Vector2(0.66, 0.44),
    new THREE.Vector2(0.5, 0.66),
    new THREE.Vector2(0.28, 0.8),
    new THREE.Vector2(0.22, 0.85)
  ]
  let bodyGeometry = assets.bodyGeometry
  if (!bodyGeometry) {
    bodyGeometry = new THREE.LatheGeometry(bodyProfile, 48)
    // Add ten subtle longitudinal ribs.  The modulation is strongest through
    // the shoulders and fades at the heel/crown, preserving a smooth food-like
    // surface while making the silhouette unmistakably pineapple-shaped.
    const bodyPositions = bodyGeometry.attributes.position
    for (let index = 0; index < bodyPositions.count; index += 1) {
      const vertexX = bodyPositions.getX(index)
      const vertexY = bodyPositions.getY(index)
      const vertexZ = bodyPositions.getZ(index)
      const radialDistance = Math.hypot(vertexX, vertexZ)
      if (radialDistance < 0.001) continue
      const angle = Math.atan2(vertexZ, vertexX)
      const shoulder = THREE.MathUtils.clamp(1 - Math.abs(vertexY - 0.05) / 0.92, 0, 1)
      const rib = 1 + (0.018 + shoulder * 0.028) * Math.cos(angle * 10)
      bodyPositions.setX(index, vertexX * rib)
      bodyPositions.setZ(index, vertexZ * rib)
    }
    bodyPositions.needsUpdate = true
    bodyGeometry.computeVertexNormals()
    assets.bodyGeometry = bodyGeometry
  }
  const bodyMaterial = assets.bodyMaterial || (assets.bodyMaterial = physical(PALETTE.pineappleSkin, {
    map: skinTexture,
    bumpMap: skinTexture,
    bumpScale: 0.038,
    roughness: 0.62,
    clearcoat: 0.18,
    clearcoatRoughness: 0.3
  }))
  const body = mesh(
    bodyGeometry,
    bodyMaterial
  )
  body.name = 'pineapple-body'
  fruit.add(body)

  // Raised diamond eyes make the fruit read correctly even when the texture
  // is viewed at a distance or on a bright, white exhibition background.
  // Instancing keeps the detailed lattice inexpensive when several fruits are
  // present in the raw-material crate.
  const eyeBackingGeometry = assets.eyeBackingGeometry || (assets.eyeBackingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 4))
  const eyeInnerGeometry = assets.eyeInnerGeometry || (assets.eyeInnerGeometry = new THREE.CylinderGeometry(0.36, 0.5, 1, 4))
  const eyeNotchGeometry = assets.eyeNotchGeometry || (assets.eyeNotchGeometry = new THREE.BoxGeometry(1, 1, 1))
  if (!assets.eyeGeometryRotated) {
    eyeBackingGeometry.rotateY(Math.PI / 4)
    eyeInnerGeometry.rotateY(Math.PI / 4)
    eyeNotchGeometry.rotateY(Math.PI / 4)
    assets.eyeGeometryRotated = true
  }
  const eyeOuterMaterial = assets.eyeOuterMaterial || (assets.eyeOuterMaterial = physical(PALETTE.pineappleSkinDark, { roughness: 0.58, metalness: 0.04 }))
  const eyeInnerMaterial = assets.eyeInnerMaterial || (assets.eyeInnerMaterial = physical(PALETTE.pineappleEyeLight, {
    roughness: 0.42,
    clearcoat: 0.14,
    emissive: '#6d4c1f',
    emissiveIntensity: 0.045
  }))
  const eyeNotchMaterial = assets.eyeNotchMaterial || (assets.eyeNotchMaterial = physical(PALETTE.pineappleEye, { roughness: 0.62, metalness: 0.02 }))
  const eyeRows = [
    { y: -0.59, count: 9, phase: 0.12, size: 0.106 },
    { y: -0.4, count: 12, phase: 0.38, size: 0.12 },
    { y: -0.18, count: 14, phase: 0.1, size: 0.132 },
    { y: 0.06, count: 15, phase: 0.38, size: 0.138 },
    { y: 0.28, count: 14, phase: 0.1, size: 0.132 },
    { y: 0.48, count: 12, phase: 0.38, size: 0.12 },
    { y: 0.64, count: 10, phase: 0.12, size: 0.108 }
  ]
  const eyeCount = eyeRows.reduce((total, row) => total + row.count, 0)
  const eyeOuter = new THREE.InstancedMesh(eyeBackingGeometry, eyeOuterMaterial, eyeCount)
  const eyeInner = new THREE.InstancedMesh(eyeInnerGeometry, eyeInnerMaterial, eyeCount)
  const eyeNotches = new THREE.InstancedMesh(eyeNotchGeometry, eyeNotchMaterial, eyeCount)
  ;[eyeOuter, eyeInner].forEach((instance) => {
    instance.castShadow = true
    instance.receiveShadow = true
  })
  eyeNotches.castShadow = false
  eyeNotches.receiveShadow = false
  const up = new THREE.Vector3(0, 1, 0)
  const normal = new THREE.Vector3()
  const positionOnSkin = new THREE.Vector3()
  const transform = new THREE.Object3D()
  let eyeIndex = 0
  eyeRows.forEach(({ y, count, phase, size }, rowIndex) => {
    const baseRadius = pineappleRadiusAtY(y)
    const slopeEpsilon = 0.012
    const slope = (pineappleRadiusAtY(y + slopeEpsilon) - pineappleRadiusAtY(y - slopeEpsilon)) / (slopeEpsilon * 2)
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + phase + rowIndex * 0.04
      normal.set(Math.cos(angle), -slope, Math.sin(angle)).normalize()
      const shoulder = THREE.MathUtils.clamp(1 - Math.abs(y - 0.05) / 0.92, 0, 1)
      const rib = 1 + (0.018 + shoulder * 0.028) * Math.cos(angle * 10)
      positionOnSkin.set(Math.cos(angle) * baseRadius * rib, y, Math.sin(angle) * baseRadius * rib)
      positionOnSkin.addScaledVector(normal, 0.014)
      const roll = Math.PI / 4 + (rowIndex % 2 ? 0.1 : -0.06)
      const variation = 0.94 + ((index + rowIndex * 3) % 4) * 0.035

      transform.position.copy(positionOnSkin)
      transform.quaternion.setFromUnitVectors(up, normal)
      transform.rotateOnAxis(up, roll)
      transform.scale.set(size * 1.08 * variation, 0.052, size * 1.34 * variation)
      transform.updateMatrix()
      eyeOuter.setMatrixAt(eyeIndex, transform.matrix)

      transform.position.copy(positionOnSkin).addScaledVector(normal, 0.035)
      transform.scale.set(size * 0.73 * variation, 0.075, size * 0.94 * variation)
      transform.updateMatrix()
      eyeInner.setMatrixAt(eyeIndex, transform.matrix)

      transform.position.copy(positionOnSkin).addScaledVector(normal, 0.077)
      transform.scale.set(size * 0.13 * variation, 0.015, size * 0.47 * variation)
      transform.updateMatrix()
      eyeNotches.setMatrixAt(eyeIndex, transform.matrix)
      eyeIndex += 1
    }
  })
  eyeOuter.instanceMatrix.needsUpdate = true
  eyeInner.instanceMatrix.needsUpdate = true
  eyeNotches.instanceMatrix.needsUpdate = true
  eyeOuter.name = 'pineapple-eyes-outer'
  eyeInner.name = 'pineapple-eyes-inner'
  eyeNotches.name = 'pineapple-eyes-notch'
  // Instance transforms are populated before the meshes enter the scene, so
  // the computed spheres are safe for normal view-frustum culling.
  ;[eyeOuter, eyeInner, eyeNotches].forEach((instance) => {
    instance.computeBoundingSphere()
    instance.frustumCulled = true
  })
  fruit.add(eyeOuter, eyeInner, eyeNotches)

  const collar = mesh(
    assets.collarGeometry || (assets.collarGeometry = new THREE.CylinderGeometry(0.25, 0.34, 0.24, 20)),
    assets.collarMaterial || (assets.collarMaterial = physical('#557532', { roughness: 0.62, clearcoat: 0.12 })),
    [0, 0.82, 0]
  )
  fruit.add(collar)

  const leafMaterials = assets.leafMaterials || (assets.leafMaterials = [
    physical(PALETTE.leaf, { roughness: 0.48, clearcoat: 0.18, side: THREE.DoubleSide }),
    physical(PALETTE.leafLight, { roughness: 0.5, clearcoat: 0.14, side: THREE.DoubleSide })
  ])
  // Broad lanceolate leaves replace cone spikes.  A shallow, curved ribbon
  // with a raised centre vein reads as a real leaf from both front and side;
  // three staggered tiers give the crown a compact, layered rosette.
  const leafGeometryCache = assets.leafGeometryCache || (assets.leafGeometryCache = new Map())
  const leafVeinCache = assets.leafVeinCache || (assets.leafVeinCache = new Map())
  const getLeafGeometry = (length, width, curve, thickness = 0.034) => {
    const key = [length.toFixed(3), width.toFixed(3), curve.toFixed(3), thickness].join(':')
    if (leafGeometryCache.has(key)) return leafGeometryCache.get(key)
    const segments = 7
    const positions = []
    const indices = []
    for (let index = 0; index <= segments; index += 1) {
      const progress = index / segments
      const y = progress * length
      const taper = Math.pow(Math.sin(Math.PI * progress), 0.72)
      const halfWidth = Math.max(0.004, width * 0.5 * taper)
      const centerZ = curve * Math.sin(Math.PI * progress) * (0.28 + progress * 0.72)
      const frontZ = centerZ + thickness * 0.5
      const backZ = centerZ - thickness * 0.5
      positions.push(
        -halfWidth, y, frontZ,
        halfWidth, y, frontZ,
        -halfWidth, y, backZ,
        halfWidth, y, backZ
      )
    }
    for (let index = 0; index < segments; index += 1) {
      const start = index * 4
      const next = (index + 1) * 4
      indices.push(start, next, next + 1, start, next + 1, start + 1)
      indices.push(start + 2, start + 3, next + 3, start + 2, next + 3, next + 2)
      indices.push(start, start + 2, next + 2, start, next + 2, next)
      indices.push(start + 1, next + 1, next + 3, start + 1, next + 3, start + 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    leafGeometryCache.set(key, geometry)
    return geometry
  }
  const getLeafVein = (length, curve) => {
    const key = [length.toFixed(3), curve.toFixed(3)].join(':')
    if (leafVeinCache.has(key)) return leafVeinCache.get(key)
    const points = []
    for (let index = 0; index <= 20; index += 1) {
      const progress = index / 20
      points.push(new THREE.Vector3(
        0,
        progress * length,
        curve * Math.sin(Math.PI * progress) * (0.28 + progress * 0.72) + 0.022
      ))
    }
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.012, 5, false)
    leafVeinCache.set(key, geometry)
    return geometry
  }
  const veinMaterial = assets.veinMaterial || (assets.veinMaterial = physical(PALETTE.leafLight, { roughness: 0.42, clearcoat: 0.12, side: THREE.DoubleSide }))
  const crownLayers = [
    { count: 12, baseY: 0.83, baseRadius: 0.23, length: 1.2, width: 0.27, curve: 0.17, tilt: 0.56 },
    { count: 9, baseY: 0.98, baseRadius: 0.15, length: 1.08, width: 0.23, curve: 0.14, tilt: 0.34 },
    { count: 7, baseY: 1.08, baseRadius: 0.08, length: 0.91, width: 0.18, curve: 0.1, tilt: 0.13 }
  ]
  const leafBatches = new Map()
  const veinBatches = new Map()
  const leafTransform = new THREE.Object3D()
  crownLayers.forEach((layer, layerIndex) => {
    for (let index = 0; index < layer.count; index += 1) {
      const angle = (index / layer.count) * Math.PI * 2 + layerIndex * 0.31
      const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
      const direction = radial.clone().multiplyScalar(Math.sin(layer.tilt))
      direction.y = Math.cos(layer.tilt)
      direction.normalize()
      leafTransform.position.set(radial.x * layer.baseRadius, layer.baseY, radial.z * layer.baseRadius)
      leafTransform.quaternion.setFromUnitVectors(FLOW_AXIS, direction)
      leafTransform.rotateOnAxis(FLOW_AXIS, (index % 2 ? 0.07 : -0.04) + layerIndex * 0.03)
      leafTransform.updateMatrix()
      const length = layer.length + ((index + layerIndex) % 3 - 1) * 0.045
      const width = layer.width * (0.94 + (index % 3) * 0.045)
      const leafGeometry = getLeafGeometry(length, width, layer.curve)
      const leafMaterialIndex = (index + layerIndex) % leafMaterials.length
      const leafKey = `${leafGeometry.uuid}:${leafMaterialIndex}`
      if (!leafBatches.has(leafKey)) leafBatches.set(leafKey, { geometry: leafGeometry, material: leafMaterials[leafMaterialIndex], matrices: [] })
      leafBatches.get(leafKey).matrices.push(leafTransform.matrix.clone())

      const veinGeometry = getLeafVein(length, layer.curve)
      const veinKey = veinGeometry.uuid
      if (!veinBatches.has(veinKey)) veinBatches.set(veinKey, { geometry: veinGeometry, material: veinMaterial, matrices: [] })
      veinBatches.get(veinKey).matrices.push(leafTransform.matrix.clone())
    }
  })
  const addInstanceBatches = (batches, name, castShadow) => {
    batches.forEach(({ geometry, material, matrices }) => {
      const instances = new THREE.InstancedMesh(geometry, material, matrices.length)
      matrices.forEach((matrix, index) => instances.setMatrixAt(index, matrix))
      instances.instanceMatrix.needsUpdate = true
      instances.castShadow = castShadow
      instances.receiveShadow = castShadow
      instances.name = name
      instances.computeBoundingSphere()
      fruit.add(instances)
    })
  }
  addInstanceBatches(leafBatches, 'pineapple-leaves', true)
  addInstanceBatches(veinBatches, 'pineapple-leaf-veins', false)
  const crownCore = mesh(
    assets.crownCoreGeometry || (assets.crownCoreGeometry = new THREE.CylinderGeometry(0.16, 0.22, 0.22, 16)),
    assets.crownCoreMaterial || (assets.crownCoreMaterial = physical('#416b32', { roughness: 0.58, clearcoat: 0.12 })),
    [0, 0.88, 0]
  )
  fruit.add(crownCore)

  const fruitShadow = mesh(
    assets.shadowGeometry || (assets.shadowGeometry = new THREE.CircleGeometry(0.64, 30)),
    assets.shadowMaterial || (assets.shadowMaterial = new THREE.MeshBasicMaterial({ color: '#6c8079', transparent: true, opacity: 0.18, depthWrite: false })),
    [0, -0.82, 0],
    [-Math.PI / 2, 0, 0],
    [1.2, 1, 1]
  )
  fruitShadow.castShadow = false
  fruit.add(fruitShadow)
  parent.add(fruit)
  return fruit
}

const addRawStation = (parent, animated) => {
  const x = PINEAPPLE_PROCESS_STATIONS[0].x
  addPlatform(parent, x, 0, 3.5, 3.4, PALETTE.pineapple)
  addStationPlaque(parent, PINEAPPLE_PROCESS_STATIONS[0], 0, PALETTE.pineapple, 3.4)
  addConveyor(parent, animated, x + 1.38, 2.9, 0, { speed: 0.47 })

  const crateMaterial = physical('#8c5f31', { roughness: 0.76, clearcoat: 0.06 })
  const crateEdge = physical('#422e20', { roughness: 0.66, metalness: 0.08 })
  const crate = new THREE.Group()
  crate.position.set(x - 0.7, -0.1, 0)
  ;[-0.78, 0.78].forEach((side) => {
    ;[-0.56, -0.18, 0.2].forEach((height) => {
      crate.add(mesh(new THREE.BoxGeometry(0.1, 0.24, 1.65), crateMaterial, [side, height, 0]))
      crate.add(mesh(new THREE.BoxGeometry(1.65, 0.24, 0.1), crateMaterial, [0, height, side]))
    })
  })
  ;[-0.78, 0.78].forEach((edgeX) => {
    ;[-0.78, 0.78].forEach((edgeZ) => {
      crate.add(mesh(new THREE.BoxGeometry(0.13, 1.05, 0.13), crateEdge, [edgeX, -0.1, edgeZ]))
      const bolt = mesh(new THREE.SphereGeometry(0.045, 10, 8), physical('#b5b5a8', { metalness: 0.82, roughness: 0.22 }), [edgeX, 0.25, edgeZ + 0.07])
      crate.add(bolt)
    })
  })
  crate.add(mesh(new THREE.BoxGeometry(1.66, 0.12, 1.66), crateEdge, [0, -0.61, 0]))
  parent.add(crate)

  const skinTexture = createPineappleSkinTexture()
  const pineappleAssets = {}
  const fruits = [
    addPineapple(parent, [x - 1, 0.55, -0.48], 0.58, skinTexture, pineappleAssets),
    addPineapple(parent, [x - 0.45, 0.5, 0.35], 0.62, skinTexture, pineappleAssets),
    addPineapple(parent, [x - 1.15, 0.48, 0.55], 0.52, skinTexture, pineappleAssets),
    addPineapple(parent, [x + 0.86, 0.56, 0], 0.48, skinTexture, pineappleAssets)
  ]
  fruits.forEach((fruit, index) => animated.bobs.push({ object: fruit, baseY: fruit.position.y, phase: index * 1.7, amplitude: 0.025 }))
  animated.travelers.push({ object: fruits[3], fromX: x + 0.55, toX: x + 2.15, baseY: 0.56, speed: 0.075, phase: 0.08, roll: 1.6 })

  const scanner = new THREE.Group()
  scanner.position.set(x + 1.35, 0.66, 0)
  const scannerMaterial = physical(PALETTE.steelDark, { roughness: 0.3, metalness: 0.64 })
  scanner.add(mesh(new THREE.BoxGeometry(0.12, 1.55, 0.12), scannerMaterial, [0, 0, -0.77]))
  scanner.add(mesh(new THREE.BoxGeometry(0.12, 1.55, 0.12), scannerMaterial, [0, 0, 0.77]))
  scanner.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 1.66), scannerMaterial, [0, 0.76, 0]))
  const scanBeam = mesh(
    new THREE.PlaneGeometry(1.42, 0.86),
    new THREE.MeshBasicMaterial({ color: '#72d8b0', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    [0, 0.2, 0],
    [0, Math.PI / 2, 0]
  )
  scanner.add(scanBeam)
  animated.scanners.push({ object: scanBeam, baseY: 0.2, phase: 0 })
  parent.add(scanner)
  addSignalTower(parent, [x + 1.9, 0.39, -0.78], animated, 0)
}

const addPreparationStation = (parent, animated) => {
  const x = PINEAPPLE_PROCESS_STATIONS[1].x
  addPlatform(parent, x, 0, 3.55, 3.4, '#70a995')
  addStationPlaque(parent, PINEAPPLE_PROCESS_STATIONS[1], 1, '#70a995', 3.4)
  addConveyor(parent, animated, x - 1.22, 2.15, 0, { speed: 0.44 })

  const steel = physical(PALETTE.steel, { roughness: 0.24, metalness: 0.72, clearcoat: 0.58 })
  const drum = new THREE.Group()
  drum.position.set(x + 0.35, 0.55, 0)
  ;[-0.9, -0.3, 0.3, 0.9].forEach((offset) => {
    drum.add(mesh(new THREE.TorusGeometry(0.78, 0.055, 10, 34), steel, [offset, 0, 0], [0, Math.PI / 2, 0]))
  })
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2
    drum.add(mesh(
      new THREE.BoxGeometry(2.02, 0.055, 0.055),
      steel,
      [0, Math.sin(angle) * 0.77, Math.cos(angle) * 0.77],
      [angle, 0, 0]
    ))
  }
  ;[-0.35, 0.35].forEach((offset) => {
    const chunk = mesh(new THREE.DodecahedronGeometry(0.22, 1), physical(PALETTE.pineappleLight, { roughness: 0.5 }), [offset, -0.17, 0.12])
    drum.add(chunk)
  })
  parent.add(drum)
  animated.rotors.push({ object: drum, axis: 'x', speed: 0.58 })

  const shield = mesh(
    new THREE.CylinderGeometry(0.93, 0.93, 2.2, 40, 1, true, 0.18, Math.PI * 1.65),
    physical('#cce9e4', { roughness: 0.12, metalness: 0.18, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false }),
    [x + 0.35, 0.55, 0],
    [0, 0, Math.PI / 2]
  )
  parent.add(shield)
  ;[-0.62, 0.62].forEach((side) => {
    parent.add(mesh(new THREE.BoxGeometry(0.12, 1.35, 0.12), steel, [x + 0.3, -0.35, side]))
  })

  const sprayPipe = physical('#779494', { roughness: 0.22, metalness: 0.72 })
  parent.add(mesh(new THREE.BoxGeometry(2.15, 0.09, 0.09), sprayPipe, [x + 0.3, 1.75, 0]))
  const waterMaterial = physical('#6bc5d4', { emissive: '#4aaabb', emissiveIntensity: 1, roughness: 0.1 })
  for (let nozzleIndex = 0; nozzleIndex < 6; nozzleIndex += 1) {
    const nozzleX = x - 0.55 + nozzleIndex * 0.34
    parent.add(mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.18, 12), sprayPipe, [nozzleX, 1.64, 0]))
    for (let dropIndex = 0; dropIndex < 3; dropIndex += 1) {
      const drop = mesh(new THREE.SphereGeometry(0.035 + dropIndex * 0.006, 10, 8), waterMaterial, [nozzleX + (dropIndex - 1) * 0.05, 1.5, 0])
      parent.add(drop)
      animated.drops.push({ object: drop, top: 1.5, range: 1.35, phase: (nozzleIndex * 3 + dropIndex) / 18, sway: (dropIndex - 1) * 0.06 })
    }
  }

  const cutter = new THREE.Group()
  cutter.position.set(x + 1.64, 0.42, 0)
  const cutterHub = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 20), steel, [0, 0, 0], [Math.PI / 2, 0, 0])
  cutter.add(cutterHub)
  for (let index = 0; index < 4; index += 1) {
    const blade = mesh(new THREE.BoxGeometry(0.06, 0.72, 0.12), physical(PALETTE.steelLight, { roughness: 0.14, metalness: 0.88 }), [0, 0.31, 0], [0, 0, index * Math.PI / 2])
    cutter.add(blade)
  }
  parent.add(cutter)
  animated.rotors.push({ object: cutter, axis: 'x', speed: 1.6 })
  addGauge(parent, [x + 1.45, 1.48, 0.72], animated, 0.7)
  addSignalTower(parent, [x - 1.52, 0.39, -0.78], animated, 1.1)
}

const addTank = (parent, x, z, color, scale = 1, animated = null, phase = 0) => {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.scale.setScalar(scale)
  const steel = physical(PALETTE.steel, { roughness: 0.23, metalness: 0.76, clearcoat: 0.52 })
  const darkSteel = physical(PALETTE.steelDark, { roughness: 0.3, metalness: 0.68 })
  const body = mesh(new THREE.CylinderGeometry(0.82, 0.82, 1.62, 44), steel, [0, 0.15, 0])
  group.add(body)
  const cap = mesh(new THREE.CylinderGeometry(0.18, 0.8, 0.48, 44), steel, [0, 1.18, 0])
  group.add(cap)
  group.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 24), darkSteel, [0, 1.56, 0]))
  group.add(mesh(new THREE.TorusGeometry(0.39, 0.035, 8, 34), darkSteel, [0, 1.37, 0], [Math.PI / 2, 0, 0]))
  const band = mesh(
    new THREE.CylinderGeometry(0.838, 0.838, 0.34, 44, 1, true),
    physical(color, { emissive: color, emissiveIntensity: 0.22, roughness: 0.16, transparent: true, opacity: 0.82 }),
    [0, 0.2, 0]
  )
  group.add(band)
  ;[-0.52, 0.52].forEach((height) => {
    group.add(mesh(new THREE.TorusGeometry(0.83, 0.025, 7, 40), darkSteel, [0, height + 0.15, 0], [Math.PI / 2, 0, 0]))
  })
  ;[-0.5, 0.5].forEach((side) => {
    group.add(mesh(new THREE.BoxGeometry(0.11, 0.72, 0.11), steel, [side, -0.88, side * 0.65]))
    group.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.24), darkSteel, [side, -1.25, side * 0.65]))
  })
  group.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.58, 16), darkSteel, [0.82, 0.55, 0], [0, 0, Math.PI / 2]))
  if (animated) {
    addSightGlass(group, [0, 0.12, 0.86], color, animated, phase, 1.05)
    addGauge(group, [0.48, 1.15, 0.68], animated, phase + 0.3)
  }
  parent.add(group)
  return group
}

const addExtractionStation = (parent, animated) => {
  const x = PINEAPPLE_PROCESS_STATIONS[2].x
  addPlatform(parent, x, 0, 3.9, 3.7, PALETTE.pineapple)
  addStationPlaque(parent, PINEAPPLE_PROCESS_STATIONS[2], 2, PALETTE.pineapple, 3.7)
  addTank(parent, x + 0.92, 0.48, PALETTE.pineapple, 0.92, animated, 0.6)

  const steel = physical(PALETTE.steel, { roughness: 0.22, metalness: 0.76, clearcoat: 0.48 })
  const darkSteel = physical(PALETTE.steelDark, { roughness: 0.32, metalness: 0.66 })
  const hopper = mesh(
    new THREE.CylinderGeometry(0.92, 0.34, 1.2, 8, 1, true),
    physical(PALETTE.steelLight, { roughness: 0.2, metalness: 0.7, side: THREE.DoubleSide }),
    [x - 1.15, 1.5, 0]
  )
  parent.add(hopper)
  parent.add(mesh(new THREE.TorusGeometry(0.92, 0.055, 8, 32), darkSteel, [x - 1.15, 2.1, 0], [Math.PI / 2, 0, 0]))
  const motor = mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.7, 24),
    darkSteel,
    [x - 1.15, 2.42, 0]
  )
  parent.add(motor)
  for (let index = -2; index <= 2; index += 1) {
    parent.add(mesh(new THREE.TorusGeometry(0.325, 0.018, 6, 22), steel, [x - 1.15, 2.42 + index * 0.11, 0], [Math.PI / 2, 0, 0]))
  }

  const pressBody = mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.25, 32, 1, true),
    physical('#c9ded9', { roughness: 0.12, metalness: 0.22, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    [x - 0.12, 0.65, 0],
    [0, 0, Math.PI / 2]
  )
  parent.add(pressBody)
  ;[-0.92, 0, 0.92].forEach((offset) => {
    parent.add(mesh(new THREE.TorusGeometry(0.52, 0.04, 8, 30), darkSteel, [x - 0.12 + offset, 0.65, 0], [0, Math.PI / 2, 0]))
  })
  const shaft = mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 20), darkSteel, [x - 0.12, 0.65, 0], [0, 0, Math.PI / 2])
  parent.add(shaft)
  animated.rotors.push({ object: shaft, axis: 'x', speed: 1.2 })
  addHelix(parent, [x - 0.12, 0.65, 0], 2.15, 0.34, physical(PALETTE.pineappleLight, { roughness: 0.3, metalness: 0.3 }), animated, 1.2)

  const chunksMaterial = physical(PALETTE.pineappleLight, { roughness: 0.48, emissive: PALETTE.pineapple, emissiveIntensity: 0.08 })
  for (let index = 0; index < 7; index += 1) {
    const chunk = mesh(new THREE.DodecahedronGeometry(0.09 + (index % 2) * 0.025, 0), chunksMaterial, [x - 1.15, 1.72, (index % 3 - 1) * 0.09])
    parent.add(chunk)
    animated.feedChunks.push({ object: chunk, top: 1.82, bottom: 0.78, phase: index / 7, baseX: x - 1.15 + (index % 2) * 0.08 })
  }

  addPipe(parent, [[x + 0.72, 0.4, 0], [x + 0.5, 0.26, 0.22], [x + 0.65, 0.42, 0.46]], 0.11, PALETTE.steel)
  addValveWheel(parent, [x + 0.64, 0.65, 0.42], PALETTE.pineapple, animated, 1.2, 0.72)
  addGauge(parent, [x - 1.62, 1.4, 0.73], animated, 1.4)
  addSignalTower(parent, [x - 1.65, 0.39, -0.78], animated, 2.1)
}

const addBranchStation = (parent, animated) => {
  const x = PINEAPPLE_PROCESS_STATIONS[3].x
  addPlatform(parent, x, 0, 4.65, 7.8, '#cfa547')
  addStationPlaque(parent, PINEAPPLE_PROCESS_STATIONS[3], 3, '#cfa547', 7.8)
  const manifold = addTank(parent, x - 1.15, 0, PALETTE.pineapple, 0.76, animated, 1.2)
  animated.bobs.push({ object: manifold, baseY: manifold.position.y, phase: 1.2, amplitude: 0.008 })

  const steel = physical(PALETTE.steel, { roughness: 0.22, metalness: 0.78, clearcoat: 0.48 })
  const darkSteel = physical(PALETTE.steelDark, { roughness: 0.31, metalness: 0.7 })
  addPipe(parent, [
    [x - 2.38, 0.15, 0], [x - 1.92, 0.15, 0], [x - 1.66, 0.46, 0], [x - 1.16, 0.46, 0]
  ], 0.12, PALETTE.steel)
  addPipe(parent, [
    [x - 1.16, 0.46, 0], [x - 1.15, 1.14, 0], [x - 0.82, 1.32, 0], [x - 0.28, 1.32, 0]
  ], 0.12, PALETTE.steel, { segments: 28 })
  addSanitaryClamp(parent, [x - 2.04, 0.15, 0], 'x', 0.145, PALETTE.pineapple)
  addSanitaryClamp(parent, [x - 0.62, 1.32, 0], 'x', 0.145, PALETTE.pineapple)
  addValveWheel(parent, [x - 1.78, 0.65, 0.08], PALETTE.pineapple, animated, 1.4, 0.76)
  addSignalTower(parent, [x - 2.02, 0.39, -0.7], animated, 2.8)

  // The split manifold runs across the four outlets (Z axis), like a real
  // sanitary header.  Keep the pipe horizontal so the branch take-offs read
  // as one coherent distribution rail instead of a vertical mast.
  const header = mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 6.45, 18),
    steel,
    [x - 0.28, 1.32, 0],
    [Math.PI / 2, 0, 0]
  )
  parent.add(header)
  ;[-3.08, 3.08].forEach((z) => {
    parent.add(mesh(new THREE.TorusGeometry(0.105, 0.024, 7, 20), darkSteel, [x - 0.28, 1.32, z]))
  })
  ;[-2.15, 0, 2.15].forEach((z) => {
    parent.add(mesh(new THREE.BoxGeometry(0.14, 0.52, 0.14), darkSteel, [x - 0.28, 0.96, z]))
  })

  PINEAPPLE_BRANCHES.forEach((branch, index) => {
    const vessel = addTank(parent, x + 0.86, branch.z, branch.color, 0.58, animated, index * 0.72)
    animated.bobs.push({ object: vessel, baseY: vessel.position.y, phase: index * 0.7, amplitude: 0.012 })

    addPipe(parent, [
      [x - 0.28, 1.32, branch.z],
      [x - 0.28, 0.78, branch.z],
      [x - 0.55, 0.58, branch.z],
      [x - 0.55, 0.4, branch.z]
    ], branch.pipeRadius, branch.color, {
      roughness: 0.2,
      metalness: 0.58,
      emissive: branch.color,
      emissiveIntensity: 0.14,
      segments: 28,
      radialSegments: 10
    })
    addPipe(parent, [
      [x - 0.24, 0.28, branch.z],
      [x - 0.15, 0.28, branch.z]
    ], branch.pipeRadius, branch.color, {
      roughness: 0.2,
      metalness: 0.58,
      emissive: branch.color,
      emissiveIntensity: 0.14,
      segments: 8,
      radialSegments: 10
    })
    addPipe(parent, [
      [x + 0.39, 0.28, branch.z],
      [x + 0.42, 0.28, branch.z],
      [x + 0.68, 0.62, branch.z],
      [x + 0.86, 1.05, branch.z]
    ], branch.pipeRadius, branch.color, {
      roughness: 0.2,
      metalness: 0.58,
      emissive: branch.color,
      emissiveIntensity: 0.14,
      segments: 32,
      radialSegments: 10
    })
    addPipe(parent, [
      [x + 0.86, 1.05, branch.z],
      [x + 1.08, 1.34, branch.z],
      [x + 1.58, 1.7, branch.z],
      [x + 2.66, 1.7, branch.z]
    ], branch.pipeRadius, PALETTE.steelLight, {
      roughness: 0.18,
      metalness: 0.78,
      segments: 32,
      radialSegments: 10
    })
    addValveWheel(parent, [x + 0.08, 1.57, branch.z], branch.color, animated, index * 0.8, 0.6)
    addSanitaryClamp(parent, [x - 0.28, 1.02, branch.z], 'y', branch.pipeRadius * 1.28, branch.color)
    addSanitaryClamp(parent, [x - 0.21, 0.28, branch.z], 'x', branch.pipeRadius * 1.28, branch.color)
    addSanitaryClamp(parent, [x + 1.83, 1.7, branch.z], 'x', branch.pipeRadius * 1.28, branch.color)
    addSanitaryClamp(parent, [x + 2.58, 1.7, branch.z], 'x', branch.pipeRadius * 1.28, branch.color)
    addFlowArrow(parent, [x + 2.08, 1.7, branch.z], branch.color, animated, index * 0.62, 'x', 1, 0.9)
    addInlineFlowSight(parent, [x + 0.12, 0.28, branch.z], branch, animated, index * 0.21, 'x')

    const pump = new THREE.Group()
    pump.position.set(x - 0.55, -0.08, branch.z)
    const pumpBody = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.58, 24), steel, [0, 0.36, 0], [0, 0, Math.PI / 2])
    pump.add(pumpBody)
    pump.add(mesh(new THREE.TorusGeometry(0.31, 0.055, 9, 28), darkSteel, [0.3, 0.36, 0], [0, Math.PI / 2, 0]))
    const impeller = new THREE.Group()
    impeller.position.set(0.34, 0.36, 0)
    for (let bladeIndex = 0; bladeIndex < 5; bladeIndex += 1) {
      impeller.add(mesh(
        new THREE.BoxGeometry(0.025, 0.08, 0.27),
        physical(branch.color, { emissive: branch.color, emissiveIntensity: 0.34, roughness: 0.24 }),
        [0, Math.cos(bladeIndex * Math.PI * 0.4) * 0.1, Math.sin(bladeIndex * Math.PI * 0.4) * 0.1],
        [bladeIndex * Math.PI * 0.4, 0, 0]
      ))
    }
    pump.add(impeller)
    pump.add(mesh(new THREE.BoxGeometry(0.7, 0.08, 0.54), darkSteel, [0, 0.02, 0]))
    parent.add(pump)
    animated.fans.push({ object: impeller, axis: 'x', speed: 0.72 + branch.flowSpeed * 8 })

    addBranchLabel(parent, x + 0.86, 0.1, branch.z + 0.52, branch)
    const indicator = mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      physical(branch.color, { emissive: branch.color, emissiveIntensity: 2.2, roughness: 0.12 }),
      [x + 1.48, 1.05, branch.z + 0.34]
    )
    parent.add(indicator)
    animated.pulses.push({ object: indicator, phase: index * 0.9 })
  })
}

const addBottle = (parent, x, z, color, scale = 0.48) => {
  const group = new THREE.Group()
  group.position.set(x, -0.055, z)
  group.scale.setScalar(scale)
  const glass = physical(PALETTE.glass, { transparent: true, opacity: 0.48, transmission: 0.3, thickness: 0.3, roughness: 0.1, depthWrite: false })
  group.add(mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 28), glass, [0, 0.525, 0]))
  group.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 24), glass, [0, 1.18, 0]))
  group.add(mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.76, 28), physical(color, { transparent: true, opacity: 0.88, roughness: 0.18 }), [0, 0.41, 0]))
  group.add(mesh(new THREE.CylinderGeometry(0.352, 0.352, 0.24, 28, 1, true), physical('#f6f0d5', { roughness: 0.38 }), [0, 0.64, 0]))
  group.add(mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.12, 24), physical('#e8ede9', { roughness: 0.42 }), [0, 1.4, 0]))
  parent.add(group)
  return group
}

const addJar = (parent, x, z, color, scale = 0.48) => {
  const group = new THREE.Group()
  group.position.set(x, -0.055, z)
  group.scale.setScalar(scale)
  const glass = physical(PALETTE.glass, { transparent: true, opacity: 0.42, transmission: 0.28, thickness: 0.35, roughness: 0.12, depthWrite: false })
  group.add(mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.9, 32), glass, [0, 0.45, 0]))
  group.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 32), physical(color, { transparent: true, opacity: 0.9, roughness: 0.22 }), [0, 0.36, 0]))
  group.add(mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.2, 32, 1, true), physical('#f3e5c1', { roughness: 0.38 }), [0, 0.46, 0]))
  group.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.13, 32), physical(PALETTE.steelLight, { metalness: 0.62, roughness: 0.26 }), [0, 0.965, 0]))
  parent.add(group)
  return group
}

const addCup = (parent, x, z, color, scale = 0.48) => {
  const group = new THREE.Group()
  group.position.set(x, -0.055, z)
  group.scale.setScalar(scale)
  const glass = physical(PALETTE.glass, { transparent: true, opacity: 0.42, transmission: 0.26, roughness: 0.12, depthWrite: false })
  group.add(mesh(new THREE.CylinderGeometry(0.45, 0.34, 0.88, 28), glass, [0, 0.44, 0]))
  const pieces = [[-0.16, 0.2, 0.06], [0.12, 0.43, -0.05], [-0.05, 0.63, 0.13], [0.17, 0.16, -0.08]]
  pieces.forEach((offset) => group.add(mesh(new THREE.BoxGeometry(0.22, 0.2, 0.2), physical(color, { roughness: 0.48 }), offset, [0.1, 0.25, 0.08])))
  group.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 28), physical('#e9eee9', { roughness: 0.4 }), [0, 0.92, 0]))
  parent.add(group)
  return group
}

const addPouch = (parent, x, z, color, scale = 0.48) => {
  const group = new THREE.Group()
  group.position.set(x, -0.055, z)
  group.scale.setScalar(scale)
  const pouch = mesh(new THREE.BoxGeometry(0.82, 1.22, 0.22), physical('#e4e6df', { roughness: 0.28, metalness: 0.22, clearcoat: 0.5 }), [0, 0.61, 0])
  group.add(pouch)
  const label = mesh(new THREE.BoxGeometry(0.58, 0.48, 0.025), physical(color, { emissive: color, emissiveIntensity: 0.15, roughness: 0.4 }), [0, 0.61, 0.125])
  group.add(label)
  group.add(mesh(new THREE.BoxGeometry(0.78, 0.055, 0.25), physical(PALETTE.steelLight, { metalness: 0.42, roughness: 0.28 }), [0, 1.17, 0]))
  addEdges(group, pouch, '#ffffff', 0.24)
  parent.add(group)
  return group
}

const PACKAGE_BUILDERS = [addBottle, addJar, addCup, addPouch]

const addFillingCell = (parent, animated, x, z, branch, phase) => {
  const frame = new THREE.Group()
  frame.position.set(x, 0, z)
  const steel = physical(PALETTE.steel, { roughness: 0.22, metalness: 0.78, clearcoat: 0.48 })
  const dark = physical(PALETTE.steelDark, { roughness: 0.32, metalness: 0.68 })
  ;[-0.48, 0.48].forEach((side) => {
    frame.add(mesh(new THREE.BoxGeometry(0.11, 1.72, 0.11), steel, [0, 0.73, side]))
    frame.add(mesh(new THREE.BoxGeometry(0.28, 0.06, 0.24), dark, [0, -0.16, side]))
  })
  frame.add(mesh(new THREE.BoxGeometry(0.22, 0.16, 1.16), steel, [0, 1.6, 0]))
  frame.add(mesh(new THREE.BoxGeometry(0.34, 0.42, 0.28), dark, [0.04, 1.34, 0.57]))
  const screen = mesh(
    new THREE.BoxGeometry(0.22, 0.24, 0.02),
    physical(branch.color, { emissive: branch.color, emissiveIntensity: 1.35, roughness: 0.1 }),
    [0.04, 1.36, 0.72]
  )
  frame.add(screen)
  animated.pulses.push({ object: screen, phase: phase + 0.4, amplitude: 0.04 })

  const nozzleRig = new THREE.Group()
  nozzleRig.position.set(0, 1.27, 0)
  nozzleRig.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.48, 18), steel))
  nozzleRig.add(mesh(new THREE.CylinderGeometry(0.055, 0.09, 0.42, 16), physical(branch.color, { emissive: branch.color, emissiveIntensity: 0.22, metalness: 0.42 }), [0, -0.42, 0]))
  frame.add(nozzleRig)
  animated.pistons.push({ object: nozzleRig, baseY: nozzleRig.position.y, amplitude: 0.3, phase, speed: 0.21, branchId: branch.id })
  const fillBeacon = mesh(
    new THREE.TorusGeometry(0.3, 0.018, 8, 28),
    physical(branch.color, { roughness: 0.1, emissive: branch.color, emissiveIntensity: 1.2, transparent: true, opacity: 0.5, depthWrite: false }),
    [0, 0.08, 0],
    [-Math.PI / 2, 0, 0]
  )
  fillBeacon.castShadow = false
  frame.add(fillBeacon)
  animated.fillStations.push({ object: fillBeacon, phase, branchId: branch.id })

  const fillDrop = mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    physical(branch.color, { emissive: branch.color, emissiveIntensity: 1.2, roughness: 0.12 }),
    [x, 0.72, z]
  )
  fillDrop.castShadow = false
  fillDrop.visible = false
  fillDrop.scale.set(0.62, 2.4, 0.62)
  parent.add(fillDrop)
  animated.fillDrops.push({ object: fillDrop, top: 0.78, range: 0.53, phase, speed: 1.35, branchId: branch.id })
  parent.add(frame)
}

const addSealingCell = (parent, animated, x, z, branch, phase) => {
  const frame = new THREE.Group()
  frame.position.set(x, 0, z)
  const steel = physical(PALETTE.steel, { roughness: 0.22, metalness: 0.75 })
  const dark = physical(PALETTE.steelDark, { roughness: 0.32, metalness: 0.68 })
  ;[-0.44, 0.44].forEach((side) => {
    frame.add(mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), steel, [0, 0.52, side]))
  })
  frame.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 1.02), steel, [0, 1.16, 0]))
  ;[-0.2, 0.2].forEach((side) => {
    const roller = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 18), dark, [0, 0.42, side])
    frame.add(roller)
    animated.rotors.push({ object: roller, axis: 'y', speed: side < 0 ? 1.8 : -1.8 })
  })
  const scanBar = mesh(
    new THREE.BoxGeometry(0.025, 0.045, 0.78),
    physical(branch.color, { emissive: branch.color, emissiveIntensity: 2.3, roughness: 0.08 }),
    [0.09, 0.8, 0]
  )
  scanBar.castShadow = false
  frame.add(scanBar)
  animated.scanners.push({ object: scanBar, baseY: 0.8, phase: phase + 0.5, amplitude: 0.32, speed: 1.6 })
  const sealBeacon = mesh(
    new THREE.TorusGeometry(0.28, 0.018, 8, 28),
    physical(branch.color, { roughness: 0.1, emissive: branch.color, emissiveIntensity: 1.1, transparent: true, opacity: 0.46, depthWrite: false }),
    [0, 0.08, 0],
    [-Math.PI / 2, 0, 0]
  )
  sealBeacon.castShadow = false
  frame.add(sealBeacon)
  animated.sealStations.push({ object: sealBeacon, phase: phase + 0.4, branchId: branch.id })
  parent.add(frame)
}

const addFinishedCarton = (parent, x, z, branch) => {
  const carton = new THREE.Group()
  carton.position.set(x, -0.87, z)
  const cardboard = physical('#a98255', { roughness: 0.72, clearcoat: 0.05 })
  const darkCardboard = physical('#705236', { roughness: 0.78 })
  const box = mesh(new THREE.BoxGeometry(0.9, 0.76, 0.82), cardboard, [0, 0.38, 0])
  carton.add(box)
  addEdges(carton, box, '#e2c49a', 0.34)
  carton.add(mesh(new THREE.BoxGeometry(0.12, 0.78, 0.835), darkCardboard, [0, 0.38, 0]))
  carton.add(mesh(new THREE.BoxGeometry(0.38, 0.04, 0.8), cardboard, [-0.22, 0.79, 0], [0, 0, -0.12]))
  carton.add(mesh(new THREE.BoxGeometry(0.38, 0.04, 0.8), cardboard, [0.22, 0.79, 0], [0, 0, 0.12]))
  const texture = createLabelTexture('FINISHED', branch.labelZh, branch.color)
  const label = mesh(
    new THREE.PlaneGeometry(0.68, 0.17),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    [0, 0.42, 0.416]
  )
  label.castShadow = false
  carton.add(label)
  parent.add(carton)
}

const addPackagingStation = (parent, animated) => {
  const x = PINEAPPLE_PROCESS_STATIONS[4].x
  addPlatform(parent, x + 0.1, 0, 5.55, 8.15, '#d8b553')
  addStationPlaque(parent, PINEAPPLE_PROCESS_STATIONS[4], 4, '#d8b553', 8.15)

  PINEAPPLE_BRANCHES.forEach((branch, index) => {
    const speed = 0.39 + index * 0.025
    addConveyor(parent, animated, x + 0.15, 4.55, branch.z, { width: 0.72, speed })
    addPipe(parent, [
      [x - 2.35, 1.7, branch.z], [x - 1.52, 1.7, branch.z], [x - 1.03, 1.45, branch.z], [x - 0.9, 1.27, branch.z]
    ], branch.pipeRadius, PALETTE.steelLight, { radialSegments: 10, segments: 30 })
    addSanitaryClamp(parent, [x - 1.78, 1.7, branch.z], 'x', branch.pipeRadius * 1.28, branch.color)
    addSanitaryClamp(parent, [x - 0.9, 1.3, branch.z], 'y', branch.pipeRadius * 1.28, branch.color)
    addFlowArrow(parent, [x - 1.46, 1.7, branch.z], branch.color, animated, index * 0.62 + 0.3, 'x', 1, 0.82)
    addFillingCell(parent, animated, x - 0.9, branch.z, branch, index * 0.23)
    addSealingCell(parent, animated, x + 0.55, branch.z, branch, index * 0.29)

    const builder = PACKAGE_BUILDERS[index]
    for (let packageIndex = 0; packageIndex < 3; packageIndex += 1) {
      const item = builder(parent, x - 1.82, branch.z, branch.color, 0.46)
      animated.packages.push({
        object: item,
        fromX: x - 1.88,
        toX: x + 1.9,
        baseY: item.position.y,
        baseScale: item.scale.clone(),
        speed: 0.075 + index * 0.004,
        phase: packageIndex / 3 + index * 0.04,
        branchId: branch.id,
        fillX: x - 0.9,
        sealX: x + 0.55,
        fillStart: 0.27,
        fillEnd: 0.43,
        sealStart: 0.66,
        sealEnd: 0.79
      })
    }
    addFinishedCarton(parent, x + 2.35, branch.z, branch)
    const departureLight = mesh(
      new THREE.SphereGeometry(0.1, 16, 10),
      physical(branch.color, { roughness: 0.08, emissive: branch.color, emissiveIntensity: 1.4, transparent: true, opacity: 0.7, depthWrite: false }),
      [x + 1.84, 0.22, branch.z]
    )
    departureLight.castShadow = false
    parent.add(departureLight)
    animated.outputSignals.push({ object: departureLight, phase: index * 0.7, branchId: branch.id })
    addSignalTower(parent, [x + 1.52, 0.39, branch.z - 0.42], animated, 4 + index * 0.7)
  })
}

const addFlowStream = (parent, points, color, streams, options = {}) => {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), false, 'catmullrom', 0.35)
  const particleShape = options.particleShape || 'pulse'
  const tube = mesh(
    new THREE.TubeGeometry(curve, options.segments || 72, options.radius || 0.055, options.radialSegments || 9, false),
    physical(color, {
      emissive: color,
      emissiveIntensity: options.intensity ?? 1.2,
      roughness: 0.16,
      metalness: 0.14,
      transparent: true,
      opacity: options.opacity ?? 0.58,
      depthWrite: false
    })
  )
  tube.castShadow = false
  parent.add(tube)

  const particles = []
  const count = options.particles || 7
  const particleGeometry = flowParticleGeometry(particleShape, options.particleSize || 0.09)
  const particleMaterial = physical(color, {
    emissive: color,
    emissiveIntensity: particleShape === 'pieces' ? 1.55 : 2.35,
    roughness: particleShape === 'pieces' ? 0.38 : 0.09,
    transparent: particleShape !== 'pieces',
    opacity: particleShape === 'droplet' ? 0.82 : 0.94,
    depthWrite: particleShape === 'pieces'
  })
  const crownGeometry = particleShape === 'whole'
    ? new THREE.ConeGeometry((options.particleSize || 0.09) * 0.38, (options.particleSize || 0.09) * 0.9, 5)
    : null
  const crownMaterial = particleShape === 'whole'
    ? physical(PALETTE.leafLight, { roughness: 0.48, emissive: PALETTE.leaf, emissiveIntensity: 0.16 })
    : null
  for (let index = 0; index < count; index += 1) {
    let particle
    if (particleShape === 'whole') {
      particle = new THREE.Group()
      const body = mesh(particleGeometry, particleMaterial)
      body.castShadow = false
      particle.add(body)
      for (let leafIndex = 0; leafIndex < 3; leafIndex += 1) {
        const angle = (leafIndex / 3) * Math.PI * 2
        const leaf = mesh(
          crownGeometry,
          crownMaterial,
          [Math.cos(angle) * 0.025, (options.particleSize || 0.09) * 1.18, Math.sin(angle) * 0.025],
          [Math.sin(angle) * 0.2, angle, Math.cos(angle) * -0.2]
        )
        leaf.castShadow = false
        particle.add(leaf)
      }
    } else {
      particle = mesh(particleGeometry, particleMaterial)
    }
    particle.userData.flowBaseScale = flowParticleScale(particleShape, index)
    particle.userData.flowShape = particleShape
    particle.scale.copy(particle.userData.flowBaseScale)
    particle.castShadow = false
    parent.add(particle)
    particles.push(particle)
  }
  streams.push({
    curve,
    particles,
    speed: options.speed || 0.075,
    phase: options.phase ?? 0,
    particleShape,
    tangentStart: new THREE.Vector3(),
    tangentEnd: new THREE.Vector3(),
    tangent: new THREE.Vector3()
  })
}

const addProcessFlows = (parent, streams) => {
  addFlowStream(parent, [
    [-10.25, -0.04, 0],
    [-8.6, -0.04, 0],
    [-6.25, -0.04, 0],
    [-5.35, 0.26, 0],
    [-4.25, 0.55, 0],
    [-3.35, 0.48, 0],
    [-2.88, 0.45, 0]
  ], PALETTE.pineappleLight, streams, {
    radius: 0.052,
    particles: 5,
    speed: 0.046,
    opacity: 0.48,
    particleSize: 0.14,
    particleShape: 'whole',
    segments: 42
  })

  addFlowStream(parent, [
    [-2.88, 0.45, 0],
    [-2.2, 0.72, 0],
    [-1.52, 1.68, 0],
    [-1.15, 1.86, 0],
    [-1.15, 1.18, 0],
    [-0.82, 0.7, 0]
  ], PALETTE.pineappleLight, streams, {
    radius: 0.048,
    particles: 5,
    speed: 0.064,
    opacity: 0.5,
    particleSize: 0.095,
    particleShape: 'pieces',
    segments: 34
  })

  addFlowStream(parent, [
    [-0.82, 0.7, 0],
    [-0.12, 0.65, 0],
    [0.78, 0.62, 0.08],
    [0.98, 0.44, 0.42],
    [1.4, 0.28, 0.22],
    [2.7, 0.18, 0],
    [3.36, 0.15, 0],
    [3.74, 0.46, 0],
    [4.25, 0.46, 0],
    [4.25, 1.12, 0],
    [4.58, 1.32, 0],
    [5.12, 1.32, 0]
  ], PALETTE.pineappleLight, streams, {
    radius: 0.052,
    particles: 8,
    speed: 0.056,
    opacity: 0.5,
    particleSize: 0.09,
    particleShape: 'pulp',
    segments: 72
  })

  PINEAPPLE_BRANCHES.forEach((branch, index) => {
    addFlowStream(parent, [
      [5.12, 1.32, 0],
      [5.12, 1.32, branch.z],
      [5.12, 0.78, branch.z],
      [4.85, 0.54, branch.z],
      [4.85, 0.38, branch.z],
      [5.05, 0.28, branch.z],
      [5.52, 0.28, branch.z],
      [5.82, 0.3, branch.z],
      [6.08, 0.64, branch.z],
      [6.26, 1.05, branch.z],
      [6.48, 1.34, branch.z],
      [6.98, 1.7, branch.z],
      [8.72, 1.7, branch.z],
      [9.18, 1.56, branch.z],
      [9.5, 1.27, branch.z],
      [9.5, 0.74, branch.z]
    ], branch.color, streams, {
      radius: Math.max(0.032, branch.pipeRadius * 0.45),
      particles: branch.particleShape === 'pieces' ? 7 : 6,
      speed: branch.flowSpeed,
      phase: index * 0.17,
      particleSize: branch.particleShape === 'droplet' ? 0.072 : branch.particleShape === 'pieces' ? 0.094 : 0.084,
      particleShape: branch.particleShape,
      opacity: 0.46,
      segments: 96
    })
  })
}

const addEnvironment = (parent, accent, animated) => {
  const floor = mesh(
    new THREE.PlaneGeometry(34, 17),
    physical(PALETTE.floor, { roughness: 0.86, metalness: 0.1 }),
    [0.7, -1.12, 0],
    [-Math.PI / 2, 0, 0]
  )
  parent.add(floor)

  const grid = new THREE.GridHelper(34, 34, '#c8d4cf', '#e5ebe8')
  grid.position.set(0.7, -1.095, 0)
  grid.material.transparent = true
  grid.material.opacity = 0.42
  parent.add(grid)

  const drainMaterial = physical('#d7e0dc', { roughness: 0.82, metalness: 0.28 })
  const grateMaterial = physical('#8b9b96', { roughness: 0.34, metalness: 0.74 })
  // The drain slats are identical static geometry. One instanced draw keeps
  // the sanitary-floor detail while removing 50 individual meshes and their
  // duplicate transform submissions from the render list.
  const grateGeometry = new THREE.BoxGeometry(0.055, 0.027, 0.24)
  const grateCount = 2 * 25
  const grates = new THREE.InstancedMesh(grateGeometry, grateMaterial, grateCount)
  const grateTransform = new THREE.Object3D()
  let grateIndex = 0
  ;[-4.45, 4.45].forEach((z) => {
    parent.add(mesh(new THREE.BoxGeometry(31.2, 0.035, 0.28), drainMaterial, [0.7, -1.075, z]))
    for (let x = -14.5; x <= 15.9; x += 1.25) {
      grateTransform.position.set(x, -1.05, z)
      grateTransform.rotation.set(0, 0, 0)
      grateTransform.scale.set(1, 1, 1)
      grateTransform.updateMatrix()
      grates.setMatrixAt(grateIndex, grateTransform.matrix)
      grateIndex += 1
    }
  })
  grates.instanceMatrix.needsUpdate = true
  grates.castShadow = false
  grates.receiveShadow = true
  grates.computeBoundingSphere()
  parent.add(grates)

  const safetyMaterial = physical('#d7ad43', {
    roughness: 0.36,
    emissive: '#9a681d',
    emissiveIntensity: 0.24
  })
  const safetyGeometries = [new THREE.BoxGeometry(3.18, 0.018, 0.032), new THREE.BoxGeometry(4.42, 0.018, 0.032)]
  const safetyInstances = safetyGeometries.map((geometry, geometryIndex) => new THREE.InstancedMesh(
    geometry,
    safetyMaterial,
    geometryIndex === 0 ? 6 : 4
  ))
  let safetyIndex = 0
  let wideSafetyIndex = 0
  PINEAPPLE_PROCESS_STATIONS.forEach((station, index) => {
    const depth = index >= 3 ? (index === 3 ? 7.74 : 8.08) : 3.34
    const instances = safetyInstances[index >= 3 ? 1 : 0]
    ;[-1, 1].forEach((side) => {
      const transform = new THREE.Object3D()
      transform.position.set(station.x, -1.012, side * depth * 0.5)
      transform.updateMatrix()
      instances.setMatrixAt(index >= 3 ? wideSafetyIndex++ : safetyIndex++, transform.matrix)
    })
  })
  safetyInstances.forEach((instances) => {
    instances.instanceMatrix.needsUpdate = true
    instances.castShadow = false
    instances.receiveShadow = false
    instances.computeBoundingSphere()
    parent.add(instances)
  })

  const haloMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
  PINEAPPLE_PROCESS_STATIONS.forEach((station, index) => {
    const halo = mesh(new THREE.RingGeometry(1.8, 1.84, 64), haloMaterial.clone(), [station.x, -0.82, 0], [-Math.PI / 2, 0, 0])
    const baseOpacity = index === 0 ? 0.18 : 0.09
    halo.material.opacity = baseOpacity
    parent.add(halo)
    animated.halos.push({ object: halo, phase: index * 0.82, baseOpacity, stationIndex: index })
  })
}

export function createPineappleProcessScene({ accent = '#3b8061' } = {}) {
  const group = new THREE.Group()
  group.name = 'pineapple-process-path'
  const runtime = {
    group,
    streams: [],
    rotors: [],
    bobs: [],
    drops: [],
    pulses: [],
    conveyors: [],
    travelers: [],
    scanners: [],
    gauges: [],
    signals: [],
    valves: [],
    liquids: [],
    feedChunks: [],
    packages: [],
    pistons: [],
    fillDrops: [],
    fillStations: [],
    sealStations: [],
    outputSignals: [],
    sightFlows: [],
    flowMarkers: [],
    fans: [],
    halos: [],
    packagingActivity: Object.fromEntries(PINEAPPLE_BRANCHES.map((branch) => [
      branch.id,
      { fill: 0, fillProgress: 0, seal: 0 }
    ])),
    activeStationIndex: -1,
    lastPausedStationIndex: -1,
    pausedFrameReady: false,
    simulationTime: 0,
    lastElapsed: null
  }

  addEnvironment(group, accent, runtime)
  addRawStation(group, runtime)
  addPreparationStation(group, runtime)
  addExtractionStation(group, runtime)
  addBranchStation(group, runtime)
  addPackagingStation(group, runtime)
  addProcessFlows(group, runtime.streams)
  return runtime
}

export function updatePineappleProcessScene(runtime, elapsed, playing = true) {
  if (!runtime) return
  // Camera interaction can still request a frame while playback is paused.
  // Once the static state is up to date, skip all animation bookkeeping for
  // those frames; station focus changes invalidate this small cache.
  if (!playing && runtime.pausedFrameReady && runtime.lastPausedStationIndex === runtime.activeStationIndex) return
  if (runtime.lastElapsed == null) runtime.lastElapsed = elapsed
  const delta = Math.min(Math.max(elapsed - runtime.lastElapsed, 0), 0.05)
  runtime.lastElapsed = elapsed
  if (playing) runtime.simulationTime += delta
  const motionTime = runtime.simulationTime

  runtime.streams.forEach((stream) => {
    stream.particles.forEach((particle, index) => {
      const offset = index / stream.particles.length
      const progress = (motionTime * stream.speed + stream.phase + offset) % 1
      // Pass the existing position target to avoid allocating a Vector3 for
      // every particle on every frame.
      stream.curve.getPointAt(progress, particle.position)
      const pulse = 0.86 + Math.sin((motionTime * 3.2) + index) * 0.12
      particle.scale.copy(particle.userData.flowBaseScale).multiplyScalar(pulse)
      // Curve#getTangentAt allocates two point vectors internally. Recreate
      // the same small-delta tangent using the stream-owned scratch vectors.
      const mappedT = stream.curve.getUtoTmapping(progress)
      const tangentStartT = Math.max(0, mappedT - 0.0001)
      const tangentEndT = Math.min(1, mappedT + 0.0001)
      stream.curve.getPoint(tangentStartT, stream.tangentStart)
      stream.curve.getPoint(tangentEndT, stream.tangentEnd)
      const tangent = stream.tangent
        .subVectors(stream.tangentEnd, stream.tangentStart)
        .normalize()
      if (stream.particleShape === 'whole') {
        particle.rotation.set(0, motionTime * 0.38 + index * 0.9, Math.sin(motionTime * 1.1 + index) * 0.08)
      } else {
        particle.quaternion.setFromUnitVectors(FLOW_AXIS, tangent)
      }
      if (stream.particleShape === 'pieces') particle.rotateY(motionTime * 1.2 + index * 0.7)
      if (stream.particleShape === 'pulp' || stream.particleShape === 'filling') {
        particle.rotateZ(Math.sin(motionTime * 0.85 + index) * 0.32)
      }
    })
  })

  runtime.sightFlows.forEach((entry) => {
    entry.particles.forEach((particle, index) => {
      const progress = (motionTime * entry.speed + entry.phase + particle.offset) % 1
      particle.object.position.y = THREE.MathUtils.lerp(-entry.height * 0.5, entry.height * 0.5, progress)
      particle.object.position.x = Math.sin(progress * Math.PI * 2 + index) * 0.025
      particle.object.position.z = Math.cos(progress * Math.PI * 2 + index * 1.4) * 0.021
      const pulse = 0.9 + Math.sin(motionTime * 2.1 + index) * 0.08
      particle.object.scale.copy(particle.baseScale).multiplyScalar(pulse)
      if (entry.shape === 'pieces') {
        particle.object.rotation.x = motionTime * 0.72 + index
        particle.object.rotation.z = motionTime * 0.54 + index * 0.6
      }
    })
  })

  runtime.flowMarkers.forEach((entry, index) => {
    const pulse = (Math.sin(motionTime * 2.8 + entry.phase) + 1) * 0.5
    entry.object.material.emissiveIntensity = entry.baseIntensity + pulse * 1.35
    const scale = 0.9 + pulse * 0.12
    entry.object.scale.set(scale, scale, scale)
  })

  runtime.rotors.forEach((entry) => {
    entry.object.rotation[entry.axis] += entry.speed * delta * (playing ? 1 : 0)
  })

  runtime.fans.forEach((entry) => {
    entry.object.rotation[entry.axis || 'x'] += entry.speed * delta * (playing ? 1 : 0)
  })

  runtime.conveyors.forEach((entry) => {
    entry.basePositions.forEach((baseX, index) => {
      const travel = ((baseX - entry.min) + motionTime * entry.speed) % entry.length
      entry.transform.position.x = entry.min + travel
      entry.transform.updateMatrix()
      entry.slats.setMatrixAt(index, entry.transform.matrix)
    })
    entry.slats.instanceMatrix.needsUpdate = true
  })

  runtime.travelers.forEach((entry) => {
    const progress = (motionTime * entry.speed + entry.phase) % 1
    entry.object.position.x = THREE.MathUtils.lerp(entry.fromX, entry.toX, progress)
    entry.object.position.y = entry.baseY + Math.sin(progress * Math.PI) * 0.035
    entry.object.rotation.z = -motionTime * entry.roll
  })

  runtime.bobs.forEach((entry) => {
    entry.object.position.y = entry.baseY + Math.sin(motionTime * 1.35 + entry.phase) * entry.amplitude
  })

  runtime.drops.forEach((entry) => {
    const progress = (motionTime * (entry.speed || 0.55) + entry.phase) % 1
    entry.object.position.y = entry.top - progress * entry.range
    if (entry.baseX != null) entry.object.position.x = entry.baseX + Math.sin(progress * Math.PI) * (entry.sway || 0)
    entry.object.scale.setScalar(0.7 + (1 - progress) * 0.4)
  })

  runtime.pulses.forEach((entry) => {
    const amplitude = entry.amplitude ?? 0.18
    const pulse = 1 - amplitude + Math.sin(motionTime * 2.4 + entry.phase) * amplitude
    entry.object.scale.setScalar(pulse)
  })

  runtime.scanners.forEach((entry) => {
    const wave = Math.sin(motionTime * (entry.speed || 1.9) + entry.phase)
    entry.object.position.y = entry.baseY + wave * (entry.amplitude || 0.34)
    if (entry.object.material?.transparent) entry.object.material.opacity = 0.1 + (wave + 1) * 0.06
    if (entry.object.material?.emissive) entry.object.material.emissiveIntensity = 1.7 + (wave + 1) * 0.45
  })

  runtime.gauges.forEach((entry) => {
    const reading = (Math.sin(motionTime * 1.24 + entry.phase) + 1) * 0.5
    entry.object.rotation.z = entry.base + reading * entry.range
  })

  runtime.signals.forEach((entry) => {
    const pulse = (Math.sin(motionTime * 2.15 + entry.phase) + 1) * 0.5
    entry.object.material.emissiveIntensity = entry.active ? 1.25 + pulse * 1.45 : 0.1 + pulse * 0.08
  })

  runtime.valves.forEach((entry) => {
    entry.object.rotation.z = motionTime * entry.speed + entry.phase
  })

  runtime.liquids.forEach((entry) => {
    const level = 1 + Math.sin(motionTime * 0.92 + entry.phase) * entry.amplitude
    entry.object.scale.y = level
    entry.object.position.y = entry.baseY + entry.baseHeight * (level - 1) * 0.5
    if (entry.meniscus) {
      entry.meniscus.position.y = entry.baseY + entry.baseHeight * 0.5 * level
      entry.meniscus.material.opacity = 0.58 + (level - 1) * 0.35
    }
    entry.bubbles?.forEach((bubble, index) => {
      const bubbleProgress = (motionTime * (0.08 + index * 0.012) + bubble.phase) % 1
      bubble.object.position.y = -entry.baseHeight * 0.45 + bubbleProgress * entry.baseHeight * 0.86
      bubble.object.position.x = bubble.baseX + Math.sin(motionTime * 0.8 + index) * 0.011
      bubble.object.position.z = bubble.baseZ + Math.cos(motionTime * 0.68 + index) * 0.009
      bubble.object.material.opacity = 0.2 + Math.sin(bubbleProgress * Math.PI) * 0.45
    })
  })

  runtime.feedChunks.forEach((entry, index) => {
    const progress = (motionTime * 0.48 + entry.phase) % 1
    entry.object.position.y = THREE.MathUtils.lerp(entry.top, entry.bottom, progress)
    entry.object.position.x = entry.baseX + Math.sin(progress * Math.PI * 2 + index) * 0.06
    entry.object.rotation.x = motionTime * (1.25 + index * 0.05)
    entry.object.rotation.z = motionTime * (0.82 + index * 0.04)
    entry.object.scale.setScalar(0.72 + Math.sin(progress * Math.PI) * 0.34)
  })

  const packagingActivity = runtime.packagingActivity
  PINEAPPLE_BRANCHES.forEach((branch) => {
    const activity = packagingActivity[branch.id]
    activity.fill = 0
    activity.fillProgress = 0
    activity.seal = 0
  })
  runtime.packages.forEach((entry, index) => {
    const progress = (motionTime * entry.speed + entry.phase) % 1
    let positionX = entry.fromX
    let fillActivity = 0
    let sealActivity = 0

    if (progress < entry.fillStart) {
      positionX = THREE.MathUtils.lerp(entry.fromX, entry.fillX, smoothStep(progress / entry.fillStart))
    } else if (progress < entry.fillEnd) {
      positionX = entry.fillX
      const localProgress = (progress - entry.fillStart) / (entry.fillEnd - entry.fillStart)
      fillActivity = Math.sin(localProgress * Math.PI)
    } else if (progress < entry.sealStart) {
      positionX = THREE.MathUtils.lerp(entry.fillX, entry.sealX, smoothStep((progress - entry.fillEnd) / (entry.sealStart - entry.fillEnd)))
    } else if (progress < entry.sealEnd) {
      positionX = entry.sealX
      const localProgress = (progress - entry.sealStart) / (entry.sealEnd - entry.sealStart)
      sealActivity = Math.sin(localProgress * Math.PI)
    } else {
      positionX = THREE.MathUtils.lerp(entry.sealX, entry.toX, smoothStep((progress - entry.sealEnd) / (1 - entry.sealEnd)))
    }

    const currentActivity = packagingActivity[entry.branchId]
    if (fillActivity > currentActivity.fill) {
      currentActivity.fill = fillActivity
      currentActivity.fillProgress = (progress - entry.fillStart) / (entry.fillEnd - entry.fillStart)
    }
    currentActivity.seal = Math.max(currentActivity.seal, sealActivity)
    entry.object.position.x = positionX
    entry.object.position.y = entry.baseY - fillActivity * 0.018 + Math.sin(progress * Math.PI * 10) * 0.004
    entry.object.rotation.y = Math.sin(motionTime * 0.8 + index) * 0.018 * (1 - Math.max(fillActivity, sealActivity))
    entry.object.scale.copy(entry.baseScale)
    entry.object.scale.y *= 1 + fillActivity * 0.035
  })

  runtime.pistons.forEach((entry) => {
    const fillActivity = packagingActivity[entry.branchId]?.fill || 0
    entry.object.position.y = entry.baseY - smoothStep(fillActivity) * entry.amplitude
  })

  runtime.fillDrops.forEach((entry) => {
    const activity = packagingActivity[entry.branchId]
    const fillActivity = activity?.fill || 0
    const localProgress = THREE.MathUtils.clamp(activity?.fillProgress || 0, 0, 1)
    entry.object.visible = fillActivity > 0.08
    entry.object.position.y = entry.top - ((localProgress * entry.speed) % 1) * entry.range
    entry.object.scale.set(0.62 + fillActivity * 0.1, 1.6 + fillActivity * 1.2, 0.62 + fillActivity * 0.1)
  })

  runtime.fillStations.forEach((entry) => {
    const activity = packagingActivity[entry.branchId]?.fill || 0
    entry.object.material.opacity = 0.18 + activity * 0.82
    entry.object.material.emissiveIntensity = 0.55 + activity * 2.2
    entry.object.scale.setScalar(0.9 + activity * 0.28)
  })

  runtime.sealStations.forEach((entry) => {
    const activity = packagingActivity[entry.branchId]?.seal || 0
    entry.object.material.opacity = 0.16 + activity * 0.84
    entry.object.material.emissiveIntensity = 0.5 + activity * 2.5
    entry.object.scale.setScalar(0.9 + activity * 0.24)
  })

  runtime.outputSignals.forEach((entry) => {
    const progress = (motionTime * 0.62 + entry.phase) % 1
    const flash = Math.pow(Math.max(0, Math.sin(progress * Math.PI * 2)), 8)
    entry.object.material.opacity = 0.24 + flash * 0.76
    entry.object.material.emissiveIntensity = 0.45 + flash * 3.2
    entry.object.scale.setScalar(0.75 + flash * 0.72)
  })

  runtime.halos.forEach((entry) => {
    const wave = (Math.sin(motionTime * 1.12 + entry.phase) + 1) * 0.5
    const focused = runtime.activeStationIndex === entry.stationIndex
    const opacityScale = runtime.activeStationIndex < 0 ? 1 : (focused ? 1.9 : 0.32)
    const sizeScale = focused ? 1.16 : (runtime.activeStationIndex < 0 ? 1 : 0.96)
    entry.object.material.opacity = entry.baseOpacity * opacityScale * (0.62 + wave * 0.68)
    entry.object.scale.setScalar((0.96 + wave * 0.08) * sizeScale)
  })
  runtime.pausedFrameReady = !playing
  runtime.lastPausedStationIndex = runtime.activeStationIndex
}
