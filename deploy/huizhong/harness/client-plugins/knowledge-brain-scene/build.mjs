import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const reference = readFileSync(join(root, 'reference/static-index.html'), 'utf8')
const style = reference.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''
const markup = reference.match(/<body>([\s\S]*?)<\/body>/)?.[1] || ''
const script = reference.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] || ''
const source = script
  .replace(/^import .*?;\s*/gm, '')
  .replace(/const viewport = document\.getElementById\('viewport'\);/, "const viewport = root.querySelector('#viewport');")
  .replaceAll("document.getElementById(", "scopedDocument.getElementById(")
  .replaceAll("document.querySelector(", "scopedDocument.querySelector(")
  .replaceAll('document.hidden', 'globalDocument.hidden')
  .replaceAll('window.innerWidth', 'viewport.clientWidth')
  .replaceAll('window.innerHeight', 'viewport.clientHeight')
  .replace("new URLSearchParams(window.location.search).get('quality')", 'null')
  .replace("window.__canonicalSnapshotReady = loadCanonicalSnapshot();", 'window.__canonicalSnapshotReady = Promise.resolve();')
  .replace("window.addEventListener('resize',", "resizeTarget.addEventListener('resize',")
const generated = `
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const REFERENCE_STYLE = ${JSON.stringify(style)}
const REFERENCE_MARKUP = ${JSON.stringify(markup)}

export function createBrainScene(host) {
  if (!host) return { ready: false, setMode() {}, dispose() {} }
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<style>' + REFERENCE_STYLE + '.dshBrainUi{position:absolute;inset:0}.dshBrainUi .controls,.dshBrainUi #viewport,.dshBrainUi #memoryPanel{pointer-events:auto}.eisKnowledgeBrainCanvas{display:block;width:100%;height:100%;transform:scale(1);transition:transform .65s cubic-bezier(.22,.61,.36,1);transform-origin:50% 90%}</style>' + REFERENCE_MARKUP
  const root = shadow
  const globalDocument = globalThis.document
  const resizeTarget = new EventTarget()
  const hostResizeObserver = new ResizeObserver(() => resizeTarget.dispatchEvent(new Event('resize')))
  hostResizeObserver.observe(host)
  const scopedDocument = {
    get hidden() { return globalDocument.hidden },
    getElementById: id => root.querySelector('#' + id),
    querySelector: selector => root.querySelector(selector)
  }
${source}
  const renderedCanvas = renderer.domElement
  renderedCanvas.dataset.knowledgeBrainCanvas = ''
  renderedCanvas.className = 'eisKnowledgeBrainCanvas'
  const nativeRender = render
  let currentMode = 'idle'
  const setMode = next => {
    currentMode = next
    renderedCanvas.style.transform = next === 'settling' ? 'scale(.15)' : 'scale(1)'
    if (next === 'thinking') {
      renderSuspended = false
      updateGrid(true)
      updateMemoryVisibility(true)
      updateNeuralVisible(true)
      nativeRender()
    } else if (next === 'hero' || next === 'settling') {
      renderSuspended = false
      updateGrid(true)
      updateMemoryVisibility(true)
      updateNeuralVisible(false)
      nativeRender()
    } else {
      stopNeuralAnimation()
      if (memoryRAF) cancelAnimationFrame(memoryRAF)
      memoryRAF = 0
      renderSuspended = true
    }
  }
  setMode('idle')
  return {
    ready: true,
    canvas: renderedCanvas,
    setMode,
    dispose() {
      stopNeuralAnimation()
      if (memoryRAF) cancelAnimationFrame(memoryRAF)
      if (scheduledRender) cancelAnimationFrame(scheduledRender)
      hostResizeObserver.disconnect()
      controls.dispose()
      const resources = new Set()
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) resources.add(material)
        if (object.isInstancedMesh) object.dispose()
      })
      resources.forEach(resource => resource.dispose())
      renderer.dispose()
      renderedCanvas.remove()
      shadow.innerHTML = ''
    }
  }
}
`
writeFileSync(join(root, 'src/reference-brain-scene.js'), generated)
await build({
  absWorkingDir: root,
  entryPoints: ['src/brain-stage.js'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'iife',
  globalName: 'brain',
  minify: true,
  target: 'es2022',
  alias: {
    'three/addons/controls/OrbitControls.js': join(root, 'vendor/OrbitControls.js'),
    three: join(root, 'vendor/three.module.min.js')
  },
  banner: { js: 'window.__ModuleLoader__.load({id:"@eiscore/dsh-client-knowledge-brain-scene",factory:()=>{' },
  footer: { js: 'return {...brain,apply(){}};}});' }
})
