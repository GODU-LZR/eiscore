// A completion has one bounded exit animation; unrelated DOM updates cannot extend it.
export function createBrainPhase(onPhase, clock = globalThis) {
  let current = 'idle'
  let previous = 'idle'
  let timer
  const show = value => { if (current !== value) { current = value; onPhase(value) } }
  return {
    update(next) {
      if (next === previous) return
      const wasThinking = previous === 'thinking'
      previous = next
      clock.clearTimeout(timer)
      if (wasThinking && next === 'idle') {
        show('settling')
        timer = clock.setTimeout(() => show('idle'), 680)
      } else show(next)
    },
    dispose() { clock.clearTimeout(timer) }
  }
}
