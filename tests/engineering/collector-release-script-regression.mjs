// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const publishScript = readFileSync(resolve(repoRoot, 'collector-desktop/scripts/publish-collector.ps1'), 'utf8')
const localReleaseScript = readFileSync(resolve(repoRoot, 'collector-desktop/scripts/setup-local-wsl-release.ps1'), 'utf8')
const innoScript = readFileSync(resolve(repoRoot, 'collector-desktop/installer/EISCore.Collector.iss'), 'utf8')
const readme = readFileSync(resolve(repoRoot, 'collector-desktop/README.md'), 'utf8')
const publishScriptPath = resolve(repoRoot, 'collector-desktop/scripts/publish-collector.ps1')

assert.match(
  publishScript,
  /\$downloadableExtensions = @\("\.exe", "\.msi", "\.zip"\)/,
  'publish script should only emit artifacts the collector update client can download'
)

assert.match(
  publishScript,
  /function Test-AbsoluteHttpUrl/,
  'publish script should validate manifest download base URLs before writing update.json'
)

assert.match(
  publishScript,
  /DownloadBaseUrl must be an absolute http or https URL when writing update manifest/,
  'publish script should reject relative or non-http manifest download base URLs'
)

assert.match(
  publishScript,
  /function Test-CollectorVersion[\s\S]*\$parts\.Count -lt 2 -or \$parts\.Count -gt 4[\s\S]*\^\[0-9\]\+\$/,
  'publish script should validate update manifest versions with the same dotted numeric shape as the collector client'
)

assert.match(
  publishScript,
  /Version must be 2 to 4 numeric dot-separated segments/,
  'publish script should fail fast when -Version cannot be consumed by the collector update client'
)

assert.match(
  publishScript,
  /\$installerExtensions = @\("\.exe", "\.msi"\)/,
  'publish script should only mark EXE/MSI artifacts as auto-installable'
)

assert.doesNotMatch(
  publishScript,
  /\$installerExtensions = @\([^)]*"\.(?:cmd|bat|msix)"/,
  'publish script should not treat cmd/bat/msix artifacts as client auto-installers'
)

