using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class CollectorHealthDisplayPolicy
{
    public static CollectorHealthDisplay Build(CollectorHealthSnapshot snapshot)
    {
        return new CollectorHealthDisplay
        {
            GeneratedAt = snapshot.GeneratedAt.ToString("HH:mm:ss"),
            DeviceStatus = string.IsNullOrWhiteSpace(snapshot.DeviceStatus)
                ? "未绑定"
                : snapshot.DeviceStatus.Trim(),
            WatchFolders = $"启用 {snapshot.EnabledWatchFolderCount}/{snapshot.WatchFolderCount}，可访问 {snapshot.AccessibleWatchFolderCount}，异常 {snapshot.MissingWatchFolderCount + snapshot.InaccessibleWatchFolderCount}",
            UploadQueue = $"待传 {snapshot.PendingUploadCount}，上传中 {snapshot.UploadingCount}，失败 {snapshot.FailedUploadCount}，已完成 {snapshot.CompletedUploadCount}",
            Logs = $"待上传日志 {snapshot.PendingLogCount}，崩溃报告 {snapshot.PendingCrashDumpReportCount}",
            Connectivity = BuildConnectivityText(snapshot),
            Storage = BuildStorageText(snapshot)
        };
    }

    private static string BuildConnectivityText(CollectorHealthSnapshot snapshot)
    {
        var status = string.IsNullOrWhiteSpace(snapshot.UploadConnectivityStatus)
            ? "unknown"
            : snapshot.UploadConnectivityStatus.Trim();
        return status switch
        {
            "online" => "在线",
            "offline" => "离线",
            _ => "未知"
        };
    }

    private static string BuildStorageText(CollectorHealthSnapshot snapshot)
    {
        var database = FormatBytes(snapshot.CollectorDatabaseBytes);
        var free = FormatBytes(snapshot.DataDriveAvailableFreeBytes);
        return $"数据库 {database}，可用空间 {free}";
    }

    private static string FormatBytes(long? bytes)
    {
        if (bytes is null || bytes < 0)
        {
            return "未知";
        }

        string[] units = { "B", "KB", "MB", "GB", "TB" };
        var size = (double)bytes.Value;
        var unitIndex = 0;
        while (size >= 1024 && unitIndex < units.Length - 1)
        {
            size /= 1024;
            unitIndex++;
        }

        return $"{size:0.##} {units[unitIndex]}";
    }
}

public sealed class CollectorHealthDisplay
{
    public string GeneratedAt { get; set; } = "";
    public string DeviceStatus { get; set; } = "";
    public string WatchFolders { get; set; } = "";
    public string UploadQueue { get; set; } = "";
    public string Logs { get; set; } = "";
    public string Connectivity { get; set; } = "";
    public string Storage { get; set; } = "";
}
