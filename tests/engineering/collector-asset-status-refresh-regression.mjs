// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'

const repoRoot = resolve(import.meta.dirname, '../..')
const localDotnet = '/home/lzr/.dotnet/dotnet'
const dotnet = process.env.DOTNET_ROOT
  ? join(process.env.DOTNET_ROOT, 'dotnet')
  : existsSync(localDotnet)
    ? localDotnet
    : 'dotnet'

const workDir = mkdtempSync(join(tmpdir(), 'eiscore-asset-status-refresh-'))
const dataDir = join(workDir, 'collector-data')
const requests = []

const server = createServer(async (req, res) => {
  requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization })
  if (req.method !== 'GET' || req.url !== '/agent/document-intake/assets/asset-1/status') {
    sendJson(res, 404, { code: 'NOT_FOUND' })
    return
  }
  if (req.headers.authorization !== 'Bearer device-token') {
    sendJson(res, 401, { code: 'UNAUTHORIZED_DEVICE' })
    return
  }

  sendJson(res, 200, {
    ok: true,
    asset: {
      assetId: ' asset-1\r ',
      batchId: ' batch-1\n ',
      batchNo: ' DIB-\t202606240001 ',
      assetStatus: ' PARSING ',
      batchStatus: ' parsing ',
      parseStatus: ' parsed ',
      entryStatus: ' IMPORTING ',
      businessLinkCount: 2,
      unmappedFieldCount: 1,
      duplicate: false,
      actionHref: '/document-intake/admin/assets/asset-1',
      updatedAt: '2026-06-24T12:00:00.000Z',
      message: ' generated links '
    }
  })
})
server.keepAliveTimeout = 1000
server.requestTimeout = 30000

const project = join(workDir, 'CollectorAssetStatusRefreshSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
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

if (args.Length != 1)
{
    throw new InvalidOperationException("Expected server URL.");
}

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
}

Directory.CreateDirectory(dataDir);
var store = new UploadQueueStore();
await store.EnsureCreatedAsync();
await store.InsertAsync(new UploadQueueItem
{
    FilePath = "/tmp/invoice.pdf",
    OriginalFilename = "invoice.pdf",
    FileHash = "hash-invoice",
    FileSize = 128,
    MimeType = "application/pdf",
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Uploaded,
    UploadedAt = DateTimeOffset.Parse("2026-06-24T11:50:00.0000000+08:00"),
    ServerAssetId = "asset-1",
    ServerBatchId = "old-batch",
    ServerBatchNo = "old-no",
    ServerProcessingStatus = "uploaded",
    ServerMessage = "uploaded"
});

var traceable = await store.ListTraceableUploadsForStatusRefreshAsync();
if (traceable.Count != 1 || traceable[0].ServerAssetId != "asset-1")
{
    throw new InvalidOperationException("Traceable uploaded queue row was not selected for status refresh.");
}

var client = new CollectorApiClient();
var asset = await client.GetAssetStatusAsync(
    new AppConfig { ServerBaseUrl = args[0] },
    "device-token",
    traceable[0].ServerAssetId)
    ?? throw new InvalidOperationException("Asset status response was null.");

if (asset.AssetId != "asset-1"
    || asset.BatchId != "batch-1"
    || asset.BatchNo != "DIB-202606240001"
    || asset.AssetStatus != "parsing"
    || asset.BatchStatus != "parsing"
    || asset.ParseStatus != "parsed"
    || asset.EntryStatus != "importing"
    || asset.BusinessLinkCount != 2
    || asset.UnmappedFieldCount != 1
    || asset.Message != "generated links")
{
    throw new InvalidOperationException(
        $"Unexpected normalized status: {asset.AssetId}/{asset.BatchId}/{asset.BatchNo}/{asset.AssetStatus}/{asset.ParseStatus}/{asset.EntryStatus}/{asset.BusinessLinkCount}/{asset.UnmappedFieldCount}/{asset.Message}.");
}

await store.UpdateServerTraceAsync(
    traceable[0].Id,
    asset.BatchId,
    asset.BatchNo,
    asset.BusinessLinkCount > 0 ? "imported" : asset.EntryStatus,
    asset.Message);

var refreshed = await store.FindByHashAsync("hash-invoice")
    ?? throw new InvalidOperationException("Queue row disappeared after status refresh.");
if (refreshed.ServerBatchId != "batch-1"
    || refreshed.ServerBatchNo != "DIB-202606240001"
    || refreshed.ServerProcessingStatus != "imported"
    || refreshed.ServerMessage != "generated links")
{
    throw new InvalidOperationException("Server trace fields were not updated from the asset status response.");
}
`)

try {
  const realtime = readFileSync(resolve(repoRoot, 'realtime/document-intake.js'), 'utf8')
  const realtimeIndex = readFileSync(resolve(repoRoot, 'realtime/index.js'), 'utf8')
  assert.match(realtime, /and a\.device_id = \$2/, 'collector asset status must be scoped to the authenticated device')
  assert.match(realtime, /handleGetCollectorAssetStatus/, 'collector asset status handler should be exported')
  assert.match(realtimeIndex, /\/agent\/document-intake\/assets\//, 'collector asset status route should be registered')

  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const result = await runDotnet(['run', '--project', project, '--', baseUrl], {
    EISCORE_COLLECTOR_DATA_DIR: dataDir
  })

  if (result.status !== 0 || result.timedOut) {
    console.error(result.stdout)
    console.error(result.stderr)
    if (result.timedOut) console.error('dotnet child process timed out')
    process.exit(result.status || 1)
  }

  assert.equal(requests.length, 1)
  assert.equal(requests[0].authorization, 'Bearer device-token')
  console.log('PASS: collector asset status refresh regression')
} finally {
  await new Promise((resolveClose) => server.close(resolveClose))
  rmSync(workDir, { recursive: true, force: true })
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function runDotnet(args, env = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(dotnet, args, {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000)
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('close', (status, signal) => {
      clearTimeout(timer)
      resolveRun({ status, signal, stdout, stderr, timedOut: signal === 'SIGKILL' })
    })
  })
}
