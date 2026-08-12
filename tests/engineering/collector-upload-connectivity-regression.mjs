// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = resolve(import.meta.dirname, '../..')
const localDotnet = '/home/lzr/.dotnet/dotnet'
const dotnet = process.env.DOTNET_ROOT
  ? join(process.env.DOTNET_ROOT, 'dotnet')
  : existsSync(localDotnet)
    ? localDotnet
    : 'dotnet'
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-upload-connectivity-'))
const dataDir = join(workDir, 'collector-data')
mkdirSync(dataDir, { recursive: true })

let uploadAttempts = 0
const server = createServer(async (req, res) => {
  await readBody(req)
  assert.equal(req.url, '/agent/document-intake/assets/upload')
  assert.equal(req.method, 'POST')
  assert.equal(req.headers.authorization, 'Bearer device-token')

  uploadAttempts += 1
  if (uploadAttempts === 1) {
    sendJson(res, 503, { code: 'TEMPORARY_UNAVAILABLE' })
    return
  }

  if (uploadAttempts === 3) {
    sendJson(res, 200, {
      status: 'uploaded',
      assetId: '',
      batchId: 'batch-invalid',
      duplicate: false
    })
    return
  }

  if (uploadAttempts === 4) {
    sendJson(res, 200, {
      status: 'duplicate',
      assetId: 'asset-duplicate',
      batchId: 'batch-duplicate',
      duplicate: false
    })
    return
  }

  if (uploadAttempts === 5) {
    sendJson(res, 200, {
      status: 'uploaded',
      assetId: 'x'.repeat(300),
      batchId: 'batch-too-long',
      duplicate: false
    })
    return
  }

  if (uploadAttempts === 6) {
    setTimeout(() => {
      if (!res.writableEnded) {
        sendJson(res, 200, {
          status: 'uploaded',
          assetId: 'asset-after-cancel',
          batchId: 'batch-after-cancel',
          duplicate: false
        })
      }
    }, 5000)
    return
  }

  sendJson(res, 200, {
    status: ' UPLOADED ',
    assetId: ' asset-\nrecovered\t ',
    batchId: ' batch-\rrecovered ',
    batchNo: ' DIB-\trecovered ',
    message: ' queued for parsing ',
    duplicate: false
  })
})
server.keepAliveTimeout = 1000
server.requestTimeout = 30000

const project = join(workDir, 'CollectorUploadConnectivitySmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAccessPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorManualUploadPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
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
${sources.map((source) => `    <Compile Include="${resolve(repoRoot, source)}" Link="${source.split('/').pop()}" />`).join('\n')}
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;

if (args.Length != 1)
{
    throw new InvalidOperationException("Expected server URL.");
}

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
}

Directory.CreateDirectory(dataDir);
var queueStore = new UploadQueueStore();
var logStore = new ClientLogStore();
await queueStore.EnsureCreatedAsync();
await logStore.EnsureCreatedAsync();

var watchFolder = Path.Combine(dataDir, "watch-folder");
Directory.CreateDirectory(watchFolder);
var filePath = Path.Combine(dataDir, "invoice.pdf");
await File.WriteAllTextAsync(filePath, "invoice");
var queued = await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = filePath,
    OriginalFilename = "invoice.pdf",
    FileHash = "hash-invoice",
    FileSize = new FileInfo(filePath).Length,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    SourceFolder = watchFolder,
    DeviceId = "device-1",
    UploadedByUserId = "user-1",
    UploadedByUsername = "operator",
    UploadedByRole = "warehouse",
    OperatorSource = "folder_binding_user",
    Status = UploadQueueStatus.Queued,
    CreatedAt = DateTimeOffset.Now.AddMinutes(-5)
});

