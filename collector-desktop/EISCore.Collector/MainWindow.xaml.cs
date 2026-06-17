using System.ComponentModel;
using System.Text.Json;
using System.Windows;
using System.Windows.Threading;
using EISCore.Collector.Models;
using EISCore.Collector.Services;
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
    private readonly DeviceBindingService _bindingService;
    private readonly CollectorFileService _fileService;
    private readonly WebViewLogBridge _webViewLogBridge;
    private readonly UploadQueueProcessor _uploadProcessor;
    private readonly LogUploadProcessor _logProcessor;
    private readonly WatchFolderService _watchFolderService;
    private readonly DispatcherTimer _heartbeatTimer = new();

    private AppConfig _config = new();
    private string _deviceToken = "";
    private Forms.NotifyIcon? _trayIcon;
    private bool _isExitRequested;
    private bool _isLoadingUi;

    public MainWindow()
    {
        InitializeComponent();

        _logService = new ClientLogService(_logStore);
        _bindingService = new DeviceBindingService(_apiClient, _configurationService);
        _fileService = new CollectorFileService(_queueStore, _logService);
        _webViewLogBridge = new WebViewLogBridge(_logService);
        _uploadProcessor = new UploadQueueProcessor(
            _queueStore,
            _apiClient,
            _logService,
            () => _config,
            () => _deviceToken);
        _logProcessor = new LogUploadProcessor(
            _logStore,
            _apiClient,
            () => _config,
            () => _deviceToken);
        _watchFolderService = new WatchFolderService(_fileService, _logService, () => _config);

        Loaded += MainWindow_Loaded;
        _fileService.QueueChanged += QueueChanged;
        _uploadProcessor.QueueChanged += QueueChanged;
        _logService.HighPriorityLogWritten += LogService_HighPriorityLogWritten;
        _heartbeatTimer.Interval = TimeSpan.FromMinutes(1);
        _heartbeatTimer.Tick += HeartbeatTimer_Tick;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await _queueStore.EnsureCreatedAsync();
            await _logStore.EnsureCreatedAsync();

            _config = await _configurationService.LoadAsync();
            _deviceToken = _configurationService.UnprotectToken(_config.EncryptedDeviceToken);
            _logService.UpdateContext(_config);
            await ReportPendingCrashDumpsAsync();

            LoadConfigToUi();
            InitializeTrayIcon();

            await _webViewLogBridge.InitializeAsync(Browser);
            NavigateToConfiguredServer();
            await SyncRemoteConfigAsync();

            _watchFolderService.Restart(_config);
            _uploadProcessor.Start();
            _logProcessor.Start();
            UpdateHeartbeatTimerInterval();
            _heartbeatTimer.Start();

            await _logService.LogAsync("info", "collector_start", "采集端启动。");
            await RefreshQueueAsync();
            SetStatus("采集端已启动。");
        }
        catch (Exception ex)
        {
            SetStatus("初始化失败：" + ex.Message);
            await _logService.LogAsync("error", "collector_start_failed", "采集端初始化失败。", ex.ToString());
        }
    }

    private async void BindDevice_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            UpdateConfigFromUi();
            var authorizationCode = AuthorizationCodeBox.Password.Trim();
            if (string.IsNullOrWhiteSpace(authorizationCode))
            {
                SetStatus("请输入设备授权码。");
                return;
            }

            SetStatus("正在绑定设备...");
            _config = await _bindingService.BindAsync(_config, authorizationCode);
            _deviceToken = _configurationService.UnprotectToken(_config.EncryptedDeviceToken);
            _logService.UpdateContext(_config);
            LoadConfigToUi();
            await SyncRemoteConfigAsync();
            _watchFolderService.Restart(_config);
            NavigateToConfiguredServer();
            await _logService.LogAsync("info", "collector_bound", "设备绑定成功。");
            SetStatus("设备绑定成功。");
        }
        catch (Exception ex)
        {
            SetStatus("设备绑定失败：" + ex.Message);
            await _logService.LogAsync("error", "collector_bind_failed", "设备绑定失败。", ex.ToString());
        }
    }

    private async void SaveConfig_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            UpdateConfigFromUi();
            await _configurationService.SaveAsync(_config);
            _logService.UpdateContext(_config);
            _watchFolderService.Restart(_config);
            NavigateToConfiguredServer();
            SetStatus("配置已保存。");
        }
        catch (Exception ex)
        {
            SetStatus("保存配置失败：" + ex.Message);
            await _logService.LogAsync("error", "collector_config_save_failed", "保存配置失败。", ex.ToString());
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

        var folderPath = dialog.SelectedPath;
        var existing = _config.WatchFolders.FirstOrDefault(item =>
            string.Equals(item.FolderPath, folderPath, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.Enabled = true;
            existing.DefaultUserId = string.IsNullOrWhiteSpace(existing.DefaultUserId)
                ? DefaultUserIdBox.Text.Trim()
                : existing.DefaultUserId;
            existing.DefaultRole = string.IsNullOrWhiteSpace(existing.DefaultRole)
                ? DefaultRoleBox.Text.Trim()
                : existing.DefaultRole;
        }
        else
        {
            _config.WatchFolders.Add(
                new WatchFolderConfig
                {
                    FolderPath = folderPath,
                    FolderName = GetFolderDisplayName(folderPath),
                    DefaultUserId = DefaultUserIdBox.Text.Trim(),
                    DefaultRole = DefaultRoleBox.Text.Trim(),
                    Enabled = true
                });
        }

        RefreshWatchFolderList();
        SetStatus("监听目录已添加，保存配置后持久化。");
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
            .Select((folder, index) =>
            {
                var status = folder.Enabled ? "启用" : "停用";
                var name = string.IsNullOrWhiteSpace(folder.FolderName) ? GetFolderDisplayName(folder.FolderPath) : folder.FolderName;
                var owner = string.Join(" / ", new[] { folder.DefaultUserId, folder.DefaultRole }.Where(item => !string.IsNullOrWhiteSpace(item)));
                var suffix = string.IsNullOrWhiteSpace(owner) ? "" : $"  默认：{owner}";
                return $"{index + 1}. [{status}] {name}  {folder.FolderPath}{suffix}";
            })
            .ToList();

        if (selectedIndex >= 0 && selectedIndex < WatchFolderList.Items.Count)
        {
            WatchFolderList.SelectedIndex = selectedIndex;
        }
    }

    private void RestartWatchers_Click(object sender, RoutedEventArgs e)
    {
        UpdateConfigFromUi();
        _watchFolderService.Restart(_config);
        SetStatus("监听目录已重新启动。");
    }

    private async void ChooseFiles_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Title = "选择要采集的文件",
            Multiselect = true,
            Filter = "业务资料|*.xlsx;*.xls;*.csv;*.docx;*.doc;*.pdf;*.jpg;*.jpeg;*.png;*.bmp;*.gif;*.webp;*.txt;*.zip;*.rar;*.7z|所有文件|*.*"
        };

        if (dialog.ShowDialog() != true) return;
        await EnqueueFilesAsync(dialog.FileNames, "manual_selected_file");
    }

    private async void ProcessQueue_Click(object sender, RoutedEventArgs e)
    {
        SetStatus("正在处理上传队列...");
        await _uploadProcessor.ProcessOnceAsync();
        await RefreshQueueAsync();
        SetStatus("上传队列处理完成。");
    }

    private async void AutoStartBox_Changed(object sender, RoutedEventArgs e)
    {
        if (_isLoadingUi) return;

        try
        {
            _config.AutoStartEnabled = AutoStartBox.IsChecked == true;
            StartupService.SetEnabled(_config.AutoStartEnabled);
            await _configurationService.SaveAsync(_config);
            SetStatus(_config.AutoStartEnabled ? "已启用开机自启。" : "已关闭开机自启。");
        }
        catch (Exception ex)
        {
            SetStatus("更新开机自启失败：" + ex.Message);
            await _logService.LogAsync("error", "collector_autostart_failed", "更新开机自启失败。", ex.ToString());
        }
    }

    private void ConfigTextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        if (_isLoadingUi) return;
        SetStatus("配置已修改，保存后生效。");
    }

    private void Window_DragOver(object sender, DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop)
            ? DragDropEffects.Copy
            : DragDropEffects.None;
        e.Handled = true;
    }

    private async void Window_Drop(object sender, DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(DataFormats.FileDrop)) return;
        if (e.Data.GetData(DataFormats.FileDrop) is not string[] paths) return;

        e.Handled = true;
        await EnqueueFilesAsync(paths.Where(File.Exists), "manual_drag_drop");
    }

    private async void HeartbeatTimer_Tick(object? sender, EventArgs e)
    {
        try
        {
            await _apiClient.SendHeartbeatAsync(_config, _deviceToken);
            await SyncRemoteConfigAsync();
            await _logProcessor.FlushAsync();
        }
        catch (Exception ex)
        {
            await _logService.LogAsync("warn", "collector_heartbeat_failed", "采集端心跳上报失败。", ex.ToString());
        }
    }

    private async void QueueChanged(object? sender, EventArgs e)
    {
        await RefreshQueueAsync();
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

    private async Task EnqueueFilesAsync(IEnumerable<string> paths, string uploadSource)
    {
        UpdateConfigFromUi();
        var fileList = paths.Where(File.Exists).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (fileList.Count == 0) return;

        SetStatus($"正在入队 {fileList.Count} 个文件...");
        foreach (var filePath in fileList)
        {
            await _fileService.EnqueueFileAsync(filePath, uploadSource, _config);
        }

        await RefreshQueueAsync();
        SetStatus($"{fileList.Count} 个文件已处理入队。");
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
                await _logService.LogAsync(
                    "warn",
                    "collector_crash_dump_report_failed",
                    $"崩溃报告读取失败：{manifestPath}",
                    ex.ToString());
            }
        }
    }

    private async Task SyncRemoteConfigAsync()
    {
        if (string.IsNullOrWhiteSpace(_config.ServerBaseUrl) || string.IsNullOrWhiteSpace(_deviceToken))
        {
            return;
        }

        try
        {
            var response = await _apiClient.GetDeviceConfigAsync(_config, _deviceToken);
            if (response is null || response.Config is null) return;

            var (changed, watchFoldersChanged) = ApplyRemoteConfig(response);
            if (!changed) return;

            await _configurationService.SaveAsync(_config);
            _logService.UpdateContext(_config);
            UpdateHeartbeatTimerInterval();
            LoadConfigToUi();
            if (watchFoldersChanged)
            {
                _watchFolderService.Restart(_config);
            }

            await _logService.LogAsync(
                "info",
                "collector_config_synced",
                "远程配置已同步。",
                metadataJson: $$"""{"config_version":"{{_config.RemoteConfigVersion}}"}""");
        }
        catch (Exception ex)
        {
            await _logService.LogAsync("warn", "collector_config_sync_failed", "远程配置同步失败。", ex.ToString());
        }
    }

    private (bool Changed, bool WatchFoldersChanged) ApplyRemoteConfig(DeviceConfigResponse response)
    {
        var changed = false;
        var watchFoldersChanged = false;
        var remote = response.Config;
        remote.Upload ??= new CollectorUploadPolicy();
        remote.Logs ??= new CollectorLogPolicy();
        remote.WatchFolders ??= new List<WatchFolderConfig>();

        changed |= SetIfNotEmpty(value => _config.DeviceId = value, _config.DeviceId, response.Device.DeviceId);
        changed |= SetIfNotEmpty(value => _config.DeviceCode = value, _config.DeviceCode, response.Device.DeviceCode);
        changed |= SetIfNotEmpty(value => _config.DeviceName = value, _config.DeviceName, response.Device.DeviceName);
        changed |= SetIfNotEmpty(value => _config.DefaultUserId = value, _config.DefaultUserId, remote.DefaultUserId);
        changed |= SetIfNotEmpty(value => _config.DefaultUsername = value, _config.DefaultUsername, remote.DefaultUsername);
        changed |= SetIfNotEmpty(value => _config.DefaultRole = value, _config.DefaultRole, remote.DefaultRole);

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

        var allowedExtensions = NormalizeExtensions(remote.Upload.AllowedExtensions);
        if (!SequenceEquals(_config.AllowedExtensions, allowedExtensions))
        {
            _config.AllowedExtensions = allowedExtensions;
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

        if (remote.AutoStartEnabled.HasValue && _config.AutoStartEnabled != remote.AutoStartEnabled.Value)
        {
            _config.AutoStartEnabled = remote.AutoStartEnabled.Value;
            StartupService.SetEnabled(_config.AutoStartEnabled);
            changed = true;
        }

        if (remote.WatchFolders.Count > 0)
        {
            var folders = remote.WatchFolders
                .Where(item => !string.IsNullOrWhiteSpace(item.FolderPath))
                .Select(item => new WatchFolderConfig
                {
                    FolderPath = item.FolderPath.Trim(),
                    FolderName = string.IsNullOrWhiteSpace(item.FolderName)
                        ? Path.GetFileName(item.FolderPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar))
                        : item.FolderName.Trim(),
                    DefaultUserId = string.IsNullOrWhiteSpace(item.DefaultUserId) ? _config.DefaultUserId : item.DefaultUserId.Trim(),
                    DefaultRole = string.IsNullOrWhiteSpace(item.DefaultRole) ? _config.DefaultRole : item.DefaultRole.Trim(),
                    Enabled = item.Enabled
                })
                .ToList();
            if (!WatchFoldersEqual(_config.WatchFolders, folders))
            {
                _config.WatchFolders = folders;
                changed = true;
                watchFoldersChanged = true;
            }
        }

        if (!string.Equals(_config.RemoteConfigVersion, response.ConfigVersion, StringComparison.Ordinal))
        {
            _config.RemoteConfigVersion = response.ConfigVersion;
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

    private static bool SetIfNotEmpty(Action<string> assign, string currentValue, string newValue)
    {
        var normalized = (newValue ?? "").Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return false;
        if (string.Equals(currentValue ?? "", normalized, StringComparison.Ordinal)) return false;
        assign(normalized);
        return true;
    }

    private static List<string> NormalizeExtensions(IEnumerable<string>? extensions)
    {
        return (extensions ?? Enumerable.Empty<string>())
            .Select(item => (item ?? "").Trim().ToLowerInvariant())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.StartsWith('.') ? item : "." + item)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool SequenceEquals(IReadOnlyList<string> left, IReadOnlyList<string> right)
    {
        return left.Count == right.Count
            && left.Zip(right).All(pair => string.Equals(pair.First, pair.Second, StringComparison.OrdinalIgnoreCase));
    }

    private static bool WatchFoldersEqual(IReadOnlyList<WatchFolderConfig> left, IReadOnlyList<WatchFolderConfig> right)
    {
        if (left.Count != right.Count) return false;
        return left.Zip(right).All(pair =>
            string.Equals(pair.First.FolderPath, pair.Second.FolderPath, StringComparison.OrdinalIgnoreCase)
            && string.Equals(pair.First.FolderName, pair.Second.FolderName, StringComparison.Ordinal)
            && string.Equals(pair.First.DefaultUserId, pair.Second.DefaultUserId, StringComparison.Ordinal)
            && string.Equals(pair.First.DefaultRole, pair.Second.DefaultRole, StringComparison.Ordinal)
            && pair.First.Enabled == pair.Second.Enabled);
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
            .Select(item => $"#{item.Id} [{item.Status}] {item.OriginalFilename} ({FormatBytes(item.FileSize)})")
            .ToList();
    }

    private void LoadConfigToUi()
    {
        _isLoadingUi = true;
        try
        {
            ServerBaseUrlBox.Text = _config.ServerBaseUrl;
            EnterpriseCodeBox.Text = _config.EnterpriseCode;
            DeviceCodeBox.Text = _config.DeviceCode;
            DeviceNameBox.Text = _config.DeviceName;
            DefaultUserIdBox.Text = _config.DefaultUserId;
            DefaultUsernameBox.Text = _config.DefaultUsername;
            DefaultRoleBox.Text = _config.DefaultRole;
            RefreshWatchFolderList();
            AutoStartBox.IsChecked = _config.AutoStartEnabled || StartupService.IsEnabled();
        }
        finally
        {
            _isLoadingUi = false;
        }
    }

    private void UpdateConfigFromUi()
    {
        _config.ServerBaseUrl = ServerBaseUrlBox.Text.Trim();
        _config.EnterpriseCode = EnterpriseCodeBox.Text.Trim();
        _config.DeviceCode = DeviceCodeBox.Text.Trim();
        _config.DeviceName = DeviceNameBox.Text.Trim();
        _config.DefaultUserId = DefaultUserIdBox.Text.Trim();
        _config.DefaultUsername = DefaultUsernameBox.Text.Trim();
        _config.DefaultRole = DefaultRoleBox.Text.Trim();
        _config.AutoStartEnabled = AutoStartBox.IsChecked == true;
        NormalizeWatchFolders();
    }

    private void NormalizeWatchFolders()
    {
        var normalized = new List<WatchFolderConfig>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var folder in _config.WatchFolders ?? new List<WatchFolderConfig>())
        {
            var folderPath = (folder.FolderPath ?? "").Trim();
            if (string.IsNullOrWhiteSpace(folderPath)) continue;
            if (!seen.Add(folderPath)) continue;

            normalized.Add(new WatchFolderConfig
            {
                FolderPath = folderPath,
                FolderName = string.IsNullOrWhiteSpace(folder.FolderName)
                    ? GetFolderDisplayName(folderPath)
                    : folder.FolderName.Trim(),
                DefaultUserId = string.IsNullOrWhiteSpace(folder.DefaultUserId)
                    ? _config.DefaultUserId
                    : folder.DefaultUserId.Trim(),
                DefaultRole = string.IsNullOrWhiteSpace(folder.DefaultRole)
                    ? _config.DefaultRole
                    : folder.DefaultRole.Trim(),
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

    private void NavigateToConfiguredServer()
    {
        if (Browser.CoreWebView2 is null) return;

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
                    <h1>EISCore 采集端</h1>
                    <p>请先在左侧配置服务器地址并绑定设备。绑定后这里会打开 EISCore 网站，原生端会继续负责本地文件采集、队列和日志。</p>
                  </section>
                </main>
              </body>
            </html>
            """);
    }

    private void InitializeTrayIcon()
    {
        if (_trayIcon is not null) return;

        _trayIcon = new Forms.NotifyIcon
        {
            Text = "EISCore 采集端",
            Icon = System.Drawing.SystemIcons.Application,
            Visible = true,
            ContextMenuStrip = new Forms.ContextMenuStrip()
        };
        _trayIcon.ContextMenuStrip.Items.Add("显示", null, (_, _) => Dispatcher.Invoke(ShowFromTray));
        _trayIcon.ContextMenuStrip.Items.Add("退出", null, (_, _) => Dispatcher.Invoke(ExitApplication));
        _trayIcon.DoubleClick += (_, _) => Dispatcher.Invoke(ShowFromTray);
    }

    private void ShowFromTray()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private async void ExitApplication()
    {
        _isExitRequested = true;
        _heartbeatTimer.Stop();
        _watchFolderService.Stop();
        await _uploadProcessor.StopAsync();
        await _logProcessor.FlushAsync();
        await _logProcessor.StopAsync();
        _trayIcon?.Dispose();
        Close();
        Application.Current.Shutdown();
    }

    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        if (_isExitRequested) return;

        e.Cancel = true;
        Hide();
        SetStatus("采集端已最小化到托盘。");
    }

    private void SetStatus(string message)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(() => SetStatus(message));
            return;
        }

        StatusText.Text = $"{DateTime.Now:HH:mm:ss} {message}";
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
