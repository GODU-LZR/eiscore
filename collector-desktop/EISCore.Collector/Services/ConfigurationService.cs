using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Reflection;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class ConfigurationService
{
    public const string DefaultServerBaseUrl = "https://nanpai.eissys.top";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<AppConfig> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(AppPaths.ConfigPath))
        {
            return Normalize(new AppConfig
            {
                ServerBaseUrl = DefaultServerBaseUrl,
                DeviceCode = Environment.MachineName.ToLowerInvariant(),
                DeviceName = Environment.MachineName,
                DefaultUsername = Environment.UserName,
                UpdatedAt = DateTimeOffset.Now
            });
        }

        AppConfig? loaded;
        await using (var stream = File.OpenRead(AppPaths.ConfigPath))
        {
            loaded = await JsonSerializer.DeserializeAsync<AppConfig>(stream, JsonOptions, cancellationToken);
        }

        var loadedClientVersion = loaded?.ClientVersion;
        var normalized = Normalize(loaded ?? new AppConfig());
        if (loaded is not null && !string.Equals(loadedClientVersion, normalized.ClientVersion, StringComparison.Ordinal))
        {
            await SaveAsync(normalized, cancellationToken);
        }

        return normalized;
    }

    public async Task SaveAsync(AppConfig config, CancellationToken cancellationToken = default)
    {
        Normalize(config);
        config.UpdatedAt = DateTimeOffset.Now;
        Directory.CreateDirectory(AppPaths.RootDirectory);
        await using var stream = File.Create(AppPaths.ConfigPath);
        await JsonSerializer.SerializeAsync(stream, config, JsonOptions, cancellationToken);
    }

    public static AppConfig Normalize(AppConfig config)
    {
        var buildVersion = typeof(ConfigurationService).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion?
            .Split('+', 2)[0]
            .Trim();
        if (!string.IsNullOrWhiteSpace(buildVersion))
        {
            config.ClientVersion = buildVersion;
        }

        config.WatchFolders ??= new List<WatchFolderConfig>();
        config.AllowedExtensions ??= new List<string>();
        if (string.IsNullOrWhiteSpace(config.ServerBaseUrl))
        {
            config.ServerBaseUrl = DefaultServerBaseUrl;
        }
        config.MaxUploadBytes = config.MaxUploadBytes <= 0 ? 256L * 1024 * 1024 : config.MaxUploadBytes;
        config.UploadRetryIntervalSeconds = Math.Clamp(config.UploadRetryIntervalSeconds <= 0 ? 15 : config.UploadRetryIntervalSeconds, 5, 60 * 60);
        config.UploadMaxRetryCount = Math.Clamp(config.UploadMaxRetryCount <= 0 ? 10 : config.UploadMaxRetryCount, 1, 100);
        config.LogBatchSize = Math.Clamp(config.LogBatchSize <= 0 ? 100 : config.LogBatchSize, 1, 1000);
        config.LogFlushIntervalSeconds = Math.Clamp(config.LogFlushIntervalSeconds <= 0 ? 30 : config.LogFlushIntervalSeconds, 5, 60 * 60);
        config.LogRetentionDays = Math.Clamp(config.LogRetentionDays <= 0 ? 30 : config.LogRetentionDays, 1, 3650);
        config.HeartbeatIntervalSeconds = Math.Clamp(config.HeartbeatIntervalSeconds <= 0 ? 60 : config.HeartbeatIntervalSeconds, 15, 60 * 60);
        return config;
    }

    public string ProtectToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return "";
        var bytes = Encoding.UTF8.GetBytes(token);
        var protectedBytes = ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(protectedBytes);
    }

    public string UnprotectToken(string encryptedToken)
    {
        if (string.IsNullOrWhiteSpace(encryptedToken)) return "";

        try
        {
            var bytes = Convert.FromBase64String(encryptedToken);
            var clearBytes = ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(clearBytes);
        }
        catch
        {
            return "";
        }
    }
}
