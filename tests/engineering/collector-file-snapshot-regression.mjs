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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-file-snapshot-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorFileSnapshotSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Models/UploadOwnerContext.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorAllowedExtensionsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAccessPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileBatchStatusPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileIgnorePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUploadOwnershipPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/FileHashService.cs',
  'collector-desktop/EISCore.Collector/Services/FileStabilityService.cs',
  'collector-desktop/EISCore.Collector/Services/MimeTypeService.cs',
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

var logService = new ClientLogService(logStore);
var config = new AppConfig
{
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    DeviceStatus = "active",
    DefaultUserId = "user-1",
    DefaultUsername = "operator",
    DefaultRole = "warehouse",
    AllowedExtensions = new List<string> { ".pdf", ".zip" },
    MaxUploadBytes = 1024 * 1024
};

var changingPath = Path.Combine(dataDir, "changing.pdf");
await File.WriteAllTextAsync(changingPath, "initial document");
var changingService = new CollectorFileService(
    queueStore,
    logService,
    async (path, cancellationToken) =>
    {
        var hash = await FileHashService.ComputeSha256Async(path, cancellationToken);
        await File.AppendAllTextAsync(path, "\nchanged while hashing", cancellationToken);
        File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddMinutes(1));
        return hash;
    });

var changingResult = await changingService.EnqueueFileAsync(changingPath, "watch_folder", config);
if (changingResult is not null)
{
    throw new InvalidOperationException("File changed during hash should not be queued.");
}
var rowsAfterChanging = await queueStore.ListRecentAsync(10);
if (rowsAfterChanging.Count != 0)
{
    throw new InvalidOperationException("Changed file wrote queue rows unexpectedly.");
}
var logsAfterChanging = await logStore.ListPendingAsync(20);
if (!logsAfterChanging.Any(item => item.EventType == "file_upload_failed"
    && item.Message.Contains("计算 hash", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Changed file was not logged as a hash-time snapshot failure.");
}

var emptyPath = Path.Combine(dataDir, "empty.pdf");
await File.WriteAllBytesAsync(emptyPath, Array.Empty<byte>());
var normalService = new CollectorFileService(queueStore, logService);
var emptyResult = await normalService.EnqueueFileAsync(emptyPath, "manual_drag_drop", config);
if (emptyResult is not null)
{
    throw new InvalidOperationException("Empty file should not be queued.");
}

var officeLockPath = Path.Combine(dataDir, "~$purchase.xlsx");
await File.WriteAllTextAsync(officeLockPath, "office lock");
var officeLockResult = await normalService.EnqueueFileAsync(officeLockPath, "watch_folder", config);
if (officeLockResult is not null)
{
    throw new InvalidOperationException("Office lock file should not be queued.");
}

var partialDownloadPath = Path.Combine(dataDir, "incoming.pdf.crdownload");
await File.WriteAllTextAsync(partialDownloadPath, "partial download");
var partialDownloadResult = await normalService.EnqueueFileAsync(partialDownloadPath, "watch_folder", config);
if (partialDownloadResult is not null)
{
    throw new InvalidOperationException("Browser partial download file should not be queued.");
}

var stablePath = Path.Combine(dataDir, "stable.pdf");
var stableContent = "stable document content";
await File.WriteAllTextAsync(stablePath, stableContent);
var stableResult = await normalService.EnqueueFileAsync(stablePath, "manual_drag_drop", config);
if (stableResult is null || stableResult.Status != UploadQueueStatus.Queued)
{
    throw new InvalidOperationException("Stable non-empty file should be queued.");
}
if (stableResult.FileSize != new FileInfo(stablePath).Length)
{
    throw new InvalidOperationException("Queued file size did not match the stable file snapshot.");
}
var expectedHash = await FileHashService.ComputeSha256Async(stablePath);
if (stableResult.FileHash != expectedHash)
{
    throw new InvalidOperationException("Queued file hash did not match the stable file content.");
}

var archivePath = Path.Combine(dataDir, "archive.zip");
await File.WriteAllTextAsync(archivePath, "zip placeholder");
var archiveResult = await normalService.EnqueueFileAsync(archivePath, "manual_selected_file", config);
if (archiveResult is null || archiveResult.Status != UploadQueueStatus.Queued)
{
    throw new InvalidOperationException("Allowed archive file should be queued.");
}
var expectedWindowsUsername = Environment.UserDomainName + "\\" + Environment.UserName;
if (archiveResult.WindowsUsername != expectedWindowsUsername)
{
    throw new InvalidOperationException("Queued archive should snapshot the current Windows username.");
}
if (archiveResult.MimeType != "application/zip")
{
    throw new InvalidOperationException("Allowed archive file should use the zip MIME type.");
}
if (archiveResult.OperatorSource != "manual_selected_user")
{
    throw new InvalidOperationException("Manual selected archive should use the manual selected user ownership source.");
}

var finalRows = await queueStore.ListRecentAsync(10);
if (finalRows.Count != 2
    || !finalRows.Any(item => item.OriginalFilename == "stable.pdf")
    || !finalRows.Any(item => item.OriginalFilename == "archive.zip"))
{
    throw new InvalidOperationException("Only the stable document and allowed archive should be persisted in the upload queue.");
}
if (CollectorFileBatchStatusPolicy.Format(2, 2) != "2 个文件已入队或已存在队列。")
{
    throw new InvalidOperationException("Batch status should report all files accepted.");
}
if (CollectorFileBatchStatusPolicy.Format(3, 0) != "3 个文件均未入队，请检查设备绑定状态、文件类型、大小或本地日志。")
{
    throw new InvalidOperationException("Batch status should report all files skipped.");
}
if (CollectorFileBatchStatusPolicy.Format(4, 2) != "2 个文件已入队或已存在队列，2 个文件未入队。")
{
    throw new InvalidOperationException("Batch status should report partial acceptance.");
}
if (CollectorFileBatchStatusPolicy.Format(1, 9) != "1 个文件已入队或已存在队列。")
{
    throw new InvalidOperationException("Batch status should clamp accepted count to total count.");
}
var finalLogs = await logStore.ListPendingAsync(50);
if (!finalLogs.Any(item => item.EventType == "file_ignored" && item.Message.Contains("空文件", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Empty file skip was not logged.");
}
if (!finalLogs.Any(item => item.EventType == "file_ignored"
    && item.Message.Contains("临时/下载中", StringComparison.Ordinal)
    && item.MetadataJson.Contains("office_lock_file", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Office lock file skip was not logged with a specific reason.");
}
if (!finalLogs.Any(item => item.EventType == "file_ignored"
    && item.Message.Contains("临时/下载中", StringComparison.Ordinal)
    && item.MetadataJson.Contains("temporary_extension", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Partial download file skip was not logged with a specific reason.");
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

  console.log('PASS: collector file snapshot regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
