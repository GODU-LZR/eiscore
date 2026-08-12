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

const workDir = mkdtempSync(join(tmpdir(), 'eiscore-heartbeat-health-'))
const dataDir = join(workDir, 'collector-data')
const existingWatchFolder = join(workDir, 'watch-existing')
const missingWatchFolder = join(workDir, 'watch-missing')
const inaccessibleWatchFolder = join(workDir, 'watch-inaccessible')
const disabledWatchFolder = join(workDir, 'watch-disabled')
mkdirSync(existingWatchFolder, { recursive: true })
mkdirSync(inaccessibleWatchFolder, { recursive: true })
mkdirSync(disabledWatchFolder, { recursive: true })

const requests = []
const serverErrors = []

const server = createServer(async (req, res) => {
  try {
    const body = await readBody(req)
    const payload = JSON.parse(body.toString('utf8'))
    requests.push(payload)

    assert.equal(req.url, '/agent/document-intake/devices/heartbeat')
    assert.equal(req.method, 'POST')
    assert.equal(req.headers.authorization, 'Bearer device-token')
    assert.equal(payload.client_version, '0.2.0')
    assert.equal(payload.webview_version, 'WebView2/123.0')
    assert.equal(payload.health.deviceStatus, 'active')
    assert.equal(payload.health.autoStartEnabled, true)
    assert.equal(payload.health.watchFolderCount, 4)
    assert.equal(payload.health.enabledWatchFolderCount, 3)
    assert.equal(payload.health.disabledWatchFolderCount, 1)
    assert.equal(payload.health.missingWatchFolderCount, 1)
    assert.equal(payload.health.accessibleWatchFolderCount, 1)
    assert.equal(payload.health.inaccessibleWatchFolderCount, 1)
    assert.equal(payload.health.watchFolderStatuses.length, 4)
    const watchFolderStatuses = Object.fromEntries(payload.health.watchFolderStatuses.map((item) => [item.folderName, item]))
    assert.equal(watchFolderStatuses.existing.folderPath, existingWatchFolder)
    assert.equal(watchFolderStatuses.existing.status, 'accessible')
    assert.equal(watchFolderStatuses.existing.enabled, true)
    assert.equal(watchFolderStatuses.missing.folderPath, missingWatchFolder)
    assert.equal(watchFolderStatuses.missing.status, 'missing')
    assert.equal(watchFolderStatuses.missing.reason, 'directory_not_found')
    assert.equal(watchFolderStatuses.inaccessible.folderPath, inaccessibleWatchFolder)
    assert.equal(watchFolderStatuses.inaccessible.status, 'inaccessible')
    assert.equal(watchFolderStatuses.inaccessible.reason, 'directory_access_denied')
    assert.equal(watchFolderStatuses.disabled.folderPath, disabledWatchFolder)
    assert.equal(watchFolderStatuses.disabled.status, 'disabled')
    assert.equal(watchFolderStatuses.disabled.enabled, false)
    assert.equal(payload.health.totalUploadQueueCount, 9)
    assert.equal(payload.health.pendingUploadCount, 2)
    assert.equal(payload.health.missingLocalUploadFileCount, 1)
    assert.equal(payload.health.oldestMissingLocalUploadFileCreatedAt, '2026-06-23T09:02:20+00:00')
    assert.equal(payload.health.failedUploadCount, 3)
    assert.equal(payload.health.failedRetryReadyCount, 1)
    assert.equal(payload.health.failedRetryWaitingCount, 1)
    assert.equal(payload.health.failedRetryExhaustedCount, 1)
    assert.equal(typeof payload.health.nextFailedRetryAt, 'string')
    assert.equal(payload.health.failedUploadErrorSummaryTruncated, false)
    assert.equal(payload.health.failedUploadErrorSummaries.length, 2)
    assert.equal(payload.health.failedUploadErrorSummaries[0].error, 'network unavailable')
    assert.equal(payload.health.failedUploadErrorSummaries[0].count, 2)
    assert.equal(payload.health.failedUploadErrorSummaries[0].oldestCreatedAt, '2026-06-23T09:02:00+00:00')
    assert.equal(payload.health.failedUploadErrorSummaries[0].latestCreatedAt, '2026-06-23T09:02:10+00:00')
    assert.equal(payload.health.failedUploadErrorSummaries[1].error, 'max retry reached')
    assert.equal(payload.health.failedUploadErrorSummaries[1].count, 1)
    assert.equal(payload.health.failedUploadErrorSummaries[1].oldestCreatedAt, '2026-06-23T09:02:20+00:00')
    assert.equal(payload.health.failedUploadErrorSummaries[1].latestCreatedAt, '2026-06-23T09:02:20+00:00')
    assert.equal(payload.health.uploadingCount, 1)
    assert.equal(payload.health.completedUploadCount, 3)
    assert.equal(payload.health.pendingLogCount, 1)
    assert.equal(typeof payload.health.lastLogCreatedAt, 'string')
    assert.equal(payload.health.oldestPendingLogCreatedAt, '2026-06-23T08:50:00+00:00')
    assert.equal(typeof payload.health.lastUploadedLogCreatedAt, 'string')
    assert.equal(payload.health.pendingCrashDumpReportCount, 2)
    assert.equal(payload.health.reportedCrashDumpReportCount, 1)
    assert.equal(payload.health.oldestPendingCrashDumpReportCreatedAt, '2026-06-23T09:07:00+00:00')
    assert.equal(payload.health.lastCrashDumpReportCreatedAt, '2026-06-23T09:16:00+00:00')
    assert.equal(typeof payload.health.crashDumpDirectoryBytes, 'number')
    assert.ok(payload.health.crashDumpDirectoryBytes > 0)
    assert.equal(payload.health.temporaryFileIgnoredLast24HoursCount, 2)
    assert.equal(typeof payload.health.temporaryFileIgnoredSince, 'string')
    assert.equal(payload.health.uploadConnectivityStatus, 'offline')
    assert.equal(payload.health.lastUploadConnectivityOfflineAt, '2026-06-23T09:12:00+00:00')
    assert.equal(payload.health.lastUploadConnectivityOnlineAt, '2026-06-23T09:10:00+00:00')
    assert.equal(payload.health.uploadQueueByStatus.queued, 1)
    assert.equal(payload.health.uploadQueueByStatus.pending, 1)
    assert.equal(payload.health.uploadQueueByStatus.failed, 3)
    assert.equal(payload.health.uploadQueueByStatus.uploading, 1)
    assert.equal(payload.health.uploadQueueByStatus.uploaded, 1)
    assert.equal(payload.health.uploadQueueByStatus.duplicate, 1)
    assert.equal(payload.health.uploadQueueByStatus.ignored, 1)
    assert.equal(payload.health.lastQueuedAt, '2026-06-23T09:06:00+00:00')
    assert.equal(payload.health.lastUploadedAt, '2026-06-23T09:10:00+00:00')
    assert.equal(payload.health.oldestPendingUploadCreatedAt, '2026-06-23T09:00:00+00:00')
    assert.equal(typeof payload.health.collectorDatabaseBytes, 'number')
    assert.ok(payload.health.collectorDatabaseBytes > 0)
    assert.equal(typeof payload.health.dataDriveAvailableFreeBytes, 'number')
    assert.equal(typeof payload.health.dataDriveTotalBytes, 'number')
    assert.ok(payload.health.dataDriveAvailableFreeBytes > 0)
    assert.ok(payload.health.dataDriveTotalBytes >= payload.health.dataDriveAvailableFreeBytes)

    sendJson(res, 200, {
      ok: true,
      serverTime: '2026-06-23T00:00:00.000Z',
      configVersion: 'default',
      device: {
        deviceId: 'device-1',
        deviceCode: 'collector-1',
        deviceName: 'Collector 1',
        defaultUserId: 'user-1',
        defaultUsername: 'operator',
        defaultRole: 'warehouse',
        status: 'active'
      },
      config: {}
    })
  } catch (error) {
    serverErrors.push(error)
    sendJson(res, 500, { code: 'STUB_ASSERTION_FAILED', message: error.message })
  }
})
server.keepAliveTimeout = 1000
server.requestTimeout = 30000

