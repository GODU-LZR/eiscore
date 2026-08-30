using System.Net;

namespace EISCore.Collector.Services;

public sealed class DeviceAuthorizationException : HttpRequestException
{
    public DeviceAuthorizationException(HttpStatusCode statusCode, string reasonPhrase, string responseBody)
        : base($"设备授权已失效：{(int)statusCode} {reasonPhrase} {responseBody}".Trim())
    {
        ResponseStatusCode = statusCode;
        ResponseBody = responseBody;
    }

    public HttpStatusCode ResponseStatusCode { get; }
    public string ResponseBody { get; }
}
