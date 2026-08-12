// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const mainWindowXaml = readFileSync(resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml'), 'utf8')
const mainWindowCode = readFileSync(resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml.cs'), 'utf8')

assert.match(
  mainWindowXaml,
  /Title="EISCore"/,
  'collector window title should stay EISCore'
)

assert.match(
  mainWindowXaml,
  /<ui:SymbolIcon\s+Symbol="Settings24"/,
  'settings entry should remain a gear icon'
)

assert.match(
  mainWindowXaml,
  /<Grid Grid\.Row="1"[\s\S]*<wv2:WebView2\s+x:Name="Browser"/,
  'main WebView should remain the primary filled browser surface'
)

assert.match(
  mainWindowXaml,
  /PreviewKeyDown="SettingsPanel_PreviewKeyDown"/,
  'settings popup should handle keyboard close behavior'
)

assert.match(
  mainWindowCode,
  /private void SettingsButton_Click\(object sender, RoutedEventArgs e\)[\s\S]*OpenSettingsPopup\(FocusSettingsServerAddress\);/,
  'opening settings should focus the server address field'
)

assert.match(
  mainWindowCode,
  /private void OpenRecoverySettings_Click\(object sender, RoutedEventArgs e\)[\s\S]*OpenRecoverySettings\(\);/,
  'opening settings from the recovery panel should use the shared recovery settings path'
)

assert.match(
  mainWindowCode,
  /private void OpenRecoverySettings\(\)[\s\S]*OpenSettingsPopup\(FocusSettingsAuthorizationCode\);/,
  'recovery settings should focus the authorization code field'
)

assert.match(
  mainWindowCode,
  /private async Task HandleDeviceAuthenticationFailedAsync\(CollectorDeviceAuthException exception, string source\)[\s\S]*collector_device_auth_failed[\s\S]*SetStatus\("设备认证已失效，请重新绑定。"\);[\s\S]*OpenRecoverySettings\(\);/,
  'device authentication failures should automatically open recovery settings after surfacing the failure'
)

assert.match(
  mainWindowCode,
  /private void OpenSettingsPopup\(Action focusAction\)[\s\S]*SettingsPanel\.MaxHeight = Math\.Max\(360, ActualHeight - 96\);[\s\S]*RefreshHealthSnapshotUiAsync\(\);[\s\S]*SettingsPopup\.IsOpen = true;[\s\S]*focusAction\(\);/,
  'settings popup should share opening behavior and delegate the focus target'
)

assert.match(
  mainWindowCode,
  /private void CloseSettings_Click\(object sender, RoutedEventArgs e\)[\s\S]*CloseSettingsPopup\(returnFocusToSettingsButton: true\);/,
  'settings close button should close the popup and return focus to the gear button'
)

assert.match(
  mainWindowCode,
  /private void CloseSettingsPopup\(bool returnFocusToSettingsButton = false\)[\s\S]*SettingsPopup\.IsOpen = false;[\s\S]*if \(returnFocusToSettingsButton\)[\s\S]*SettingsButton\.Focus\(\);/,
  'settings popup should have a reusable close helper with optional focus restoration'
)

assert.match(
  mainWindowCode,
  /private void SettingsPanel_PreviewKeyDown\(object sender, System\.Windows\.Input\.KeyEventArgs e\)[\s\S]*e\.Key != System\.Windows\.Input\.Key\.Escape[\s\S]*CloseSettingsPopup\(returnFocusToSettingsButton: true\);[\s\S]*e\.Handled = true;/,
  'Escape should close the settings popup and return focus to the gear button'
)

assert.match(
  mainWindowCode,
  /private void FocusSettingsServerAddress\(\)[\s\S]*Dispatcher\.BeginInvoke[\s\S]*ServerBaseUrlBox\.Focus\(\);[\s\S]*ServerBaseUrlBox\.SelectAll\(\);/,
  'settings popup should asynchronously focus and select the server address'
)

assert.match(
  mainWindowCode,
  /private void FocusSettingsAuthorizationCode\(\)[\s\S]*Dispatcher\.BeginInvoke[\s\S]*AuthorizationCodeBox\.Focus\(\);[\s\S]*AuthorizationCodeBox\.SelectAll\(\);/,
  'recovery settings popup should asynchronously focus and select the authorization code'
)

console.log('PASS: collector settings popup regression')
