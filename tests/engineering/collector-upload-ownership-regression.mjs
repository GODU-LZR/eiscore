// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const queueModels = readSource('collector-desktop/EISCore.Collector/Models/QueueModels.cs')
const queueStore = readSource('collector-desktop/EISCore.Collector/Services/UploadQueueStore.cs')
const fileService = readSource('collector-desktop/EISCore.Collector/Services/CollectorFileService.cs')
const watchFolderService = readSource('collector-desktop/EISCore.Collector/Services/WatchFolderService.cs')
const apiClient = readSource('collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs')
const mainWindow = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml.cs')
const appConfig = readSource('collector-desktop/EISCore.Collector/Models/AppConfig.cs')

for (const propertyName of ['UploadedByUserId', 'UploadedByUsername', 'UploadedByRole', 'OperatorSource', 'SourceFolder', 'WatchFolderSource']) {
  assert.match(
    queueModels,
    new RegExp(`public string ${propertyName} \\{ get; set; \\}`),
    `UploadQueueItem should keep ${propertyName} as a queue-time ownership snapshot.`
  )
}

assert.match(
  appConfig,
  /public sealed class WatchFolderConfig[\s\S]*public string DefaultUsername \{ get; set; \} = "";/,
  'WatchFolderConfig should keep an optional folder-level default username.'
)

for (const columnName of ['uploaded_by_user_id', 'uploaded_by_username', 'uploaded_by_role', 'operator_source', 'source_folder', 'watch_folder_source']) {
  assert.ok(
    queueStore.includes(columnName),
    `UploadQueueStore should persist ${columnName}.`
  )
}

for (const columnName of ['uploaded_by_username', 'uploaded_by_role', 'operator_source', 'source_folder', 'watch_folder_source']) {
  assert.match(
    queueStore,
    new RegExp(`EnsureColumnAsync\\(connection, "${columnName}"`),
    `UploadQueueStore should migrate existing SQLite queues with ${columnName}.`
  )
}

assert.match(
  fileService,
  /UploadedByUserId = config\.DefaultUserId/,
  'CollectorFileService should snapshot the user id when a file enters the queue.'
)
assert.match(
  fileService,
  /UploadedByUsername = config\.DefaultUsername/,
  'CollectorFileService should snapshot the username when a file enters the queue.'
)
assert.match(
  fileService,
  /UploadedByRole = config\.DefaultRole/,
  'CollectorFileService should snapshot the role when a file enters the queue.'
)
assert.match(
  fileService,
  /OperatorSource = uploadSource == "web_drag_drop" \? "web_login_user" : "device_default_user"/,
  'CollectorFileService should snapshot whether ownership came from WebView login or device defaults.'
)

assert.match(
  fileService,
  /WatchFolderConfig\? watchFolder = null/,
  'CollectorFileService should accept the triggering watch folder config.'
)

assert.match(
  fileService,
  /SourceFolder = \(watchFolder\?\.FolderPath \?\? ""\)\.Trim\(\)/,
  'CollectorFileService should snapshot the triggering source folder path.'
)

assert.match(
  fileService,
  /WatchFolderSource = NormalizeWatchFolderSource\(watchFolder\?\.Source\)/,
  'CollectorFileService should snapshot the triggering watch folder source.'
)

assert.match(
  mainWindow,
  /DefaultUsername = DefaultUsernameBox\.Text\.Trim\(\)/,
  'Locally added watch folders should snapshot the current default username.'
)

assert.match(
  mainWindow,
  /DefaultUsername = ResolveWatchFolderUsername\(item, _config\)/,
  'Remote watch folders should resolve a folder-level username when provided.'
)

assert.match(
  mainWindow,
  /DefaultUsername = ResolveWatchFolderUsername\(folder, _config\)/,
  'Watch folder normalization should preserve resolved default usernames.'
)

assert.match(
  mainWindow,
  /string\.Equals\(pair\.First\.DefaultUsername, pair\.Second\.DefaultUsername, StringComparison\.Ordinal\)/,
  'Watch folder equality should include the folder-level default username.'
)

for (const metadataField of [
  'uploaded_by_user_id = item.UploadedByUserId',
  'uploaded_by_username = item.UploadedByUsername',
  'uploaded_by_role = item.UploadedByRole',
  'operator_source = item.OperatorSource',
  'source_folder = item.SourceFolder',
  'watch_folder_source = item.WatchFolderSource'
]) {
  assert.ok(
    fileService.includes(metadataField),
    `CollectorFileService should include queue ownership in file_queued logs: ${metadataField}.`
  )
}

