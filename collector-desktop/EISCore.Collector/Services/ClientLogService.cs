using System.Text.RegularExpressions;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class ClientLogService
{
    private const int MaxSanitizedTextLength = 8192;

    private static readonly Regex SensitiveJsonValueRegex = new(
        "(?<prefix>[\"']?(?:authorization|authorization_code|authorizationCode|auth_code|authCode|bind_code|bindCode|binding_code|bindingCode|device_bind_code|deviceBindCode|cookie|set-cookie|setCookie|token|authToken|sessionToken|jwt|password|passwd|secret|client_secret|clientSecret|csrf_token|csrfToken|x-csrf-token|xCsrfToken|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|api_key|apiKey|apikey|x-api-key|xApiKey|device_token|deviceToken)[\"']?\\s*:\\s*[\"'])(?<value>[^\"']*)(?<suffix>[\"'])",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveAssignmentRegex = new(
        "(?<prefix>\\b(?:authorization|authorization_code|authorizationCode|auth_code|authCode|bind_code|bindCode|binding_code|bindingCode|device_bind_code|deviceBindCode|cookie|set-cookie|setCookie|token|authToken|sessionToken|jwt|password|passwd|secret|client_secret|clientSecret|csrf_token|csrfToken|x-csrf-token|xCsrfToken|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|api_key|apiKey|apikey|x-api-key|xApiKey|device_token|deviceToken)\\b\\s*[:=]\\s*)(?<value>[^&\\s,;}\\]]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveQueryRegex = new(
        "(?<prefix>[?&](?:authorization|authorization_code|authorizationCode|auth|auth_code|authCode|bind_code|bindCode|binding_code|bindingCode|device_bind_code|deviceBindCode|token|authToken|sessionToken|jwt|password|passwd|secret|client_secret|clientSecret|csrf_token|csrfToken|x-csrf-token|xCsrfToken|access_token|accessToken|refresh_token|refreshToken|id_token|idToken|api_key|apiKey|apikey|device_token|deviceToken)=)(?<value>[^&#\\s]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveHeaderLineRegex = new(
        "(?<prefix>\\b(?:authorization|cookie|set-cookie)\\s*:\\s*)(?<value>[^\\r\\n]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex BearerTokenRegex = new(
        "\\b(Bearer|Basic)\\s+[A-Za-z0-9._~+/=-]+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex JwtTokenRegex = new(
        "\\b[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}\\b",
        RegexOptions.Compiled);

    private static readonly Regex UrlUserInfoRegex = new(
        "(?<scheme>https?://)(?<userinfo>[^/@\\s:]+:[^/@\\s]+)@",
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
        else if (!string.IsNullOrWhiteSpace(config.WebViewVersion))
        {
            _webViewVersion = config.WebViewVersion;
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
        string appModule = "",
        string traceId = "",
        string aiImportBatchId = "",
        string sourceFileHash = "",
        string userId = "",
        string username = "",
        string role = "",
        CancellationToken cancellationToken = default)
    {
        if (!_config.LogCollectionEnabled)
        {
            return;
        }

        var logEvent = new ClientLogEvent
        {
            Level = Sanitize(level),
            EventType = Sanitize(eventType),
            Message = Sanitize(message),
            Stack = Sanitize(stack),
            DeviceId = _config.DeviceId,
            DeviceName = _config.DeviceName,
            UserId = Sanitize(FirstNonEmpty(userId, _config.DefaultUserId)),
            Username = Sanitize(FirstNonEmpty(username, _config.DefaultUsername)),
            Role = Sanitize(FirstNonEmpty(role, _config.DefaultRole)),
            AppModule = Sanitize(appModule),
            Route = Sanitize(route),
            Url = Sanitize(url),
            RequestUrl = Sanitize(requestUrl),
            StatusCode = statusCode,
            ClientSessionId = _sessionId,
            TraceId = Sanitize(traceId),
            AiImportBatchId = Sanitize(aiImportBatchId),
            SourceFileHash = Sanitize(sourceFileHash),
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

        var sanitized = SensitiveJsonValueRegex.Replace(value, match => $"{match.Groups["prefix"].Value}***{match.Groups["suffix"].Value}");
        sanitized = SensitiveQueryRegex.Replace(sanitized, match => $"{match.Groups["prefix"].Value}***");
        sanitized = SensitiveHeaderLineRegex.Replace(sanitized, match => $"{match.Groups["prefix"].Value}***");
        sanitized = BearerTokenRegex.Replace(sanitized, match => $"{match.Groups[1].Value} ***");
        sanitized = SensitiveAssignmentRegex.Replace(sanitized, match => $"{match.Groups["prefix"].Value}***");
        sanitized = JwtTokenRegex.Replace(sanitized, "***");
        sanitized = UrlUserInfoRegex.Replace(sanitized, match => $"{match.Groups["scheme"].Value}***@");
        sanitized = PhoneRegex.Replace(sanitized, match => $"{match.Value[..3]}****{match.Value[^4..]}");
        sanitized = IdCardRegex.Replace(sanitized, match => $"{match.Value[..6]}********{match.Value[^4..]}");
        return sanitized.Length <= MaxSanitizedTextLength
            ? sanitized
            : sanitized[..MaxSanitizedTextLength] + "...[truncated]";
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return "";
    }
}
