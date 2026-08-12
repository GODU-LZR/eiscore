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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-webview-log-policy-'))
const project = join(workDir, 'CollectorWebViewLogPolicySmoke.csproj')
const policy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/WebViewLogPolicy.cs')
const messagePolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/WebViewMessagePolicy.cs')
const originPolicy = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorWebViewMessageOriginPolicy.cs')
const bridge = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/WebViewLogBridge.cs')
const mainWindow = resolve(repoRoot, 'collector-desktop/EISCore.Collector/MainWindow.xaml')
const collectorBridge = resolve(repoRoot, 'eiscore-base/src/utils/collector-bridge.js')
const realtimeIndex = resolve(repoRoot, 'realtime/index.js')

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
    <Compile Include="${policy}" Link="WebViewLogPolicy.cs" />
    <Compile Include="${messagePolicy}" Link="WebViewMessagePolicy.cs" />
    <Compile Include="${originPolicy}" Link="CollectorWebViewMessageOriginPolicy.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using System.Text.Json;
using EISCore.Collector.Services;

Expect(false, 200, "2xx should not be logged");
Expect(false, 304, "3xx should not be logged");
Expect(false, 399, "399 should not be logged");
Expect(true, 400, "400 should be logged");
Expect(true, 404, "404 should be logged");
Expect(true, 500, "500 should be logged");

if (!WebViewLogPolicy.ShouldIgnoreRequestUrl("https://nanpai.eissys.top/api/auth/me?__eiscore_collector_probe=login-context"))
{
    throw new InvalidOperationException("Collector login context probes should be excluded from WebView HTTP error logs.");
}
if (WebViewLogPolicy.ShouldIgnoreRequestUrl("https://nanpai.eissys.top/api/auth/me"))
{
    throw new InvalidOperationException("Normal WebView requests should not be excluded from HTTP error logs.");
}

if (WebViewLogPolicy.ResolveHttpLevel(400) != "warn" || WebViewLogPolicy.ResolveHttpLevel(499) != "warn")
{
    throw new InvalidOperationException("4xx WebView responses should be warning logs.");
}
if (WebViewLogPolicy.ResolveHttpLevel(500) != "error" || WebViewLogPolicy.ResolveHttpLevel(599) != "error")
{
    throw new InvalidOperationException("5xx WebView responses should be error logs.");
}

using var doc = JsonDocument.Parse("""
    {
      "source": "eiscoreCollectorLog",
      "userId": 42,
      "traceId": true,
      "message": { "kind": "object-message", "count": 2 },
      "stack": ["frame-1", "frame-2"],
      "requestUrl": null,
      "statusCode": "503"
    }
    """);
