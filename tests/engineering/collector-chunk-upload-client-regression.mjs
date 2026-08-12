// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
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

const workDir = mkdtempSync(join(tmpdir(), 'eiscore-chunk-upload-client-'))
const chunkSize = 256 * 1024
const fileBytes = Buffer.alloc(chunkSize * 2 + 17)
for (let index = 0; index < fileBytes.length; index += 1) {
  fileBytes[index] = index % 251
}
const fileHash = createHash('sha256').update(fileBytes).digest('hex')
const filePath = join(workDir, 'chunked.bin')
writeFileSync(filePath, fileBytes)

const requests = {
  init: [],
  upload: [],
  complete: [],
  unexpectedSimpleUpload: 0
}
const serverErrors = []
let initResponseMode = 'uploading'
let partResponseMode = 'valid'
let completeResponseMode = 'valid'

const server = createServer(async (req, res) => {
  try {
    const body = await readBody(req)
    assert.equal(req.headers.authorization, 'Bearer device-token')
    assert.equal(req.headers['x-eiscore-collector'], 'windows-desktop')

    if (req.url === '/agent/document-intake/assets/chunks/init' && req.method === 'POST') {
      const payload = JSON.parse(body.toString('utf8'))
      requests.init.push(payload)
      assert.equal(payload.original_filename, 'chunked.bin')
      assert.equal(payload.file_hash, fileHash)
      assert.equal(payload.file_size, fileBytes.length)
      assert.equal(payload.chunk_size, chunkSize)
      assert.equal(payload.total_chunks, 3)
      assert.equal(payload.upload_source, 'watch_folder')
      assert.equal(payload.client_queue_id, 42)
      assert.equal(payload.metadata.device_id, 'device-1')
      assert.equal(payload.metadata.device_name, 'Collector 1')
      assert.equal(payload.metadata.uploaded_by_user_id, 'folder-user')
      assert.equal(payload.metadata.uploaded_by_username, 'folder-operator')
      assert.equal(payload.metadata.uploaded_by_role, 'warehouse')
      assert.equal(payload.metadata.operator_source, 'folder_binding_user')
      assert.equal(payload.metadata.windows_username, 'DOMAIN\\queued-user')
      assert.equal(payload.metadata.source_folder, '/tmp/watch')
      assert.equal(payload.metadata.file_hash, fileHash)

      if (initResponseMode === 'duplicate-missing-asset') {
        sendJson(res, 200, {
          duplicate: true,
          status: 'duplicate',
          assetId: '',
          sessionId: '',
          uploadedChunks: [],
          missingChunks: [],
          chunkSize,
          totalChunks: 3
        })
        return
      }

      sendJson(res, 200, {
        duplicate: false,
        status: 'uploading',
        sessionId: 'session-1',
        uploadedChunks: [0, 1, 999],
        missingChunks: [2, 999, 2],
        chunkSize,
        totalChunks: 3
      })
      return
    }

    if (req.url === '/agent/document-intake/assets/chunks/upload' && req.method === 'POST') {
      const metadata = extractJsonPart(body, req.headers['content-type'] || '', 'metadata')
      const chunk = extractPartBody(body, req.headers['content-type'] || '', 'chunk')
      requests.upload.push({ metadata, chunkLength: chunk.length })

      assert.equal(metadata.session_id, 'session-1')
      assert.equal(metadata.chunk_index, 2, 'client should upload only the valid missing chunk returned by init')
      const start = metadata.chunk_index * chunkSize
      const expected = fileBytes.subarray(start, Math.min(start + chunkSize, fileBytes.length))
      assert.deepEqual(chunk, expected)
      assert.equal(metadata.chunk_hash, createHash('sha256').update(chunk).digest('hex'))

      sendJson(res, 200, {
        ok: true,
        sessionId: 'session-1',
        chunkIndex: partResponseMode === 'wrong-index' ? 1 : metadata.chunk_index,
        uploadedChunks: requests.upload.length + 1,
        totalChunks: 3
      })
      return
    }

    if (req.url === '/agent/document-intake/assets/chunks/complete' && req.method === 'POST') {
      const payload = JSON.parse(body.toString('utf8'))
      requests.complete.push(payload)
      assert.equal(payload.session_id, 'session-1')
      sendJson(res, 200, {
        assetId: completeResponseMode === 'missing-asset' ? '' : ' asset-\r1\t ',
        batchId: ' batch-\n1 ',
        batchNo: ' DIB-\t1 ',
        duplicate: false,
        status: ' UPLOADED ',
        message: ' assembled\r '
      })
      return
    }

    if (req.url === '/agent/document-intake/assets/upload') {
      requests.unexpectedSimpleUpload += 1
    }

    sendJson(res, 404, { code: 'NOT_FOUND', message: req.url })
  } catch (error) {
    serverErrors.push(error)
    sendJson(res, 500, { code: 'STUB_ASSERTION_FAILED', message: error.message })
  }
})
server.keepAliveTimeout = 1000
server.requestTimeout = 30000

