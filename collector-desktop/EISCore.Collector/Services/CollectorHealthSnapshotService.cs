using EISCore.Collector.Models;
using System.Text;

namespace EISCore.Collector.Services;

public sealed class CollectorHealthSnapshotService
{
    private const int FailedUploadErrorSummaryLimit = 5;
    private const int FailedUploadErrorMaxLength = 160;

    private readonly UploadQueueStore _queueStore;
    private readonly ClientLogStore _logStore;
    private readonly Func<string, bool>? _watchFolderAccessible;
    private readonly Func<string, bool> _uploadFileExists;

    public CollectorHealthSnapshotService(
        UploadQueueStore queueStore,
        ClientLogStore logStore,
        Func<string, bool>? watchFolderAccessible = null,
        Func<string, bool>? uploadFileExists = null)
    {
        _queueStore = queueStore;
        _logStore = logStore;
        _watchFolderAccessible = watchFolderAccessible;
        _uploadFileExists = uploadFileExists ?? File.Exists;
    }

    public async Task<CollectorHealthSnapshot> BuildAsync(
        AppConfig config,
        CancellationToken cancellationToken = default)
    {
        var generatedAt = DateTimeOffset.Now;
        var temporaryFileIgnoredSince = generatedAt.AddHours(-24);
        var uploadMaxRetryCount = Math.Clamp(config.UploadMaxRetryCount <= 0 ? 10 : config.UploadMaxRetryCount, 1, 100);
        var queueCounts = await _queueStore.CountByStatusAsync(cancellationToken);
        var queueWatermarks = await _queueStore.GetTimeWatermarksAsync(cancellationToken);
        var failedRetrySnapshot = await _queueStore.GetFailedRetrySnapshotAsync(
            uploadMaxRetryCount,
            generatedAt,
            cancellationToken);
        var activeUploads = await _queueStore.ListActiveUploadsForHealthAsync(cancellationToken: cancellationToken);
        var missingLocalFiles = activeUploads
            .Where(item => string.IsNullOrWhiteSpace(item.FilePath) || !_uploadFileExists(item.FilePath))
            .ToList();
        var failedUploadErrorSummary = BuildFailedUploadErrorSummary(queueCounts, activeUploads);
        var pendingLogCount = await _logStore.CountPendingAsync(cancellationToken);
        var logWatermarks = await _logStore.GetTimeWatermarksAsync(cancellationToken);
        var temporaryFileIgnoredCount = await _logStore.CountTemporaryFileIgnoredSinceAsync(
            temporaryFileIgnoredSince,
            cancellationToken);
        var connectivity = await _logStore.GetUploadConnectivitySnapshotAsync(cancellationToken);
        var crashDumps = CrashDumpService.GetHealthSnapshot();
        var watchFolders = config.WatchFolders ?? new List<WatchFolderConfig>();
        var watchFolderHealth = WatchFolderHealthPolicy.Summarize(
            watchFolders,
            directoryAccessible: _watchFolderAccessible);
        var storage = GetStorageMetrics();

        var snapshot = new CollectorHealthSnapshot
        {
            GeneratedAt = generatedAt,
            DeviceStatus = config.DeviceStatus,
            AutoStartEnabled = config.AutoStartEnabled,
            WatchFolderCount = watchFolderHealth.WatchFolderCount,
            EnabledWatchFolderCount = watchFolderHealth.EnabledWatchFolderCount,
            DisabledWatchFolderCount = watchFolderHealth.DisabledWatchFolderCount,
            MissingWatchFolderCount = watchFolderHealth.MissingWatchFolderCount,
            AccessibleWatchFolderCount = watchFolderHealth.AccessibleWatchFolderCount,
            InaccessibleWatchFolderCount = watchFolderHealth.InaccessibleWatchFolderCount,
            WatchFolderStatuses = watchFolderHealth.WatchFolderStatuses.ToList(),
            UploadQueueByStatus = new Dictionary<string, int>(queueCounts, StringComparer.OrdinalIgnoreCase),
            MissingLocalUploadFileCount = missingLocalFiles.Count,
            OldestMissingLocalUploadFileCreatedAt = missingLocalFiles.Count == 0
                ? null
                : missingLocalFiles.Min(item => item.CreatedAt),
            FailedRetryReadyCount = failedRetrySnapshot.ReadyCount,
            FailedRetryWaitingCount = failedRetrySnapshot.WaitingCount,
            FailedRetryExhaustedCount = failedRetrySnapshot.ExhaustedCount,
            NextFailedRetryAt = failedRetrySnapshot.NextRetryAt,
            FailedUploadErrorSummaries = failedUploadErrorSummary.Summaries,
            FailedUploadErrorSummaryTruncated = failedUploadErrorSummary.Truncated,
            PendingLogCount = pendingLogCount,
            LastLogCreatedAt = logWatermarks.LastLogCreatedAt,
            OldestPendingLogCreatedAt = logWatermarks.OldestPendingLogCreatedAt,
            LastUploadedLogCreatedAt = logWatermarks.LastUploadedLogCreatedAt,
            PendingCrashDumpReportCount = crashDumps.PendingReportCount,
            ReportedCrashDumpReportCount = crashDumps.ReportedReportCount,
            OldestPendingCrashDumpReportCreatedAt = crashDumps.OldestPendingReportCreatedAt,
            LastCrashDumpReportCreatedAt = crashDumps.LastReportCreatedAt,
            CrashDumpDirectoryBytes = crashDumps.DirectoryBytes,
            TemporaryFileIgnoredLast24HoursCount = temporaryFileIgnoredCount,
            TemporaryFileIgnoredSince = temporaryFileIgnoredSince,
            UploadConnectivityStatus = connectivity.Status,
            LastUploadConnectivityOfflineAt = connectivity.LastOfflineAt,
            LastUploadConnectivityOnlineAt = connectivity.LastOnlineAt,
            LastQueuedAt = queueWatermarks.LastQueuedAt,
            LastUploadedAt = queueWatermarks.LastUploadedAt,
            OldestPendingUploadCreatedAt = queueWatermarks.OldestPendingUploadCreatedAt,
            CollectorDatabaseBytes = storage.CollectorDatabaseBytes,
            DataDriveAvailableFreeBytes = storage.DataDriveAvailableFreeBytes,
            DataDriveTotalBytes = storage.DataDriveTotalBytes
        };

        snapshot.TotalUploadQueueCount = queueCounts.Values.Sum();
        snapshot.PendingUploadCount = Count(queueCounts, UploadQueueStatus.Pending)
            + Count(queueCounts, UploadQueueStatus.Queued);
        snapshot.FailedUploadCount = Count(queueCounts, UploadQueueStatus.Failed);
        snapshot.UploadingCount = Count(queueCounts, UploadQueueStatus.Uploading);
        snapshot.CompletedUploadCount = Count(queueCounts, UploadQueueStatus.Uploaded)
            + Count(queueCounts, UploadQueueStatus.Duplicate)
            + Count(queueCounts, UploadQueueStatus.Ignored);
        return snapshot;
    }

