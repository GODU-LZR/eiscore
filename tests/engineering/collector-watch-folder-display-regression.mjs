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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-watch-folder-display-'))

const project = join(workDir, 'CollectorWatchFolderDisplaySmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAccessPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorWatchFolderRestartPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/WatchFolderHealthPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/WatchFolderDisplayPolicy.cs'
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
${sources.map((source) => `    <Compile Include="${resolve(repoRoot, source)}" Link="${source.split('/').pop()}" />`).join('\n')}
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var existing = WatchFolderDisplayPolicy.Format(new WatchFolderConfig
{
    FolderPath = @"D:\EISCore\Inbox",
    FolderName = "仓库收单",
    DefaultUserId = "u_warehouse",
    DefaultUsername = "张三",
    DefaultRole = "仓库员",
    Enabled = true
}, 0, path => path == @"D:\EISCore\Inbox", _ => true);
ExpectContains(existing, "1. [启用] 仓库收单");
ExpectContains(existing, @"D:\EISCore\Inbox");
ExpectContains(existing, "默认：u_warehouse / 张三 / 仓库员");

var missing = WatchFolderDisplayPolicy.Format(new WatchFolderConfig
{
    FolderPath = @"Z:\Missing\Inbox",
    FolderName = "",
    DefaultUserId = "u_missing",
    Enabled = true
}, 1, _ => false);
ExpectContains(missing, "2. [缺失] Inbox");
ExpectContains(missing, @"Z:\Missing\Inbox");
ExpectContains(missing, "默认：u_missing");

var inaccessible = WatchFolderDisplayPolicy.Format(new WatchFolderConfig
{
    FolderPath = @"X:\Blocked\Inbox",
    FolderName = "权限异常目录",
    Enabled = true
}, 2, path => path == @"X:\Blocked\Inbox", _ => false);
ExpectContains(inaccessible, "3. [不可访问] 权限异常目录");
ExpectContains(inaccessible, @"X:\Blocked\Inbox");

var disabledMissing = WatchFolderDisplayPolicy.Format(new WatchFolderConfig
{
    FolderPath = @"Y:\Disabled",
    FolderName = "停用目录",
    Enabled = false
}, 3, _ => false);
ExpectContains(disabledMissing, "4. [停用] 停用目录");
if (disabledMissing.Contains("[缺失]", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Disabled missing folder should remain displayed as disabled.");
}

var emptyPath = WatchFolderDisplayPolicy.Format(new WatchFolderConfig
{
    FolderPath = "",
    Enabled = true
}, 4, _ => false);
ExpectContains(emptyPath, "5. [缺失] 未配置目录");
ExpectContains(emptyPath, "未配置路径");

ExpectRestartState(
    new AppConfig
    {
        DeviceStatus = "disabled",
        WatchFolders = new List<WatchFolderConfig>
        {
            new() { FolderPath = @"D:\EISCore\Inbox", Enabled = true }
        }
    },
    canStart: false,
    expectedMessage: "设备已被后台禁用，监听未启动。");
ExpectRestartState(
    new AppConfig
    {
        DeviceStatus = "pending",
        WatchFolders = new List<WatchFolderConfig>
        {
            new() { FolderPath = @"D:\EISCore\Inbox", Enabled = true }
        }
    },
    canStart: false,
    expectedMessage: "设备待绑定，请重新绑定后再启动监听。");
ExpectRestartState(
    new AppConfig
    {
        DeviceStatus = "active",
        WatchFolders = new List<WatchFolderConfig>
        {
            new() { FolderPath = @"D:\EISCore\Inbox", Enabled = false }
        }
    },
    canStart: false,
    expectedMessage: "没有启用的监听目录，请先添加或启用目录。");
ExpectRestartState(
    new AppConfig
    {
        DeviceStatus = "active",
        WatchFolders = new List<WatchFolderConfig>
        {
            new() { FolderPath = @"D:\EISCore\Inbox", Enabled = true }
        }
    },
    canStart: true,
    expectedMessage: "监听目录已重新启动。");

static void ExpectRestartState(AppConfig config, bool canStart, string expectedMessage)
{
    var state = CollectorWatchFolderRestartPolicy.Evaluate(config);
    if (state.CanStart != canStart || state.StatusMessage != expectedMessage)
    {
        throw new InvalidOperationException($"Unexpected restart state: {state.CanStart}/{state.StatusMessage}");
    }
}

static void ExpectContains(string text, string expected)
{
    if (!text.Contains(expected, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"Expected '{text}' to contain '{expected}'.");
    }
}
`)

try {
  const result = spawnSync(dotnet, ['run', '--project', project], {
    cwd: repoRoot,
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector watch folder display regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
