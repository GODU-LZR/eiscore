using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class WatchFolderHealthPolicy
{
    public static WatchFolderHealthSummary Summarize(
        IReadOnlyList<WatchFolderConfig> watchFolders,
        Func<string, bool>? directoryExists = null,
        Func<string, bool>? directoryAccessible = null)
    {
        directoryExists ??= Directory.Exists;
        directoryAccessible ??= CanAccessDirectory;

        var summary = new WatchFolderHealthSummary
        {
            WatchFolderCount = watchFolders.Count,
            EnabledWatchFolderCount = watchFolders.Count(item => item.Enabled),
            DisabledWatchFolderCount = watchFolders.Count(item => !item.Enabled)
        };

        foreach (var folder in watchFolders)
        {
            var folderPath = (folder.FolderPath ?? "").Trim();
            var status = new CollectorWatchFolderHealthStatus
            {
                FolderPath = folderPath,
                FolderName = (folder.FolderName ?? "").Trim(),
                DefaultUserId = (folder.DefaultUserId ?? "").Trim(),
                DefaultUsername = (folder.DefaultUsername ?? "").Trim(),
                DefaultRole = (folder.DefaultRole ?? "").Trim(),
                Enabled = folder.Enabled
            };

            if (!folder.Enabled)
            {
                status.Status = "disabled";
                status.Reason = "watch_folder_disabled";
                summary.WatchFolderStatuses.Add(status);
                continue;
            }

            if (string.IsNullOrWhiteSpace(folderPath) || !directoryExists(folderPath))
            {
                summary.MissingWatchFolderCount++;
                status.Status = "missing";
                status.Reason = string.IsNullOrWhiteSpace(folderPath)
                    ? "folder_path_empty"
                    : "directory_not_found";
                summary.WatchFolderStatuses.Add(status);
                continue;
            }

            if (directoryAccessible(folderPath))
            {
                summary.AccessibleWatchFolderCount++;
                status.Status = "accessible";
                status.Reason = "";
            }
            else
            {
                summary.InaccessibleWatchFolderCount++;
                status.Status = "inaccessible";
                status.Reason = "directory_access_denied";
            }

            summary.WatchFolderStatuses.Add(status);
        }

        return summary;
    }

    public static bool CanAccessDirectory(string folderPath)
    {
        try
        {
            using var enumerator = Directory.EnumerateFileSystemEntries(folderPath).Take(1).GetEnumerator();
            _ = enumerator.MoveNext();
            return true;
        }
        catch
        {
            return false;
        }
    }
}

public sealed class WatchFolderHealthSummary
{
    public int WatchFolderCount { get; set; }
    public int EnabledWatchFolderCount { get; set; }
    public int DisabledWatchFolderCount { get; set; }
    public int MissingWatchFolderCount { get; set; }
    public int AccessibleWatchFolderCount { get; set; }
    public int InaccessibleWatchFolderCount { get; set; }
    public List<CollectorWatchFolderHealthStatus> WatchFolderStatuses { get; set; } = new();
}
