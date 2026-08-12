// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

const workDir = mkdtempSync(join(tmpdir(), 'eiscore-log-upload-'))
const dataDir = join(workDir, 'collector-data')
const requests = []
const serverErrors = []

const server = createServer(async (req, res) => {
  try {
    const body = await readBody(req)
    assert.equal(req.url, '/agent/document-intake/client-logs/batch')
    assert.equal(req.method, 'POST')
    assert.equal(req.headers.authorization, 'Bearer device-token')
    assert.equal(req.headers['x-eiscore-collector'], 'windows-desktop')

    const payload = JSON.parse(body.toString('utf8'))
    requests.push(payload)
    assert.equal(payload.device_id, 'device-1')
    assert.equal(payload.device_name, 'Collector 1')

    if (requests.length === 1) {
      sendJson(res, 503, { code: 'TEMPORARY_UNAVAILABLE' })
      return
    }

    if (requests.length === 2) {
      assert.equal(payload.events.length, 3)
      assert.deepEqual(payload.events.map((event) => event.eventType), ['normal_log', 'file_upload_failed', 'log_upload_failed'])
      assert.equal(payload.events[1].level, 'error')
      assert.equal(payload.events[1].deviceId, 'device-1')
      assert.equal(payload.events[1].username, 'operator')
      assert.equal(payload.events[1].role, 'warehouse')
      assert.equal(payload.events[2].level, 'warn')
      assert.match(payload.events[2].message, /日志批量上报失败/)
      sendJson(res, 200, { ok: true })
      return
    }

    if (requests.length === 3) {
      assert.equal(payload.events.length, 1)
      assert.equal(payload.events[0].eventType, 'server_rejected_log_batch')
      sendJson(res, 200, { ok: false, code: 'SERVER_DID_NOT_ACCEPT_LOG_BATCH' })
      return
    }

    if (requests.length === 4) {
      assert.equal(payload.events.length, 2)
      assert.equal(payload.events[0].eventType, 'server_rejected_log_batch')
      assert.equal(payload.events[1].eventType, 'log_upload_failed')
      sendJson(res, 200, { ok: true })
      return
    }

    if (requests.length === 5) {
      assert.equal(payload.events.length, 1)
      assert.equal(payload.events[0].eventType, 'client_log_retention_pruned')
      assert.equal(payload.events[0].level, 'warn')
      assert.match(payload.events[0].metadataJson, /pending_pruned_count/)
      sendJson(res, 200, { ok: true })
      return
    }

    if (requests.length === 6) {
      assert.equal(payload.events.length, 1)
      assert.equal(payload.events[0].eventType, 'collector_stop')
      assert.equal(payload.events[0].message, 'collector stopping')
      sendJson(res, 200, { ok: true })
      return
    }

    throw new Error(`Unexpected log upload request count: ${requests.length}`)
  } catch (error) {
    serverErrors.push(error)
    sendJson(res, 500, { code: 'STUB_ASSERTION_FAILED', message: error.message })
  }
})
server.keepAliveTimeout = 1000
server.requestTimeout = 30000

const project = join(workDir, 'CollectorLogUploadSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
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
  'collector-desktop/EISCore.Collector/Services/CollectorLogUploadPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/LogUploadProcessor.cs'
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
    throw new InvalidOperationException("Expected server URL argument.");
}

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
}

Directory.CreateDirectory(dataDir);
var store = new ClientLogStore();
await store.EnsureCreatedAsync();

var config = new AppConfig
{
    ServerBaseUrl = args[0],
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    DeviceStatus = "active",
    DefaultUserId = "user-1",
    DefaultUsername = "operator",
    DefaultRole = "warehouse",
    LogBatchSize = 10,
    LogRetentionDays = 1
};

var service = new ClientLogService(store);
service.UpdateContext(config, "WebView/123");
var highPriorityEvents = 0;
service.HighPriorityLogWritten += (_, _) => highPriorityEvents += 1;