const project = join(workDir, 'CollectorHeartbeatHealthSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorHealthSnapshotService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/CrashDumpService.cs',
  'collector-desktop/EISCore.Collector/Services/WatchFolderHealthPolicy.cs',
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
using System.Text.Json;

if (args.Length != 5)
{
    throw new InvalidOperationException("Expected server URL and four watch folder paths.");
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

var createdAtByStatus = new Dictionary<string, DateTimeOffset>
{
    [UploadQueueStatus.Queued] = DateTimeOffset.Parse("2026-06-23T09:00:00.0000000+00:00"),
    [UploadQueueStatus.Pending] = DateTimeOffset.Parse("2026-06-23T09:01:00.0000000+00:00"),
    [UploadQueueStatus.Failed] = DateTimeOffset.Parse("2026-06-23T09:02:00.0000000+00:00"),
    [UploadQueueStatus.Uploading] = DateTimeOffset.Parse("2026-06-23T09:03:00.0000000+00:00"),
    [UploadQueueStatus.Uploaded] = DateTimeOffset.Parse("2026-06-23T09:04:00.0000000+00:00"),
    [UploadQueueStatus.Duplicate] = DateTimeOffset.Parse("2026-06-23T09:05:00.0000000+00:00"),
    [UploadQueueStatus.Ignored] = DateTimeOffset.Parse("2026-06-23T09:06:00.0000000+00:00")
};
var uploadedAtByStatus = new Dictionary<string, DateTimeOffset>
{
    [UploadQueueStatus.Uploaded] = DateTimeOffset.Parse("2026-06-23T09:09:00.0000000+00:00"),
    [UploadQueueStatus.Duplicate] = DateTimeOffset.Parse("2026-06-23T09:10:00.0000000+00:00")
};

foreach (var status in new[]
{
    UploadQueueStatus.Queued,
    UploadQueueStatus.Pending,
    UploadQueueStatus.Failed,
    UploadQueueStatus.Uploading,
    UploadQueueStatus.Uploaded,
    UploadQueueStatus.Duplicate,
    UploadQueueStatus.Ignored
})
{
    await queueStore.InsertAsync(new UploadQueueItem
    {
        FilePath = Path.Combine(dataDir, $"{status}.pdf"),
        OriginalFilename = $"{status}.pdf",
        FileHash = $"hash-{status}",
        FileSize = 12,
        MimeType = "application/pdf",
        UploadSource = "watch_folder",
        Status = status,
        LastError = status == UploadQueueStatus.Failed ? " network\nunavailable\t" : "",
        CreatedAt = createdAtByStatus[status],
        UploadedAt = uploadedAtByStatus.TryGetValue(status, out var uploadedAt) ? uploadedAt : null,
        ServerAssetId = status is UploadQueueStatus.Uploaded or UploadQueueStatus.Duplicate
            ? $"asset-{status}"
            : ""
    });
}

await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = Path.Combine(dataDir, "failed-waiting.pdf"),
    OriginalFilename = "failed-waiting.pdf",
    FileHash = "hash-failed-waiting",
    FileSize = 12,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Failed,
    RetryCount = 1,
    LastError = "network unavailable",
    NextRetryAt = DateTimeOffset.Now.AddMinutes(10),
    CreatedAt = DateTimeOffset.Parse("2026-06-23T09:02:10.0000000+00:00")
});
await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = Path.Combine(dataDir, "failed-exhausted.pdf"),
    OriginalFilename = "failed-exhausted.pdf",
    FileHash = "hash-failed-exhausted",
    FileSize = 12,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Failed,
    RetryCount = 3,
    LastError = "max retry reached",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T09:02:20.0000000+00:00")
});

var pendingLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "info",
    EventType = "pending_log",
    Message = "pending log",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T08:50:00.0000000+00:00")
});
var uploadedLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "info",
    EventType = "uploaded_log",
    Message = "uploaded log",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T09:15:00.0000000+00:00")
});
var recentOfficeLockCreatedAt = DateTimeOffset.Now.AddMinutes(-20);
var recentPartialDownloadCreatedAt = DateTimeOffset.Now.AddMinutes(-10);
var officeLockLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "info",
    EventType = "file_ignored",
    Message = "临时/下载中文件暂不入队：~$purchase.xlsx",
    CreatedAt = recentOfficeLockCreatedAt,
    MetadataJson = """{"ignore_reason":"office_lock_file","upload_source":"watch_folder"}"""
});
var partialDownloadLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "info",
    EventType = "file_ignored",
    Message = "临时/下载中文件暂不入队：incoming.pdf.crdownload",
    CreatedAt = recentPartialDownloadCreatedAt,
    MetadataJson = """{"ignore_reason":"temporary_extension","upload_source":"watch_folder"}"""
});
var nonTemporaryIgnoredLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "warn",
    EventType = "file_ignored",
    Message = "文件类型未在远程配置允许范围内：notes.exe",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T09:03:00.0000000+00:00"),
    MetadataJson = """{"extension":".exe"}"""
});
var oldTemporaryLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "info",
    EventType = "file_ignored",
    Message = "临时/下载中文件暂不入队：old.pdf.part",
    CreatedAt = DateTimeOffset.Parse("2026-06-22T09:00:00.0000000+00:00"),
    MetadataJson = """{"ignore_reason":"temporary_extension","upload_source":"watch_folder"}"""
});
var oldOfflineLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "warn",
    EventType = "upload_connectivity_offline",
    Message = "上传通道疑似离线，将按队列退避策略重试。",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T09:00:00.0000000+00:00")
});
var onlineLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "info",
    EventType = "upload_connectivity_online",
    Message = "上传通道已恢复，队列上传继续执行。",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T09:10:00.0000000+00:00")
});
var latestOfflineLogId = await logStore.InsertAsync(new ClientLogEvent
{
    Level = "warn",
    EventType = "upload_connectivity_offline",
    Message = "上传通道疑似离线，将按队列退避策略重试。",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T09:12:00.0000000+00:00")
});
await logStore.MarkUploadedAsync(new[]
{
    uploadedLogId,
    officeLockLogId,
    partialDownloadLogId,
    nonTemporaryIgnoredLogId,
    oldTemporaryLogId,
    oldOfflineLogId,
    onlineLogId,
    latestOfflineLogId
});
if (pendingLogId <= 0)
{
    throw new InvalidOperationException("Expected pending log row to be inserted.");
}