var root = doc.RootElement;
ExpectString("eiscoreCollectorLog", WebViewMessagePolicy.ReadString(root, "source"), "String fields should be preserved.");
ExpectString("42", WebViewMessagePolicy.ReadString(root, "userId"), "Numeric identity fields should not be dropped.");
ExpectString("true", WebViewMessagePolicy.ReadString(root, "traceId"), "Boolean trace fields should not be dropped.");
ExpectString("", WebViewMessagePolicy.ReadString(root, "requestUrl"), "Null fields should fall back to empty strings.");
if (!WebViewMessagePolicy.ReadString(root, "message").Contains("object-message", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Object messages should be kept as compact JSON text.");
}
if (!WebViewMessagePolicy.ReadString(root, "stack").Contains("frame-1", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Array stack payloads should be kept as compact JSON text.");
}
using var loginContextDoc = JsonDocument.Parse("""
    {
      "roles": ["采购经理", "document_intake_admin", "采购经理"],
      "roleObjects": [{ "name": "仓库员" }, { "roleName": "复核员" }],
      "emptyRoles": [null, ""]
    }
    """);
ExpectString(
    "采购经理, document_intake_admin",
    WebViewMessagePolicy.ReadContextString(loginContextDoc.RootElement, "roles"),
    "Login context role arrays should become readable upload roles.");
ExpectString(
    "仓库员, 复核员",
    WebViewMessagePolicy.ReadContextString(loginContextDoc.RootElement, "roleObjects"),
    "Login context object arrays should use readable role names.");
ExpectString(
    "fallback-role",
    WebViewMessagePolicy.ReadContextString(loginContextDoc.RootElement, "emptyRoles", "fallback-role"),
    "Empty login context arrays should use the provided fallback.");
if (WebViewMessagePolicy.ReadStatusCode(root) != 503)
{
    throw new InvalidOperationException("String statusCode should be parsed as an integer.");
}

using var invalidStatusDoc = JsonDocument.Parse("""{ "statusCode": "not-a-status" }""");
if (WebViewMessagePolicy.ReadStatusCode(invalidStatusDoc.RootElement) is not null)
{
    throw new InvalidOperationException("Invalid statusCode text should be ignored.");
}

using var paddedStatusDoc = JsonDocument.Parse("""{ "statusCode": " 404 " }""");
if (WebViewMessagePolicy.ReadStatusCode(paddedStatusDoc.RootElement) != 404)
{
    throw new InvalidOperationException("Padded statusCode text should be parsed as an integer.");
}

ExpectOrigin(
    true,
    CollectorWebViewMessageOriginPolicy.Evaluate("https://nanpai.eissys.top", "https://nanpai.eissys.top/apps", ""),
    "same host should be accepted");
ExpectOrigin(
    true,
    CollectorWebViewMessageOriginPolicy.Evaluate("https://nanpai.eissys.top:443/root", "", "https://nanpai.eissys.top/#/home"),
    "payload URL should be accepted as a fallback when WebView source is empty");
ExpectOrigin(
    false,
    CollectorWebViewMessageOriginPolicy.Evaluate("https://nanpai.eissys.top", "http://nanpai.eissys.top/apps", ""),
    "scheme mismatch should be rejected");
ExpectOrigin(
    false,
    CollectorWebViewMessageOriginPolicy.Evaluate("https://nanpai.eissys.top", "https://evil.example/apps", ""),
    "host mismatch should be rejected");
ExpectOrigin(
    false,
    CollectorWebViewMessageOriginPolicy.Evaluate("https://nanpai.eissys.top:8443", "https://nanpai.eissys.top/apps", ""),
    "port mismatch should be rejected");
ExpectOrigin(
    false,
    CollectorWebViewMessageOriginPolicy.Evaluate("", "https://nanpai.eissys.top/apps", ""),
    "invalid trusted server URL should be rejected");

static void Expect(bool expected, int statusCode, string message)
{
    var actual = WebViewLogPolicy.ShouldLogHttpStatus(statusCode);
    if (actual != expected)
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
    }
}

static void ExpectOrigin(bool expected, CollectorWebViewMessageOriginResult actual, string message)
{
    if (actual.CanAccept != expected)
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual.CanAccept}/{actual.Reason}.");
    }
}

