using System.ComponentModel;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using EISCore.Collector.Models;
using EISCore.Collector.Services;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Forms = System.Windows.Forms;

namespace EISCore.Collector;

public partial class MainWindow : Window
{
    private readonly ConfigurationService _configurationService = new();
    private readonly CollectorApiClient _apiClient = new();
    private readonly UploadQueueStore _queueStore = new();
    private readonly ClientLogStore _logStore = new();
    private readonly ClientLogService _logService;
    private readonly UpdateService _updateService;
    private readonly DeviceBindingService _bindingService;
    private readonly CollectorFileService _fileService;
    private readonly WebViewLogBridge _webViewLogBridge;
    private readonly UploadQueueProcessor _uploadProcessor;
    private readonly LogUploadProcessor _logProcessor;
    private readonly WatchFolderService _watchFolderService;
    private readonly CollectorHealthSnapshotService _healthSnapshotService;
    private readonly DispatcherTimer _heartbeatTimer = new();
    private readonly CollectorReentrancyGate _heartbeatTickGate = new();
    private readonly CollectorReentrancyGate _webViewRetryGate = new();

    private AppConfig _config = new();
    private string _deviceToken = "";
    private Forms.NotifyIcon? _trayIcon;
    private bool _isExitRequested;
    private bool _isShutdownInProgress;
    private bool _isSessionEnding;
    private bool _isLoadingUi;
    private bool _browserNavigationCompletedAttached;
    private string _lastRemoteCallUnavailableKey = "";
    private string _lastAutoStartFailureSignature = "";
    private string _lastAutoStartReadFailureSignature = "";
    private string _bindingStatusHintOverride = "";
    private string _bindingStatusHintForeground = "";
    private string _lastStatusMessage = "正在初始化...";

    public MainWindow()
    {
        InitializeComponent();

        _logService = new ClientLogService(_logStore);
        _updateService = new UpdateService(_logService);
        _bindingService = new DeviceBindingService(_apiClient, _configurationService);
        _fileService = new CollectorFileService(_queueStore, _logService);
        _webViewLogBridge = new WebViewLogBridge(_logService);
        _uploadProcessor = new UploadQueueProcessor(
            _queueStore,
            _apiClient,
            _logService,
            () => _config,
            () => _deviceToken,
            (exception, source, _) => HandleDeviceAuthenticationFailedAsync(exception, source));
        _logProcessor = new LogUploadProcessor(
            _logStore,
            _apiClient,
            () => _config,
            () => _deviceToken,
            (exception, source, _) => HandleDeviceAuthenticationFailedAsync(exception, source),
            _logService);
        _watchFolderService = new WatchFolderService(_fileService, _logService, () => _config);
        _healthSnapshotService = new CollectorHealthSnapshotService(_queueStore, _logStore);

        Loaded += MainWindow_Loaded;
        Closed += MainWindow_Closed;
        _webViewLogBridge.UploadOwnerChanged += WebViewLogBridge_UploadOwnerChanged;
        _fileService.QueueChanged += QueueChanged;
        _uploadProcessor.QueueChanged += QueueChanged;
        _logService.HighPriorityLogWritten += LogService_HighPriorityLogWritten;
        SystemEvents.SessionEnding += SystemEvents_SessionEnding;
        _heartbeatTimer.Interval = TimeSpan.FromMinutes(1);
        _heartbeatTimer.Tick += HeartbeatTimer_Tick;
    }

    private void SettingsButton_Click(object sender, RoutedEventArgs e)
    {
        OpenSettingsPopup(FocusSettingsServerAddress);
    }

    private void OpenRecoverySettings_Click(object sender, RoutedEventArgs e)
    {
        OpenRecoverySettings();
    }

    private void OpenRecoverySettings()
    {
        OpenSettingsPopup(FocusSettingsAuthorizationCode);
    }

    private void OpenSettingsPopup(Action focusAction)
    {
        SettingsPanel.MaxHeight = Math.Max(360, ActualHeight - 96);
        _ = RefreshHealthSnapshotUiAsync();
        SettingsPopup.IsOpen = true;
        focusAction();
    }

    private void CloseSettings_Click(object sender, RoutedEventArgs e)
    {
        CloseSettingsPopup(returnFocusToSettingsButton: true);
    }

    private void CloseSettingsPopup(bool returnFocusToSettingsButton = false)
    {
        SettingsPopup.IsOpen = false;
        if (returnFocusToSettingsButton)
        {
            SettingsButton.Focus();
        }
    }

    private async void RetryBrowserNavigation_Click(object sender, RoutedEventArgs e)
    {
        if (!_webViewRetryGate.TryEnter())
        {
            SetStatus("正在重试打开网页，请稍候...");
            return;
        }

        var previousContent = RetryBrowserNavigationButton.Content;
        try
        {
            RetryBrowserNavigationButton.IsEnabled = false;
            RetryBrowserNavigationButton.Content = "正在重试...";
            SetStatus("正在重新打开网页...");
            CollectorBackgroundTask.Forget(LogBestEffortAsync(
                "info",
                "webview_navigation_retry_requested",
                "用户请求重试打开网页。",
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    _config.ServerBaseUrl,
                    _config.DeviceStatus,
                    webViewAvailable = Browser.CoreWebView2 is not null
                })));

            if (Browser.CoreWebView2 is null)
            {
                var startup = await InitializeWebViewShellAsync();
                if (!startup.IsAvailable)
                {
                    SetStatus(startup.StatusMessage);
                    return;
                }

                if (CollectorDeviceAccessPolicy.CanRunCollection(_config))
                {
                    SetStatus("网页已重新打开。");
                }
                return;
            }

