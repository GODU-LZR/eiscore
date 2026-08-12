using System.Net;

namespace EISCore.Collector.Services;

public sealed class CollectorDeviceAuthException : HttpRequestException
{
    public CollectorDeviceAuthException(
        HttpStatusCode statusCode,
        string reasonPhrase,
        string responseBody)
        : base($"采集设备认证失败：{(int)statusCode} {reasonPhrase} {responseBody}", null, statusCode)
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }

    public new HttpStatusCode StatusCode { get; }
    public string ResponseBody { get; }
}
