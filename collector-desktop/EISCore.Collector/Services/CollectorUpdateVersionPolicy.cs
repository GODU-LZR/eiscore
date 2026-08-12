namespace EISCore.Collector.Services;

public sealed record CollectorUpdateVersionState(
    bool IsValid,
    bool IsUpdateAvailable,
    string LatestVersion,
    string CurrentVersion,
    string StatusMessage,
    string Reason);

public static class CollectorUpdateVersionPolicy
{
    public static CollectorUpdateVersionState Evaluate(string? latestVersion, string? currentVersion)
    {
        var latestValue = (latestVersion ?? "").Trim();
        var currentValue = (currentVersion ?? "").Trim();

        if (string.IsNullOrWhiteSpace(latestValue))
        {
            return new CollectorUpdateVersionState(
                false,
                false,
                "",
                currentValue,
                "更新 manifest 缺少版本号。",
                "missing_update_version");
        }

        if (!TryParseDottedVersion(latestValue, out var latest))
        {
            return new CollectorUpdateVersionState(
                false,
                false,
                latestValue,
                currentValue,
                "更新 manifest 的版本号格式无效。",
                "invalid_update_version");
        }

        if (string.IsNullOrWhiteSpace(currentValue) || !TryParseDottedVersion(currentValue, out var current))
        {
            return new CollectorUpdateVersionState(
                false,
                false,
                latestValue,
                currentValue,
                "当前采集端版本号格式无效。",
                "invalid_current_version");
        }

        return new CollectorUpdateVersionState(
            true,
            latest > current,
            latestValue,
            currentValue,
            "",
            "");
    }

    private static bool TryParseDottedVersion(string value, out Version version)
    {
        version = new Version(0, 0);
        var parts = value.Split('.', StringSplitOptions.None);
        if (parts.Length is < 2 or > 4)
        {
            return false;
        }

        if (parts.Any(part => part.Length == 0 || part.Any(ch => ch is < '0' or > '9')))
        {
            return false;
        }

        if (!Version.TryParse(value, out var parsed) || parsed is null)
        {
            return false;
        }

        version = parsed;
        return true;
    }
}