            NavigateToConfiguredServer();
            if (CollectorDeviceAccessPolicy.CanRunCollection(_config))
            {
                SetStatus("网页已重新打开。");
            }
        }
        finally
        {
            RetryBrowserNavigationButton.Content = previousContent;
            RetryBrowserNavigationButton.IsEnabled = true;
            _webViewRetryGate.Exit();
        }
    }

    private void SettingsPanel_PreviewKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key != System.Windows.Input.Key.Escape) return;

        CloseSettingsPopup(returnFocusToSettingsButton: true);
        e.Handled = true;
    }

    private void FocusSettingsServerAddress()
    {
        Dispatcher.BeginInvoke(new Action(() =>
        {
            if (!SettingsPopup.IsOpen) return;

            ServerBaseUrlBox.Focus();
            ServerBaseUrlBox.SelectAll();
        }), DispatcherPriority.Input);
    }

    private void FocusSettingsAuthorizationCode()
    {
        Dispatcher.BeginInvoke(new Action(() =>
        {
            if (!SettingsPopup.IsOpen) return;

            AuthorizationCodeBox.Focus();
            AuthorizationCodeBox.SelectAll();
        }), DispatcherPriority.Input);
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        var shouldStartMinimized = StartupService.ShouldStartMinimized(Environment.GetCommandLineArgs().Skip(1));
        try
        {
            await _queueStore.EnsureCreatedAsync();
            await _logStore.EnsureCreatedAsync();

            _config = await _configurationService.LoadAsync();
            if (SyncClientVersion())
            {
                await _configurationService.SaveAsync(_config);
            }
            _deviceToken = _configurationService.UnprotectToken(_config.EncryptedDeviceToken);
            _logService.UpdateContext(_config);
            await RecoverInterruptedUploadsAsync();
            await ReportPendingCrashDumpsAsync();
            await PruneReportedCrashDumpsAsync();

            LoadConfigToUi();
            await InitializeTrayIconAsync();

            var webViewStartup = await InitializeWebViewShellAsync();
            await SendHeartbeatAndApplyResponseAsync();
            await SyncRemoteConfigAsync();
            if (await CheckForUpdatesAsync()) return;

            ApplyCollectorRuntimeState(logWhenDisabled: false);
            _uploadProcessor.Start();
            _logProcessor.Start();
            UpdateHeartbeatTimerInterval();
            _heartbeatTimer.Start();

            await LogBestEffortAsync("info", "collector_start", "采集端启动。");
            await RefreshQueueAsync();
            SetStatus(webViewStartup.StatusMessage);
            HideWhenStartedMinimized(shouldStartMinimized);
        }
        catch (Exception ex)
        {
            SetStatus("初始化失败：" + ex.Message);
            await LogBestEffortAsync("error", "collector_start_failed", "采集端初始化失败。", ex.ToString());
        }
    }

    private async void BindDevice_Click(object sender, RoutedEventArgs e)
    {
        var shouldClearAuthorizationCode = false;
        var bindingIdentity = CollectorBindingIdentityPolicy.Capture(_config);
        var bindingInvalidated = false;
        try
        {
            var preflight = CollectorBindPreflightPolicy.Evaluate(ServerBaseUrlBox.Text, AuthorizationCodeBox.Password);
            if (!preflight.CanBind)
            {
                SetStatus(preflight.StatusMessage);
                SetBindingStatusHintOverride(preflight.StatusMessage, "#B45309");
                return;
            }

            UpdateConfigFromUi();
            shouldClearAuthorizationCode = preflight.ShouldClearAuthorizationCode;
            bindingInvalidated = CollectorBindingIdentityPolicy.InvalidateIfIdentityChanged(bindingIdentity, _config);
            if (bindingInvalidated)
            {
                _deviceToken = "";
                _logService.UpdateContext(_config);
            }

            SetStatus("正在绑定设备...");
            SetBindingStatusHintOverride("正在绑定设备，请稍候...", "#2563EB");
            _config = await _bindingService.BindAsync(_config, preflight.AuthorizationCode);
            _deviceToken = _configurationService.UnprotectToken(_config.EncryptedDeviceToken);
            _logService.UpdateContext(_config);
            ClearBindingStatusHintOverride();
            LoadConfigToUi();
            await SyncRemoteConfigAsync();
            if (await CheckForUpdatesAsync(force: true)) return;
            ApplyCollectorRuntimeState();
            CloseSettingsPopup();
            NavigateToConfiguredServer();
            await LogBestEffortAsync("info", "collector_bound", "设备绑定成功。");
            SetStatus("设备绑定成功。");
        }
        catch (Exception ex)
        {
            Exception? invalidatedStateSaveException = null;
            if (bindingInvalidated)
            {
                invalidatedStateSaveException = await CollectorConfigSavePolicy.TrySaveBestEffortAsync(
                    _config,
                    config => _configurationService.SaveAsync(config));
                LoadConfigToUi();
                ApplyCollectorRuntimeState(logWhenDisabled: false);
            }

            var failure = CollectorBindFailurePolicy.Describe(ex);
            SetBindingStatusHintOverride(failure.UserMessage, "#B91C1C");
            if (invalidatedStateSaveException is not null)
            {
                await LogBestEffortAsync(
                    "warn",
                    "collector_bind_invalidated_state_save_failed",
                    "设备身份变更后的待绑定状态保存失败，当前进程已清空内存 token 并停止采集。",
                    invalidatedStateSaveException.ToString(),
                    metadataJson: ClientLogMetadata.Serialize(new
                    {
                        failure.FailureKind,
                        source = "bind",
                        exceptionType = invalidatedStateSaveException.GetType().Name,
                        _config.DeviceId,
                        _config.DeviceCode,
                        _config.ServerBaseUrl,
                        _config.DeviceStatus
                    }));
            }

            SetStatus(failure.UserMessage);
            await LogBestEffortAsync(
                "error",
                "collector_bind_failed",
                failure.UserMessage,
                ex.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    failure.FailureKind,
                    failure.StatusCode,
                    _config.DeviceId,
                    _config.DeviceCode,
                    _config.ServerBaseUrl
                }));
        }
        finally
        {
            if (shouldClearAuthorizationCode)
            {
                AuthorizationCodeBox.Clear();
            }
        }
    }

    private async void SaveConfig_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var saveState = CollectorConfigSavePolicy.Evaluate(ServerBaseUrlBox.Text);
            if (!saveState.CanSave)
            {
                SetStatus(saveState.StatusMessage);
                return;
            }

            var bindingIdentity = CollectorBindingIdentityPolicy.Capture(_config);
            UpdateConfigFromUi();
            var bindingInvalidated = CollectorBindingIdentityPolicy.InvalidateIfIdentityChanged(bindingIdentity, _config);
            if (bindingInvalidated)
            {
                _deviceToken = "";
                SetBindingStatusHintOverride("设备身份配置已变更，请输入新的设备授权码并点击保存并绑定。", "#B45309");
            }

            await _configurationService.SaveAsync(_config);
            _logService.UpdateContext(_config);
            ApplyCollectorRuntimeState();
            NavigateToConfiguredServer();
            SetStatus(bindingInvalidated ? "设备身份配置已变更，请重新绑定。" : "配置已保存。");
        }
        catch (Exception ex)
        {
            SetStatus("保存配置失败：" + ex.Message);
            await LogBestEffortAsync("error", "collector_config_save_failed", "保存配置失败。", ex.ToString());
        }
    }

    private async void SyncWebLoginOwnerToDefault_Click(object sender, RoutedEventArgs e)
    {
        SyncWebLoginOwnerButton.IsEnabled = false;
        try
        {
            var owner = _webViewLogBridge.CurrentUploadOwner;
            if (!owner.HasContext)
            {
                SetStatus("正在从当前网页刷新登录用户...");
                await TryProbeWebLoginOwnerAsync();
                owner = _webViewLogBridge.CurrentUploadOwner;
            }

            if (!owner.HasContext)
            {
                SetStatus("尚未获取当前网页登录用户，请先在右侧登录后重试。");
                return;
            }

            var changed = ApplyWebLoginOwnerToDefaultFields(owner, overwrite: true);
            if (changed)
            {
                await _configurationService.SaveAsync(_config);
                _logService.UpdateContext(_config);
                SetStatus("已将网页登录用户写入默认上传配置并保存。");
                return;
            }

            SetStatus("网页登录用户已是当前默认上传配置。");
        }
        catch (Exception ex)
        {
            SetStatus("同步网页登录用户失败：" + ex.Message);
            await LogBestEffortAsync("warn", "collector_web_login_owner_sync_failed", "同步网页登录用户到默认上传配置失败。", ex.ToString());
        }
        finally
        {
            UpdateWebLoginOwnerUi(_webViewLogBridge.CurrentUploadOwner);
        }
    }

    private void ChooseWatchFolder_Click(object sender, RoutedEventArgs e)
    {
        using var dialog = new Forms.FolderBrowserDialog
        {
            Description = "选择 EISCore 采集监听目录",
            UseDescriptionForTitle = true
        };

        if (dialog.ShowDialog() != Forms.DialogResult.OK) return;

        var folderPath = ConfigurationService.NormalizeText(dialog.SelectedPath, 1024);
        var folderKey = ConfigurationService.NormalizeWatchFolderKey(folderPath);
        var existing = _config.WatchFolders.FirstOrDefault(item =>
            string.Equals(ConfigurationService.NormalizeWatchFolderKey(item.FolderPath), folderKey, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.Enabled = true;
            existing.DefaultUserId = string.IsNullOrWhiteSpace(existing.DefaultUserId)
                ? ConfigurationService.NormalizeText(DefaultUserIdBox.Text, 128)
                : existing.DefaultUserId;
            existing.DefaultUsername = string.IsNullOrWhiteSpace(existing.DefaultUsername)
                ? ConfigurationService.NormalizeText(DefaultUsernameBox.Text, 120)
                : existing.DefaultUsername;
            existing.DefaultRole = string.IsNullOrWhiteSpace(existing.DefaultRole)
                ? ConfigurationService.NormalizeText(DefaultRoleBox.Text, 80)
                : existing.DefaultRole;
        }
        else
        {
            _config.WatchFolders.Add(
                new WatchFolderConfig
                {
                    FolderPath = folderPath,
                    FolderName = GetFolderDisplayName(folderPath),
                    DefaultUserId = ConfigurationService.NormalizeText(DefaultUserIdBox.Text, 128),
                    DefaultUsername = ConfigurationService.NormalizeText(DefaultUsernameBox.Text, 120),
                    DefaultRole = ConfigurationService.NormalizeText(DefaultRoleBox.Text, 80),
                    Enabled = true
                });
        }

        NormalizeWatchFolders();
        SetStatus("监听目录已添加，保存配置后持久化。");
        _ = RefreshHealthSnapshotUiAsync();
    }

    private void RemoveWatchFolder_Click(object sender, RoutedEventArgs e)
    {
        var index = WatchFolderList.SelectedIndex;
        if (index < 0 || index >= _config.WatchFolders.Count)
        {
            SetStatus("请选择要移除的监听目录。");
            return;
        }

        var removed = _config.WatchFolders[index];
        _config.WatchFolders.RemoveAt(index);
        RefreshWatchFolderList();
        SetStatus($"已移除监听目录：{removed.FolderPath}");
        _ = RefreshHealthSnapshotUiAsync();
    }

    private void ToggleWatchFolder_Click(object sender, RoutedEventArgs e)
    {
        var index = WatchFolderList.SelectedIndex;
        if (index < 0 || index >= _config.WatchFolders.Count)
        {
            SetStatus("请选择要启用或停用的监听目录。");
            return;
        }

        var folder = _config.WatchFolders[index];
        folder.Enabled = !folder.Enabled;
        RefreshWatchFolderList(index);
        SetStatus(folder.Enabled ? "监听目录已启用。" : "监听目录已停用。");
        _ = RefreshHealthSnapshotUiAsync();
    }

    private void RefreshWatchFolderList(int selectedIndex = -1)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(() => RefreshWatchFolderList(selectedIndex));
            return;
        }

        _config.WatchFolders ??= new List<WatchFolderConfig>();
        WatchFolderList.ItemsSource = _config.WatchFolders
            .Select((folder, index) => WatchFolderDisplayPolicy.Format(folder, index))
            .ToList();

        if (selectedIndex >= 0 && selectedIndex < WatchFolderList.Items.Count)
        {
            WatchFolderList.SelectedIndex = selectedIndex;
        }
    }

    private void RestartWatchers_Click(object sender, RoutedEventArgs e)
    {
        if (!TryUpdateConfigFromUiForRuntimeAction()) return;

        var restartState = CollectorWatchFolderRestartPolicy.Evaluate(_config);
        ApplyCollectorRuntimeState(logWhenDisabled: false);
        SetStatus(restartState.StatusMessage);
        _ = RefreshHealthSnapshotUiAsync();
    }

    private async void ChooseFiles_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var dialog = new Microsoft.Win32.OpenFileDialog
            {
                Title = "选择要采集的文件",
                Multiselect = true,
                Filter = "业务资料|*.xlsx;*.xls;*.csv;*.docx;*.doc;*.pdf;*.jpg;*.jpeg;*.png;*.bmp;*.gif;*.webp;*.txt;*.zip;*.rar;*.7z|所有文件|*.*"
            };

            if (dialog.ShowDialog() != true) return;
            await EnqueueFilesAsync(dialog.FileNames, "manual_selected_file");
        }
        catch (Exception ex)
        {
            SetStatus("选择文件失败：" + ex.Message);
            await LogBestEffortAsync("error", "manual_file_select_failed", "手动选择文件失败。", ex.ToString());
        }
    }

    private async void ProcessQueue_Click(object sender, RoutedEventArgs e)
    {
        if (!TryUpdateConfigFromUiForRuntimeAction()) return;

        var uploadState = CollectorManualUploadPolicy.Evaluate(_config, _deviceToken);
        SetStatus(uploadState.StatusMessage);
        if (!uploadState.CanProcess)
        {
            return;
        }

        try
        {
            var result = await _uploadProcessor.ProcessOnceAsync();
            await RefreshQueueAsync();
            SetStatus(result.StatusMessage);
        }
        catch (Exception ex)
        {
            SetStatus("上传队列处理失败：" + ex.Message);
            await LogBestEffortAsync("error", "upload_queue_manual_process_failed", "手动处理上传队列失败。", ex.ToString());
        }
    }

    private async void RefreshServerStatuses_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (!TryUpdateConfigFromUiForRuntimeAction()) return;
            var refreshed = await RefreshServerUploadStatusesAsync();
            await RefreshQueueAsync();
            SetStatus(refreshed > 0
                ? $"已刷新 {refreshed} 个服务端处理状态。"
                : "暂无可刷新的服务端处理状态。");
        }
        catch (Exception ex)
        {
            SetStatus("刷新服务端状态失败：" + ex.Message);
            await LogBestEffortAsync("warn", "server_upload_status_refresh_failed", "刷新服务端处理状态失败。", ex.ToString());
        }
    }

    private async void AutoStartBox_Changed(object sender, RoutedEventArgs e)
    {
        if (_isLoadingUi) return;

        var previousEnabled = _config.AutoStartEnabled;
        var requestedEnabled = AutoStartBox.IsChecked == true;
        var autoStartApplied = false;
        try
        {
            var autoStartResult = CollectorAutoStartPolicy.Apply(
                previousEnabled,
                requestedEnabled,
                StartupService.SetEnabled);
            if (!autoStartResult.Applied)
            {
                RestoreAutoStartCheckBox(previousEnabled);
                await LogAutoStartApplyFailedOnceAsync(requestedEnabled, "manual", autoStartResult.Exception);
                SetStatus("更新开机自启失败：" + autoStartResult.Exception?.Message);
                return;
            }

            _config.AutoStartEnabled = requestedEnabled;
            autoStartApplied = true;
            _lastAutoStartFailureSignature = "";
            await _configurationService.SaveAsync(_config);
            SetStatus(_config.AutoStartEnabled ? "已启用开机自启。" : "已关闭开机自启。");
        }
        catch (Exception ex)
        {
            if (!autoStartApplied)
            {
                RestoreAutoStartCheckBox(previousEnabled);
            }

            SetStatus("更新开机自启失败：" + ex.Message);
            await LogBestEffortAsync("error", "collector_autostart_failed", "更新开机自启失败。", ex.ToString());
        }
    }

    private void RestoreAutoStartCheckBox(bool enabled)
    {
        _isLoadingUi = true;
        try
        {
            AutoStartBox.IsChecked = enabled;
        }
        finally
        {
            _isLoadingUi = false;
        }
    }

    private void ConfigTextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        if (_isLoadingUi) return;
        SetStatus("配置已修改，保存后生效。");
    }

    private void Window_DragOver(object sender, System.Windows.DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(System.Windows.DataFormats.FileDrop)
            ? System.Windows.DragDropEffects.Copy
            : System.Windows.DragDropEffects.None;
        e.Handled = true;
    }

    private async void Window_Drop(object sender, System.Windows.DragEventArgs e)
    {
        try
        {
            if (!e.Data.GetDataPresent(System.Windows.DataFormats.FileDrop)) return;
            if (e.Data.GetData(System.Windows.DataFormats.FileDrop) is not string[] paths) return;

            e.Handled = true;
            var webOwner = _webViewLogBridge.CurrentUploadOwner;
            await EnqueueFilesAsync(paths.Where(File.Exists), CollectorDropUploadSourcePolicy.Resolve(webOwner), webOwner);
        }
        catch (Exception ex)
        {
            SetStatus("拖拽文件入队失败：" + ex.Message);
            await LogBestEffortAsync("error", "manual_drag_drop_failed", "拖拽文件入队失败。", ex.ToString());
        }
    }

    private async void HeartbeatTimer_Tick(object? sender, EventArgs e)
    {
        if (!_heartbeatTickGate.TryEnter())
        {
            return;
        }

        try
        {
            await SendHeartbeatAndApplyResponseAsync();
            await SyncRemoteConfigAsync();
            if (await CheckForUpdatesAsync()) return;
            await _logProcessor.FlushAsync();
            var refreshed = await RefreshServerUploadStatusesAsync();
            if (refreshed > 0)
            {
                await RefreshQueueAsync();
            }
            await RefreshHealthSnapshotUiAsync();
        }
        catch (Exception ex)
        {
            await LogBestEffortAsync("warn", "collector_heartbeat_failed", "采集端心跳上报失败。", ex.ToString());
        }
        finally
        {
            _heartbeatTickGate.Exit();
        }
    }

    private async void QueueChanged(object? sender, EventArgs e)
    {
        try
        {
            await RefreshQueueAsync();
        }
        catch (Exception ex)
        {
            SetStatus("上传队列刷新失败：" + ex.Message);
            await LogBestEffortAsync("warn", "upload_queue_refresh_failed", "上传队列刷新失败。", ex.ToString());
        }
    }

    private async void WebViewLogBridge_UploadOwnerChanged(object? sender, UploadOwnerContext owner)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(() => CollectorBackgroundTask.Forget(ApplyWebLoginOwnerChangedAsync(owner)));
            return;
        }

        await ApplyWebLoginOwnerChangedAsync(owner);
    }

    private async Task ApplyWebLoginOwnerChangedAsync(UploadOwnerContext owner)
    {
        UpdateWebLoginOwnerUi(owner);
        if (ApplyWebLoginOwnerToDefaultFields(owner, overwrite: false))
        {
            try
            {
                await _configurationService.SaveAsync(_config);
                _logService.UpdateContext(_config);
                UpdateWebLoginOwnerUi(owner);
                SetStatus("已从网页登录同步缺失的默认上传人或租户字段并自动保存。");
            }
            catch (Exception ex)
            {
                SetStatus("已从网页登录同步默认上传人，但自动保存失败：" + ex.Message);
                await LogBestEffortAsync(
                    "warn",
                    "collector_web_login_owner_auto_save_failed",
                    "网页登录用户自动同步到默认上传配置后保存失败。",
                    ex.ToString());
            }
        }
    }

    private async void LogService_HighPriorityLogWritten(object? sender, EventArgs e)
    {
        try
        {
            if (!_config.HighPriorityLogImmediate) return;
            await _logProcessor.FlushAsync();
        }
        catch
        {
            // The log remains in SQLite and will be retried by the background loop.
        }
    }

    private async Task EnqueueFilesAsync(
        IEnumerable<string> paths,
        string uploadSource,
        UploadOwnerContext? webOwnerSnapshot = null)
    {
        try
        {
            if (!TryUpdateConfigFromUiForRuntimeAction()) return;

            var fileList = paths.Where(File.Exists).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (fileList.Count == 0) return;

            var webOwner = webOwnerSnapshot ?? _webViewLogBridge.CurrentUploadOwner;
            SetStatus($"正在入队 {fileList.Count} 个文件...");
            var acceptedCount = 0;
            foreach (var filePath in fileList)
            {
                var queued = await _fileService.EnqueueFileAsync(filePath, uploadSource, _config, webOwner: webOwner);
                if (queued is not null)
                {
                    acceptedCount++;
                }
            }

            await RefreshQueueAsync();
            SetStatus(CollectorFileBatchStatusPolicy.Format(fileList.Count, acceptedCount));
        }
        catch (Exception ex)
        {
            SetStatus("文件入队失败：" + ex.Message);
            await LogBestEffortAsync(
                "error",
                "file_enqueue_batch_failed",
                "文件批量入队失败。",
                ex.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new { uploadSource }));
        }
    }

    private async Task ReportPendingCrashDumpsAsync()
    {
        foreach (var manifestPath in CrashDumpService.ListUnreportedManifests())
        {
            try
            {
                var manifestText = await File.ReadAllTextAsync(manifestPath);
                using var doc = JsonDocument.Parse(manifestText);
                var root = doc.RootElement;
                var source = GetJsonString(root, "source");
                var exceptionType = GetJsonString(root, "exceptionType");
                var message = GetJsonString(root, "message");
                var stack = GetJsonString(root, "stack");
                var dumpPath = GetJsonString(root, "dumpPath");
                var createdAt = GetJsonString(root, "createdAt");
                var dumpBytes = root.TryGetProperty("dumpBytes", out var dumpBytesElement) && dumpBytesElement.TryGetInt64(out var bytes)
                    ? bytes
                    : 0L;

                await _logService.LogAsync(
                    "error",
                    "collector_crash_dump",
                    $"检测到上次运行崩溃：{exceptionType} {message}",
                    stack,
                    metadataJson: JsonSerializer.Serialize(new
                    {
                        manifest_path = manifestPath,
                        dump_path = dumpPath,
                        dump_bytes = dumpBytes,
                        source,
                        created_at = createdAt
                    }));
                CrashDumpService.MarkReported(manifestPath);
            }
            catch (Exception ex)
            {
                await LogBestEffortAsync(
                    "warn",
                    "collector_crash_dump_report_failed",
                    $"崩溃报告读取失败：{manifestPath}",
                    ex.ToString());
            }
        }
    }

    private async Task PruneReportedCrashDumpsAsync()
    {
        var retentionDays = Math.Clamp(_config.LogRetentionDays <= 0 ? 30 : _config.LogRetentionDays, 1, 3650);
        var cutoff = DateTimeOffset.Now.AddDays(-retentionDays);
        var pruned = CrashDumpService.PruneReportedReports(cutoff);
        if (pruned <= 0) return;

        await LogBestEffortAsync(
            "info",
            "collector_crash_dump_pruned",
            $"已清理 {pruned} 个超过保留期的已上报崩溃报告。",
            metadataJson: ClientLogMetadata.Serialize(new
            {
                pruned,
                retentionDays,
                cutoff
            }));
    }

    private async Task RecoverInterruptedUploadsAsync()
    {
        int recovered;
        try
        {
            recovered = await _queueStore.ResetInterruptedUploadsAsync();
        }
        catch (Exception ex)
        {
            await LogBestEffortAsync(
                "warn",
                "upload_queue_recovery_failed",
                "启动时恢复上次中断的上传任务失败，采集端将继续启动并在后续队列处理时重试。",
                ex.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new { exceptionType = ex.GetType().Name }));
            return;
        }

        if (recovered <= 0) return;

        await LogBestEffortAsync(
            "warn",
            "upload_queue_recovered",
            $"检测到 {recovered} 个上次中断的上传任务，已重新入队。",
            metadataJson: ClientLogMetadata.Serialize(new { recoveredCount = recovered }));
    }

    private async Task SyncRemoteConfigAsync()
    {
        var remoteState = CollectorDeviceRemoteCallPolicy.EvaluateConfigSync(_config, _deviceToken);
        if (!remoteState.CanCall)
        {
            await LogRemoteCallUnavailableOnceAsync("config", remoteState);
            return;
        }

        _lastRemoteCallUnavailableKey = "";
        try
        {
            var response = await _apiClient.GetDeviceConfigAsync(_config, _deviceToken);
            await ApplyRemoteConfigResponseAsync(response, "config");
        }
        catch (CollectorDeviceAuthException ex)
        {
            await HandleDeviceAuthenticationFailedAsync(ex, "config");
        }
        catch (Exception ex)
        {
            await LogBestEffortAsync("warn", "collector_config_sync_failed", "远程配置同步失败。", ex.ToString());
        }
    }

    private async Task SendHeartbeatAndApplyResponseAsync()
    {
        var remoteState = CollectorDeviceRemoteCallPolicy.EvaluateHeartbeat(_config, _deviceToken);
        if (!remoteState.CanCall)
        {
            await LogRemoteCallUnavailableOnceAsync("heartbeat", remoteState);
            return;
        }

        _lastRemoteCallUnavailableKey = "";
        try
        {
            var health = await TryBuildHealthSnapshotAsync();
            var response = await _apiClient.SendHeartbeatAsync(_config, _deviceToken, health);
            await ApplyRemoteConfigResponseAsync(response, "heartbeat");
        }
        catch (CollectorDeviceAuthException ex)
        {
            await HandleDeviceAuthenticationFailedAsync(ex, "heartbeat");
        }
        catch (Exception ex)
        {
            await LogBestEffortAsync("warn", "collector_heartbeat_failed", "采集端心跳上报失败。", ex.ToString());
        }
    }

    private async Task LogRemoteCallUnavailableOnceAsync(
        string source,
        CollectorDeviceRemoteCallState remoteState)
    {
        if (!string.Equals(remoteState.Reason, "invalid_server_address", StringComparison.Ordinal))
        {
            return;
        }

        var key = source + ":" + remoteState.Reason;
        if (string.Equals(_lastRemoteCallUnavailableKey, key, StringComparison.Ordinal))
        {
            return;
        }

        _lastRemoteCallUnavailableKey = key;
        await LogBestEffortAsync(
            "warn",
            "collector_remote_call_unavailable",
            remoteState.StatusMessage,
            metadataJson: ClientLogMetadata.Serialize(new
            {
                source,
                remoteState.Reason,
                _config.DeviceStatus,
                _config.ServerBaseUrl
            }));
    }

    private Task LogBestEffortAsync(
        string level,
        string eventType,
        string message,
        string stack = "",
        string route = "",
        string url = "",
        string requestUrl = "",
        int? statusCode = null,
        string metadataJson = "{}",
        string appModule = "",
        string traceId = "",
        string aiImportBatchId = "",
        string sourceFileHash = "",
        string userId = "",
        string username = "",
        string role = "")
    {
        return CollectorBackgroundTask.ObserveAsync(_logService.LogAsync(
            level,
            eventType,
            message,
            stack,
            route,
            url,
            requestUrl,
            statusCode,
            metadataJson,
            appModule,
            traceId,
            aiImportBatchId,
            sourceFileHash,
            userId,
            username,
            role));
    }

    private async Task LogAutoStartApplyFailedOnceAsync(
        bool requestedEnabled,
        string source,
        Exception? exception)
    {
        if (exception is null) return;

        var message = string.Join(" ", (exception.Message ?? "").Split(Array.Empty<char>(), StringSplitOptions.RemoveEmptyEntries));
        if (message.Length > 240)
        {
            message = message[..240];
        }

        var signature = $"{source}:{requestedEnabled}:{exception.GetType().Name}:{message}";
        if (string.Equals(_lastAutoStartFailureSignature, signature, StringComparison.Ordinal))
        {
            return;
        }

        _lastAutoStartFailureSignature = signature;
        await LogBestEffortAsync(
            "warn",
            "collector_autostart_apply_failed",
            "开机自启配置写入失败，采集端将保留上一版自启状态。",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new
            {
                source,
                requestedEnabled,
                exceptionType = exception.GetType().Name,
                failureSignature = signature
            }));
    }

    private async Task LogAutoStartReadFailedOnceAsync(Exception? exception)
    {
        if (exception is null) return;

        var message = string.Join(" ", (exception.Message ?? "").Split(Array.Empty<char>(), StringSplitOptions.RemoveEmptyEntries));
        if (message.Length > 240)
        {
            message = message[..240];
        }

        var signature = $"{exception.GetType().Name}:{message}";
        if (string.Equals(_lastAutoStartReadFailureSignature, signature, StringComparison.Ordinal))
        {
            return;
        }

        _lastAutoStartReadFailureSignature = signature;
        await LogBestEffortAsync(
            "warn",
            "collector_autostart_read_failed",
            "开机自启状态读取失败，界面将暂按本地配置显示。",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new
            {
                exceptionType = exception.GetType().Name,
                failureSignature = signature,
                configuredEnabled = _config.AutoStartEnabled
            }));
    }

    private async Task HandleDeviceAuthenticationFailedAsync(CollectorDeviceAuthException exception, string source)
    {
        if (!Dispatcher.CheckAccess())
        {
            await Dispatcher
                .InvokeAsync(() => HandleDeviceAuthenticationFailedAsync(exception, source))
                .Task
                .Unwrap();
            return;
        }

        var changed = CollectorDeviceAuthPolicy.ApplyAuthenticationFailure(_config);
        _deviceToken = "";
        Exception? stateSaveException = null;

        if (changed)
        {
            stateSaveException = await CollectorDeviceAuthPolicy.TrySaveAuthenticationFailureStateAsync(
                _config,
                config => _configurationService.SaveAsync(config));
        }

        _logService.UpdateContext(_config);
        SetBindingStatusHintOverride(
            "设备认证已失效，请输入新的设备授权码并点击保存并绑定。",
            "#B91C1C");
        LoadConfigToUi();
        ApplyCollectorRuntimeState(logWhenDisabled: false);

        if (stateSaveException is not null)
        {
            await LogBestEffortAsync(
                "warn",
                "collector_device_auth_state_save_failed",
                "设备认证失效状态保存失败，当前进程已清空内存 token 并停止采集，下次启动可能需要重新同步绑定状态。",
                stateSaveException.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    source,
                    statusCode = (int)exception.StatusCode,
                    exceptionType = stateSaveException.GetType().Name,
                    _config.DeviceId,
                    _config.DeviceCode,
                    _config.DeviceStatus
                }));
        }

        await LogBestEffortAsync(
            "error",
            "collector_device_auth_failed",
            "采集设备认证已失效，请使用新的授权码重新绑定。",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new
            {
                source,
                statusCode = (int)exception.StatusCode,
                _config.DeviceId,
                _config.DeviceCode
            }));
        SetStatus("设备认证已失效，请重新绑定。");
        OpenRecoverySettings();
    }

    private async Task<CollectorHealthSnapshot?> TryBuildHealthSnapshotAsync()
    {
        try
        {
            return await _healthSnapshotService.BuildAsync(_config);
        }
        catch (Exception ex)
        {
            await LogBestEffortAsync(
                "warn",
                "collector_health_snapshot_failed",
                "采集端健康快照生成失败，本次心跳将只上报基础信息。",
                ex.ToString());
            return null;
        }
    }

    private async Task ApplyRemoteConfigResponseAsync(DeviceConfigResponse? response, string source)
    {
        if (response is null || response.Config is null) return;

        var (changed, watchFoldersChanged) = ApplyRemoteConfig(response);
        if (!changed) return;

        var stateSaveException = await CollectorConfigSavePolicy.TrySaveBestEffortAsync(
            _config,
            config => _configurationService.SaveAsync(config));
        _logService.UpdateContext(_config);
        UpdateHeartbeatTimerInterval();
        LoadConfigToUi();
        if (watchFoldersChanged || IsDeviceDisabled(_config))
        {
            ApplyCollectorRuntimeState();
        }

        if (stateSaveException is not null)
        {
            await LogBestEffortAsync(
                "warn",
                "collector_config_sync_state_save_failed",
                "远程配置已应用到当前进程，但本地配置保存失败，下次启动可能恢复旧配置。",
                stateSaveException.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    configVersion = _config.RemoteConfigVersion,
                    source,
                    exceptionType = stateSaveException.GetType().Name,
                    _config.DeviceId,
                    _config.DeviceCode,
                    _config.DeviceStatus
                }));
        }

        await LogBestEffortAsync(
            "info",
            "collector_config_synced",
            source == "heartbeat" ? "心跳响应中的远程配置已同步。" : "远程配置已同步。",
            metadataJson: ClientLogMetadata.Serialize(new
            {
                configVersion = _config.RemoteConfigVersion,
                source
            }));
    }

    private async Task<bool> CheckForUpdatesAsync(bool force = false)
    {
        var previousInstallerProcessId = _config.PendingUpdateInstallerProcessId;
        var changed = await _updateService.CheckAsync(_config, force);
        if (!changed) return false;

        var stateSave = await CollectorUpdateStateSavePolicy.TrySaveAndEvaluateAsync(
            _config,
            force,
            previousInstallerProcessId,
            DateTimeOffset.Now,
            config => _configurationService.SaveAsync(config));
        _logService.UpdateContext(_config);

        if (stateSave.SaveException is not null)
        {
            await LogBestEffortAsync(
                "warn",
                "collector_update_state_save_failed",
                "采集端更新状态保存失败，当前进程将继续按内存中的更新状态运行。",
                stateSave.SaveException.ToString(),
                metadataJson: stateSave.FailureMetadataJson);
        }

        if (!stateSave.ShouldShutdownAfterInstallerStarted)
        {
            return false;
        }

        await ShutdownCollectorAsync(
            "采集端更新安装器已启动，正在退出以完成升级。",
            "collector_update_shutdown",
            "采集端更新安装器已启动，客户端正在退出以完成升级。");
        return true;
    }

    private bool SyncClientVersion()
    {
        var currentVersion = GetCurrentClientVersion();
        if (string.Equals(_config.ClientVersion, currentVersion, StringComparison.Ordinal))
        {
            return false;
        }

        _config.ClientVersion = currentVersion;
        return true;
    }

    private static string GetCurrentClientVersion()
    {
        var assembly = typeof(MainWindow).Assembly;
        var informationalVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion
            ?.Split('+')[0]
            .Trim();
        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            return informationalVersion;
        }

        return assembly.GetName().Version?.ToString(3) ?? "0.1.0";
    }

    private (bool Changed, bool WatchFoldersChanged) ApplyRemoteConfig(DeviceConfigResponse response)
    {
        var changed = false;
        var watchFoldersChanged = false;
        var remote = response.Config;
        remote.Upload ??= new CollectorUploadPolicy();
        remote.Logs ??= new CollectorLogPolicy();
        remote.Update ??= new CollectorUpdatePolicy();
        remote.WatchFolders ??= new List<WatchFolderConfig>();

        changed |= SetIfNotEmpty(value => _config.DeviceId = value, _config.DeviceId, response.Device.DeviceId, 128);
        changed |= SetIfNotEmpty(value => _config.DeviceCode = value, _config.DeviceCode, response.Device.DeviceCode, 128);
        changed |= SetIfNotEmpty(value => _config.DeviceName = value, _config.DeviceName, response.Device.DeviceName, 120);
        changed |= SetIfNotEmpty(value => _config.DefaultUserId = value, _config.DefaultUserId, remote.DefaultUserId, 128);
        changed |= SetIfNotEmpty(value => _config.DefaultUsername = value, _config.DefaultUsername, remote.DefaultUsername, 120);
        changed |= SetIfNotEmpty(value => _config.DefaultRole = value, _config.DefaultRole, remote.DefaultRole, 80);
        var deviceStatus = ConfigurationService.NormalizeDeviceStatus(response.Device.Status);
        if (!string.Equals(_config.DeviceStatus ?? "", deviceStatus, StringComparison.Ordinal))
        {
            _config.DeviceStatus = deviceStatus;
            changed = true;
            watchFoldersChanged = true;
        }

        var heartbeatInterval = Math.Clamp(remote.HeartbeatIntervalSeconds <= 0 ? 60 : remote.HeartbeatIntervalSeconds, 15, 60 * 60);
        if (_config.HeartbeatIntervalSeconds != heartbeatInterval)
        {
            _config.HeartbeatIntervalSeconds = heartbeatInterval;
            changed = true;
        }

        var maxUploadBytes = Math.Clamp(remote.Upload.MaxFileBytes <= 0 ? 256L * 1024 * 1024 : remote.Upload.MaxFileBytes, 1024L * 1024, 1024L * 1024 * 1024);
        if (_config.MaxUploadBytes != maxUploadBytes)
        {
            _config.MaxUploadBytes = maxUploadBytes;
            changed = true;
        }

        var chunkSizeBytes = Math.Clamp(remote.Upload.ChunkSizeBytes <= 0 ? 8 * 1024 * 1024 : remote.Upload.ChunkSizeBytes, 256 * 1024, 64 * 1024 * 1024);
        if (_config.ChunkSizeBytes != chunkSizeBytes)
        {
            _config.ChunkSizeBytes = chunkSizeBytes;
            changed = true;
        }

        var retryInterval = Math.Clamp(remote.Upload.RetryIntervalSeconds <= 0 ? 15 : remote.Upload.RetryIntervalSeconds, 5, 60 * 60);
        if (_config.UploadRetryIntervalSeconds != retryInterval)
        {
            _config.UploadRetryIntervalSeconds = retryInterval;
            changed = true;
        }

        var maxRetryCount = Math.Clamp(remote.Upload.MaxRetryCount <= 0 ? 10 : remote.Upload.MaxRetryCount, 1, 100);
        if (_config.UploadMaxRetryCount != maxRetryCount)
        {
            _config.UploadMaxRetryCount = maxRetryCount;
            changed = true;
        }

        var queueRetentionDays = Math.Clamp(remote.Upload.QueueRetentionDays <= 0 ? 30 : remote.Upload.QueueRetentionDays, 1, 3650);
        if (_config.UploadQueueRetentionDays != queueRetentionDays)
        {
            _config.UploadQueueRetentionDays = queueRetentionDays;
            changed = true;
        }

        var allowedExtensions = CollectorAllowedExtensionsPolicy.Normalize(remote.Upload.AllowedExtensions);
        if (!SequenceEquals(_config.AllowedExtensions, allowedExtensions))
        {
            _config.AllowedExtensions = allowedExtensions;
            changed = true;
        }

        if (_config.LogCollectionEnabled != remote.Logs.Enabled)
        {
            _config.LogCollectionEnabled = remote.Logs.Enabled;
            changed = true;
        }

        var logBatchSize = Math.Clamp(remote.Logs.BatchSize <= 0 ? 100 : remote.Logs.BatchSize, 1, 1000);
        if (_config.LogBatchSize != logBatchSize)
        {
            _config.LogBatchSize = logBatchSize;
            changed = true;
        }

        var logFlushInterval = Math.Clamp(remote.Logs.FlushIntervalSeconds <= 0 ? 30 : remote.Logs.FlushIntervalSeconds, 5, 60 * 60);
        if (_config.LogFlushIntervalSeconds != logFlushInterval)
        {
            _config.LogFlushIntervalSeconds = logFlushInterval;
            changed = true;
        }

        var logRetentionDays = Math.Clamp(remote.Logs.RetentionDays <= 0 ? 30 : remote.Logs.RetentionDays, 1, 3650);
        if (_config.LogRetentionDays != logRetentionDays)
        {
            _config.LogRetentionDays = logRetentionDays;
            changed = true;
        }

        if (_config.HighPriorityLogImmediate != remote.Logs.HighPriorityImmediate)
        {
            _config.HighPriorityLogImmediate = remote.Logs.HighPriorityImmediate;
            changed = true;
        }

        if (remote.AutoStartEnabled.HasValue)
        {
            var autoStartResult = CollectorAutoStartPolicy.Apply(
                _config.AutoStartEnabled,
                remote.AutoStartEnabled,
                StartupService.SetEnabled);
            if (autoStartResult.Applied && autoStartResult.Changed)
            {
                _config.AutoStartEnabled = autoStartResult.RequestedEnabled;
                _lastAutoStartFailureSignature = "";
                changed = true;
            }
            else if (!autoStartResult.Applied)
            {
                _ = LogAutoStartApplyFailedOnceAsync(autoStartResult.RequestedEnabled, "remote_config", autoStartResult.Exception);
            }
        }

        var remoteUpdate = CollectorRemoteUpdatePolicy.Normalize(remote.Update);
        if (_config.AutoUpdateEnabled != remoteUpdate.AutoUpdateEnabled)
        {
            _config.AutoUpdateEnabled = remoteUpdate.AutoUpdateEnabled;
            _config.LastUpdateCheckAt = null;
            changed = true;
        }

        var updateManifestUrl = remoteUpdate.ManifestUrl;
        if (!string.Equals(_config.UpdateManifestUrl ?? "", updateManifestUrl, StringComparison.Ordinal))
        {
            _config.UpdateManifestUrl = updateManifestUrl;
            _config.LastUpdateCheckAt = null;
            changed = true;
        }

        var updateCheckIntervalHours = remoteUpdate.CheckIntervalHours;
        if (_config.UpdateCheckIntervalHours != updateCheckIntervalHours)
        {
            _config.UpdateCheckIntervalHours = updateCheckIntervalHours;
            _config.LastUpdateCheckAt = null;
            changed = true;
        }

        if (_config.AutoUpdateInstallEnabled != remoteUpdate.AutoInstallEnabled)
        {
            _config.AutoUpdateInstallEnabled = remoteUpdate.AutoInstallEnabled;
            changed = true;
        }

        var updateInstallerArguments = remoteUpdate.InstallerArguments;
        if (!string.Equals(_config.UpdateInstallerArguments ?? "", updateInstallerArguments, StringComparison.Ordinal))
        {
            _config.UpdateInstallerArguments = updateInstallerArguments;
            changed = true;
        }

        var folders = CollectorRemoteWatchFolderPolicy.NormalizeRemoteFolders(remote.WatchFolders, _config);
        if (!CollectorRemoteWatchFolderPolicy.AreEqual(_config.WatchFolders, folders))
        {
            _config.WatchFolders = folders;
            changed = true;
            watchFoldersChanged = true;
        }

        var remoteConfigVersion = ConfigurationService.NormalizeText(response.ConfigVersion, 120);
        if (!string.Equals(_config.RemoteConfigVersion, remoteConfigVersion, StringComparison.Ordinal))
        {
            _config.RemoteConfigVersion = remoteConfigVersion;
            changed = true;
        }

        if (changed)
        {
            _config.LastRemoteConfigAt = DateTimeOffset.Now;
        }

        return (changed, watchFoldersChanged);
    }

    private void UpdateHeartbeatTimerInterval()
    {
        _heartbeatTimer.Interval = TimeSpan.FromSeconds(Math.Clamp(_config.HeartbeatIntervalSeconds, 15, 60 * 60));
    }

    private void ApplyCollectorRuntimeState(bool logWhenDisabled = true)
    {
        UpdateBindingStatusHint();
        UpdateShellRuntimeStatus();
        if (IsDeviceDisabled(_config))
        {
            _watchFolderService.Stop();
            if (logWhenDisabled)
            {
                CollectorBackgroundTask.Forget(_logService.LogAsync(
                    "warn",
                    "collector_device_disabled",
                    "采集设备已被后台禁用，本地监听与上传已暂停。",
                    metadataJson: ClientLogMetadata.Serialize(new { _config.DeviceId, _config.DeviceCode, _config.DeviceStatus })));
            }
            ShowDeviceAccessFallbackIfNeeded();
            SetStatus("设备已被后台禁用，本地监听与上传已暂停。");
            return;
        }

        if (CollectorDeviceAccessPolicy.IsPending(_config))
        {
            _watchFolderService.Stop();
            if (logWhenDisabled)
            {
                CollectorBackgroundTask.Forget(_logService.LogAsync(
                    "warn",
                    "collector_device_binding_required",
                    "采集设备待绑定，本地监听与上传已暂停。",
                    metadataJson: ClientLogMetadata.Serialize(new { _config.DeviceId, _config.DeviceCode, _config.DeviceStatus })));
            }
            ShowDeviceAccessFallbackIfNeeded();
            SetStatus("设备待绑定，本地监听与上传已暂停。");
            return;
        }

        _watchFolderService.Restart(_config);
    }

    private static bool IsDeviceDisabled(AppConfig config)
    {
        return CollectorDeviceAccessPolicy.IsDisabled(config);
    }

    private static bool SetIfNotEmpty(Action<string> assign, string currentValue, string newValue, int maxLength)
    {
        var normalized = ConfigurationService.NormalizeText(newValue, maxLength);
        if (string.IsNullOrWhiteSpace(normalized)) return false;
        if (string.Equals(currentValue ?? "", normalized, StringComparison.Ordinal)) return false;
        assign(normalized);
        return true;
    }

    private static bool SequenceEquals(IReadOnlyList<string> left, IReadOnlyList<string> right)
    {
        return left.Count == right.Count
            && left.Zip(right).All(pair => string.Equals(pair.First, pair.Second, StringComparison.OrdinalIgnoreCase));
    }

    private static string GetJsonString(JsonElement element, string name)
    {
        return element.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString() ?? ""
            : "";
    }

    private async Task RefreshQueueAsync()
    {
        if (!Dispatcher.CheckAccess())
        {
            await Dispatcher.InvokeAsync(RefreshQueueAsync);
            return;
        }

        var items = await _queueStore.ListRecentAsync(50);
        QueueList.ItemsSource = items
            .Select(item => UploadQueueDisplayPolicy.Format(item, fileExists: File.Exists))
            .ToList();
        await RefreshHealthSnapshotUiAsync();
    }

    private async Task<int> RefreshServerUploadStatusesAsync(CancellationToken cancellationToken = default)
    {
        var remoteState = CollectorDeviceRemoteCallPolicy.EvaluateHeartbeat(_config, _deviceToken);
        if (!remoteState.CanCall)
        {
            await LogRemoteCallUnavailableOnceAsync("asset_status", remoteState);
            return 0;
        }

        var items = await _queueStore.ListTraceableUploadsForStatusRefreshAsync(50, cancellationToken);
        var refreshed = 0;
        foreach (var item in items)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var asset = await _apiClient.GetAssetStatusAsync(_config, _deviceToken, item.ServerAssetId, cancellationToken);
                if (asset is null) continue;

                await _queueStore.UpdateServerTraceAsync(
                    item.Id,
                    FirstNonEmpty(asset.BatchId, item.ServerBatchId),
                    FirstNonEmpty(asset.BatchNo, item.ServerBatchNo),
                    ResolveServerProcessingStatus(asset, item),
                    ResolveServerProcessingMessage(asset),
                    cancellationToken);
                refreshed++;
            }
            catch (CollectorDeviceAuthException ex)
            {
                await HandleDeviceAuthenticationFailedAsync(ex, "asset_status");
                return refreshed;
            }
            catch (Exception ex)
            {
                await LogBestEffortAsync(
                    "warn",
                    "server_upload_status_item_refresh_failed",
                    $"刷新服务端处理状态失败：{item.OriginalFilename}",
                    ex.ToString(),
                    metadataJson: ClientLogMetadata.Serialize(new
                    {
                        queueId = item.Id,
                        item.ServerAssetId,
                        item.ServerBatchId,
                        item.ServerBatchNo
                    }));
            }
        }

        return refreshed;
    }

    private static string ResolveServerProcessingStatus(DocumentAssetStatus asset, UploadQueueItem item)
    {
        if (asset.BusinessLinkCount > 0)
        {
            return "imported";
        }

        return FirstNonEmpty(
            asset.EntryStatus,
            asset.ParseStatus,
            asset.AssetStatus,
            asset.BatchStatus,
            item.ServerProcessingStatus,
            item.Status);
    }

    private static string ResolveServerProcessingMessage(DocumentAssetStatus asset)
    {
        if (!string.IsNullOrWhiteSpace(asset.Message)) return asset.Message.Trim();
        if (asset.BusinessLinkCount > 0) return $"已生成 {asset.BusinessLinkCount} 条业务链接。";
        if (asset.UnmappedFieldCount > 0) return $"存在 {asset.UnmappedFieldCount} 个未匹配字段。";
        return "";
    }

    private async Task RefreshHealthSnapshotUiAsync()
    {
        try
        {
            var snapshot = await _healthSnapshotService.BuildAsync(_config);
            var display = CollectorHealthDisplayPolicy.Build(snapshot);
            if (!Dispatcher.CheckAccess())
            {
                await Dispatcher.InvokeAsync(() => UpdateHealthSnapshotUi(display));
                return;
            }

            UpdateHealthSnapshotUi(display);
        }
        catch (Exception ex)
        {
            if (!Dispatcher.CheckAccess())
            {
                await Dispatcher.InvokeAsync(SetHealthSnapshotUnavailable);
            }
            else
            {
                SetHealthSnapshotUnavailable();
            }

            await LogBestEffortAsync(
                "warn",
                "collector_health_ui_refresh_failed",
                "采集端健康概览刷新失败。",
                ex.ToString());
        }
    }

    private void UpdateHealthSnapshotUi(CollectorHealthDisplay display)
    {
        HealthGeneratedAtText.Text = display.GeneratedAt;
        HealthDeviceStatusText.Text = display.DeviceStatus;
        HealthWatchFoldersText.Text = display.WatchFolders;
        HealthUploadQueueText.Text = display.UploadQueue;
        HealthLogsText.Text = display.Logs;
        HealthConnectivityText.Text = display.Connectivity;
        HealthStorageText.Text = display.Storage;
    }

    private void SetHealthSnapshotUnavailable()
    {
        HealthGeneratedAtText.Text = "刷新失败";
        HealthDeviceStatusText.Text = "未知";
        HealthWatchFoldersText.Text = "未知";
        HealthUploadQueueText.Text = "未知";
        HealthLogsText.Text = "未知";
        HealthConnectivityText.Text = "未知";
        HealthStorageText.Text = "未知";
    }

    private void LoadConfigToUi()
    {
        _isLoadingUi = true;
        try
        {
            _webViewLogBridge.UpdateTrustedServerBaseUrl(_config.ServerBaseUrl);
            ServerBaseUrlBox.Text = _config.ServerBaseUrl;
            EnterpriseCodeBox.Text = _config.EnterpriseCode;
            DeviceCodeBox.Text = _config.DeviceCode;
            DeviceNameBox.Text = _config.DeviceName;
            DefaultUserIdBox.Text = _config.DefaultUserId;
            DefaultUsernameBox.Text = _config.DefaultUsername;
            DefaultRoleBox.Text = _config.DefaultRole;
            RefreshWatchFolderList();
            var autoStartRead = CollectorAutoStartPolicy.ReadConfiguredState(
                _config.AutoStartEnabled,
                StartupService.IsEnabled);
            AutoStartBox.IsChecked = autoStartRead.IsEnabled;
            if (!autoStartRead.ReadSucceeded)
            {
                _ = LogAutoStartReadFailedOnceAsync(autoStartRead.Exception);
            }

            UpdateWebLoginOwnerUi(_webViewLogBridge.CurrentUploadOwner);
            UpdateBindingStatusHint();
            UpdateShellRuntimeStatus();
        }
        finally
        {
            _isLoadingUi = false;
        }
    }

    private void UpdateConfigFromUi()
    {
        _config.ServerBaseUrl = CollectorServerAddressPolicy.NormalizeForStorage(ServerBaseUrlBox.Text);
        _config.EnterpriseCode = EnterpriseCodeBox.Text.Trim();
        _config.DeviceCode = DeviceCodeBox.Text.Trim();
        _config.DeviceName = DeviceNameBox.Text.Trim();
        _config.DefaultUserId = DefaultUserIdBox.Text.Trim();
        _config.DefaultUsername = DefaultUsernameBox.Text.Trim();
        _config.DefaultRole = DefaultRoleBox.Text.Trim();
        _config.AutoStartEnabled = AutoStartBox.IsChecked == true;
        NormalizeWatchFolders();
        _webViewLogBridge.UpdateTrustedServerBaseUrl(_config.ServerBaseUrl);
    }

    private bool TryUpdateConfigFromUiForRuntimeAction()
    {
        var saveState = CollectorConfigSavePolicy.Evaluate(ServerBaseUrlBox.Text);
        if (!saveState.CanSave)
        {
            SetStatus(saveState.StatusMessage);
            return false;
        }

        UpdateConfigFromUi();
        ConfigurationService.Normalize(_config);
        return true;
    }

    private void NormalizeWatchFolders()
    {
        var normalized = new List<WatchFolderConfig>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var folder in _config.WatchFolders ?? new List<WatchFolderConfig>())
        {
            var folderPath = ConfigurationService.NormalizeText(folder.FolderPath, 1024);
            if (string.IsNullOrWhiteSpace(folderPath)) continue;
            if (!seen.Add(ConfigurationService.NormalizeWatchFolderKey(folderPath))) continue;

            normalized.Add(new WatchFolderConfig
            {
                FolderPath = folderPath,
                FolderName = string.IsNullOrWhiteSpace(folder.FolderName)
                    ? GetFolderDisplayName(folderPath)
                    : ConfigurationService.NormalizeText(folder.FolderName, 120),
                DefaultUserId = string.IsNullOrWhiteSpace(folder.DefaultUserId)
                    ? _config.DefaultUserId
                    : ConfigurationService.NormalizeText(folder.DefaultUserId, 128),
                DefaultUsername = string.IsNullOrWhiteSpace(folder.DefaultUsername)
                    ? _config.DefaultUsername
                    : ConfigurationService.NormalizeText(folder.DefaultUsername, 120),
                DefaultRole = string.IsNullOrWhiteSpace(folder.DefaultRole)
                    ? _config.DefaultRole
                    : ConfigurationService.NormalizeText(folder.DefaultRole, 80),
                Enabled = folder.Enabled
            });
        }

        _config.WatchFolders = normalized;
        RefreshWatchFolderList(Math.Min(WatchFolderList.SelectedIndex, _config.WatchFolders.Count - 1));
    }

    private static string GetFolderDisplayName(string folderPath)
    {
        var trimmed = (folderPath ?? "").TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return Path.GetFileName(trimmed) is { Length: > 0 } name ? name : trimmed;
    }

    private void SetWebViewFallbackVisible(bool visible, string? message = null)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(() => SetWebViewFallbackVisible(visible, message));
            return;
        }

        WebViewFallbackPanel.Visibility = visible ? Visibility.Visible : Visibility.Collapsed;
        WebViewFallbackMessageText.Text = string.IsNullOrWhiteSpace(message)
            ? "本地文件采集、上传队列和日志后台循环会继续运行。"
            : message;
    }

    private bool ShowDeviceAccessFallbackIfNeeded()
    {
        if (IsDeviceDisabled(_config))
        {
            SetWebViewFallbackVisible(
                true,
                "采集设备已被后台禁用，本地监听与上传已暂停。请联系管理员恢复设备后重试。");
            return true;
        }

        if (CollectorDeviceAccessPolicy.IsPending(_config))
        {
            SetWebViewFallbackVisible(
                true,
                "设备待绑定或认证已失效，本地监听与上传已暂停。请打开设置输入新的设备授权码并点击保存并绑定。");
            return true;
        }

        return false;
    }

    private void AttachBrowserNavigationCompletedHandler()
    {
        if (_browserNavigationCompletedAttached || Browser.CoreWebView2 is null) return;

        Browser.CoreWebView2.NavigationCompleted += Browser_NavigationCompleted;
        _browserNavigationCompletedAttached = true;
    }

    private void Browser_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (ShowDeviceAccessFallbackIfNeeded()) return;

        if (e.IsSuccess)
        {
            SetWebViewFallbackVisible(false);
            return;
        }

        var webErrorStatus = e.WebErrorStatus.ToString();
        var navigationFailure = CollectorWebViewNavigationFailurePolicy.Describe(
            _config.ServerBaseUrl,
            webErrorStatus,
            (int)e.HttpStatusCode);
        SetWebViewFallbackVisible(true, navigationFailure.StatusMessage);
        SetStatus(navigationFailure.DiagnosticMessage);
        CollectorBackgroundTask.Forget(LogBestEffortAsync(
            "warn",
            "webview_navigation_failed",
            navigationFailure.StatusMessage,
            metadataJson: ClientLogMetadata.Serialize(new
            {
                _config.ServerBaseUrl,
                webErrorStatus,
                httpStatusCode = (int)e.HttpStatusCode,
                failureKind = navigationFailure.FailureKind,
                diagnosticMessage = navigationFailure.DiagnosticMessage
            })));
    }

    private void NavigateToConfiguredServer()
    {
        if (ShowDeviceAccessFallbackIfNeeded()) return;

        if (Browser.CoreWebView2 is null)
        {
            SetWebViewFallbackVisible(true, "WebView 尚未可用，本地文件采集、上传队列和日志后台循环会继续运行。");
            return;
        }

        AttachBrowserNavigationCompletedHandler();
        SetWebViewFallbackVisible(false);
        _webViewLogBridge.UpdateTrustedServerBaseUrl(_config.ServerBaseUrl);
        if (Uri.TryCreate(_config.ServerBaseUrl, UriKind.Absolute, out var uri))
        {
            Browser.CoreWebView2.Navigate(uri.ToString());
            return;
        }

        Browser.NavigateToString("""
            <!doctype html>
            <html lang="zh-CN">
              <head>
                <meta charset="utf-8">
                <style>
                  body { margin:0; font-family: "Microsoft YaHei", sans-serif; background:#f8fafc; color:#1f2937; }
                  main { height:100vh; display:flex; align-items:center; justify-content:center; }
                  section { max-width:520px; padding:32px; }
                  h1 { font-size:24px; margin:0 0 12px; }
                  p { line-height:1.7; color:#64748b; }
                </style>
              </head>
              <body>
                <main>
                  <section>
                    <h1>EISCore</h1>
                    <p>请先通过右上角设置配置服务器地址并绑定设备。绑定后这里会打开 EISCore 网站，原生端会继续负责本地文件采集、队列和日志。</p>
                  </section>
                </main>
              </body>
            </html>
            """);
    }

    private async Task<CollectorWebViewStartupResult> InitializeWebViewShellAsync()
    {
        var result = await CollectorWebViewStartupPolicy.TryInitializeAsync(async () =>
        {
            await _webViewLogBridge.InitializeAsync(Browser, _config);
            NavigateToConfiguredServer();
            UpdateWebLoginOwnerUi(_webViewLogBridge.CurrentUploadOwner);
            SetWebViewFallbackVisible(false);
        });
        if (result.IsAvailable || result.Exception is null)
        {
            return result;
        }

        SetWebViewFallbackVisible(true, result.StatusMessage);
        await LogBestEffortAsync(
            "error",
            "webview_initialization_failed",
            "WebView 初始化失败，本地文件采集、上传队列和日志后台循环将继续运行。",
            result.Exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new
            {
                exceptionType = result.Exception.GetType().Name,
                failureKind = result.FailureKind,
                diagnosticMessage = result.DiagnosticMessage,
                _config.ServerBaseUrl,
                _config.WebViewVersion
            }));
        return result;
    }

    private async Task InitializeTrayIconAsync()
    {
        if (_trayIcon is not null) return;

        try
        {
            _trayIcon = new Forms.NotifyIcon
            {
                Text = "EISCore",
                Icon = LoadApplicationIcon(),
                Visible = true,
                ContextMenuStrip = new Forms.ContextMenuStrip()
            };
            _trayIcon.ContextMenuStrip.Items.Add("显示", null, (_, _) => Dispatcher.Invoke(ShowFromTray));
            _trayIcon.ContextMenuStrip.Items.Add("退出", null, (_, _) => Dispatcher.Invoke(ExitApplication));
            _trayIcon.DoubleClick += (_, _) => Dispatcher.Invoke(ShowFromTray);
        }
        catch (Exception ex)
        {
            _trayIcon?.Dispose();
            _trayIcon = null;
            await LogBestEffortAsync(
                "warn",
                "collector_tray_initialization_failed",
                "托盘图标初始化失败，采集端将保留任务栏窗口并继续运行。",
                ex.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new { exceptionType = ex.GetType().Name }));
        }
    }

    private static System.Drawing.Icon LoadApplicationIcon()
    {
        try
        {
            var resource = System.Windows.Application.GetResourceStream(
                new Uri("pack://application:,,,/Assets/eiscore-icon.ico", UriKind.Absolute));
            if (resource?.Stream is not null)
            {
                using var stream = resource.Stream;
                using var icon = new System.Drawing.Icon(stream);
                return (System.Drawing.Icon)icon.Clone();
            }
        }
        catch
        {
            // The tray can still run with the system icon if resource loading fails.
        }

        return System.Drawing.SystemIcons.Application;
    }

    private void ShowFromTray()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void HideWhenStartedMinimized(bool shouldStartMinimized)
    {
        if (!shouldStartMinimized)
        {
            return;
        }

        if (IsTrayAvailable())
        {
            Hide();
            SetStatus("采集端已随 Windows 启动并常驻托盘。");
            return;
        }

        WindowState = WindowState.Minimized;
        SetStatus("采集端已随 Windows 启动，托盘不可用，窗口已最小化。");
    }

    private async void ExitApplication()
    {
        await ShutdownCollectorAsync("采集端正在退出。", "collector_stop", "采集端退出。");
    }

    private void SystemEvents_SessionEnding(object sender, SessionEndingEventArgs e)
    {
        _isSessionEnding = true;

        try
        {
            _ = Dispatcher.InvokeAsync(() => _ = ShutdownForSessionEndingAsync());
        }
        catch (InvalidOperationException)
        {
            System.Windows.Application.Current.Shutdown();
        }
    }

    private async Task ShutdownForSessionEndingAsync()
    {
        try
        {
            await ShutdownCollectorAsync(
                "Windows 正在结束会话，采集端正在退出。",
                "collector_stop",
                "Windows 正在结束会话，采集端退出。");
        }
        catch
        {
            System.Windows.Application.Current.Shutdown();
        }
    }

    private async Task ShutdownCollectorAsync(string statusMessage, string eventType, string logMessage)
    {
        if (_isShutdownInProgress) return;

        _isShutdownInProgress = true;
        _isExitRequested = true;
        SetStatus(statusMessage);

        try
        {
            await _logService.LogAsync("info", eventType, logMessage);
        }
        catch
        {
            // Shutdown must continue even when local logging is temporarily unavailable.
        }

        try
        {
            _heartbeatTimer.Stop();
            _watchFolderService.Stop();
            await _uploadProcessor.StopAsync();
            await _logProcessor.StopAndFlushAsync();
        }
        finally
        {
            SystemEvents.SessionEnding -= SystemEvents_SessionEnding;
            _trayIcon?.Dispose();
            _trayIcon = null;
            Close();
            System.Windows.Application.Current.Shutdown();
        }
    }

    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        var closeAction = CollectorWindowClosePolicy.Decide(_isExitRequested, _isSessionEnding, IsTrayAvailable());
        if (closeAction == CollectorWindowCloseAction.AllowClose) return;

        e.Cancel = true;
        if (closeAction == CollectorWindowCloseAction.HideToTray)
        {
            Hide();
            SetStatus("采集端已最小化到托盘。");
            return;
        }

        WindowState = WindowState.Minimized;
        SetStatus("托盘不可用，采集端已最小化到任务栏。");
    }

    private bool IsTrayAvailable()
    {
        return _trayIcon is { Visible: true };
    }

    private void MainWindow_Closed(object? sender, EventArgs e)
    {
        _heartbeatTimer.Tick -= HeartbeatTimer_Tick;
        _webViewLogBridge.UploadOwnerChanged -= WebViewLogBridge_UploadOwnerChanged;
        if (_browserNavigationCompletedAttached && Browser.CoreWebView2 is not null)
        {
            Browser.CoreWebView2.NavigationCompleted -= Browser_NavigationCompleted;
            _browserNavigationCompletedAttached = false;
        }
        SystemEvents.SessionEnding -= SystemEvents_SessionEnding;
        _heartbeatTickGate.Dispose();
        _webViewRetryGate.Dispose();
    }

    private void UpdateWebLoginOwnerUi(UploadOwnerContext owner)
    {
        var hasContext = owner.HasContext;
        var displayStatus = CollectorWebLoginOwnerDefaultPolicy.ResolveDisplayStatus(owner, _config);
        WebLoginOwnerHintText.Text = displayStatus.HintText;
        WebLoginOwnerHintText.Foreground = BuildBrush(displayStatus.HintForeground, "#64748B");
        WebLoginUserIdText.Text = DisplayIdentityValue(owner.UserId);
        WebLoginUsernameText.Text = DisplayIdentityValue(owner.Username);
        WebLoginRoleText.Text = DisplayIdentityValue(owner.Role);
        WebLoginTenantText.Text = DisplayIdentityValue(FormatIdentityPair(owner.TenantId, owner.TenantName));
        WebLoginDepartmentText.Text = DisplayIdentityValue(FormatIdentityPair(owner.DepartmentId, owner.DepartmentName));
        WebLoginSourceText.Text = DisplayIdentityValue(FormatWebLoginSource(owner.LoginContextSource));
        WebLoginSyncedAtText.Text = DisplayIdentityValue(FormatWebLoginSyncedAt(owner.LastSyncedAt));
        SyncWebLoginOwnerButton.Content = displayStatus.SyncButtonText;
        SyncWebLoginOwnerButton.IsEnabled = hasContext || Browser.CoreWebView2 is not null;
    }

    private void SetBindingStatusHintOverride(string message, string foreground)
    {
        _bindingStatusHintOverride = (message ?? "").Trim();
        _bindingStatusHintForeground = string.IsNullOrWhiteSpace(foreground) ? "#64748B" : foreground.Trim();
        UpdateBindingStatusHint();
    }

    private void ClearBindingStatusHintOverride()
    {
        _bindingStatusHintOverride = "";
        _bindingStatusHintForeground = "";
        UpdateBindingStatusHint();
    }

    private void UpdateBindingStatusHint()
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(UpdateBindingStatusHint);
            return;
        }

        if (!string.IsNullOrWhiteSpace(_bindingStatusHintOverride))
        {
            BindingStatusHintText.Text = _bindingStatusHintOverride;
            BindingStatusHintText.Foreground = BuildBrush(_bindingStatusHintForeground, "#64748B");
            return;
        }

        var status = (_config.DeviceStatus ?? "").Trim().ToLowerInvariant();
        var (message, color) = status switch
        {
            "active" => ("设备已绑定，监听、上传队列、日志和网页登录同步会按当前配置运行。", "#15803D"),
            "pending" => ("设备待绑定或认证已失效，请输入新的设备授权码并点击保存并绑定。", "#B45309"),
            "disabled" => ("设备已被后台禁用，本地监听与上传已暂停，请联系管理员恢复后重试。", "#B91C1C"),
            "offline" => ("后台显示设备离线，当前客户端会继续尝试心跳和配置同步。", "#B45309"),
            _ => ("设备尚未绑定，请输入授权码完成绑定。", "#64748B")
        };

        BindingStatusHintText.Text = message;
        BindingStatusHintText.Foreground = BuildBrush(color, "#64748B");
    }

    private bool ApplyWebLoginOwnerToDefaultFields(UploadOwnerContext owner, bool overwrite)
    {
        if (!owner.HasContext) return false;

        var changed = false;
        var defaults = CollectorWebLoginOwnerDefaultPolicy.Resolve(owner);
        var wasLoadingUi = _isLoadingUi;
        _isLoadingUi = true;
        try
        {
            changed |= SetDefaultUploadField(EnterpriseCodeBox, defaults.EnterpriseCode, overwrite);
            changed |= SetDefaultUploadField(DefaultUserIdBox, defaults.DefaultUserId, overwrite);
            changed |= SetDefaultUploadField(DefaultUsernameBox, defaults.DefaultUsername, overwrite);
            changed |= SetDefaultUploadField(DefaultRoleBox, defaults.DefaultRole, overwrite);
        }
        finally
        {
            _isLoadingUi = wasLoadingUi;
        }

        if (!changed) return false;

        _config.EnterpriseCode = EnterpriseCodeBox.Text.Trim();
        _config.DefaultUserId = DefaultUserIdBox.Text.Trim();
        _config.DefaultUsername = DefaultUsernameBox.Text.Trim();
        _config.DefaultRole = DefaultRoleBox.Text.Trim();
        _logService.UpdateContext(_config);
        return true;
    }

    private static System.Windows.Media.Brush BuildBrush(string colorText, string fallbackColorText)
    {
        try
        {
            if (System.Windows.Media.ColorConverter.ConvertFromString(colorText) is System.Windows.Media.Color color)
            {
                return new SolidColorBrush(color);
            }
        }
        catch
        {
        }

        if (System.Windows.Media.ColorConverter.ConvertFromString(fallbackColorText) is System.Windows.Media.Color fallbackColor)
        {
            return new SolidColorBrush(fallbackColor);
        }

        return System.Windows.Media.Brushes.SlateGray;
    }

    private async Task<bool> TryProbeWebLoginOwnerAsync()
    {
        if (Browser.CoreWebView2 is null) return false;

        try
        {
            var resultJson = await Browser.CoreWebView2.ExecuteScriptAsync("""
                (async function () {
                  try {
                    if (!window.eiscoreCollectorLog || !window.eiscoreCollectorLog.syncLoginContext) return false;
                    return await window.eiscoreCollectorLog.syncLoginContext();
                  } catch (_) {
                    return false;
                  }
                })();
                """);
            await Task.Delay(250);
            return string.Equals((resultJson ?? "").Trim(), "true", StringComparison.OrdinalIgnoreCase)
                || _webViewLogBridge.CurrentUploadOwner.HasContext;
        }
        catch (Exception ex)
        {
            await LogBestEffortAsync(
                "warn",
                "collector_web_login_owner_probe_failed",
                "主动刷新网页登录用户失败。",
                ex.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new { _config.ServerBaseUrl }));
            return false;
        }
    }

    private static bool SetDefaultUploadField(System.Windows.Controls.TextBox textBox, string value, bool overwrite)
    {
        var next = (value ?? "").Trim();
        if (string.IsNullOrWhiteSpace(next)) return false;
        if (!overwrite && !string.IsNullOrWhiteSpace(textBox.Text)) return false;
        if (string.Equals(textBox.Text?.Trim() ?? "", next, StringComparison.Ordinal)) return false;
        textBox.Text = next;
        return true;
    }

    private static string FormatIdentityPair(string id, string name)
    {
        var normalizedId = (id ?? "").Trim();
        var normalizedName = (name ?? "").Trim();
        if (string.IsNullOrWhiteSpace(normalizedId)) return normalizedName;
        if (string.IsNullOrWhiteSpace(normalizedName)) return normalizedId;
        return string.Equals(normalizedId, normalizedName, StringComparison.Ordinal)
            ? normalizedId
            : $"{normalizedId} / {normalizedName}";
    }

    private static string DisplayIdentityValue(string value)
    {
        return string.IsNullOrWhiteSpace(value) ? "未同步" : value.Trim();
    }

    private static string FormatWebLoginSource(string source)
    {
        source = (source ?? "").Trim();
        if (string.IsNullOrWhiteSpace(source)) return "";

        if (source.StartsWith("localStorage:", StringComparison.Ordinal))
        {
            return "浏览器本地存储 " + source["localStorage:".Length..];
        }

        if (source.StartsWith("sessionStorage:", StringComparison.Ordinal))
        {
            return "浏览器会话存储 " + source["sessionStorage:".Length..];
        }

        if (source.StartsWith("/", StringComparison.Ordinal))
        {
            return "当前用户接口 " + source;
        }

        return source;
    }

    private static string FormatWebLoginSyncedAt(DateTimeOffset? syncedAt)
    {
        return syncedAt?.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss") ?? "";
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return "";
    }

    private void SetStatus(string message)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(() => SetStatus(message));
            return;
        }

        _lastStatusMessage = string.IsNullOrWhiteSpace(message)
            ? "等待运行状态"
            : message.Trim();
        StatusText.Text = $"{DateTime.Now:HH:mm:ss} {_lastStatusMessage}";
        UpdateShellRuntimeStatus();
    }

    private void UpdateShellRuntimeStatus()
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(UpdateShellRuntimeStatus);
            return;
        }

        var statusText = BuildShellRuntimeStatusText();
        var statusBrush = ResolveShellRuntimeStatusBrush(_config);
        ShellRuntimeStatusText.Text = statusText;
        ShellRuntimeStatusBadge.ToolTip = statusText;
        ShellRuntimeStatusDot.Fill = statusBrush;
        ShellRuntimeStatusBadge.BorderBrush = statusBrush;
    }

    private string BuildShellRuntimeStatusText()
    {
        var deviceStatus = ResolveShellDeviceStatusText(_config);
        var enabledWatchFolderCount = _config.WatchFolders?.Count(item => item.Enabled) ?? 0;
        var watchFolderStatus = enabledWatchFolderCount > 0
            ? $"监听 {enabledWatchFolderCount} 个目录"
            : "未配置监听目录";
        return $"{deviceStatus} · {watchFolderStatus} · {_lastStatusMessage}";
    }

    private static string ResolveShellDeviceStatusText(AppConfig config)
    {
        if (IsDeviceDisabled(config)) return "设备已禁用";
        if (CollectorDeviceAccessPolicy.IsPending(config)) return "设备待绑定";

        var status = config.DeviceStatus?.Trim() ?? "";
        return status.ToLowerInvariant() switch
        {
            "" => "设备未绑定",
            "active" => "设备已绑定",
            "enabled" => "设备已绑定",
            _ => $"设备 {status}"
        };
    }

    private static SolidColorBrush ResolveShellRuntimeStatusBrush(AppConfig config)
    {
        if (IsDeviceDisabled(config)) return CreateFrozenBrush(220, 38, 38);
        if (CollectorDeviceAccessPolicy.IsPending(config)) return CreateFrozenBrush(217, 119, 6);
        if (string.IsNullOrWhiteSpace(config.DeviceStatus)) return CreateFrozenBrush(100, 116, 139);
        return CreateFrozenBrush(22, 163, 74);
    }

    private static SolidColorBrush CreateFrozenBrush(byte red, byte green, byte blue)
    {
        var brush = new SolidColorBrush(System.Windows.Media.Color.FromRgb(red, green, blue));
        brush.Freeze();
        return brush;
    }

    private static string FormatBytes(long bytes)
    {
        string[] units = { "B", "KB", "MB", "GB" };
        var size = (double)bytes;
        var index = 0;
        while (size >= 1024 && index < units.Length - 1)
        {
            size /= 1024;
            index++;
        }

        return $"{size:0.##} {units[index]}";
    }
}
