using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
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
        var chunkSize = Math.Clamp(config.ChunkSizeBytes <= 0 ? 8 * 1024 * 1024 : config.ChunkSizeBytes, 256 * 1024, 64 * 1024 * 1024);
        if (item.FileSize > chunkSize)
        {
            return await UploadFileInChunksAsync(item, config, deviceToken, chunkSize, cancellationToken);
        }

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

        var metadata = BuildUploadMetadata(item, config);

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

    private async Task<UploadResponse> UploadFileInChunksAsync(
        UploadQueueItem item,
        AppConfig config,
        string deviceToken,
        int chunkSize,
        CancellationToken cancellationToken)
    {
        var totalChunks = checked((int)Math.Ceiling(item.FileSize / (double)chunkSize));
        var metadata = BuildUploadMetadata(item, config);

        using var initRequest = new HttpRequestMessage(
            HttpMethod.Post,
            BuildUrl(config.ServerBaseUrl, "/agent/document-intake/assets/chunks/init"))
        {
            Content = JsonContent.Create(new
            {
                original_filename = item.OriginalFilename,
                file_hash = item.FileHash,
                file_size = item.FileSize,
                mime_type = item.MimeType,
                upload_source = item.UploadSource,
                chunk_size = chunkSize,
                total_chunks = totalChunks,
                client_queue_id = item.Id,
                metadata
            }, options: JsonOptions)
        };
        AddDeviceHeaders(initRequest, deviceToken);

        using var initResponse = await _httpClient.SendAsync(initRequest, cancellationToken);
        await EnsureSuccessAsync(initResponse, cancellationToken);
        var init = await initResponse.Content.ReadFromJsonAsync<ChunkUploadInitResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("分片上传初始化接口未返回有效响应。");

        if (init.Duplicate)
        {
            return new UploadResponse
            {
                AssetId = init.AssetId,
                Duplicate = true,
                Status = "duplicate",
                Message = "Duplicate file recorded without re-importing"
            };
        }
        if (string.IsNullOrWhiteSpace(init.SessionId))
        {
            throw new InvalidOperationException("分片上传初始化未返回 sessionId。");
        }

        var uploaded = init.UploadedChunks.ToHashSet();
        var buffer = new byte[chunkSize];
        await using var stream = new FileStream(
            item.FilePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 1024 * 128,
            useAsync: true);

        for (var index = 0; index < totalChunks; index++)
        {
            if (uploaded.Contains(index)) continue;

            stream.Seek((long)index * chunkSize, SeekOrigin.Begin);
            var expected = (int)Math.Min(chunkSize, item.FileSize - (long)index * chunkSize);
            var read = 0;
            while (read < expected)
            {
                var n = await stream.ReadAsync(buffer.AsMemory(read, expected - read), cancellationToken);
                if (n == 0) break;
                read += n;
            }
            if (read != expected)
            {
                throw new EndOfStreamException($"读取分片失败：{index}");
            }

            var chunkBytes = buffer.AsSpan(0, read).ToArray();
            var chunkHash = Convert.ToHexString(SHA256.HashData(chunkBytes)).ToLowerInvariant();
            using var content = new MultipartFormDataContent();
            using var chunkContent = new ByteArrayContent(chunkBytes);
            chunkContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            content.Add(chunkContent, "chunk", $"{item.OriginalFilename}.part{index}");
            content.Add(
                new StringContent(JsonSerializer.Serialize(new
                {
                    session_id = init.SessionId,
                    chunk_index = index,
                    chunk_hash = chunkHash
                }, JsonOptions), Encoding.UTF8, "application/json"),
                "metadata");

            using var chunkRequest = new HttpRequestMessage(
                HttpMethod.Post,
                BuildUrl(config.ServerBaseUrl, "/agent/document-intake/assets/chunks/upload"))
            {
                Content = content
            };
            AddDeviceHeaders(chunkRequest, deviceToken);
            using var chunkResponse = await _httpClient.SendAsync(chunkRequest, cancellationToken);
            await EnsureSuccessAsync(chunkResponse, cancellationToken);
            _ = await chunkResponse.Content.ReadFromJsonAsync<ChunkUploadPartResponse>(JsonOptions, cancellationToken);
        }

        using var completeRequest = new HttpRequestMessage(
            HttpMethod.Post,
            BuildUrl(config.ServerBaseUrl, "/agent/document-intake/assets/chunks/complete"))
        {
            Content = JsonContent.Create(new { session_id = init.SessionId }, options: JsonOptions)
        };
        AddDeviceHeaders(completeRequest, deviceToken);
        using var completeResponse = await _httpClient.SendAsync(completeRequest, cancellationToken);
        await EnsureSuccessAsync(completeResponse, cancellationToken);
        return await completeResponse.Content.ReadFromJsonAsync<UploadResponse>(JsonOptions, cancellationToken)
            ?? new UploadResponse { Status = "uploaded" };
    }

    private static object BuildUploadMetadata(UploadQueueItem item, AppConfig config)
    {
        return new
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

    public async Task<DeviceConfigResponse?> GetDeviceConfigAsync(
        AppConfig config,
        string deviceToken,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(config.ServerBaseUrl) || string.IsNullOrWhiteSpace(deviceToken))
        {
            return null;
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            BuildUrl(config.ServerBaseUrl, "/agent/document-intake/devices/config"));
        AddDeviceHeaders(request, deviceToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<DeviceConfigResponse>(JsonOptions, cancellationToken);
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
