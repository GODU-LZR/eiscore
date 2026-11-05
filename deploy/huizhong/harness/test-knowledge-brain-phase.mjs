import assert from 'node:assert/strict'
import { createBrainPhase } from './client-plugins/knowledge-brain-scene/src/brain-phase.js'

let now = 0
let serial = 0
const pending = new Map()
const clock = {
  setTimeout(fn, delay) { pending.set(++serial, { fn, due: now + delay }); return serial },
  clearTimeout(id) { pending.delete(id) }
}
const tick = duration => {
  now += duration
  for (const [id, timer] of pending) if (timer.due <= now) { pending.delete(id); timer.fn() }
}
const states = []
const phase = createBrainPhase(value => states.push(value), clock)
phase.update('hero')
phase.update('hero')
assert.deepEqual(states, ['hero'])
phase.update('thinking')
phase.update('idle')
assert.equal(states.at(-1), 'settling')
for (let i = 0; i < 6; i++) { tick(100); phase.update('idle') }
assert.equal(states.at(-1), 'settling')
tick(80)
assert.equal(states.at(-1), 'idle', 'DOM changes cannot restart the 680 ms completion timer')
phase.update('thinking')
phase.update('idle')
tick(100)
phase.update('thinking')
tick(1000)
assert.equal(states.at(-1), 'thinking', 'a queued/new response cancels the old completion')
phase.update('hero')
assert.equal(states.at(-1), 'hero', 'switching to an empty session opens the brain immediately')
phase.update('thinking')
phase.update('idle')
phase.dispose()
assert.equal(pending.size, 0)
console.log('PASS: empty/history, generate, complete/stop/error, interrupted completion and disposal')
