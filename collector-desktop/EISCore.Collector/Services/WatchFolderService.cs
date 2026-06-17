using System.Collections.Concurrent;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class WatchFolderService : IDisposable
{
    private readonly CollectorFileService _fileService;
    private readonly ClientLogService _logService;
    private readonly Func<AppConfig> _configProvider;
    private readonly List<FileSystemWatcher> _watchers = new();
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
                _ = _logService.LogAsync("warn", "file_watch_error", $"监听目录不存在：{folder.FolderPath}");
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

            _ = _logService.LogAsync("info", "file_watch_started", $"已启动监听目录：{folder.FolderPath}");
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
    }

    public void Dispose()
    {
        Stop();
    }

    private void Watcher_FileChanged(object sender, FileSystemEventArgs e)
    {
        QueuePath(e.FullPath);
    }

    private void Watcher_FileRenamed(object sender, RenamedEventArgs e)
    {
        QueuePath(e.FullPath);
    }

    private void Watcher_Error(object sender, ErrorEventArgs e)
    {
        _ = _logService.LogAsync("error", "file_watch_error", "文件夹监听异常", e.GetException().ToString());
    }

    private void QueuePath(string path)
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
                await _fileService.EnqueueFileAsync(path, "watch_folder", _configProvider());
            }
            catch (Exception ex)
            {
                await _logService.LogAsync("error", "file_watch_error", $"监听文件入队失败：{path}", ex.ToString());
            }
        });
    }
}
