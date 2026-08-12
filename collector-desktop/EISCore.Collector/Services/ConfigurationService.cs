using System.Text.Json;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class ConfigurationService
{
    private const long DefaultMaxUploadBytes = 256L * 1024 * 1024;
    private const long MinMaxUploadBytes = 1024L * 1024;
    private const long MaxMaxUploadBytes = 1024L * 1024 * 1024;
    private const int DefaultChunkSizeBytes = 8 * 1024 * 1024;
    private const int MinChunkSizeBytes = 256 * 1024;
    private const int MaxChunkSizeBytes = 64 * 1024 * 1024;

    private readonly DeviceTokenProtector _deviceTokenProtector;
    private readonly SemaphoreSlim _configLock = new(1, 1);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public ConfigurationService(DeviceTokenProtector? deviceTokenProtector = null)
    {
        _deviceTokenProtector = deviceTokenProtector ?? new DeviceTokenProtector();
    }

    public async Task<AppConfig> LoadAsync(CancellationToken cancellationToken = default)
    {
        await _configLock.WaitAsync(cancellationToken);
        try
        {
            return await LoadCoreAsync(cancellationToken);
        }
        finally
        {
            _configLock.Release();
        }
    }

    private async Task<AppConfig> LoadCoreAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(AppPaths.ConfigPath))
        {
            return Normalize(new AppConfig
            {
                DeviceCode = Environment.MachineName.ToLowerInvariant(),
                DeviceName = Environment.MachineName,
                DefaultUsername = Environment.UserName,
                UpdatedAt = DateTimeOffset.Now
            });
        }

        var result = await TryLoadConfigAsync(AppPaths.ConfigPath, cancellationToken)
            ?? await TryLoadConfigAsync(GetBackupPath(), cancellationToken);
        var config = Normalize(result?.Config ?? new AppConfig
        {
            DeviceCode = Environment.MachineName.ToLowerInvariant(),
            DeviceName = Environment.MachineName,
            DefaultUsername = Environment.UserName,
            UpdatedAt = DateTimeOffset.Now
        });

        if (result?.HadLegacyPlainDeviceToken == true)
        {
            await SaveCoreAsync(config, cancellationToken);
        }
        else
        {
            await SanitizeBackupAsync(cancellationToken);
        }

        return config;
    }

    public async Task SaveAsync(AppConfig config, CancellationToken cancellationToken = default)
    {
        await _configLock.WaitAsync(cancellationToken);
        try
        {
            await SaveCoreAsync(config, cancellationToken);
        }
        finally
        {
            _configLock.Release();
        }
    }

    private async Task SaveCoreAsync(AppConfig config, CancellationToken cancellationToken)
    {
        Normalize(config);
        config.UpdatedAt = DateTimeOffset.Now;
        Directory.CreateDirectory(AppPaths.RootDirectory);

        var tempPath = GetTempPath();
        try
        {
            await using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 16 * 1024, useAsync: true))
            {
                await JsonSerializer.SerializeAsync(stream, config, JsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
            }

            if (await TryLoadConfigAsync(AppPaths.ConfigPath, cancellationToken) is { } existing)
            {
                await TryWriteConfigAsync(GetBackupPath(), Normalize(existing.Config), cancellationToken);
            }

            File.Move(tempPath, AppPaths.ConfigPath, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                try
                {
                    File.Delete(tempPath);
                }
                catch
                {
                }
            }
        }
    }

    public static AppConfig Normalize(AppConfig config)
    {
        config.WatchFolders ??= new List<WatchFolderConfig>();
        config.AllowedExtensions ??= new List<string>();
        config.ServerBaseUrl = CollectorServerAddressPolicy.NormalizeForStorage(config.ServerBaseUrl);
        NormalizeTextFields(config);
        NormalizeWatchFolders(config);
        config.AllowedExtensions = CollectorAllowedExtensionsPolicy.Normalize(config.AllowedExtensions);
        config.DeviceStatus = NormalizeDeviceStatus(config.DeviceStatus);
        NormalizeUploadConfig(config);
        config.UploadRetryIntervalSeconds = Math.Clamp(config.UploadRetryIntervalSeconds <= 0 ? 15 : config.UploadRetryIntervalSeconds, 5, 60 * 60);
        config.UploadMaxRetryCount = Math.Clamp(config.UploadMaxRetryCount <= 0 ? 10 : config.UploadMaxRetryCount, 1, 100);
        config.UploadQueueRetentionDays = Math.Clamp(config.UploadQueueRetentionDays <= 0 ? 30 : config.UploadQueueRetentionDays, 1, 3650);
        config.LogBatchSize = Math.Clamp(config.LogBatchSize <= 0 ? 100 : config.LogBatchSize, 1, 1000);
        config.LogFlushIntervalSeconds = Math.Clamp(config.LogFlushIntervalSeconds <= 0 ? 30 : config.LogFlushIntervalSeconds, 5, 60 * 60);
        config.LogRetentionDays = Math.Clamp(config.LogRetentionDays <= 0 ? 30 : config.LogRetentionDays, 1, 3650);
        config.HeartbeatIntervalSeconds = Math.Clamp(config.HeartbeatIntervalSeconds <= 0 ? 60 : config.HeartbeatIntervalSeconds, 15, 60 * 60);
        NormalizeUpdateConfig(config);
        return config;
    }

    private static void NormalizeUploadConfig(AppConfig config)
    {
        config.MaxUploadBytes = Math.Clamp(
            config.MaxUploadBytes <= 0 ? DefaultMaxUploadBytes : config.MaxUploadBytes,
            MinMaxUploadBytes,
            MaxMaxUploadBytes);
        config.ChunkSizeBytes = Math.Clamp(
            config.ChunkSizeBytes <= 0 ? DefaultChunkSizeBytes : config.ChunkSizeBytes,
            MinChunkSizeBytes,
            MaxChunkSizeBytes);
    }

    private static void NormalizeTextFields(AppConfig config)
    {
        config.EnterpriseCode = NormalizeText(config.EnterpriseCode, 64);
        config.DeviceId = NormalizeText(config.DeviceId, 128);
        config.DeviceCode = NormalizeText(config.DeviceCode, 128);
        config.DeviceName = NormalizeText(config.DeviceName, 120);
        config.DefaultUserId = NormalizeText(config.DefaultUserId, 128);
        config.DefaultUsername = NormalizeText(config.DefaultUsername, 120);
        config.DefaultRole = NormalizeText(config.DefaultRole, 80);
        config.ClientVersion = NormalizeText(config.ClientVersion, 64);
        config.WebViewVersion = NormalizeText(config.WebViewVersion, 120);
        config.RemoteConfigVersion = NormalizeText(config.RemoteConfigVersion, 120);
        config.PendingUpdateVersion = NormalizeText(config.PendingUpdateVersion, 64);
        config.PendingUpdateInstallerPath = NormalizeText(config.PendingUpdateInstallerPath, 1024);
    }

    private static void NormalizeWatchFolders(AppConfig config)
    {
        var normalizedFolders = new List<WatchFolderConfig>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var folder in config.WatchFolders.Where(item => item is not null))
        {
            folder.FolderPath = NormalizeText(folder.FolderPath, 1024);
            if (string.IsNullOrWhiteSpace(folder.FolderPath) || !seen.Add(NormalizeWatchFolderKey(folder.FolderPath)))
            {
                continue;
            }

            folder.FolderName = NormalizeText(folder.FolderName, 120);
            folder.DefaultUserId = NormalizeText(folder.DefaultUserId, 128);
            folder.DefaultUsername = NormalizeText(folder.DefaultUsername, 120);
            folder.DefaultRole = NormalizeText(folder.DefaultRole, 80);
            normalizedFolders.Add(folder);
        }

        config.WatchFolders = normalizedFolders;
    }

    public static string NormalizeWatchFolderKey(string? folderPath)
    {
        return NormalizeText(folderPath, 1024)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar, '\\', '/');
    }

    private static void NormalizeUpdateConfig(AppConfig config)
    {
        var update = CollectorRemoteUpdatePolicy.Normalize(new CollectorUpdatePolicy
        {
            Enabled = config.AutoUpdateEnabled,
            ManifestUrl = config.UpdateManifestUrl,
            CheckIntervalHours = config.UpdateCheckIntervalHours,
            AutoInstall = config.AutoUpdateInstallEnabled,
            InstallerArguments = config.UpdateInstallerArguments
        });

        config.AutoUpdateEnabled = update.AutoUpdateEnabled;
        config.UpdateManifestUrl = update.ManifestUrl;
        config.UpdateCheckIntervalHours = update.CheckIntervalHours;
        config.AutoUpdateInstallEnabled = update.AutoInstallEnabled;
        config.UpdateInstallerArguments = update.InstallerArguments;
    }

    public static string NormalizeDeviceStatus(string? status)
    {
        var normalized = (status ?? "").Trim().ToLowerInvariant();
        return normalized is "pending" or "active" or "offline" or "disabled"
            ? normalized
            : "";
    }

    public string ProtectToken(string token)
    {
        return _deviceTokenProtector.Protect(token);
    }

    public string UnprotectToken(string encryptedToken)
    {
        return _deviceTokenProtector.Unprotect(encryptedToken);
    }

    private async Task<ConfigLoadResult?> TryLoadConfigAsync(string path, CancellationToken cancellationToken)
    {
        if (!File.Exists(path)) return null;

        string json;
        try
        {
            json = await File.ReadAllTextAsync(path, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return null;
        }

        try
        {
            var config = JsonSerializer.Deserialize<AppConfig>(json, JsonOptions);
            if (config is null) return null;

            var legacyDeviceToken = GetLegacyPlainDeviceToken(json);
            var hasLegacyPlainToken = !string.IsNullOrWhiteSpace(legacyDeviceToken);
            if (hasLegacyPlainToken && string.IsNullOrWhiteSpace(config.EncryptedDeviceToken))
            {
                config.EncryptedDeviceToken = ProtectToken(legacyDeviceToken);
            }

            return new ConfigLoadResult(config, hasLegacyPlainToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return null;
        }
    }

    private static async Task WriteConfigAsync(
        string path,
        AppConfig config,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path) ?? AppPaths.RootDirectory);
        var tempPath = GetTempPath(path);
        try
        {
            await using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 16 * 1024, useAsync: true))
            {
                await JsonSerializer.SerializeAsync(stream, config, JsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
            }

            File.Move(tempPath, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                try
                {
                    File.Delete(tempPath);
                }
                catch
                {
                }
            }
        }
    }

    private async Task SanitizeBackupAsync(CancellationToken cancellationToken)
    {
        if (await TryLoadConfigAsync(GetBackupPath(), cancellationToken) is { } backup)
        {
            await TryWriteConfigAsync(GetBackupPath(), Normalize(backup.Config), cancellationToken);
        }
    }

    private static async Task<bool> TryWriteConfigAsync(
        string path,
        AppConfig config,
        CancellationToken cancellationToken)
    {
        try
        {
            await WriteConfigAsync(path, config, cancellationToken);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return false;
        }
    }

    private static string GetLegacyPlainDeviceToken(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return "";
            }

            if (document.RootElement.TryGetProperty("deviceToken", out var camelCaseToken)
                && camelCaseToken.ValueKind == JsonValueKind.String)
            {
                return camelCaseToken.GetString() ?? "";
            }

            if (document.RootElement.TryGetProperty("DeviceToken", out var pascalCaseToken)
                && pascalCaseToken.ValueKind == JsonValueKind.String)
            {
                return pascalCaseToken.GetString() ?? "";
            }
        }
        catch
        {
        }

        return "";
    }

    private static string GetBackupPath()
    {
        return AppPaths.ConfigPath + ".bak";
    }

    private static string GetTempPath()
    {
        return GetTempPath(AppPaths.ConfigPath);
    }

    private static string GetTempPath(string path)
    {
        return $"{path}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
    }

    private static string TrimTo(string? value, int maxLength)
    {
        var normalized = NormalizeText(value, maxLength);
        return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    public static string NormalizeText(string? value, int maxLength)
    {
        var normalized = StripControlCharacters(value);
        return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    private static string StripControlCharacters(string? value)
    {
        return new string((value ?? "")
            .Trim()
            .Where(ch => !char.IsControl(ch))
            .ToArray());
    }

    private sealed record ConfigLoadResult(AppConfig Config, bool HadLegacyPlainDeviceToken);
}
