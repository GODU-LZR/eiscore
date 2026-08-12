using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class CollectorDeviceAuthPolicy
{
    public static bool ApplyAuthenticationFailure(AppConfig config)
    {
        var changed = false;
        if (!string.Equals(config.DeviceStatus, "pending", StringComparison.OrdinalIgnoreCase))
        {
            config.DeviceStatus = "pending";
            changed = true;
        }

        if (!string.IsNullOrWhiteSpace(config.EncryptedDeviceToken))
        {
            config.EncryptedDeviceToken = "";
            changed = true;
        }

        return changed;
    }

    public static async Task<Exception?> TrySaveAuthenticationFailureStateAsync(
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
