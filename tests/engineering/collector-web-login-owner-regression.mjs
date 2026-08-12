// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const localDotnet = '/home/lzr/.dotnet/dotnet'
const dotnet = process.env.DOTNET_ROOT
  ? join(process.env.DOTNET_ROOT, 'dotnet')
  : existsSync(localDotnet)
    ? localDotnet
    : 'dotnet'
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-web-login-owner-'))
const project = join(workDir, 'CollectorWebLoginOwnerSmoke.csproj')
const appConfig = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/AppConfig.cs')
const uploadOwner = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/UploadOwnerContext.cs')
const policy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorWebLoginOwnerDefaultPolicy.cs')
const mainWindow = resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml.cs')
const mainWindowXaml = resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml')

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
    <Compile Include="${uploadOwner}" Link="UploadOwnerContext.cs" />
    <Compile Include="${policy}" Link="CollectorWebLoginOwnerDefaultPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var owner = new UploadOwnerContext
{
    UserId = "u-1001",
    Username = "Twist",
    Role = "采购经理",
    TenantId = "nanpai",
    TenantName = "南派食品",
    DepartmentName = "采购部",
    LoginContextSource = "/agent/api/auth/me",
    LastSyncedAt = new DateTimeOffset(2026, 6, 26, 10, 30, 0, TimeSpan.Zero)
};

var ownerClone = owner.Clone();
ExpectEqual(ownerClone.LoginContextSource, "/agent/api/auth/me", "login context source should be preserved when cloning upload owner context");
if (ownerClone.LastSyncedAt != owner.LastSyncedAt)
{
    throw new InvalidOperationException("login context sync timestamp should be preserved when cloning upload owner context.");
}

var resolved = CollectorWebLoginOwnerDefaultPolicy.Resolve(owner);
ExpectEqual(resolved.EnterpriseCode, "nanpai", "tenant id should be preferred as enterprise code");
ExpectEqual(resolved.DefaultUserId, "u-1001", "user id should map to default upload user id");
ExpectEqual(resolved.DefaultUsername, "Twist", "username should map to default upload username");
ExpectEqual(resolved.DefaultRole, "采购经理", "explicit role should be preferred over department");

var blankConfig = new AppConfig();
ExpectTrue(
    CollectorWebLoginOwnerDefaultPolicy.Apply(blankConfig, owner, overwrite: false),
    "blank defaults should be filled from Web login owner");
ExpectEqual(blankConfig.EnterpriseCode, "nanpai", "blank enterprise should be filled");
ExpectEqual(blankConfig.DefaultUserId, "u-1001", "blank default user id should be filled");
ExpectEqual(blankConfig.DefaultUsername, "Twist", "blank default username should be filled");
ExpectEqual(blankConfig.DefaultRole, "采购经理", "blank default role should be filled");

var existingConfig = new AppConfig
{
    EnterpriseCode = "old-tenant",
    DefaultUserId = "old-user",
    DefaultUsername = "Old Name",
    DefaultRole = "旧岗位"
};
ExpectFalse(
    CollectorWebLoginOwnerDefaultPolicy.Apply(existingConfig, owner, overwrite: false),
    "non-overwrite sync should preserve existing defaults");
ExpectEqual(existingConfig.EnterpriseCode, "old-tenant", "non-overwrite should keep enterprise");
ExpectEqual(existingConfig.DefaultUserId, "old-user", "non-overwrite should keep user id");
ExpectEqual(existingConfig.DefaultUsername, "Old Name", "non-overwrite should keep username");
ExpectEqual(existingConfig.DefaultRole, "旧岗位", "non-overwrite should keep role");

ExpectTrue(
    CollectorWebLoginOwnerDefaultPolicy.Apply(existingConfig, owner, overwrite: true),
    "manual sync should overwrite existing defaults");
ExpectEqual(existingConfig.EnterpriseCode, "nanpai", "overwrite should replace enterprise");
ExpectEqual(existingConfig.DefaultUserId, "u-1001", "overwrite should replace user id");
ExpectEqual(existingConfig.DefaultUsername, "Twist", "overwrite should replace username");
ExpectEqual(existingConfig.DefaultRole, "采购经理", "overwrite should replace role");

var fallbackOwner = new UploadOwnerContext
{
    Username = "陈质量",
    TenantName = "质量租户",
    DepartmentName = "质检部"
};
var fallback = CollectorWebLoginOwnerDefaultPolicy.Resolve(fallbackOwner);
ExpectEqual(fallback.EnterpriseCode, "质量租户", "tenant name should be used when tenant id is absent");
ExpectEqual(fallback.DefaultRole, "质检部", "department should be used when role is absent");

var noContextConfig = new AppConfig { DefaultUsername = "unchanged" };
ExpectFalse(
    CollectorWebLoginOwnerDefaultPolicy.Apply(noContextConfig, new UploadOwnerContext(), overwrite: true),
    "empty owner context should not update config");
ExpectEqual(noContextConfig.DefaultUsername, "unchanged", "empty context should preserve defaults");

ExpectDisplayState(
    CollectorWebLoginOwnerDefaultPolicy.ResolveDisplayStatus(new UploadOwnerContext(), new AppConfig()),
    "missing_context",
    "未同步",
    "刷新网页登录用户",
    "#64748B",
    "missing Web login context should explain that no user is synced");

