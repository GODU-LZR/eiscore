using System.Text.Json;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class UploadQueueProcessor : IAsyncDisposable
{
    private readonly UploadQueueStore _queueStore;
    private readonly CollectorApiClient _apiClient;
    private readonly ClientLogService _logService;
    private readonly Func<AppConfig> _configProvider;
    private readonly Func<string> _deviceTokenProvider;
    private readonly Func<CollectorDeviceAuthException, string, CancellationToken, Task>? _authFailureHandler;
    private readonly SemaphoreSlim _processLock = new(1, 1);
    private CancellationTokenSource? _cts;
    private Task? _loopTask;
    private bool _uploadConnectivityOffline;

    public event EventHandler? QueueChanged;

    public UploadQueueProcessor(
        UploadQueueStore queueStore,
        CollectorApiClient apiClient,
        ClientLogService logService,
        Func<AppConfig> configProvider,
        Func<string> deviceTokenProvider,
        Func<CollectorDeviceAuthException, string, CancellationToken, Task>? authFailureHandler = null)
    {
        _queueStore = queueStore;
        _apiClient = apiClient;
        _logService = logService;
        _configProvider = configProvider;
        _deviceTokenProvider = deviceTokenProvider;
        _authFailureHandler = authFailureHandler;
    }

    public void Start()
    {
        if (_loopTask is { IsCompleted: false }) return;

        _cts = new CancellationTokenSource();
        _loopTask = Task.Run(() => RunLoopAsync(_cts.Token));
    }

    public async Task StopAsync()
    {
        if (_cts is null) return;

        _cts.Cancel();
        try
        {
            if (_loopTask is not null)
            {
                await _loopTask;
            }
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            _cts.Dispose();
            _cts = null;
            _loopTask = null;
        }
    }

    public async Task<UploadQueueProcessResult> ProcessOnceAsync(CancellationToken cancellationToken = default)
    {
        if (!await _processLock.WaitAsync(0, cancellationToken)) return UploadQueueProcessResult.Busy();

        try
        {
            var config = _configProvider();
            var token = _deviceTokenProvider();
            var uploadState = CollectorManualUploadPolicy.Evaluate(config, token);
            if (!uploadState.CanProcess)
            {
                return UploadQueueProcessResult.Unavailable(uploadState.StatusMessage);
            }

            await PruneCompletedQueueAsync(config, cancellationToken);
            var retryIntervalSeconds = Math.Clamp(config.UploadRetryIntervalSeconds <= 0 ? 15 : config.UploadRetryIntervalSeconds, 5, 60 * 60);
            var uploadedCount = 0;
            var duplicateCount = 0;
            var missingFileCount = 0;
            var failedCount = 0;

            while (!cancellationToken.IsCancellationRequested)
            {
                var item = await _queueStore.GetNextPendingAsync(config.UploadMaxRetryCount, cancellationToken);
                if (item is null)
                {
                    return await CreateNoMoreWorkResultAsync(
                        config,
                        uploadedCount,
                        duplicateCount,
                        missingFileCount,
                        cancellationToken);
                }

                if (!File.Exists(item.FilePath))
                {
                    missingFileCount++;
                    var nextRetryAt = DateTimeOffset.Now.AddSeconds(retryIntervalSeconds);
                    await _queueStore.UpdateStatusAsync(
                        item.Id,
                        UploadQueueStatus.Failed,
                        "本地文件不存在。",
                        incrementRetry: true,
                        nextRetryAt: nextRetryAt,
                        cancellationToken: cancellationToken);
                    await LogUploadItemAsync(
                        item,
                        "error",
                        "file_upload_failed",
                        $"本地文件不存在，上传队列暂无法补传：{item.OriginalFilename}",
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            filePath = item.FilePath,
                            nextRetryAt
                        }),
                        cancellationToken: cancellationToken);
                    QueueChanged?.Invoke(this, EventArgs.Empty);
                    continue;
                }

                await _queueStore.UpdateStatusAsync(item.Id, UploadQueueStatus.Uploading, cancellationToken: cancellationToken);
                QueueChanged?.Invoke(this, EventArgs.Empty);

                try
                {
                    var response = await _apiClient.UploadFileAsync(item, config, token, cancellationToken);
                    await LogConnectivityOnlineIfNeededAsync(item, cancellationToken);
                    await _queueStore.MarkUploadedAsync(
                        item.Id,
                        response.AssetId,
                        response.BatchId,
                        response.BatchNo,
                        response.Status,
                        response.Message,
                        response.Duplicate,
                        cancellationToken);
                    if (response.Duplicate)
                    {
                        duplicateCount++;
                    }
                    else
                    {
                        uploadedCount++;
                    }

                    await LogUploadItemAsync(
                        item,
                        "info",
                        response.Duplicate ? "file_upload_duplicate" : "file_upload_uploaded",
                        $"文件上传完成：{item.OriginalFilename}",
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            assetId = response.AssetId,
                            batchId = response.BatchId,
                            batchNo = response.BatchNo,
                            status = response.Status,
                            response.Duplicate,
                            response.Message
                        }),
                        aiImportBatchId: response.BatchId,
                        cancellationToken: cancellationToken);
                    await PruneCompletedQueueAsync(config, cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    await RequeueCancelledUploadAsync(item);
                    throw;
                }
                catch (CollectorDeviceAuthException ex)
                {
                    await _queueStore.UpdateStatusAsync(
                        item.Id,
                        UploadQueueStatus.Queued,
                        "设备认证失效，请重新绑定后继续上传。",
                        incrementRetry: false,
                        cancellationToken: cancellationToken);
                    await HandleDeviceAuthFailureAsync(item, ex, cancellationToken);
                    return UploadQueueProcessResult.StoppedOnAuthFailure(
                        uploadedCount,
                        duplicateCount,
                        missingFileCount,
                        failedCount);
                }
                catch (Exception ex)
                {
                    failedCount++;
                    await _queueStore.UpdateStatusAsync(
                        item.Id,
                        UploadQueueStatus.Failed,
                        ex.Message,
                        incrementRetry: true,
                        nextRetryAt: DateTimeOffset.Now.AddSeconds(retryIntervalSeconds),
                        cancellationToken: cancellationToken);
                    await LogConnectivityOfflineIfNeededAsync(item, ex, cancellationToken);
                    await LogUploadItemAsync(
                        item,
                        "error",
                        "file_upload_failed",
                        $"文件上传失败：{item.OriginalFilename}",
                        ex.ToString(),
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            errorType = ex.GetType().Name,
                            item.RetryCount
                        }),
                        cancellationToken: cancellationToken);
                    return UploadQueueProcessResult.StoppedOnFailure(
                        ex.Message,
                        uploadedCount,
                        duplicateCount,
                        missingFileCount,
                        failedCount);
                }
                finally
                {
                    QueueChanged?.Invoke(this, EventArgs.Empty);
                }
            }

            return UploadQueueProcessResult.Completed(uploadedCount, duplicateCount, missingFileCount);
        }
        finally
        {
            _processLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync();
        _processLock.Dispose();
    }

    private async Task PruneCompletedQueueAsync(AppConfig config, CancellationToken cancellationToken)
    {
        var retentionDays = Math.Clamp(config.UploadQueueRetentionDays <= 0 ? 30 : config.UploadQueueRetentionDays, 1, 3650);
        var cutoff = DateTimeOffset.Now.AddDays(-retentionDays);
        var deleted = await _queueStore.DeleteCompletedBeforeAsync(cutoff, cancellationToken);
        if (deleted <= 0) return;

        try
        {
            await _logService.LogAsync(
                "info",
                "upload_queue_pruned",
                $"已清理 {deleted} 条超过保留期的本地上传队列记录。",
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    deletedCount = deleted,
                    retentionDays
                }),
                cancellationToken: cancellationToken);
        }
        catch
        {
            // Queue pruning is maintenance work; local logging failures should not block uploads.
        }

        QueueChanged?.Invoke(this, EventArgs.Empty);
    }

    private async Task<UploadQueueProcessResult> CreateNoMoreWorkResultAsync(
        AppConfig config,
        int uploadedCount,
        int duplicateCount,
        int missingFileCount,
        CancellationToken cancellationToken)
    {
        if (uploadedCount > 0 || duplicateCount > 0 || missingFileCount > 0)
        {
            return UploadQueueProcessResult.Completed(uploadedCount, duplicateCount, missingFileCount);
        }

        var maxRetryCount = Math.Max(1, config.UploadMaxRetryCount);
        var failedRetrySnapshot = await _queueStore.GetFailedRetrySnapshotAsync(
            maxRetryCount,
            DateTimeOffset.Now,
            cancellationToken);

        return UploadQueueProcessResult.NoReadyItems(
            failedRetrySnapshot.WaitingCount,
            failedRetrySnapshot.ExhaustedCount,
            failedRetrySnapshot.NextRetryAt);
    }

    private Task LogUploadItemAsync(
        UploadQueueItem item,
        string level,
        string eventType,
        string message,
        string stack = "",
        string metadataJson = "{}",
        string aiImportBatchId = "",
        CancellationToken cancellationToken = default)
    {
        return _logService.LogAsync(
            level,
            eventType,
            message,
            stack,
            metadataJson: BuildUploadLogMetadata(item, metadataJson),
            appModule: "collector",
            traceId: BuildUploadTraceId(item),
            aiImportBatchId: aiImportBatchId,
            sourceFileHash: item.FileHash,
            userId: item.UploadedByUserId,
            username: item.UploadedByUsername,
            role: item.UploadedByRole,
            cancellationToken: cancellationToken);
    }

    private static string BuildUploadTraceId(UploadQueueItem item)
    {
        var hash = string.IsNullOrWhiteSpace(item.FileHash) ? "nohash" : item.FileHash.Trim();
        var hashPrefix = hash.Length <= 16 ? hash : hash[..16];
        return $"upload:{item.Id}:{hashPrefix}";
    }

    private static string BuildUploadLogMetadata(UploadQueueItem item, string metadataJson)
    {
        return ClientLogMetadata.Serialize(new
        {
            queueId = item.Id,
            item.OriginalFilename,
            item.FileHash,
            item.FileSize,
            item.MimeType,
            item.SourceFolder,
            item.UploadSource,
            item.OperatorSource,
            item.UploadedByUserId,
            item.UploadedByUsername,
            item.UploadedByRole,
            item.RetryCount,
            details = ParseLogDetails(metadataJson)
        });
    }

    private static object? ParseLogDetails(string metadataJson)
    {
        if (string.IsNullOrWhiteSpace(metadataJson) || metadataJson.Trim() == "{}") return null;
        try
        {
            using var document = JsonDocument.Parse(metadataJson);
            return document.RootElement.Clone();
        }
        catch
        {
            return metadataJson;
        }
    }

    private async Task HandleDeviceAuthFailureAsync(
        UploadQueueItem item,
        CollectorDeviceAuthException exception,
        CancellationToken cancellationToken)
    {
        await LogUploadItemAsync(
            item,
            "error",
            "file_upload_auth_failed",
            $"设备认证已失效，上传队列等待重新绑定后继续：{item.OriginalFilename}",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new
            {
                source = "upload",
                statusCode = (int)exception.StatusCode
            }),
            cancellationToken: cancellationToken);

        if (_authFailureHandler is not null)
        {
            await _authFailureHandler(exception, "upload", cancellationToken);
            return;
        }

        await LogUploadItemAsync(
            item,
            "error",
            "collector_device_auth_failed",
            "采集设备认证已失效，上传队列已暂停并等待重新绑定。",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new
            {
                source = "upload",
                statusCode = (int)exception.StatusCode
            }),
            cancellationToken: cancellationToken);
    }

    private async Task RequeueCancelledUploadAsync(UploadQueueItem item)
    {
        try
        {
            await _queueStore.UpdateStatusAsync(
                item.Id,
                UploadQueueStatus.Queued,
                "采集端停止上传，任务已退回队列。",
                incrementRetry: false,
                nextRetryAt: null,
                cancellationToken: CancellationToken.None);
            QueueChanged?.Invoke(this, EventArgs.Empty);
        }
        catch
        {
            return;
        }

        try
        {
            await LogUploadItemAsync(
                item,
                "info",
                "file_upload_cancelled_requeued",
                $"采集端停止上传，任务已退回队列：{item.OriginalFilename}",
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    item.RetryCount
                }),
                cancellationToken: CancellationToken.None);
        }
        catch
        {
            // Shutdown cancellation recovery should not be blocked by local logging.
        }
    }

    private async Task LogConnectivityOfflineIfNeededAsync(
        UploadQueueItem item,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (_uploadConnectivityOffline || !UploadConnectivityPolicy.IsNetworkFailure(exception)) return;

        _uploadConnectivityOffline = true;
        await LogUploadItemAsync(
            item,
            "warn",
            "upload_connectivity_offline",
            "上传通道疑似离线，将按队列退避策略重试。",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new
            {
                errorType = exception.GetType().Name
            }),
            cancellationToken: cancellationToken);
    }

    private async Task LogConnectivityOnlineIfNeededAsync(
        UploadQueueItem item,
        CancellationToken cancellationToken)
    {
        if (!_uploadConnectivityOffline) return;

        _uploadConnectivityOffline = false;
        await LogUploadItemAsync(
            item,
            "info",
            "upload_connectivity_online",
            "上传通道已恢复，队列上传继续执行。",
            cancellationToken: cancellationToken);
    }

    private async Task RunLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await ProcessOnceAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                try
                {
                    await _logService.LogAsync(
                        "error",
                        "upload_queue_loop_failed",
                        "上传队列后台循环异常，将在下一个周期重试。",
                        ex.ToString(),
                        cancellationToken: cancellationToken);
                }
                catch
                {
                    // Keep the queue loop alive even when local logging is unavailable.
                }
            }

            var interval = Math.Clamp(_configProvider().UploadRetryIntervalSeconds, 5, 60 * 60);
            await Task.Delay(TimeSpan.FromSeconds(interval), cancellationToken);
        }
    }

}
