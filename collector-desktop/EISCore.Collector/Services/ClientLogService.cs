using System.Text.RegularExpressions;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class ClientLogService
{
    private static readonly Regex SensitiveHeaderRegex = new(
        "(authorization|cookie|token|password|secret|access_token|refresh_token)(\\s*[:=]\\s*)([^&\\s,;]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex PhoneRegex = new(
        "(?<!\\d)1[3-9]\\d{9}(?!\\d)",
        RegexOptions.Compiled);

    private static readonly Regex IdCardRegex = new(
        "(?<!\\d)\\d{6}(19|20)\\d{2}(0[1-9]|1[0-2])([0-2]\\d|3[0-1])\\d{3}[0-9Xx](?!\\d)",
        RegexOptions.Compiled);

    private readonly ClientLogStore _store;
    private readonly string _sessionId = Guid.NewGuid().ToString("N");
    private AppConfig _config = new();
    private string _webViewVersion = "";

    public event EventHandler? HighPriorityLogWritten;

    public ClientLogService(ClientLogStore store)
    {
        _store = store;
    }

    public void UpdateContext(AppConfig config, string webViewVersion = "")
    {
        _config = config;
        if (!string.IsNullOrWhiteSpace(webViewVersion))
        {
            _webViewVersion = webViewVersion;
        }
    }

    public async Task LogAsync(
        string level,
        string eventType,
        string message,
        string stack = "",
        string route = "",
        string url = "",
        string requestUrl = "",
        int? statusCode = null,
        string metadataJson = "{}",
        CancellationToken cancellationToken = default)
    {
        var logEvent = new ClientLogEvent
        {
            Level = Sanitize(level),
            EventType = Sanitize(eventType),
            Message = Sanitize(message),
            Stack = Sanitize(stack),
            DeviceId = _config.DeviceId,
            DeviceName = _config.DeviceName,
            UserId = _config.DefaultUserId,
            Username = _config.DefaultUsername,
            Role = _config.DefaultRole,
            Route = Sanitize(route),
            Url = Sanitize(url),
            RequestUrl = Sanitize(requestUrl),
            StatusCode = statusCode,
            ClientSessionId = _sessionId,
            AppVersion = _config.ClientVersion,
            WebViewVersion = _webViewVersion,
            CreatedAt = DateTimeOffset.Now,
            MetadataJson = Sanitize(metadataJson)
        };

        await _store.InsertAsync(logEvent, cancellationToken);
        if (logEvent.IsHighPriority)
        {
            HighPriorityLogWritten?.Invoke(this, EventArgs.Empty);
        }
    }

    public static string Sanitize(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";

        var sanitized = SensitiveHeaderRegex.Replace(value, match => $"{match.Groups[1].Value}{match.Groups[2].Value}***");
        sanitized = PhoneRegex.Replace(sanitized, match => $"{match.Value[..3]}****{match.Value[^4..]}");
        sanitized = IdCardRegex.Replace(sanitized, match => $"{match.Value[..6]}********{match.Value[^4..]}");
        return sanitized;
    }
}
