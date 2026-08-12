namespace EISCore.Collector.Services;

public static class UploadConnectivityPolicy
{
    public static bool IsNetworkFailure(Exception exception)
    {
        return exception switch
        {
            CollectorDeviceAuthException => false,
            HttpRequestException => true,
            TimeoutException => true,
            TaskCanceledException => true,
            _ when exception.InnerException is not null => IsNetworkFailure(exception.InnerException),
            _ => false
        };
    }
}
