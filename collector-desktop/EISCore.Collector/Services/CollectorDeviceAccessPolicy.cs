using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class CollectorDeviceAccessPolicy
{
    public static bool IsDisabled(AppConfig config)
    {
        return string.Equals(config.DeviceStatus, "disabled", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsPending(AppConfig config)
    {
        return string.Equals(config.DeviceStatus, "pending", StringComparison.OrdinalIgnoreCase);
    }

    public static bool CanRunCollection(AppConfig config)
    {
        return !IsDisabled(config) && !IsPending(config);
    }

    public static bool CanUploadFiles(AppConfig config)
    {
        return CanRunCollection(config);
    }

    public static bool CanUploadLogs(AppConfig config)
    {
        return CanRunCollection(config);
    }

    public static bool CanFetchRemoteConfig(AppConfig config)
    {
        return CanRunCollection(config);
    }

    public static string GetCollectionBlockedReason(AppConfig config)
    {
        if (IsDisabled(config)) return "disabled";
        if (IsPending(config)) return "binding_required";
        return "";
    }
}
