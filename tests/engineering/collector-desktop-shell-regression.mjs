// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const xaml = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml')
const codeBehind = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml.cs')
const appConfig = readSource('collector-desktop/EISCore.Collector/Models/AppConfig.cs')
const configurationService = readSource('collector-desktop/EISCore.Collector/Services/ConfigurationService.cs')
const watchFolderService = readSource('collector-desktop/EISCore.Collector/Services/WatchFolderService.cs')

assert.match(
  xaml,
  /Title="EISCore"/,
  'Desktop window title should be EISCore.'
)

assert.match(
  xaml,
  /<wv2:WebView2 x:Name="Browser"[\s\S]*\/>/,
  'The main browser WebView should remain the primary window body.'
)

assert.doesNotMatch(
  xaml,
  /<ColumnDefinition Width="340"/,
  'Settings should no longer be a permanent left sidebar.'
)

assert.match(
  xaml,
  /x:Name="SettingsOverlay"[\s\S]*Visibility="Collapsed"/,
  'Settings content should live in a hidden modal overlay by default.'
)

assert.match(
  xaml,
  /x:Name="SettingsOverlay"[\s\S]*Panel\.ZIndex="100"/,
  'Settings overlay should stay above the browser host.'
)

assert.match(
  xaml,
  /x:Name="Browser"[\s\S]*AllowDrop="True"[\s\S]*Drop="Window_Drop"/,
  'The browser surface should preserve file-drop handling.'
)

assert.match(
  xaml,
  /Click="ShowSettings_Click"[\s\S]*Text="&#xE713;"/,
  'The top bar should expose settings through a gear icon button.'
)

for (const controlName of [
  'ServerBaseUrlBox',
  'EnterpriseCodeBox',
  'DeviceCodeBox',
  'DeviceNameBox',
  'DefaultUserIdBox',
  'DefaultUsernameBox',
  'DefaultRoleBox',
  'AuthorizationCodeBox',
  'WatchFolderList',
  'QueueList'
]) {
  assert.ok(
    xaml.includes(`x:Name="${controlName}"`),
    `Settings overlay should keep existing control ${controlName}.`
  )
}

assert.match(
  codeBehind,
  /private void ShowSettings_Click\(object sender, RoutedEventArgs e\)[\s\S]*Browser\.Visibility = Visibility\.Collapsed;[\s\S]*SettingsOverlay\.Visibility = Visibility\.Visible;/,
  'Settings button should hide the browser host before showing the overlay.'
)

assert.match(
  codeBehind,
  /private void HideSettings_Click\(object sender, RoutedEventArgs e\)[\s\S]*SettingsOverlay\.Visibility = Visibility\.Collapsed;[\s\S]*Browser\.Visibility = _browserVisibilityBeforeSettings;/,
  'Close button should hide the overlay and restore the browser host.'
)

assert.match(
  codeBehind,
  /dialog\.ShowDialog\(this\)/,
  'Manual file selection should use the collector window as the dialog owner.'
)

assert.match(
  configurationService,
  /public const string DefaultServerBaseUrl = "https:\/\/nanpai\.eissys\.top";/,
  'Collector default server should point to the Nanpai remote.'
)

assert.match(
  configurationService,
  /if \(string\.IsNullOrWhiteSpace\(config\.ServerBaseUrl\)\)[\s\S]*config\.ServerBaseUrl = DefaultServerBaseUrl;/,
  'Blank or missing saved server config should normalize to the default remote.'
)

assert.match(
  appConfig,
  /public string Source \{ get; set; \} = WatchFolderSource\.LocalSettings;/,
  'Watch folder config should persist whether a folder came from local settings or remote config.'
)

assert.match(
  appConfig,
  /public const string LocalSettings = "local_settings";[\s\S]*public const string RemoteConfig = "remote_config";/,
  'Watch folder source constants should be stable for UI and logs.'
)

assert.match(
  codeBehind,
  /Source = WatchFolderSource\.LocalSettings/,
  'Locally added watch folders should be marked as local settings.'
)

assert.match(
  codeBehind,
  /Source = WatchFolderSource\.RemoteConfig/,
  'Remote watch folders should be marked as remote config.'
)

assert.match(
  codeBehind,
  /来源：\{FormatWatchFolderSource\(folder\.Source\)\}/,
  'Settings watch folder list should display the folder source.'
)

for (const label of ['远程下发 (remote_config)', '本机设置 (local_settings)']) {
  assert.ok(
    codeBehind.includes(label),
    `Settings watch folder list should expose source label ${label}.`
  )
}

assert.match(
  codeBehind,
  /NormalizeWatchFolderSource\(pair\.First\.Source\)[\s\S]*NormalizeWatchFolderSource\(pair\.Second\.Source\)/,
  'Remote config comparison should include watch folder source.'
)

assert.match(
  codeBehind,
  /Source = NormalizeWatchFolderSource\(folder\.Source\)/,
  'Watch folder normalization should preserve and normalize the source field.'
)

assert.match(
  watchFolderService,
  /watch_folder_source = string\.IsNullOrWhiteSpace\(folder\.Source\)[\s\S]*WatchFolderSource\.LocalSettings[\s\S]*folder\.Source\.Trim\(\)/,
  'Watcher start/error logs should record the watch folder source.'
)

console.log('PASS: collector desktop shell regression')