static void ExpectString(string expected, string actual, string message)
{
    if (!string.Equals(expected, actual, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{message}: expected {expected}, got {actual}.");
    }
}
`)

try {
  const bridgeSource = readFileSync(bridge, 'utf8')
  const mainWindowSource = readFileSync(mainWindow, 'utf8')
  const collectorBridgeSource = readFileSync(collectorBridge, 'utf8')
  const realtimeIndexSource = readFileSync(realtimeIndex, 'utf8')
  const injectionScript = bridgeSource.match(/private const string InjectionScript = """\r?\n([\s\S]*?)\r?\n\s*""";/)?.[1]
  if (!injectionScript) {
    throw new Error('WebViewLogBridge injection script should remain extractable for syntax checks.')
  }
  new Function('window', 'document', 'history', 'XMLHttpRequest', 'TextDecoder', 'atob', injectionScript)

  assertIncludes(
    bridgeSource,
    'CollectorWebViewMessageOriginPolicy.Evaluate(_trustedServerBaseUrl, e.Source, url)',
    'WebView bridge must validate messages against the actual WebView source URI.')
  assertIncludes(
    bridgeSource,
    'webview_message_untrusted_origin',
    'Rejected WebView message origins should be logged for diagnosis.')
  assertIncludes(
    bridgeSource,
    'UploadOwnerChanged?.Invoke(this, snapshot)',
    'Desktop UI should be notified when Web login owner context changes.')
  assertIncludes(
    bridgeSource,
    'LoginContextSource = FirstNonEmpty(',
    'Desktop WebView bridge should preserve the source of detected login context for operator diagnosis.')
  assertIncludes(
    bridgeSource,
    'LastSyncedAt = ParseTimestamp(ReadString(root, "createdAt")) ?? DateTimeOffset.Now',
    'Desktop WebView bridge should preserve when login context was synced.')
  assertIncludes(
    bridgeSource,
    'ReadString(root, "user_id")',
    'Desktop WebView bridge should accept common backend user id aliases.')
  assertIncludes(
    bridgeSource,
    'ReadFirstNestedContextString(root,',
    'Desktop WebView bridge should accept nested login-owner payloads from custom collector context messages.')
  assertIncludes(
    bridgeSource,
    'new[] { "data", "user", "id" }',
    'Desktop WebView bridge should accept nested data.user ids from current-user responses.')
  assertIncludes(
    bridgeSource,
    'new[] { "currentUser", "username" }',
    'Desktop WebView bridge should accept nested currentUser usernames from business pages.')
  assertIncludes(
    bridgeSource,
    'new[] { "profile", "roles" }',
    'Desktop WebView bridge should accept nested profile role arrays from login profiles.')
  assertIncludes(
    bridgeSource,
    'new[] { "tenant", "code" }',
    'Desktop WebView bridge should accept nested tenant codes from login profiles.')
  assertIncludes(
    bridgeSource,
    'ReadString(root, "employeeNo")',
    'Desktop WebView bridge should accept employee number aliases as upload user ids.')
  assertIncludes(
    bridgeSource,
    'ReadString(root, "staffNo")',
    'Desktop WebView bridge should accept staff number aliases as upload user ids.')
  assertIncludes(
    bridgeSource,
    'ReadContextString(root, "jobTitle")',
    'Desktop WebView bridge should accept common role/position aliases.')
  assertIncludes(
    bridgeSource,
    'ReadContextString(root, "appRole")',
    'Desktop WebView bridge should accept app role aliases from login context.')
  assertIncludes(
    bridgeSource,
    'ReadContextString(root, "roleName")',
    'Desktop WebView bridge should accept readable role-name aliases from login context.')
  assertIncludes(
    bridgeSource,
    'ReadContextString(root, "roles")',
    'Desktop WebView bridge should normalize role arrays from current-user context.')
  assertIncludes(
    bridgeSource,
    'ReadString(root, "tenantId")',
    'Desktop WebView bridge should accept tenant ids from current-user context.')
  assertIncludes(
    bridgeSource,
    'ReadString(root, "departmentId")',
    'Desktop WebView bridge should accept department ids from current-user context.')
  assertIncludes(
    bridgeSource,
    'ReadString(root, "orgCode")',
    'Desktop WebView bridge should accept organization code aliases as tenant ids.')
  assertIncludes(
    bridgeSource,
    'ReadString(root, "deptCode")',
    'Desktop WebView bridge should accept department code aliases as department ids.')
  assertIncludes(
    bridgeSource,
    "eventType: 'fetch_exception'",
    'Injected WebView logger should distinguish fetch network exceptions from HTTP status failures.')
  assertIncludes(
    bridgeSource,
    "eventType: 'xhr_exception'",
    'Injected WebView logger should capture XHR network, timeout, and abort exceptions.')
  assertIncludes(
    bridgeSource,
    'this.__eiscoreRequestMethod',
    'Injected WebView logger should keep request method context for XHR failures.')
  assertIncludes(
    bridgeSource,
    'WebViewLogPolicy.ShouldIgnoreRequestUrl(e.Request.Uri ?? "")',
    'WebView response logging should suppress collector-owned login context probes.')
  assertIncludes(
    bridgeSource,
    'scanStoredLoginContext()',
    'Injected WebView bridge should try same-origin browser storage before network login probes.')
  assertIncludes(
    bridgeSource,
    'readJwtPayload(raw)',
    'Injected WebView bridge should derive current-user context from stored JWT payloads when profile JSON is absent.')
  assertIncludes(
    bridgeSource,
    "stores[s] + ':' + key + ':jwt'",
    'Injected WebView bridge should tag JWT-derived login context sources for diagnosis.')
  assertIncludes(
    bridgeSource,
    "['roles']",
    'Injected WebView bridge should accept common JWT role-array claims as upload roles.')
  assertIncludes(
    bridgeSource,
    "['employeeNo']",
    'Injected WebView bridge should accept employee-number login aliases from storage, JWT, and current-user responses.')
  assertIncludes(
    bridgeSource,
    "['appRole']",
    'Injected WebView bridge should accept app-role login aliases from storage, JWT, and current-user responses.')
  assertIncludes(
    bridgeSource,
    "['orgCode']",
    'Injected WebView bridge should accept organization-code login aliases from storage, JWT, and current-user responses.')
  assertIncludes(
    bridgeSource,
    "['deptCode']",
    'Injected WebView bridge should accept department-code login aliases from storage, JWT, and current-user responses.')
  assertIncludes(
    bridgeSource,
    "'/api/auth/me'",
    'Injected WebView bridge should probe common current-user endpoints after login.')
  assertIncludes(
    bridgeSource,
    'tenantId: firstContextValue(user, root',
    'Injected WebView bridge should normalize tenant context from current-user responses.')
  assertIncludes(
    bridgeSource,
    'departmentName: firstContextValue(user, root',
    'Injected WebView bridge should normalize department context from current-user responses.')
  assertIncludes(
    bridgeSource,
    "'/agent/api/auth/me'",
    'Injected WebView bridge should prefer the deployed agent-runtime current-user endpoint.')
  assertOrder(
    bridgeSource,
    "'/agent/api/auth/me'",
    "'/api/auth/me'",
    'Agent-runtime current-user probes should run before PostgREST /api probes in deployed environments.')
  assertIncludes(
    bridgeSource,
    "'X-EISCore-Collector-Probe': 'login-context'",
    'Injected WebView bridge should mark login probes so they can be suppressed from client error logs.')
  assertIncludes(
    bridgeSource,
    "storage.getItem(keys[i])",
    'Injected WebView bridge should read same-origin auth tokens for current-user probes.')
  assertIncludes(
    bridgeSource,
    "'jwt_token'",
    'Injected WebView bridge should remain compatible with older login pages that store jwt_token.')
  assertIncludes(
    bridgeSource,
    "headers.Authorization = 'Bearer ' + token",
    'Injected WebView bridge should send the stored Bearer token only to same-origin login probes.')
  assertIncludes(
    bridgeSource,
    'syncLoginContext: function ()',
    'Injected WebView bridge should expose a manual current-user sync hook for business pages.')
  assertIncludes(
    mainWindowSource,
    'WebLoginOwnerHintText',
    'Settings popup should expose the current Web login upload owner.')
  assertIncludes(
    mainWindowSource,
    'SyncWebLoginOwnerButton',
    'Settings popup should let operators sync the Web login owner into default uploader fields.')
  assertIncludes(
    mainWindowSource,
    'WebLoginTenantText',
    'Settings popup should show which tenant was detected from Web login context.')
  assertIncludes(
    collectorBridgeSource,
    'collectorLog.setContext(buildCollectorUserContext(userInfo, appModule))',
    'Frontend login context should be sent through the collector bridge helper.')
  assertIncludes(
    collectorBridgeSource,
    'tenantId: info.tenantId',
    'Frontend collector bridge should normalize tenant ids from login profiles.')
  assertIncludes(
    collectorBridgeSource,
    'departmentId: info.departmentId',
    'Frontend collector bridge should normalize department ids from login profiles.')
  assertIncludes(
    collectorBridgeSource,
    'info.displayName',
    'Frontend collector bridge should normalize display names from login profiles.')
  assertIncludes(
    collectorBridgeSource,
    'info.jobTitle',
    'Frontend collector bridge should normalize job title/position fields from login profiles.')
  assertIncludes(
    collectorBridgeSource,
    'info.employeeNo',
    'Frontend collector bridge should normalize employee-number aliases from login profiles.')
  assertIncludes(
    collectorBridgeSource,
    'info.staffName',
    'Frontend collector bridge should normalize staff-name aliases from login profiles.')
  assertIncludes(
    collectorBridgeSource,
    'info.orgCode',
    'Frontend collector bridge should normalize organization-code aliases from login profiles.')
  assertIncludes(
    collectorBridgeSource,
    'info.deptCode',
    'Frontend collector bridge should normalize department-code aliases from login profiles.')
  assertIncludes(
    realtimeIndexSource,
    "pathname === '/api/auth/me'",
    'Realtime gateway should expose a stable current-user endpoint for collector login probes.')
  assertIncludes(
    realtimeIndexSource,
    "pathname === '/api/current-user'",
    'Realtime gateway should expose the recommended current-user endpoint for collector login probes.')
  assertIncludes(
    realtimeIndexSource,
    'buildCurrentUserContext(payload, token)',
    'Realtime current-user endpoint should return a normalized login context.')
  assertIncludes(
    realtimeIndexSource,
    'X-EISCore-Collector-Probe',
    'Realtime CORS headers should allow collector login probes when a browser preflight occurs.')
  assertIncludes(
    realtimeIndexSource,
    'permissions: user.permissions',
    'Realtime current-user endpoint should expose sanitized permissions but not the raw token.')
  assertIncludes(
    realtimeIndexSource,
    'tenant_id: tenantId',
    'Realtime current-user endpoint should expose tenant aliases for desktop collector probes.')
  assertIncludes(
    realtimeIndexSource,
    'department_id: departmentId',
    'Realtime current-user endpoint should expose department aliases for desktop collector probes.')
  assertIncludes(
    realtimeIndexSource,
    'employeeNo: employeeId',
    'Realtime current-user endpoint should expose employee-number aliases for desktop collector probes.')
  assertIncludes(
    realtimeIndexSource,
    'org_code: firstNonEmptyText',
    'Realtime current-user endpoint should expose organization-code aliases for desktop collector probes.')
  assertIncludes(
    realtimeIndexSource,
    'dept_code: firstNonEmptyText',
    'Realtime current-user endpoint should expose department-code aliases for desktop collector probes.')

  const result = spawnSync(dotnet, ['run', '--project', project], {
    cwd: repoRoot,
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector webview log policy regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

function assertIncludes(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message)
  }
}

function assertOrder(source, first, second, message) {
  const firstIndex = source.indexOf(first)
  const secondIndex = source.indexOf(second)
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    throw new Error(message)
  }
}