config.LogCollectionEnabled = false;
service.UpdateContext(config, "WebView/123");
await service.LogAsync("error", "disabled_log_collection", "this log should not be written");
if (await CountEventsAsync("disabled_log_collection") != 0)
{
    throw new InvalidOperationException("Disabled log collection should skip local log writes.");
}
var disabledUploadState = CollectorLogUploadPolicy.Evaluate(config, "device-token");
if (disabledUploadState.CanUpload || disabledUploadState.Reason != "log_collection_disabled")
{
    throw new InvalidOperationException("Disabled log collection should prevent log uploads.");
}
var disabledProcessor = new LogUploadProcessor(
    store,
    new CollectorApiClient(),
    () => config,
    () => "device-token",
    logService: service);
await disabledProcessor.FlushAsync();
if (await store.CountPendingAsync() != 0)
{
    throw new InvalidOperationException("Disabled log upload should not create a local unavailable warning.");
}
config.LogCollectionEnabled = true;
service.UpdateContext(config, "WebView/123");

config.ServerBaseUrl = "ftp://nanpai.eissys.top";
await service.LogAsync("info", "pending_invalid_server_log", "log should wait for a valid server address");
var invalidProcessor = new LogUploadProcessor(
    store,
    new CollectorApiClient(),
    () => config,
    () => "device-token",
    logService: service);
await invalidProcessor.FlushAsync();
await invalidProcessor.FlushAsync();

