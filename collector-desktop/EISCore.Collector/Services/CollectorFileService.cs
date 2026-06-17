using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class CollectorFileService
{
    private readonly UploadQueueStore _queueStore;
    private readonly ClientLogService _logService;

    public event EventHandler? QueueChanged;

    public CollectorFileService(UploadQueueStore queueStore, ClientLogService logService)
    {
        _queueStore = queueStore;
        _logService = logService;
    }

    public async Task<UploadQueueItem?> EnqueueFileAsync(
        string filePath,
        string uploadSource,
        AppConfig config,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            await _logService.LogAsync("warn", "file_upload_failed", $"文件不存在：{filePath}", cancellationToken: cancellationToken);
            return null;
        }

        var stable = await FileStabilityService.WaitUntilStableAsync(
            filePath,
            stableFor: TimeSpan.FromSeconds(2),
            timeout: TimeSpan.FromSeconds(45),
            cancellationToken);

        if (!stable)
        {
            await _logService.LogAsync("warn", "file_upload_failed", $"文件未稳定，暂不入队：{filePath}", cancellationToken: cancellationToken);
            return null;
        }

        var info = new FileInfo(filePath);
        var allowedExtensions = (config.AllowedExtensions ?? new List<string>())
            .Select(item => item.Trim().ToLowerInvariant())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.StartsWith('.') ? item : "." + item)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var extension = Path.GetExtension(filePath);
        if (allowedExtensions.Count > 0 && !allowedExtensions.Contains(extension))
        {
            await _logService.LogAsync(
                "warn",
                "file_ignored",
                $"文件类型未在远程配置允许范围内：{Path.GetFileName(filePath)}",
                metadataJson: $$"""{"extension":"{{extension}}"}""",
                cancellationToken: cancellationToken);
            return null;
        }

        if (config.MaxUploadBytes > 0 && info.Length > config.MaxUploadBytes)
        {
            await _logService.LogAsync(
                "warn",
                "file_ignored",
                $"文件超过远程配置上传大小限制：{Path.GetFileName(filePath)}",
                metadataJson: $$"""{"file_size":{{info.Length}},"max_upload_bytes":{{config.MaxUploadBytes}}}""",
                cancellationToken: cancellationToken);
            return null;
        }

        var fileHash = await FileHashService.ComputeSha256Async(filePath, cancellationToken);
        var existing = await _queueStore.FindByHashAsync(fileHash, cancellationToken);
        if (existing is not null)
        {
            await _logService.LogAsync(
                "info",
                "file_duplicate",
                $"重复文件已跳过：{Path.GetFileName(filePath)}",
                metadataJson: $$"""{"file_hash":"{{fileHash}}","existing_queue_id":{{existing.Id}}}""",
                cancellationToken: cancellationToken);
            return existing;
        }

        var item = new UploadQueueItem
        {
            FilePath = filePath,
            OriginalFilename = info.Name,
            FileHash = fileHash,
            FileSize = info.Length,
            MimeType = MimeTypeService.Resolve(filePath),
            UploadSource = uploadSource,
            DeviceId = config.DeviceId,
            UploadedByUserId = config.DefaultUserId,
            Status = UploadQueueStatus.Queued,
            CreatedAt = DateTimeOffset.Now
        };

        var inserted = await _queueStore.InsertAsync(item, cancellationToken);
        QueueChanged?.Invoke(this, EventArgs.Empty);

        await _logService.LogAsync(
            "info",
            "file_queued",
            $"文件已入队：{item.OriginalFilename}",
            metadataJson: $$"""{"file_hash":"{{fileHash}}","file_size":{{item.FileSize}},"upload_source":"{{uploadSource}}"}""",
            cancellationToken: cancellationToken);

        return inserted;
    }
}
