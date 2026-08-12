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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-upload-queue-schema-migration-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorUploadQueueSchemaMigrationSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
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

await using (var connection = await CollectorSqlite.OpenConnectionAsync())
{
    var command = connection.CreateCommand();
    command.CommandText = """
        CREATE TABLE upload_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            upload_source TEXT NOT NULL,
            device_id TEXT NOT NULL,
            uploaded_by_user_id TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        INSERT INTO upload_queue (
            file_path,
            original_filename,
            file_hash,
            file_size,
            mime_type,
            upload_source,
            device_id,
            uploaded_by_user_id,
            status,
            created_at
        ) VALUES (
            '/tmp/eiscore/legacy.pdf',
            'legacy.pdf',
            'hash-legacy',
            128,
            'application/pdf',
            'watch_folder',
            'device-legacy',
            'user-legacy',
            'uploading',
            '2026-06-23T00:00:00.0000000+00:00'
        ), (
            '/tmp/eiscore/duplicate-queued.pdf',
            'duplicate-queued.pdf',
            'hash-duplicate',
            128,
            'application/pdf',
            'watch_folder',
            'device-legacy',
            'user-legacy',
            'queued',
            '2026-06-23T00:01:00.0000000+00:00'
        ), (
            '/tmp/eiscore/duplicate-uploaded.pdf',
            'duplicate-uploaded.pdf',
            'hash-duplicate',
            128,
            'application/pdf',
            'watch_folder',
            'device-legacy',
            'user-legacy',
            'uploaded',
            '2026-06-23T00:02:00.0000000+00:00'
        ), (
            '/tmp/eiscore/missing-hash.pdf',
            'missing-hash.pdf',
            '',
            128,
            'application/pdf',
            'watch_folder',
            'device-legacy',
            'user-legacy',
            'queued',
            '2026-06-23T00:03:00.0000000+00:00'
        );
        """;
    await command.ExecuteNonQueryAsync();
}

var store = new UploadQueueStore();
await store.EnsureCreatedAsync();

var expectedColumns = new[]
{
    "file_path",
    "original_filename",
    "file_hash",
    "file_size",
    "mime_type",
    "upload_source",
    "source_folder",
    "device_id",
    "windows_username",
    "uploaded_by_user_id",
    "uploaded_by_username",
    "uploaded_by_role",
    "operator_source",
    "status",
    "retry_count",
    "last_error",
    "next_retry_at",
    "created_at",
    "uploaded_at",
    "server_asset_id",
    "server_batch_id",
    "server_batch_no",
    "server_processing_status",
    "server_message"
};
var columns = await ReadColumnsAsync();
foreach (var column in expectedColumns)
{
    if (!columns.Contains(column))
    {
        throw new InvalidOperationException($"Migrated upload_queue table is missing {column}.");
    }
}

var indexes = await ReadIndexesAsync();
if (!indexes.Contains("idx_upload_queue_status_created") || !indexes.Contains("idx_upload_queue_file_hash"))
{
    throw new InvalidOperationException("Migrated upload_queue indexes were not created.");
}
if (!await IsFileHashIndexPartialAsync())
{
    throw new InvalidOperationException("Migrated upload_queue file_hash index should be partial.");
}

await using (var connection = await CollectorSqlite.OpenConnectionAsync())
{
    var command = connection.CreateCommand();
    command.CommandText = """
        INSERT INTO upload_queue (
            file_path,
            original_filename,
            file_hash,
            file_size,
            mime_type,
            upload_source,
            source_folder,
            device_id,
            windows_username,
            uploaded_by_user_id,
            uploaded_by_username,
            uploaded_by_role,
            operator_source,
            status,
            retry_count,
            last_error,
            next_retry_at,
            created_at,
            uploaded_at,
            server_asset_id
        ) VALUES (
            '/tmp/eiscore/bad-dates.pdf',
            'bad-dates.pdf',
            'hash-bad-dates',
            128,
            'application/pdf',
            'watch_folder',
            '',
            'device-legacy',
            '',
            'user-legacy',
            '',
            '',
            '',
            'uploaded',
            0,
            '',
            'not-a-retry-time',
            'not-a-created-time',
            'not-an-uploaded-time',
            'asset-bad-dates'
        ), (
            '/tmp/eiscore/bad-scalars.pdf',
            'bad-scalars.pdf',
            'hash-bad-scalars',
            'not-a-size',
            'application/pdf',
            'watch_folder',
            '',
            'device-legacy',
            '',
            'user-legacy',
            '',
            '',
            '',
            'mystery_status',
            'not-a-retry-count',
            '',
            NULL,
            '2026-06-23T00:05:00.0000000+00:00',
            NULL,
            ''
        );
        """;
    await command.ExecuteNonQueryAsync();
}

await store.EnsureCreatedAsync();

