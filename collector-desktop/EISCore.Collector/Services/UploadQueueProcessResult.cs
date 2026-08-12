namespace EISCore.Collector.Services;

public enum UploadQueueProcessOutcome
{
    Busy,
    Unavailable,
    NoReadyItems,
    Completed,
    StoppedOnFailure,
    StoppedOnAuthFailure
}

public sealed record UploadQueueProcessResult
{
    public UploadQueueProcessOutcome Outcome { get; init; }
    public int UploadedCount { get; init; }
    public int DuplicateCount { get; init; }
    public int MissingFileCount { get; init; }
    public int FailedCount { get; init; }
    public int WaitingRetryCount { get; init; }
    public int ExhaustedRetryCount { get; init; }
    public DateTimeOffset? NextRetryAt { get; init; }
    public string StatusMessage { get; init; } = "";

    public static UploadQueueProcessResult Busy()
    {
        return new UploadQueueProcessResult
        {
            Outcome = UploadQueueProcessOutcome.Busy,
            StatusMessage = "上传队列正在处理中，请稍候。"
        };
    }

    public static UploadQueueProcessResult Unavailable(string statusMessage)
    {
        return new UploadQueueProcessResult
        {
            Outcome = UploadQueueProcessOutcome.Unavailable,
            StatusMessage = string.IsNullOrWhiteSpace(statusMessage)
                ? "上传队列当前不可处理，请检查设备绑定和服务器配置。"
                : statusMessage
        };
    }

    public static UploadQueueProcessResult NoReadyItems(
        int waitingRetryCount = 0,
        int exhaustedRetryCount = 0,
        DateTimeOffset? nextRetryAt = null)
    {
        return new UploadQueueProcessResult
        {
            Outcome = UploadQueueProcessOutcome.NoReadyItems,
            WaitingRetryCount = Math.Max(0, waitingRetryCount),
            ExhaustedRetryCount = Math.Max(0, exhaustedRetryCount),
            NextRetryAt = nextRetryAt,
            StatusMessage = FormatNoReadyItems(waitingRetryCount, exhaustedRetryCount, nextRetryAt)
        };
    }

    public static UploadQueueProcessResult Completed(
        int uploadedCount,
        int duplicateCount,
        int missingFileCount)
    {
        return new UploadQueueProcessResult
        {
            Outcome = UploadQueueProcessOutcome.Completed,
            UploadedCount = Math.Max(0, uploadedCount),
            DuplicateCount = Math.Max(0, duplicateCount),
            MissingFileCount = Math.Max(0, missingFileCount),
            StatusMessage = FormatCompleted(uploadedCount, duplicateCount, missingFileCount)
        };
    }

    public static UploadQueueProcessResult StoppedOnFailure(
        string errorMessage,
        int uploadedCount,
        int duplicateCount,
        int missingFileCount,
        int failedCount)
    {
        var message = string.IsNullOrWhiteSpace(errorMessage)
            ? "上传失败，将按重试策略稍后继续。"
            : $"上传失败：{errorMessage}，将按重试策略稍后继续。";

        return new UploadQueueProcessResult
        {
            Outcome = UploadQueueProcessOutcome.StoppedOnFailure,
            UploadedCount = Math.Max(0, uploadedCount),
            DuplicateCount = Math.Max(0, duplicateCount),
            MissingFileCount = Math.Max(0, missingFileCount),
            FailedCount = Math.Max(0, failedCount),
            StatusMessage = message
        };
    }

    public static UploadQueueProcessResult StoppedOnAuthFailure(
        int uploadedCount,
        int duplicateCount,
        int missingFileCount,
        int failedCount)
    {
        return new UploadQueueProcessResult
        {
            Outcome = UploadQueueProcessOutcome.StoppedOnAuthFailure,
            UploadedCount = Math.Max(0, uploadedCount),
            DuplicateCount = Math.Max(0, duplicateCount),
            MissingFileCount = Math.Max(0, missingFileCount),
            FailedCount = Math.Max(0, failedCount),
            StatusMessage = "设备认证失效，上传队列已暂停，请重新绑定后继续。"
        };
    }

    private static string FormatCompleted(int uploadedCount, int duplicateCount, int missingFileCount)
    {
        var parts = new List<string>();
        if (uploadedCount > 0) parts.Add($"上传 {uploadedCount} 个");
        if (duplicateCount > 0) parts.Add($"重复 {duplicateCount} 个");
        if (missingFileCount > 0) parts.Add($"本地缺失 {missingFileCount} 个");

        return parts.Count == 0
            ? "上传队列暂无待上传文件。"
            : $"上传队列处理完成：{string.Join("，", parts)}。";
    }

    private static string FormatNoReadyItems(
        int waitingRetryCount,
        int exhaustedRetryCount,
        DateTimeOffset? nextRetryAt)
    {
        if (waitingRetryCount > 0 && nextRetryAt is not null)
        {
            return $"暂无到期的上传任务，{waitingRetryCount} 个失败项将在 {nextRetryAt:HH:mm:ss} 后重试。";
        }

        if (waitingRetryCount > 0)
        {
            return $"暂无到期的上传任务，{waitingRetryCount} 个失败项等待重试。";
        }

        if (exhaustedRetryCount > 0)
        {
            return $"暂无可处理的上传任务，{exhaustedRetryCount} 个失败项已达到最大重试次数。";
        }

        return "上传队列暂无待上传文件。";
    }
}