assert.match(
  watchFolderService,
  /private readonly ConcurrentDictionary<string, WatchFolderConfig> _watchFolderConfigs/,
  'WatchFolderService should keep the folder config associated with each watcher.'
)

assert.match(
  watchFolderService,
  /_watchFolderConfigs\[watcher\.Path\] = CloneWatchFolder\(folder\);/,
  'WatchFolderService should snapshot each folder config when starting a watcher.'
)

assert.match(
  watchFolderService,
  /QueuePath\(e\.FullPath, ResolveWatchFolder\(sender\)\)/,
  'WatchFolderService should route file events with the triggering folder config.'
)

assert.match(
  watchFolderService,
  /await _fileService\.EnqueueFileAsync\(path, "watch_folder", BuildQueueConfig\(_configProvider\(\), folder\), folder\);/,
  'WatchFolderService should enqueue watched files with folder-level ownership applied.'
)

for (const queueConfigToken of [
  'DefaultUserId = defaultUserId',
  'DefaultUsername = defaultUsername',
  'DefaultRole = FirstNonEmpty(folder.DefaultRole, config.DefaultRole)'
]) {
  assert.ok(
    watchFolderService.includes(queueConfigToken),
    `Folder-level queue config should set ${queueConfigToken}.`
  )
}

assert.match(
  watchFolderService,
  /default_username = folder\.DefaultUsername/,
  'Watch folder logs should include the folder-level default username.'
)

for (const assignment of [
  'uploaded_by_user_id = uploadedByUserId',
  'uploaded_by_username = uploadedByUsername',
  'uploaded_by_role = uploadedByRole',
  'operator_source = operatorSource',
  'source_folder = item.SourceFolder',
  'watch_folder_source = item.WatchFolderSource'
]) {
  assert.ok(
    apiClient.includes(assignment),
    `CollectorApiClient metadata should send queue snapshot assignment: ${assignment}.`
  )
}

for (const queueStoreToken of [
  'command.Parameters.AddWithValue("$source_folder", item.SourceFolder)',
  'command.Parameters.AddWithValue("$watch_folder_source", item.WatchFolderSource)',
  'SourceFolder = GetOptionalString(reader, "source_folder")',
  'WatchFolderSource = GetOptionalString(reader, "watch_folder_source")'
]) {
  assert.ok(
    queueStore.includes(queueStoreToken),
    `UploadQueueStore should persist source folder evidence: ${queueStoreToken}.`
  )
}

for (const fallback of [
  'item.UploadedByUserId) ? config.DefaultUserId : item.UploadedByUserId',
  'item.UploadedByUsername) ? config.DefaultUsername : item.UploadedByUsername',
  'item.UploadedByRole) ? config.DefaultRole : item.UploadedByRole'
]) {
  assert.ok(
    apiClient.includes(fallback),
    `CollectorApiClient should retain backward-compatible fallback: ${fallback}.`
  )
}

assert.match(
  mainWindow,
  /QueueList\.ItemsSource = items[\s\S]*\.Select\(FormatQueueItem\)/,
  'Queue list should use a dedicated formatter instead of hiding ownership metadata.'
)

for (const queueDisplayToken of [
  'FormatQueueOwner(item)',
  'item.UploadedByUsername',
  'item.UploadedByUserId',
  'item.UploadedByRole',
  'FormatUploadSource(item.UploadSource)',
  'FormatOperatorSource(item.OperatorSource)',
  '采集来源：',
  '责任人来源：',
  'FormatQueueSourceFolder(item)',
  'item.SourceFolder',
  'item.WatchFolderSource'
]) {
  assert.ok(
    mainWindow.includes(queueDisplayToken),
    `Queue list should display ownership evidence token: ${queueDisplayToken}.`
  )
}

assert.match(
  mainWindow,
  /"web_login_user" => "网页登录用户"/,
  'Queue list should label WebView login provenance clearly.'
)

assert.match(
  mainWindow,
  /"device_default_user" => "设备默认责任人"/,
  'Queue list should label device default provenance clearly.'
)

console.log('PASS: collector upload ownership queue snapshot regression')