var config = new AppConfig
{
    ServerBaseUrl = args[0],
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    DeviceStatus = "active",
    UploadRetryIntervalSeconds = 5,
    UploadMaxRetryCount = 3
};
var processor = new UploadQueueProcessor(
    queueStore,
    new CollectorApiClient(),
    new ClientLogService(logStore),
    () => config,
    () => "device-token");

await processor.ProcessOnceAsync();
var failed = await queueStore.FindByHashAsync("hash-invoice")
    ?? throw new InvalidOperationException("Queue row was not found after first upload attempt.");
if (failed.Status != UploadQueueStatus.Failed || failed.RetryCount != 1)
{
    throw new InvalidOperationException($"First upload attempt should fail and retry once, got {failed.Status}/{failed.RetryCount}.");
}
var logsAfterFailure = await logStore.ListPendingAsync(20);
if (logsAfterFailure.Count(item => item.EventType == "upload_connectivity_offline") != 1)
{
    throw new InvalidOperationException("Upload connectivity offline transition was not logged exactly once.");
}
if (!logsAfterFailure.Any(item => item.EventType == "file_upload_failed"))
{
    throw new InvalidOperationException("Failed upload event was not logged.");
}
var failedUploadLog = logsAfterFailure.First(item => item.EventType == "file_upload_failed");
ExpectUploadLogContext(failedUploadLog, queued.Id, "hash-invoice", "user-1", "operator", "warehouse", watchFolder);
var offlineLog = logsAfterFailure.First(item => item.EventType == "upload_connectivity_offline");
ExpectUploadLogContext(offlineLog, queued.Id, "hash-invoice", "user-1", "operator", "warehouse", watchFolder);

await queueStore.UpdateStatusAsync(
    queued.Id,
    UploadQueueStatus.Failed,
    "retry now",
    nextRetryAt: DateTimeOffset.Now.AddSeconds(-1));
await processor.ProcessOnceAsync();

var uploaded = await queueStore.FindByHashAsync("hash-invoice")
    ?? throw new InvalidOperationException("Queue row was not found after second upload attempt.");
