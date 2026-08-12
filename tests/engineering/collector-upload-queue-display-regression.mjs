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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-upload-queue-display-'))

const project = join(workDir, 'CollectorUploadQueueDisplaySmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/QueueModels.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorDeviceAccessPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorManualUploadPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/UploadQueueProcessResult.cs',
  'collector-desktop/EISCore.Collector/Services/UploadQueueDisplayPolicy.cs'
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

var now = DateTimeOffset.Parse("2026-06-23T08:30:00.0000000+08:00");
var failed = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 7,
    OriginalFilename = "purchase-order.pdf",
    FileSize = 2 * 1024 * 1024,
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Failed,
    RetryCount = 2,
    NextRetryAt = now.AddMinutes(5),
    LastError = "network unavailable because the remote collector endpoint did not respond before timeout"
}, now);

ExpectContains(failed, "#7");
ExpectContains(failed, "[失败]");
ExpectContains(failed, "purchase-order.pdf (2 MB)");
ExpectContains(failed, "监听目录");
ExpectContains(failed, "重试 2 次");
ExpectContains(failed, "08:35:00 后重试");
ExpectContains(failed, "错误：network unavailable");

var missingByError = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 11,
    OriginalFilename = "lost.pdf",
    FilePath = "/tmp/lost.pdf",
    FileSize = 2048,
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Failed,
    LastError = "本地文件不存在。"
}, now, _ => true);
ExpectContains(missingByError, "本地文件缺失");
ExpectContains(missingByError, "错误：本地文件不存在");

var missingByProbe = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 12,
    OriginalFilename = "not-there.pdf",
    FilePath = "/tmp/not-there.pdf",
    FileSize = 4096,
    UploadSource = "manual_selected_file",
    Status = UploadQueueStatus.Queued
}, now, _ => false);
ExpectContains(missingByProbe, "[待上传]");
ExpectContains(missingByProbe, "本地文件缺失");

var due = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 8,
    OriginalFilename = "quality.xlsx",
    FileSize = 1536,
    UploadSource = "manual_drag_drop",
    Status = UploadQueueStatus.Failed,
    RetryCount = 1,
    NextRetryAt = now.AddSeconds(-1)
}, now);
ExpectContains(due, "[失败]");
ExpectContains(due, "窗口拖拽");
ExpectContains(due, "1.5 KB");
ExpectContains(due, "已到重试时间");

var uploaded = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 9,
    OriginalFilename = "archive.zip",
    FileSize = 512,
    UploadSource = "manual_selected_file",
    Status = UploadQueueStatus.Uploaded,
    UploadedAt = now.AddMinutes(-3),
    ServerAssetId = "asset-9",
    ServerBatchId = "batch-id-9",
    ServerBatchNo = "DIB-202606230001",
    ServerProcessingStatus = "parsing",
    ServerMessage = "Uploaded and parse job queued"
}, now);
ExpectContains(uploaded, "[已上传]");
ExpectContains(uploaded, "手动选择");
ExpectContains(uploaded, "08:27:00 已完成");
ExpectContains(uploaded, "批次 DIB-202606230001");
ExpectContains(uploaded, "asset asset-9");
ExpectContains(uploaded, "服务端：解析中");
ExpectContains(uploaded, "服务端消息：Uploaded and parse job queued");

var duplicate = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 14,
    OriginalFilename = "duplicated.pdf",
    FileSize = 1024,
    UploadSource = "watch_folder",
    Status = UploadQueueStatus.Duplicate,
    UploadedAt = now.AddMinutes(-2),
    ServerAssetId = "asset-duplicate",
    ServerBatchId = "batch-id-only",
    ServerProcessingStatus = "duplicate"
}, now);
ExpectContains(duplicate, "[重复]");
ExpectContains(duplicate, "08:28:00 已完成");
ExpectContains(duplicate, "批次 batch-id-only");
ExpectContains(duplicate, "asset asset-duplicate");
ExpectNotContains(duplicate, "服务端：");

var uploadedMissingOriginal = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 13,
    OriginalFilename = "already-uploaded.pdf",
    FilePath = "/tmp/deleted-after-upload.pdf",
    FileSize = 512,
    UploadSource = "manual_selected_file",
    Status = UploadQueueStatus.Uploaded,
    UploadedAt = now.AddMinutes(-1)
}, now, _ => false);
ExpectNotContains(uploadedMissingOriginal, "本地文件缺失");

