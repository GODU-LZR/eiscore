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
    public string RemoteConfigVersion { get; set; } = "";
    public long MaxUploadBytes { get; set; } = 256L * 1024 * 1024;
    public int ChunkSizeBytes { get; set; } = 8 * 1024 * 1024;
    public int UploadRetryIntervalSeconds { get; set; } = 15;
    public int UploadMaxRetryCount { get; set; } = 10;
    public List<string> AllowedExtensions { get; set; } = new();
    public int LogBatchSize { get; set; } = 100;
    public int LogFlushIntervalSeconds { get; set; } = 30;
    public int LogRetentionDays { get; set; } = 30;
    public bool HighPriorityLogImmediate { get; set; } = true;
    public int HeartbeatIntervalSeconds { get; set; } = 60;
    public bool AutoUpdateEnabled { get; set; }
    public string UpdateManifestUrl { get; set; } = "";
    public int UpdateCheckIntervalHours { get; set; } = 24;
    public bool AutoUpdateInstallEnabled { get; set; }
    public string UpdateInstallerArguments { get; set; } = "";
    public string PendingUpdateVersion { get; set; } = "";
    public string PendingUpdateInstallerPath { get; set; } = "";
    public DateTimeOffset? LastBoundAt { get; set; }
    public DateTimeOffset? LastRemoteConfigAt { get; set; }
    public DateTimeOffset? LastUpdateCheckAt { get; set; }
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
