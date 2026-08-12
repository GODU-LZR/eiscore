// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawn } from 'node:child_process'
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

const workDir = mkdtempSync(join(tmpdir(), 'eiscore-crash-retention-'))
const dataDir = join(workDir, 'collector-data')
const project = join(workDir, 'CollectorCrashDumpRetentionSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/CrashDumpService.cs'
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
using System.Text.Json;
using EISCore.Collector.Services;

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
}

Directory.CreateDirectory(dataDir);
var crashDir = AppPaths.CrashDumpDirectory;
var now = DateTimeOffset.Parse("2026-06-23T12:00:00.0000000+00:00");
var cutoff = now.AddDays(-30);

CreateReport(crashDir, "old-reported", now.AddDays(-45), reported: true);
CreateReport(crashDir, "recent-reported", now.AddDays(-2), reported: true);
CreateReport(crashDir, "old-unreported", now.AddDays(-45), reported: false);
CreateMalformedReport(crashDir, "old-malformed-reported", now.AddDays(-45), reported: true);
CreateMalformedReport(crashDir, "old-malformed-unreported", now.AddDays(-45), reported: false);
File.WriteAllText(Path.Combine(crashDir, "orphan.dmp"), "orphan");

var writtenManifest = CrashDumpService.WriteCrashReport(
    new InvalidOperationException("token=secret"),
    "unit/test",
    isTerminating: false);
if (string.IsNullOrWhiteSpace(writtenManifest) || !File.Exists(writtenManifest))
{
    throw new InvalidOperationException("Crash report manifest should be written on the normal path.");
}
using (var writtenDoc = JsonDocument.Parse(File.ReadAllText(writtenManifest)))
{
    var message = writtenDoc.RootElement.TryGetProperty("message", out var messageElement)
        ? messageElement.GetString() ?? ""
        : "";
    if (message.Contains("secret", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException("Crash report manifest should sanitize sensitive exception messages.");
    }
}

var pruned = CrashDumpService.PruneReportedReports(cutoff);
if (pruned != 2)
{
    throw new InvalidOperationException($"Expected 2 reported crash reports to be pruned, got {pruned}.");
}

AssertMissing(crashDir, "old-reported.json");
AssertMissing(crashDir, "old-reported.json.reported");
AssertMissing(crashDir, "old-reported.dmp");
AssertMissing(crashDir, "old-malformed-reported.json");
AssertMissing(crashDir, "old-malformed-reported.json.reported");
AssertMissing(crashDir, "old-malformed-reported.dmp");

AssertExists(crashDir, "recent-reported.json");
AssertExists(crashDir, "recent-reported.json.reported");
AssertExists(crashDir, "recent-reported.dmp");
AssertExists(crashDir, "old-unreported.json");
AssertExists(crashDir, "old-unreported.dmp");
AssertExists(crashDir, "old-malformed-unreported.json");
AssertExists(crashDir, "old-malformed-unreported.dmp");
AssertExists(crashDir, "orphan.dmp");

var secondPass = CrashDumpService.PruneReportedReports(cutoff);
if (secondPass != 0)
{
    throw new InvalidOperationException($"Expected pruning to be idempotent, got {secondPass} on second pass.");
}

if (!OperatingSystem.IsWindows())
{
    File.SetUnixFileMode(crashDir, UnixFileMode.None);
    try
    {
        var inaccessibleManifests = CrashDumpService.ListUnreportedManifests();
        if (inaccessibleManifests.Count != 0)
        {
            throw new InvalidOperationException("Inaccessible crash dump directory should return no pending manifests.");
        }

        var inaccessiblePruned = CrashDumpService.PruneReportedReports(cutoff);
        if (inaccessiblePruned != 0)
        {
            throw new InvalidOperationException("Inaccessible crash dump directory should not report pruned files.");
        }

        var inaccessibleWrite = CrashDumpService.WriteCrashReport(
            new InvalidOperationException("write should be best-effort"),
            "permission-denied",
            isTerminating: false);
        if (inaccessibleWrite != "")
        {
            throw new InvalidOperationException("Inaccessible crash dump directory should not produce a manifest path.");
        }

        CrashDumpService.MarkReported(Path.Combine(crashDir, "old-unreported.json"));
    }
    finally
    {
        File.SetUnixFileMode(
            crashDir,
            UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    }
}

static void CreateReport(string crashDir, string name, DateTimeOffset createdAt, bool reported)
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

static void CreateMalformedReport(string crashDir, string name, DateTimeOffset createdAt, bool reported)
{
    var manifestPath = Path.Combine(crashDir, name + ".json");
    var dumpPath = Path.Combine(crashDir, name + ".dmp");
    File.WriteAllText(dumpPath, "dump");
    File.WriteAllText(manifestPath, "{ this is not json");
    File.SetLastWriteTimeUtc(manifestPath, createdAt.UtcDateTime);
    if (reported)
    {
        File.WriteAllText(manifestPath + ".reported", createdAt.ToString("O"));
        File.SetLastWriteTimeUtc(manifestPath + ".reported", createdAt.UtcDateTime);
    }
}

static void AssertExists(string crashDir, string name)
{
    var path = Path.Combine(crashDir, name);
    if (!File.Exists(path))
    {
        throw new InvalidOperationException($"Expected file to remain: {path}");
    }
}

static void AssertMissing(string crashDir, string name)
{
    var path = Path.Combine(crashDir, name);
    if (File.Exists(path))
    {
        throw new InvalidOperationException($"Expected file to be pruned: {path}");
    }
}
`)

try {
  const result = await runDotnet(['run', '--project', project])

  if (result.status !== 0 || result.timedOut) {
    console.error(result.stdout)
    console.error(result.stderr)
    if (result.timedOut) console.error('dotnet child process timed out')
    process.exit(result.status || 1)
  }

  console.log('PASS: collector crash dump retention regression')
} finally {
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
