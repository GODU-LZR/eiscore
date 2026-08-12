using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorConfigSaveState(bool CanSave, string StatusMessage);

public static class CollectorConfigSavePolicy
{
    public static CollectorConfigSaveState Evaluate(string? serverBaseUrl)
    {
        var serverAddress = CollectorServerAddressPolicy.Evaluate(serverBaseUrl, requireNonEmpty: false);
        return serverAddress.IsValid
            ? new CollectorConfigSaveState(true, "")
            : new CollectorConfigSaveState(false, serverAddress.StatusMessage);
    }

    public static async Task<Exception?> TrySaveBestEffortAsync(
        AppConfig config,
        Func<AppConfig, Task> saveAsync)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(saveAsync);

        try
        {
            await saveAsync(config);
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }
}
