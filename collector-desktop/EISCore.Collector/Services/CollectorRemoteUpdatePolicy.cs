using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorRemoteUpdateState(
    bool AutoUpdateEnabled,
    string ManifestUrl,
    int CheckIntervalHours,
    bool AutoInstallEnabled,
    string InstallerArguments,
    string Reason);

public static class CollectorRemoteUpdatePolicy
{
    public static CollectorRemoteUpdateState Normalize(CollectorUpdatePolicy? remote)
    {
        remote ??= new CollectorUpdatePolicy();
        var checkIntervalHours = Math.Clamp(remote.CheckIntervalHours <= 0 ? 24 : remote.CheckIntervalHours, 1, 24 * 30);

        if (!remote.Enabled)
        {
            return new CollectorRemoteUpdateState(
                false,
                "",
                checkIntervalHours,
                false,
                "",
                "");
        }

        var manifestUrl = CollectorUpdateUrlPolicy.EvaluateManifestUrl(remote.ManifestUrl);
        if (!manifestUrl.IsValid)
        {
            return new CollectorRemoteUpdateState(
                false,
                "",
                checkIntervalHours,
                false,
                "",
                manifestUrl.Reason);
        }

        var installerArguments = CollectorUpdateInstallerArgumentsPolicy.Evaluate(
            remote.InstallerArguments,
            "",
            remote.AutoInstall);
        if (!installerArguments.IsValid)
        {
            return new CollectorRemoteUpdateState(
                true,
                manifestUrl.Uri!.ToString(),
                checkIntervalHours,
                false,
                "",
                installerArguments.Reason);
        }

        return new CollectorRemoteUpdateState(
            true,
            manifestUrl.Uri!.ToString(),
            checkIntervalHours,
            remote.AutoInstall,
            installerArguments.Arguments,
            "");
    }
}
