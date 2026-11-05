import { createBrainScene } from './brain-scene.js'
import { createBrainPhase } from './brain-phase.js'

// Selectors are the installed DSH 0.1.2-rc.1 conversation contract. If unavailable,
// leave the original conversation visible rather than masking an unknown layout.
const STOP = 'button[aria-label="停止生成"],button[aria-label="Stop generating"]'
export function createBrainStage(host) {
  const canvas = host.querySelector('canvas')
  const scene = createBrainScene(canvas)
  if (!scene.ready) return () => scene.dispose()
  let root
  let scheduled = 0
  let watched = []
  let frame
  let originalHeight = ''
  let originalMinHeight = ''
  const parents = []
  let parent = window
  try {
    while (parent !== parent.parent) { parent = parent.parent; parents.push(parent) }
  } catch { /* A cross-origin host keeps the native viewport size. */ }
  const visibleHeight = () => {
    let available = window.innerHeight
    let offset = 0
    let current = window
    try {
      while (current !== current.parent && current.frameElement) {
        offset += current.frameElement.getBoundingClientRect().top
        current = current.parent
        available = Math.min(available, current.innerHeight - offset)
      }
    } catch { /* Keep the last same-origin viewport bound. */ }
    return Math.max(0, Math.floor(available))
  }
  const phase = createBrainPhase(next => {
    host.dataset.brainPhase = next
    scene.setMode(next)
    root?.toggleAttribute('data-knowledge-brain-active', next === 'thinking')
  })
  const clearRoot = () => {
    root?.removeAttribute('data-knowledge-brain-active')
    root?.removeAttribute('data-knowledge-brain-ready')
  }
  const measure = () => {
    scheduled = 0
    const nextFrame = document.querySelector('.pI_x6G_frame')
    if (nextFrame !== frame) {
      if (frame) { frame.style.height = originalHeight; frame.style.minHeight = originalMinHeight }
      frame = nextFrame
      originalHeight = frame?.style.height || ''
      originalMinHeight = frame?.style.minHeight || ''
    }
    if (frame) {
      const height = `${visibleHeight()}px`
      if (frame.style.height !== height) frame.style.height = height
      if (frame.style.minHeight !== '0px') frame.style.minHeight = '0px'
    }
    const nextRoot = document.querySelector('.wSkVaW_root')
    if (root !== nextRoot) { clearRoot(); root = nextRoot }
    const composer = root?.querySelector('.wSkVaW_composerSeat')
    const body = root?.querySelector('.wSkVaW_body')
    const menu = document.querySelector('[data-knowledge-session-menu]')
    const elements = [root, composer, body, menu].filter(Boolean)
    if (elements.some((element, index) => watched[index] !== element) || watched.length !== elements.length) {
      resize.disconnect()
      watched = elements
      watched.forEach(element => resize.observe(element))
    }
    if (!root || !composer || !body) { phase.update('idle'); return }
    const bounds = root.getBoundingClientRect()
    const bodyBounds = body.getBoundingClientRect()
    const inputBounds = composer.getBoundingClientRect()
    const top = Math.max(bodyBounds.top, menu?.getBoundingClientRect().bottom || 0)
    const bottom = Math.min(inputBounds.top - 8, bounds.bottom)
    const height = Math.max(0, bottom - top)
    for (const [key, value] of Object.entries({ left: bounds.left, top, width: bounds.width, height })) {
      const css = `${Math.round(value)}px`
      if (host.style[key] !== css) host.style[key] = css
    }
    root.setAttribute('data-knowledge-brain-ready', '')
    phase.update(height < 48 || bounds.width < 48 ? 'idle' : root.querySelector(STOP) ? 'thinking' : root.dataset.phase === 'hero' ? 'hero' : 'idle')
  }
  const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(measure) }
  const resize = new ResizeObserver(schedule)
  const observer = new MutationObserver(records => {
    if (records.some(record => !host.contains(record.target))) schedule()
  })
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'style', 'data-phase', 'aria-label']
  })
  window.addEventListener('resize', schedule)
  for (const parent of parents) { parent.addEventListener('resize', schedule); parent.addEventListener('scroll', schedule, true) }
  measure()
  return () => {
    phase.dispose()
    cancelAnimationFrame(scheduled)
    observer.disconnect()
    resize.disconnect()
    window.removeEventListener('resize', schedule)
    for (const parent of parents) { parent.removeEventListener('resize', schedule); parent.removeEventListener('scroll', schedule, true) }
    if (frame) { frame.style.height = originalHeight; frame.style.minHeight = originalMinHeight }
    clearRoot()
    scene.dispose()
  }
}