var rows = await store.ListRecentAsync(10);
var legacy = rows.Single(item => item.FileHash == "hash-legacy");
if (legacy.SourceFolder != ""
    || legacy.WindowsUsername != ""
    || legacy.UploadedByUsername != ""
    || legacy.UploadedByRole != ""
    || legacy.OperatorSource != ""
    || legacy.RetryCount != 0
    || legacy.LastError != ""
    || legacy.NextRetryAt is not null
    || legacy.UploadedAt is not null
    || legacy.ServerAssetId != ""
    || legacy.ServerBatchId != ""
    || legacy.ServerBatchNo != ""
    || legacy.ServerProcessingStatus != ""
    || legacy.ServerMessage != "")
{
    throw new InvalidOperationException("Legacy queue row did not receive safe defaults for newly added columns.");
}

var duplicateRows = rows.Where(item => item.FileHash == "hash-duplicate").ToList();
if (duplicateRows.Count != 2)
{
    throw new InvalidOperationException($"Expected two duplicate-hash legacy rows to remain auditable, got {duplicateRows.Count}.");
}
if (duplicateRows.Count(item => item.Status == UploadQueueStatus.Ignored) != 1)
{
    throw new InvalidOperationException("Duplicate legacy hash rows were not reduced to one active row.");
}
var duplicateWinner = await store.FindByHashAsync("hash-duplicate")
    ?? throw new InvalidOperationException("Expected a non-ignored duplicate hash winner.");
if (duplicateWinner.Status != UploadQueueStatus.Uploaded || duplicateWinner.OriginalFilename != "duplicate-uploaded.pdf")
{
    throw new InvalidOperationException("Duplicate hash migration did not keep the uploaded row as the preferred record.");
}

