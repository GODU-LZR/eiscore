namespace EISCore.Collector.Models;

public sealed class CollectorHealthSnapshot
{
    public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.Now;
    public string DeviceStatus { get; set; } = "";
    public bool AutoStartEnabled { get; set; }
    public int WatchFolderCount { get; set; }
    public int EnabledWatchFolderCount { get; set; }
    public int DisabledWatchFolderCount { get; set; }
    public int MissingWatchFolderCount { get; set; }
    public int AccessibleWatchFolderCount { get; set; }
    public int InaccessibleWatchFolderCount { get; set; }
    public List<CollectorWatchFolderHealthStatus> WatchFolderStatuses { get; set; } = new();
    public Dictionary<string, int> UploadQueueByStatus { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public int TotalUploadQueueCount { get; set; }
    public int PendingUploadCount { get; set; }
    public int MissingLocalUploadFileCount { get; set; }
    public DateTimeOffset? OldestMissingLocalUploadFileCreatedAt { get; set; }
    public int FailedUploadCount { get; set; }
    public int FailedRetryReadyCount { get; set; }
    public int FailedRetryWaitingCount { get; set; }
    public int FailedRetryExhaustedCount { get; set; }
    public DateTimeOffset? NextFailedRetryAt { get; set; }
    public List<CollectorHealthFailedUploadErrorSummary> FailedUploadErrorSummaries { get; set; } = new();
    public bool FailedUploadErrorSummaryTruncated { get; set; }
    public int UploadingCount { get; set; }
    public int CompletedUploadCount { get; set; }
    public int PendingLogCount { get; set; }
    public DateTimeOffset? LastLogCreatedAt { get; set; }
    public DateTimeOffset? OldestPendingLogCreatedAt { get; set; }
    public DateTimeOffset? LastUploadedLogCreatedAt { get; set; }
    public int PendingCrashDumpReportCount { get; set; }
    public int ReportedCrashDumpReportCount { get; set; }
    public DateTimeOffset? OldestPendingCrashDumpReportCreatedAt { get; set; }
    public DateTimeOffset? LastCrashDumpReportCreatedAt { get; set; }
    public long? CrashDumpDirectoryBytes { get; set; }
    public int TemporaryFileIgnoredLast24HoursCount { get; set; }
    public DateTimeOffset? TemporaryFileIgnoredSince { get; set; }
    public string UploadConnectivityStatus { get; set; } = "unknown";
    public DateTimeOffset? LastUploadConnectivityOfflineAt { get; set; }
    public DateTimeOffset? LastUploadConnectivityOnlineAt { get; set; }
    public DateTimeOffset? LastQueuedAt { get; set; }
    public DateTimeOffset? LastUploadedAt { get; set; }
    public DateTimeOffset? OldestPendingUploadCreatedAt { get; set; }
    public long? CollectorDatabaseBytes { get; set; }
    public long? DataDriveAvailableFreeBytes { get; set; }
    public long? DataDriveTotalBytes { get; set; }
}

public sealed class CollectorWatchFolderHealthStatus
{
    public string FolderPath { get; set; } = "";
    public string FolderName { get; set; } = "";
    public string DefaultUserId { get; set; } = "";
    public string DefaultUsername { get; set; } = "";
    public string DefaultRole { get; set; } = "";
    public bool Enabled { get; set; }
    public string Status { get; set; } = "";
    public string Reason { get; set; } = "";
}

public sealed class CollectorHealthFailedUploadErrorSummary
{
    public string Error { get; set; } = "";
    public int Count { get; set; }
    public DateTimeOffset? OldestCreatedAt { get; set; }
    public DateTimeOffset? LatestCreatedAt { get; set; }
}
