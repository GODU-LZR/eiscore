using System.Text.RegularExpressions;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class ClientLogService
{
    private const string Redacted = "***";

    private static readonly Regex BearerTokenRegex = new(
        "(authorization\\s*[:=]\\s*bearer\\s+|bearer\\s+)([A-Za-z0-9._~+/=-]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveKeyValueRegex = new(
        "(authorization|cookie|token|password|secret|access_token|refresh_token|auth_token|device_token|deviceToken|authorization_code|authorizationCode|binding_code|bindingCode)(\\s*[:=]\\s*)(\"?)([^\"&\\s,;}]+)(\"?)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveJsonStringRegex = new(
        "\"(authorization|cookie|token|password|secret|access_token|refresh_token|auth_token|device_token|deviceToken|authorization_code|authorizationCode|binding_code|bindingCode)\"(\\s*:\\s*)\"[^\"]*\"",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveQueryRegex = new(
        "([?&](?:authorization|cookie|token|password|secret|access_token|refresh_token|auth_token|device_token|deviceToken|authorization_code|authorizationCode|binding_code|bindingCode)=)([^&#\\s]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex WindowsUserPathRegex = new(
        "([A-Za-z]:\\\\Users\\\\)[^\\\\\\r\\n\"']+",
        RegexOptions.Compiled);

    private static readonly Regex EscapedWindowsUserPathRegex = new(
        "([A-Za-z]:\\\\\\\\Users\\\\\\\\)[^\\\\\\r\\n\"']+",
        RegexOptions.Compiled);

    private static readonly Regex UnixUserPathRegex = new(
        "((?:/home|/Users)/)[^/\\s\"']+",
        RegexOptions.Compiled);

    private static readonly Regex DataUrlRegex = new(
        "data:[^;,\\s]+;base64,[A-Za-z0-9+/=]{32,}",
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
        var logEvent = SanitizeEvent(new ClientLogEvent
        {
            Level = level,
            EventType = eventType,
            Message = message,
            Stack = stack,
            DeviceId = _config.DeviceId,
            DeviceName = _config.DeviceName,
            UserId = _config.DefaultUserId,
            Username = _config.DefaultUsername,
            Role = _config.DefaultRole,
            Route = route,
            Url = url,
            RequestUrl = requestUrl,
            StatusCode = statusCode,
            ClientSessionId = _sessionId,
            AppVersion = _config.ClientVersion,
            WebViewVersion = _webViewVersion,
            CreatedAt = DateTimeOffset.Now,
            MetadataJson = metadataJson
        });

        await _store.InsertAsync(logEvent, cancellationToken);
        if (logEvent.IsHighPriority)
        {
            HighPriorityLogWritten?.Invoke(this, EventArgs.Empty);
        }
    }

    public static string Sanitize(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";

        var sanitized = SensitiveJsonStringRegex.Replace(value, match => $"\"{match.Groups[1].Value}\"{match.Groups[2].Value}\"{Redacted}\"");
        sanitized = BearerTokenRegex.Replace(sanitized, match => $"{match.Groups[1].Value}{Redacted}");
        sanitized = SensitiveQueryRegex.Replace(sanitized, match => $"{match.Groups[1].Value}{Redacted}");
        sanitized = SensitiveKeyValueRegex.Replace(sanitized, match => $"{match.Groups[1].Value}{match.Groups[2].Value}{match.Groups[3].Value}{Redacted}{match.Groups[5].Value}");
        sanitized = DataUrlRegex.Replace(sanitized, "data:***;base64,***");
        sanitized = PhoneRegex.Replace(sanitized, match => $"{match.Value[..3]}****{match.Value[^4..]}");
        sanitized = IdCardRegex.Replace(sanitized, match => $"{match.Value[..6]}********{match.Value[^4..]}");
        sanitized = EscapedWindowsUserPathRegex.Replace(sanitized, match => $"{match.Groups[1].Value}{Redacted}");
        sanitized = WindowsUserPathRegex.Replace(sanitized, match => $"{match.Groups[1].Value}{Redacted}");
        sanitized = UnixUserPathRegex.Replace(sanitized, match => $"{match.Groups[1].Value}{Redacted}");
        return sanitized;
    }

    public static ClientLogEvent SanitizeEvent(ClientLogEvent logEvent)
    {
        return new ClientLogEvent
        {
            Id = logEvent.Id,
            Level = Sanitize(logEvent.Level),
            EventType = Sanitize(logEvent.EventType),
            Message = Sanitize(logEvent.Message),
            Stack = Sanitize(logEvent.Stack),
            DeviceId = Sanitize(logEvent.DeviceId),
            DeviceName = Sanitize(logEvent.DeviceName),
            UserId = Sanitize(logEvent.UserId),
            Username = Sanitize(logEvent.Username),
            Role = Sanitize(logEvent.Role),
            AppModule = Sanitize(logEvent.AppModule),
            Route = Sanitize(logEvent.Route),
            Url = Sanitize(logEvent.Url),
            RequestUrl = Sanitize(logEvent.RequestUrl),
            StatusCode = logEvent.StatusCode,
            ClientSessionId = Sanitize(logEvent.ClientSessionId),
            TraceId = Sanitize(logEvent.TraceId),
            AiImportBatchId = Sanitize(logEvent.AiImportBatchId),
            SourceFileHash = Sanitize(logEvent.SourceFileHash),
            AppVersion = Sanitize(logEvent.AppVersion),
            WebViewVersion = Sanitize(logEvent.WebViewVersion),
            CreatedAt = logEvent.CreatedAt,
            MetadataJson = Sanitize(logEvent.MetadataJson)
        };
    }
}
