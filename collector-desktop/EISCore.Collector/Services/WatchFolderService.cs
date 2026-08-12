using System.Collections.Concurrent;
using System.IO;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class WatchFolderService : IDisposable
{
    private const int RecentEventSoftLimit = 4096;
    private const int MaxRecoverableEnqueueRetries = 3;
    private static readonly TimeSpan RecentEventRetention = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan RecoverableEnqueueRetryDelay = TimeSpan.FromSeconds(30);

    private readonly CollectorFileService _fileService;
    private readonly ClientLogService _logService;
    private readonly Func<AppConfig> _configProvider;
    private readonly Func<string, bool> _directoryExists;
    private readonly Func<string, bool> _directoryAccessible;
    private readonly Func<TimeSpan, Task> _retryDelay;
    private readonly List<FileSystemWatcher> _watchers = new();
    private readonly ConcurrentDictionary<FileSystemWatcher, int> _watcherGenerations = new();
    private readonly ConcurrentDictionary<string, DateTimeOffset> _recentEvents = new(StringComparer.OrdinalIgnoreCase);
    private int _watchGeneration;

    public WatchFolderService(
        CollectorFileService fileService,
        ClientLogService logService,
        Func<AppConfig> configProvider,
        Func<string, bool>? directoryExists = null,
        Func<string, bool>? directoryAccessible = null,
        Func<TimeSpan, Task>? retryDelay = null)
    {
        _fileService = fileService;
        _logService = logService;
        _configProvider = configProvider;
        _directoryExists = directoryExists ?? Directory.Exists;
        _directoryAccessible = directoryAccessible ?? WatchFolderHealthPolicy.CanAccessDirectory;
        _retryDelay = retryDelay ?? (delay => Task.Delay(delay));
    }

    public void Restart(AppConfig config)
    {
        Stop();
        var generation = Interlocked.Increment(ref _watchGeneration);
        var startedFolders = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var folder in (config.WatchFolders ?? new List<WatchFolderConfig>()).Where(item => item.Enabled))
        {
            var folderPath = ConfigurationService.NormalizeText(folder.FolderPath, 1024);
            var folderKey = ConfigurationService.NormalizeWatchFolderKey(folderPath);
            if (string.IsNullOrWhiteSpace(folderKey) || !startedFolders.Add(folderKey))
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(folderPath) || !_directoryExists(folderPath))
            {
                CollectorBackgroundTask.Forget(_logService.LogAsync(
                    "warn",
                    "file_watch_error",
                    $"监听目录不存在：{folder.FolderPath}",
                    metadataJson: ClientLogMetadata.Serialize(new
                    {
                        sourceFolder = folderPath,
                        reason = "missing"
                    })));
                continue;
            }

            if (!_directoryAccessible(folderPath))
            {
                CollectorBackgroundTask.Forget(_logService.LogAsync(
                    "warn",
                    "file_watch_error",
                    $"监听目录不可访问：{folderPath}",
                    metadataJson: ClientLogMetadata.Serialize(new { sourceFolder = folderPath, reason = "inaccessible" })));
                continue;
            }

            try
            {
                var watcher = new FileSystemWatcher(folderPath)
                {
                    IncludeSubdirectories = true,
                    InternalBufferSize = 64 * 1024,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size
                };
                watcher.Created += Watcher_FileChanged;
                watcher.Changed += Watcher_FileChanged;
                watcher.Renamed += Watcher_FileRenamed;
                watcher.Error += Watcher_Error;
                _watcherGenerations[watcher] = generation;
                watcher.EnableRaisingEvents = true;
                _watchers.Add(watcher);

                CollectorBackgroundTask.Forget(_logService.LogAsync("info", "file_watch_started", $"已启动监听目录：{folderPath}"));
                QueueExistingFiles(folderPath, folderPath, generation);
            }
            catch (Exception ex)
            {
                CollectorBackgroundTask.Forget(_logService.LogAsync(
                    "error",
                    "file_watch_error",
                    $"监听目录启动失败：{folderPath}",
                    ex.ToString(),
                    metadataJson: ClientLogMetadata.Serialize(new { sourceFolder = folderPath })));
            }
        }
    }

    public void Stop()
    {
        Interlocked.Increment(ref _watchGeneration);
        foreach (var watcher in _watchers)
        {
            watcher.EnableRaisingEvents = false;
            watcher.Created -= Watcher_FileChanged;
            watcher.Changed -= Watcher_FileChanged;
            watcher.Renamed -= Watcher_FileRenamed;
            watcher.Error -= Watcher_Error;
            _watcherGenerations.TryRemove(watcher, out _);
            watcher.Dispose();
        }

        _watchers.Clear();
        _recentEvents.Clear();
    }

    public void Dispose()
    {
        Stop();
    }

    private void Watcher_FileChanged(object sender, FileSystemEventArgs e)
    {
        QueuePath(e.FullPath, (sender as FileSystemWatcher)?.Path ?? "", GetGeneration(sender));
    }

    private void Watcher_FileRenamed(object sender, RenamedEventArgs e)
    {
        QueuePath(e.FullPath, (sender as FileSystemWatcher)?.Path ?? "", GetGeneration(sender));
    }

    private void Watcher_Error(object sender, ErrorEventArgs e)
    {
        var sourceFolderPath = (sender as FileSystemWatcher)?.Path ?? "";
        CollectorBackgroundTask.Forget(_logService.LogAsync("error", "file_watch_error", "文件夹监听异常", e.GetException().ToString()));
        if (!string.IsNullOrWhiteSpace(sourceFolderPath) && _directoryExists(sourceFolderPath) && _directoryAccessible(sourceFolderPath))
        {
            QueueExistingFiles(sourceFolderPath, sourceFolderPath, GetGeneration(sender), isRecoveryScan: true);
        }
    }

    private void QueuePath(string path, string sourceFolderPath)
    {
        QueuePath(path, sourceFolderPath, Volatile.Read(ref _watchGeneration));
    }

    private void QueuePath(string path, string sourceFolderPath, int generation, int retryAttempt = 0)
    {
        if (Directory.Exists(path))
        {
            QueueExistingFiles(path, sourceFolderPath, generation, isDirectoryEventScan: true);
            return;
        }

        var now = DateTimeOffset.Now;
        PruneRecentEvents(now);
        if (retryAttempt == 0 && _recentEvents.TryGetValue(path, out var last) && now - last < TimeSpan.FromSeconds(2))
        {
            return;
        }

        _recentEvents[path] = now;

        CollectorBackgroundTask.Forget(Task.Run(async () =>
        {
            try
            {
                await Task.Delay(1200);
                if (generation != Volatile.Read(ref _watchGeneration))
                {
                    return;
                }

                var config = _configProvider();
                var folder = FindWatchFolder(config, sourceFolderPath);
                if (folder is null)
                {
                    await _logService.LogAsync(
                        "info",
                        "file_watch_ignored",
                        $"监听目录已停用，跳过文件：{path}",
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            sourceFolder = sourceFolderPath,
                            filePath = path
                        }));
                    return;
                }

                var outcome = await _fileService.EnqueueFileWithOutcomeAsync(path, "watch_folder", config, folder);
                if (outcome.ShouldRetryFromWatchFolder && retryAttempt < MaxRecoverableEnqueueRetries && File.Exists(path))
                {
                    ScheduleRecoverableRetry(path, sourceFolderPath, generation, retryAttempt + 1, outcome.Kind);
                }
                else if (outcome.ShouldRetryFromWatchFolder && retryAttempt >= MaxRecoverableEnqueueRetries && File.Exists(path))
                {
                    await _logService.LogAsync(
                        "warn",
                        "file_watch_retry_exhausted",
                        $"监听文件多次仍未稳定，等待后续目录扫描或文件事件：{path}",
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            sourceFolder = sourceFolderPath,
                            filePath = path,
                            outcome.Kind,
                            retryAttempt,
                            maxRetries = MaxRecoverableEnqueueRetries
                        }));
                }
            }
            catch (Exception ex)
            {
                await _logService.LogAsync("error", "file_watch_error", $"监听文件入队失败：{path}", ex.ToString());
            }
        }));
    }

    private void ScheduleRecoverableRetry(
        string path,
        string sourceFolderPath,
        int generation,
        int retryAttempt,
        CollectorFileEnqueueOutcomeKind reason)
    {
        CollectorBackgroundTask.Forget(Task.Run(async () =>
        {
            try
            {
                await _logService.LogAsync(
                    "info",
                    "file_watch_retry_scheduled",
                    $"监听文件暂未稳定，已安排第 {retryAttempt} 次重试：{path}",
                    metadataJson: ClientLogMetadata.Serialize(new
                    {
                        sourceFolder = sourceFolderPath,
                        filePath = path,
                        reason,
                        retryAttempt,
                        maxRetries = MaxRecoverableEnqueueRetries,
                        retryDelaySeconds = (int)RecoverableEnqueueRetryDelay.TotalSeconds
                    }));

                await _retryDelay(RecoverableEnqueueRetryDelay);
                if (generation != Volatile.Read(ref _watchGeneration))
                {
                    return;
                }

                QueuePath(path, sourceFolderPath, generation, retryAttempt);
            }
            catch (Exception ex)
            {
                await _logService.LogAsync("error", "file_watch_error", $"监听文件重试调度失败：{path}", ex.ToString());
            }
        }));
    }

    private void QueueExistingFiles(
        string scanFolderPath,
        string sourceFolderPath,
        int generation,
        bool isRecoveryScan = false,
        bool isDirectoryEventScan = false)
    {
        CollectorBackgroundTask.Forget(Task.Run(async () =>
        {
            try
            {
                if (generation != Volatile.Read(ref _watchGeneration))
                {
                    return;
                }

                var files = Directory.EnumerateFiles(
                    scanFolderPath,
                    "*",
                    new EnumerationOptions
                    {
                        RecurseSubdirectories = true,
                        IgnoreInaccessible = true,
                        ReturnSpecialDirectories = false
                    }).ToList();
                foreach (var filePath in files)
                {
                    QueuePath(filePath, sourceFolderPath, generation);
                }

                if (files.Count > 0)
                {
                    await _logService.LogAsync(
                        "info",
                        GetScanEventType(isRecoveryScan, isDirectoryEventScan),
                        $"{GetScanLabel(isRecoveryScan, isDirectoryEventScan)}发现 {files.Count} 个文件：{scanFolderPath}",
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            sourceFolder = sourceFolderPath,
                            scanFolder = scanFolderPath,
                            fileCount = files.Count,
                            isRecoveryScan,
                            isDirectoryEventScan
                        }));
                }
            }
            catch (Exception ex)
            {
                await _logService.LogAsync("error", "file_watch_error", $"监听目录扫描失败：{scanFolderPath}", ex.ToString());
            }
        }));
    }

    private static string GetScanEventType(bool isRecoveryScan, bool isDirectoryEventScan)
    {
        if (isRecoveryScan) return "file_watch_recovery_scan";
        return isDirectoryEventScan ? "file_watch_directory_scan" : "file_watch_initial_scan";
    }

    private static string GetScanLabel(bool isRecoveryScan, bool isDirectoryEventScan)
    {
        if (isRecoveryScan) return "监听目录恢复扫描";
        return isDirectoryEventScan ? "监听目录新增子目录扫描" : "监听目录初始扫描";
    }

    private int GetGeneration(object sender)
    {
        return sender is FileSystemWatcher watcher && _watcherGenerations.TryGetValue(watcher, out var generation)
            ? generation
            : Volatile.Read(ref _watchGeneration);
    }

    private void PruneRecentEvents(DateTimeOffset now)
    {
        if (_recentEvents.Count <= RecentEventSoftLimit) return;

        var cutoff = now - RecentEventRetention;
        foreach (var pair in _recentEvents)
        {
            if (pair.Value < cutoff)
            {
                _recentEvents.TryRemove(pair.Key, out _);
            }
        }

        if (_recentEvents.Count <= RecentEventSoftLimit * 2) return;

        var overflow = _recentEvents.Count - RecentEventSoftLimit;
        foreach (var key in _recentEvents.OrderBy(pair => pair.Value).Take(overflow).Select(pair => pair.Key))
        {
            _recentEvents.TryRemove(key, out _);
        }
    }

    private static WatchFolderConfig? FindWatchFolder(AppConfig config, string sourceFolderPath)
    {
        if (string.IsNullOrWhiteSpace(sourceFolderPath)) return null;

        var normalizedSource = NormalizePath(sourceFolderPath);
        return (config.WatchFolders ?? new List<WatchFolderConfig>())
            .Where(item => item.Enabled)
            .FirstOrDefault(item => string.Equals(NormalizePath(item.FolderPath), normalizedSource, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizePath(string path)
    {
        return Path.GetFullPath(path.Trim())
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }
}
