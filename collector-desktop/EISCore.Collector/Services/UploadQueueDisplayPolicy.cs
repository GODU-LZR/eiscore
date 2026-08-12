using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class UploadQueueDisplayPolicy
{
    public static string Format(
        UploadQueueItem item,
        DateTimeOffset? now = null,
        Func<string, bool>? fileExists = null)
    {
        var parts = new List<string>
        {
            $"#{item.Id}",
            $"[{FormatStatus(item.Status)}]",
            $"{item.OriginalFilename} ({FormatBytes(item.FileSize)})"
        };

        if (!string.IsNullOrWhiteSpace(item.UploadSource))
        {
            parts.Add(FormatUploadSource(item.UploadSource));
        }

        if (IsActiveUploadStatus(item.Status)
            && (IsMissingLocalFileError(item.LastError) || IsMissingLocalFile(item.FilePath, fileExists)))
        {
            parts.Add("本地文件缺失");
        }

        if (item.RetryCount > 0)
        {
            parts.Add($"重试 {item.RetryCount} 次");
        }

        if (item.NextRetryAt is { } nextRetryAt)
        {
            var current = now ?? DateTimeOffset.Now;
            parts.Add(nextRetryAt > current
                ? $"{nextRetryAt:HH:mm:ss} 后重试"
                : "已到重试时间");
        }

        if ((item.Status.Equals(UploadQueueStatus.Uploaded, StringComparison.OrdinalIgnoreCase)
                || item.Status.Equals(UploadQueueStatus.Duplicate, StringComparison.OrdinalIgnoreCase))
            && item.UploadedAt is { } uploadedAt)
        {
            parts.Add($"{uploadedAt:HH:mm:ss} 已完成");
        }

        if (!string.IsNullOrWhiteSpace(item.ServerBatchNo))
        {
            parts.Add($"批次 {item.ServerBatchNo.Trim()}");
        }
        else if (!string.IsNullOrWhiteSpace(item.ServerBatchId))
        {
            parts.Add($"批次 {item.ServerBatchId.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(item.ServerAssetId))
        {
            parts.Add($"asset {item.ServerAssetId}");
        }

        if (!string.IsNullOrWhiteSpace(item.ServerProcessingStatus)
            && !item.ServerProcessingStatus.Equals(item.Status, StringComparison.OrdinalIgnoreCase))
        {
            parts.Add("服务端：" + FormatServerStatus(item.ServerProcessingStatus));
        }

        if (!string.IsNullOrWhiteSpace(item.ServerMessage))
        {
            parts.Add("服务端消息：" + Truncate(item.ServerMessage.Trim(), 80));
        }

        if (!string.IsNullOrWhiteSpace(item.LastError))
        {
            parts.Add("错误：" + Truncate(item.LastError.Trim(), 80));
        }

        return string.Join(" · ", parts);
    }

    private static string FormatStatus(string status)
    {
        return (status ?? "").Trim().ToLowerInvariant() switch
        {
            UploadQueueStatus.Pending => "待处理",
            UploadQueueStatus.Hashing => "计算Hash",
            UploadQueueStatus.Queued => "待上传",
            UploadQueueStatus.Uploading => "上传中",
            UploadQueueStatus.Uploaded => "已上传",
            UploadQueueStatus.Failed => "失败",
            UploadQueueStatus.Duplicate => "重复",
            UploadQueueStatus.Ignored => "已忽略",
            _ => string.IsNullOrWhiteSpace(status) ? "未知" : status.Trim()
        };
    }

    private static string FormatUploadSource(string uploadSource)
    {
        return uploadSource.Trim().ToLowerInvariant() switch
        {
            "manual_selected_file" => "手动选择",
            "manual_drag_drop" => "窗口拖拽",
            "web_drag_drop" => "网页拖拽",
            "watch_folder" => "监听目录",
            _ => uploadSource.Trim()
        };
    }

    private static string FormatServerStatus(string status)
    {
        return status.Trim().ToLowerInvariant() switch
        {
            "created" => "已创建",
            "uploading" => "上传中",
            "uploaded" => "已上传",
            "duplicate" => "重复文件",
            "parsing" => "解析中",
            "classifying" => "分类中",
            "importing" => "入库中",
            "completed" => "已完成",
            "partial" => "部分完成",
            "failed" => "失败",
            _ => status.Trim()
        };
    }

    private static string FormatBytes(long bytes)
    {
        string[] units = { "B", "KB", "MB", "GB" };
        var size = (double)Math.Max(0, bytes);
        var index = 0;
        while (size >= 1024 && index < units.Length - 1)
        {
            size /= 1024;
            index++;
        }

        return $"{size:0.##} {units[index]}";
    }

    private static string Truncate(string value, int maxLength)
    {
        return value.Length <= maxLength
            ? value
            : value[..maxLength] + "...";
    }

    private static bool IsActiveUploadStatus(string status)
    {
        return (status ?? "").Trim().ToLowerInvariant() switch
        {
            UploadQueueStatus.Pending => true,
            UploadQueueStatus.Queued => true,
            UploadQueueStatus.Failed => true,
            UploadQueueStatus.Uploading => true,
            _ => false
        };
    }

    private static bool IsMissingLocalFileError(string lastError)
    {
        return (lastError ?? "").Contains("本地文件不存在", StringComparison.Ordinal);
    }

    private static bool IsMissingLocalFile(string filePath, Func<string, bool>? fileExists)
    {
        return fileExists is not null
            && !string.IsNullOrWhiteSpace(filePath)
            && !fileExists(filePath);
    }
}
