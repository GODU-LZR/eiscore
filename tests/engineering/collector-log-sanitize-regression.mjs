// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-collector-log-sanitize-'))
const dataDir = join(workDir, 'collector-data')

const servicePath = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/ClientLogService.cs')
const metadataPath = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs')
const storePath = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs')
const sqlitePath = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs')
const appPathsPath = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Services/AppPaths.cs')
const appConfigPath = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/AppConfig.cs')
const clientLogEventPath = resolve(repoRoot, 'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs')
const csprojPath = join(workDir, 'CollectorLogSanitizeSmoke.csproj')

writeFileSync(csprojPath, `\
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
    <Compile Include="${servicePath}" Link="ClientLogService.cs" />
    <Compile Include="${metadataPath}" Link="ClientLogMetadata.cs" />
    <Compile Include="${storePath}" Link="ClientLogStore.cs" />
    <Compile Include="${sqlitePath}" Link="CollectorSqlite.cs" />
    <Compile Include="${appPathsPath}" Link="AppPaths.cs" />
    <Compile Include="${appConfigPath}" Link="AppConfig.cs" />
    <Compile Include="${clientLogEventPath}" Link="ClientLogEvent.cs" />
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using EISCore.Collector.Models;
using EISCore.Collector.Services;
using System.Text.Json;

namespace CollectorLogSanitizeSmoke
{
    public static class Program
    {
        public static async Task Main()
        {
            var sample = """
                {"token":"secretJsonToken","authorizationCode":"secretAuthorizationCode","bindCode":"secretBindCode","binding_code":"secretBindingCode","deviceBindCode":"secretDeviceBindCode","clientSecret":"secretJsonClientSecret","csrf_token":"secretJsonCsrfToken","x-csrf-token":"secretJsonHeaderCsrfToken","accessToken":"secretCamelAccess","refreshToken":"secretCamelRefresh","apiKey":"secretCamelApiKey","headers":{"authorization":"Bearer secretJsonBearer","cookie":"sid=secretCookie"},"url":"https://user:secretUrlPassword@example.test/api?access_token=secretAccessToken&refreshToken=secretQueryRefresh&apiKey=secretQueryApiKey&authorizationCode=secretQueryAuthorizationCode&bind_code=secretQueryBindCode&client_secret=secretQueryClientSecret&csrfToken=secretQueryCsrfToken&x-csrf-token=secretQueryHeaderCsrfToken&password=secretPassword","device_token":"secretDeviceToken"}
                Authorization: Bearer secretHeaderBearer
                inline scheme Bearer secretInlineBearer
                raw jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzZWNyZXRVc2VyIiwiZXhwIjo5OTk5OTk5OTk5fQ.XYzSecretSignaturePart
                refresh_token=secretRefreshToken authCode=secretAssignedAuthCode bindingCode=secretAssignedBindingCode clientSecret=secretAssignedClientSecret csrf_token=secretAssignedCsrfToken xCsrfToken=secretAssignedHeaderCsrfToken phone=13812345678 id=110105199001011234
                """;

            var sanitized = ClientLogService.Sanitize(sample);
            AssertDoesNotContain(sanitized, "secretJsonToken");
            AssertDoesNotContain(sanitized, "secretAuthorizationCode");
            AssertDoesNotContain(sanitized, "secretBindCode");
            AssertDoesNotContain(sanitized, "secretBindingCode");
            AssertDoesNotContain(sanitized, "secretDeviceBindCode");
            AssertDoesNotContain(sanitized, "secretJsonClientSecret");
            AssertDoesNotContain(sanitized, "secretJsonCsrfToken");
            AssertDoesNotContain(sanitized, "secretJsonHeaderCsrfToken");
            AssertDoesNotContain(sanitized, "secretCamelAccess");
            AssertDoesNotContain(sanitized, "secretCamelRefresh");
            AssertDoesNotContain(sanitized, "secretCamelApiKey");
            AssertDoesNotContain(sanitized, "secretJsonBearer");
            AssertDoesNotContain(sanitized, "secretCookie");
            AssertDoesNotContain(sanitized, "secretUrlPassword");
            AssertDoesNotContain(sanitized, "secretAccessToken");
            AssertDoesNotContain(sanitized, "secretQueryRefresh");
            AssertDoesNotContain(sanitized, "secretQueryApiKey");
            AssertDoesNotContain(sanitized, "secretQueryAuthorizationCode");
            AssertDoesNotContain(sanitized, "secretQueryBindCode");
            AssertDoesNotContain(sanitized, "secretQueryClientSecret");
            AssertDoesNotContain(sanitized, "secretQueryCsrfToken");
            AssertDoesNotContain(sanitized, "secretQueryHeaderCsrfToken");
            AssertDoesNotContain(sanitized, "secretPassword");
            AssertDoesNotContain(sanitized, "secretDeviceToken");
            AssertDoesNotContain(sanitized, "secretHeaderBearer");
            AssertDoesNotContain(sanitized, "secretInlineBearer");
            AssertDoesNotContain(sanitized, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
            AssertDoesNotContain(sanitized, "eyJzdWIiOiJzZWNyZXRVc2VyIiwiZXhwIjo5OTk5OTk5OTk5fQ");
            AssertDoesNotContain(sanitized, "XYzSecretSignaturePart");
            AssertDoesNotContain(sanitized, "secretRefreshToken");
            AssertDoesNotContain(sanitized, "secretAssignedAuthCode");
            AssertDoesNotContain(sanitized, "secretAssignedBindingCode");
            AssertDoesNotContain(sanitized, "secretAssignedClientSecret");
            AssertDoesNotContain(sanitized, "secretAssignedCsrfToken");
            AssertDoesNotContain(sanitized, "secretAssignedHeaderCsrfToken");
            AssertDoesNotContain(sanitized, "13812345678");
            AssertDoesNotContain(sanitized, "110105199001011234");

            AssertContains(sanitized, "\"token\":\"***\"");
            AssertContains(sanitized, "\"authorizationCode\":\"***\"");
            AssertContains(sanitized, "\"bindCode\":\"***\"");
            AssertContains(sanitized, "\"binding_code\":\"***\"");
            AssertContains(sanitized, "\"deviceBindCode\":\"***\"");
            AssertContains(sanitized, "\"clientSecret\":\"***\"");
            AssertContains(sanitized, "\"csrf_token\":\"***\"");
            AssertContains(sanitized, "\"x-csrf-token\":\"***\"");
            AssertContains(sanitized, "\"accessToken\":\"***\"");
            AssertContains(sanitized, "\"refreshToken\":\"***\"");
            AssertContains(sanitized, "\"apiKey\":\"***\"");
            AssertContains(sanitized, "Authorization: ***");
            AssertContains(sanitized, "access_token=***");
            AssertContains(sanitized, "refreshToken=***");
            AssertContains(sanitized, "apiKey=***");
            AssertContains(sanitized, "authorizationCode=***");
            AssertContains(sanitized, "bind_code=***");
            AssertContains(sanitized, "client_secret=***");
            AssertContains(sanitized, "csrfToken=***");
            AssertContains(sanitized, "x-csrf-token=***");
            AssertContains(sanitized, "authCode=***");
            AssertContains(sanitized, "bindingCode=***");
            AssertContains(sanitized, "clientSecret=***");
            AssertContains(sanitized, "csrf_token=***");
            AssertContains(sanitized, "xCsrfToken=***");
            AssertContains(sanitized, "Bearer ***");
            AssertContains(sanitized, "https://***@example.test");
            AssertContains(sanitized, "138****5678");
            AssertContains(sanitized, "110105********1234");

            var longText = new string('x', 9000);
            var truncated = ClientLogService.Sanitize(longText);
            if (truncated.Length > 8210 || !truncated.EndsWith("...[truncated]", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Long log text was not truncated as expected.");
            }

            var metadata = ClientLogMetadata.Serialize(new
            {
                sourceFolder = "C:\\inbox\\采购\"A\"\n下一行",
                configVersion = "v1\"quoted\"",
                recoveredCount = 2
            });
            using var document = JsonDocument.Parse(metadata);
            var root = document.RootElement;
            AssertContains(metadata, "source_folder");
            AssertContains(metadata, "config_version");
            if (root.GetProperty("source_folder").GetString() != "C:\\inbox\\采购\"A\"\n下一行")
            {
                throw new InvalidOperationException("Metadata source_folder was not JSON escaped and restored correctly.");
            }
            if (root.GetProperty("config_version").GetString() != "v1\"quoted\"")
            {
                throw new InvalidOperationException("Metadata config_version was not JSON escaped and restored correctly.");
            }
            if (root.GetProperty("recovered_count").GetInt32() != 2)
            {
                throw new InvalidOperationException("Metadata recovered_count was not serialized correctly.");
            }

            var store = new ClientLogStore();
            await store.EnsureCreatedAsync();
            var service = new ClientLogService(store);
            service.UpdateContext(new AppConfig
            {
                DeviceId = "device-1",
                DeviceName = "Collector 1",
                DefaultUserId = "fallback-user",
                DefaultUsername = "fallback-operator",
                DefaultRole = "warehouse",
                ClientVersion = "0.2.0",
                WebViewVersion = "WebView2 126"
            });
            await service.LogAsync(
                "error",
                "webview_secret_leak_probe",
                "Message has client_secret=storedMessageSecret and csrfToken=storedMessageCsrf",
                stack: "Stack has Authorization: Bearer storedStackBearer\nStack has xCsrfToken=storedStackCsrf",
                route: "/upload?client_secret=storedRouteSecret",
                url: "https://user:storedUrlPassword@example.test/page?csrf_token=storedUrlCsrf",
                requestUrl: "https://example.test/api?x-csrf-token=storedRequestCsrf&clientSecret=storedRequestClientSecret",
                metadataJson: "{\"client_secret\":\"storedMetadataClientSecret\",\"csrfToken\":\"storedMetadataCsrf\",\"nested\":{\"x-csrf-token\":\"storedMetadataHeaderCsrf\"}}",
                userId: "authorization=storedUserAuthorization",
                username: "operator",
                role: "warehouse");

            var pending = await store.ListPendingAsync(10);
            if (pending.Count != 1)
            {
                throw new InvalidOperationException($"Expected one pending log row after service write, got {pending.Count}.");
            }

            var stored = pending[0];
            var persistedText = string.Join("\n", new[]
            {
                stored.Message,
                stored.Stack,
                stored.Route,
                stored.Url,
                stored.RequestUrl,
                stored.MetadataJson,
                stored.UserId
            });

            AssertDoesNotContain(persistedText, "storedMessageSecret");
            AssertDoesNotContain(persistedText, "storedMessageCsrf");
            AssertDoesNotContain(persistedText, "storedStackBearer");
            AssertDoesNotContain(persistedText, "storedStackCsrf");
            AssertDoesNotContain(persistedText, "storedRouteSecret");
            AssertDoesNotContain(persistedText, "storedUrlPassword");
            AssertDoesNotContain(persistedText, "storedUrlCsrf");
            AssertDoesNotContain(persistedText, "storedRequestCsrf");
            AssertDoesNotContain(persistedText, "storedRequestClientSecret");
            AssertDoesNotContain(persistedText, "storedMetadataClientSecret");
            AssertDoesNotContain(persistedText, "storedMetadataCsrf");
            AssertDoesNotContain(persistedText, "storedMetadataHeaderCsrf");
            AssertDoesNotContain(persistedText, "storedUserAuthorization");
            AssertContains(stored.Message, "client_secret=***");
            AssertContains(stored.Message, "csrfToken=***");
            AssertContains(stored.Stack, "Authorization: ***");
            AssertContains(stored.Stack, "xCsrfToken=***");
            AssertContains(stored.Route, "client_secret=***");
            AssertContains(stored.Url, "https://***@example.test");
            AssertContains(stored.Url, "csrf_token=***");
            AssertContains(stored.RequestUrl, "x-csrf-token=***");
            AssertContains(stored.RequestUrl, "clientSecret=***");
            AssertContains(stored.MetadataJson, "\"client_secret\":\"***\"");
            AssertContains(stored.MetadataJson, "\"csrfToken\":\"***\"");
            AssertContains(stored.MetadataJson, "\"x-csrf-token\":\"***\"");
            AssertContains(stored.UserId, "authorization=***");
        }

        private static void AssertContains(string value, string expected)
        {
            if (!value.Contains(expected, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Expected sanitized text to contain: {expected}");
            }
        }

        private static void AssertDoesNotContain(string value, string forbidden)
        {
            if (value.Contains(forbidden, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Sensitive value was not redacted: {forbidden}");
            }
        }
    }
}
`)

try {
  const result = spawnSync(dotnet, ['run', '--project', csprojPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      EISCORE_COLLECTOR_DATA_DIR: dataDir,
      DOTNET_ROOT: process.env.DOTNET_ROOT || '/home/lzr/.dotnet',
      PATH: ['/home/lzr/.dotnet', process.env.PATH].filter(Boolean).join(':')
    }
  })

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    process.exit(result.status || 1)
  }

  console.log('PASS: collector log sanitize regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
