import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  LunduHarnessArtifactValidationError,
  REQUIRED_DSH_TOOL_FILES,
  REQUIRED_PLUGIN_FILES,
  validateLunduHarnessArtifacts,
  validateLunduHarnessArtifactsRuntime
} from '../../scripts/validate-lundu-harness-artifacts.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const patchFile = resolve(repoRoot, 'deploy/lundu/dsh-web.patch.yml')
const tempRoot = mkdtempSync(join(tmpdir(), 'eiscore-harness-preflight-'))
try {
  assert.throws(
    () => validateLunduHarnessArtifacts({ harnessRoot: '', patchFile }),
    (error) => error instanceof LunduHarnessArtifactValidationError && error.issues.includes('LUNDU_HARNESS_ROOT: required')
  )

  for (const [, relativePath] of REQUIRED_PLUGIN_FILES) {
    const file = join(tempRoot, relativePath)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, 'export const inject = []\nexport function apply() {}\n')
  }
  for (const [, relativePath] of REQUIRED_DSH_TOOL_FILES) {
    const file = join(tempRoot, relativePath)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, relativePath.endsWith('.mjs') ? 'export const capabilities = ["eiscore_enterprise_snapshot"]\nexport function apply() {}\n' : '- insert: []\n')
  }
  const result = validateLunduHarnessArtifacts({ harnessRoot: tempRoot, patchFile })
  assert.deepEqual(result.plugins, REQUIRED_PLUGIN_FILES.map(([pluginId]) => pluginId))
  const runtimeResult = await validateLunduHarnessArtifactsRuntime({ harnessRoot: tempRoot, patchFile })
  assert.deepEqual(runtimeResult.plugins, REQUIRED_PLUGIN_FILES.map(([pluginId]) => pluginId))

  writeFileSync(join(tempRoot, 'client-plugins/enterprise-bi/lib/index.js'), 'export default {}\n')
  await assert.rejects(
    () => validateLunduHarnessArtifactsRuntime({ harnessRoot: tempRoot, patchFile }),
    (error) => error instanceof LunduHarnessArtifactValidationError && error.issues.some((issue) => issue.includes('must export apply'))
  )
  writeFileSync(join(tempRoot, 'client-plugins/enterprise-bi/lib/index.js'), 'export const inject = []\nexport function apply() {}\n')

  rmSync(join(tempRoot, 'client-plugins/enterprise-bi/lib/index.js'))
  assert.throws(
    () => validateLunduHarnessArtifacts({ harnessRoot: tempRoot, patchFile }),
    (error) => error instanceof LunduHarnessArtifactValidationError && error.issues.some((issue) => issue.includes('enterprise-bi'))
  )
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}

console.log('PASS: Lundu Harness artifact preflight contract')