assert.match(
  publishScript,
  /if \(-not \(\$downloadableExtensions -contains \$artifactExtension\)\) \{[\s\S]*Release artifact extension '\$artifactExtension' is not supported by the collector update client/,
  'publish script should fail fast for unsupported artifact extensions'
)

assert.match(
  publishScript,
  /if \(\$effectiveAutoInstall -and -not \$canAutoInstall\) \{[\s\S]*Manifest auto_install will be false\.[\s\S]*\$effectiveAutoInstall = \$false/,
  'publish script should disable manifest auto_install for downloadable-but-not-installable artifacts such as zip'
)

assert.match(
  publishScript,
  /installer_arguments = if \(\$canAutoInstall\) \{ \$InstallerArguments \} else \{ "" \}/,
  'publish script should only write installer_arguments for auto-installable artifacts'
)

assert.match(
  publishScript,
  /auto_install = \$effectiveAutoInstall/,
  'manifest auto_install should use the effective post-validation value'
)

assert.match(
  localReleaseScript,
  /\$expectedDownloadUrlPrefix = \(\$DownloadBaseUrl\.TrimEnd\('\/'\)\) \+ "\/"/,
  'local release verification should derive the expected artifact URL prefix from DownloadBaseUrl'
)

assert.match(
  localReleaseScript,
  /Manifest download_url must point inside the configured DownloadBaseUrl/,
  'local release verification should reject manifests pointing outside the configured release route'
)

assert.match(
  publishScript,
  /WindowStyle = "Hidden"/,
  'publish script auto-install should start the installer hidden for unattended release checks'
)

assert.match(
  innoScript,
  /AppMutex=EISCoreCollector_D7F10C50AD264D5785CBCB4AAEA36347/,
  'installer should declare the collector single-instance mutex so upgrades can close a running collector'
)

assert.match(
  innoScript,
  /CloseApplicationsFilter=\{#AppExeName\}/,
  'installer should target the collector executable when closing applications during upgrade'
)

assert.match(
  readme,
  /更新包只允许 `\.exe`、`\.msi` 或 `\.zip`；其中自动安装只允许 `\.exe` \/ `\.msi` 安装器。/,
  'README update package rules should stay aligned with the publish script and client policy'
)

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function toWindowsPath(wslPath) {
  const result = spawnSync('wslpath', ['-w', wslPath], { encoding: 'utf8' })
  assert.equal(
    result.status,
    0,
    `wslpath should convert ${wslPath}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  )
  return result.stdout.trim()
}

function parseJsonFromPowerShell(stdout) {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  assert.notEqual(start, -1, `PowerShell output should include JSON\n${stdout}`)
  assert.ok(end > start, `PowerShell output should include a complete JSON object\n${stdout}`)
  return JSON.parse(stdout.slice(start, end + 1))
}

function runPublishScript(args, { expectFailure = false } = {}) {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      toWindowsPath(publishScriptPath),
      ...args
    ],
    { encoding: 'utf8' }
  )

  if (expectFailure) {
    assert.notEqual(
      result.status,
      0,
      `publish script should fail\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    )
  } else {
    assert.equal(
      result.status,
      0,
      `publish script should succeed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    )
  }

  return result
}

function runPublishScriptExecutionSmoke() {
  const powerShellProbe = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
    { encoding: 'utf8' }
  )
  if (powerShellProbe.status !== 0) {
    console.warn('SKIP: publish script execution smoke requires Windows PowerShell from WSL')
    return
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'eiscore-collector-release-'))
  const downloadBaseUrl = 'https://nanpai.eissys.top/agent/document-intake/collector/releases'
  try {
    const exeBytes = Buffer.from('fake eiscore collector installer bytes\n', 'utf8')
    const exeFileName = 'EISCore.Collector-9.8.7-win-x64-setup.exe'
    const exePath = join(tempRoot, exeFileName)
    const exeOutputRoot = join(tempRoot, 'exe-output')
    const exeHash = sha256Hex(exeBytes)
    writeFileSync(exePath, exeBytes)

    const exeRun = runPublishScript([
      '-Version',
      '9.8.7',
      '-PackagePath',
      toWindowsPath(exePath),
      '-OutputRoot',
      toWindowsPath(exeOutputRoot),
      '-DownloadBaseUrl',
      downloadBaseUrl,
      '-InstallerArguments',
      '/VERYSILENT /NORESTART'
    ])
    const exeResult = parseJsonFromPowerShell(exeRun.stdout)
    const exeManifest = JSON.parse(readFileSync(join(exeOutputRoot, 'manifest/update.json'), 'utf8'))

    assert.equal(exeResult.version, '9.8.7')
    assert.equal(exeResult.artifactSha256, exeHash)
    assert.equal(exeResult.downloadUrl, `${downloadBaseUrl}/${exeFileName}`)
    assert.equal(exeResult.autoInstall, false)
    assert.equal(exeResult.autoInstallExecuted, false)
    assert.equal(exeManifest.version, '9.8.7')
    assert.equal(exeManifest.download_url, `${downloadBaseUrl}/${exeFileName}`)
    assert.equal(exeManifest.sha256, exeHash)
    assert.equal(exeManifest.mandatory, false)
    assert.equal(exeManifest.auto_install, false)
    assert.equal(exeManifest.installer_arguments, '/VERYSILENT /NORESTART')

    const relativeUrlRun = runPublishScript(
      [
        '-Version',
        '9.8.7',
        '-PackagePath',
        toWindowsPath(exePath),
        '-OutputRoot',
        toWindowsPath(join(tempRoot, 'bad-url-output')),
        '-DownloadBaseUrl',
        'collector/releases'
      ],
      { expectFailure: true }
    )
    assert.match(
      `${relativeUrlRun.stdout}\n${relativeUrlRun.stderr}`,
      /DownloadBaseUrl must be an absolute http or https URL when writing update manifest/,
      'relative DownloadBaseUrl should fail before writing update manifest'
    )

    const invalidVersionRun = runPublishScript(
      [
        '-Version',
        '9.x.0',
        '-PackagePath',
        toWindowsPath(exePath),
        '-OutputRoot',
        toWindowsPath(join(tempRoot, 'bad-version-output')),
        '-DownloadBaseUrl',
        downloadBaseUrl
      ],
      { expectFailure: true }
    )
    assert.match(
      `${invalidVersionRun.stdout}\n${invalidVersionRun.stderr}`,
      /Version must be 2 to 4 numeric dot-separated segments/,
      'non-numeric publish versions should fail before writing update manifest'
    )

    const zipBytes = Buffer.from('fake eiscore collector zip package bytes\n', 'utf8')
    const zipFileName = 'EISCore.Collector-9.8.8-win-x64.zip'
    const zipPath = join(tempRoot, zipFileName)
    const zipOutputRoot = join(tempRoot, 'zip-output')
    const zipHash = sha256Hex(zipBytes)
    writeFileSync(zipPath, zipBytes)

    const zipRun = runPublishScript([
      '-Version',
      '9.8.8',
      '-PackagePath',
      toWindowsPath(zipPath),
      '-OutputRoot',
      toWindowsPath(zipOutputRoot),
      '-DownloadBaseUrl',
      downloadBaseUrl,
      '-AutoInstall',
      '-InstallerArguments',
      'SHOULD_NOT_APPEAR'
    ])
    const zipResult = parseJsonFromPowerShell(zipRun.stdout)
    const zipManifest = JSON.parse(readFileSync(join(zipOutputRoot, 'manifest/update.json'), 'utf8'))
    const zipOutput = `${zipRun.stdout}\n${zipRun.stderr}`

    assert.match(
      zipOutput,
      /Manifest auto_install will be\s+false/,
      'zip PackagePath with AutoInstall should warn and disable manifest auto_install'
    )
    assert.equal(zipResult.version, '9.8.8')
    assert.equal(zipResult.artifactSha256, zipHash)
    assert.equal(zipResult.downloadUrl, `${downloadBaseUrl}/${zipFileName}`)
    assert.equal(zipResult.autoInstall, false)
    assert.equal(zipResult.autoInstallExecuted, false)
    assert.equal(zipManifest.sha256, zipHash)
    assert.equal(zipManifest.auto_install, false)
    assert.equal(zipManifest.installer_arguments, '')

    const cmdPath = join(tempRoot, 'EISCore.Collector-9.8.9-win-x64.cmd')
    writeFileSync(cmdPath, '@echo off\r\n')
    const unsupportedRun = runPublishScript(
      [
        '-Version',
        '9.8.9',
        '-PackagePath',
        toWindowsPath(cmdPath),
        '-OutputRoot',
        toWindowsPath(join(tempRoot, 'unsupported-output')),
        '-DownloadBaseUrl',
        downloadBaseUrl
      ],
      { expectFailure: true }
    )
    assert.match(
      `${unsupportedRun.stdout}\n${unsupportedRun.stderr}`,
      /Release artifact extension '.cmd' is not supported by the collector update client/,
      'unsupported PackagePath extensions should fail before manifest generation'
    )
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

runPublishScriptExecutionSmoke()

console.log('PASS: collector release script regression')
