namespace EISCore.Collector.Models;

public sealed class AppConfig
{
    public string ServerBaseUrl { get; set; } = "";
    public string EnterpriseCode { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string DeviceCode { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string DefaultUserId { get; set; } = "";
    public string DefaultUsername { get; set; } = "";
    public string DefaultRole { get; set; } = "";
    public string EncryptedDeviceToken { get; set; } = "";
    public string ClientVersion { get; set; } = "0.1.0";
    public List<WatchFolderConfig> WatchFolders { get; set; } = new();
    public bool AutoStartEnabled { get; set; }
    public DateTimeOffset? LastBoundAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.Now;
}

public sealed class WatchFolderConfig
{
    public string FolderPath { get; set; } = "";
    public string FolderName { get; set; } = "";
    public string DefaultUserId { get; set; } = "";
    public string DefaultRole { get; set; } = "";
    public bool Enabled { get; set; } = true;
}
