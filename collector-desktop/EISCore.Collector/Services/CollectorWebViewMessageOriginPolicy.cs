namespace EISCore.Collector.Services;

public sealed class CollectorWebViewMessageOriginResult
{
    public bool CanAccept { get; init; }
    public string Reason { get; init; } = "";
    public string TrustedOrigin { get; init; } = "";
    public string MessageOrigin { get; init; } = "";
}

public static class CollectorWebViewMessageOriginPolicy
{
    public static CollectorWebViewMessageOriginResult Evaluate(
        string serverBaseUrl,
        string sourceUrl,
        string payloadUrl = "")
    {
        if (!TryCreateHttpUri(serverBaseUrl, out var trustedUri))
        {
            return Reject("invalid_server_base_url", "", sourceUrl);
        }

        var trustedOrigin = FormatOrigin(trustedUri);
        if (!TryCreateHttpUri(sourceUrl, out var messageUri)
            && !TryCreateHttpUri(payloadUrl, out messageUri))
        {
            return Reject("missing_message_origin", trustedOrigin, FirstNonEmpty(sourceUrl, payloadUrl));
        }

        var messageOrigin = FormatOrigin(messageUri);
        return IsSameOrigin(trustedUri, messageUri)
            ? new CollectorWebViewMessageOriginResult
            {
                CanAccept = true,
                Reason = "same_origin",
                TrustedOrigin = trustedOrigin,
                MessageOrigin = messageOrigin
            }
            : Reject("origin_mismatch", trustedOrigin, messageOrigin);
    }

    private static bool TryCreateHttpUri(string value, out Uri uri)
    {
        uri = null!;
        if (!Uri.TryCreate((value ?? "").Trim(), UriKind.Absolute, out var parsed))
        {
            return false;
        }

        if (!string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(parsed.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(parsed.Host))
        {
            return false;
        }

        uri = parsed;
        return true;
    }

    private static bool IsSameOrigin(Uri trustedUri, Uri messageUri)
    {
        return string.Equals(trustedUri.Scheme, messageUri.Scheme, StringComparison.OrdinalIgnoreCase)
            && string.Equals(trustedUri.IdnHost, messageUri.IdnHost, StringComparison.OrdinalIgnoreCase)
            && trustedUri.Port == messageUri.Port;
    }

    private static string FormatOrigin(Uri uri)
    {
        var defaultPort = (string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) && uri.Port == 443)
            || (string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) && uri.Port == 80);
        return defaultPort
            ? $"{uri.Scheme}://{uri.IdnHost}"
            : $"{uri.Scheme}://{uri.IdnHost}:{uri.Port}";
    }

    private static CollectorWebViewMessageOriginResult Reject(string reason, string trustedOrigin, string messageOrigin)
    {
        return new CollectorWebViewMessageOriginResult
        {
            CanAccept = false,
            Reason = reason,
            TrustedOrigin = trustedOrigin,
            MessageOrigin = messageOrigin
        };
    }

    private static string FirstNonEmpty(params string[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return "";
    }
}
