using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorBindingIdentitySnapshot(
    string ServerBaseUrl,
    string EnterpriseCode,
    string DeviceCode,
    bool HasLocalBinding);

public static class CollectorBindingIdentityPolicy
{
    public static CollectorBindingIdentitySnapshot Capture(AppConfig config)
    {
        return new CollectorBindingIdentitySnapshot(
            NormalizeServerBaseUrl(config.ServerBaseUrl),
            Normalize(config.EnterpriseCode),
            Normalize(config.DeviceCode),
            HasLocalBinding(config));
    }

    public static bool InvalidateIfIdentityChanged(CollectorBindingIdentitySnapshot previous, AppConfig current)
    {
        if (!previous.HasLocalBinding || !HasIdentityChanged(previous, current))
        {
            return false;
        }

        current.DeviceId = "";
        current.EncryptedDeviceToken = "";
        current.DeviceStatus = "pending";
        current.LastBoundAt = null;
        current.RemoteConfigVersion = "";
        current.LastRemoteConfigAt = null;
        return true;
    }

    private static bool HasIdentityChanged(CollectorBindingIdentitySnapshot previous, AppConfig current)
    {
        return !string.Equals(previous.ServerBaseUrl, NormalizeServerBaseUrl(current.ServerBaseUrl), StringComparison.OrdinalIgnoreCase)
            || !string.Equals(previous.EnterpriseCode, Normalize(current.EnterpriseCode), StringComparison.OrdinalIgnoreCase)
            || !string.Equals(previous.DeviceCode, Normalize(current.DeviceCode), StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasLocalBinding(AppConfig config)
    {
        return !string.IsNullOrWhiteSpace(config.EncryptedDeviceToken)
            || !string.IsNullOrWhiteSpace(config.DeviceId)
            || string.Equals(config.DeviceStatus, "active", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeServerBaseUrl(string? value)
    {
        return CollectorServerAddressPolicy.NormalizeForStorage(value);
    }
    private static string Normalize(string? value)
    {
        return (value ?? "").Trim();
    }
}
