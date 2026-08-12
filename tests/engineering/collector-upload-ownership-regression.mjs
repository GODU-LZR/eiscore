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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-upload-ownership-'))
const project = join(workDir, 'CollectorUploadOwnershipSmoke.csproj')
const appConfig = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/AppConfig.cs')
const bindingModels = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/BindingModels.cs')
const collectorHealthSnapshot = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/CollectorHealthSnapshot.cs')
const clientLogEvent = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs')
const queueModels = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/QueueModels.cs')
const uploadOwner = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/UploadOwnerContext.cs')
const dropUploadSourcePolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorDropUploadSourcePolicy.cs')
const policy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorUploadOwnershipPolicy.cs')
const apiClient = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs')
const deviceAuthException = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorDeviceAuthException.cs')
const deviceBindException = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorDeviceBindException.cs')
const serverAddressPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs')

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
    <Compile Include="${appConfig}" Link="AppConfig.cs" />
    <Compile Include="${bindingModels}" Link="BindingModels.cs" />
    <Compile Include="${collectorHealthSnapshot}" Link="CollectorHealthSnapshot.cs" />
    <Compile Include="${clientLogEvent}" Link="ClientLogEvent.cs" />
    <Compile Include="${queueModels}" Link="QueueModels.cs" />
    <Compile Include="${uploadOwner}" Link="UploadOwnerContext.cs" />
    <Compile Include="${dropUploadSourcePolicy}" Link="CollectorDropUploadSourcePolicy.cs" />
    <Compile Include="${policy}" Link="CollectorUploadOwnershipPolicy.cs" />
    <Compile Include="${apiClient}" Link="CollectorApiClient.cs" />
    <Compile Include="${deviceAuthException}" Link="CollectorDeviceAuthException.cs" />
    <Compile Include="${deviceBindException}" Link="CollectorDeviceBindException.cs" />
    <Compile Include="${serverAddressPolicy}" Link="CollectorServerAddressPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using System.Reflection;
using System.Text.Json;
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var config = new AppConfig
{
    DefaultUserId = "device-user",
    DefaultUsername = "device-operator",
    DefaultRole = "device-role"
};

var webOwner = new UploadOwnerContext
{
    UserId = "web-user",
    Username = "web-operator",
    Role = "purchase"
};

Expect(
    CollectorUploadOwnershipPolicy.Resolve("manual_drag_drop", config),
    "device-user",
    "device-operator",
    "device-role",
    "device_default_user",
    "manual upload without WebView context should use device default owner");

var roleOnlyConfig = new AppConfig { DefaultRole = "warehouse" };
Expect(
    CollectorUploadOwnershipPolicy.Resolve("manual_drag_drop", roleOnlyConfig),
    "",
    "",
    "warehouse",
    "unknown",
    "device default role without a user identity should preserve the role but mark unknown upload owner");

Expect(
    CollectorUploadOwnershipPolicy.Resolve("manual_selected_file", config),
    "device-user",
    "device-operator",
    "device-role",
    "manual_selected_user",
    "native file picker upload without WebView context should mark manual selected provenance");

Expect(
    CollectorUploadOwnershipPolicy.Resolve("manual_drag_drop", config, webOwner: webOwner),
    "web-user",
    "web-operator",
    "purchase",
    "web_login_user",
    "manual upload with WebView context should use login user");

Expect(
    CollectorUploadOwnershipPolicy.Resolve("web_drag_drop", config),
    "device-user",
    "device-operator",
    "device-role",
    "device_default_user",
    "web drag source without a login user snapshot should fall back to device default provenance");

Expect(
    CollectorUploadOwnershipPolicy.Resolve("web_drag_drop", config, webOwner: webOwner),
    "web-user",
    "web-operator",
    "purchase",
    "web_login_user",
    "web drag source with a login user snapshot should use web login provenance");

Expect(
    CollectorUploadOwnershipPolicy.Resolve("watch_folder", config, new WatchFolderConfig
    {
        DefaultUserId = "folder-user",
        DefaultUsername = "folder-operator",
        DefaultRole = "warehouse"
    }, webOwner),
    "folder-user",
    "folder-operator",
    "warehouse",
    "folder_binding_user",
    "watch folder binding should not inherit WebView context");

var userIdOnly = new UploadOwnerContext { UserId = "web-user-only" };
Expect(
    CollectorUploadOwnershipPolicy.Resolve("manual_selected_file", config, webOwner: userIdOnly),
    "web-user-only",
    "device-operator",
    "device-role",
    "web_login_user",
    "partial WebView context should override only present fields and keep web provenance");

ExpectSource(
    CollectorDropUploadSourcePolicy.Resolve(null),
    "manual_drag_drop",
    "desktop drop without Web login context should be recorded as window drag");

ExpectSource(
    CollectorDropUploadSourcePolicy.Resolve(new UploadOwnerContext()),
    "manual_drag_drop",
    "empty Web login context should not be recorded as Web drag");

ExpectSource(
    CollectorDropUploadSourcePolicy.Resolve(webOwner),
    "web_drag_drop",
    "desktop drop with Web login context should be recorded as Web drag");

