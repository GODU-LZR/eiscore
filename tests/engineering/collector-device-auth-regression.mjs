// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const localDotnet = '/home/lzr/.dotnet/dotnet'
const dotnet = process.env.DOTNET_ROOT
  ? join(process.env.DOTNET_ROOT, 'dotnet')
  : existsSync(localDotnet)
    ? localDotnet
    : 'dotnet'
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-device-auth-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorDeviceAuthSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Models/UploadOwnerContext.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorAllowedExtensionsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs',
  'collector-desktop/EISCore.Collector/Services/ConfigurationService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorAuthorizationCodePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorBindPreflightPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorBindFailurePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorRemoteUpdatePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateInstallerArgumentsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateUrlPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceRemoteCallPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAccessPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileIgnorePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUploadOwnershipPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorManualUploadPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/DeviceBindingService.cs',
  'collector-desktop/EISCore.Collector/Services/DeviceTokenProtector.cs',
  'collector-desktop/EISCore.Collector/Services/FileHashService.cs',
  'collector-desktop/EISCore.Collector/Services/FileStabilityService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorLogUploadPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/LogUploadProcessor.cs',
  'collector-desktop/EISCore.Collector/Services/MimeTypeService.cs',
  'collector-desktop/EISCore.Collector/Services/UploadConnectivityPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/UploadQueueProcessResult.cs',
  'collector-desktop/EISCore.Collector/Services/UploadQueueProcessor.cs',
  'collector-desktop/EISCore.Collector/Services/UploadQueueStore.cs'
]

