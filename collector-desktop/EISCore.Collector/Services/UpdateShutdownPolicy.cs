using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class UpdateShutdownPolicy
{
    private static readonly TimeSpan InstallerStartWindow = TimeSpan.FromMinutes(5);

    public static bool ShouldShutdownAfterInstallerStarted(int? previousInstallerProcessId, AppConfig config, DateTimeOffset now)
    {
        if (!config.PendingUpdateInstallerProcessId.HasValue
            || config.PendingUpdateInstallerProcessId <= 0
            || !config.PendingUpdateInstallerStartedAt.HasValue)
        {
            return false;
        }

        if (config.PendingUpdateInstallerProcessId == previousInstallerProcessId)
        {
            return false;
        }

        var age = now - config.PendingUpdateInstallerStartedAt.Value;
        return age >= TimeSpan.Zero && age <= InstallerStartWindow;
    }
}
