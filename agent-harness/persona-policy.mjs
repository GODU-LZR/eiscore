import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { promptForPersona, requireHarnessPersona, validateHarnessPersonaProfile } = require('./profile-policy.js')
const persona = String(process.env.HARNESS_PERSONA || process.env.EISCORE_HARNESS_PERSONA || process.env.RUNTIME_PERSONA || '').trim().toLowerCase()

export const name = 'eiscore-persona-policy'
export const inject = ['systemPrompt']

export function apply(ctx) {
  if (!persona) return
  const profile = String(process.env.EISCORE_HARNESS_CAPABILITY_PROFILE || process.env.RUNTIME_PROFILE || (persona === 'flash' ? 'flash' : 'business')).trim().toLowerCase()
  const normalized = validateHarnessPersonaProfile(profile, requireHarnessPersona(persona, 'HARNESS_PERSONA'))
  ctx.systemPrompt.section({ name: 'eiscore:persona-policy', order: 0, text: promptForPersona(normalized) })
}
