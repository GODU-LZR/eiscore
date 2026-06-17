using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class CollectorApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromMinutes(5)
    };

    public async Task<DeviceBindResponse> BindDeviceAsync(
        string serverBaseUrl,
        DeviceBindRequest request,
        CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.PostAsJsonAsync(
            BuildUrl(serverBaseUrl, "/agent/document-intake/devices/bind"),
            request,
            JsonOptions,
            cancellationToken);

        await EnsureSuccessAsync(response, cancellationToken);
        var bindResponse = await response.Content.ReadFromJsonAsync<DeviceBindResponse>(JsonOptions, cancellationToken);
        return bindResponse ?? throw new InvalidOperationException("设备绑定接口未返回有效响应。");
    }

    public async Task<UploadResponse> UploadFileAsync(
        UploadQueueItem item,
        AppConfig config,
        string deviceToken,
        CancellationToken cancellationToken = default)
    {
        await using var stream = new FileStream(
            item.FilePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 1024 * 128,
            useAsync: true);

        using var content = new MultipartFormDataContent();
        using var fileContent = new StreamContent(stream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(item.MimeType);
        content.Add(fileContent, "file", item.OriginalFilename);

        var metadata = new
        {
            device_id = config.DeviceId,
            device_name = config.DeviceName,
            upload_source = item.UploadSource,
            uploaded_by_user_id = config.DefaultUserId,
            uploaded_by_username = config.DefaultUsername,
            uploaded_by_role = config.DefaultRole,
            windows_username = Environment.UserDomainName + "\\" + Environment.UserName,
            operator_source = item.UploadSource == "web_drag_drop" ? "web_login_user" : "device_default_user",
            file_hash = item.FileHash,
            original_filename = item.OriginalFilename,
            file_size = item.FileSize,
            mime_type = item.MimeType,
            client_queue_id = item.Id
        };

        content.Add(
            new StringContent(JsonSerializer.Serialize(metadata, JsonOptions), Encoding.UTF8, "application/json"),
            "metadata");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            BuildUrl(config.ServerBaseUrl, "/agent/document-intake/assets/upload"))
        {
            Content = content
        };
        AddDeviceHeaders(request, deviceToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var uploadResponse = await response.Content.ReadFromJsonAsync<UploadResponse>(JsonOptions, cancellationToken);
        return uploadResponse ?? new UploadResponse { Status = "uploaded" };
    }

    public async Task SendHeartbeatAsync(
        AppConfig config,
        string deviceToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(config.ServerBaseUrl) || string.IsNullOrWhiteSpace(deviceToken))
        {
            return;
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            BuildUrl(config.ServerBaseUrl, "/agent/document-intake/devices/heartbeat"))
        {
            Content = JsonContent.Create(new
            {
                device_id = config.DeviceId,
                device_code = config.DeviceCode,
                device_name = config.DeviceName,
                client_version = config.ClientVersion,
                windows_username = Environment.UserDomainName + "\\" + Environment.UserName,
                last_seen_at = DateTimeOffset.Now
            }, options: JsonOptions)
        };
        AddDeviceHeaders(request, deviceToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    public async Task UploadLogsAsync(
        AppConfig config,
        string deviceToken,
        IReadOnlyList<ClientLogEvent> events,
        CancellationToken cancellationToken = default)
    {
        if (events.Count == 0 || string.IsNullOrWhiteSpace(config.ServerBaseUrl) || string.IsNullOrWhiteSpace(deviceToken))
        {
            return;
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            BuildUrl(config.ServerBaseUrl, "/agent/document-intake/client-logs/batch"))
        {
            Content = JsonContent.Create(new
            {
                device_id = config.DeviceId,
                device_name = config.DeviceName,
                events
            }, options: JsonOptions)
        };
        AddDeviceHeaders(request, deviceToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    private static void AddDeviceHeaders(HttpRequestMessage request, string deviceToken)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceToken);
        request.Headers.TryAddWithoutValidation("X-EISCore-Collector", "windows-desktop");
    }

    private static string BuildUrl(string serverBaseUrl, string path)
    {
        if (string.IsNullOrWhiteSpace(serverBaseUrl))
        {
            throw new InvalidOperationException("请先配置服务器地址。");
        }

        var normalizedBase = serverBaseUrl.Trim().TrimEnd('/');
        return normalizedBase + path;
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode) return;

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new HttpRequestException($"接口请求失败：{(int)response.StatusCode} {response.ReasonPhrase} {body}");
    }
}