writeFileSync(project, `\
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net7.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Data.Sqlite" Version="8.0.6" />
    <PackageReference Include="System.Security.Cryptography.ProtectedData" Version="8.0.0" />
${sources.map((source) => `    <Compile Include="${resolve(repoRoot, source)}" Link="${source.split('/').pop()}" />`).join('\n')}
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using System.Net;
using System.Net.Sockets;
using System.Text;
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
}

Directory.CreateDirectory(dataDir);

if (CollectorAuthorizationCodePolicy.Normalize("  bind-code-001 \r\n") != "bind-code-001")
{
    throw new InvalidOperationException("Authorization code should be trimmed before binding.");
}
if (CollectorAuthorizationCodePolicy.Normalize(null) != "")
{
    throw new InvalidOperationException("Null authorization code should normalize to empty.");
}
if (!CollectorAuthorizationCodePolicy.ShouldClearAfterBindAttempt("bind-code-001")
    || CollectorAuthorizationCodePolicy.ShouldClearAfterBindAttempt("   "))
{
    throw new InvalidOperationException("Authorization code should only be cleared after a non-empty bind attempt.");
}
var emptyServerPreflight = CollectorBindPreflightPolicy.Evaluate("", "bind-code-001");
if (emptyServerPreflight.CanBind
    || emptyServerPreflight.StatusMessage != "请先配置服务器地址。"
    || emptyServerPreflight.ShouldClearAuthorizationCode)
{
    throw new InvalidOperationException("Bind preflight should reject empty server address without clearing authorization code.");
}
var invalidServerPreflight = CollectorBindPreflightPolicy.Evaluate("ftp://nanpai.eissys.top", "bind-code-001");
if (invalidServerPreflight.CanBind
    || !invalidServerPreflight.StatusMessage.Contains("http/https", StringComparison.Ordinal)
    || invalidServerPreflight.ShouldClearAuthorizationCode)
{
    throw new InvalidOperationException("Bind preflight should reject invalid server address without clearing authorization code.");
}
var emptyCodePreflight = CollectorBindPreflightPolicy.Evaluate("nanpai.eissys.top", "   ");
if (emptyCodePreflight.CanBind
    || emptyCodePreflight.StatusMessage != "请输入设备授权码。"
    || emptyCodePreflight.ShouldClearAuthorizationCode)
{
    throw new InvalidOperationException("Bind preflight should reject an empty authorization code.");
}
var validPreflight = CollectorBindPreflightPolicy.Evaluate("nanpai.eissys.top", "  bind-code-001  ");
if (!validPreflight.CanBind
    || validPreflight.AuthorizationCode != "bind-code-001"
    || !validPreflight.ShouldClearAuthorizationCode
    || !string.IsNullOrWhiteSpace(validPreflight.StatusMessage))
{
    throw new InvalidOperationException("Valid bind preflight should trim authorization code and allow binding.");
}

var disabledHeartbeat = CollectorDeviceRemoteCallPolicy.EvaluateHeartbeat(
    new AppConfig { DeviceStatus = "disabled", ServerBaseUrl = "https://nanpai.eissys.top" },
    "device-token");
if (!disabledHeartbeat.CanCall)
{
    throw new InvalidOperationException("Heartbeat should remain callable for disabled devices as a recovery channel.");
}
var disabledConfigSync = CollectorDeviceRemoteCallPolicy.EvaluateConfigSync(
    new AppConfig { DeviceStatus = "disabled", ServerBaseUrl = "https://nanpai.eissys.top" },
    "device-token");
if (disabledConfigSync.CanCall || disabledConfigSync.Reason != "device_disabled")
{
    throw new InvalidOperationException("Remote config sync should pause when the device is disabled.");
}
var pendingConfigSync = CollectorDeviceRemoteCallPolicy.EvaluateConfigSync(
    new AppConfig { DeviceStatus = "pending", ServerBaseUrl = "https://nanpai.eissys.top" },
    "device-token");
if (pendingConfigSync.CanCall || pendingConfigSync.Reason != "binding_required")
{
    throw new InvalidOperationException("Remote config sync should pause while waiting for binding.");
}
var invalidHeartbeat = CollectorDeviceRemoteCallPolicy.EvaluateHeartbeat(
    new AppConfig { DeviceStatus = "active", ServerBaseUrl = "ftp://nanpai.eissys.top" },
    "device-token");
if (invalidHeartbeat.CanCall
    || invalidHeartbeat.Reason != "invalid_server_address"
    || !invalidHeartbeat.StatusMessage.Contains("http/https", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Heartbeat should reject invalid server addresses before calling the API.");
}
var missingServerHeartbeat = CollectorDeviceRemoteCallPolicy.EvaluateHeartbeat(
    new AppConfig { DeviceStatus = "active", ServerBaseUrl = "   " },
    "device-token");
if (missingServerHeartbeat.CanCall || missingServerHeartbeat.Reason != "missing_server_address")
{
    throw new InvalidOperationException("Heartbeat should distinguish missing server address from invalid addresses.");
}
var missingTokenHeartbeat = CollectorDeviceRemoteCallPolicy.EvaluateHeartbeat(
    new AppConfig { DeviceStatus = "active", ServerBaseUrl = "https://nanpai.eissys.top" },
    "");
if (missingTokenHeartbeat.CanCall || missingTokenHeartbeat.Reason != "missing_device_token")
{
    throw new InvalidOperationException("Heartbeat should pause when the local device token is missing.");
}

var bindListener = new TcpListener(IPAddress.Loopback, 0);
bindListener.Start();
var bindPort = ((IPEndPoint)bindListener.LocalEndpoint).Port;
var bindServerTask = Task.Run(async () =>
{
    using var client = await bindListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("POST /agent/document-intake/devices/bind ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Bind request did not target the expected endpoint.");
    }

    var body = "{\"code\":\"BIND_CODE_INVALID\",\"message\":\"Device authorization code is invalid\"}";
    var response = "HTTP/1.1 403 Forbidden\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    await new CollectorApiClient().BindDeviceAsync(
        $"http://127.0.0.1:{bindPort}",
        new DeviceBindRequest
        {
            EnterpriseCode = "local",
            DeviceCode = "collector-1",
            DeviceName = "Collector 1",
            AuthorizationCode = "bad-code"
        });
    throw new InvalidOperationException("Invalid bind code should throw CollectorDeviceBindException.");
}
catch (CollectorDeviceAuthException)
{
    throw new InvalidOperationException("Invalid bind code should not be classified as an expired device token.");
}
catch (CollectorDeviceBindException ex)
{
    if (ex.StatusCode != HttpStatusCode.Forbidden
        || !ex.ResponseBody.Contains("BIND_CODE_INVALID", StringComparison.Ordinal)
        || !ex.Message.Contains("授权码无效", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("CollectorDeviceBindException did not preserve status/body or friendly message.");
    }

    var advice = CollectorBindFailurePolicy.Describe(ex);
    if (advice.FailureKind != "bind_code_invalid"
        || advice.StatusCode != 403
        || !advice.UserMessage.Contains("授权码无效或已过期", StringComparison.Ordinal)
        || advice.UserMessage.Contains("403", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Invalid bind code advice should be concise and user-facing.");
    }
}
finally
{
    bindListener.Stop();
}
await bindServerTask.WaitAsync(TimeSpan.FromSeconds(5));

var configurationService = new ConfigurationService();

var malformedBindListener = new TcpListener(IPAddress.Loopback, 0);
malformedBindListener.Start();
var malformedBindPort = ((IPEndPoint)malformedBindListener.LocalEndpoint).Port;
var malformedBindServerTask = Task.Run(async () =>
{
    using var client = await malformedBindListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("POST /agent/document-intake/devices/bind ", StringComparison.Ordinal)
        || !requestText.Contains("\"authorizationCode\":\"malformed-success-code\"", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Malformed bind request did not include the expected authorization code.");
    }

    var body = """
{
  "deviceId": "device-without-token",
  "deviceToken": "   ",
  "deviceCode": "collector-1",
  "deviceName": "Collector 1"
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

var malformedConfig = new AppConfig
{
    ServerBaseUrl = $"http://127.0.0.1:{malformedBindPort}",
    EnterpriseCode = "local",
    DeviceId = "device-old",
    DeviceCode = "collector-1",
    DeviceName = "Old Collector",
    DeviceStatus = "pending",
    EncryptedDeviceToken = "old-protected-token"
};
try
{
    await new DeviceBindingService(new CollectorApiClient(), configurationService)
        .BindAsync(malformedConfig, "malformed-success-code");
    throw new InvalidOperationException("Malformed bind success response should fail before saving device state.");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("deviceToken", StringComparison.Ordinal))
{
    var advice = CollectorBindFailurePolicy.Describe(ex);
    if (advice.FailureKind != "bind_response_invalid"
        || advice.StatusCode is not null
        || !advice.UserMessage.Contains("后台绑定响应不完整", StringComparison.Ordinal)
        || advice.UserMessage.Contains("deviceToken", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Malformed bind response advice should point operators to the backend contract.");
    }
}
finally
{
    malformedBindListener.Stop();
}
await malformedBindServerTask.WaitAsync(TimeSpan.FromSeconds(5));
if (malformedConfig.DeviceStatus != "pending"
    || malformedConfig.DeviceId != "device-old"
    || malformedConfig.EncryptedDeviceToken != "old-protected-token")
{
    throw new InvalidOperationException("Malformed bind response should not mutate the existing pending device config.");
}
if (File.Exists(AppPaths.ConfigPath))
{
    throw new InvalidOperationException("Malformed bind response should not write collector-config.json.");
}

var timeoutAdvice = CollectorBindFailurePolicy.Describe(new TaskCanceledException("bind timeout"));
if (timeoutAdvice.FailureKind != "bind_timeout" || !timeoutAdvice.UserMessage.Contains("请求超时", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Bind timeout advice was not operator-friendly.");
}
var networkAdvice = CollectorBindFailurePolicy.Describe(new HttpRequestException("connection refused"));
if (networkAdvice.FailureKind != "bind_network" || !networkAdvice.UserMessage.Contains("无法连接服务器", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Bind network advice was not operator-friendly.");
}

var successfulBindListener = new TcpListener(IPAddress.Loopback, 0);
successfulBindListener.Start();
var successfulBindPort = ((IPEndPoint)successfulBindListener.LocalEndpoint).Port;
var successfulBindServerTask = Task.Run(async () =>
{
    using var client = await successfulBindListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("POST /agent/document-intake/devices/bind ", StringComparison.Ordinal)
        || !requestText.Contains("\"authorizationCode\":\"new-bind-code\"", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Successful bind request did not include the expected authorization code.");
    }

    var body = """
{
  "deviceId": "device-rebound",
  "deviceToken": "new-device-token",
  "deviceCode": "collector-1",
  "deviceName": "Collector 1",
  "defaultUserId": "user-1",
  "defaultUsername": "operator",
  "defaultRole": "warehouse"
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

var rebindingConfig = new AppConfig
{
    ServerBaseUrl = $"http://127.0.0.1:{successfulBindPort}",
    EnterpriseCode = "local",
    DeviceId = "device-old",
    DeviceCode = "collector-1",
    DeviceName = "Old Collector",
    DeviceStatus = "pending",
    EncryptedDeviceToken = "old-protected-token"
};
try
{
    await new DeviceBindingService(new CollectorApiClient(), configurationService)
        .BindAsync(rebindingConfig, "new-bind-code");
}
finally
{
    successfulBindListener.Stop();
}
await successfulBindServerTask.WaitAsync(TimeSpan.FromSeconds(5));
if (rebindingConfig.DeviceId != "device-rebound"
    || rebindingConfig.DeviceStatus != "active"
    || !CollectorDeviceAccessPolicy.CanUploadFiles(rebindingConfig)
    || configurationService.UnprotectToken(rebindingConfig.EncryptedDeviceToken) != "new-device-token")
{
    throw new InvalidOperationException("Successful rebind did not restore active device state and protected token.");
}
var reboundFromDisk = await configurationService.LoadAsync();
if (reboundFromDisk.DeviceStatus != "active"
    || reboundFromDisk.DeviceId != "device-rebound"
    || configurationService.UnprotectToken(reboundFromDisk.EncryptedDeviceToken) != "new-device-token")
{
    throw new InvalidOperationException("Successful rebind was not persisted as an active device.");
}

var listener = new TcpListener(IPAddress.Loopback, 0);
listener.Start();
var port = ((IPEndPoint)listener.LocalEndpoint).Port;
var serverTask = Task.Run(async () =>
{
    using var client = await listener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    var body = "{\"code\":\"UNAUTHORIZED_DEVICE\",\"message\":\"Invalid or missing device token\"}";
    var response = "HTTP/1.1 401 Unauthorized\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

var apiClient = new CollectorApiClient();
var activeConfig = new AppConfig
{
    ServerBaseUrl = $"http://127.0.0.1:{port}",
    DeviceId = "device-1",
    DeviceCode = "collector-1",
    DeviceStatus = "active",
    EncryptedDeviceToken = "protected-device-token"
};

try
{
    await apiClient.GetDeviceConfigAsync(activeConfig, "stale-device-token");
    throw new InvalidOperationException("Unauthorized device config request should throw CollectorDeviceAuthException.");
}
catch (CollectorDeviceAuthException ex)
{
    if (ex.StatusCode != HttpStatusCode.Unauthorized
        || !ex.ResponseBody.Contains("UNAUTHORIZED_DEVICE", StringComparison.Ordinal)
        || !ex.Message.Contains("401", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("CollectorDeviceAuthException did not preserve status and response body.");
    }
    if (UploadConnectivityPolicy.IsNetworkFailure(ex))
    {
        throw new InvalidOperationException("Device authentication failures should not be classified as upload connectivity outages.");
    }
}
finally
{
    listener.Stop();
}
await serverTask.WaitAsync(TimeSpan.FromSeconds(5));

if (!CollectorDeviceAuthPolicy.ApplyAuthenticationFailure(activeConfig))
{
    throw new InvalidOperationException("Authentication failure policy did not report a state change.");
}
if (activeConfig.DeviceStatus != "pending" || !string.IsNullOrWhiteSpace(activeConfig.EncryptedDeviceToken))
{
    throw new InvalidOperationException("Authentication failure policy did not clear the token and mark the device pending.");
}
if (CollectorDeviceAccessPolicy.CanUploadFiles(activeConfig)
    || CollectorDeviceAccessPolicy.CanUploadLogs(activeConfig)
    || CollectorDeviceAccessPolicy.CanFetchRemoteConfig(activeConfig)
    || CollectorDeviceAccessPolicy.GetCollectionBlockedReason(activeConfig) != "binding_required")
{
    throw new InvalidOperationException("Pending device should not be allowed to collect, upload logs, or fetch config.");
}
if (CollectorDeviceAuthPolicy.ApplyAuthenticationFailure(activeConfig))
{
    throw new InvalidOperationException("Authentication failure policy should be idempotent after state is already pending.");
}
var persistenceFailureConfig = new AppConfig
{
    DeviceId = "device-persist-failure",
    DeviceCode = "collector-persist-failure",
    DeviceStatus = "active",
    EncryptedDeviceToken = "protected-token-before-save-failure"
};
if (!CollectorDeviceAuthPolicy.ApplyAuthenticationFailure(persistenceFailureConfig))
{
    throw new InvalidOperationException("Authentication failure policy should mutate active state before persistence.");
}
var persistenceSaveAttempted = false;
var persistenceFailure = await CollectorDeviceAuthPolicy.TrySaveAuthenticationFailureStateAsync(
    persistenceFailureConfig,
    _ =>
    {
        persistenceSaveAttempted = true;
        return Task.FromException(new IOException("simulated config path unavailable"));
    });
if (!persistenceSaveAttempted || persistenceFailure is not IOException)
{
    throw new InvalidOperationException("Authentication failure state persistence should surface save failure without throwing.");
}
if (persistenceFailureConfig.DeviceStatus != "pending"
    || !string.IsNullOrWhiteSpace(persistenceFailureConfig.EncryptedDeviceToken))
{
    throw new InvalidOperationException("Authentication failure state should remain converged in memory when persistence fails.");
}
var persistenceSuccess = await CollectorDeviceAuthPolicy.TrySaveAuthenticationFailureStateAsync(
    persistenceFailureConfig,
    _ => Task.CompletedTask);
if (persistenceSuccess is not null)
{
    throw new InvalidOperationException("Authentication failure state persistence should not report failure when save succeeds.");
}

var queueStore = new UploadQueueStore();
var logStore = new ClientLogStore();
await queueStore.EnsureCreatedAsync();
await logStore.EnsureCreatedAsync();
var logService = new ClientLogService(logStore);
var fileService = new CollectorFileService(queueStore, logService);
var filePath = Path.Combine(dataDir, "pending-device.pdf");
await File.WriteAllTextAsync(filePath, "pending-device-content");

var pendingResult = await fileService.EnqueueFileAsync(filePath, "manual_drag_drop", activeConfig);
if (pendingResult is not null)
{
    throw new InvalidOperationException("Pending device should not enqueue files after authentication failure.");
}
var rows = await queueStore.ListRecentAsync(10);
if (rows.Count != 0)
{
    throw new InvalidOperationException($"Pending device wrote {rows.Count} queue rows.");
}
var logs = await logStore.ListPendingAsync(20);
if (!logs.Any(item => item.EventType == "file_ignored"
    && item.Message.Contains("重新绑定", StringComparison.Ordinal)
    && item.MetadataJson.Contains("binding_required", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Pending enqueue attempt was not logged with binding_required metadata.");
}

var uploadListener = new TcpListener(IPAddress.Loopback, 0);
uploadListener.Start();
var uploadPort = ((IPEndPoint)uploadListener.LocalEndpoint).Port;
var uploadServerTask = Task.Run(async () =>
{
    using var client = await uploadListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("POST /agent/document-intake/assets/upload ", StringComparison.Ordinal)
        || !requestText.Contains("Authorization: Bearer stale-device-token", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException("Upload request did not target the expected authenticated endpoint.");
    }

    var body = "{\"code\":\"UNAUTHORIZED_DEVICE\",\"message\":\"Invalid or missing device token\"}";
    var response = "HTTP/1.1 401 Unauthorized\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

var uploadFilePath = Path.Combine(dataDir, "queued-before-auth-failure.pdf");
await File.WriteAllTextAsync(uploadFilePath, "queued-before-auth-failure");
var queuedBeforeAuthFailure = await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = uploadFilePath,
    OriginalFilename = "queued-before-auth-failure.pdf",
    FileHash = "hash-auth-upload",
    FileSize = new FileInfo(uploadFilePath).Length,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    DeviceId = "device-1",
    Status = UploadQueueStatus.Queued,
    RetryCount = 2,
    CreatedAt = DateTimeOffset.Now.AddMinutes(-5)
});
var uploadConfig = new AppConfig
{
    ServerBaseUrl = $"http://127.0.0.1:{uploadPort}",
    DeviceId = "device-1",
    DeviceCode = "collector-1",
    DeviceStatus = "active",
    UploadMaxRetryCount = 3,
    UploadRetryIntervalSeconds = 5
};
var uploadProcessor = new UploadQueueProcessor(
    queueStore,
    new CollectorApiClient(),
    logService,
    () => uploadConfig,
    () => "stale-device-token");
try
{
    await uploadProcessor.ProcessOnceAsync();
}
finally
{
    uploadListener.Stop();
}
await uploadServerTask.WaitAsync(TimeSpan.FromSeconds(5));

var queuedAfterAuthFailure = await queueStore.FindByHashAsync("hash-auth-upload")
    ?? throw new InvalidOperationException("Upload queue row was not found after auth failure.");
if (queuedAfterAuthFailure.Id != queuedBeforeAuthFailure.Id
    || queuedAfterAuthFailure.Status != UploadQueueStatus.Queued
    || queuedAfterAuthFailure.RetryCount != 2
    || queuedAfterAuthFailure.NextRetryAt is not null
    || !queuedAfterAuthFailure.LastError.Contains("认证失效", StringComparison.Ordinal))
{
    throw new InvalidOperationException(
        $"Upload auth failure should keep the row queued without consuming retries, got {queuedAfterAuthFailure.Status}/{queuedAfterAuthFailure.RetryCount}/{queuedAfterAuthFailure.NextRetryAt}/{queuedAfterAuthFailure.LastError}.");
}
var authLogs = await logStore.ListPendingAsync(50);
if (!authLogs.Any(item => item.EventType == "collector_device_auth_failed"
    && item.Message.Contains("认证已失效", StringComparison.Ordinal)
    && item.MetadataJson.Contains("\"source\":\"upload\"", StringComparison.Ordinal)
    && item.MetadataJson.Contains("hash-auth-upload", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Upload auth failure was not logged with upload source and queue metadata.");
}
if (!authLogs.Any(item => item.EventType == "file_upload_auth_failed"
    && item.Message.Contains("queued-before-auth-failure.pdf", StringComparison.Ordinal)
    && item.MetadataJson.Contains("\"queue_id\"", StringComparison.Ordinal)
    && item.MetadataJson.Contains("hash-auth-upload", StringComparison.Ordinal)
    && item.MetadataJson.Contains("\"retry_count\":2", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Upload auth failure did not write a file-level queue context log.");
}
if (authLogs.Any(item => item.EventType == "upload_connectivity_offline"))
{
    throw new InvalidOperationException("Upload auth failure should not be logged as an offline connectivity transition.");
}
await queueStore.UpdateStatusAsync(queuedBeforeAuthFailure.Id, UploadQueueStatus.Ignored, "verified auth failure behavior");

var handledUploadListener = new TcpListener(IPAddress.Loopback, 0);
handledUploadListener.Start();
var handledUploadPort = ((IPEndPoint)handledUploadListener.LocalEndpoint).Port;
var handledUploadServerTask = Task.Run(async () =>
{
    using var client = await handledUploadListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    var body = "{\"code\":\"UNAUTHORIZED_DEVICE\",\"message\":\"Invalid or missing device token\"}";
    var response = "HTTP/1.1 401 Unauthorized\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

var handledUploadFilePath = Path.Combine(dataDir, "handled-auth-failure.pdf");
await File.WriteAllTextAsync(handledUploadFilePath, "handled-auth-failure");
await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = handledUploadFilePath,
    OriginalFilename = "handled-auth-failure.pdf",
    FileHash = "hash-auth-handled-upload",
    FileSize = new FileInfo(handledUploadFilePath).Length,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    DeviceId = "device-1",
    Status = UploadQueueStatus.Queued,
    RetryCount = 1,
    CreatedAt = DateTimeOffset.Now.AddMinutes(-4)
});
var handledSources = new List<string>();
var handledUploadConfig = new AppConfig
{
    ServerBaseUrl = $"http://127.0.0.1:{handledUploadPort}",
    DeviceId = "device-1",
    DeviceCode = "collector-1",
    DeviceStatus = "active",
    UploadMaxRetryCount = 3,
    UploadRetryIntervalSeconds = 5
};
var handledUploadProcessor = new UploadQueueProcessor(
    queueStore,
    new CollectorApiClient(),
    logService,
    () => handledUploadConfig,
    () => "stale-device-token",
    (exception, source, cancellationToken) =>
    {
        handledSources.Add($"{source}:{(int)exception.StatusCode}");
        return logService.LogAsync(
            "error",
            "collector_device_auth_failed",
            "采集设备认证已失效，请使用新的授权码重新绑定。",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new { source, statusCode = (int)exception.StatusCode }),
            cancellationToken: cancellationToken);
    });
try
{
    await handledUploadProcessor.ProcessOnceAsync();
}
finally
{
    handledUploadListener.Stop();
}
await handledUploadServerTask.WaitAsync(TimeSpan.FromSeconds(5));
if (!handledSources.SequenceEqual(new[] { "upload:401" }))
{
    throw new InvalidOperationException("Upload auth failure handler was not called with the expected source/status.");
}
var handledQueued = await queueStore.FindByHashAsync("hash-auth-handled-upload")
    ?? throw new InvalidOperationException("Handled upload queue row was not found after auth failure.");
if (handledQueued.Status != UploadQueueStatus.Queued || handledQueued.RetryCount != 1)
{
    throw new InvalidOperationException("Handled upload auth failure should keep queue status and retry count stable.");
}
var handledAuthLogs = await logStore.ListPendingAsync(100);
if (!handledAuthLogs.Any(item => item.EventType == "file_upload_auth_failed"
    && item.Message.Contains("handled-auth-failure.pdf", StringComparison.Ordinal)
    && item.MetadataJson.Contains("hash-auth-handled-upload", StringComparison.Ordinal))
    || !handledAuthLogs.Any(item => item.EventType == "collector_device_auth_failed"
        && item.MetadataJson.Contains("\"source\":\"upload\"", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Handled upload auth failure should keep both file-level and device-level auth logs.");
}

var logsListener = new TcpListener(IPAddress.Loopback, 0);
logsListener.Start();
var logsPort = ((IPEndPoint)logsListener.LocalEndpoint).Port;
var logsServerTask = Task.Run(async () =>
{
    using var client = await logsListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("POST /agent/document-intake/client-logs/batch ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Log upload request did not target the expected endpoint.");
    }

    var body = "{\"code\":\"UNAUTHORIZED_DEVICE\",\"message\":\"Invalid or missing device token\"}";
    var response = "HTTP/1.1 401 Unauthorized\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});
var pendingLogBeforeAuth = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "warn",
    EventType = "pending_before_log_auth_failure",
    Message = "pending before log auth failure"
});
var logAuthSources = new List<string>();
var logUploadProcessor = new LogUploadProcessor(
    logStore,
    new CollectorApiClient(),
    () => new AppConfig
    {
        ServerBaseUrl = $"http://127.0.0.1:{logsPort}",
        DeviceId = "device-1",
        DeviceCode = "collector-1",
        DeviceStatus = "active",
        LogBatchSize = 100,
        LogRetentionDays = 30
    },
    () => "stale-device-token",
    (exception, source, cancellationToken) =>
    {
        logAuthSources.Add($"{source}:{(int)exception.StatusCode}");
        return logService.LogAsync(
            "error",
            "collector_device_auth_failed",
            "采集设备认证已失效，请使用新的授权码重新绑定。",
            exception.ToString(),
            metadataJson: ClientLogMetadata.Serialize(new { source, statusCode = (int)exception.StatusCode }),
            cancellationToken: cancellationToken);
    });
try
{
    await logUploadProcessor.FlushAsync();
}
finally
{
    logsListener.Stop();
}
await logsServerTask.WaitAsync(TimeSpan.FromSeconds(5));
if (!logAuthSources.SequenceEqual(new[] { "logs:401" }))
{
    throw new InvalidOperationException("Log auth failure handler was not called with the expected source/status.");
}
var pendingAfterLogAuth = await logStore.ListPendingAsync(200);
if (!pendingAfterLogAuth.Any(item => item.Id == pendingLogBeforeAuth)
    || !pendingAfterLogAuth.Any(item => item.EventType == "collector_device_auth_failed"
        && item.MetadataJson.Contains("\"source\":\"logs\"", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Log auth failure should keep pending logs local and add a logs auth failure event.");
}
`)

try {
  const dotnetEnv = {
    ...process.env,
    EISCORE_COLLECTOR_DATA_DIR: dataDir,
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost'
  }
  for (const proxyVariable of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
    delete dotnetEnv[proxyVariable]
  }

  const result = spawnSync(dotnet, ['run', '--project', project], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: dotnetEnv
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector device auth regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
