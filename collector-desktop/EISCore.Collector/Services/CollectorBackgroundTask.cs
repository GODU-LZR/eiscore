namespace EISCore.Collector.Services;

public static class CollectorBackgroundTask
{
    public static void Forget(Task task)
    {
        if (task.IsCompletedSuccessfully)
        {
            return;
        }

        _ = ObserveAsync(task);
    }

    public static async Task ObserveAsync(Task task)
    {
        try
        {
            await task.ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
        }
        catch
        {
            // Background notifications and best-effort logs must not surface as unobserved task exceptions.
        }
    }
}