var unknown = UploadQueueDisplayPolicy.Format(new UploadQueueItem
{
    Id = 10,
    OriginalFilename = "mystery.bin",
    FileSize = -10,
    UploadSource = "custom_source",
    Status = "custom_status"
}, now);
ExpectContains(unknown, "[custom_status]");
ExpectContains(unknown, "custom_source");
ExpectContains(unknown, "0 B");

ExpectManualUpload(
    new AppConfig { DeviceStatus = "pending", ServerBaseUrl = "http://localhost" },
    "token",
    canProcess: false,
    expectedMessage: "设备待绑定，请重新绑定后再上传。");
ExpectManualUpload(
    new AppConfig { DeviceStatus = "disabled", ServerBaseUrl = "http://localhost" },
    "token",
    canProcess: false,
    expectedMessage: "设备已被后台禁用，上传队列已暂停。");
ExpectManualUpload(
    new AppConfig { DeviceStatus = "active" },
    "token",
    canProcess: false,
    expectedMessage: "请先配置服务器地址。");
ExpectManualUpload(
    new AppConfig { DeviceStatus = "active", ServerBaseUrl = "ftp://nanpai.eissys.top" },
    "token",
    canProcess: false,
    expectedMessage: "服务器地址必须是 http/https 地址，例如 https://nanpai.eissys.top。");
ExpectManualUpload(
    new AppConfig { DeviceStatus = "active", ServerBaseUrl = "http://localhost" },
    "",
    canProcess: false,
    expectedMessage: "设备未绑定或认证已失效，请先绑定设备。");
ExpectManualUpload(
    new AppConfig { DeviceStatus = "active", ServerBaseUrl = "http://localhost" },
    "token",
    canProcess: true,
    expectedMessage: "正在处理上传队列...");

ExpectProcessResult(
    UploadQueueProcessResult.Busy(),
    UploadQueueProcessOutcome.Busy,
    "上传队列正在处理中，请稍候。");
ExpectProcessResult(
    UploadQueueProcessResult.NoReadyItems(),
    UploadQueueProcessOutcome.NoReadyItems,
    "上传队列暂无待上传文件。");
ExpectProcessResult(
    UploadQueueProcessResult.NoReadyItems(waitingRetryCount: 3, nextRetryAt: now.AddMinutes(4)),
    UploadQueueProcessOutcome.NoReadyItems,
    "暂无到期的上传任务，3 个失败项将在 08:34:00 后重试。");
ExpectProcessResult(
    UploadQueueProcessResult.NoReadyItems(exhaustedRetryCount: 2),
    UploadQueueProcessOutcome.NoReadyItems,
    "暂无可处理的上传任务，2 个失败项已达到最大重试次数。");
ExpectProcessResult(
    UploadQueueProcessResult.Completed(uploadedCount: 2, duplicateCount: 1, missingFileCount: 1),
    UploadQueueProcessOutcome.Completed,
    "上传队列处理完成：上传 2 个，重复 1 个，本地缺失 1 个。");
ExpectProcessResult(
    UploadQueueProcessResult.StoppedOnFailure("network timeout", 1, 0, 0, 1),
    UploadQueueProcessOutcome.StoppedOnFailure,
    "上传失败：network timeout，将按重试策略稍后继续。");
ExpectProcessResult(
    UploadQueueProcessResult.StoppedOnAuthFailure(0, 0, 0, 0),
    UploadQueueProcessOutcome.StoppedOnAuthFailure,
    "设备认证失效，上传队列已暂停，请重新绑定后继续。");

static void ExpectManualUpload(AppConfig config, string token, bool canProcess, string expectedMessage)
{
    var state = CollectorManualUploadPolicy.Evaluate(config, token);
    if (state.CanProcess != canProcess || state.StatusMessage != expectedMessage)
    {
        throw new InvalidOperationException(
            $"Unexpected manual upload state: {state.CanProcess}/{state.StatusMessage}");
    }
}

static void ExpectProcessResult(
    UploadQueueProcessResult result,
    UploadQueueProcessOutcome expectedOutcome,
    string expectedMessage)
{
    if (result.Outcome != expectedOutcome || result.StatusMessage != expectedMessage)
    {
        throw new InvalidOperationException(
            $"Unexpected process result: {result.Outcome}/{result.StatusMessage}");
    }
}

static void ExpectContains(string text, string expected)
{
    if (!text.Contains(expected, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"Expected '{text}' to contain '{expected}'.");
    }
}

static void ExpectNotContains(string text, string unexpected)
{
    if (text.Contains(unexpected, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"Expected '{text}' not to contain '{unexpected}'.");
    }
}
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

  console.log('PASS: collector upload queue display regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
