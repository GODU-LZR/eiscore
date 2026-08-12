// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const appConfig = readFileSync(resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/AppConfig.cs'), 'utf8')
const mainWindowXaml = readFileSync(resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml'), 'utf8')
const mainWindowCode = readFileSync(resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml.cs'), 'utf8')

assert.match(
  appConfig,
  /public const string DefaultServerBaseUrl = "https:\/\/nanpai\.eissys\.top";/,
  'collector should default to the production EISCore server'
)

assert.match(
  appConfig,
  /public string ServerBaseUrl\s*{\s*get;\s*set;\s*}\s*=\s*DefaultServerBaseUrl;/,
  'new collector configs should inherit the default server constant'
)

assert.match(
  mainWindowXaml,
  /<RowDefinition Height="44" \/>[\s\S]*<RowDefinition Height="\*" \/>/,
  'browser shell should keep a compact top bar and a filling browser row'
)

assert.match(
  mainWindowXaml,
  /<Button x:Name="SettingsButton"[\s\S]*ToolTip="设置"[\s\S]*<ui:SymbolIcon Symbol="Settings24"/,
  'top bar should expose settings through the gear icon'
)

assert.match(
  mainWindowXaml,
  /x:Name="ShellRuntimeStatusBadge"[\s\S]*x:Name="ShellRuntimeStatusDot"[\s\S]*x:Name="ShellRuntimeStatusText"[\s\S]*TextTrimming="CharacterEllipsis"/,
  'top bar should expose a compact runtime status pill that can trim long messages'
)

assert.match(
  mainWindowXaml,
  /<Grid Grid\.Row="1"[\s\S]*<wv2:WebView2\s+x:Name="Browser" \/>/,
  'WebView should fill the main window body'
)

assert.match(
  mainWindowXaml,
  /x:Name="WebViewFallbackPanel"[\s\S]*Visibility="Collapsed"[\s\S]*x:Name="WebViewFallbackMessageText"/,
  'browser body should include a collapsed local fallback panel for WebView startup failures'
)

assert.match(
  mainWindowXaml,
  /网页暂不可用[\s\S]*本地文件采集、上传队列和日志后台循环会继续运行[\s\S]*Content="重试打开网页"[\s\S]*Click="RetryBrowserNavigation_Click"[\s\S]*Content="打开设置"[\s\S]*Click="OpenRecoverySettings_Click"/,
  'fallback panel should explain that local collection continues and expose retry plus settings actions'
)

assert.match(
  mainWindowCode,
  /private async void RetryBrowserNavigation_Click\(object sender, RoutedEventArgs e\)[\s\S]*SetStatus\("正在重新打开网页\.\.\."\);[\s\S]*webview_navigation_retry_requested[\s\S]*_config\.ServerBaseUrl[\s\S]*_config\.DeviceStatus[\s\S]*webViewAvailable = Browser\.CoreWebView2 is not null[\s\S]*NavigateToConfiguredServer\(\);/,
  'fallback retry action should log operator intent and reuse the configured browser navigation path'
)

const navigateBlock = mainWindowCode.match(
  /private void NavigateToConfiguredServer\(\)([\s\S]*?)\n    private async Task<CollectorWebViewStartupResult>/
)?.[1]
assert.ok(navigateBlock, 'NavigateToConfiguredServer should exist')

assert.match(
  mainWindowCode,
  /using Microsoft\.Web\.WebView2\.Core;/,
  'collector should use WebView2 navigation completion event args for runtime navigation failures'
)

assert.match(
  mainWindowCode,
  /private void SetWebViewFallbackVisible\(bool visible, string\? message = null\)[\s\S]*WebViewFallbackPanel\.Visibility = visible \? Visibility\.Visible : Visibility\.Collapsed;[\s\S]*WebViewFallbackMessageText\.Text/,
  'collector should have a reusable WebView fallback visibility helper'
)

assert.match(
  mainWindowCode,
  /private string _lastStatusMessage = "正在初始化\.\.\.";/,
  'collector should keep the latest status message for the browser-shell status pill'
)

assert.match(
  mainWindowCode,
  /private void SetStatus\(string message\)[\s\S]*_lastStatusMessage = string\.IsNullOrWhiteSpace\(message\)[\s\S]*StatusText\.Text = \$"\{DateTime\.Now:HH:mm:ss\} \{_lastStatusMessage\}";[\s\S]*UpdateShellRuntimeStatus\(\);/,
  'settings status updates should also refresh the browser-shell runtime status'
)

assert.match(
  mainWindowCode,
  /private void UpdateShellRuntimeStatus\(\)[\s\S]*var statusText = BuildShellRuntimeStatusText\(\);[\s\S]*ShellRuntimeStatusText\.Text = statusText;[\s\S]*ShellRuntimeStatusBadge\.ToolTip = statusText;[\s\S]*ShellRuntimeStatusDot\.Fill = statusBrush;/,
  'browser-shell runtime status should update text, tooltip, and visible status dot'
)

assert.match(
  mainWindowCode,
  /private string BuildShellRuntimeStatusText\(\)[\s\S]*ResolveShellDeviceStatusText\(_config\)[\s\S]*监听 \{enabledWatchFolderCount\} 个目录[\s\S]*未配置监听目录[\s\S]*_lastStatusMessage/,
  'browser-shell runtime status should summarize device state, watch folders, and latest status'
)

assert.match(
  mainWindowCode,
  /private static string ResolveShellDeviceStatusText\(AppConfig config\)[\s\S]*设备已禁用[\s\S]*设备待绑定[\s\S]*设备未绑定[\s\S]*设备已绑定/,
  'browser-shell runtime status should translate common device states into operator-facing labels'
)

assert.match(
  mainWindowCode,
  /private static SolidColorBrush ResolveShellRuntimeStatusBrush\(AppConfig config\)[\s\S]*IsDeviceDisabled\(config\)[\s\S]*CollectorDeviceAccessPolicy\.IsPending\(config\)[\s\S]*string\.IsNullOrWhiteSpace\(config\.DeviceStatus\)/,
  'browser-shell runtime status should color-code disabled, pending, unbound, and active states'
)

assert.match(
  mainWindowCode,
  /private void LoadConfigToUi\(\)[\s\S]*UpdateBindingStatusHint\(\);[\s\S]*UpdateShellRuntimeStatus\(\);/,
  'loading settings should refresh the browser-shell runtime status from saved config'
)

assert.match(
  mainWindowCode,
  /private void ApplyCollectorRuntimeState\(bool logWhenDisabled = true\)[\s\S]*UpdateBindingStatusHint\(\);[\s\S]*UpdateShellRuntimeStatus\(\);/,
  'runtime-state application should refresh the browser-shell status when device state or watch folders change'
)

assert.match(
  mainWindowCode,
  /private bool ShowDeviceAccessFallbackIfNeeded\(\)[\s\S]*采集设备已被后台禁用，本地监听与上传已暂停。请联系管理员恢复设备后重试。[\s\S]*设备待绑定或认证已失效，本地监听与上传已暂停。请打开设置输入新的设备授权码并点击保存并绑定。/,
  'collector should show a browser-body recovery prompt when the device is disabled or needs rebinding'
)

assert.match(
  mainWindowCode,
  /private void AttachBrowserNavigationCompletedHandler\(\)[\s\S]*Browser\.CoreWebView2\.NavigationCompleted \+= Browser_NavigationCompleted;[\s\S]*_browserNavigationCompletedAttached = true;/,
  'collector should subscribe to WebView navigation completion once'
)

assert.match(
  mainWindowCode,
  /private void Browser_NavigationCompleted\(object\? sender, CoreWebView2NavigationCompletedEventArgs e\)[\s\S]*if \(ShowDeviceAccessFallbackIfNeeded\(\)\) return;[\s\S]*if \(e\.IsSuccess\)[\s\S]*SetWebViewFallbackVisible\(false\);[\s\S]*CollectorWebViewNavigationFailurePolicy\.Describe\([\s\S]*_config\.ServerBaseUrl[\s\S]*SetWebViewFallbackVisible\(true, navigationFailure\.StatusMessage\);[\s\S]*SetStatus\(navigationFailure\.DiagnosticMessage\);[\s\S]*webview_navigation_failed/,
  'failed WebView navigation should show the local fallback panel while successful navigation hides it unless binding state needs recovery'
)

assert.match(
  navigateBlock,
  /if \(ShowDeviceAccessFallbackIfNeeded\(\)\) return;[\s\S]*if \(Browser\.CoreWebView2 is null\)/,
  'browser navigation should not hide pending or disabled device recovery prompts'
)

assert.match(
  navigateBlock,
  /Browser\.CoreWebView2 is null[\s\S]*SetWebViewFallbackVisible\(true, "WebView 尚未可用，本地文件采集、上传队列和日志后台循环会继续运行。"\);/,
  'navigation should show the fallback panel if WebView is unavailable'
)

assert.match(
  navigateBlock,
  /AttachBrowserNavigationCompletedHandler\(\);[\s\S]*SetWebViewFallbackVisible\(false\);/,
  'navigation should attach the completion handler before starting browser navigation'
)

assert.match(
  navigateBlock,
  /_webViewLogBridge\.UpdateTrustedServerBaseUrl\(_config\.ServerBaseUrl\);/,
  'navigation should refresh the trusted WebView server origin'
)

assert.match(
  navigateBlock,
  /Uri\.TryCreate\(_config\.ServerBaseUrl, UriKind\.Absolute, out var uri\)[\s\S]*Browser\.CoreWebView2\.Navigate\(uri\.ToString\(\)\);/,
  'valid configured server URLs should be navigated by the WebView'
)

assert.match(
  navigateBlock,
  /Browser\.NavigateToString\("""[\s\S]*请先通过右上角设置配置服务器地址并绑定设备/,
  'empty or invalid server URLs should render a local setup hint instead of a blank page'
)

const startupBlock = mainWindowCode.match(
  /private async Task<CollectorWebViewStartupResult> InitializeWebViewShellAsync\(\)([\s\S]*?)\n    private async Task InitializeTrayIconAsync/
)?.[1]
assert.ok(startupBlock, 'InitializeWebViewShellAsync should exist')

assert.match(
  startupBlock,
  /await _webViewLogBridge\.InitializeAsync\(Browser, _config\);[\s\S]*NavigateToConfiguredServer\(\);[\s\S]*UpdateWebLoginOwnerUi\(_webViewLogBridge\.CurrentUploadOwner\);/,
  'startup should initialize WebView logging, navigate, and refresh login-owner UI'
)

assert.match(
  startupBlock,
  /SetWebViewFallbackVisible\(false\);[\s\S]*if \(result\.IsAvailable \|\| result\.Exception is null\)/,
  'successful WebView startup should keep the fallback panel hidden'
)

assert.match(
  startupBlock,
  /SetWebViewFallbackVisible\(true, result\.StatusMessage\);[\s\S]*webview_initialization_failed/,
  'failed WebView startup should show the local fallback panel and still log the failure'
)

const runtimeStateBlock = mainWindowCode.match(
  /private void ApplyCollectorRuntimeState\(bool logWhenDisabled = true\)([\s\S]*?)\n    private static bool IsDeviceDisabled/
)?.[1]
assert.ok(runtimeStateBlock, 'ApplyCollectorRuntimeState should exist')

assert.match(
  runtimeStateBlock,
  /IsDeviceDisabled\(_config\)[\s\S]*ShowDeviceAccessFallbackIfNeeded\(\);[\s\S]*CollectorDeviceAccessPolicy\.IsPending\(_config\)[\s\S]*ShowDeviceAccessFallbackIfNeeded\(\);/,
  'disabled and pending runtime states should surface the browser-body recovery prompt'
)

assert.match(
  mainWindowCode,
  /private void MainWindow_Closed\(object\? sender, EventArgs e\)[\s\S]*Browser\.CoreWebView2\.NavigationCompleted -= Browser_NavigationCompleted;[\s\S]*_browserNavigationCompletedAttached = false;/,
  'closing the collector should detach the WebView navigation completion handler'
)

const saveBlock = mainWindowCode.match(
  /private async void SaveConfig_Click\(object sender, RoutedEventArgs e\)([\s\S]*?)\n    private async void SyncWebLoginOwnerToDefault_Click/
)?.[1]
assert.ok(saveBlock, 'SaveConfig_Click should exist')

assert.match(
  saveBlock,
  /await _configurationService\.SaveAsync\(_config\);[\s\S]*_logService\.UpdateContext\(_config\);[\s\S]*ApplyCollectorRuntimeState\(\);[\s\S]*NavigateToConfiguredServer\(\);/,
  'saving settings should persist config, refresh runtime state, and reload the browser shell'
)

const bindBlock = mainWindowCode.match(
  /private async void BindDevice_Click\(object sender, RoutedEventArgs e\)([\s\S]*?)\n    private async void SaveConfig_Click/
)?.[1]
assert.ok(bindBlock, 'BindDevice_Click should exist')

assert.match(
  bindBlock,
  /await SyncRemoteConfigAsync\(\);[\s\S]*ApplyCollectorRuntimeState\(\);[\s\S]*CloseSettingsPopup\(\);[\s\S]*NavigateToConfiguredServer\(\);/,
  'successful binding should apply remote config, close recovery settings, and navigate the browser shell'
)

assert.doesNotMatch(
  bindBlock,
  /CloseSettingsPopup\(returnFocusToSettingsButton: true\);[\s\S]*NavigateToConfiguredServer\(\);/,
  'successful binding should not steal focus back to the gear before navigating the browser shell'
)

console.log('PASS: collector browser shell navigation regression')
