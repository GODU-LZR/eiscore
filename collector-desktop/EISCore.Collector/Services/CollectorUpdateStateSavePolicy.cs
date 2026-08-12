using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record CollectorUpdateStateSaveResult(
    Exception? SaveException,
    bool ShouldShutdownAfterInstallerStarted,
    string FailureMetadataJson);

public static class CollectorUpdateStateSavePolicy
{
    public static async Task<CollectorUpdateStateSaveResult> TrySaveAndEvaluateAsync(
        AppConfig config,
        bool force,
        int? previousInstallerProcessId,
        DateTimeOffset now,
        Func<AppConfig, Task> saveAsync)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(saveAsync);

        var saveException = await CollectorConfigSavePolicy.TrySaveBestEffortAsync(config, saveAsync);
        var shouldShutdown = UpdateShutdownPolicy.ShouldShutdownAfterInstallerStarted(
            previousInstallerProcessId,
            config,
            now);

        return new CollectorUpdateStateSaveResult(
            saveException,
            shouldShutdown,
            saveException is null ? "{}" : BuildFailureMetadataJson(config, force, saveException));
    }

    public static string BuildFailureMetadataJson(
        AppConfig config,
        bool force,
        Exception exception)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(exception);

        return ClientLogMetadata.Serialize(new
        {
            force,
            exceptionType = exception.GetType().Name,
            config.ClientVersion,
            config.PendingUpdateVersion,
            hasPendingInstallerPath = !string.IsNullOrWhiteSpace(config.PendingUpdateInstallerPath),
            config.PendingUpdateInstallerProcessId,
            config.LastUpdateCheckAt
        });
    }
}