ExpectDisplayState(
    CollectorWebLoginOwnerDefaultPolicy.ResolveDisplayStatus(owner, new AppConfig()),
    "pending_auto_save",
    "未保存",
    "自动保存中",
    "#2563EB",
    "blank defaults should show that Web login defaults are waiting for auto-save");

ExpectDisplayState(
    CollectorWebLoginOwnerDefaultPolicy.ResolveDisplayStatus(owner, blankConfig),
    "auto_saved",
    "已自动保存",
    "刷新网页登录用户",
    "#047857",
    "defaults matching the Web login owner should show persisted state");

ExpectDisplayState(
    CollectorWebLoginOwnerDefaultPolicy.ResolveDisplayStatus(owner, new AppConfig
    {
        EnterpriseCode = "old-tenant",
        DefaultUserId = "old-user",
        DefaultUsername = "Old Name",
        DefaultRole = "旧岗位"
    }),
    "manual_override",
    "已手动覆盖",
    "覆盖为网页登录用户",
    "#B45309",
    "configured defaults that differ from Web login owner should show manual override");

static void ExpectTrue(bool value, string message)
{
    if (!value) throw new InvalidOperationException(message);
}

static void ExpectFalse(bool value, string message)
{
    if (value) throw new InvalidOperationException(message);
}

static void ExpectEqual(string actual, string expected, string message)
{
    if (!string.Equals(actual, expected, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
    }
}

static void ExpectDisplayState(
    CollectorWebLoginOwnerDisplayStatus actual,
    string expectedState,
    string expectedHintToken,
    string expectedButtonText,
    string expectedHintForeground,
    string message)
{
    if (!string.Equals(actual.State, expectedState, StringComparison.Ordinal)
        || !actual.HintText.Contains(expectedHintToken, StringComparison.Ordinal)
        || !string.Equals(actual.SyncButtonText, expectedButtonText, StringComparison.Ordinal)
        || !string.Equals(actual.HintForeground, expectedHintForeground, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{message}: expected {expectedState}/{expectedHintToken}/{expectedButtonText}/{expectedHintForeground}, got {actual.State}/{actual.HintText}/{actual.SyncButtonText}/{actual.HintForeground}.");
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

  const mainWindowSource = readFileSync(mainWindow, 'utf8')
  const mainWindowXamlSource = readFileSync(mainWindowXaml, 'utf8')
  assertIncludes(
    mainWindowSource,
    'private async Task ApplyWebLoginOwnerChangedAsync(UploadOwnerContext owner)',
    'Web login owner changes should run through an async auto-save path.')
  assertIncludes(
    mainWindowSource,
    'await _configurationService.SaveAsync(_config);',
    'Automatically filled Web login defaults should be persisted without requiring a separate save click.')
  assertIncludes(
    mainWindowSource,
    'collector_web_login_owner_auto_save_failed',
    'Failed auto-save attempts should be logged for field diagnosis.')
  assertIncludes(
    mainWindowSource,
    'overwrite: false',
    'Automatic Web login sync should only fill missing defaults, not overwrite configured owners.')
  assertIncludes(
    mainWindowSource,
    'var displayStatus = CollectorWebLoginOwnerDefaultPolicy.ResolveDisplayStatus(owner, _config);',
    'Settings dialog Web login hint and button text should be driven by the tested display-state policy.')
  assertIncludes(
    mainWindowSource,
    'SyncWebLoginOwnerButton.Content = displayStatus.SyncButtonText;',
    'Settings dialog Web login sync button should reflect the current display state.')
  assertIncludes(
    mainWindowSource,
    'WebLoginOwnerHintText.Foreground = BuildBrush(displayStatus.HintForeground, "#64748B");',
    'Settings dialog Web login hint color should reflect the current display state.')
  assertIncludes(
    mainWindowSource,
    'WebLoginSourceText.Text = DisplayIdentityValue(FormatWebLoginSource(owner.LoginContextSource));',
    'Settings dialog should show where the Web login owner was detected.')
  assertIncludes(
    mainWindowSource,
    'WebLoginSyncedAtText.Text = DisplayIdentityValue(FormatWebLoginSyncedAt(owner.LastSyncedAt));',
    'Settings dialog should show when the Web login owner was last synced.')
  assertIncludes(
    mainWindowSource,
    '浏览器本地存储',
    'Settings dialog should make localStorage login-owner sources readable.')
  assertIncludes(
    mainWindowSource,
    '当前用户接口',
    'Settings dialog should make current-user API login-owner sources readable.')
  assertIncludes(
    mainWindowXamlSource,
    'x:Name="WebLoginOwnerHintText"',
    'Settings dialog should expose a Web login owner hint text element.')
  assertIncludes(
    mainWindowXamlSource,
    'x:Name="WebLoginSourceText"',
    'Settings dialog should expose the Web login context source.')
  assertIncludes(
    mainWindowXamlSource,
    'x:Name="WebLoginSyncedAtText"',
    'Settings dialog should expose the Web login context sync time.')
  assertIncludes(
    mainWindowXamlSource,
    'Content="刷新网页登录用户"',
    'Settings dialog should use a neutral initial Web login sync button label.')
  assertIncludes(
    mainWindowXamlSource,
    'TextWrapping="Wrap"',
    'Long Web login owner status hints should wrap inside the settings popup.')

  console.log('PASS: collector web login owner regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}