    private static (List<CollectorHealthFailedUploadErrorSummary> Summaries, bool Truncated) BuildFailedUploadErrorSummary(
        IReadOnlyDictionary<string, int> queueCounts,
        IReadOnlyList<UploadQueueItem> activeUploads)
    {
        var failedUploads = activeUploads
            .Where(item => string.Equals(item.Status, UploadQueueStatus.Failed, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var grouped = failedUploads
            .GroupBy(item => NormalizeFailedUploadError(item.LastError), StringComparer.OrdinalIgnoreCase)
            .Select(group => new CollectorHealthFailedUploadErrorSummary
            {
                Error = group.Key,
                Count = group.Count(),
                OldestCreatedAt = group.Min(item => item.CreatedAt),
                LatestCreatedAt = group.Max(item => item.CreatedAt)
            })
            .OrderByDescending(item => item.Count)
            .ThenByDescending(item => item.LatestCreatedAt)
            .ThenBy(item => item.Error, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var failedCount = Count(queueCounts, UploadQueueStatus.Failed);
        var truncated = failedCount > failedUploads.Count || grouped.Count > FailedUploadErrorSummaryLimit;
        return (grouped.Take(FailedUploadErrorSummaryLimit).ToList(), truncated);
    }

    private static string NormalizeFailedUploadError(string? error)
    {
        if (string.IsNullOrWhiteSpace(error))
        {
            return "unknown";
        }

        var builder = new StringBuilder(Math.Min(error.Length, FailedUploadErrorMaxLength));
        var lastWasWhitespace = false;
        foreach (var character in error.Trim())
        {
            if (char.IsControl(character) || char.IsWhiteSpace(character))
            {
                if (!lastWasWhitespace && builder.Length > 0)
                {
                    builder.Append(' ');
                    lastWasWhitespace = true;
                }

                continue;
            }

            builder.Append(character);
            lastWasWhitespace = false;
            if (builder.Length >= FailedUploadErrorMaxLength)
            {
                break;
            }
        }

        var normalized = builder.ToString().Trim();
        if (normalized.Length == 0)
        {
            return "unknown";
        }

        return normalized.Length >= FailedUploadErrorMaxLength
            ? normalized.TrimEnd() + "..."
            : normalized;
    }

    private static int Count(IReadOnlyDictionary<string, int> counts, string status)
    {
        return counts.TryGetValue(status, out var value) ? value : 0;
    }

    private static (long? CollectorDatabaseBytes, long? DataDriveAvailableFreeBytes, long? DataDriveTotalBytes) GetStorageMetrics()
    {
        long? databaseBytes = null;
        long? availableFreeBytes = null;
        long? totalBytes = null;

        try
        {
            var databasePath = AppPaths.DatabasePath;
            if (File.Exists(databasePath))
            {
                databaseBytes = new FileInfo(databasePath).Length;
            }

            var rootDirectory = AppPaths.RootDirectory;
            var driveRoot = Path.GetPathRoot(rootDirectory);
            if (!string.IsNullOrWhiteSpace(driveRoot))
            {
                var drive = new DriveInfo(driveRoot);
                if (drive.IsReady)
                {
                    availableFreeBytes = drive.AvailableFreeSpace;
                    totalBytes = drive.TotalSize;
                }
            }
        }
        catch
        {
            // Health snapshots should never block heartbeat because local storage probing failed.
        }

        return (databaseBytes, availableFreeBytes, totalBytes);
    }
}