var crashDir = AppPaths.CrashDumpDirectory;
CreateCrashReport(crashDir, "pending-old", DateTimeOffset.Parse("2026-06-23T09:07:00.0000000+00:00"), reported: false);
CreateCrashReport(crashDir, "pending-new", DateTimeOffset.Parse("2026-06-23T09:08:00.0000000+00:00"), reported: false);
CreateCrashReport(crashDir, "reported-latest", DateTimeOffset.Parse("2026-06-23T09:16:00.0000000+00:00"), reported: true);
File.WriteAllText(Path.Combine(crashDir, "orphan.dmp"), "orphan");

var config = new AppConfig
{
    ServerBaseUrl = args[0],
    DeviceId = "device-1",
    DeviceCode = "collector-1",
    DeviceName = "Collector 1",
    DeviceStatus = "active",
    ClientVersion = "0.2.0",
    WebViewVersion = "WebView2/123.0",
    AutoStartEnabled = true,
    UploadMaxRetryCount = 3,
    WatchFolders = new List<WatchFolderConfig>
    {
        new() { FolderPath = args[1], FolderName = "existing", Enabled = true },
        new() { FolderPath = args[2], FolderName = "missing", Enabled = true },
        new() { FolderPath = args[3], FolderName = "inaccessible", Enabled = true },
        new() { FolderPath = args[4], FolderName = "disabled", Enabled = false }
    }
};

var health = await new CollectorHealthSnapshotService(
    queueStore,
    logStore,
    watchFolderAccessible: path => !string.Equals(path, args[3], StringComparison.Ordinal),
    uploadFileExists: path => !path.EndsWith("failed-exhausted.pdf", StringComparison.Ordinal)).BuildAsync(config);
