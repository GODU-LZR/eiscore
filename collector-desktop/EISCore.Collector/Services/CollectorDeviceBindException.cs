using System.Net;

namespace EISCore.Collector.Services;

public sealed class CollectorDeviceBindException : HttpRequestException
{
    public CollectorDeviceBindException(
        HttpStatusCode statusCode,
        string reasonPhrase,
        string responseBody)
        : base($"设备绑定失败：{(int)statusCode} {reasonPhrase} {BuildMessage(responseBody)}", null, statusCode)
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }

    public new HttpStatusCode StatusCode { get; }
    public string ResponseBody { get; }

    private static string BuildMessage(string responseBody)
    {
        return responseBody.Contains("BIND_CODE_INVALID", StringComparison.OrdinalIgnoreCase)
            ? "授权码无效或已过期，请在后台重置绑定码后重新输入。"
            : responseBody;
    }
}
