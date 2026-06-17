using System.ComponentModel;
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

            LoadConfigToUi();
            InitializeTrayIcon();

            await _webViewLogBridge.InitializeAsync(Browser);
            NavigateToConfiguredServer();

            _watchFolderService.Restart(_config);
            _uploadProcessor.Start();
            _logProcessor.Start();
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
        WatchFolderBox.Text = folderPath;
        _config.WatchFolders = new List<WatchFolderConfig>
        {
            new()
            {
                FolderPath = folderPath,
                FolderName = Path.GetFileName(folderPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)),
                DefaultUserId = DefaultUserIdBox.Text.Trim(),
                DefaultRole = DefaultRoleBox.Text.Trim(),
                Enabled = true
            }
        };
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
            WatchFolderBox.Text = _config.WatchFolders.FirstOrDefault(item => item.Enabled)?.FolderPath ?? "";
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

        var folderPath = WatchFolderBox.Text.Trim();
        if (!string.IsNullOrWhiteSpace(folderPath))
        {
            _config.WatchFolders = new List<WatchFolderConfig>
            {
                new()
                {
                    FolderPath = folderPath,
                    FolderName = Path.GetFileName(folderPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)),
                    DefaultUserId = _config.DefaultUserId,
                    DefaultRole = _config.DefaultRole,
                    Enabled = true
                }
            };
        }
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