var pendingWithInvalidServer = await store.ListPendingAsync(10);
if (pendingWithInvalidServer.Count != 2
    || pendingWithInvalidServer.Count(item => item.EventType == "pending_invalid_server_log") != 1
    || pendingWithInvalidServer.Count(item => item.EventType == "log_upload_unavailable") != 1)
{
    throw new InvalidOperationException("Invalid server address should keep the pending log and record one local unavailable warning.");
}
if (!pendingWithInvalidServer.Single(item => item.EventType == "log_upload_unavailable")
    .MetadataJson.Contains("invalid_server_address", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Log upload unavailable warning did not include the invalid_server_address reason.");
}
await store.MarkUploadedAsync(pendingWithInvalidServer.Select(item => item.Id));
config.ServerBaseUrl = args[0];

await service.LogAsync("info", "normal_log", "normal message");
if (highPriorityEvents != 0)
{
    throw new InvalidOperationException("Normal info log should not trigger high priority flush.");
}

await service.LogAsync("error", "file_upload_failed", "upload failed");
if (highPriorityEvents != 1)
{
    throw new InvalidOperationException("Error/failed log should trigger one high priority notification.");
}

var processor = new LogUploadProcessor(
    store,
    new CollectorApiClient(),
    () => config,
    () => "device-token",
    logService: service);

try
{
    await processor.FlushAsync();
    throw new InvalidOperationException("Temporary log upload failure should be surfaced.");
}
catch (HttpRequestException)
{
}

var pendingAfterFailure = await store.ListPendingAsync(10);
if (pendingAfterFailure.Count != 3
    || pendingAfterFailure.Count(item => item.EventType == "log_upload_failed") != 1)
{
    throw new InvalidOperationException($"Failed log upload should keep the pending logs and record one local failure, got {pendingAfterFailure.Count}.");
}
var firstFailureLog = pendingAfterFailure.Single(item => item.EventType == "log_upload_failed");
if (!firstFailureLog.MetadataJson.Contains("pending_batch_size", StringComparison.Ordinal)
    || !firstFailureLog.MetadataJson.Contains("HttpRequestException", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Log upload failure should include batch size and exception type metadata.");
}

await processor.FlushAsync();
var pendingAfterRecovery = await store.ListPendingAsync(10);
if (pendingAfterRecovery.Count != 0)
{
    throw new InvalidOperationException($"Recovered log upload should mark all logs uploaded, got {pendingAfterRecovery.Count} pending logs.");
}

await service.LogAsync("warn", "server_rejected_log_batch", "server accepted the HTTP request but not the log batch");
try
{
    await processor.FlushAsync();
    throw new InvalidOperationException("Server log batch rejection should be surfaced.");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("服务端确认", StringComparison.Ordinal))
{
}

var pendingAfterServerRejection = await store.ListPendingAsync(10);
if (pendingAfterServerRejection.Count != 2
    || pendingAfterServerRejection.Count(item => item.EventType == "server_rejected_log_batch") != 1
    || pendingAfterServerRejection.Count(item => item.EventType == "log_upload_failed") != 1)
{
    throw new InvalidOperationException("Server log batch rejection should keep the rejected log pending and record one local failure.");
}

await processor.FlushAsync();
var pendingAfterServerAccept = await store.ListPendingAsync(10);
if (pendingAfterServerAccept.Count != 0)
{
    throw new InvalidOperationException("Server log batch acceptance should mark the rejected log uploaded.");
}

var oldId = await store.InsertAsync(new ClientLogEvent
{
    Level = "info",
    EventType = "old_uploaded_log",
    Message = "old uploaded log",
    CreatedAt = DateTimeOffset.Now.AddDays(-5)
});
await store.MarkUploadedAsync(new[] { oldId });
await store.InsertAsync(new ClientLogEvent
{
    Level = "warn",
    EventType = "old_pending_log",
    Message = "old pending log",
    CreatedAt = DateTimeOffset.Now.AddDays(-5)
});
await processor.FlushAsync();
if (await CountEventsAsync("old_uploaded_log") != 0)
{
    throw new InvalidOperationException("Uploaded logs older than retention should be pruned even when there are no pending uploads.");
}
if (await CountEventsAsync("old_pending_log") != 0)
{
    throw new InvalidOperationException("Pending logs older than retention should be pruned to bound local log storage.");
}
if (await CountEventsAsync("client_log_retention_pruned") != 1)
{
    throw new InvalidOperationException("Pruning old pending logs should leave one retention summary for the server.");
}
if (await store.CountPendingAsync() != 0)
{
    throw new InvalidOperationException("Retention summary should be uploaded in the same flush after old pending logs are pruned.");
}

await service.LogAsync("info", "collector_stop", "collector stopping");
await processor.StopAndFlushAsync();
var pendingAfterStopFlush = await store.ListPendingAsync(10);
if (pendingAfterStopFlush.Count != 0)
{
    throw new InvalidOperationException("StopAndFlushAsync should upload shutdown logs after the background loop stops.");
}

static async Task<int> CountEventsAsync(string eventType)
{
    await using var connection = await CollectorSqlite.OpenConnectionAsync();
    var command = connection.CreateCommand();
    command.CommandText = "SELECT count(*) FROM client_log_events WHERE event_type = $event_type";
    command.Parameters.AddWithValue("$event_type", eventType);
    return Convert.ToInt32(await command.ExecuteScalarAsync());
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
    console.error(JSON.stringify(requests, null, 2))
    process.exit(result.status || 1)
  }

  assert.equal(requests.length, 6, 'log upload should retry HTTP failure, preserve server-rejected batches, prune stale local logs, and flush shutdown logs')
  assert.equal(serverErrors.length, 0, serverErrors.map((error) => error.stack || error.message).join('\n'))
  console.log('PASS: collector log upload regression')
} finally {
  server.closeIdleConnections?.()
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(resolve))
  rmSync(workDir, { recursive: true, force: true })
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json', connection: 'close' })
  res.end(JSON.stringify(payload))
}

function runDotnet(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(dotnet, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        EISCORE_COLLECTOR_DATA_DIR: dataDir
      }
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, 60000)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (status) => {
      clearTimeout(timer)
      resolve({ status, stdout, stderr, timedOut })
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
