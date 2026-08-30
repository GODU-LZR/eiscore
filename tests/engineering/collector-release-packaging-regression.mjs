// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '../..')
const publishScript = resolve(repoRoot, 'collector-desktop/scripts/publish-collector.ps1')
const installerScript = readFileSync(resolve(repoRoot, 'collector-desktop/installer/EISCore.Collector.iss'), 'utf8')
const publishScriptSource = readFileSync(publishScript, 'utf8')

assert.match(publishScriptSource, /param\([\s\S]*\[string\]\$PackagePath/, 'publish script should support manifest generation for a prebuilt package')
assert.match(publishScriptSource, /if \(\$BuildInstaller -and -not \[string\]::IsNullOrWhiteSpace\(\$PackagePath\)\)/, 'publish script should reject BuildInstaller with PackagePath')
assert.match(publishScriptSource, /\[System\.Security\.Cryptography\.SHA256\]::Create\(\)/, 'publish script should hash artifacts with SHA256 without relying on PowerShell module auto-loading')
assert.match(publishScriptSource, /\$stream\.Dispose\(\)/, 'publish script should close the artifact stream after hashing')
assert.match(publishScriptSource, /Compress-Archive -Path/, 'publish script should produce a zip package for normal publish output')
assert.match(publishScriptSource, /Invoke-InnoSetupBuild/, 'publish script should support building an installer package')
assert.match(publishScriptSource, /installer_arguments = if \(\$canShellInstall\) \{ \$InstallerArguments \} else \{ "" \}/, 'zip manifests should not retain installer arguments')
assert.match(installerScript, /Source: "\{#SourceDir\}\\\*"; DestDir: "\{app\}"; Flags: ignoreversion recursesubdirs createallsubdirs/, 'installer script should package the published collector directory')
assert.match(installerScript, /CloseApplications=yes/, 'installer should be able to close the running collector during silent updates')

const tempRoot = mkdtempSync(join(tmpdir(), 'eiscore-collector-release-'))

try {
  const zipPath = join(tempRoot, 'EISCore.Collector-1.2.3-win-x64.zip')
  const msiPath = join(tempRoot, 'EISCore Collector 1.2.3.msi')
  writeFileSync(zipPath, 'fake zip artifact for release packaging regression\n')
  writeFileSync(msiPath, 'fake msi artifact for release packaging regression\n')

  const zipResult = runPublishScript([
    '-Version', '1.2.3',
    '-PackagePath', zipPath,
    '-OutputRoot', join(tempRoot, 'zip-output'),
    '-DownloadBaseUrl', 'https://download.example.com/eiscore/collector/',
    '-AutoInstall',
    '-InstallerArguments', '/quiet /norestart'
  ])
  const zipManifest = readJson(zipResult.manifestPath)
  assert.equal(zipResult.autoInstall, false, 'zip artifacts should not be marked auto-installable')
  assert.equal(zipManifest.auto_install, false, 'zip manifest should disable auto_install even when requested')
  assert.equal(zipManifest.installer_arguments, '', 'zip manifest should clear installer arguments')
  assert.equal(zipManifest.download_url, 'https://download.example.com/eiscore/collector/EISCore.Collector-1.2.3-win-x64.zip')
  assert.equal(zipManifest.sha256, sha256(zipPath), 'zip manifest should include the package SHA256')

  const installerResult = runPublishScript([
    '-Version', '1.2.3',
    '-PackagePath', msiPath,
    '-OutputRoot', join(tempRoot, 'installer-output'),
    '-DownloadBaseUrl', 'https://download.example.com/eiscore/collector',
    '-AutoInstall',
    '-Mandatory',
    '-InstallerArguments', '/quiet /norestart'
  ])
  const installerManifest = readJson(installerResult.manifestPath)
  assert.equal(installerResult.autoInstall, true, 'installer artifacts should be auto-installable when requested')
  assert.equal(installerManifest.auto_install, true, 'installer manifest should preserve auto_install')
  assert.equal(installerManifest.mandatory, true, 'installer manifest should preserve the mandatory flag')
  assert.equal(installerManifest.installer_arguments, '/quiet /norestart', 'installer manifest should preserve installer arguments')
  assert.equal(installerManifest.download_url, 'https://download.example.com/eiscore/collector/EISCore%20Collector%201.2.3.msi')
  assert.equal(installerManifest.sha256, sha256(msiPath), 'installer manifest should include the package SHA256')

  const localOnlyResult = runPublishScript([
    '-Version', '1.2.3',
    '-PackagePath', zipPath,
    '-OutputRoot', join(tempRoot, 'local-only-output'),
    '-SkipManifest'
  ])
  assert.equal(localOnlyResult.manifestPath, '', 'SkipManifest should permit package-only runs without DownloadBaseUrl')
  assert.equal(localOnlyResult.downloadUrl, '', 'SkipManifest should not report a download URL')

  const invalidResult = spawnPublish([
    '-Version', '1.2.3',
    '-PackagePath', zipPath,
    '-OutputRoot', join(tempRoot, 'invalid-output'),
    '-DownloadBaseUrl', 'https://download.example.com/eiscore/collector',
    '-BuildInstaller'
  ])
  assert.notEqual(invalidResult.status, 0, 'BuildInstaller with PackagePath should fail')
  assert.match(`${invalidResult.stdout}\n${invalidResult.stderr}`, /BuildInstaller cannot be combined with PackagePath/)

  console.log('PASS: collector release packaging regression')
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}

function runPublishScript(args) {
  const result = spawnPublish(args)
  assert.equal(result.status, 0, `publish script failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  return parseJsonFromOutput(result.stdout)
}

function spawnPublish(args) {
  return spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    publishScript,
    ...args
  ], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
}

function parseJsonFromOutput(output) {
  const jsonStart = output.indexOf('{')
  assert.notEqual(jsonStart, -1, `PowerShell output should contain JSON:\n${output}`)
  return JSON.parse(output.slice(jsonStart))
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}