if (uploaded.Status != UploadQueueStatus.Uploaded
    || uploaded.ServerAssetId != "asset-recovered"
    || uploaded.ServerBatchId != "batch-recovered"
    || uploaded.ServerBatchNo != "DIB-recovered"
    || uploaded.ServerProcessingStatus != "uploaded"
    || uploaded.ServerMessage != "queued for parsing")
{
    throw new InvalidOperationException(
        $"Second upload attempt should recover with traceability fields, got {uploaded.Status}/{uploaded.ServerAssetId}/{uploaded.ServerBatchId}/{uploaded.ServerBatchNo}/{uploaded.ServerProcessingStatus}/{uploaded.ServerMessage}.");
}
var finalLogs = await logStore.ListPendingAsync(50);
if (finalLogs.Count(item => item.EventType == "upload_connectivity_offline") != 1)
{
    throw new InvalidOperationException("Upload connectivity offline transition should not be logged repeatedly.");
}
if (finalLogs.Count(item => item.EventType == "upload_connectivity_online") != 1)
{
    throw new InvalidOperationException("Upload connectivity online recovery was not logged exactly once.");
}
if (!finalLogs.Any(item => item.EventType == "file_upload_uploaded"))
{
    throw new InvalidOperationException("Recovered upload completion was not logged.");
}
var uploadedLog = finalLogs.First(item => item.EventType == "file_upload_uploaded");
ExpectUploadLogContext(uploadedLog, queued.Id, "hash-invoice", "user-1", "operator", "warehouse", watchFolder);
if (uploadedLog.AiImportBatchId != "batch-recovered"
    || !uploadedLog.MetadataJson.Contains("DIB-recovered", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Recovered upload completion log should carry server batch traceability.");
}
var onlineLog = finalLogs.First(item => item.EventType == "upload_connectivity_online");
ExpectUploadLogContext(onlineLog, queued.Id, "hash-invoice", "user-1", "operator", "warehouse", watchFolder);
if (!UploadConnectivityPolicy.IsNetworkFailure(new HttpRequestException("network"))
    || !UploadConnectivityPolicy.IsNetworkFailure(new TaskCanceledException("timeout"))
    || UploadConnectivityPolicy.IsNetworkFailure(new InvalidOperationException("business")))
{
    throw new InvalidOperationException("Upload connectivity policy classification is incorrect.");
}

var invalidResponsePath = Path.Combine(dataDir, "invalid-response.pdf");
await File.WriteAllTextAsync(invalidResponsePath, "invalid response");
var rejectedInvalidResponse = false;
try
{
    _ = await new CollectorApiClient().UploadFileAsync(
        new UploadQueueItem
        {
            Id = 2,
            FilePath = invalidResponsePath,
            OriginalFilename = "invalid-response.pdf",
            FileHash = "hash-invalid-response",
            FileSize = new FileInfo(invalidResponsePath).Length,
            MimeType = "application/pdf",
            UploadSource = "manual_drag_drop",
            DeviceId = "device-1"
        },
        config,
        "device-token");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("assetId", StringComparison.Ordinal))
{
    rejectedInvalidResponse = true;
}

if (!rejectedInvalidResponse)
{
    throw new InvalidOperationException("Simple upload response without assetId should be rejected.");
}

var duplicateStatusPath = Path.Combine(dataDir, "duplicate-status.pdf");
await File.WriteAllTextAsync(duplicateStatusPath, "duplicate status");
var duplicateStatusResponse = await new CollectorApiClient().UploadFileAsync(
    new UploadQueueItem
    {
        Id = 3,
        FilePath = duplicateStatusPath,
        OriginalFilename = "duplicate-status.pdf",
        FileHash = "hash-duplicate-status",
        FileSize = new FileInfo(duplicateStatusPath).Length,
        MimeType = "application/pdf",
        UploadSource = "manual_drag_drop",
        DeviceId = "device-1"
    },
    config,
    "device-token");
if (!duplicateStatusResponse.Duplicate
    || duplicateStatusResponse.Status != "duplicate"
    || duplicateStatusResponse.AssetId != "asset-duplicate")
{
    throw new InvalidOperationException("Upload response status=duplicate should be normalized to Duplicate=true.");
}

var longAssetIdPath = Path.Combine(dataDir, "long-asset-id.pdf");
await File.WriteAllTextAsync(longAssetIdPath, "long asset id");
var rejectedLongAssetId = false;
try
{
    _ = await new CollectorApiClient().UploadFileAsync(
        new UploadQueueItem
        {
            Id = 4,
            FilePath = longAssetIdPath,
            OriginalFilename = "long-asset-id.pdf",
            FileHash = "hash-long-asset-id",
            FileSize = new FileInfo(longAssetIdPath).Length,
            MimeType = "application/pdf",
            UploadSource = "manual_drag_drop",
            DeviceId = "device-1"
        },
        config,
        "device-token");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("长度限制", StringComparison.Ordinal))
{
    rejectedLongAssetId = true;
}

if (!rejectedLongAssetId)
{
    throw new InvalidOperationException("Simple upload response with overlong assetId should be rejected.");
}

var cancelledPath = Path.Combine(dataDir, "cancelled-upload.pdf");
await File.WriteAllTextAsync(cancelledPath, "cancelled upload");
await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = cancelledPath,
    OriginalFilename = "cancelled-upload.pdf",
    FileHash = "hash-cancelled-upload",
    FileSize = new FileInfo(cancelledPath).Length,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    SourceFolder = watchFolder,
    DeviceId = "device-1",
    UploadedByUserId = "user-1",
    UploadedByUsername = "operator",
    UploadedByRole = "warehouse",
    OperatorSource = "folder_binding_user",
    Status = UploadQueueStatus.Queued,
    CreatedAt = DateTimeOffset.Now.AddMinutes(-1)
});
using var cts = new CancellationTokenSource();
cts.CancelAfter(TimeSpan.FromMilliseconds(250));
var cancelled = false;
try
{
    await processor.ProcessOnceAsync(cts.Token);
}
catch (OperationCanceledException)
{
    cancelled = true;
}
if (!cancelled)
{
    throw new InvalidOperationException("Upload processing should have observed cancellation.");
}