if (health.TotalUploadQueueCount != 9
    || health.PendingUploadCount != 2
    || health.MissingLocalUploadFileCount != 1
    || health.OldestMissingLocalUploadFileCreatedAt != DateTimeOffset.Parse("2026-06-23T09:02:20.0000000+00:00")
    || health.FailedUploadCount != 3
    || health.FailedRetryReadyCount != 1
    || health.FailedRetryWaitingCount != 1
    || health.FailedRetryExhaustedCount != 1
    || health.NextFailedRetryAt is null
    || health.FailedUploadErrorSummaryTruncated
    || health.FailedUploadErrorSummaries.Count != 2
    || health.FailedUploadErrorSummaries[0].Error != "network unavailable"
    || health.FailedUploadErrorSummaries[0].Count != 2
    || health.FailedUploadErrorSummaries[0].OldestCreatedAt != DateTimeOffset.Parse("2026-06-23T09:02:00.0000000+00:00")
    || health.FailedUploadErrorSummaries[0].LatestCreatedAt != DateTimeOffset.Parse("2026-06-23T09:02:10.0000000+00:00")
    || health.FailedUploadErrorSummaries[1].Error != "max retry reached"
    || health.FailedUploadErrorSummaries[1].Count != 1
    || health.FailedUploadErrorSummaries[1].OldestCreatedAt != DateTimeOffset.Parse("2026-06-23T09:02:20.0000000+00:00")
    || health.FailedUploadErrorSummaries[1].LatestCreatedAt != DateTimeOffset.Parse("2026-06-23T09:02:20.0000000+00:00")
    || health.PendingLogCount != 1
    || health.LastLogCreatedAt != recentPartialDownloadCreatedAt
    || health.OldestPendingLogCreatedAt != DateTimeOffset.Parse("2026-06-23T08:50:00.0000000+00:00")
    || health.LastUploadedLogCreatedAt != recentPartialDownloadCreatedAt
    || health.PendingCrashDumpReportCount != 2
    || health.ReportedCrashDumpReportCount != 1
    || health.OldestPendingCrashDumpReportCreatedAt != DateTimeOffset.Parse("2026-06-23T09:07:00.0000000+00:00")
    || health.LastCrashDumpReportCreatedAt != DateTimeOffset.Parse("2026-06-23T09:16:00.0000000+00:00")
    || health.CrashDumpDirectoryBytes is null or <= 0
    || health.TemporaryFileIgnoredLast24HoursCount != 2
    || health.TemporaryFileIgnoredSince is null
    || health.UploadConnectivityStatus != "offline"
    || health.LastUploadConnectivityOfflineAt != DateTimeOffset.Parse("2026-06-23T09:12:00.0000000+00:00")
    || health.LastUploadConnectivityOnlineAt != DateTimeOffset.Parse("2026-06-23T09:10:00.0000000+00:00")
    || health.MissingWatchFolderCount != 1
    || health.AccessibleWatchFolderCount != 1
    || health.InaccessibleWatchFolderCount != 1
    || health.WatchFolderStatuses.Count != 4
    || health.WatchFolderStatuses[0].Status != "accessible"
    || health.WatchFolderStatuses[0].FolderName != "existing"
    || health.WatchFolderStatuses[1].Status != "missing"
    || health.WatchFolderStatuses[1].Reason != "directory_not_found"
    || health.WatchFolderStatuses[2].Status != "inaccessible"
    || health.WatchFolderStatuses[2].Reason != "directory_access_denied"
    || health.WatchFolderStatuses[3].Status != "disabled"
    || health.WatchFolderStatuses[3].Enabled
    || health.LastQueuedAt != DateTimeOffset.Parse("2026-06-23T09:06:00.0000000+00:00")
    || health.LastUploadedAt != DateTimeOffset.Parse("2026-06-23T09:10:00.0000000+00:00")
    || health.OldestPendingUploadCreatedAt != DateTimeOffset.Parse("2026-06-23T09:00:00.0000000+00:00")
    || health.CollectorDatabaseBytes is null or <= 0
    || health.DataDriveAvailableFreeBytes is null or <= 0
    || health.DataDriveTotalBytes is null or <= 0
    || health.DataDriveTotalBytes < health.DataDriveAvailableFreeBytes)
{
    throw new InvalidOperationException(
        "Collector health snapshot counts are incorrect before heartbeat upload: "
        + $"total={health.TotalUploadQueueCount}, pending={health.PendingUploadCount}, missingLocal={health.MissingLocalUploadFileCount}, "
        + $"failed={health.FailedUploadCount}, ready={health.FailedRetryReadyCount}, waiting={health.FailedRetryWaitingCount}, exhausted={health.FailedRetryExhaustedCount}, "
        + $"failedErrorSummaryCount={health.FailedUploadErrorSummaries.Count}, failedErrorSummaryTruncated={health.FailedUploadErrorSummaryTruncated}, "
        + $"nextFailedRetryAt={health.NextFailedRetryAt:O}, pendingLogs={health.PendingLogCount}, "
        + $"lastLog={health.LastLogCreatedAt:O}, oldestPendingLog={health.OldestPendingLogCreatedAt:O}, lastUploadedLog={health.LastUploadedLogCreatedAt:O}, "
        + $"pendingCrashDumps={health.PendingCrashDumpReportCount}, reportedCrashDumps={health.ReportedCrashDumpReportCount}, "
        + $"oldestPendingCrashDump={health.OldestPendingCrashDumpReportCreatedAt:O}, lastCrashDump={health.LastCrashDumpReportCreatedAt:O}, crashDumpBytes={health.CrashDumpDirectoryBytes}, "
        + $"tempIgnored={health.TemporaryFileIgnoredLast24HoursCount}, tempSince={health.TemporaryFileIgnoredSince:O}, "
        + $"connectivity={health.UploadConnectivityStatus}, offlineAt={health.LastUploadConnectivityOfflineAt:O}, onlineAt={health.LastUploadConnectivityOnlineAt:O}, "
        + $"watchMissing={health.MissingWatchFolderCount}, watchAccessible={health.AccessibleWatchFolderCount}, watchInaccessible={health.InaccessibleWatchFolderCount}, "
        + $"watchStatusCount={health.WatchFolderStatuses.Count}, "
        + $"oldestMissingLocal={health.OldestMissingLocalUploadFileCreatedAt:O}, lastQueued={health.LastQueuedAt:O}, lastUploaded={health.LastUploadedAt:O}, "
        + $"oldestPendingUpload={health.OldestPendingUploadCreatedAt:O}, dbBytes={health.CollectorDatabaseBytes}, freeBytes={health.DataDriveAvailableFreeBytes}, totalBytes={health.DataDriveTotalBytes}");
}

