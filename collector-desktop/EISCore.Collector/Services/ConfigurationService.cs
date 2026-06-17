using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class ConfigurationService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<AppConfig> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(AppPaths.ConfigPath))
        {
            return new AppConfig
            {
                DeviceCode = Environment.MachineName.ToLowerInvariant(),
                DeviceName = Environment.MachineName,
                DefaultUsername = Environment.UserName,
                UpdatedAt = DateTimeOffset.Now
            };
        }

        await using var stream = File.OpenRead(AppPaths.ConfigPath);
        var config = await JsonSerializer.DeserializeAsync<AppConfig>(stream, JsonOptions, cancellationToken);
        return config ?? new AppConfig();
    }

    public async Task SaveAsync(AppConfig config, CancellationToken cancellationToken = default)
    {
        config.UpdatedAt = DateTimeOffset.Now;
        Directory.CreateDirectory(AppPaths.RootDirectory);
        await using var stream = File.Create(AppPaths.ConfigPath);
        await JsonSerializer.SerializeAsync(stream, config, JsonOptions, cancellationToken);
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
