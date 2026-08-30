// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const xaml = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml')
const mainWindow = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml.cs')

assert.match(
  xaml,
  /x:Name="WebViewFallbackPanel"[\s\S]*Visibility="Collapsed"/,
  'The WebView fallback panel should exist and be hidden by default.'
)

assert.match(
  xaml,
  /x:Name="WebViewFallbackText"/,
  'The fallback panel should expose text that can show the WebView failure reason.'
)

assert.match(
  xaml,
  /Click="ShowSettings_Click"[\s\S]*Click="RetryWebView_Click"/,
  'The fallback panel should let users open settings and retry the browser.'
)

assert.match(
  mainWindow,
  /private async Task<bool> InitializeWebViewShellAsync\(\)[\s\S]*await _webViewLogBridge\.InitializeAsync\(Browser\);[\s\S]*await _webViewIdentityBridge\.InitializeAsync\(Browser\);[\s\S]*return true;/,
  'WebView startup should be isolated in a boolean-returning initializer.'
)

assert.match(
  mainWindow,
  /catch \(Exception ex\)[\s\S]*Browser\.Visibility = Visibility\.Collapsed;[\s\S]*WebViewFallbackPanel\.Visibility = Visibility\.Visible;[\s\S]*"webview_initialization_failed"[\s\S]*return false;/,
  'WebView initialization failures should show the fallback panel, log the failure, and return false.'
)

assert.match(
  mainWindow,
  /private async void RetryWebView_Click\(object sender, RoutedEventArgs e\)[\s\S]*InitializeWebViewShellAsync\(\)[\s\S]*NavigateToConfiguredServer\(\);/,
  'The retry button should reinitialize WebView and navigate after recovery.'
)

assert.match(
  mainWindow,
  /var webViewReady = await InitializeWebViewShellAsync\(\);[\s\S]*if \(webViewReady\)[\s\S]*NavigateToConfiguredServer\(\);[\s\S]*await SyncRemoteConfigAsync\(\);/,
  'Collector startup should attempt navigation only when WebView is ready, then continue startup.'
)

const startupIndex = mainWindow.indexOf('var webViewReady = await InitializeWebViewShellAsync();')
const syncIndex = mainWindow.indexOf('await SyncRemoteConfigAsync();', startupIndex)
const watcherIndex = mainWindow.indexOf('_watchFolderService.Restart(_config);', startupIndex)
const uploadIndex = mainWindow.indexOf('_uploadProcessor.Start();', startupIndex)
assert.notEqual(startupIndex, -1, 'Startup should call InitializeWebViewShellAsync.')
assert.ok(syncIndex > startupIndex, 'Remote config sync should still run after the WebView attempt.')
assert.ok(watcherIndex > syncIndex, 'Watch folders should still start after remote config sync.')
assert.ok(uploadIndex > watcherIndex, 'Upload processing should still start after watcher startup.')

console.log('PASS: collector WebView fallback regression')
