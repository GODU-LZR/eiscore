using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class UploadQueueProcessor : IAsyncDisposable
{
    private readonly UploadQueueStore _queueStore;
    private readonly CollectorApiClient _apiClient;
    private readonly ClientLogService _logService;
    private readonly Func<AppConfig> _configProvider;
    private readonly Func<string> _deviceTokenProvider;
    private readonly SemaphoreSlim _processLock = new(1, 1);
    private CancellationTokenSource? _cts;
    private Task? _loopTask;

    public event EventHandler? QueueChanged;

    public UploadQueueProcessor(
        UploadQueueStore queueStore,
        CollectorApiClient apiClient,
        ClientLogService logService,
        Func<AppConfig> configProvider,
        Func<string> deviceTokenProvider)
    {
        _queueStore = queueStore;
        _apiClient = apiClient;
        _logService = logService;
        _configProvider = configProvider;
        _deviceTokenProvider = deviceTokenProvider;
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

    public async Task ProcessOnceAsync(CancellationToken cancellationToken = default)
    {
        if (!await _processLock.WaitAsync(0, cancellationToken)) return;

        try
        {
            var config = _configProvider();
            var token = _deviceTokenProvider();
            if (string.IsNullOrWhiteSpace(config.ServerBaseUrl) || string.IsNullOrWhiteSpace(token))
            {
                return;
            }

            while (!cancellationToken.IsCancellationRequested)
            {
                var item = await _queueStore.GetNextPendingAsync(cancellationToken);
                if (item is null) return;

                if (!File.Exists(item.FilePath))
                {
                    await _queueStore.UpdateStatusAsync(
                        item.Id,
                        UploadQueueStatus.Failed,
                        "本地文件不存在。",
                        incrementRetry: true,
                        cancellationToken);
                    QueueChanged?.Invoke(this, EventArgs.Empty);
                    continue;
                }

                await _queueStore.UpdateStatusAsync(item.Id, UploadQueueStatus.Uploading, cancellationToken: cancellationToken);
                QueueChanged?.Invoke(this, EventArgs.Empty);

                try
                {
                    var response = await _apiClient.UploadFileAsync(item, config, token, cancellationToken);
                    await _queueStore.MarkUploadedAsync(item.Id, response.AssetId, response.Duplicate, cancellationToken);
                    await _logService.LogAsync(
                        "info",
                        response.Duplicate ? "file_upload_duplicate" : "file_upload_uploaded",
                        $"文件上传完成：{item.OriginalFilename}",
                        metadataJson: $$"""{"queue_id":{{item.Id}},"asset_id":"{{response.AssetId}}","batch_id":"{{response.BatchId}}"}""",
                        cancellationToken: cancellationToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    await _queueStore.UpdateStatusAsync(
                        item.Id,
                        UploadQueueStatus.Failed,
                        ex.Message,
                        incrementRetry: true,
                        cancellationToken);
                    await _logService.LogAsync(
                        "error",
                        "file_upload_failed",
                        $"文件上传失败：{item.OriginalFilename}",
                        ex.ToString(),
                        cancellationToken: cancellationToken);
                    return;
                }
                finally
                {
                    QueueChanged?.Invoke(this, EventArgs.Empty);
                }
            }
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

    private async Task RunLoopAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (await timer.WaitForNextTickAsync(cancellationToken))
        {
            await ProcessOnceAsync(cancellationToken);
        }
    }
}
