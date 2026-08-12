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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-update-state-save-'))
const project = join(workDir, 'CollectorUpdateStateSaveSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorConfigSavePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateStateSavePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/UpdateShutdownPolicy.cs'
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
using System.Text.Json;
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var now = new DateTimeOffset(2026, 6, 26, 9, 30, 0, TimeSpan.Zero);
var lastCheck = now.AddSeconds(-10);
var pendingConfig = new AppConfig
{
    ClientVersion = "0.2.0",
    PendingUpdateVersion = "0.3.0",
    PendingUpdateInstallerPath = @"C:\EISCore\updates\EISCore.Collector-0.3.0.exe",
    PendingUpdateInstallerProcessId = 2468,
    PendingUpdateInstallerStartedAt = now,
    LastUpdateCheckAt = lastCheck
};

var saveAttempts = 0;
var failedSave = await CollectorUpdateStateSavePolicy.TrySaveAndEvaluateAsync(
    pendingConfig,
    force: true,
    previousInstallerProcessId: 1357,
    now,
    _ =>
    {
        saveAttempts++;
        return Task.FromException(new IOException("synthetic update state save failure"));
    });

if (saveAttempts != 1)
{
    throw new InvalidOperationException("Update state save should be attempted exactly once.");
}
if (failedSave.SaveException is not IOException)
{
    throw new InvalidOperationException("Update state save failure should be returned without throwing.");
}
if (!failedSave.ShouldShutdownAfterInstallerStarted)
{
    throw new InvalidOperationException("A newly started installer should still trigger shutdown after state save failure.");
}

using (var metadata = JsonDocument.Parse(failedSave.FailureMetadataJson))
{
    var root = metadata.RootElement;
    ExpectBool(root, "force", true);
    ExpectString(root, "exception_type", "IOException");
    ExpectString(root, "client_version", "0.2.0");
    ExpectString(root, "pending_update_version", "0.3.0");
    ExpectBool(root, "has_pending_installer_path", true);
    ExpectInt(root, "pending_update_installer_process_id", 2468);
    ExpectDateTimeOffset(root, "last_update_check_at", lastCheck);
}

var sameInstallerSave = await CollectorUpdateStateSavePolicy.TrySaveAndEvaluateAsync(
    pendingConfig,
    force: false,
    previousInstallerProcessId: 2468,
    now,
    _ => Task.CompletedTask);

if (sameInstallerSave.SaveException is not null)
{
    throw new InvalidOperationException("Successful update state save should not report an exception.");
}
if (sameInstallerSave.ShouldShutdownAfterInstallerStarted)
{
    throw new InvalidOperationException("The same installer PID should not retrigger shutdown.");
}
if (sameInstallerSave.FailureMetadataJson != "{}")
{
    throw new InvalidOperationException("Successful update state save should not create failure metadata.");
}

var metadataOnly = CollectorUpdateStateSavePolicy.BuildFailureMetadataJson(
    new AppConfig
    {
        ClientVersion = "0.2.0",
        PendingUpdateVersion = "0.3.0",
        PendingUpdateInstallerPath = "",
        PendingUpdateInstallerProcessId = null,
        LastUpdateCheckAt = null
    },
    force: false,
    new InvalidOperationException("metadata check"));
using (var metadata = JsonDocument.Parse(metadataOnly))
{
    ExpectBool(metadata.RootElement, "has_pending_installer_path", false);
    ExpectString(metadata.RootElement, "exception_type", "InvalidOperationException");
}

static void ExpectString(JsonElement root, string name, string expected)
{
    if (!root.TryGetProperty(name, out var property) || property.GetString() != expected)
    {
        throw new InvalidOperationException($"Expected metadata {name} to equal {expected}, got {property}.");
    }
}

static void ExpectBool(JsonElement root, string name, bool expected)
{
    if (!root.TryGetProperty(name, out var property) || property.GetBoolean() != expected)
    {
        throw new InvalidOperationException($"Expected metadata {name} to equal {expected}.");
    }
}

static void ExpectInt(JsonElement root, string name, int expected)
{
    if (!root.TryGetProperty(name, out var property) || property.GetInt32() != expected)
    {
        throw new InvalidOperationException($"Expected metadata {name} to equal {expected}.");
    }
}

static void ExpectDateTimeOffset(JsonElement root, string name, DateTimeOffset expected)
{
    if (!root.TryGetProperty(name, out var property) || property.GetDateTimeOffset() != expected)
    {
        throw new InvalidOperationException($"Expected metadata {name} to equal {expected:O}.");
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

  console.log('PASS: collector update state save regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
