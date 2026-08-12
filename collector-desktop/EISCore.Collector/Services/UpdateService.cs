using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed record UpdateInstallerStartResult(int? ProcessId, DateTimeOffset StartedAt, string Arguments);

public sealed class UpdateService
{
    private const int MaxManifestBytes = 128 * 1024;

    private readonly ClientLogService _logService;
    private readonly Func<string, string, UpdateInstallerStartResult> _installerStarter;
    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(5)
    };

    public UpdateService(
        ClientLogService logService,
        Func<string, string, UpdateInstallerStartResult>? installerStarter = null)
    {
        _logService = logService;
        _installerStarter = installerStarter ?? StartInstaller;
    }

    public async Task<bool> CheckAsync(AppConfig config, bool force = false, CancellationToken cancellationToken = default)
    {
        if (!config.AutoUpdateEnabled)
        {
            return false;
        }

        var interval = TimeSpan.FromHours(Math.Clamp(config.UpdateCheckIntervalHours, 1, 24 * 30));
        if (!force && config.LastUpdateCheckAt is { } lastCheck && DateTimeOffset.Now - lastCheck < interval)
        {
            return false;
        }

        config.LastUpdateCheckAt = DateTimeOffset.Now;
        var manifestUrl = CollectorUpdateUrlPolicy.EvaluateManifestUrl(config.UpdateManifestUrl);
        if (!manifestUrl.IsValid)
        {
            await LogInvalidManifestAsync(
                manifestUrl.StatusMessage,
                manifestUrl.Reason,
                config.UpdateManifestUrl,
                "",
                cancellationToken);
            return true;
        }

        var updateManifestUrl = manifestUrl.Uri?.ToString() ?? config.UpdateManifestUrl;
        var updateDownloadUrl = "";

        try
        {
            var manifestState = await FetchManifestAsync(
                manifestUrl.Uri!,
                cancellationToken);
            if (!manifestState.IsValid)
            {
                await LogInvalidManifestAsync(
                    manifestState.StatusMessage,
                    manifestState.Reason,
                    updateManifestUrl,
                    "",
                    cancellationToken);
                return true;
            }

            var manifest = manifestState.Manifest!;
            updateDownloadUrl = manifest?.DownloadUrl ?? "";
            if (manifest is null || string.IsNullOrWhiteSpace(manifest.Version) || string.IsNullOrWhiteSpace(manifest.DownloadUrl))
            {
                await LogInvalidManifestAsync(
                    "更新 manifest 无效。",
                    "missing_required_fields",
                    updateManifestUrl,
                    manifest?.DownloadUrl ?? "",
                    cancellationToken);
                return true;
            }

            var downloadUrl = CollectorUpdateUrlPolicy.EvaluateDownloadUrl(manifest.DownloadUrl);
            if (!downloadUrl.IsValid)
            {
                await LogInvalidManifestAsync(
                    downloadUrl.StatusMessage,
                    downloadUrl.Reason,
                    updateManifestUrl,
                    manifest.DownloadUrl,
                    cancellationToken);
                return true;
            }
            updateDownloadUrl = downloadUrl.Uri!.ToString();

            var updateVersion = CollectorUpdateVersionPolicy.Evaluate(manifest.Version, config.ClientVersion);
            if (!updateVersion.IsValid)
            {
                await LogInvalidManifestAsync(
                    updateVersion.StatusMessage,
                    updateVersion.Reason,
                    updateManifestUrl,
                    manifest.DownloadUrl,
                    cancellationToken);
                return true;
            }

            var autoInstallRequested = config.AutoUpdateInstallEnabled || (manifest.Mandatory && manifest.AutoInstall);
            var package = CollectorUpdatePackagePolicy.Evaluate(downloadUrl.Uri!, autoInstallRequested);
            if (!package.IsValid)
            {
                await LogInvalidManifestAsync(
                    package.StatusMessage,
                    package.Reason,
                    updateManifestUrl,
                    manifest.DownloadUrl,
                    cancellationToken);
                return true;
            }

            var installerArguments = CollectorUpdateInstallerArgumentsPolicy.Evaluate(
                manifest.InstallerArguments,
                config.UpdateInstallerArguments,
                autoInstallRequested);
            if (!installerArguments.IsValid)
            {
                await LogInvalidManifestAsync(
                    installerArguments.StatusMessage,
                    installerArguments.Reason,
                    updateManifestUrl,
                    manifest.DownloadUrl,
                    cancellationToken);
                return true;
            }

            var packageHash = CollectorUpdateHashPolicy.EvaluateSha256(manifest.Sha256);
            if (!packageHash.IsValid)
            {
                await LogInvalidManifestAsync(
                    packageHash.StatusMessage,
                    packageHash.Reason,
                    updateManifestUrl,
                    manifest.DownloadUrl,
                    cancellationToken);
                return true;
            }

            if (!updateVersion.IsUpdateAvailable)
            {
                var pendingUpdateCleared = HasPendingUpdateState(config);
                ClearPendingUpdateState(config);
                await SafeLogAsync(
                    "info",
                    "collector_update_not_required",
                    $"当前已是最新版本：{updateVersion.CurrentVersion}",
                    metadataJson: ClientLogMetadata.Serialize(new
                    {
                        latest_version = updateVersion.LatestVersion,
                        current_version = updateVersion.CurrentVersion,
                        manifest_url = updateManifestUrl,
                        download_url = updateDownloadUrl,
                        pending_update_cleared = pendingUpdateCleared
                    }),
                    cancellationToken: cancellationToken);
                return true;
            }

            var installerPath = await DownloadAndVerifyAsync(updateVersion.LatestVersion, downloadUrl.Uri!, package.Extension, packageHash.NormalizedSha256, cancellationToken);
            config.PendingUpdateVersion = updateVersion.LatestVersion;
            config.PendingUpdateInstallerPath = installerPath;
            ClearInstallerStartState(config);

            await SafeLogAsync(
                "info",
                "collector_update_downloaded",
                $"采集端更新包已下载：{updateVersion.LatestVersion}",
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    version = updateVersion.LatestVersion,
                    manifest_url = updateManifestUrl,
                    download_url = updateDownloadUrl,
                    installer_path = installerPath,
                    mandatory = manifest.Mandatory
                }),
                cancellationToken: cancellationToken);

            if (autoInstallRequested)
            {
                try
                {
                    var installerStart = _installerStarter(installerPath, installerArguments.Arguments);
                    config.PendingUpdateInstallerProcessId = installerStart.ProcessId;
                    config.PendingUpdateInstallerStartedAt = installerStart.StartedAt;
                    await SafeLogAsync(
                        "info",
                        "collector_update_installer_started",
                        $"采集端更新安装器已启动：{updateVersion.LatestVersion}",
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            version = updateVersion.LatestVersion,
                            manifest_url = updateManifestUrl,
                            download_url = updateDownloadUrl,
                            installer_path = installerPath,
                            installer_process_id = installerStart.ProcessId,
                            installer_started_at = installerStart.StartedAt,
                            installer_arguments = installerStart.Arguments
                        }),
                        cancellationToken: cancellationToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    ClearInstallerStartState(config);
                    await SafeLogAsync(
                        "error",
                        "collector_update_installer_start_failed",
                        $"采集端更新安装器启动失败：{updateVersion.LatestVersion}",
                        ex.ToString(),
                        metadataJson: ClientLogMetadata.Serialize(new
                        {
                            version = updateVersion.LatestVersion,
                            manifest_url = updateManifestUrl,
                            download_url = updateDownloadUrl,
                            installer_path = installerPath,
                            installer_arguments = installerArguments.Arguments
                        }),
                        cancellationToken: cancellationToken);
                    return true;
                }
            }

            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await SafeLogAsync(
                "warn",
                "collector_update_check_failed",
                "采集端更新检查失败。",
                ex.ToString(),
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    manifest_url = updateManifestUrl,
                    download_url = updateDownloadUrl
                }),
                cancellationToken: cancellationToken);
            return true;
        }
    }

    private async Task<UpdateManifestState> FetchManifestAsync(
        Uri manifestUri,
        CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync(
            manifestUri,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
        response.EnsureSuccessStatusCode();

        if (response.Content.Headers.ContentLength is > MaxManifestBytes)
        {
            return UpdateManifestState.Invalid(
                $"更新 manifest 超过 {MaxManifestBytes} 字节限制。",
                "manifest_too_large");
        }

        await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        while (true)
        {
            var read = await input.ReadAsync(chunk, cancellationToken);
            if (read <= 0) break;
            buffer.Write(chunk, 0, read);
            if (buffer.Length > MaxManifestBytes)
            {
                return UpdateManifestState.Invalid(
                    $"更新 manifest 超过 {MaxManifestBytes} 字节限制。",
                    "manifest_too_large");
            }
        }

        try
        {
            buffer.Position = 0;
            var manifest = await JsonSerializer.DeserializeAsync<UpdateManifest>(buffer, cancellationToken: cancellationToken);
            return manifest is null
                ? UpdateManifestState.Invalid("更新 manifest JSON 格式无效。", "invalid_manifest_json")
                : UpdateManifestState.Valid(manifest);
        }
        catch (JsonException)
        {
            return UpdateManifestState.Invalid("更新 manifest JSON 格式无效。", "invalid_manifest_json");
        }
    }

    private async Task<string> DownloadAndVerifyAsync(
        string latestVersion,
        Uri downloadUri,
        string extension,
        string sha256,
        CancellationToken cancellationToken)
    {
        var safeVersion = new string(latestVersion.Select(ch => char.IsLetterOrDigit(ch) || ch is '.' or '-' or '_' ? ch : '-').ToArray());
        var installerPath = Path.Combine(AppPaths.UpdateDirectory, $"EISCore.Collector-{safeVersion}{extension}");

        await using var input = await _httpClient.GetStreamAsync(downloadUri, cancellationToken);
        await UpdatePackageStore.SaveAtomicallyAsync(input, installerPath, sha256, cancellationToken);

        return installerPath;
    }

    private async Task LogInvalidManifestAsync(
        string message,
        string reason,
        string manifestUrl,
        string downloadUrl,
        CancellationToken cancellationToken)
    {
        await SafeLogAsync(
            "warn",
            "collector_update_manifest_invalid",
            message,
            metadataJson: ClientLogMetadata.Serialize(new
            {
                reason,
                manifestUrl,
                downloadUrl
            }),
            cancellationToken: cancellationToken);
    }

    private async Task SafeLogAsync(
        string level,
        string eventType,
        string message,
        string stack = "",
        string route = "",
        string url = "",
        string requestUrl = "",
        int? statusCode = null,
        string metadataJson = "{}",
        string appModule = "",
        string traceId = "",
        string aiImportBatchId = "",
        string sourceFileHash = "",
        string userId = "",
        string username = "",
        string role = "",
        CancellationToken cancellationToken = default)
    {
        try
        {
            await _logService.LogAsync(
                level,
                eventType,
                message,
                stack,
                route,
                url,
                requestUrl,
                statusCode,
                metadataJson,
                appModule,
                traceId,
                aiImportBatchId,
                sourceFileHash,
                userId,
                username,
                role,
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch
        {
            // Update checks are best-effort background work; logging failure must not break the caller.
        }
    }

    private static void ClearInstallerStartState(AppConfig config)
    {
        config.PendingUpdateInstallerProcessId = null;
        config.PendingUpdateInstallerStartedAt = null;
    }

    private static bool HasPendingUpdateState(AppConfig config)
    {
        return !string.IsNullOrWhiteSpace(config.PendingUpdateVersion)
            || !string.IsNullOrWhiteSpace(config.PendingUpdateInstallerPath)
            || config.PendingUpdateInstallerProcessId.HasValue
            || config.PendingUpdateInstallerStartedAt.HasValue;
    }

    private static void ClearPendingUpdateState(AppConfig config)
    {
        config.PendingUpdateVersion = "";
        config.PendingUpdateInstallerPath = "";
        ClearInstallerStartState(config);
    }

    private static UpdateInstallerStartResult StartInstaller(string installerPath, string arguments)
    {
        var startedAt = DateTimeOffset.Now;
        var process = Process.Start(new ProcessStartInfo
        {
            FileName = installerPath,
            Arguments = arguments,
            UseShellExecute = true
        });
        if (process is null)
        {
            throw new InvalidOperationException("更新安装器进程未启动。");
        }

        return new UpdateInstallerStartResult(process.Id, startedAt, arguments);
    }

    private sealed class UpdateManifest
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "";

        [JsonPropertyName("download_url")]
        public string DownloadUrl { get; set; } = "";

        [JsonPropertyName("sha256")]
        public string Sha256 { get; set; } = "";

        [JsonPropertyName("mandatory")]
        public bool Mandatory { get; set; }

        [JsonPropertyName("auto_install")]
        public bool AutoInstall { get; set; }

        [JsonPropertyName("installer_arguments")]
        public string InstallerArguments { get; set; } = "";
    }

    private sealed record UpdateManifestState(
        bool IsValid,
        UpdateManifest? Manifest,
        string StatusMessage,
        string Reason)
    {
        public static UpdateManifestState Valid(UpdateManifest manifest)
        {
            return new UpdateManifestState(true, manifest, "", "");
        }

        public static UpdateManifestState Invalid(string statusMessage, string reason)
        {
            return new UpdateManifestState(false, null, statusMessage, reason);
        }
    }
}
