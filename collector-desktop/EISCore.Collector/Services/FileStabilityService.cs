namespace EISCore.Collector.Services;

public static class FileStabilityService
{
    public static async Task<bool> WaitUntilStableAsync(
        string filePath,
        TimeSpan stableFor,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        var startedAt = DateTimeOffset.Now;
        long? lastSize = null;
        DateTime? lastWriteTime = null;
        var stableSince = DateTimeOffset.Now;

        while (DateTimeOffset.Now - startedAt < timeout)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var info = new FileInfo(filePath);
                if (!info.Exists) return false;

                var currentSize = info.Length;
                var currentWriteTime = info.LastWriteTimeUtc;
                if (lastSize == currentSize && lastWriteTime == currentWriteTime)
                {
                    if (DateTimeOffset.Now - stableSince >= stableFor)
                    {
                        using var probe = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                        return probe.CanRead;
                    }
                }
                else
                {
                    lastSize = currentSize;
                    lastWriteTime = currentWriteTime;
                    stableSince = DateTimeOffset.Now;
                }
            }
            catch (IOException)
            {
                stableSince = DateTimeOffset.Now;
            }
            catch (UnauthorizedAccessException)
            {
                stableSince = DateTimeOffset.Now;
            }

            await Task.Delay(800, cancellationToken);
        }

        return false;
    }
}
