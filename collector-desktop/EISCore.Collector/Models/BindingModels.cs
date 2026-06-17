namespace EISCore.Collector.Models;

public sealed class DeviceBindRequest
{
    public string EnterpriseCode { get; set; } = "";
    public string DeviceCode { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string DefaultUserId { get; set; } = "";
    public string DefaultUsername { get; set; } = "";
    public string DefaultRole { get; set; } = "";
    public string AuthorizationCode { get; set; } = "";
    public string WindowsUsername { get; set; } = "";
    public string ClientVersion { get; set; } = "";
}

public sealed class DeviceBindResponse
{
    public string DeviceId { get; set; } = "";
    public string DeviceToken { get; set; } = "";
    public string DeviceCode { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string DefaultUserId { get; set; } = "";
    public string DefaultUsername { get; set; } = "";
    public string DefaultRole { get; set; } = "";
}

public sealed class UploadResponse
{
    public string AssetId { get; set; } = "";
    public string BatchId { get; set; } = "";
    public bool Duplicate { get; set; }
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
}

public sealed class DeviceConfigResponse
{
    public bool Ok { get; set; }
    public string ServerTime { get; set; } = "";
    public string ConfigVersion { get; set; } = "";
    public DeviceConfigDevice Device { get; set; } = new();
    public CollectorRemoteConfig Config { get; set; } = new();
}

public sealed class DeviceConfigDevice
{
    public string DeviceId { get; set; } = "";
    public string DeviceCode { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string DefaultUserId { get; set; } = "";
    public string DefaultUsername { get; set; } = "";
    public string DefaultRole { get; set; } = "";
    public string Status { get; set; } = "";
}

public sealed class CollectorRemoteConfig
{
    public string DefaultUserId { get; set; } = "";
    public string DefaultUsername { get; set; } = "";
    public string DefaultRole { get; set; } = "";
    public bool? AutoStartEnabled { get; set; }
    public int HeartbeatIntervalSeconds { get; set; } = 60;
    public List<WatchFolderConfig> WatchFolders { get; set; } = new();
    public CollectorUploadPolicy Upload { get; set; } = new();
    public CollectorLogPolicy Logs { get; set; } = new();
    public CollectorUpdatePolicy Update { get; set; } = new();
}

public sealed class CollectorUploadPolicy
{
    public long MaxFileBytes { get; set; } = 256L * 1024 * 1024;
    public int ChunkSizeBytes { get; set; } = 8 * 1024 * 1024;
    public int RetryIntervalSeconds { get; set; } = 15;
    public int MaxRetryCount { get; set; } = 10;
    public List<string> AllowedExtensions { get; set; } = new();
}

public sealed class CollectorLogPolicy
{
    public int BatchSize { get; set; } = 100;
    public int FlushIntervalSeconds { get; set; } = 30;
    public int RetentionDays { get; set; } = 30;
    public bool HighPriorityImmediate { get; set; } = true;
}

public sealed class CollectorUpdatePolicy
{
    public bool Enabled { get; set; }
    public string ManifestUrl { get; set; } = "";
    public int CheckIntervalHours { get; set; } = 24;
    public bool AutoInstall { get; set; }
    public string InstallerArguments { get; set; } = "";
}

public sealed class ChunkUploadInitResponse
{
    public bool Duplicate { get; set; }
    public string Status { get; set; } = "";
    public string AssetId { get; set; } = "";
    public string SessionId { get; set; } = "";
    public List<int> UploadedChunks { get; set; } = new();
    public List<int> MissingChunks { get; set; } = new();
    public int ChunkSize { get; set; }
    public int TotalChunks { get; set; }
}

public sealed class ChunkUploadPartResponse
{
    public bool Ok { get; set; }
    public string SessionId { get; set; } = "";
    public int ChunkIndex { get; set; }
    public int UploadedChunks { get; set; }
    public int TotalChunks { get; set; }
}
