// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const mainWindow = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml.cs')
const identityBridge = readSource('collector-desktop/EISCore.Collector/Services/WebViewIdentityBridge.cs')
const userSnapshot = readSource('collector-desktop/EISCore.Collector/Models/WebLoginUserSnapshot.cs')
const fileService = readSource('collector-desktop/EISCore.Collector/Services/CollectorFileService.cs')

for (const propertyName of ['UserId', 'Username', 'DisplayName', 'Role']) {
  assert.match(
    userSnapshot,
    new RegExp(`public string ${propertyName} \\{ get; set; \\}`),
    `WebLoginUserSnapshot should expose ${propertyName}.`
  )
}

assert.match(
  identityBridge,
  /public sealed class WebViewIdentityBridge/,
  'A dedicated WebView identity bridge should exist.'
)

assert.match(
  identityBridge,
  /source: 'eiscoreCollectorIdentity'/,
  'Identity bridge should post a distinct identity message source.'
)

assert.match(
  identityBridge,
  /userStorageKeys = \['user_info', 'userInfo', 'current_user', 'currentUser', 'eiscore_user', 'eiscore_user_info'\]/,
  'Identity bridge should read common web user cache keys.'
)

assert.match(
  identityBridge,
  /tokenStorageKeys = \['auth_token', 'token', 'access_token', 'eiscore_auth_token'\]/,
  'Identity bridge should read common auth token keys only to decode the JWT payload.'
)

assert.match(
  identityBridge,
  /window\.sessionStorage/,
  'Identity bridge should also read sessionStorage for login caches.'
)

assert.match(
  identityBridge,
  /readStorageText\(tokenStorageKeys\)/,
  'Identity bridge should read auth tokens through the safe storage helper.'
)

assert.match(
  identityBridge,
  /decodeJwtPayload\(readAuthToken\(\)\)/,
  'Identity bridge should fall back to JWT payload fields when user_info is incomplete.'
)

assert.match(
  identityBridge,
  /availableStorages\(\)\.forEach\(installStorageHooks\)/,
  'Identity bridge should observe login-time writes in available browser storages.'
)

for (const roleField of [
  'user.sop_role',
  'user.job_role',
  'user.app_role',
  'user.role_code',
  'user.dbRole',
  'payload.sop_role',
  'payload.job_role',
  'payload.app_role',
  'payload.role_code',
  'payload.dbRole'
]) {
  assert.ok(
    identityBridge.includes(roleField),
    `Identity bridge should map role field ${roleField}.`
  )
}

for (const displayField of ['user.full_name', 'user.displayName', 'payload.fullName']) {
  assert.ok(
    identityBridge.includes(displayField),
    `Identity bridge should map display name field ${displayField}.`
  )
}

assert.match(
  identityBridge,
  /event\.key === null \|\| isIdentityStorageKey\(event\.key\)/,
  'Identity bridge should refresh on storage.clear() and relevant identity keys.'
)

assert.doesNotMatch(
  identityBridge,
  /window\.chrome\.webview\.postMessage\([^)]*token/i,
  'Identity bridge messages must not post raw auth tokens.'
)

assert.match(
  mainWindow,
  /private readonly WebViewIdentityBridge _webViewIdentityBridge;/,
  'MainWindow should own the identity bridge.'
)

assert.match(
  mainWindow,
  /_webViewIdentityBridge\.IdentityChanged \+= WebViewIdentityBridge_IdentityChanged;/,
  'MainWindow should subscribe to identity changes.'
)

assert.match(
  mainWindow,
  /await _webViewIdentityBridge\.InitializeAsync\(Browser\);/,
  'MainWindow should initialize the identity bridge for the WebView.'
)

assert.match(
  mainWindow,
  /private async void WebViewIdentityBridge_IdentityChanged\(object\? sender, WebLoginUserChangedEventArgs e\)[\s\S]*ApplyWebLoginUser\(e\.User\)/,
  'MainWindow should apply web login snapshots.'
)

for (const assignment of [
  '_config.DefaultUserId = value',
  '_config.DefaultUsername = value',
  '_config.DefaultRole = value'
]) {
  assert.ok(
    mainWindow.includes(assignment),
    `Web login sync should update ${assignment}.`
  )
}

assert.match(
  mainWindow,
  /await _configurationService\.SaveAsync\(_config\);[\s\S]*_logService\.UpdateContext\(_config\);[\s\S]*LoadConfigToUi\(\);/,
  'Web login sync should persist config, refresh log context, and refresh settings UI.'
)

assert.match(
  mainWindow,
  /"web_login_user_synced"/,
  'Web login sync should write a client log event.'
)

assert.match(
  mainWindow,
  /await EnqueueFilesAsync\(paths\.Where\(File\.Exists\), "web_drag_drop"\);/,
  'Window drag/drop should enqueue as web_drag_drop so uploads use web_login_user provenance.'
)

assert.match(
  fileService,
  /OperatorSource = uploadSource == "web_drag_drop" \? "web_login_user" : "device_default_user"/,
  'CollectorFileService should map web_drag_drop to web_login_user.'
)

console.log('PASS: collector WebView identity sync regression')
