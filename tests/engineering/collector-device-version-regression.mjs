// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = resolve(import.meta.dirname, '../..')
const localDotnet = '/home/lzr/.dotnet/dotnet'
const dotnet = process.env.DOTNET_ROOT
  ? join(process.env.DOTNET_ROOT, 'dotnet')
  : existsSync(localDotnet)
    ? localDotnet
    : 'dotnet'

const workDir = mkdtempSync(join(tmpdir(), 'eiscore-device-version-'))
const dataDir = join(workDir, 'collector-data')
const requests = {
  bind: [],
  heartbeat: [],
  config: []
}
const serverErrors = []

const server = createServer(async (req, res) => {
  try {
    const body = await readBody(req)
    const payload = body.length ? JSON.parse(body.toString('utf8')) : {}

    if (req.url === '/agent/document-intake/devices/bind' && req.method === 'POST') {
      requests.bind.push(payload)
      assert.equal(payload.clientVersion, '0.2.0')
      assert.equal(payload.webViewVersion, 'WebView2/123.0')
      sendJson(res, 200, {
        deviceId: 'device-1',
        deviceToken: 'bound-device-token',
        deviceCode: 'collector-1',
        deviceName: 'Collector 1',
        defaultUserId: 'user-1',
        defaultUsername: 'operator',
        defaultRole: 'warehouse'
      })
      return
    }

    if (req.url === '/agent/document-intake/devices/heartbeat' && req.method === 'POST') {
      requests.heartbeat.push(payload)
      assert.equal(req.headers.authorization, 'Bearer device-token')
      assert.equal(payload.client_version, '0.2.0')
      assert.equal(payload.webview_version, 'WebView2/123.0')
      if (requests.heartbeat.length === 2) {
        sendJson(res, 200, {
          ok: false,
          code: 'HEARTBEAT_NOT_ACCEPTED'
        })
        return
      }

      sendJson(res, 200, {
        ok: true,
        serverTime: '2026-06-23T00:00:00.000Z',
        configVersion: 'default',
        device: {
          deviceId: 'device-1',
          deviceCode: 'collector-1',
          deviceName: 'Collector 1',
          defaultUserId: 'user-1',
          defaultUsername: 'operator',
          defaultRole: 'warehouse',
          status: 'active'
        },
        config: {}
      })
      return
    }

    if (req.url === '/agent/document-intake/devices/config' && req.method === 'GET') {
      requests.config.push(payload)
      assert.equal(req.headers.authorization, 'Bearer device-token')
      sendJson(res, 200, {
        ok: false,
        code: 'CONFIG_NOT_ACCEPTED'
      })
      return
    }

    sendJson(res, 404, { code: 'NOT_FOUND', message: req.url })
  } catch (error) {
    serverErrors.push(error)
    sendJson(res, 500, { code: 'STUB_ASSERTION_FAILED', message: error.message })
  }
})
server.keepAliveTimeout = 1000
server.requestTimeout = 30000

const project = join(workDir, 'CollectorDeviceVersionSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs',
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

if (args.Length != 1)
{
    throw new InvalidOperationException("Expected server URL argument.");
}

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
}

Directory.CreateDirectory(dataDir);

var logStore = new ClientLogStore();
await logStore.EnsureCreatedAsync();
var logService = new ClientLogService(logStore);
logService.UpdateContext(new AppConfig
{
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    ClientVersion = "0.2.0",
    WebViewVersion = "WebView2/123.0"
});
await logService.LogAsync("info", "collector_version_probe", "version probe");
var log = (await logStore.ListPendingAsync(10)).Single(item => item.EventType == "collector_version_probe");
if (log.WebViewVersion != "WebView2/123.0")
{
    throw new InvalidOperationException($"Expected local log webview version to be WebView2/123.0, got {log.WebViewVersion}.");
}

var client = new CollectorApiClient();
var bindResponse = await client.BindDeviceAsync(args[0], new DeviceBindRequest
{
    EnterpriseCode = "local",
    DeviceCode = "collector-1",
    DeviceName = "Collector 1",
    DefaultUserId = "user-1",
    DefaultUsername = "operator",
    DefaultRole = "warehouse",
    AuthorizationCode = "bind-code",
    WindowsUsername = "DOMAIN\\operator",
    ClientVersion = "0.2.0",
    WebViewVersion = "WebView2/123.0"
});
if (bindResponse.DeviceToken != "bound-device-token")
{
    throw new InvalidOperationException("Unexpected bind response token.");
}

var heartbeat = await client.SendHeartbeatAsync(new AppConfig
{
    ServerBaseUrl = args[0],
    DeviceId = "device-1",
    DeviceCode = "collector-1",
    DeviceName = "Collector 1",
    ClientVersion = "0.2.0",
    WebViewVersion = "WebView2/123.0"
}, "device-token");
if (heartbeat is null || !heartbeat.Ok)
{
    throw new InvalidOperationException("Heartbeat did not return an ok response.");
}

try
{
    await client.SendHeartbeatAsync(new AppConfig
    {
        ServerBaseUrl = args[0],
        DeviceId = "device-1",
        DeviceCode = "collector-1",
        DeviceName = "Collector 1",
        ClientVersion = "0.2.0",
        WebViewVersion = "WebView2/123.0"
    }, "device-token");
    throw new InvalidOperationException("Heartbeat ok=false response should be rejected.");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("设备心跳", StringComparison.Ordinal)
    && ex.Message.Contains("服务端确认", StringComparison.Ordinal))
{
}

try
{
    await client.GetDeviceConfigAsync(new AppConfig
    {
        ServerBaseUrl = args[0],
        DeviceId = "device-1",
        DeviceCode = "collector-1",
        DeviceName = "Collector 1"
    }, "device-token");
    throw new InvalidOperationException("Device config ok=false response should be rejected.");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("设备远程配置", StringComparison.Ordinal)
    && ex.Message.Contains("服务端确认", StringComparison.Ordinal))
{
}
`)

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const result = await runDotnet(['run', '--project', project, '--', baseUrl])

  if (result.status !== 0 || result.timedOut) {
    console.error(result.stdout)
    console.error(result.stderr)
    if (result.timedOut) console.error('dotnet child process timed out')
    console.error(JSON.stringify(requests, null, 2))
    process.exit(result.status || 1)
  }

  if (serverErrors.length > 0) {
    console.error(serverErrors)
    process.exit(1)
  }

  assert.equal(requests.bind.length, 1, 'bind request should be sent once')
  assert.equal(requests.heartbeat.length, 2, 'heartbeat request should be sent twice')
  assert.equal(requests.config.length, 1, 'device config request should be sent once')
  console.log('PASS: collector device version regression')
} finally {
  await new Promise((resolve) => server.close(resolve))
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length
  })
  res.end(body)
}
