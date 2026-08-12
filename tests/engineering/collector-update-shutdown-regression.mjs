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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-update-shutdown-'))
const project = join(workDir, 'CollectorUpdateShutdownSmoke.csproj')
const appConfig = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/AppConfig.cs')
const policy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/UpdateShutdownPolicy.cs')

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
    <Compile Include="${appConfig}" Link="AppConfig.cs" />
    <Compile Include="${policy}" Link="UpdateShutdownPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var now = new DateTimeOffset(2026, 6, 23, 10, 0, 0, TimeSpan.Zero);

Expect(true, null, Config(42, now), now, "fresh installer with no previous PID should trigger shutdown");
Expect(true, 41, Config(42, now), now, "fresh installer with changed PID should trigger shutdown");
Expect(true, 41, Config(42, now.AddMinutes(-5)), now, "installer at the five minute boundary should trigger shutdown");

Expect(false, 42, Config(42, now), now, "same installer PID should not retrigger shutdown");
Expect(false, null, Config(null, now), now, "missing installer PID should not trigger shutdown");
Expect(false, null, Config(0, now), now, "zero installer PID should not trigger shutdown");
Expect(false, null, Config(-42, now), now, "negative installer PID should not trigger shutdown");
Expect(false, null, Config(42, null), now, "missing installer timestamp should not trigger shutdown");
Expect(false, null, Config(42, now.AddMinutes(-6)), now, "old pending installer should not trigger shutdown");
Expect(false, null, Config(42, now.AddSeconds(1)), now, "future installer timestamp should not trigger shutdown");

static AppConfig Config(int? pid, DateTimeOffset? startedAt)
{
    return new AppConfig
    {
        PendingUpdateInstallerProcessId = pid,
        PendingUpdateInstallerStartedAt = startedAt
    };
}

static void Expect(bool expected, int? previousPid, AppConfig config, DateTimeOffset now, string message)
{
    var actual = UpdateShutdownPolicy.ShouldShutdownAfterInstallerStarted(previousPid, config, now);
    if (actual != expected)
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
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

  console.log('PASS: collector update shutdown regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
