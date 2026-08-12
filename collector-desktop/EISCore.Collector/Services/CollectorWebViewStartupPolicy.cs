using System.Runtime.InteropServices;

namespace EISCore.Collector.Services;

public sealed class CollectorWebViewStartupResult
{
    public bool IsAvailable { get; init; }
    public Exception? Exception { get; init; }
    public string FailureKind { get; init; } = "";
    public string DiagnosticMessage { get; init; } = "";

    public string StatusMessage => IsAvailable
        ? "采集端已启动。"
        : $"采集端已启动，{ResolveDiagnosticMessage()}本地文件采集、上传队列和日志后台循环继续运行。";

    private string ResolveDiagnosticMessage()
    {
        return string.IsNullOrWhiteSpace(DiagnosticMessage)
            ? "WebView 初始化失败，"
            : DiagnosticMessage.Trim().TrimEnd('。') + "，";
    }
}

public static class CollectorWebViewStartupPolicy
{
    private const int AccessDeniedHResult = unchecked((int)0x80070005);
    private const int FileNotFoundHResult = unchecked((int)0x80070002);
    private const int ClassNotRegisteredHResult = unchecked((int)0x80040154);

    public static async Task<CollectorWebViewStartupResult> TryInitializeAsync(Func<Task> initializeAsync)
    {
        try
        {
            await initializeAsync();
            return new CollectorWebViewStartupResult { IsAvailable = true };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var failure = DescribeFailure(ex);
            return new CollectorWebViewStartupResult
            {
                IsAvailable = false,
                Exception = ex,
                FailureKind = failure.Kind,
                DiagnosticMessage = failure.Message
            };
        }
    }

    private static WebViewStartupFailure DescribeFailure(Exception exception)
    {
        var typeName = exception.GetType().Name;
        var message = exception.Message ?? "";
        var hresult = exception.HResult;
        var combinedText = $"{typeName} {message}";

        if (ContainsAny(combinedText, "RuntimeNotFound", "runtime not found")
            || hresult is FileNotFoundHResult or ClassNotRegisteredHResult)
        {
            return new WebViewStartupFailure(
                "runtime_missing",
                "未检测到 WebView2 Runtime，请安装或修复 Microsoft Edge WebView2 Runtime");
        }

        if (exception is UnauthorizedAccessException
            || hresult == AccessDeniedHResult
            || ContainsAny(combinedText, "E_ACCESSDENIED", "Access is denied", "拒绝访问"))
        {
            var userDataDirectory = AppPaths.WebViewUserDataDirectory;
            return new WebViewStartupFailure(
                "user_data_access_denied",
                $"WebView 用户数据目录不可写，请检查 {userDataDirectory} 权限或安全软件拦截");
        }

        if (exception is IOException)
        {
            return new WebViewStartupFailure(
                "user_data_io_error",
                "WebView 用户数据目录读写异常，请检查磁盘空间、目录占用或文件系统权限");
        }

        if (exception is COMException)
        {
            return new WebViewStartupFailure(
                "webview_com_error",
                "WebView2 Runtime 返回系统组件错误，请尝试修复 Runtime 或重启电脑后再试");
        }

        return new WebViewStartupFailure(
            "unknown",
            "WebView 初始化失败，请检查 WebView2 Runtime、用户数据目录权限和本机安全策略");
    }

    private static bool ContainsAny(string value, params string[] tokens)
    {
        return tokens.Any(token => value.Contains(token, StringComparison.OrdinalIgnoreCase));
    }

    private sealed record WebViewStartupFailure(string Kind, string Message);
}
