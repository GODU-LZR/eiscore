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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-log-schema-migration-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorLogSchemaMigrationSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs'
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

await using (var connection = await CollectorSqlite.OpenConnectionAsync())
{
    var command = connection.CreateCommand();
    command.CommandText = """
        CREATE TABLE client_log_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL
        );

        INSERT INTO client_log_events (message)
        VALUES ('legacy row');
        """;
    await command.ExecuteNonQueryAsync();
}

var store = new ClientLogStore();
await store.EnsureCreatedAsync();

var expectedColumns = new[]
{
    "level",
    "event_type",
    "message",
    "stack",
    "device_id",
    "device_name",
    "user_id",
    "username",
    "role",
    "app_module",
    "route",
    "url",
    "request_url",
    "status_code",
    "client_session_id",
    "trace_id",
    "ai_import_batch_id",
    "source_file_hash",
    "app_version",
    "webview_version",
    "created_at",
    "metadata",
    "uploaded"
};
var columns = await ReadColumnsAsync();
foreach (var column in expectedColumns)
{
    if (!columns.Contains(column))
    {
        throw new InvalidOperationException($"Migrated client_log_events table is missing {column}.");
    }
}

await store.InsertAsync(new ClientLogEvent
{
    Level = "error",
    EventType = "frontend_resource_error",
    Message = "new row",
    Stack = "stack trace",
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    UserId = "user-1",
    Username = "operator-1",
    Role = "document_intake_manager",
    AppModule = "document_intake",
    Route = "/apps/document-intake-center",
    Url = "https://example.test/apps/document-intake-center",
    RequestUrl = "https://example.test/api/import",
    StatusCode = 503,
    ClientSessionId = "session-1",
    TraceId = "trace-1",
    AiImportBatchId = "batch-1",
    SourceFileHash = "hash-1",
    AppVersion = "0.2.0",
    WebViewVersion = "WebView/123",
    CreatedAt = DateTimeOffset.Parse("2026-06-23T12:34:56.0000000+00:00"),
    MetadataJson = "{\"component\":\"ImportButton\"}"
});

await using (var connection = await CollectorSqlite.OpenConnectionAsync())
{
    var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO client_log_events (
            level,
            event_type,
            message,
            created_at,
            metadata,
            uploaded
        ) VALUES (
            'warn',
            'legacy_bad_created_at',
            'legacy bad created_at row',
            'not-a-date',
            '{}',
            0
        );

        INSERT INTO client_log_events (
            level,
            event_type,
            message,
            status_code,
            created_at,
            metadata,
            uploaded
        ) VALUES (
            'warn',
            'legacy_bad_scalar_fields',
            'legacy bad scalar fields row',
            'bad-http-status',
            '2026-06-23T12:35:00.0000000+00:00',
            '',
            'definitely-not-uploaded'
        );
        """;
    await command.ExecuteNonQueryAsync();
}

await store.EnsureCreatedAsync();

var logs = await store.ListPendingAsync(10);
var legacy = logs.FirstOrDefault(item => item.Message == "legacy row")
    ?? throw new InvalidOperationException("Migrated legacy row was not readable as a pending log.");
if (legacy.Level != "info"
    || legacy.EventType != "collector_event"
    || legacy.Stack != ""
    || legacy.DeviceId != ""
    || legacy.UserId != ""
    || legacy.AppModule != ""
    || legacy.TraceId != ""
    || legacy.AiImportBatchId != ""
    || legacy.SourceFileHash != ""
    || legacy.MetadataJson != "{}")
{
    throw new InvalidOperationException("Legacy row did not receive safe defaults for newly added log columns.");
}

if (legacy.CreatedAt != DateTimeOffset.Parse("1970-01-01T00:00:00.0000000+00:00"))
{
    throw new InvalidOperationException("Legacy row did not receive a parseable created_at default.");
}

var current = logs.FirstOrDefault(item => item.Message == "new row")
    ?? throw new InvalidOperationException("New log row was not inserted after schema migration.");
if (current.AppModule != "document_intake"
    || current.TraceId != "trace-1"
    || current.AiImportBatchId != "batch-1"
    || current.SourceFileHash != "hash-1"
    || current.UserId != "user-1"
    || current.StatusCode != 503)
{
    throw new InvalidOperationException("New log context columns were not writable after migration.");
}

var badCreatedAt = logs.FirstOrDefault(item => item.EventType == "legacy_bad_created_at")
    ?? throw new InvalidOperationException("Legacy bad created_at row was not readable as a pending log.");
if (badCreatedAt.CreatedAt != DateTimeOffset.UnixEpoch)
{
    throw new InvalidOperationException("Invalid legacy created_at should fall back to Unix epoch instead of blocking pending log reads.");
}

var badScalars = logs.FirstOrDefault(item => item.EventType == "legacy_bad_scalar_fields")
    ?? throw new InvalidOperationException("Legacy bad scalar row was not readable as a pending log.");
if (badScalars.StatusCode is not null || badScalars.MetadataJson != "{}")
{
    throw new InvalidOperationException("Invalid legacy log status_code/metadata fields should be normalized before pending log reads.");
}
if (await store.CountPendingAsync() < 3)
{
    throw new InvalidOperationException("Invalid legacy uploaded flags should be normalized to pending instead of hiding logs.");
}

await store.MarkUploadedAsync(new[] { legacy.Id });
var remaining = await store.ListPendingAsync(10);
if (remaining.Any(item => item.Id == legacy.Id))
{
    throw new InvalidOperationException("Migrated uploaded column did not support MarkUploadedAsync.");
}

static async Task<HashSet<string>> ReadColumnsAsync()
{
    await using var connection = await CollectorSqlite.OpenConnectionAsync();
    var command = connection.CreateCommand();
    command.CommandText = "SELECT name FROM pragma_table_info('client_log_events')";
    var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        columns.Add(reader.GetString(0));
    }

    return columns;
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

  console.log('PASS: collector log schema migration regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
