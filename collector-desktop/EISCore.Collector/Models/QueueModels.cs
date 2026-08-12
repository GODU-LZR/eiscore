namespace EISCore.Collector.Models;

public static class UploadQueueStatus
{
    public const string Pending = "pending";
    public const string Hashing = "hashing";
    public const string Queued = "queued";
    public const string Uploading = "uploading";
    public const string Uploaded = "uploaded";
    public const string Failed = "failed";
    public const string Duplicate = "duplicate";
    public const string Ignored = "ignored";
}

public sealed class UploadQueueItem
{
    public long Id { get; set; }
    public string FilePath { get; set; } = "";
    public string OriginalFilename { get; set; } = "";
    public string FileHash { get; set; } = "";
    public long FileSize { get; set; }
    public string MimeType { get; set; } = "";
    public string UploadSource { get; set; } = "manual";
    public string SourceFolder { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string WindowsUsername { get; set; } = "";
    public string UploadedByUserId { get; set; } = "";
    public string UploadedByUsername { get; set; } = "";
    public string UploadedByRole { get; set; } = "";
    public string OperatorSource { get; set; } = "";
    public string Status { get; set; } = UploadQueueStatus.Pending;
    public int RetryCount { get; set; }
    public string LastError { get; set; } = "";
    public DateTimeOffset? NextRetryAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UploadedAt { get; set; }
    public string ServerAssetId { get; set; } = "";
    public string ServerBatchId { get; set; } = "";
    public string ServerBatchNo { get; set; } = "";
    public string ServerProcessingStatus { get; set; } = "";
    public string ServerMessage { get; set; } = "";
}
