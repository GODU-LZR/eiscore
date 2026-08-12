using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class CollectorFileService
{
    private readonly UploadQueueStore _queueStore;
    private readonly ClientLogService _logService;
    private readonly Func<string, CancellationToken, Task<string>> _hashProvider;
    private readonly Func<string, TimeSpan, TimeSpan, CancellationToken, Task<bool>> _stabilityProvider;

    public event EventHandler? QueueChanged;

    public CollectorFileService(UploadQueueStore queueStore, ClientLogService logService)
        : this(queueStore, logService, FileHashService.ComputeSha256Async)
    {
    }

    public CollectorFileService(
        UploadQueueStore queueStore,
        ClientLogService logService,
        Func<string, CancellationToken, Task<string>> hashProvider,
        Func<string, TimeSpan, TimeSpan, CancellationToken, Task<bool>>? stabilityProvider = null)
    {
        _queueStore = queueStore;
        _logService = logService;
        _hashProvider = hashProvider;
        _stabilityProvider = stabilityProvider ?? FileStabilityService.WaitUntilStableAsync;
    }

    public async Task<UploadQueueItem?> EnqueueFileAsync(
        string filePath,
        string uploadSource,
        AppConfig config,
        WatchFolderConfig? watchFolder = null,
        UploadOwnerContext? webOwner = null,
        CancellationToken cancellationToken = default)
    {
        return (await EnqueueFileWithOutcomeAsync(
            filePath,
            uploadSource,
            config,
            watchFolder,
            webOwner,
            cancellationToken)).Item;
    }

    public async Task<CollectorFileEnqueueOutcome> EnqueueFileWithOutcomeAsync(
        string filePath,
        string uploadSource,
        AppConfig config,
        WatchFolderConfig? watchFolder = null,
        UploadOwnerContext? webOwner = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            await _logService.LogAsync("warn", "file_upload_failed", $"文件不存在：{filePath}", cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Missing;
        }

        if (!CollectorDeviceAccessPolicy.CanUploadFiles(config))
        {
            var blockedReason = CollectorDeviceAccessPolicy.GetCollectionBlockedReason(config);
            var message = blockedReason == "binding_required"
                ? $"采集设备待重新绑定，文件暂不入队：{Path.GetFileName(filePath)}"
                : $"采集设备已被后台禁用，文件暂不入队：{Path.GetFileName(filePath)}";
            await _logService.LogAsync(
                "warn",
                "file_ignored",
                message,
                metadataJson: ClientLogMetadata.Serialize(new { deviceStatus = config.DeviceStatus, blockedReason, uploadSource }),
                cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Blocked;
        }

        if (CollectorFileIgnorePolicy.ShouldIgnore(filePath, out var ignoreReason))
        {
            await _logService.LogAsync(
                "info",
                "file_ignored",
                $"临时/下载中文件暂不入队：{Path.GetFileName(filePath)}",
                metadataJson: ClientLogMetadata.Serialize(new { ignoreReason, uploadSource }),
                cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Temporary;
        }

        var stable = await _stabilityProvider(
            filePath,
            TimeSpan.FromSeconds(2),
            TimeSpan.FromSeconds(45),
            cancellationToken);

        if (!stable)
        {
            await _logService.LogAsync("warn", "file_upload_failed", $"文件未稳定，暂不入队：{filePath}", cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Unstable;
        }

        var infoBeforeHash = new FileInfo(filePath);
        if (!infoBeforeHash.Exists)
        {
            await _logService.LogAsync("warn", "file_upload_failed", $"文件不存在：{filePath}", cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Missing;
        }

        if (infoBeforeHash.Length <= 0)
        {
            await _logService.LogAsync(
                "warn",
                "file_ignored",
                $"空文件暂不入队：{Path.GetFileName(filePath)}",
                metadataJson: ClientLogMetadata.Serialize(new { uploadSource }),
                cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Empty;
        }

        var allowedExtensions = CollectorAllowedExtensionsPolicy.Normalize(config.AllowedExtensions)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var extension = Path.GetExtension(filePath);
        if (allowedExtensions.Count > 0 && !allowedExtensions.Contains(extension))
        {
            await _logService.LogAsync(
                "warn",
                "file_ignored",
                $"文件类型未在远程配置允许范围内：{Path.GetFileName(filePath)}",
                metadataJson: ClientLogMetadata.Serialize(new { extension }),
                cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.DisallowedExtension;
        }

        if (config.MaxUploadBytes > 0 && infoBeforeHash.Length > config.MaxUploadBytes)
        {
            await _logService.LogAsync(
                "warn",
                "file_ignored",
                $"文件超过远程配置上传大小限制：{Path.GetFileName(filePath)}",
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    fileSize = infoBeforeHash.Length,
                    maxUploadBytes = config.MaxUploadBytes
                }),
                cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.TooLarge;
        }

        var fileHash = await _hashProvider(filePath, cancellationToken);
        var infoAfterHash = new FileInfo(filePath);
        if (!infoAfterHash.Exists)
        {
            await _logService.LogAsync("warn", "file_upload_failed", $"文件在计算 hash 后不存在：{filePath}", cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Missing;
        }

        if (infoBeforeHash.Length != infoAfterHash.Length
            || infoBeforeHash.LastWriteTimeUtc != infoAfterHash.LastWriteTimeUtc)
        {
            await _logService.LogAsync(
                "warn",
                "file_upload_failed",
                $"文件在计算 hash 过程中发生变化，暂不入队：{Path.GetFileName(filePath)}",
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    beforeSize = infoBeforeHash.Length,
                    afterSize = infoAfterHash.Length,
                    beforeLastWriteTimeUtc = infoBeforeHash.LastWriteTimeUtc,
                    afterLastWriteTimeUtc = infoAfterHash.LastWriteTimeUtc,
                    uploadSource
                }),
                cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.ChangedDuringHash;
        }

        var existing = await _queueStore.FindByHashAsync(fileHash, cancellationToken);
        if (existing is not null)
        {
            var maxRetryCount = Math.Clamp(config.UploadMaxRetryCount <= 0 ? 10 : config.UploadMaxRetryCount, 1, 100);
            if (existing.Status.Equals(UploadQueueStatus.Failed, StringComparison.OrdinalIgnoreCase)
                && existing.RetryCount >= maxRetryCount)
            {
                var requeueItem = BuildQueueItem(filePath, infoAfterHash, fileHash, uploadSource, config, watchFolder, webOwner);
                requeueItem.Id = existing.Id;
                var requeued = await _queueStore.RequeueExistingAsync(requeueItem, cancellationToken);
                QueueChanged?.Invoke(this, EventArgs.Empty);

                await _logService.LogAsync(
                    "info",
                    "file_requeued",
                    $"失败文件已重新入队：{Path.GetFileName(filePath)}",
                    metadataJson: ClientLogMetadata.Serialize(new
                    {
                        fileHash,
                        existingQueueId = existing.Id,
                        previousRetryCount = existing.RetryCount,
                        maxRetryCount,
                        uploadSource,
                        requeueItem.OperatorSource,
                        requeueItem.SourceFolder
                    }),
                    cancellationToken: cancellationToken);

                return CollectorFileEnqueueOutcome.Queued(requeued ?? requeueItem);
            }

            await _logService.LogAsync(
                "info",
                "file_duplicate",
                $"重复文件已跳过：{Path.GetFileName(filePath)}",
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    fileHash,
                    existingQueueId = existing.Id,
                    existing.Status,
                    existing.RetryCount
                }),
                cancellationToken: cancellationToken);
            return CollectorFileEnqueueOutcome.Existing(existing);
        }

        var item = BuildQueueItem(filePath, infoAfterHash, fileHash, uploadSource, config, watchFolder, webOwner);

        var inserted = await _queueStore.InsertAsync(item, cancellationToken);
        QueueChanged?.Invoke(this, EventArgs.Empty);

        await _logService.LogAsync(
            "info",
            "file_queued",
            $"文件已入队：{item.OriginalFilename}",
            metadataJson: ClientLogMetadata.Serialize(new
            {
                fileHash,
                fileSize = item.FileSize,
                uploadSource,
                item.OperatorSource,
                item.SourceFolder
            }),
            cancellationToken: cancellationToken);

        return CollectorFileEnqueueOutcome.Queued(inserted);
    }

    private static UploadQueueItem BuildQueueItem(
        string filePath,
        FileInfo info,
        string fileHash,
        string uploadSource,
        AppConfig config,
        WatchFolderConfig? watchFolder,
        UploadOwnerContext? webOwner)
    {
        var ownership = CollectorUploadOwnershipPolicy.Resolve(uploadSource, config, watchFolder, webOwner);

        return new UploadQueueItem
        {
            FilePath = filePath,
            OriginalFilename = info.Name,
            FileHash = fileHash,
            FileSize = info.Length,
            MimeType = MimeTypeService.Resolve(filePath),
            UploadSource = uploadSource,
            SourceFolder = watchFolder?.FolderPath?.Trim() ?? "",
            DeviceId = config.DeviceId,
            WindowsUsername = Environment.UserDomainName + "\\" + Environment.UserName,
            UploadedByUserId = ownership.UploadedByUserId,
            UploadedByUsername = ownership.UploadedByUsername,
            UploadedByRole = ownership.UploadedByRole,
            OperatorSource = ownership.OperatorSource,
            Status = UploadQueueStatus.Queued,
            CreatedAt = DateTimeOffset.Now
        };
    }
}

public enum CollectorFileEnqueueOutcomeKind
{
    Queued,
    Existing,
    Missing,
    Blocked,
    Temporary,
    Unstable,
    Empty,
    DisallowedExtension,
    TooLarge,
    ChangedDuringHash
}

public sealed class CollectorFileEnqueueOutcome
{
    public static readonly CollectorFileEnqueueOutcome Missing = new(CollectorFileEnqueueOutcomeKind.Missing, null);
    public static readonly CollectorFileEnqueueOutcome Blocked = new(CollectorFileEnqueueOutcomeKind.Blocked, null);
    public static readonly CollectorFileEnqueueOutcome Temporary = new(CollectorFileEnqueueOutcomeKind.Temporary, null);
    public static readonly CollectorFileEnqueueOutcome Unstable = new(CollectorFileEnqueueOutcomeKind.Unstable, null);
    public static readonly CollectorFileEnqueueOutcome Empty = new(CollectorFileEnqueueOutcomeKind.Empty, null);
    public static readonly CollectorFileEnqueueOutcome DisallowedExtension = new(CollectorFileEnqueueOutcomeKind.DisallowedExtension, null);
    public static readonly CollectorFileEnqueueOutcome TooLarge = new(CollectorFileEnqueueOutcomeKind.TooLarge, null);
    public static readonly CollectorFileEnqueueOutcome ChangedDuringHash = new(CollectorFileEnqueueOutcomeKind.ChangedDuringHash, null);

    private CollectorFileEnqueueOutcome(CollectorFileEnqueueOutcomeKind kind, UploadQueueItem? item)
    {
        Kind = kind;
        Item = item;
    }

    public CollectorFileEnqueueOutcomeKind Kind { get; }
    public UploadQueueItem? Item { get; }
    public bool ShouldRetryFromWatchFolder =>
        Kind is CollectorFileEnqueueOutcomeKind.Unstable or CollectorFileEnqueueOutcomeKind.ChangedDuringHash;

    public static CollectorFileEnqueueOutcome Queued(UploadQueueItem item)
    {
        return new CollectorFileEnqueueOutcome(CollectorFileEnqueueOutcomeKind.Queued, item);
    }

    public static CollectorFileEnqueueOutcome Existing(UploadQueueItem item)
    {
        return new CollectorFileEnqueueOutcome(CollectorFileEnqueueOutcomeKind.Existing, item);
    }
}
