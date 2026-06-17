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
