using System.Net;
using System.Text.Json;

namespace EISCore.Collector.Services;

public sealed record CollectorBindFailureAdvice(
    string UserMessage,
    string FailureKind,
    int? StatusCode = null);

public static class CollectorBindFailurePolicy
{
    public static CollectorBindFailureAdvice Describe(Exception exception)
    {
        return exception switch
        {
            CollectorDeviceBindException bindException => DescribeBindException(bindException),
            TaskCanceledException => new CollectorBindFailureAdvice(
                "设备绑定失败：请求超时，请检查网络连接后重试。",
                "bind_timeout"),
            HttpRequestException httpException => DescribeHttpException(httpException),
            InvalidOperationException invalidOperationException when IsMalformedBindResponse(invalidOperationException) =>
                new CollectorBindFailureAdvice(
                    "设备绑定失败：后台绑定响应不完整，请联系管理员检查设备绑定接口。",
                    "bind_response_invalid"),
            JsonException => new CollectorBindFailureAdvice(
                "设备绑定失败：后台绑定响应格式异常，请联系管理员检查设备绑定接口。",
                "bind_response_invalid"),
            _ => new CollectorBindFailureAdvice(
                $"设备绑定失败：{exception.Message}",
                "bind_unknown")
        };
    }

    private static CollectorBindFailureAdvice DescribeBindException(CollectorDeviceBindException exception)
    {
        var statusCode = (int)exception.StatusCode;
        var serverCode = TryReadServerCode(exception.ResponseBody);
        if (string.Equals(serverCode, "BIND_CODE_INVALID", StringComparison.OrdinalIgnoreCase)
            || exception.ResponseBody.Contains("BIND_CODE_INVALID", StringComparison.OrdinalIgnoreCase))
        {
            return new CollectorBindFailureAdvice(
                "设备绑定失败：授权码无效或已过期，请在后台重置绑定码后重新输入。",
                "bind_code_invalid",
                statusCode);
        }

        return exception.StatusCode switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => new CollectorBindFailureAdvice(
                "设备绑定失败：后台拒绝绑定，请检查企业编号、设备编号和授权码。",
                "bind_rejected",
                statusCode),
            _ => new CollectorBindFailureAdvice(
                $"设备绑定失败：后台返回 HTTP {statusCode}，请稍后重试或联系管理员。",
                "bind_http_error",
                statusCode)
        };
    }

    private static CollectorBindFailureAdvice DescribeHttpException(HttpRequestException exception)
    {
        var statusCode = exception.StatusCode.HasValue ? (int)exception.StatusCode.Value : (int?)null;
        if (exception.StatusCode is null)
        {
            return new CollectorBindFailureAdvice(
                "设备绑定失败：无法连接服务器，请检查服务器地址和网络。",
                "bind_network");
        }

        if ((int)exception.StatusCode.Value >= 500)
        {
            return new CollectorBindFailureAdvice(
                "设备绑定失败：绑定服务暂时不可用，请稍后重试或联系管理员。",
                "bind_service_error",
                statusCode);
        }

        return new CollectorBindFailureAdvice(
            $"设备绑定失败：后台返回 HTTP {statusCode}，请检查配置后重试。",
            "bind_http_error",
            statusCode);
    }

    private static bool IsMalformedBindResponse(InvalidOperationException exception)
    {
        return exception.Message.Contains("设备绑定接口未返回有效响应", StringComparison.Ordinal)
            || exception.Message.Contains("设备绑定接口响应缺少必需字段", StringComparison.Ordinal);
    }

    private static string TryReadServerCode(string responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody)) return "";

        try
        {
            using var document = JsonDocument.Parse(responseBody);
            return document.RootElement.TryGetProperty("code", out var codeElement)
                && codeElement.ValueKind == JsonValueKind.String
                ? codeElement.GetString() ?? ""
                : "";
        }
        catch
        {
            return "";
        }
    }
}
