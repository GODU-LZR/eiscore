using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class LogUploadProcessor : IAsyncDisposable
{
    private readonly ClientLogStore _logStore;
    private readonly CollectorApiClient _apiClient;
    private readonly Func<AppConfig> _configProvider;
    private readonly Func<string> _deviceTokenProvider;
    private readonly Func<CollectorDeviceAuthException, string, CancellationToken, Task>? _authFailureHandler;
    private readonly ClientLogService? _logService;
    private readonly SemaphoreSlim _processLock = new(1, 1);
    private CancellationTokenSource? _cts;
    private Task? _loopTask;
    private string _lastUnavailableReason = "";
    private string _lastUploadFailureSignature = "";

    public LogUploadProcessor(
        ClientLogStore logStore,
        CollectorApiClient apiClient,
        Func<AppConfig> configProvider,
        Func<string> deviceTokenProvider,
        Func<CollectorDeviceAuthException, string, CancellationToken, Task>? authFailureHandler = null,
        ClientLogService? logService = null)
    {
        _logStore = logStore;
        _apiClient = apiClient;
        _configProvider = configProvider;
        _deviceTokenProvider = deviceTokenProvider;
        _authFailureHandler = authFailureHandler;
        _logService = logService;
    }

    public void Start()
    {
        if (_loopTask is { IsCompleted: false }) return;

        _cts = new CancellationTokenSource();
        _loopTask = Task.Run(() => RunLoopAsync(_cts.Token));
    }

    public async Task FlushAsync(CancellationToken cancellationToken = default)
    {
        if (!await _processLock.WaitAsync(0, cancellationToken)) return;

        try
        {
            var config = _configProvider();
            var token = _deviceTokenProvider();
            await PruneRetainedLogsAsync(config, cancellationToken);

            var uploadState = CollectorLogUploadPolicy.Evaluate(config, token);
            if (!uploadState.CanUpload)
            {
                await LogUnavailableOnceAsync(config, uploadState, cancellationToken);
                return;
            }

            _lastUnavailableReason = "";
            var events = await _logStore.ListPendingAsync(Math.Clamp(config.LogBatchSize, 1, 1000), cancellationToken);
            if (events.Count == 0) return;

            try
            {
                await _apiClient.UploadLogsAsync(config, token, events, cancellationToken);
            }
            catch (CollectorDeviceAuthException ex)
            {
                if (_authFailureHandler is not null)
                {
                    await _authFailureHandler(ex, "logs", cancellationToken);
                    return;
                }

                throw;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                await LogUploadFailureOnceAsync(config, ex, events.Count, cancellationToken);
                throw;
            }

            await _logStore.MarkUploadedAsync(events.Select(item => item.Id), cancellationToken);
            _lastUploadFailureSignature = "";
            await PruneRetainedLogsAsync(config, cancellationToken);
        }
        finally
        {
            _processLock.Release();
        }
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

    public async Task StopAndFlushAsync(CancellationToken cancellationToken = default)
    {
        await StopAsync();
        await FlushAsync(cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync();
        _processLock.Dispose();
    }

    private async Task RunLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await FlushAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch
            {
                // Keep the background loop alive; failed events remain pending for the next flush.
            }

            var interval = Math.Clamp(_configProvider().LogFlushIntervalSeconds, 5, 60 * 60);
            await Task.Delay(TimeSpan.FromSeconds(interval), cancellationToken);
        }
    }

    private async Task PruneRetainedLogsAsync(AppConfig config, CancellationToken cancellationToken)
    {
        var retentionDays = Math.Clamp(config.LogRetentionDays <= 0 ? 30 : config.LogRetentionDays, 1, 3650);
        var cutoff = DateTimeOffset.Now.AddDays(-retentionDays);
        var uploadedPrunedCount = await _logStore.DeleteUploadedBeforeAsync(cutoff, cancellationToken);
        var pendingPrunedCount = await _logStore.DeletePendingBeforeAsync(cutoff, cancellationToken);
        if (pendingPrunedCount <= 0 || _logService is null)
        {
            return;
        }

        await _logService.LogAsync(
            "warn",
            "client_log_retention_pruned",
            "客户端日志保留期已清理未上传的过期日志，仅保留最近日志等待补传。",
            metadataJson: ClientLogMetadata.Serialize(new
            {
                retentionDays,
                cutoff = cutoff.ToString("O"),
                pendingPrunedCount,
                uploadedPrunedCount
            }),
            cancellationToken: cancellationToken);
    }

    private async Task LogUnavailableOnceAsync(
        AppConfig config,
        CollectorLogUploadState uploadState,
        CancellationToken cancellationToken)
    {
        if (_logService is null || string.Equals(_lastUnavailableReason, uploadState.Reason, StringComparison.Ordinal))
        {
            return;
        }

        _lastUnavailableReason = uploadState.Reason;
        await _logService.LogAsync(
            "warn",
            "log_upload_unavailable",
            uploadState.StatusMessage,
            metadataJson: ClientLogMetadata.Serialize(new
            {
                uploadState.Reason,
                config.DeviceStatus,
                config.ServerBaseUrl
            }),
            cancellationToken: cancellationToken);
    }

    private async Task LogUploadFailureOnceAsync(
        AppConfig config,
        Exception exception,
        int pendingBatchSize,
        CancellationToken cancellationToken)
    {
        if (_logService is null) return;

        var signature = CreateFailureSignature(exception);
        if (string.Equals(_lastUploadFailureSignature, signature, StringComparison.Ordinal))
        {
            return;
        }

        _lastUploadFailureSignature = signature;
        try
        {
            await _logService.LogAsync(
                "warn",
                "log_upload_failed",
                "客户端日志批量上报失败，本地日志将继续保留等待下次补传。",
                exception.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    pendingBatchSize,
                    exceptionType = exception.GetType().Name,
                    failureSignature = signature,
                    config.ServerBaseUrl
                }),
                cancellationToken: cancellationToken);
        }
        catch
        {
            // Logging upload failures must not mask the original upload failure.
        }
    }

    private static string CreateFailureSignature(Exception exception)
    {
        var message = ClientLogService.Sanitize(exception.Message ?? "");
        if (message.Length > 240)
        {
            message = message[..240];
        }

        return $"{exception.GetType().Name}:{message}";
    }
}
