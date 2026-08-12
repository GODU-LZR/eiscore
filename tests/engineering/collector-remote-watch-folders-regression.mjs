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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-remote-watch-folders-'))
const project = join(workDir, 'CollectorRemoteWatchFoldersSmoke.csproj')
const appConfig = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/AppConfig.cs')
const bindingModels = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/BindingModels.cs')
const appPaths = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/AppPaths.cs')
const allowedExtensionsPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorAllowedExtensionsPolicy.cs')
const serverAddressPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs')
const remoteUpdatePolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorRemoteUpdatePolicy.cs')
const updateInstallerArgumentsPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorUpdateInstallerArgumentsPolicy.cs')
const updateUrlPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorUpdateUrlPolicy.cs')
const deviceTokenProtector = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/DeviceTokenProtector.cs')
const configurationService = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/ConfigurationService.cs')
const policy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorRemoteWatchFolderPolicy.cs')

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
    <PackageReference Include="System.Security.Cryptography.ProtectedData" Version="8.0.0" />
    <Compile Include="${appConfig}" Link="AppConfig.cs" />
    <Compile Include="${bindingModels}" Link="BindingModels.cs" />
    <Compile Include="${appPaths}" Link="AppPaths.cs" />
    <Compile Include="${allowedExtensionsPolicy}" Link="CollectorAllowedExtensionsPolicy.cs" />
    <Compile Include="${serverAddressPolicy}" Link="CollectorServerAddressPolicy.cs" />
    <Compile Include="${remoteUpdatePolicy}" Link="CollectorRemoteUpdatePolicy.cs" />
    <Compile Include="${updateInstallerArgumentsPolicy}" Link="CollectorUpdateInstallerArgumentsPolicy.cs" />
    <Compile Include="${updateUrlPolicy}" Link="CollectorUpdateUrlPolicy.cs" />
    <Compile Include="${deviceTokenProtector}" Link="DeviceTokenProtector.cs" />
    <Compile Include="${configurationService}" Link="ConfigurationService.cs" />
    <Compile Include="${policy}" Link="CollectorRemoteWatchFolderPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var config = new AppConfig
{
    DefaultUserId = "u-default",
    DefaultUsername = "default-operator",
    DefaultRole = "warehouse",
    WatchFolders = new List<WatchFolderConfig>
    {
        new()
        {
            FolderPath = "D:\\OldInbox",
            FolderName = "OldInbox",
            DefaultUserId = "u-old",
            DefaultUsername = "old-operator",
            DefaultRole = "old-role",
            Enabled = true
        }
    }
};

var cleared = CollectorRemoteWatchFolderPolicy.NormalizeRemoteFolders(Array.Empty<WatchFolderConfig>(), config);
if (cleared.Count != 0)
{
    throw new InvalidOperationException($"Expected empty remote watch folders to clear local folders, got {cleared.Count}.");
}
if (CollectorRemoteWatchFolderPolicy.AreEqual(config.WatchFolders, cleared))
{
    throw new InvalidOperationException("Old local folders should differ from the empty remote set.");
}

var normalized = CollectorRemoteWatchFolderPolicy.NormalizeRemoteFolders(new[]
{
    new WatchFolderConfig
    {
        FolderPath = "  E:\\EISCore\\Inbox\\  ",
        FolderName = "",
        DefaultUserId = "",
        DefaultUsername = "",
        DefaultRole = "",
        Enabled = false
    },
    new WatchFolderConfig
    {
        FolderPath = "e:\\eiscore\\inbox",
        FolderName = "Duplicate",
        DefaultUserId = "duplicate-user",
        DefaultUsername = "duplicate-operator",
        DefaultRole = "duplicate-role",
        Enabled = true
    },
    new WatchFolderConfig
    {
        FolderPath = " ",
        FolderName = "ignored"
    },
    new WatchFolderConfig
    {
        FolderPath = "  D:\\Remote\nInbox  ",
        FolderName = " Remote\rName" + new string('N', 200),
        DefaultUserId = " remote\tuser ",
        DefaultUsername = " remote\r\noperator ",
        DefaultRole = " remote\nrole ",
        Enabled = true
    }
}, config);

if (normalized.Count != 2)
{
    throw new InvalidOperationException($"Expected two valid remote watch folders, got {normalized.Count}.");
}

var folder = normalized[0];
if (folder.FolderPath != "E:\\EISCore\\Inbox\\" || folder.FolderName != "Inbox")
{
    throw new InvalidOperationException($"Folder path/name normalization failed: {folder.FolderPath} / {folder.FolderName}");
}
if (folder.DefaultUserId != "u-default"
    || folder.DefaultUsername != "default-operator"
    || folder.DefaultRole != "warehouse"
    || folder.Enabled != false)
{
    throw new InvalidOperationException("Folder fallback owner or enabled flag normalization failed.");
}
var sanitizedFolder = normalized[1];
if (sanitizedFolder.FolderPath != "D:\\RemoteInbox"
    || sanitizedFolder.FolderName.Length != 120
    || sanitizedFolder.FolderName.Any(char.IsControl)
    || sanitizedFolder.DefaultUserId != "remoteuser"
    || sanitizedFolder.DefaultUsername != "remoteoperator"
    || sanitizedFolder.DefaultRole != "remoterole")
{
    throw new InvalidOperationException("Remote watch folder text fields were not sanitized before comparison/persistence.");
}
if (!CollectorRemoteWatchFolderPolicy.AreEqual(normalized, normalized.Select(item => new WatchFolderConfig
{
    FolderPath = item.FolderPath.ToLowerInvariant(),
    FolderName = item.FolderName,
    DefaultUserId = item.DefaultUserId,
    DefaultUsername = item.DefaultUsername,
    DefaultRole = item.DefaultRole,
    Enabled = item.Enabled
}).ToList()))
{
    throw new InvalidOperationException("Watch folder equality should compare paths case-insensitively.");
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

  console.log('PASS: collector remote watch folders regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
