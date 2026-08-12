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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-sqlite-resilience-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorSqliteResilienceSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
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

var queueStore = new UploadQueueStore();
var logStore = new ClientLogStore();
await queueStore.EnsureCreatedAsync();
await logStore.EnsureCreatedAsync();

await using (var connection = await CollectorSqlite.OpenConnectionAsync())
{
    var journalMode = (await ScalarAsync(connection, "PRAGMA journal_mode"))?.ToString()?.ToLowerInvariant();
    if (journalMode != "wal")
    {
        throw new InvalidOperationException($"Expected SQLite journal_mode=wal, got {journalMode}.");
    }

    var busyTimeout = Convert.ToInt32(await ScalarAsync(connection, "PRAGMA busy_timeout"));
    if (busyTimeout < 5000)
    {
        throw new InvalidOperationException($"Expected SQLite busy_timeout >= 5000, got {busyTimeout}.");
    }
}

await queueStore.InsertAsync(new UploadQueueItem
{
    FilePath = Path.Combine(dataDir, "queued.pdf"),
    OriginalFilename = "queued.pdf",
    FileHash = "hash-queued",
    FileSize = 12,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Queued,
    CreatedAt = DateTimeOffset.Now
});

var writeTasks = new List<Task>();
for (var i = 0; i < 20; i++)
{
    var index = i;
    writeTasks.Add(logStore.InsertAsync(new ClientLogEvent
    {
        Level = "info",
        EventType = "sqlite_concurrent_log",
        Message = $"concurrent log {index}",
        CreatedAt = DateTimeOffset.Now
    }));
    writeTasks.Add(queueStore.InsertAsync(new UploadQueueItem
    {
        FilePath = Path.Combine(dataDir, $"queued-{index}.pdf"),
        OriginalFilename = $"queued-{index}.pdf",
        FileHash = $"hash-queued-{index}",
        FileSize = 12 + index,
        MimeType = "application/pdf",
        UploadSource = "watch_folder",
        Status = UploadQueueStatus.Queued,
        CreatedAt = DateTimeOffset.Now
    }));
}

await Task.WhenAll(writeTasks);

var pendingLogs = await logStore.ListPendingAsync(100);
if (pendingLogs.Count(item => item.EventType == "sqlite_concurrent_log") != 20)
{
    throw new InvalidOperationException("Concurrent log inserts were not persisted.");
}

var queuedRows = await queueStore.ListRecentAsync(100);
if (queuedRows.Count(item => item.FileHash.StartsWith("hash-queued-", StringComparison.Ordinal)) != 20)
{
    throw new InvalidOperationException("Concurrent queue inserts were not persisted.");
}

static async Task<object?> ScalarAsync(Microsoft.Data.Sqlite.SqliteConnection connection, string sql)
{
    var command = connection.CreateCommand();
    command.CommandText = sql;
    return await command.ExecuteScalarAsync();
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

  console.log('PASS: collector sqlite resilience regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
