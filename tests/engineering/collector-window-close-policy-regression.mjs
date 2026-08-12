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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-window-close-policy-'))
const project = join(workDir, 'CollectorWindowClosePolicySmoke.csproj')
const policy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorWindowClosePolicy.cs')

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
    <Compile Include="${policy}" Link="CollectorWindowClosePolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Services;

Expect(CollectorWindowCloseAction.HideToTray, isExitRequested: false, isSessionEnding: false, isTrayAvailable: true, "normal window close should hide to tray");
Expect(CollectorWindowCloseAction.MinimizeToTaskbar, isExitRequested: false, isSessionEnding: false, isTrayAvailable: false, "normal window close should minimize when tray is unavailable");
Expect(CollectorWindowCloseAction.AllowClose, isExitRequested: true, isSessionEnding: false, isTrayAvailable: false, "explicit tray exit should close even when tray is unavailable");
Expect(CollectorWindowCloseAction.AllowClose, isExitRequested: false, isSessionEnding: true, isTrayAvailable: false, "Windows session ending should close even when tray is unavailable");
Expect(CollectorWindowCloseAction.AllowClose, isExitRequested: true, isSessionEnding: true, isTrayAvailable: true, "explicit exit during session ending should close");

static void Expect(
    CollectorWindowCloseAction expected,
    bool isExitRequested,
    bool isSessionEnding,
    bool isTrayAvailable,
    string message)
{
    var actual = CollectorWindowClosePolicy.Decide(isExitRequested, isSessionEnding, isTrayAvailable);
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

  console.log('PASS: collector window close policy regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
