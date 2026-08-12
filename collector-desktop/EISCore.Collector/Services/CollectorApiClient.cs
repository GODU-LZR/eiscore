using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public sealed class CollectorApiClient
{
    private const int MaxUploadResponseIdLength = 256;
    private const int MaxUploadResponseMessageLength = 1024;

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

        await EnsureSuccessAsync(response, cancellationToken, classifyDeviceAuthFailure: false);
        var bindResponse = await response.Content.ReadFromJsonAsync<DeviceBindResponse>(JsonOptions, cancellationToken);
        if (bindResponse is null)
        {
            throw new InvalidOperationException("设备绑定接口未返回有效响应。");
        }

        ValidateBindResponse(bindResponse);
        return bindResponse;
    }

    private static void ValidateBindResponse(DeviceBindResponse response)
    {
        var missingFields = new List<string>();
        if (string.IsNullOrWhiteSpace(response.DeviceId)) missingFields.Add("deviceId");
        if (string.IsNullOrWhiteSpace(response.DeviceToken)) missingFields.Add("deviceToken");

        if (missingFields.Count > 0)
        {
            throw new InvalidOperationException($"设备绑定接口响应缺少必需字段：{string.Join(", ", missingFields)}。");
        }
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
        await EnsureSuccessAsync(response, cancellationToken, classifyDeviceAuthFailure: true);

        var uploadResponse = await response.Content.ReadFromJsonAsync<UploadResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("文件上传接口未返回有效响应。");
        EnsureUploadResponseAccepted(uploadResponse, "文件上传");
        return uploadResponse;
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
        await EnsureSuccessAsync(initResponse, cancellationToken, classifyDeviceAuthFailure: true);
        var init = await initResponse.Content.ReadFromJsonAsync<ChunkUploadInitResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("分片上传初始化接口未返回有效响应。");

        if (init.Duplicate)
        {
        var duplicateResponse = new UploadResponse
        {
            AssetId = init.AssetId,
            BatchId = init.BatchId,
            BatchNo = init.BatchNo,
            Duplicate = true,
            Status = "duplicate",
            Message = "Duplicate file recorded without re-importing"
            };
            EnsureUploadResponseAccepted(duplicateResponse, "分片上传初始化");
            return duplicateResponse;
        }
        if (string.IsNullOrWhiteSpace(init.SessionId))
        {
            throw new InvalidOperationException("分片上传初始化未返回 sessionId。");
        }

        var acceptedChunkSize = init.ChunkSize <= 0 ? chunkSize : init.ChunkSize;
        var acceptedTotalChunks = init.TotalChunks <= 0 ? totalChunks : init.TotalChunks;
        if (acceptedChunkSize != chunkSize || acceptedTotalChunks != totalChunks)
        {
            throw new InvalidOperationException("分片上传初始化响应与本地分片计划不一致。");
        }

        var uploaded = NormalizeChunkIndexes(init.UploadedChunks, totalChunks);
        var reportedMissing = NormalizeChunkIndexes(init.MissingChunks, totalChunks);
        var chunksToUpload = reportedMissing.Count > 0
            ? reportedMissing
            : Enumerable.Range(0, totalChunks)
                .Where(index => !uploaded.Contains(index))
                .ToHashSet();
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
            if (!chunksToUpload.Contains(index)) continue;

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
            await EnsureSuccessAsync(chunkResponse, cancellationToken, classifyDeviceAuthFailure: true);
            var part = await chunkResponse.Content.ReadFromJsonAsync<ChunkUploadPartResponse>(JsonOptions, cancellationToken)
                ?? throw new InvalidOperationException($"分片上传接口未返回有效确认：{index}");
            EnsureChunkUploadPartAccepted(part, init.SessionId, index, totalChunks);
        }

        using var completeRequest = new HttpRequestMessage(
            HttpMethod.Post,
            BuildUrl(config.ServerBaseUrl, "/agent/document-intake/assets/chunks/complete"))
        {
            Content = JsonContent.Create(new { session_id = init.SessionId }, options: JsonOptions)
        };
        AddDeviceHeaders(completeRequest, deviceToken);
        using var completeResponse = await _httpClient.SendAsync(completeRequest, cancellationToken);
        await EnsureSuccessAsync(completeResponse, cancellationToken, classifyDeviceAuthFailure: true);
        var uploadResponse = await completeResponse.Content.ReadFromJsonAsync<UploadResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("分片上传完成接口未返回有效响应。");
        EnsureUploadResponseAccepted(uploadResponse, "分片上传完成");
        return uploadResponse;
    }

    private static HashSet<int> NormalizeChunkIndexes(IEnumerable<int>? indexes, int totalChunks)
    {
        return (indexes ?? Enumerable.Empty<int>())
            .Where(index => index >= 0 && index < totalChunks)
            .ToHashSet();
    }

    private static void EnsureChunkUploadPartAccepted(
        ChunkUploadPartResponse part,
        string sessionId,
        int chunkIndex,
        int totalChunks)
    {
        if (!part.Ok)
        {
            throw new InvalidOperationException($"分片上传未被服务端确认：{chunkIndex}");
        }

        if (!string.Equals(part.SessionId, sessionId, StringComparison.Ordinal)
            || part.ChunkIndex != chunkIndex
            || part.TotalChunks != totalChunks)
        {
            throw new InvalidOperationException($"分片上传确认与本地请求不一致：{chunkIndex}");
        }
    }

    private static void EnsureUploadResponseAccepted(UploadResponse response, string actionName)
    {
        var status = NormalizeUploadResponseText(response.Status, 32).ToLowerInvariant();
        if (status is not ("uploaded" or "duplicate"))
        {
            throw new InvalidOperationException($"{actionName}接口返回了无法识别的状态：{response.Status}");
        }

        var assetId = NormalizeUploadResponseText(response.AssetId, MaxUploadResponseIdLength);
        if (string.IsNullOrWhiteSpace(assetId))
        {
            throw new InvalidOperationException($"{actionName}接口响应缺少 assetId。");
        }

        if (StripControlCharacters(response.AssetId).Trim().Length > MaxUploadResponseIdLength)
        {
            throw new InvalidOperationException($"{actionName}接口响应 assetId 超过长度限制。");
        }

        var batchId = NormalizeUploadResponseText(response.BatchId, MaxUploadResponseIdLength);
        if (StripControlCharacters(response.BatchId).Trim().Length > MaxUploadResponseIdLength)
        {
            throw new InvalidOperationException($"{actionName}接口响应 batchId 超过长度限制。");
        }

        var batchNo = NormalizeUploadResponseText(response.BatchNo, MaxUploadResponseIdLength);
        if (StripControlCharacters(response.BatchNo).Trim().Length > MaxUploadResponseIdLength)
        {
            throw new InvalidOperationException($"{actionName}接口响应 batchNo 超过长度限制。");
        }

        response.Status = status;
        response.AssetId = assetId;
        response.BatchId = batchId;
        response.BatchNo = batchNo;
        response.Message = NormalizeUploadResponseText(response.Message, MaxUploadResponseMessageLength);
        response.Duplicate = status == "duplicate";
    }

    private static void EnsureDeviceConfigResponseAccepted(DeviceConfigResponse response, string actionName)
    {
        if (!response.Ok)
        {
            throw new InvalidOperationException($"{actionName}接口未被服务端确认。");
        }
    }

    private static string NormalizeUploadResponseText(string? value, int maxLength)
    {
        var normalized = StripControlCharacters(value).Trim();
        return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    private static string StripControlCharacters(string? value)
    {
        return new string((value ?? "").Where(ch => !char.IsControl(ch)).ToArray());
    }

    private static object BuildUploadMetadata(UploadQueueItem item, AppConfig config)
    {
        var uploadedByUserId = FirstNonEmpty(item.UploadedByUserId, config.DefaultUserId);
        var uploadedByUsername = FirstNonEmpty(item.UploadedByUsername, config.DefaultUsername);
        var uploadedByRole = FirstNonEmpty(item.UploadedByRole, config.DefaultRole);
        var operatorSource = FirstNonEmpty(
            item.OperatorSource,
            ResolveFallbackOperatorSource(item, config, uploadedByUserId, uploadedByUsername, uploadedByRole));
        var windowsUsername = FirstNonEmpty(item.WindowsUsername, Environment.UserDomainName + "\\" + Environment.UserName);

        return new
        {
            device_id = config.DeviceId,
            device_name = config.DeviceName,
            enterprise_code = config.EnterpriseCode,
            tenant_id = config.EnterpriseCode,
            upload_source = item.UploadSource,
            uploaded_by_user_id = uploadedByUserId,
            uploaded_by_username = uploadedByUsername,
            uploaded_by_role = uploadedByRole,
            source_folder = item.SourceFolder,
            windows_username = windowsUsername,
            operator_source = operatorSource,
            file_hash = item.FileHash,
            original_filename = item.OriginalFilename,
            file_size = item.FileSize,
            mime_type = item.MimeType,
            client_queue_id = item.Id
        };
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return "";
    }

    private static string ResolveFallbackOperatorSource(
        UploadQueueItem item,
        AppConfig config,
        string uploadedByUserId,
        string uploadedByUsername,
        string uploadedByRole)
    {
        if (!HasUploadUserIdentity(uploadedByUserId, uploadedByUsername))
        {
            return "unknown";
        }

        if (string.Equals(item.UploadSource, "manual_selected_file", StringComparison.OrdinalIgnoreCase))
        {
            return "manual_selected_user";
        }

        if (string.Equals(item.UploadSource, "web_drag_drop", StringComparison.OrdinalIgnoreCase)
            && HasDistinctUploadOwner(item, config))
        {
            return "web_login_user";
        }

        return "device_default_user";
    }

    private static bool HasUploadUserIdentity(params string?[] values)
    {
        return values.Any(value => !string.IsNullOrWhiteSpace(value));
    }

    private static bool HasDistinctUploadOwner(UploadQueueItem item, AppConfig config)
    {
        return IsDistinctOwnerValue(item.UploadedByUserId, config.DefaultUserId)
            || IsDistinctOwnerValue(item.UploadedByUsername, config.DefaultUsername)
            || IsDistinctOwnerValue(item.UploadedByRole, config.DefaultRole);
    }

    private static bool IsDistinctOwnerValue(string? value, string? defaultValue)
    {
        var normalized = (value ?? "").Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return false;
        return !string.Equals(normalized, (defaultValue ?? "").Trim(), StringComparison.Ordinal);
    }

    public async Task<DeviceConfigResponse?> SendHeartbeatAsync(
        AppConfig config,
        string deviceToken,
        CollectorHealthSnapshot? health = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(config.ServerBaseUrl) || string.IsNullOrWhiteSpace(deviceToken))
        {
            return null;
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
                webview_version = config.WebViewVersion,
                windows_username = Environment.UserDomainName + "\\" + Environment.UserName,
                last_seen_at = DateTimeOffset.Now,
                health
            }, options: JsonOptions)
        };
        AddDeviceHeaders(request, deviceToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken, classifyDeviceAuthFailure: true);
        var configResponse = await response.Content.ReadFromJsonAsync<DeviceConfigResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("设备心跳接口未返回有效响应。");
        EnsureDeviceConfigResponseAccepted(configResponse, "设备心跳");
        return configResponse;
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
        await EnsureSuccessAsync(response, cancellationToken, classifyDeviceAuthFailure: true);
        var configResponse = await response.Content.ReadFromJsonAsync<DeviceConfigResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("设备远程配置接口未返回有效响应。");
        EnsureDeviceConfigResponseAccepted(configResponse, "设备远程配置");
        return configResponse;
    }

    public async Task<DocumentAssetStatus?> GetAssetStatusAsync(
        AppConfig config,
        string deviceToken,
        string assetId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(config.ServerBaseUrl)
            || string.IsNullOrWhiteSpace(deviceToken)
            || string.IsNullOrWhiteSpace(assetId))
        {
            return null;
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            BuildUrl(config.ServerBaseUrl, $"/agent/document-intake/assets/{Uri.EscapeDataString(assetId.Trim())}/status"));
        AddDeviceHeaders(request, deviceToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken, classifyDeviceAuthFailure: true);
        var statusResponse = await response.Content.ReadFromJsonAsync<DocumentAssetStatusResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("资产状态接口未返回有效响应。");
        if (!statusResponse.Ok)
        {
            throw new InvalidOperationException("资产状态接口未被服务端确认。");
        }

        return NormalizeAssetStatus(statusResponse.Asset);
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
        await EnsureSuccessAsync(response, cancellationToken, classifyDeviceAuthFailure: true);
        var batchResponse = await response.Content.ReadFromJsonAsync<ClientLogBatchResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("客户端日志批量上报接口未返回有效响应。");
        if (!batchResponse.Ok)
        {
            throw new InvalidOperationException("客户端日志批量上报未被服务端确认。");
        }
    }

    private static void AddDeviceHeaders(HttpRequestMessage request, string deviceToken)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceToken);
        request.Headers.TryAddWithoutValidation("X-EISCore-Collector", "windows-desktop");
    }

    private static DocumentAssetStatus NormalizeAssetStatus(DocumentAssetStatus asset)
    {
        asset.AssetId = NormalizeUploadResponseText(asset.AssetId, MaxUploadResponseIdLength);
        asset.BatchId = NormalizeUploadResponseText(asset.BatchId, MaxUploadResponseIdLength);
        asset.BatchNo = NormalizeUploadResponseText(asset.BatchNo, MaxUploadResponseIdLength);
        asset.AssetStatus = NormalizeUploadResponseText(asset.AssetStatus, 80).ToLowerInvariant();
        asset.BatchStatus = NormalizeUploadResponseText(asset.BatchStatus, 80).ToLowerInvariant();
        asset.ParseStatus = NormalizeUploadResponseText(asset.ParseStatus, 80).ToLowerInvariant();
        asset.EntryStatus = NormalizeUploadResponseText(asset.EntryStatus, 80).ToLowerInvariant();
        asset.ActionHref = NormalizeUploadResponseText(asset.ActionHref, 512);
        asset.UpdatedAt = NormalizeUploadResponseText(asset.UpdatedAt, 80);
        asset.Message = NormalizeUploadResponseText(asset.Message, MaxUploadResponseMessageLength);
        asset.BusinessLinkCount = Math.Max(0, asset.BusinessLinkCount);
        asset.UnmappedFieldCount = Math.Max(0, asset.UnmappedFieldCount);
        return asset;
    }

    private static string BuildUrl(string serverBaseUrl, string path)
    {
        var normalizedBase = CollectorServerAddressPolicy.RequireValid(serverBaseUrl);
        return normalizedBase + path;
    }

    private static async Task EnsureSuccessAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken,
        bool classifyDeviceAuthFailure)
    {
        if (response.IsSuccessStatusCode) return;

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            if (classifyDeviceAuthFailure)
            {
                throw new CollectorDeviceAuthException(
                    response.StatusCode,
                    response.ReasonPhrase ?? "",
                    body);
            }

            throw new CollectorDeviceBindException(
                response.StatusCode,
                response.ReasonPhrase ?? "",
                body);
        }

        throw new HttpRequestException($"接口请求失败：{(int)response.StatusCode} {response.ReasonPhrase} {body}");
    }

    private sealed class ClientLogBatchResponse
    {
        public bool Ok { get; set; }
    }
}
