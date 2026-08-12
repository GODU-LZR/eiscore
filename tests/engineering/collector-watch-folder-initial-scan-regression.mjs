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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-watch-folder-initial-scan-'))
const dataDir = join(workDir, 'collector-data')
const watchDir = join(workDir, 'incoming')
const inaccessibleWatchDir = join(workDir, 'inaccessible')

const project = join(workDir, 'CollectorWatchFolderInitialScanSmoke.csproj')
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
  'collector-desktop/EISCore.Collector/Services/CollectorBackgroundTask.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorAllowedExtensionsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAccessPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileIgnorePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorRemoteUpdatePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateInstallerArgumentsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateUrlPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUploadOwnershipPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/ConfigurationService.cs',
  'collector-desktop/EISCore.Collector/Services/DeviceTokenProtector.cs',
  'collector-desktop/EISCore.Collector/Services/FileHashService.cs',
  'collector-desktop/EISCore.Collector/Services/FileStabilityService.cs',
  'collector-desktop/EISCore.Collector/Services/MimeTypeService.cs',
  'collector-desktop/EISCore.Collector/Services/UploadQueueStore.cs',
  'collector-desktop/EISCore.Collector/Services/WatchFolderHealthPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/WatchFolderService.cs'
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
using System.Reflection;
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
var watchDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_TEST_WATCH_DIR");
var inaccessibleWatchDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_TEST_INACCESSIBLE_WATCH_DIR");
if (string.IsNullOrWhiteSpace(dataDir) || string.IsNullOrWhiteSpace(watchDir) || string.IsNullOrWhiteSpace(inaccessibleWatchDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR, EISCORE_COLLECTOR_TEST_WATCH_DIR and EISCORE_COLLECTOR_TEST_INACCESSIBLE_WATCH_DIR are required.");
}

Directory.CreateDirectory(dataDir);
Directory.CreateDirectory(watchDir);
Directory.CreateDirectory(inaccessibleWatchDir);
var nestedWatchDir = Path.Combine(watchDir, "supplier-a");
Directory.CreateDirectory(nestedWatchDir);
var existingFilePath = Path.Combine(watchDir, "already-in-folder.pdf");
var existingNestedFilePath = Path.Combine(nestedWatchDir, "already-in-subfolder.pdf");
await File.WriteAllTextAsync(existingFilePath, "existing content before watcher starts");
await File.WriteAllTextAsync(existingNestedFilePath, "nested content before watcher starts");

var queueStore = new UploadQueueStore();
var logStore = new ClientLogStore();
await queueStore.EnsureCreatedAsync();
await logStore.EnsureCreatedAsync();

var logService = new ClientLogService(logStore);
var stabilityProbeCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
var fileService = new CollectorFileService(
    queueStore,
    logService,
    FileHashService.ComputeSha256Async,
    async (path, stableFor, timeout, cancellationToken) =>
    {
        if (string.Equals(Path.GetFileName(path), "eventually-stable.pdf", StringComparison.OrdinalIgnoreCase))
        {
            stabilityProbeCounts.TryGetValue(path, out var count);
            stabilityProbeCounts[path] = count + 1;
            if (count == 0)
            {
                return false;
            }
        }

        return await FileStabilityService.WaitUntilStableAsync(path, stableFor, timeout, cancellationToken);
    });
var config = new AppConfig
{
    DeviceId = "device-1",
    DeviceStatus = "active",
    DefaultUserId = "device-user",
    DefaultUsername = "operator",
    DefaultRole = "device-role",
    AllowedExtensions = new List<string> { ".pdf" },
    WatchFolders = new List<WatchFolderConfig>
    {
        new()
        {
            FolderPath = inaccessibleWatchDir,
            FolderName = "Blocked",
            DefaultUserId = "blocked-user",
            DefaultRole = "blocked-role",
            Enabled = true
        },
        new()
        {
            FolderPath = watchDir,
            FolderName = "Incoming",
            DefaultUserId = "folder-user",
            DefaultUsername = "folder-operator",
            DefaultRole = "folder-role",
            Enabled = true
        },
        new()
        {
            FolderPath = watchDir + Path.DirectorySeparatorChar,
            FolderName = "IncomingDuplicate",
            DefaultUserId = "duplicate-user",
            DefaultRole = "duplicate-role",
            Enabled = true
        }
    }
};

using var watcher = new WatchFolderService(
    fileService,
    logService,
    () => config,
    directoryAccessible: path => !string.Equals(path, inaccessibleWatchDir, StringComparison.Ordinal),
    retryDelay: _ => Task.CompletedTask);
watcher.Restart(config);

UploadQueueItem? queued = null;
for (var attempt = 0; attempt < 40; attempt++)
{
    await Task.Delay(250);
    queued = (await queueStore.ListRecentAsync(10)).FirstOrDefault(item => item.OriginalFilename == "already-in-folder.pdf");
    if (queued is not null) break;
}

if (queued is null)
{
    throw new InvalidOperationException("Existing file was not queued during watch folder initial scan.");
}
if (queued.UploadSource != "watch_folder")
{
    throw new InvalidOperationException($"Expected watch_folder upload source, got {queued.UploadSource}.");
}
if (queued.SourceFolder != watchDir)
{
    throw new InvalidOperationException($"Expected source folder {watchDir}, got {queued.SourceFolder}.");
}
if (queued.UploadedByUserId != "folder-user"
    || queued.UploadedByUsername != "folder-operator"
    || queued.UploadedByRole != "folder-role")
{
    throw new InvalidOperationException("Initial scan did not apply watch folder ownership.");
}
if (queued.OperatorSource != "folder_binding_user")
{
    throw new InvalidOperationException($"Expected folder_binding_user operator source, got {queued.OperatorSource}.");
}

var logs = await logStore.ListPendingAsync(50);
if (!logs.Any(item => item.EventType == "file_watch_initial_scan"))
{
    throw new InvalidOperationException("Initial scan did not write a file_watch_initial_scan log.");
}
if (logs.Count(item => item.EventType == "file_watch_started" && item.Message.Contains(watchDir, StringComparison.Ordinal)) != 1)
{
    throw new InvalidOperationException("Duplicate watch folder paths should only start one watcher.");
}
if (logs.Count(item => item.EventType == "file_watch_initial_scan" && item.Message.Contains(watchDir, StringComparison.Ordinal)) != 1)
{
    throw new InvalidOperationException("Duplicate watch folder paths should only run one initial scan.");
}
if (!logs.Any(item => item.EventType == "file_watch_error"
    && item.Message.Contains("不可访问", StringComparison.Ordinal)
    && item.Message.Contains(inaccessibleWatchDir, StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Inaccessible watch folder was not logged and skipped before normal folder startup.");
}
if (!logs.Any(item => item.EventType == "file_queued" && item.Message.Contains("already-in-folder.pdf", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Initial scan queued file was not logged.");
}

var nestedQueued = await WaitForQueueItemAsync(
    queueStore,
    item => item.OriginalFilename == "already-in-subfolder.pdf",
    "Existing nested file was not queued during recursive initial scan.");
if (nestedQueued.SourceFolder != watchDir || nestedQueued.OperatorSource != "folder_binding_user")
{
    throw new InvalidOperationException("Recursive initial scan did not preserve root watch folder context.");
}

var initialHash = queued.FileHash;
await Task.Delay(2500);
await File.WriteAllTextAsync(existingFilePath, "changed content after watcher starts");

var changed = await WaitForQueueItemAsync(
    queueStore,
    item => item.OriginalFilename == "already-in-folder.pdf" && item.FileHash != initialHash,
    "Changed watch event did not queue the modified file content.");
if (changed.UploadSource != "watch_folder")
{
    throw new InvalidOperationException($"Expected changed file to keep watch_folder source, got {changed.UploadSource}.");
}

var nestedCreatedAfterStartPath = Path.Combine(nestedWatchDir, "created-after-start.pdf");
await File.WriteAllTextAsync(nestedCreatedAfterStartPath, "nested content created after watcher starts");

var nestedCreated = await WaitForQueueItemAsync(
    queueStore,
    item => item.OriginalFilename == "created-after-start.pdf",
    "Recursive watcher event did not queue a file created in a subfolder.");
if (nestedCreated.SourceFolder != watchDir || nestedCreated.OperatorSource != "folder_binding_user")
{
    throw new InvalidOperationException("Recursive watcher event did not preserve root watch folder context.");
}

watcher.Stop();
var recoveryFilePath = Path.Combine(watchDir, "recovery-after-error.pdf");
var nestedRecoveryFilePath = Path.Combine(nestedWatchDir, "recovery-nested-after-error.pdf");
await File.WriteAllTextAsync(recoveryFilePath, "content present when watcher error recovery scan runs");
await File.WriteAllTextAsync(nestedRecoveryFilePath, "nested content present when watcher error recovery scan runs");

var errorHandler = typeof(WatchFolderService).GetMethod(
    "Watcher_Error",
    BindingFlags.Instance | BindingFlags.NonPublic);
if (errorHandler is null)
{
    throw new InvalidOperationException("Could not find WatchFolderService.Watcher_Error for recovery smoke.");
}
using (var recoverySender = new FileSystemWatcher(watchDir))
{
    errorHandler.Invoke(
        watcher,
        new object[] { recoverySender, new ErrorEventArgs(new InternalBufferOverflowException("simulated overflow")) });
}

var recovered = await WaitForQueueItemAsync(
    queueStore,
    item => item.OriginalFilename == "recovery-after-error.pdf",
    "Watcher error recovery scan did not queue the file that was present on disk.");
if (recovered.SourceFolder != watchDir || recovered.OperatorSource != "folder_binding_user")
{
    throw new InvalidOperationException("Recovery scan did not preserve watch folder context.");
}

var nestedRecovered = await WaitForQueueItemAsync(
    queueStore,
    item => item.OriginalFilename == "recovery-nested-after-error.pdf",
    "Recursive watcher error recovery scan did not queue the nested file that was present on disk.");
if (nestedRecovered.SourceFolder != watchDir || nestedRecovered.OperatorSource != "folder_binding_user")
{
    throw new InvalidOperationException("Recursive recovery scan did not preserve root watch folder context.");
}

logs = await logStore.ListPendingAsync(100);
if (!logs.Any(item => item.EventType == "file_watch_recovery_scan"))
{
    throw new InvalidOperationException("Watcher error recovery scan was not logged.");
}

var queuePath = typeof(WatchFolderService).GetMethod(
    "QueuePath",
    BindingFlags.Instance | BindingFlags.NonPublic,
    null,
    new[] { typeof(string), typeof(string) },
    null);
if (queuePath is null)
{
    throw new InvalidOperationException("Could not find WatchFolderService.QueuePath for disabled folder smoke.");
}

config.WatchFolders = new List<WatchFolderConfig>
{
    new()
    {
        FolderPath = watchDir,
        FolderName = "Incoming",
        DefaultUserId = "folder-user",
        DefaultUsername = "folder-operator",
        DefaultRole = "folder-role",
        Enabled = true
    }
};
var eventuallyStablePath = Path.Combine(watchDir, "eventually-stable.pdf");
await File.WriteAllTextAsync(eventuallyStablePath, "content that stabilizes on retry");
queuePath.Invoke(watcher, new object[] { eventuallyStablePath, watchDir });

var eventuallyStable = await WaitForQueueItemAsync(
    queueStore,
    item => item.OriginalFilename == "eventually-stable.pdf",
    "Recoverable unstable watch file was not queued after scheduled retry.");
if (eventuallyStable.SourceFolder != watchDir || eventuallyStable.OperatorSource != "folder_binding_user")
{
    throw new InvalidOperationException("Recoverable unstable watch file retry did not preserve root watch folder context.");
}
if (!stabilityProbeCounts.TryGetValue(eventuallyStablePath, out var unstableProbeCount) || unstableProbeCount < 2)
{
    throw new InvalidOperationException("Recoverable unstable watch file was not retried through stability probing.");
}

logs = await logStore.ListPendingAsync(120);
if (!logs.Any(item => item.EventType == "file_watch_retry_scheduled"
    && item.Message.Contains("eventually-stable.pdf", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Recoverable unstable watch file retry was not logged.");
}

var importedFolderPath = Path.Combine(watchDir, "imported-batch");
Directory.CreateDirectory(importedFolderPath);
var importedFolderFilePath = Path.Combine(importedFolderPath, "inside-imported-folder.pdf");
await File.WriteAllTextAsync(importedFolderFilePath, "content that arrived with an imported folder");
queuePath.Invoke(watcher, new object[] { importedFolderPath, watchDir });

var importedFolderFile = await WaitForQueueItemAsync(
    queueStore,
    item => item.OriginalFilename == "inside-imported-folder.pdf",
    "Directory watch event did not recursively queue files inside the new folder.");
if (importedFolderFile.SourceFolder != watchDir || importedFolderFile.OperatorSource != "folder_binding_user")
{
    throw new InvalidOperationException("Directory watch event scan did not preserve root watch folder context.");
}

logs = await logStore.ListPendingAsync(120);
if (!logs.Any(item => item.EventType == "file_watch_directory_scan"
    && item.Message.Contains("imported-batch", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Directory watch event scan was not logged.");
}

var stoppedAfterScheduledPath = Path.Combine(watchDir, "stopped-after-scheduled.pdf");
await File.WriteAllTextAsync(stoppedAfterScheduledPath, "content scheduled before watcher stops");
queuePath.Invoke(watcher, new object[] { stoppedAfterScheduledPath, watchDir });
watcher.Stop();
await Task.Delay(3500);

var stoppedRows = await queueStore.ListRecentAsync(50);
if (stoppedRows.Any(item => item.OriginalFilename == "stopped-after-scheduled.pdf"))
{
    throw new InvalidOperationException("Delayed watch task queued a file after the watcher was stopped.");
}

var disabledAfterScheduledPath = Path.Combine(watchDir, "disabled-after-scheduled.pdf");
await File.WriteAllTextAsync(disabledAfterScheduledPath, "content scheduled before folder is disabled");
queuePath.Invoke(watcher, new object[] { disabledAfterScheduledPath, watchDir });
config.WatchFolders = new List<WatchFolderConfig>();
await Task.Delay(3500);

var staleRows = await queueStore.ListRecentAsync(50);
if (staleRows.Any(item => item.OriginalFilename == "disabled-after-scheduled.pdf"))
{
    throw new InvalidOperationException("Delayed watch task queued a file after the source watch folder was disabled.");
}

logs = await logStore.ListPendingAsync(100);
if (!logs.Any(item => item.EventType == "file_watch_ignored" && item.Message.Contains("disabled-after-scheduled.pdf", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Disabled watch folder delayed task was not logged as ignored.");
}

static async Task<UploadQueueItem> WaitForQueueItemAsync(
    UploadQueueStore store,
    Func<UploadQueueItem, bool> predicate,
    string failureMessage)
{
    for (var attempt = 0; attempt < 60; attempt++)
    {
        await Task.Delay(250);
        var item = (await store.ListRecentAsync(20)).FirstOrDefault(predicate);
        if (item is not null) return item;
    }

    throw new InvalidOperationException(failureMessage);
}
`)

try {
  const result = spawnSync(dotnet, ['run', '--project', project], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      EISCORE_COLLECTOR_DATA_DIR: dataDir,
      EISCORE_COLLECTOR_TEST_WATCH_DIR: watchDir,
      EISCORE_COLLECTOR_TEST_INACCESSIBLE_WATCH_DIR: inaccessibleWatchDir
    }
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector watch folder initial scan regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