var cancelledRow = await queueStore.FindByHashAsync("hash-cancelled-upload")
    ?? throw new InvalidOperationException("Cancelled upload row was not found.");
if (cancelledRow.Status != UploadQueueStatus.Queued
    || cancelledRow.RetryCount != 0
    || cancelledRow.NextRetryAt is not null
    || !cancelledRow.LastError.Contains("退回队列", StringComparison.Ordinal))
{
    throw new InvalidOperationException($"Cancelled upload should be requeued without retry consumption, got {cancelledRow.Status}/{cancelledRow.RetryCount}/{cancelledRow.NextRetryAt:O}/{cancelledRow.LastError}.");
}

finalLogs = await logStore.ListPendingAsync(100);
if (!finalLogs.Any(item => item.EventType == "file_upload_cancelled_requeued"
    && item.Message.Contains("cancelled-upload.pdf", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Cancelled upload requeue was not logged.");
}
var cancelledLog = finalLogs.First(item => item.EventType == "file_upload_cancelled_requeued");
ExpectUploadLogContext(cancelledLog, cancelledRow.Id, "hash-cancelled-upload", "user-1", "operator", "warehouse", watchFolder);

static void ExpectUploadLogContext(
    ClientLogEvent log,
    long queueId,
    string fileHash,
    string userId,
    string username,
    string role,
    string sourceFolder)
{
    var hashPrefix = fileHash.Length <= 16 ? fileHash : fileHash[..16];
    var expectedTraceId = $"upload:{queueId}:{hashPrefix}";
    if (log.AppModule != "collector"
        || log.TraceId != expectedTraceId
        || log.SourceFileHash != fileHash
        || log.UserId != userId
        || log.Username != username
        || log.Role != role)
    {
        throw new InvalidOperationException(
            $"Upload log context mismatch for {log.EventType}: app={log.AppModule}, trace={log.TraceId}, hash={log.SourceFileHash}, user={log.UserId}/{log.Username}/{log.Role}.");
    }

    if (!log.MetadataJson.Contains($"\"queue_id\":{queueId}", StringComparison.Ordinal)
        || !log.MetadataJson.Contains(sourceFolder, StringComparison.Ordinal)
        || !log.MetadataJson.Contains("\"upload_source\":\"watch_folder\"", StringComparison.Ordinal)
        || !log.MetadataJson.Contains("\"operator_source\":\"folder_binding_user\"", StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"Upload log metadata did not include queue ownership/source context: {log.MetadataJson}");
    }
}
`)

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const result = await runDotnet(['run', '--project', project, '--', baseUrl])

  if (result.status !== 0 || result.timedOut) {
    console.error(result.stdout)
    console.error(result.stderr)
    if (result.timedOut) console.error('dotnet child process timed out')
    process.exit(result.status || 1)
  }

  assert.equal(uploadAttempts, 6, 'upload endpoint should be called six times')
  console.log('PASS: collector upload connectivity regression')
} finally {
  await new Promise((resolve) => server.close(resolve))
  rmSync(workDir, { recursive: true, force: true })
}

function runDotnet(args) {
  return new Promise((resolve) => {
    const child = spawn(dotnet, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        EISCORE_COLLECTOR_DATA_DIR: dataDir
      }
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ status: 1, stdout, stderr, timedOut: true })
    }, 60000)

    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('close', (status) => {
      clearTimeout(timer)
      resolve({ status, stdout, stderr, timedOut: false })
    })
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length
  })
  res.end(body)
}
