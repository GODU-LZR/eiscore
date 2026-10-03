import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureStartupProfile } from './dsh-web-runner.mjs'

const home = mkdtempSync(join(tmpdir(), 'eiscore-dsh-web-profile-'))
try {
  const profileDir = join(home, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-web',
    dsh: { profile: { bundles: ['custom-bundle'], patchReload: 'live' } }
  }))
  writeFileSync(join(profileDir, 'cordis.patch.yml'), '- id: custom\n')

  const result = ensureStartupProfile(home)
  const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf8'))
  assert.deepEqual(manifest.dsh.profile.bundles, ['custom-bundle'])
  assert.equal(manifest.dsh.profile.patchReload, 'startup')
  assert.equal(readFileSync(result.patchPath, 'utf8'), '- id: custom\n')

  const freshHome = mkdtempSync(join(tmpdir(), 'eiscore-dsh-web-profile-fresh-'))
  try {
    const fresh = ensureStartupProfile(freshHome)
    const freshManifest = JSON.parse(readFileSync(fresh.manifestPath, 'utf8'))
    assert.deepEqual(freshManifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
    assert.equal(freshManifest.dsh.profile.patchReload, 'startup')
    assert.equal(readFileSync(fresh.patchPath, 'utf8'), '[]\n')
  } finally {
    rmSync(freshHome, { recursive: true, force: true })
  }

  assert.throws(() => ensureStartupProfile(''), /DSH_HOME is required/)
} finally {
  rmSync(home, { recursive: true, force: true })
}

console.log('PASS: Lundu Web runner pins a startup-only DSH profile')
