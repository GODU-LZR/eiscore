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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-webview-startup-policy-'))
const project = join(workDir, 'CollectorWebViewStartupPolicySmoke.csproj')
const policy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorWebViewStartupPolicy.cs')

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
    <Compile Include="${policy}" Link="CollectorWebViewStartupPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Services;

var initialized = false;
var success = await CollectorWebViewStartupPolicy.TryInitializeAsync(() =>
{
    initialized = true;
    return Task.CompletedTask;
});
if (!initialized || !success.IsAvailable || success.Exception is not null || success.StatusMessage != "采集端已启动。")
{
    throw new InvalidOperationException("Successful WebView initialization should be marked available.");
}

var failure = await CollectorWebViewStartupPolicy.TryInitializeAsync(() =>
    throw new InvalidOperationException("webview runtime missing"));
if (failure.IsAvailable
    || failure.Exception is not InvalidOperationException
    || failure.StatusMessage != "采集端已启动，WebView 初始化失败，本地文件采集、上传队列和日志后台循环继续运行。")
{
    throw new InvalidOperationException("WebView startup failures should be downgraded so collector startup can continue.");
}

try
{
    await CollectorWebViewStartupPolicy.TryInitializeAsync(() => throw new OperationCanceledException("closing"));
    throw new InvalidOperationException("OperationCanceledException should not be downgraded.");
}
catch (OperationCanceledException)
{
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

  console.log('PASS: collector webview startup policy regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
