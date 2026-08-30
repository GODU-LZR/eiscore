// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const queueStore = readSource('collector-desktop/EISCore.Collector/Services/UploadQueueStore.cs')
const mainWindow = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml.cs')

assert.match(
  queueStore,
  /public async Task<int> RecoverInterruptedUploadsAsync\(CancellationToken cancellationToken = default\)/,
  'UploadQueueStore should expose startup recovery for interrupted uploads.'
)

assert.match(
  queueStore,
  /UPDATE upload_queue[\s\S]*SET status = \$queued,[\s\S]*last_error = \$last_error[\s\S]*WHERE status IN \(\$uploading, \$hashing\)/,
  'Interrupted uploading or hashing rows should be moved back to queued with an explanatory last_error.'
)

assert.doesNotMatch(
  queueStore.match(/public async Task<int> RecoverInterruptedUploadsAsync[\s\S]*?\n    \}/)?.[0] || '',
  /retry_count\s*=/,
  'Queue recovery should not increment or reset retry_count.'
)

for (const statusName of ['Queued', 'Uploading', 'Hashing']) {
  assert.ok(
    queueStore.includes(`UploadQueueStatus.${statusName}`),
    `Queue recovery should refer to UploadQueueStatus.${statusName}.`
  )
}

assert.match(
  mainWindow,
  /await _queueStore\.EnsureCreatedAsync\(\);[\s\S]*_logService\.UpdateContext\(_config\);[\s\S]*await RecoverInterruptedUploadsAsync\(\);[\s\S]*await ReportPendingCrashDumpsAsync\(\);/,
  'MainWindow startup should recover interrupted uploads after loading config and before normal startup work.'
)

assert.match(
  mainWindow,
  /private async Task RecoverInterruptedUploadsAsync\(\)[\s\S]*_queueStore\.RecoverInterruptedUploadsAsync\(\)[\s\S]*"upload_queue_recovered"[\s\S]*"recovered_count"/,
  'MainWindow should log how many interrupted upload tasks were recovered.'
)

const recoverIndex = mainWindow.indexOf('await RecoverInterruptedUploadsAsync();')
const backgroundStartIndex = mainWindow.indexOf('StartAuthorizedBackgroundServices();', recoverIndex)
assert.notEqual(recoverIndex, -1, 'MainWindow should call RecoverInterruptedUploadsAsync.')
assert.ok(
  backgroundStartIndex > recoverIndex,
  'Interrupted uploads should be recovered before authorized background upload processing starts.'
)

console.log('PASS: collector queue recovery regression')