const project = join(workDir, 'CollectorChunkUploadClientSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs'
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
${sources.map((source) => `    <Compile Include="${resolve(repoRoot, source)}" Link="${source.split('/').pop()}" />`).join('\n')}
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;

if (args.Length != 3)
{
    throw new InvalidOperationException("Expected server URL, file path and SHA256 hash arguments.");
}

var serverBaseUrl = args[0];
var filePath = args[1];
var fileHash = args[2];
var fileInfo = new FileInfo(filePath);
var client = new CollectorApiClient();
var response = await client.UploadFileAsync(
    new UploadQueueItem
    {
        Id = 42,
        FilePath = filePath,
        OriginalFilename = "chunked.bin",
        FileHash = fileHash,
        FileSize = fileInfo.Length,
        MimeType = "application/octet-stream",
        UploadSource = "watch_folder",
        SourceFolder = "/tmp/watch",
        DeviceId = "device-1",
        WindowsUsername = "DOMAIN\\queued-user",
        UploadedByUserId = "folder-user",
        UploadedByUsername = "folder-operator",
        UploadedByRole = "warehouse",
        OperatorSource = "folder_binding_user"
    },
    new AppConfig
    {
        ServerBaseUrl = serverBaseUrl,
        DeviceId = "device-1",
        DeviceName = "Collector 1",
        DefaultUserId = "default-user",
        DefaultUsername = "default-operator",
        DefaultRole = "default-role",
        ChunkSizeBytes = 256 * 1024
    },
    "device-token");

if (response.AssetId != "asset-1"
    || response.BatchId != "batch-1"
    || response.BatchNo != "DIB-1"
    || response.Message != "assembled"
    || response.Status != "uploaded"
    || response.Duplicate)
{
    throw new InvalidOperationException("Unexpected chunk upload response.");
}
`)

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const result = await runDotnet(['run', '--project', project, '--', baseUrl, filePath, fileHash])

  if (result.status !== 0 || result.timedOut) {
    console.error(result.stdout)
    console.error(result.stderr)
    if (result.timedOut) console.error('dotnet child process timed out')
    console.error(JSON.stringify(requests, null, 2))
    process.exit(result.status || 1)
  }

  assert.equal(requests.unexpectedSimpleUpload, 0, 'large file should not use simple upload endpoint')
  assert.equal(requests.init.length, 1, 'chunk upload should initialize exactly once')
  assert.equal(requests.complete.length, 1, 'chunk upload should complete exactly once')
  assert.deepEqual(requests.upload.map((item) => item.metadata.chunk_index), [2])
  assert.deepEqual(requests.upload.map((item) => item.chunkLength), [17])
  assert.equal(serverErrors.length, 0, serverErrors.map((error) => error.stack || error.message).join('\n'))

  partResponseMode = 'wrong-index'
  const completeCountBeforeInvalidPart = requests.complete.length
  const invalidPartResult = await runDotnet(['run', '--project', project, '--', baseUrl, filePath, fileHash])
  assert.notEqual(invalidPartResult.status, 0, 'client should reject chunk upload acknowledgements for the wrong chunk index')
  assert.equal(invalidPartResult.timedOut, false, 'invalid chunk acknowledgement run should fail promptly')
  assert.match(
    invalidPartResult.stderr + invalidPartResult.stdout,
    /分片上传确认与本地请求不一致/,
    'client should report the chunk acknowledgement mismatch'
  )
  assert.equal(
    requests.complete.length,
    completeCountBeforeInvalidPart,
    'client should not complete a chunked upload after an invalid chunk acknowledgement'
  )
  assert.equal(serverErrors.length, 0, serverErrors.map((error) => error.stack || error.message).join('\n'))

  partResponseMode = 'valid'
  completeResponseMode = 'missing-asset'
  const invalidCompleteResult = await runDotnet(['run', '--project', project, '--', baseUrl, filePath, fileHash])
  assert.notEqual(invalidCompleteResult.status, 0, 'client should reject chunk completion responses without assetId')
  assert.equal(invalidCompleteResult.timedOut, false, 'invalid completion response run should fail promptly')
  assert.match(
    invalidCompleteResult.stderr + invalidCompleteResult.stdout,
    /缺少 assetId/,
    'client should report the missing asset id'
  )
  assert.equal(
    requests.complete.length,
    completeCountBeforeInvalidPart + 1,
    'client should call complete once for the invalid completion response scenario'
  )
  assert.equal(serverErrors.length, 0, serverErrors.map((error) => error.stack || error.message).join('\n'))

  completeResponseMode = 'valid'
  initResponseMode = 'duplicate-missing-asset'
  const uploadCountBeforeDuplicateInit = requests.upload.length
  const completeCountBeforeDuplicateInit = requests.complete.length
  const invalidDuplicateInitResult = await runDotnet(['run', '--project', project, '--', baseUrl, filePath, fileHash])
  assert.notEqual(invalidDuplicateInitResult.status, 0, 'client should reject duplicate chunk init responses without assetId')
  assert.equal(invalidDuplicateInitResult.timedOut, false, 'invalid duplicate init response run should fail promptly')
  assert.match(
    invalidDuplicateInitResult.stderr + invalidDuplicateInitResult.stdout,
    /缺少 assetId/,
    'client should report the missing asset id from duplicate init'
  )
  assert.equal(
    requests.upload.length,
    uploadCountBeforeDuplicateInit,
    'client should not upload chunks after invalid duplicate init'
  )
  assert.equal(
    requests.complete.length,
    completeCountBeforeDuplicateInit,
    'client should not complete after invalid duplicate init'
  )
  assert.equal(serverErrors.length, 0, serverErrors.map((error) => error.stack || error.message).join('\n'))

  console.log('PASS: collector chunk upload client regression')
} finally {
  server.closeIdleConnections?.()
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(resolve))
  rmSync(workDir, { recursive: true, force: true })
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json', connection: 'close' })
  res.end(JSON.stringify(payload))
}

function runDotnet(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(dotnet, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, 60000)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (status) => {
      clearTimeout(timer)
      resolve({ status, stdout, stderr, timedOut })
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

function extractJsonPart(body, contentType, name) {
  return JSON.parse(extractPartBody(body, contentType, name).toString('utf8').trim())
}

function extractPartBody(body, contentType, name) {
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1]
  if (!boundary) {
    throw new Error('multipart boundary missing')
  }

  const text = body.toString('latin1')
  const markerIndex = [`name="${name}"`, `name=${name}`]
    .map((marker) => text.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? -1
  if (markerIndex < 0) {
    throw new Error(`multipart part ${name} missing`)
  }

  const bodyStart = text.indexOf('\r\n\r\n', markerIndex) + 4
  const bodyEnd = text.indexOf(`\r\n--${boundary}`, bodyStart)
  if (bodyStart < 4 || bodyEnd < 0) {
    throw new Error(`multipart part ${name} is malformed`)
  }

  return body.subarray(bodyStart, bodyEnd)
}
