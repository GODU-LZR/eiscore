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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-upload-queue-retention-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorUploadQueueRetentionSmoke.csproj')
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

var store = new UploadQueueStore();
await store.EnsureCreatedAsync();

var old = DateTimeOffset.Now.AddDays(-10);
var recent = DateTimeOffset.Now.AddHours(-2);
var cutoff = DateTimeOffset.Now.AddDays(-3);
var originalPaths = new List<string>();

async Task AddAsync(string hash, string status, DateTimeOffset createdAt, DateTimeOffset? uploadedAt = null)
{
    var filePath = Path.Combine(dataDir, $"{hash}.pdf");
    await File.WriteAllTextAsync(filePath, hash);
    originalPaths.Add(filePath);

    await store.InsertAsync(new UploadQueueItem
    {
        FilePath = filePath,
        OriginalFilename = $"{hash}.pdf",
        FileHash = hash,
        FileSize = 12,
        MimeType = "application/pdf",
        UploadSource = "watch_folder",
        SourceFolder = "D:\\EISCore\\Inbox",
        DeviceId = "device-1",
        UploadedByUserId = "u-1",
        UploadedByUsername = "operator",
        UploadedByRole = "warehouse",
        OperatorSource = "folder_binding_user",
        Status = status,
        CreatedAt = createdAt,
        UploadedAt = uploadedAt,
        ServerAssetId = uploadedAt is null ? "" : $"asset-{hash}"
    });
}

await AddAsync("hash-old-uploaded", UploadQueueStatus.Uploaded, old, old);
await AddAsync("hash-old-duplicate", UploadQueueStatus.Duplicate, old, old);
await AddAsync("hash-old-ignored", UploadQueueStatus.Ignored, old);
await AddAsync("hash-old-failed", UploadQueueStatus.Failed, old);
await AddAsync("hash-old-queued", UploadQueueStatus.Queued, old);
await AddAsync("hash-old-uploading", UploadQueueStatus.Uploading, old);
await AddAsync("hash-old-pending", UploadQueueStatus.Pending, old);
await AddAsync("hash-recent-uploaded", UploadQueueStatus.Uploaded, recent, recent);
await AddAsync("hash-uploaded-without-uploaded-at", UploadQueueStatus.Uploaded, old);
await AddAsync("hash-duplicate-without-uploaded-at", UploadQueueStatus.Duplicate, old);

var deleted = await store.DeleteCompletedBeforeAsync(cutoff);
if (deleted != 3)
{
    throw new InvalidOperationException($"Expected three completed queue rows to be pruned, got {deleted}.");
}

var rows = await store.ListRecentAsync(20);
var hashes = rows.Select(item => item.FileHash).ToHashSet(StringComparer.Ordinal);

void ExpectAbsent(string hash)
{
    if (hashes.Contains(hash))
    {
        throw new InvalidOperationException($"Expected {hash} to be pruned.");
    }
}

void ExpectPresent(string hash)
{
    if (!hashes.Contains(hash))
    {
        throw new InvalidOperationException($"Expected {hash} to be retained.");
    }
}

ExpectAbsent("hash-old-uploaded");
ExpectAbsent("hash-old-duplicate");
ExpectAbsent("hash-old-ignored");
ExpectPresent("hash-old-failed");
ExpectPresent("hash-old-queued");
ExpectPresent("hash-old-uploading");
ExpectPresent("hash-old-pending");
ExpectPresent("hash-recent-uploaded");
ExpectPresent("hash-uploaded-without-uploaded-at");
ExpectPresent("hash-duplicate-without-uploaded-at");

foreach (var path in originalPaths)
{
    if (!File.Exists(path))
    {
        throw new InvalidOperationException($"Queue retention must not delete original files: {path}");
    }
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

  console.log('PASS: collector upload queue retention regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
