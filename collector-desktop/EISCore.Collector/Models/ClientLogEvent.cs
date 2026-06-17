using System.Text.Json.Serialization;

namespace EISCore.Collector.Models;

public sealed class ClientLogEvent
{
    public long Id { get; set; }
    public string Level { get; set; } = "info";
    public string EventType { get; set; } = "collector_event";
    public string Message { get; set; } = "";
    public string Stack { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string DeviceName { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Username { get; set; } = "";
    public string Role { get; set; } = "";
    public string AppModule { get; set; } = "";
    public string Route { get; set; } = "";
    public string Url { get; set; } = "";
    public string RequestUrl { get; set; } = "";
    public int? StatusCode { get; set; }
    public string ClientSessionId { get; set; } = "";
    public string TraceId { get; set; } = "";
    public string AiImportBatchId { get; set; } = "";
    public string SourceFileHash { get; set; } = "";
    public string AppVersion { get; set; } = "";
    public string WebViewVersion { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    public string MetadataJson { get; set; } = "{}";

    [JsonIgnore]
    public bool IsHighPriority => Level.Equals("error", StringComparison.OrdinalIgnoreCase)
        || EventType.Contains("failed", StringComparison.OrdinalIgnoreCase)
        || EventType.Contains("error", StringComparison.OrdinalIgnoreCase);
}
