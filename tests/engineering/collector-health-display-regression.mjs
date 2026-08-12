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

const workDir = mkdtempSync(join(tmpdir(), 'eiscore-health-display-'))
const project = join(workDir, 'CollectorHealthDisplaySmoke.csproj')
const healthModel = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs')
const displayPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorHealthDisplayPolicy.cs')
const mainWindowXaml = resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml')
const mainWindowCode = resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml.cs')

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
    <Compile Include="${healthModel}" Link="CollectorHealthSnapshot.cs" />
    <Compile Include="${displayPolicy}" Link="CollectorHealthDisplayPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var display = CollectorHealthDisplayPolicy.Build(new CollectorHealthSnapshot
{
    GeneratedAt = DateTimeOffset.Parse("2026-06-24T10:20:30+08:00"),
    DeviceStatus = "active",
    WatchFolderCount = 3,
    EnabledWatchFolderCount = 2,
    AccessibleWatchFolderCount = 1,
    MissingWatchFolderCount = 1,
    InaccessibleWatchFolderCount = 0,
    PendingUploadCount = 4,
    UploadingCount = 1,
    FailedUploadCount = 2,
    CompletedUploadCount = 9,
    PendingLogCount = 5,
    PendingCrashDumpReportCount = 1,
    UploadConnectivityStatus = "offline",
    CollectorDatabaseBytes = 1536,
    DataDriveAvailableFreeBytes = 5L * 1024 * 1024 * 1024
});

Expect("10:20:30", display.GeneratedAt, "generated time");
Expect("active", display.DeviceStatus, "device status");
Expect("启用 2/3，可访问 1，异常 1", display.WatchFolders, "watch folder summary");
Expect("待传 4，上传中 1，失败 2，已完成 9", display.UploadQueue, "queue summary");
Expect("待上传日志 5，崩溃报告 1", display.Logs, "log summary");
Expect("离线", display.Connectivity, "connectivity");
Expect("数据库 1.5 KB，可用空间 5 GB", display.Storage, "storage summary");

var unbound = CollectorHealthDisplayPolicy.Build(new CollectorHealthSnapshot());
Expect("未绑定", unbound.DeviceStatus, "blank device status should be readable");
Expect("未知", unbound.Connectivity, "blank connectivity should be unknown");
Expect("数据库 未知，可用空间 未知", unbound.Storage, "unknown storage should be readable");

static void Expect(string expected, string actual, string message)
{
    if (!string.Equals(expected, actual, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
    }
}
`)

try {
  const xaml = readFileSync(mainWindowXaml, 'utf8')
  const code = readFileSync(mainWindowCode, 'utf8')

  for (const name of [
    'HealthGeneratedAtText',
    'HealthDeviceStatusText',
    'HealthWatchFoldersText',
    'HealthUploadQueueText',
    'HealthLogsText',
    'HealthConnectivityText',
    'HealthStorageText'
  ]) {
    assertIncludes(xaml, name, `Settings health overview is missing ${name}.`)
    assertIncludes(code, name, `Health refresh code is missing ${name}.`)
  }

  assertIncludes(code, '_ = RefreshHealthSnapshotUiAsync();', 'Settings or watch-folder actions should refresh health UI.')
  assertIncludes(code, 'await RefreshHealthSnapshotUiAsync();', 'Queue or heartbeat paths should refresh health UI.')
  assertIncludes(code, 'collector_health_ui_refresh_failed', 'Health UI refresh failures should be logged.')

  const result = spawnSync(dotnet, ['run', '--project', project], {
    cwd: repoRoot,
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector health display regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}
