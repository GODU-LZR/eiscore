namespace EISCore.Collector.Services;

public sealed record CollectorServerAddressState(
    bool IsValid,
    string NormalizedUrl,
    string StatusMessage);

public static class CollectorServerAddressPolicy
{
    public static CollectorServerAddressState Evaluate(string? serverBaseUrl, bool requireNonEmpty)
    {
        var input = (serverBaseUrl ?? "").Trim();
        if (string.IsNullOrWhiteSpace(input))
        {
            return requireNonEmpty
                ? new CollectorServerAddressState(false, "", "请先配置服务器地址。")
                : new CollectorServerAddressState(true, "", "");
        }

        var withScheme = EnsureScheme(input);
        if (!Uri.TryCreate(withScheme, UriKind.Absolute, out var uri)
            || string.IsNullOrWhiteSpace(uri.Host)
            || uri.Scheme is not ("http" or "https"))
        {
            return new CollectorServerAddressState(
                false,
                input,
                "服务器地址必须是 http/https 地址，例如 https://nanpai.eissys.top。");
        }

        return new CollectorServerAddressState(
            true,
            BuildNormalizedBaseUrl(uri),
            "");
    }

    public static string NormalizeForStorage(string? serverBaseUrl)
    {
        var state = Evaluate(serverBaseUrl, requireNonEmpty: false);
        return state.IsValid ? state.NormalizedUrl : (serverBaseUrl ?? "").Trim();
    }

    public static string RequireValid(string? serverBaseUrl)
    {
        var state = Evaluate(serverBaseUrl, requireNonEmpty: true);
        if (!state.IsValid)
        {
            throw new InvalidOperationException(state.StatusMessage);
        }

        return state.NormalizedUrl;
    }

    private static string EnsureScheme(string value)
    {
        if (value.Contains("://", StringComparison.Ordinal))
        {
            var schemeSeparatorIndex = value.IndexOf("://", StringComparison.Ordinal);
            var schemePrefix = value[..(schemeSeparatorIndex + 3)];
            var addressPart = value[(schemeSeparatorIndex + 3)..];
            return schemePrefix + BracketIpv6LoopbackIfNeeded(addressPart);
        }

        return IsLocalAddress(value) ? "http://" + BracketIpv6LoopbackIfNeeded(value) : "https://" + value;
    }

    private static bool IsLocalAddress(string value)
    {
        return value.StartsWith("localhost", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("127.", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("[::1]", StringComparison.OrdinalIgnoreCase)
            || value.Equals("::1", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("::1:", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("::1/", StringComparison.OrdinalIgnoreCase);
    }

    private static string BracketIpv6LoopbackIfNeeded(string value)
    {
        if (value.StartsWith("[::1]", StringComparison.OrdinalIgnoreCase)
            || !IsUnbracketedIpv6Loopback(value))
        {
            return value;
        }

        var remainder = value["::1".Length..];
        if (string.IsNullOrWhiteSpace(remainder))
        {
            return "[::1]";
        }

        if (remainder.StartsWith("/", StringComparison.Ordinal))
        {
            return "[::1]" + remainder;
        }

        if (!remainder.StartsWith(":", StringComparison.Ordinal))
        {
            return value;
        }

        var portAndPath = remainder[1..];
        var slashIndex = portAndPath.IndexOf('/');
        var port = slashIndex >= 0 ? portAndPath[..slashIndex] : portAndPath;
        if (port.Length == 0 || !port.All(char.IsDigit))
        {
            return value;
        }

        return "[::1]" + remainder;
    }

    private static bool IsUnbracketedIpv6Loopback(string value)
    {
        return value.Equals("::1", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("::1:", StringComparison.OrdinalIgnoreCase)
            || value.StartsWith("::1/", StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildNormalizedBaseUrl(Uri uri)
    {
        var segments = uri.AbsolutePath
            .Split('/', StringSplitOptions.RemoveEmptyEntries)
            .ToList();
        var agentIndex = segments.FindIndex(segment =>
            string.Equals(Uri.UnescapeDataString(segment), "agent", StringComparison.OrdinalIgnoreCase));
        if (agentIndex >= 0)
        {
            segments = segments.Take(agentIndex).ToList();
        }

        if (segments.Count == 0)
        {
            return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        }

        return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/')
            + "/"
            + string.Join("/", segments).TrimEnd('/');
    }
}
