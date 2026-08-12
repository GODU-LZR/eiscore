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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-upload-retry-schedule-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorUploadRetryScheduleSmoke.csproj')
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

var invalidServerPath = Path.Combine(dataDir, "queued-invalid-server.pdf");
var invalidServerRow = await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = invalidServerPath,
    OriginalFilename = "queued-invalid-server.pdf",
    FileHash = "hash-invalid-server",
    FileSize = 128,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    DeviceId = "device-1",
    UploadedByUserId = "user-1",
    UploadedByUsername = "operator",
    UploadedByRole = "warehouse",
    OperatorSource = "folder_binding_user",
    Status = UploadQueueStatus.Queued,
    CreatedAt = DateTimeOffset.Now.AddMinutes(-10)
});

var invalidConfig = new AppConfig
{
    ServerBaseUrl = "ftp://nanpai.eissys.top",
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    DeviceStatus = "active",
    UploadRetryIntervalSeconds = 60,
    UploadMaxRetryCount = 3
};
var invalidServerProcessor = new UploadQueueProcessor(
    queueStore,
    new CollectorApiClient(),
    new ClientLogService(logStore),
    () => invalidConfig,
    () => "device-token");

var invalidResult = await invalidServerProcessor.ProcessOnceAsync();
if (invalidResult.Outcome != UploadQueueProcessOutcome.Unavailable
    || !invalidResult.StatusMessage.Contains("http/https", StringComparison.Ordinal))
{
    throw new InvalidOperationException($"Invalid server address should stop queue processing before retry consumption, got {invalidResult.Outcome}/{invalidResult.StatusMessage}.");
}
var invalidAfter = await queueStore.FindByHashAsync("hash-invalid-server")
    ?? throw new InvalidOperationException("Invalid-server queue row was not found after processing.");
if (invalidAfter.Status != UploadQueueStatus.Queued
    || invalidAfter.RetryCount != 0
    || invalidAfter.NextRetryAt is not null)
{
    throw new InvalidOperationException($"Invalid server address mutated queue row to {invalidAfter.Status}/{invalidAfter.RetryCount}/{invalidAfter.NextRetryAt:O}.");
}
await queueStore.UpdateStatusAsync(invalidServerRow.Id, UploadQueueStatus.Ignored);

var missingPath = Path.Combine(dataDir, "missing-after-queue.pdf");
var queued = await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = missingPath,
    OriginalFilename = "missing-after-queue.pdf",
    FileHash = "hash-missing",
    FileSize = 256,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
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
    ServerBaseUrl = "http://127.0.0.1",
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    DeviceStatus = "active",
    UploadRetryIntervalSeconds = 60,
    UploadMaxRetryCount = 3
};
var processor = new UploadQueueProcessor(
    queueStore,
    new CollectorApiClient(),
    new ClientLogService(logStore),
    () => config,
    () => "device-token");

var before = DateTimeOffset.Now;
await processor.ProcessOnceAsync();
var after = DateTimeOffset.Now;

var failed = await queueStore.FindByHashAsync("hash-missing")
    ?? throw new InvalidOperationException("Missing-file queue row was not found after processing.");
if (failed.Status != UploadQueueStatus.Failed || failed.RetryCount != 1)
{
    throw new InvalidOperationException($"Missing-file row became {failed.Status}/{failed.RetryCount}, expected failed/1.");
}
if (failed.NextRetryAt is null)
{
    throw new InvalidOperationException("Failed upload did not receive a next_retry_at value.");
}
if (failed.NextRetryAt < before.AddSeconds(55) || failed.NextRetryAt > after.AddSeconds(65))
{
    throw new InvalidOperationException($"next_retry_at {failed.NextRetryAt:O} was not scheduled from the configured retry interval.");
}

var missingLogs = await logStore.ListPendingAsync(20);
if (!missingLogs.Any(item => item.EventType == "file_upload_failed"
    && item.Message.Contains("本地文件不存在", StringComparison.Ordinal)
    && item.MetadataJson.Contains("hash-missing", StringComparison.Ordinal)
    && item.MetadataJson.Contains("missing-after-queue.pdf", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Missing local file upload failure was not logged with queue metadata.");
}

var blocked = await queueStore.GetNextPendingAsync(3);
if (blocked is not null)
{
    throw new InvalidOperationException("Future-scheduled failed upload should not be selected before next_retry_at.");
}

await queueStore.UpdateStatusAsync(
    queued.Id,
    UploadQueueStatus.Failed,
    "network unavailable",
    nextRetryAt: DateTimeOffset.Now.AddSeconds(-1));
var due = await queueStore.GetNextPendingAsync(3)
    ?? throw new InvalidOperationException("Due failed upload was not selected after next_retry_at passed.");
if (due.FileHash != "hash-missing")
{
    throw new InvalidOperationException("Unexpected queue row selected after retry schedule became due.");
}

await queueStore.UpdateStatusAsync(due.Id, UploadQueueStatus.Uploading);
var uploading = await queueStore.FindByHashAsync("hash-missing")
    ?? throw new InvalidOperationException("Uploading row was not found.");
if (uploading.NextRetryAt is not null)
{
    throw new InvalidOperationException("Transition to uploading should clear next_retry_at.");
}
`)

try {
  const result = spawnSync(dotnet, ['run', '--project', project], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      EISCORE_COLLECTOR_DATA_DIR: dataDir
    }
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector upload retry schedule regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
