namespace EISCore.Collector.Services;

public sealed record CollectorWebViewNavigationFailure(
    string FailureKind,
    string DiagnosticMessage,
    string StatusMessage);

public static class CollectorWebViewNavigationFailurePolicy
{
    public static CollectorWebViewNavigationFailure Describe(string serverBaseUrl, string webErrorStatus, int httpStatusCode)
    {
        var normalizedStatus = (webErrorStatus ?? "").Trim();
        var server = string.IsNullOrWhiteSpace(serverBaseUrl) ? "当前服务器" : serverBaseUrl.Trim();
        var failure = ResolveFailure(normalizedStatus, httpStatusCode);
        return new CollectorWebViewNavigationFailure(
            failure.Kind,
            failure.Message,
            $"无法打开 {server}：{failure.Message}。本地文件采集、上传队列和日志后台循环会继续运行。");
    }

    private static WebViewNavigationFailure ResolveFailure(string webErrorStatus, int httpStatusCode)
    {
        if (IsOneOf(webErrorStatus, "HostNameNotResolved"))
        {
            return new WebViewNavigationFailure(
                "dns_failed",
                "无法解析服务器域名，请检查网络 DNS、服务器地址或内网域名配置");
        }

        if (IsOneOf(webErrorStatus, "Timeout"))
        {
            return new WebViewNavigationFailure(
                "timeout",
                "连接服务器超时，请检查网络连通性、防火墙或服务器响应时间");
        }

        if (IsOneOf(webErrorStatus, "ServerUnreachable", "CannotConnect", "ConnectionAborted", "ConnectionReset", "Disconnected"))
        {
            return new WebViewNavigationFailure(
                "network_unreachable",
                "无法连接服务器，请检查网络、代理、防火墙或服务器是否在线");
        }

        if (webErrorStatus.StartsWith("Certificate", StringComparison.OrdinalIgnoreCase)
            || IsOneOf(webErrorStatus, "ClientCertificateContainsErrors"))
        {
            return new WebViewNavigationFailure(
                "certificate_error",
                "服务器证书异常，请检查 HTTPS 证书、系统时间或企业根证书配置");
        }

        if (IsOneOf(webErrorStatus, "ValidProxyAuthenticationRequired"))
        {
            return new WebViewNavigationFailure(
                "proxy_auth_required",
                "代理服务器需要认证，请检查 Windows 代理或企业网络认证配置");
        }

        if (IsOneOf(webErrorStatus, "ValidAuthenticationCredentialsRequired"))
        {
            return new WebViewNavigationFailure(
                "server_auth_required",
                "服务器要求额外认证，请确认站点登录或反向代理认证配置");
        }

        if (IsOneOf(webErrorStatus, "ErrorHttpInvalidServerResponse"))
        {
            return new WebViewNavigationFailure(
                "invalid_server_response",
                "服务器响应格式异常，请检查网关、反向代理或服务端健康状态");
        }

        if (httpStatusCode >= 500)
        {
            return new WebViewNavigationFailure(
                "server_error",
                $"服务器返回 HTTP {httpStatusCode}，请检查后端服务或网关状态");
        }

        if (httpStatusCode >= 400)
        {
            return new WebViewNavigationFailure(
                "http_error",
                $"服务器返回 HTTP {httpStatusCode}，请检查访问权限、路径或反向代理配置");
        }

        if (IsOneOf(webErrorStatus, "OperationCanceled"))
        {
            return new WebViewNavigationFailure(
                "navigation_canceled",
                "网页加载被取消，请稍后重试或检查是否频繁切换地址");
        }

        return new WebViewNavigationFailure(
            "unknown",
            string.IsNullOrWhiteSpace(webErrorStatus)
                ? "网页打开失败，请检查服务器地址、网络和 WebView2 Runtime"
                : $"网页打开失败（{webErrorStatus}），请检查服务器地址、网络和 WebView2 Runtime");
    }

    private static bool IsOneOf(string value, params string[] candidates)
    {
        return candidates.Any(candidate => string.Equals(value, candidate, StringComparison.OrdinalIgnoreCase));
    }

    private sealed record WebViewNavigationFailure(string Kind, string Message);
}
