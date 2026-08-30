using System.Collections.Concurrent;
using System.IO;
using System.Text.Json;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class WatchFolderService : IDisposable
{
    private readonly CollectorFileService _fileService;
    private readonly ClientLogService _logService;
    private readonly Func<AppConfig> _configProvider;
    private readonly List<FileSystemWatcher> _watchers = new();
    private readonly ConcurrentDictionary<string, WatchFolderConfig> _watchFolderConfigs = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, DateTimeOffset> _recentEvents = new(StringComparer.OrdinalIgnoreCase);

    public WatchFolderService(
        CollectorFileService fileService,
        ClientLogService logService,
        Func<AppConfig> configProvider)
    {
        _fileService = fileService;
        _logService = logService;
        _configProvider = configProvider;
    }

    public void Restart(AppConfig config)
    {
        Stop();

        foreach (var folder in (config.WatchFolders ?? new List<WatchFolderConfig>()).Where(item => item.Enabled))
        {
            if (string.IsNullOrWhiteSpace(folder.FolderPath) || !Directory.Exists(folder.FolderPath))
            {
                _ = _logService.LogAsync(
                    "warn",
                    "file_watch_error",
                    $"监听目录不存在：{folder.FolderPath}",
                    metadataJson: BuildWatchFolderMetadata(folder));
                continue;
            }

            var watcher = new FileSystemWatcher(folder.FolderPath)
            {
                IncludeSubdirectories = false,
                EnableRaisingEvents = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size
            };
            watcher.Created += Watcher_FileChanged;
            watcher.Renamed += Watcher_FileRenamed;
            watcher.Error += Watcher_Error;
            _watchers.Add(watcher);
            _watchFolderConfigs[watcher.Path] = CloneWatchFolder(folder);

            _ = _logService.LogAsync(
                "info",
                "file_watch_started",
                $"已启动监听目录：{folder.FolderPath}",
                metadataJson: BuildWatchFolderMetadata(folder));
        }
    }

    public void Stop()
    {
        foreach (var watcher in _watchers)
        {
            watcher.EnableRaisingEvents = false;
            watcher.Created -= Watcher_FileChanged;
            watcher.Renamed -= Watcher_FileRenamed;
            watcher.Error -= Watcher_Error;
            watcher.Dispose();
        }

        _watchers.Clear();
        _watchFolderConfigs.Clear();
    }

    public void Dispose()
    {
        Stop();
    }

    private void Watcher_FileChanged(object sender, FileSystemEventArgs e)
    {
        QueuePath(e.FullPath, ResolveWatchFolder(sender));
    }

    private void Watcher_FileRenamed(object sender, RenamedEventArgs e)
    {
        QueuePath(e.FullPath, ResolveWatchFolder(sender));
    }

    private void Watcher_Error(object sender, ErrorEventArgs e)
    {
        _ = _logService.LogAsync("error", "file_watch_error", "文件夹监听异常", e.GetException().ToString());
    }

    private void QueuePath(string path, WatchFolderConfig? folder)
    {
        if (Directory.Exists(path)) return;

        var now = DateTimeOffset.Now;
        if (_recentEvents.TryGetValue(path, out var last) && now - last < TimeSpan.FromSeconds(2))
        {
            return;
        }

        _recentEvents[path] = now;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(1200);
                await _fileService.EnqueueFileAsync(path, "watch_folder", BuildQueueConfig(_configProvider(), folder), folder);
            }
            catch (Exception ex)
            {
                await _logService.LogAsync(
                    "error",
                    "file_watch_error",
                    $"监听文件入队失败：{path}",
                    ex.ToString(),
                    metadataJson: folder is null ? "{}" : BuildWatchFolderMetadata(folder));
            }
        });
    }

    private WatchFolderConfig? ResolveWatchFolder(object sender)
    {
        return sender is FileSystemWatcher watcher && _watchFolderConfigs.TryGetValue(watcher.Path, out var folder)
            ? folder
            : null;
    }

    private static AppConfig BuildQueueConfig(AppConfig config, WatchFolderConfig? folder)
    {
        if (folder is null) return config;

        var folderUserId = (folder.DefaultUserId ?? "").Trim();
        var defaultUserId = FirstNonEmpty(folderUserId, config.DefaultUserId);
        var defaultUsername = ResolveWatchFolderUsername(folder, config);

        return new AppConfig
        {
            ServerBaseUrl = config.ServerBaseUrl,
            EnterpriseCode = config.EnterpriseCode,
            DeviceId = config.DeviceId,
            DeviceCode = config.DeviceCode,
            DeviceName = config.DeviceName,
            DefaultUserId = defaultUserId,
            DefaultUsername = defaultUsername,
            DefaultRole = FirstNonEmpty(folder.DefaultRole, config.DefaultRole),
            EncryptedDeviceToken = config.EncryptedDeviceToken,
            ClientVersion = config.ClientVersion,
            WatchFolders = config.WatchFolders,
            AutoStartEnabled = config.AutoStartEnabled,
            RemoteConfigVersion = config.RemoteConfigVersion,
            MaxUploadBytes = config.MaxUploadBytes,
            ChunkSizeBytes = config.ChunkSizeBytes,
            UploadRetryIntervalSeconds = config.UploadRetryIntervalSeconds,
            UploadMaxRetryCount = config.UploadMaxRetryCount,
            AllowedExtensions = new List<string>(config.AllowedExtensions ?? new List<string>()),
            LogBatchSize = config.LogBatchSize,
            LogFlushIntervalSeconds = config.LogFlushIntervalSeconds,
            LogRetentionDays = config.LogRetentionDays,
            HighPriorityLogImmediate = config.HighPriorityLogImmediate,
            HeartbeatIntervalSeconds = config.HeartbeatIntervalSeconds,
            AutoUpdateEnabled = config.AutoUpdateEnabled,
            UpdateManifestUrl = config.UpdateManifestUrl,
            UpdateCheckIntervalHours = config.UpdateCheckIntervalHours,
            AutoUpdateInstallEnabled = config.AutoUpdateInstallEnabled,
            UpdateInstallerArguments = config.UpdateInstallerArguments,
            PendingUpdateVersion = config.PendingUpdateVersion,
            PendingUpdateInstallerPath = config.PendingUpdateInstallerPath,
            LastBoundAt = config.LastBoundAt,
            LastRemoteConfigAt = config.LastRemoteConfigAt,
            LastUpdateCheckAt = config.LastUpdateCheckAt,
            UpdatedAt = config.UpdatedAt
        };
    }

    private static WatchFolderConfig CloneWatchFolder(WatchFolderConfig folder)
    {
        return new WatchFolderConfig
        {
            FolderPath = folder.FolderPath,
            FolderName = folder.FolderName,
            DefaultUserId = folder.DefaultUserId,
            DefaultUsername = folder.DefaultUsername,
            DefaultRole = folder.DefaultRole,
            Source = folder.Source,
            Enabled = folder.Enabled
        };
    }

    private static string ResolveWatchFolderUsername(WatchFolderConfig folder, AppConfig config)
    {
        if (!string.IsNullOrWhiteSpace(folder.DefaultUsername))
        {
            return folder.DefaultUsername.Trim();
        }

        if (string.IsNullOrWhiteSpace(folder.DefaultUserId)
            || string.Equals(folder.DefaultUserId.Trim(), config.DefaultUserId, StringComparison.OrdinalIgnoreCase))
        {
            return config.DefaultUsername;
        }

        return "";
    }

    private static string FirstNonEmpty(params string[] values)
    {
        return values
            .Select(value => (value ?? "").Trim())
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";
    }

    private static string BuildWatchFolderMetadata(WatchFolderConfig folder)
    {
        return JsonSerializer.Serialize(new
        {
            folder_path = folder.FolderPath,
            folder_name = folder.FolderName,
            default_user_id = folder.DefaultUserId,
            default_username = folder.DefaultUsername,
            default_role = folder.DefaultRole,
            watch_folder_source = string.IsNullOrWhiteSpace(folder.Source)
                ? WatchFolderSource.LocalSettings
                : folder.Source.Trim()
        });
    }
}
