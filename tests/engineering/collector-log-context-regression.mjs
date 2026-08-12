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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-log-context-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorLogContextSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
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
var store = new ClientLogStore();
await store.EnsureCreatedAsync();

var service = new ClientLogService(store);
service.UpdateContext(new AppConfig
{
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    DefaultUserId = "default-user",
    DefaultUsername = "default-operator",
    DefaultRole = "default-role",
    ClientVersion = "0.2.0"
}, "WebView/123");

await service.LogAsync(
    "info",
    "frontend_user_action",
    "clicked import button",
    route: "/apps/document-intake-center",
    url: "https://example.test/apps/document-intake-center",
    requestUrl: "https://example.test/api/import",
    statusCode: 202,
    metadataJson: ClientLogMetadata.Serialize(new { component = "ImportButton" }),
    appModule: "document_intake",
    traceId: "trace-123",
    aiImportBatchId: "batch-456",
    sourceFileHash: "hash-789",
    userId: "frontend-user",
    username: "frontend-operator",
    role: "document_intake_manager");

await service.LogAsync("info", "collector_internal", "internal event");

var logs = await store.ListPendingAsync(10);
var frontend = logs.FirstOrDefault(item => item.EventType == "frontend_user_action")
    ?? throw new InvalidOperationException("Frontend SDK context log was not persisted.");

if (frontend.AppModule != "document_intake"
    || frontend.TraceId != "trace-123"
    || frontend.AiImportBatchId != "batch-456"
    || frontend.SourceFileHash != "hash-789")
{
    throw new InvalidOperationException("Frontend SDK trace fields were not persisted to dedicated log columns.");
}

if (frontend.UserId != "frontend-user"
    || frontend.Username != "frontend-operator"
    || frontend.Role != "document_intake_manager")
{
    throw new InvalidOperationException("Frontend SDK user context did not override device defaults.");
}

var internalLog = logs.FirstOrDefault(item => item.EventType == "collector_internal")
    ?? throw new InvalidOperationException("Internal fallback log was not persisted.");
if (internalLog.UserId != "default-user"
    || internalLog.Username != "default-operator"
    || internalLog.Role != "default-role")
{
    throw new InvalidOperationException("Internal log did not fall back to device default user context.");
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

  console.log('PASS: collector log context regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
