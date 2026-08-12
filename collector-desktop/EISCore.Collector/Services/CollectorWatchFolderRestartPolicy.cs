using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorWatchFolderRestartState(bool CanStart, string StatusMessage);

public static class CollectorWatchFolderRestartPolicy
{
    public static CollectorWatchFolderRestartState Evaluate(AppConfig config)
    {
        if (CollectorDeviceAccessPolicy.IsDisabled(config))
        {
            return new CollectorWatchFolderRestartState(false, "设备已被后台禁用，监听未启动。");
        }

        if (CollectorDeviceAccessPolicy.IsPending(config))
        {
            return new CollectorWatchFolderRestartState(false, "设备待绑定，请重新绑定后再启动监听。");
        }

        var hasEnabledFolder = (config.WatchFolders ?? new List<WatchFolderConfig>())
            .Any(item => item.Enabled && !string.IsNullOrWhiteSpace(item.FolderPath));
        if (!hasEnabledFolder)
        {
            return new CollectorWatchFolderRestartState(false, "没有启用的监听目录，请先添加或启用目录。");
        }

        return new CollectorWatchFolderRestartState(true, "监听目录已重新启动。");
    }
}
