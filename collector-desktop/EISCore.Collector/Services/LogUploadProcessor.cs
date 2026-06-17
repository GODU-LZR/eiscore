using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class LogUploadProcessor : IAsyncDisposable
{
    private readonly ClientLogStore _logStore;
    private readonly CollectorApiClient _apiClient;
    private readonly Func<AppConfig> _configProvider;
    private readonly Func<string> _deviceTokenProvider;
    private readonly SemaphoreSlim _processLock = new(1, 1);
    private CancellationTokenSource? _cts;
    private Task? _loopTask;

    public LogUploadProcessor(
        ClientLogStore logStore,
        CollectorApiClient apiClient,
        Func<AppConfig> configProvider,
        Func<string> deviceTokenProvider)
    {
        _logStore = logStore;
        _apiClient = apiClient;
        _configProvider = configProvider;
        _deviceTokenProvider = deviceTokenProvider;
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
            if (string.IsNullOrWhiteSpace(config.ServerBaseUrl) || string.IsNullOrWhiteSpace(token))
            {
                return;
            }

            var events = await _logStore.ListPendingAsync(Math.Clamp(config.LogBatchSize, 1, 1000), cancellationToken);
            if (events.Count == 0) return;

            await _apiClient.UploadLogsAsync(config, token, events, cancellationToken);
            await _logStore.MarkUploadedAsync(events.Select(item => item.Id), cancellationToken);
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
}
