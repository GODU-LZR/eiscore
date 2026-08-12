namespace EISCore.Collector.Services;

public static class WebViewLogPolicy
{
    private const string LoginContextProbeMarker = "__eiscore_collector_probe=login-context";

    public static bool ShouldLogHttpStatus(int statusCode)
    {
        return statusCode >= 400;
    }

    public static bool ShouldIgnoreRequestUrl(string requestUrl)
    {
        return (requestUrl ?? "").Contains(LoginContextProbeMarker, StringComparison.OrdinalIgnoreCase);
    }

    public static string ResolveHttpLevel(int statusCode)
    {
        return statusCode >= 500 ? "error" : "warn";
    }
}