var missingHash = rows.Single(item => item.OriginalFilename == "missing-hash.pdf");
if (missingHash.Status != UploadQueueStatus.Ignored
    || !missingHash.LastError.Contains("缺少 file_hash", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Legacy queue rows without file_hash were not ignored before unique index creation.");
}
if (await store.FindByHashAsync("") is not null)
{
    throw new InvalidOperationException("Empty file_hash lookups should not return migrated legacy rows.");
}

var badDates = rows.Single(item => item.FileHash == "hash-bad-dates");
if (badDates.CreatedAt != DateTimeOffset.UnixEpoch
    || badDates.NextRetryAt is not null
    || badDates.UploadedAt is not null)
{
    throw new InvalidOperationException("Invalid legacy upload_queue timestamps should not block row reads.");
}

var badScalars = rows.Single(item => item.FileHash == "hash-bad-scalars");
if (badScalars.Status != UploadQueueStatus.Failed
    || badScalars.RetryCount != 0
    || badScalars.FileSize != 0
    || !badScalars.LastError.Contains("状态字段异常", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Invalid legacy upload_queue scalar fields should be normalized before row reads.");
}

var counts = await store.CountByStatusAsync();
if (!counts.TryGetValue(UploadQueueStatus.Failed, out var failedCount) || failedCount < 1)
{
    throw new InvalidOperationException("Normalized failed queue rows should be visible to health status counts.");
}
var retrySnapshot = await store.GetFailedRetrySnapshotAsync(10, DateTimeOffset.Parse("2026-06-23T00:10:00.0000000+00:00"));
if (retrySnapshot.ReadyCount < 1)
{
    throw new InvalidOperationException("Normalized failed queue rows should be visible to retry health snapshots.");
}

var recovered = await store.ResetInterruptedUploadsAsync();
if (recovered != 1)
{
    throw new InvalidOperationException($"Expected one legacy uploading row to be recovered, got {recovered}.");
}
var next = await store.GetNextPendingAsync(10);
if (next is null || next.FileHash != "hash-legacy" || next.Status != UploadQueueStatus.Queued)
{
    throw new InvalidOperationException("Migrated legacy queue row was not eligible for retry after recovery.");
}

await store.MarkUploadedAsync(
    next.Id,
    "asset-legacy",
    "batch-legacy",
    "DIB-LEGACY",
    "parsing",
    "Parse job queued",
    duplicate: false);
var uploaded = (await store.ListRecentAsync(10)).Single(item => item.FileHash == "hash-legacy");
if (uploaded.Status != UploadQueueStatus.Uploaded
    || uploaded.UploadedAt is null
    || uploaded.ServerAssetId != "asset-legacy"
    || uploaded.ServerBatchId != "batch-legacy"
    || uploaded.ServerBatchNo != "DIB-LEGACY"
    || uploaded.ServerProcessingStatus != "parsing"
    || uploaded.ServerMessage != "Parse job queued"
    || uploaded.LastError != "")
{
    throw new InvalidOperationException("Migrated upload result columns were not writable.");
}

await store.InsertAsync(new UploadQueueItem
{
    FilePath = "/tmp/eiscore/new.pdf",
    OriginalFilename = "new.pdf",
    FileHash = "hash-new",
    FileSize = 256,
    MimeType = "application/pdf",
    UploadSource = "manual_drag_drop",
    SourceFolder = "/tmp/eiscore",
    DeviceId = "device-new",
    WindowsUsername = "DOMAIN\\operator-new",
    UploadedByUserId = "user-new",
    UploadedByUsername = "operator-new",
    UploadedByRole = "warehouse",
    OperatorSource = "device_default_user",
    Status = UploadQueueStatus.Queued,
    ServerBatchId = "stale-batch",
    ServerBatchNo = "stale-no",
    ServerProcessingStatus = "stale-status",
    ServerMessage = "stale-message",
    NextRetryAt = DateTimeOffset.Parse("2026-06-23T01:05:00.0000000+00:00"),
    CreatedAt = DateTimeOffset.Parse("2026-06-23T01:00:00.0000000+00:00")
});
var inserted = await store.FindByHashAsync("hash-new")
    ?? throw new InvalidOperationException("New row was not inserted after upload_queue migration.");
if (inserted.SourceFolder != "/tmp/eiscore"
    || inserted.WindowsUsername != "DOMAIN\\operator-new"
    || inserted.UploadedByUsername != "operator-new"
    || inserted.UploadedByRole != "warehouse"
    || inserted.OperatorSource != "device_default_user"
    || inserted.ServerBatchId != "stale-batch"
    || inserted.ServerBatchNo != "stale-no"
    || inserted.ServerProcessingStatus != "stale-status"
    || inserted.ServerMessage != "stale-message"
    || inserted.NextRetryAt != DateTimeOffset.Parse("2026-06-23T01:05:00.0000000+00:00"))
{
    throw new InvalidOperationException("New queue ownership and traceability columns were not writable after migration.");
}

var legacyFullIndexDir = Path.Combine(Path.GetDirectoryName(dataDir)!, "collector-data-full-index");
Environment.SetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR", legacyFullIndexDir);
Directory.CreateDirectory(legacyFullIndexDir);
await using (var connection = await CollectorSqlite.OpenConnectionAsync())
{
    var command = connection.CreateCommand();
    command.CommandText = """
        CREATE TABLE upload_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            upload_source TEXT NOT NULL,
            device_id TEXT NOT NULL,
            uploaded_by_user_id TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        INSERT INTO upload_queue (
            file_path,
            original_filename,
            file_hash,
            file_size,
            mime_type,
            upload_source,
            device_id,
            uploaded_by_user_id,
            status,
            created_at
        ) VALUES (
            '/tmp/eiscore/ignored-old.pdf',
            'ignored-old.pdf',
            'hash-requeue-after-ignore',
            128,
            'application/pdf',
            'watch_folder',
            'device-legacy',
            'user-legacy',
            'ignored',
            '2026-06-23T02:00:00.0000000+00:00'
        );

        CREATE UNIQUE INDEX idx_upload_queue_file_hash
            ON upload_queue(file_hash);
        """;
    await command.ExecuteNonQueryAsync();
}

var fullIndexStore = new UploadQueueStore();
await fullIndexStore.EnsureCreatedAsync();
if (!await IsFileHashIndexPartialAsync())
{
    throw new InvalidOperationException("Legacy full file_hash index was not replaced with the partial index.");
}

await fullIndexStore.InsertAsync(new UploadQueueItem
{
    FilePath = "/tmp/eiscore/requeued-after-ignore.pdf",
    OriginalFilename = "requeued-after-ignore.pdf",
    FileHash = "hash-requeue-after-ignore",
    FileSize = 256,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    DeviceId = "device-new",
    UploadedByUserId = "user-new",
    Status = UploadQueueStatus.Queued,
    CreatedAt = DateTimeOffset.Parse("2026-06-23T02:01:00.0000000+00:00")
});
var requeuedAfterIgnored = await fullIndexStore.FindByHashAsync("hash-requeue-after-ignore")
    ?? throw new InvalidOperationException("Expected new active row to be findable after replacing legacy full index.");
if (requeuedAfterIgnored.Status != UploadQueueStatus.Queued
    || requeuedAfterIgnored.OriginalFilename != "requeued-after-ignore.pdf")
{
    throw new InvalidOperationException("Legacy ignored row still shadowed the requeued active row.");
}

static async Task<HashSet<string>> ReadColumnsAsync()
{
    await using var connection = await CollectorSqlite.OpenConnectionAsync();
    var command = connection.CreateCommand();
    command.CommandText = "SELECT name FROM pragma_table_info('upload_queue')";
    var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        columns.Add(reader.GetString(0));
    }

    return columns;
}

static async Task<HashSet<string>> ReadIndexesAsync()
{
    await using var connection = await CollectorSqlite.OpenConnectionAsync();
    var command = connection.CreateCommand();
    command.CommandText = "SELECT name FROM pragma_index_list('upload_queue')";
    var indexes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        indexes.Add(reader.GetString(0));
    }

    return indexes;
}

static async Task<bool> IsFileHashIndexPartialAsync()
{
    await using var connection = await CollectorSqlite.OpenConnectionAsync();
    var command = connection.CreateCommand();
    command.CommandText = """
        SELECT "partial"
        FROM pragma_index_list('upload_queue')
        WHERE name = 'idx_upload_queue_file_hash'
        LIMIT 1
        """;
    var value = await command.ExecuteScalarAsync();
    return Convert.ToInt32(value) == 1;
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

  console.log('PASS: collector upload queue schema migration regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
