using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class UpdateService
{
    private readonly ClientLogService _logService;
    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(5)
    };

    public UpdateService(ClientLogService logService)
    {
        _logService = logService;
    }

    public async Task<bool> CheckAsync(AppConfig config, bool force = false, CancellationToken cancellationToken = default)
    {
        if (!config.AutoUpdateEnabled || string.IsNullOrWhiteSpace(config.UpdateManifestUrl))
        {
            return false;
        }

        var interval = TimeSpan.FromHours(Math.Clamp(config.UpdateCheckIntervalHours, 1, 24 * 30));
        if (!force && config.LastUpdateCheckAt is { } lastCheck && DateTimeOffset.Now - lastCheck < interval)
        {
            return false;
        }

        config.LastUpdateCheckAt = DateTimeOffset.Now;
        try
        {
            var manifest = await _httpClient.GetFromJsonAsync<UpdateManifest>(
                config.UpdateManifestUrl,
                cancellationToken);
            if (manifest is null || string.IsNullOrWhiteSpace(manifest.Version) || string.IsNullOrWhiteSpace(manifest.DownloadUrl))
            {
                await _logService.LogAsync("warn", "collector_update_manifest_invalid", "更新 manifest 无效。", cancellationToken: cancellationToken);
                return true;
            }

            if (!IsNewerVersion(manifest.Version, config.ClientVersion))
            {
                await _logService.LogAsync(
                    "info",
                    "collector_update_not_required",
                    $"当前已是最新版本：{config.ClientVersion}",
                    metadataJson: $$"""{"latest_version":"{{manifest.Version}}"}""",
                    cancellationToken: cancellationToken);
                return true;
            }

            var installerPath = await DownloadAndVerifyAsync(config, manifest, cancellationToken);
            config.PendingUpdateVersion = manifest.Version;
            config.PendingUpdateInstallerPath = installerPath;

            await _logService.LogAsync(
                "info",
                "collector_update_downloaded",
                $"采集端更新包已下载：{manifest.Version}",
                metadataJson: $$"""{"version":"{{manifest.Version}}","installer_path":"{{EscapeJson(installerPath)}}","mandatory":{{manifest.Mandatory.ToString().ToLowerInvariant()}}}""",
                cancellationToken: cancellationToken);

            if (config.AutoUpdateInstallEnabled || manifest.Mandatory && manifest.AutoInstall)
            {
                StartInstaller(installerPath, manifest.InstallerArguments, config.UpdateInstallerArguments);
                await _logService.LogAsync(
                    "info",
                    "collector_update_installer_started",
                    $"采集端更新安装器已启动：{manifest.Version}",
                    metadataJson: $$"""{"version":"{{manifest.Version}}","installer_path":"{{EscapeJson(installerPath)}}"}""",
                    cancellationToken: cancellationToken);
            }

            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await _logService.LogAsync("warn", "collector_update_check_failed", "采集端更新检查失败。", ex.ToString(), cancellationToken: cancellationToken);
            return true;
        }
    }

    private async Task<string> DownloadAndVerifyAsync(AppConfig config, UpdateManifest manifest, CancellationToken cancellationToken)
    {
        var downloadUri = new Uri(manifest.DownloadUrl, UriKind.Absolute);
        var extension = Path.GetExtension(downloadUri.LocalPath);
        if (string.IsNullOrWhiteSpace(extension)) extension = ".bin";
        var safeVersion = new string(manifest.Version.Select(ch => char.IsLetterOrDigit(ch) || ch is '.' or '-' or '_' ? ch : '-').ToArray());
        var installerPath = Path.Combine(AppPaths.UpdateDirectory, $"EISCore.Collector-{safeVersion}{extension}");

        await using (var input = await _httpClient.GetStreamAsync(downloadUri, cancellationToken))
        await using (var output = new FileStream(installerPath, FileMode.Create, FileAccess.Write, FileShare.None, 1024 * 128, useAsync: true))
        {
            await input.CopyToAsync(output, cancellationToken);
        }

        var expectedHash = (manifest.Sha256 ?? "").Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(expectedHash))
        {
            var actualHash = await ComputeSha256Async(installerPath, cancellationToken);
            if (!string.Equals(actualHash, expectedHash, StringComparison.OrdinalIgnoreCase))
            {
                File.Delete(installerPath);
                throw new InvalidOperationException("更新包 SHA256 校验失败。");
            }
        }

        return installerPath;
    }

    private static void StartInstaller(string installerPath, string manifestArguments, string configArguments)
    {
        var arguments = string.IsNullOrWhiteSpace(configArguments) ? manifestArguments : configArguments;
        Process.Start(new ProcessStartInfo
        {
            FileName = installerPath,
            Arguments = arguments ?? "",
            UseShellExecute = true
        });
    }

    private static bool IsNewerVersion(string latestVersion, string currentVersion)
    {
        if (Version.TryParse(latestVersion, out var latest) && Version.TryParse(currentVersion, out var current))
        {
            return latest > current;
        }

        return string.Compare(latestVersion, currentVersion, StringComparison.OrdinalIgnoreCase) > 0;
    }

    private static async Task<string> ComputeSha256Async(string filePath, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 1024 * 128, useAsync: true);
        using var sha = SHA256.Create();
        var hash = await sha.ComputeHashAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string EscapeJson(string value)
    {
        return value.Replace("\\", "\\\\").Replace("\"", "\\\"");
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
}
