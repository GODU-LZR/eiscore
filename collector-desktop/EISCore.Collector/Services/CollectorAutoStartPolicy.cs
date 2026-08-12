namespace EISCore.Collector.Services;

public sealed class CollectorAutoStartApplyResult
{
    public bool HasRemoteSetting { get; init; }
    public bool Changed { get; init; }
    public bool Applied { get; init; }
    public bool RequestedEnabled { get; init; }
    public Exception? Exception { get; init; }

    public string FailureSignature => Exception is null
        ? ""
        : $"{Exception.GetType().Name}:{NormalizeFailureMessage(Exception.Message)}:{RequestedEnabled}";

    private static string NormalizeFailureMessage(string? message)
    {
        var normalized = string.Join(" ", (message ?? "").Split(Array.Empty<char>(), StringSplitOptions.RemoveEmptyEntries));
        return normalized.Length <= 240 ? normalized : normalized[..240];
    }
}

public sealed class CollectorAutoStartReadResult
{
    public bool IsEnabled { get; init; }
    public bool ReadSucceeded { get; init; }
    public Exception? Exception { get; init; }
}

public static class CollectorAutoStartPolicy
{
    public static CollectorAutoStartReadResult ReadConfiguredState(
        bool configuredEnabled,
        Func<bool> isEnabled)
    {
        try
        {
            return new CollectorAutoStartReadResult
            {
                IsEnabled = configuredEnabled || isEnabled(),
                ReadSucceeded = true
            };
        }
        catch (Exception ex)
        {
            return new CollectorAutoStartReadResult
            {
                IsEnabled = configuredEnabled,
                ReadSucceeded = false,
                Exception = ex
            };
        }
    }

    public static CollectorAutoStartApplyResult Apply(
        bool currentEnabled,
        bool? requestedEnabled,
        Action<bool> setEnabled)
    {
        if (!requestedEnabled.HasValue)
        {
            return new CollectorAutoStartApplyResult
            {
                HasRemoteSetting = false,
                RequestedEnabled = currentEnabled,
                Applied = true
            };
        }

        if (currentEnabled == requestedEnabled.Value)
        {
            return new CollectorAutoStartApplyResult
            {
                HasRemoteSetting = true,
                RequestedEnabled = requestedEnabled.Value,
                Applied = true
            };
        }

        try
        {
            setEnabled(requestedEnabled.Value);
            return new CollectorAutoStartApplyResult
            {
                HasRemoteSetting = true,
                RequestedEnabled = requestedEnabled.Value,
                Changed = true,
                Applied = true
            };
        }
        catch (Exception ex)
        {
            return new CollectorAutoStartApplyResult
            {
                HasRemoteSetting = true,
                RequestedEnabled = requestedEnabled.Value,
                Applied = false,
                Exception = ex
            };
        }
    }
}
