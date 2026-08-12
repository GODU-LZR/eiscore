namespace EISCore.Collector.Services;

public sealed class CollectorReentrancyGate : IDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private bool _disposed;

    public bool TryEnter()
    {
        if (_disposed)
        {
            return false;
        }

        try
        {
            return _gate.Wait(0);
        }
        catch (ObjectDisposedException)
        {
            return false;
        }
    }

    public void Exit()
    {
        try
        {
            if (!_disposed)
            {
                _gate.Release();
            }
        }
        catch (ObjectDisposedException)
        {
        }
    }

    public void Dispose()
    {
        _disposed = true;
        _gate.Dispose();
    }
}