var metadataConfig = new AppConfig
{
    EnterpriseCode = "tenant-nanpai",
    DeviceId = "device-1",
    DeviceName = "Collector 1",
    DefaultUserId = "device-user",
    DefaultUsername = "device-operator",
    DefaultRole = "device-role"
};

ExpectOperatorSource(
    metadataConfig,
    new UploadQueueItem
    {
        UploadSource = "web_drag_drop",
        UploadedByUserId = "device-user",
        UploadedByUsername = "device-operator",
        UploadedByRole = "device-role"
    },
    "device_default_user",
    "legacy Web drag queue rows without a distinct login snapshot should not be marked as Web login uploads");

ExpectOperatorSource(
    metadataConfig,
    new UploadQueueItem
    {
        UploadSource = "web_drag_drop",
        UploadedByUserId = "web-user",
        UploadedByUsername = "web-operator",
        UploadedByRole = "purchase"
    },
    "web_login_user",
    "legacy Web drag queue rows with a distinct login snapshot should keep Web login provenance");

ExpectOperatorSource(
    metadataConfig,
    new UploadQueueItem
    {
        UploadSource = "manual_selected_file",
        UploadedByUserId = "device-user",
        UploadedByUsername = "device-operator",
        UploadedByRole = "device-role"
    },
    "manual_selected_user",
    "legacy native file picker queue rows should keep manual selected provenance");

ExpectOperatorSource(
    metadataConfig,
    new UploadQueueItem
    {
        UploadSource = "web_drag_drop",
        OperatorSource = "web_login_user",
        UploadedByUserId = "device-user",
        UploadedByUsername = "device-operator",
        UploadedByRole = "device-role"
    },
    "web_login_user",
    "explicit queued operator source should be preserved");

ExpectOperatorSource(
    new AppConfig { DefaultRole = "warehouse" },
    new UploadQueueItem { UploadSource = "manual_drag_drop" },
    "unknown",
    "upload metadata without user id or username should be marked as unknown even when a default role exists");

ExpectMetadataProperty(
    new AppConfig { DefaultRole = "warehouse" },
    new UploadQueueItem { UploadSource = "manual_drag_drop" },
    "uploaded_by_role",
    "warehouse",
    "upload metadata should keep the device default role for unknown upload owners");

ExpectMetadataProperty(
    metadataConfig,
    new UploadQueueItem
    {
        UploadSource = "watch_folder",
        UploadedByUserId = "device-user",
        UploadedByUsername = "device-operator",
        UploadedByRole = "device-role"
    },
    "enterprise_code",
    "tenant-nanpai",
    "upload metadata should include the configured tenant/enterprise code");

ExpectMetadataProperty(
    metadataConfig,
    new UploadQueueItem
    {
        UploadSource = "watch_folder",
        UploadedByUserId = "device-user",
        UploadedByUsername = "device-operator",
        UploadedByRole = "device-role"
    },
    "tenant_id",
    "tenant-nanpai",
    "upload metadata should expose tenant_id as an alias for collector probes and backend lineage");

static void Expect(
    UploadOwnership actual,
    string userId,
    string username,
    string role,
    string operatorSource,
    string message)
{
    if (actual.UploadedByUserId != userId
        || actual.UploadedByUsername != username
        || actual.UploadedByRole != role
        || actual.OperatorSource != operatorSource)
    {
        throw new InvalidOperationException(
            $"{message}: got {actual.UploadedByUserId}/{actual.UploadedByUsername}/{actual.UploadedByRole}/{actual.OperatorSource}.");
    }
}

static void ExpectOperatorSource(AppConfig config, UploadQueueItem item, string expected, string message)
{
    var method = typeof(CollectorApiClient).GetMethod(
        "BuildUploadMetadata",
        BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("CollectorApiClient.BuildUploadMetadata was not found.");
    var metadata = method.Invoke(null, new object[] { item, config })
        ?? throw new InvalidOperationException("BuildUploadMetadata returned null.");
    var json = JsonSerializer.Serialize(metadata);
    using var document = JsonDocument.Parse(json);
    var actual = document.RootElement.GetProperty("operator_source").GetString();
    if (!string.Equals(actual, expected, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
    }
}

static void ExpectMetadataProperty(AppConfig config, UploadQueueItem item, string propertyName, string expected, string message)
{
    var method = typeof(CollectorApiClient).GetMethod(
        "BuildUploadMetadata",
        BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("CollectorApiClient.BuildUploadMetadata was not found.");
    var metadata = method.Invoke(null, new object[] { item, config })
        ?? throw new InvalidOperationException("BuildUploadMetadata returned null.");
    var json = JsonSerializer.Serialize(metadata);
    using var document = JsonDocument.Parse(json);
    var actual = document.RootElement.GetProperty(propertyName).GetString();
    if (!string.Equals(actual, expected, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
    }
}

static void ExpectSource(string actual, string expected, string message)
{
    if (!string.Equals(actual, expected, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
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

  console.log('PASS: collector upload ownership regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
