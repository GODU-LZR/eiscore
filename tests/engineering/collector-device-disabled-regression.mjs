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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-device-disabled-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorDeviceDisabledSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Models/UploadOwnerContext.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorAllowedExtensionsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAccessPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileIgnorePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorFileService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorLogUploadPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUploadOwnershipPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/FileHashService.cs',
  'collector-desktop/EISCore.Collector/Services/FileStabilityService.cs',
  'collector-desktop/EISCore.Collector/Services/LogUploadProcessor.cs',
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
var filePath = Path.Combine(dataDir, "disabled-device.pdf");
await File.WriteAllTextAsync(filePath, "disabled-device-content");

var queueStore = new UploadQueueStore();
var logStore = new ClientLogStore();
await queueStore.EnsureCreatedAsync();
await logStore.EnsureCreatedAsync();

var logService = new ClientLogService(logStore);
var fileService = new CollectorFileService(queueStore, logService);
var disabledConfig = new AppConfig
{
    DeviceId = "device-1",
    DeviceStatus = "disabled",
    DefaultUserId = "u-1",
    DefaultUsername = "operator",
    DefaultRole = "warehouse"
};

var disabledResult = await fileService.EnqueueFileAsync(filePath, "manual_drag_drop", disabledConfig);
if (disabledResult is not null)
{
    throw new InvalidOperationException("Disabled device should not enqueue files.");
}

var disabledRows = await queueStore.ListRecentAsync(10);
if (disabledRows.Count != 0)
{
    throw new InvalidOperationException($"Disabled device wrote {disabledRows.Count} queue rows.");
}

var enabledConfig = new AppConfig
{
    DeviceId = "device-1",
    DeviceStatus = "active",
    DefaultUserId = "u-1",
    DefaultUsername = "operator",
    DefaultRole = "warehouse"
};

var enabledResult = await fileService.EnqueueFileAsync(filePath, "manual_drag_drop", enabledConfig);
if (enabledResult is null || enabledResult.Status != UploadQueueStatus.Queued)
{
    throw new InvalidOperationException("Enabled device should enqueue the same file after status is active.");
}

var enabledRows = await queueStore.ListRecentAsync(10);
if (enabledRows.Count != 1 || enabledRows[0].FileHash != enabledResult.FileHash)
{
    throw new InvalidOperationException("Enabled queue row was not persisted correctly.");
}

var logs = await logStore.ListPendingAsync(20);
if (!logs.Any(item => item.EventType == "file_ignored" && item.Message.Contains("后台禁用", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("Disabled enqueue attempt was not logged.");
}

if (CollectorDeviceAccessPolicy.CanUploadFiles(disabledConfig)
    || CollectorDeviceAccessPolicy.CanUploadLogs(disabledConfig)
    || CollectorDeviceAccessPolicy.CanFetchRemoteConfig(disabledConfig))
{
    throw new InvalidOperationException("Disabled device should not be allowed to upload files, logs, or fetch remote config.");
}
if (!CollectorDeviceAccessPolicy.CanUploadFiles(enabledConfig)
    || !CollectorDeviceAccessPolicy.CanUploadLogs(enabledConfig)
    || !CollectorDeviceAccessPolicy.CanFetchRemoteConfig(enabledConfig))
{
    throw new InvalidOperationException("Active device should be allowed to upload files, logs, and fetch remote config.");
}

var pendingBeforeDisabledFlush = await logStore.ListPendingAsync(20);
var disabledLogProcessor = new LogUploadProcessor(
    logStore,
    new CollectorApiClient(),
    () => new AppConfig
    {
        DeviceId = "device-1",
        DeviceStatus = "disabled",
        ServerBaseUrl = "http://127.0.0.1:9",
        LogBatchSize = 20,
        LogRetentionDays = 30
    },
    () => "disabled-device-token");
await disabledLogProcessor.FlushAsync();
var pendingAfterDisabledFlush = await logStore.ListPendingAsync(20);
if (pendingAfterDisabledFlush.Count != pendingBeforeDisabledFlush.Count)
{
    throw new InvalidOperationException("Disabled device log flush should keep pending logs local and unuploaded.");
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

  console.log('PASS: collector device disabled regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
