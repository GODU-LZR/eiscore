// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const localDotnet = '/home/lzr/.dotnet/dotnet'
const dotnet = process.env.DOTNET_ROOT
  ? join(process.env.DOTNET_ROOT, 'dotnet')
  : existsSync(localDotnet)
    ? localDotnet
    : 'dotnet'
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-upload-queue-recovery-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorUploadQueueRecoverySmoke.csproj')
const appPaths = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/AppPaths.cs')
const collectorSqlite = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs')
const queueStore = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/UploadQueueStore.cs')
const queueModels = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/QueueModels.cs')
const mainWindow = resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml.cs')

const mainWindowText = readFileSync(mainWindow, 'utf8')
const recoveryMethod = mainWindowText.match(/private async Task RecoverInterruptedUploadsAsync\(\)([\s\S]*?)\n    private async Task SyncRemoteConfigAsync/)
if (!recoveryMethod) {
  throw new Error('MainWindow should keep a RecoverInterruptedUploadsAsync startup recovery hook')
}
if (!/try[\s\S]*ResetInterruptedUploadsAsync\(\)[\s\S]*catch \(Exception ex\)/.test(recoveryMethod[1])) {
  throw new Error('Startup upload recovery should catch local queue failures so collector startup can continue')
}
if (!recoveryMethod[1].includes('"upload_queue_recovery_failed"')) {
  throw new Error('Startup upload recovery failures should be logged for diagnostics')
}
if (!recoveryMethod[1].includes('"upload_queue_recovered"')) {
  throw new Error('Successful startup upload recovery should keep the recovered-count audit log')
}

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
    <Compile Include="${appPaths}" Link="AppPaths.cs" />
    <Compile Include="${collectorSqlite}" Link="CollectorSqlite.cs" />
    <Compile Include="${queueStore}" Link="UploadQueueStore.cs" />
    <Compile Include="${queueModels}" Link="QueueModels.cs" />
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

var store = new UploadQueueStore();
await store.EnsureCreatedAsync();

await store.InsertAsync(new UploadQueueItem
{
    FilePath = Path.Combine(dataDir, "interrupted.pdf"),
    OriginalFilename = "interrupted.pdf",
    FileHash = "hash-interrupted",
    FileSize = 12,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Uploading,
    CreatedAt = DateTimeOffset.Now.AddMinutes(-5)
});

await store.InsertAsync(new UploadQueueItem
{
    FilePath = Path.Combine(dataDir, "queued.pdf"),
    OriginalFilename = "queued.pdf",
    FileHash = "hash-queued",
    FileSize = 12,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Queued,
    CreatedAt = DateTimeOffset.Now
});

var recovered = await store.ResetInterruptedUploadsAsync();
if (recovered != 1)
{
    throw new InvalidOperationException($"Expected one interrupted upload to be recovered, got {recovered}.");
}

var rows = await store.ListRecentAsync(10);
var interrupted = rows.Single(item => item.FileHash == "hash-interrupted");
if (interrupted.Status != UploadQueueStatus.Queued)
{
    throw new InvalidOperationException($"Interrupted row status was {interrupted.Status}, expected queued.");
}

if (!interrupted.LastError.Contains("重新入队", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Interrupted row recovery reason was not recorded.");
}

var next = await store.GetNextPendingAsync(10);
if (next is null || next.FileHash != "hash-interrupted")
{
    throw new InvalidOperationException("Recovered interrupted upload is not eligible for retry.");
}

var recoveredAgain = await store.ResetInterruptedUploadsAsync();
if (recoveredAgain != 0)
{
    throw new InvalidOperationException($"Expected idempotent recovery to reset zero rows, got {recoveredAgain}.");
}

var exhausted = await store.InsertAsync(new UploadQueueItem
{
    FilePath = Path.Combine(dataDir, "old-failed.pdf"),
    OriginalFilename = "old-failed.pdf",
    FileHash = "hash-exhausted",
    FileSize = 12,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Failed,
    RetryCount = 10,
    LastError = "network unavailable",
    CreatedAt = DateTimeOffset.Now.AddMinutes(-10)
});

var requeued = await store.RequeueExistingAsync(new UploadQueueItem
{
    Id = exhausted.Id,
    FilePath = Path.Combine(dataDir, "new-location.pdf"),
    OriginalFilename = "new-location.pdf",
    FileHash = exhausted.FileHash,
    FileSize = 18,
    MimeType = "application/pdf",
    UploadSource = "manual_drag_drop",
    SourceFolder = "C:\\inbox\\again",
    DeviceId = "device-1",
    UploadedByUserId = "u-1",
    UploadedByUsername = "operator",
    UploadedByRole = "warehouse",
    OperatorSource = "device_default_user"
});

if (requeued is null)
{
    throw new InvalidOperationException("Expected failed duplicate row to be requeued.");
}
if (requeued.Status != UploadQueueStatus.Queued || requeued.RetryCount != 0)
{
    throw new InvalidOperationException($"Requeued row status/retry_count was {requeued.Status}/{requeued.RetryCount}, expected queued/0.");
}
if (requeued.FilePath != Path.Combine(dataDir, "new-location.pdf") || requeued.UploadSource != "manual_drag_drop")
{
    throw new InvalidOperationException("Requeued row did not refresh file path or upload source.");
}
if (!requeued.LastError.Contains("重新入队", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Requeued row reason was not recorded.");
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

  console.log('PASS: collector upload queue recovery regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
