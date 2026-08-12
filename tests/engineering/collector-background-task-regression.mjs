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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-background-task-'))
const project = join(workDir, 'CollectorBackgroundTaskSmoke.csproj')
const backgroundTask = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorBackgroundTask.cs')
const reentrancyGate = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorReentrancyGate.cs')
const mainWindow = resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml.cs')

const mainWindowText = readFileSync(mainWindow, 'utf8')
const bestEffortMainWindowEvents = [
  'collector_start',
  'collector_bound',
  'upload_queue_recovery_failed',
  'collector_config_sync_state_save_failed',
  'collector_update_state_save_failed',
  'upload_queue_recovered',
  'collector_crash_dump_pruned',
  'webview_initialization_failed',
  'collector_tray_initialization_failed'
]
for (const eventType of bestEffortMainWindowEvents) {
  const eventIndex = mainWindowText.indexOf(`"${eventType}"`)
  if (eventIndex < 0) {
    throw new Error(`MainWindow is missing ${eventType}`)
  }

  const eventContext = mainWindowText.slice(Math.max(0, eventIndex - 180), eventIndex + 180)
  if (!eventContext.includes('LogBestEffortAsync(')) {
    throw new Error(`${eventType} should be logged through LogBestEffortAsync so audit logging cannot block the UI path.`)
  }
}

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
    <Compile Include="${backgroundTask}" Link="CollectorBackgroundTask.cs" />
    <Compile Include="${reentrancyGate}" Link="CollectorReentrancyGate.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Services;

await CollectorBackgroundTask.ObserveAsync(Task.CompletedTask);
await CollectorBackgroundTask.ObserveAsync(Task.FromException(new InvalidOperationException("background failure")));

using var cts = new CancellationTokenSource();
cts.Cancel();
await CollectorBackgroundTask.ObserveAsync(Task.FromCanceled(cts.Token));

CollectorBackgroundTask.Forget(Task.CompletedTask);
CollectorBackgroundTask.Forget(Task.FromException(new InvalidOperationException("forgotten failure")));
CollectorBackgroundTask.Forget(Task.Run(async () =>
{
    await Task.Delay(10);
    throw new InvalidOperationException("delayed forgotten failure");
}));

await Task.Delay(100);

var gate = new CollectorReentrancyGate();
if (!gate.TryEnter())
{
    throw new InvalidOperationException("A fresh reentrancy gate should allow the first entrant.");
}
if (gate.TryEnter())
{
    throw new InvalidOperationException("A held reentrancy gate should reject overlapping entrants.");
}
gate.Exit();
if (!gate.TryEnter())
{
    throw new InvalidOperationException("A released reentrancy gate should allow the next entrant.");
}
gate.Exit();
gate.Dispose();
if (gate.TryEnter())
{
    throw new InvalidOperationException("A disposed reentrancy gate should reject entrants.");
}
gate.Exit();
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

  console.log('PASS: collector background task regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