var client = new CollectorApiClient();
var heartbeat = await client.SendHeartbeatAsync(config, "device-token", health);
if (heartbeat is null || !heartbeat.Ok)
{
    throw new InvalidOperationException("Heartbeat did not return an ok response.");
}

static void CreateCrashReport(string crashDir, string name, DateTimeOffset createdAt, bool reported)
{
    var manifestPath = Path.Combine(crashDir, name + ".json");
    var dumpPath = Path.Combine(crashDir, name + ".dmp");
    File.WriteAllText(dumpPath, "dump");
    File.WriteAllText(manifestPath, JsonSerializer.Serialize(new
    {
        source = "test",
        createdAt,
        exceptionType = "System.Exception",
        message = "boom",
        stack = "System.Exception: boom",
        dumpPath,
        dumpBytes = 4
    }));

    if (reported)
    {
        File.WriteAllText(manifestPath + ".reported", createdAt.ToString("O"));
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
  const result = await runDotnet(['run', '--project', project, '--', baseUrl, existingWatchFolder, missingWatchFolder, inaccessibleWatchFolder, disabledWatchFolder])

  if (result.status !== 0 || result.timedOut) {
    console.error(result.stdout)
    console.error(result.stderr)
    if (result.timedOut) console.error('dotnet child process timed out')
    console.error(JSON.stringify(requests, null, 2))
    process.exit(result.status || 1)
  }

  if (serverErrors.length > 0) {
    console.error(serverErrors)
    process.exit(1)
  }

  assert.equal(requests.length, 1, 'heartbeat request should be sent once')
  console.log('PASS: collector heartbeat health regression')
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
