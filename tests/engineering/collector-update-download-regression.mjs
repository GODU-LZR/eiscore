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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-update-download-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorUpdateDownloadSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/ClientLogEvent.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogMetadata.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogService.cs',
  'collector-desktop/EISCore.Collector/Services/ClientLogStore.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorSqlite.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateHashPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateInstallerArgumentsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdatePackagePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateUrlPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateVersionPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/UpdatePackageStore.cs',
  'collector-desktop/EISCore.Collector/Services/UpdateService.cs'
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
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR")
    ?? throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
var updateDir = AppPaths.UpdateDirectory;
var installerPath = Path.Combine(updateDir, "EISCore.Collector-0.3.0.exe");
var goodBytes = System.Text.Encoding.UTF8.GetBytes("good installer bytes v0.3.0");
var badBytes = System.Text.Encoding.UTF8.GetBytes("bad installer bytes should not replace the good package");
var goodSha256 = Convert.ToHexString(SHA256.HashData(goodBytes)).ToLowerInvariant();

await using (var goodStream = new MemoryStream(goodBytes))
{
    await UpdatePackageStore.SaveAtomicallyAsync(goodStream, installerPath, goodSha256);
}

if (!File.Exists(installerPath))
{
    throw new InvalidOperationException("Good update package was not saved.");
}
if (!File.ReadAllBytes(installerPath).SequenceEqual(goodBytes))
{
    throw new InvalidOperationException("Good update package content was not saved exactly.");
}
AssertNoTempDownloads(updateDir);

try
{
    await using var badStream = new MemoryStream(badBytes);
    await UpdatePackageStore.SaveAtomicallyAsync(badStream, installerPath, new string('0', 64));
    throw new InvalidOperationException("Bad update package unexpectedly passed SHA256 validation.");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("SHA256", StringComparison.OrdinalIgnoreCase))
{
}

if (!File.ReadAllBytes(installerPath).SequenceEqual(goodBytes))
{
    throw new InvalidOperationException("Failed update download replaced the previous good installer.");
}
AssertNoTempDownloads(updateDir);

var logStore = new ClientLogStore();
await logStore.EnsureCreatedAsync();
var logService = new ClientLogService(logStore);
var updateService = new UpdateService(logService);

var badLogDataDir = Path.Combine(Path.GetDirectoryName(dataDir)!, "collector-data-bad-log-db");
Directory.CreateDirectory(badLogDataDir);
Directory.CreateDirectory(Path.Combine(badLogDataDir, "collector.db"));
Environment.SetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR", badLogDataDir);
var badLogUpdateService = new UpdateService(new ClientLogService(new ClientLogStore()));
var badLogConfig = new AppConfig
{
    AutoUpdateEnabled = true,
    UpdateManifestUrl = "ftp://nanpai.eissys.top/update.json",
    ClientVersion = "0.2.0"
};
if (!await badLogUpdateService.CheckAsync(badLogConfig, force: true))
{
    throw new InvalidOperationException("Update checks should remain handled even when invalid-manifest logging cannot write locally.");
}
if (badLogConfig.LastUpdateCheckAt is null)
{
    throw new InvalidOperationException("Update checks should update LastUpdateCheckAt even when local logging is unavailable.");
}
Environment.SetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR", dataDir);

var invalidManifestConfig = new AppConfig
{
    AutoUpdateEnabled = true,
    UpdateManifestUrl = "ftp://nanpai.eissys.top/update.json",
    ClientVersion = "0.2.0"
};
if (!await updateService.CheckAsync(invalidManifestConfig, force: true))
{
    throw new InvalidOperationException("Invalid manifest URL should still mark the update check as handled.");
}
if (invalidManifestConfig.LastUpdateCheckAt is null)
{
    throw new InvalidOperationException("Invalid manifest URL should update LastUpdateCheckAt to avoid tight retry loops.");
}
var invalidManifestLogs = await logStore.ListPendingAsync(10);
var invalidManifestLog = invalidManifestLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Invalid manifest URL did not create a structured local warning.");
if (!invalidManifestLog.MetadataJson.Contains("invalid_manifest_url", StringComparison.Ordinal)
    || !invalidManifestLog.MetadataJson.Contains("ftp://nanpai.eissys.top/update.json", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Invalid manifest URL warning did not include the expected reason and URL.");
}
await logStore.MarkUploadedAsync(invalidManifestLogs.Select(item => item.Id));

var listener = new TcpListener(IPAddress.Loopback, 0);
listener.Start();
var port = ((IPEndPoint)listener.LocalEndpoint).Port;
var serverTask = Task.Run(async () =>
{
    using var client = await listener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /update.json ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Update manifest request did not target /update.json.");
    }

    var body = """
{
  "version": "0.3.0",
  "download_url": "file:///tmp/EISCore.Collector.exe"
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var invalidDownloadConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{port}/update.json",
        ClientVersion = "0.2.0"
    };
    if (!await updateService.CheckAsync(invalidDownloadConfig, force: true))
    {
        throw new InvalidOperationException("Invalid download URL manifest should still mark the update check as handled.");
    }
}
finally
{
    listener.Stop();
}
await serverTask.WaitAsync(TimeSpan.FromSeconds(5));

var invalidDownloadLogs = await logStore.ListPendingAsync(10);
var invalidDownloadLog = invalidDownloadLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Invalid download URL did not create a structured local warning.");
if (!invalidDownloadLog.MetadataJson.Contains("invalid_download_url", StringComparison.Ordinal)
    || !invalidDownloadLog.MetadataJson.Contains("file:///tmp/EISCore.Collector.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Invalid download URL warning did not include the expected reason and URL.");
}
await logStore.MarkUploadedAsync(invalidDownloadLogs.Select(item => item.Id));

var invalidJsonListener = new TcpListener(IPAddress.Loopback, 0);
invalidJsonListener.Start();
var invalidJsonPort = ((IPEndPoint)invalidJsonListener.LocalEndpoint).Port;
var invalidJsonServerTask = Task.Run(async () =>
{
    using var client = await invalidJsonListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /invalid-json.json ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Invalid JSON manifest requested an unexpected path.");
    }

    var body = "<html>bad gateway</html>";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: text/html\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var invalidJsonConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{invalidJsonPort}/invalid-json.json",
        ClientVersion = "0.2.0"
    };
    if (!await updateService.CheckAsync(invalidJsonConfig, force: true))
    {
        throw new InvalidOperationException("Invalid JSON manifest should still mark the update check as handled.");
    }
}
finally
{
    invalidJsonListener.Stop();
}
await invalidJsonServerTask.WaitAsync(TimeSpan.FromSeconds(5));

var invalidJsonLogs = await logStore.ListPendingAsync(10);
var invalidJsonLog = invalidJsonLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Invalid JSON manifest did not create a structured local warning.");
if (!invalidJsonLog.MetadataJson.Contains("invalid_manifest_json", StringComparison.Ordinal)
    || !invalidJsonLog.MetadataJson.Contains("invalid-json.json", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Invalid JSON manifest warning did not include the expected reason and manifest URL.");
}
await logStore.MarkUploadedAsync(invalidJsonLogs.Select(item => item.Id));

var tooLargeListener = new TcpListener(IPAddress.Loopback, 0);
tooLargeListener.Start();
var tooLargePort = ((IPEndPoint)tooLargeListener.LocalEndpoint).Port;
var tooLargeServerTask = Task.Run(async () =>
{
    using var client = await tooLargeListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /too-large.json ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Oversized manifest requested an unexpected path.");
    }

    var body = new string('x', 128 * 1024 + 1);
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var tooLargeConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{tooLargePort}/too-large.json",
        ClientVersion = "0.2.0"
    };
    if (!await updateService.CheckAsync(tooLargeConfig, force: true))
    {
        throw new InvalidOperationException("Oversized manifest should still mark the update check as handled.");
    }
}
finally
{
    tooLargeListener.Stop();
}
await tooLargeServerTask.WaitAsync(TimeSpan.FromSeconds(5));

var tooLargeLogs = await logStore.ListPendingAsync(10);
var tooLargeLog = tooLargeLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Oversized manifest did not create a structured local warning.");
if (!tooLargeLog.MetadataJson.Contains("manifest_too_large", StringComparison.Ordinal)
    || !tooLargeLog.MetadataJson.Contains("too-large.json", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Oversized manifest warning did not include the expected reason and manifest URL.");
}
await logStore.MarkUploadedAsync(tooLargeLogs.Select(item => item.Id));

var unsupportedPackagePolicy = CollectorUpdatePackagePolicy.Evaluate(
    new Uri("https://nanpai.eissys.top/collector/update.ps1"),
    autoInstallRequested: false);
if (unsupportedPackagePolicy.IsValid || unsupportedPackagePolicy.Reason != "unsupported_package_extension")
{
    throw new InvalidOperationException("Unsupported update package extensions should be rejected.");
}
var zipManualPackagePolicy = CollectorUpdatePackagePolicy.Evaluate(
    new Uri("https://nanpai.eissys.top/collector/EISCore.Collector-0.3.0.zip"),
    autoInstallRequested: false);
if (!zipManualPackagePolicy.IsValid || zipManualPackagePolicy.Extension != ".zip")
{
    throw new InvalidOperationException("ZIP update packages should remain downloadable for non-auto-install manifests.");
}
var zipAutoPackagePolicy = CollectorUpdatePackagePolicy.Evaluate(
    new Uri("https://nanpai.eissys.top/collector/EISCore.Collector-0.3.0.zip"),
    autoInstallRequested: true);
if (zipAutoPackagePolicy.IsValid || zipAutoPackagePolicy.Reason != "unsupported_auto_install_package")
{
    throw new InvalidOperationException("ZIP update packages should not be auto-installed.");
}
var validInstallerArguments = CollectorUpdateInstallerArgumentsPolicy.Evaluate(
    "/VERYSILENT /NORESTART",
    "  /VERYSILENT /NORESTART /CLOSEAPPLICATIONS  ",
    autoInstallRequested: true);
if (!validInstallerArguments.IsValid
    || validInstallerArguments.Arguments != "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS")
{
    throw new InvalidOperationException("Config installer arguments should override manifest arguments and be trimmed.");
}
var newlineInstallerArguments = CollectorUpdateInstallerArgumentsPolicy.Evaluate(
    "/VERYSILENT\n/NORESTART",
    "",
    autoInstallRequested: true);
if (newlineInstallerArguments.IsValid || newlineInstallerArguments.Reason != "invalid_installer_arguments")
{
    throw new InvalidOperationException("Installer arguments with control characters should be rejected.");
}
var longInstallerArguments = CollectorUpdateInstallerArgumentsPolicy.Evaluate(
    "/" + new string('A', 600),
    "",
    autoInstallRequested: true);
if (longInstallerArguments.IsValid || longInstallerArguments.Reason != "installer_arguments_too_long")
{
    throw new InvalidOperationException("Overlong installer arguments should be rejected.");
}
var newerVersion = CollectorUpdateVersionPolicy.Evaluate(" 0.3.0 ", "0.2.0");
if (!newerVersion.IsValid || !newerVersion.IsUpdateAvailable || newerVersion.LatestVersion != "0.3.0")
{
    throw new InvalidOperationException("Newer dotted update versions should be accepted and trimmed.");
}
var sameVersion = CollectorUpdateVersionPolicy.Evaluate("0.2.0", "0.2.0");
if (!sameVersion.IsValid || sameVersion.IsUpdateAvailable)
{
    throw new InvalidOperationException("Matching update versions should not be treated as update available.");
}
var invalidUpdateVersion = CollectorUpdateVersionPolicy.Evaluate("latest", "0.2.0");
if (invalidUpdateVersion.IsValid || invalidUpdateVersion.Reason != "invalid_update_version")
{
    throw new InvalidOperationException("Non-dotted update manifest versions should be rejected.");
}
var invalidCurrentVersion = CollectorUpdateVersionPolicy.Evaluate("0.3.0", "desktop-build");
if (invalidCurrentVersion.IsValid || invalidCurrentVersion.Reason != "invalid_current_version")
{
    throw new InvalidOperationException("Invalid current client versions should be rejected before comparing updates.");
}

var packageListener = new TcpListener(IPAddress.Loopback, 0);
packageListener.Start();
var packagePort = ((IPEndPoint)packageListener.LocalEndpoint).Port;
var unsupportedServerTask = Task.Run(async () =>
{
    using var client = await packageListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /unsupported-package.json ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Unsupported package manifest requested an unexpected path.");
    }

    var body = $$"""
{
  "version": "0.3.0",
  "download_url": "http://127.0.0.1:{{packagePort}}/update.ps1",
  "sha256": "{{goodSha256}}"
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var unsupportedPackageConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{packagePort}/unsupported-package.json",
        ClientVersion = "0.2.0"
    };
    if (!await updateService.CheckAsync(unsupportedPackageConfig, force: true))
    {
        throw new InvalidOperationException("Unsupported package manifest should still mark the update check as handled.");
    }
}
finally
{
    packageListener.Stop();
}
await unsupportedServerTask.WaitAsync(TimeSpan.FromSeconds(5));
var unsupportedPackageLogs = await logStore.ListPendingAsync(10);
var unsupportedPackageLog = unsupportedPackageLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Unsupported package extension did not create a structured local warning.");
if (!unsupportedPackageLog.MetadataJson.Contains("unsupported_package_extension", StringComparison.Ordinal)
    || !unsupportedPackageLog.MetadataJson.Contains("update.ps1", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Unsupported package warning did not include the expected reason and URL.");
}
await logStore.MarkUploadedAsync(unsupportedPackageLogs.Select(item => item.Id));

var zipAutoListener = new TcpListener(IPAddress.Loopback, 0);
zipAutoListener.Start();
var zipAutoPort = ((IPEndPoint)zipAutoListener.LocalEndpoint).Port;
var zipAutoServerTask = Task.Run(async () =>
{
    using var client = await zipAutoListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /zip-auto-install.json ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("ZIP auto-install manifest requested an unexpected path.");
    }

    var body = $$"""
{
  "version": "0.3.0",
  "download_url": "http://127.0.0.1:{{zipAutoPort}}/EISCore.Collector-0.3.0.zip",
  "sha256": "{{goodSha256}}",
  "auto_install": true
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var zipAutoConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{zipAutoPort}/zip-auto-install.json",
        ClientVersion = "0.2.0",
        AutoUpdateInstallEnabled = true
    };
    if (!await updateService.CheckAsync(zipAutoConfig, force: true))
    {
        throw new InvalidOperationException("ZIP auto-install manifest should still mark the update check as handled.");
    }
}
finally
{
    zipAutoListener.Stop();
}
await zipAutoServerTask.WaitAsync(TimeSpan.FromSeconds(5));
var zipAutoLogs = await logStore.ListPendingAsync(10);
var zipAutoLog = zipAutoLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("ZIP auto-install manifest did not create a structured local warning.");
if (!zipAutoLog.MetadataJson.Contains("unsupported_auto_install_package", StringComparison.Ordinal)
    || !zipAutoLog.MetadataJson.Contains(".zip", StringComparison.Ordinal))
{
    throw new InvalidOperationException("ZIP auto-install warning did not include the expected reason and URL.");
}
await logStore.MarkUploadedAsync(zipAutoLogs.Select(item => item.Id));

var argsListener = new TcpListener(IPAddress.Loopback, 0);
argsListener.Start();
var argsPort = ((IPEndPoint)argsListener.LocalEndpoint).Port;
var argsPackageRequested = false;
var argsServerTask = Task.Run(async () =>
{
    using var client = await argsListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /invalid-installer-args.json ", StringComparison.Ordinal))
    {
        argsPackageRequested = requestText.StartsWith("GET /package.exe ", StringComparison.Ordinal);
        throw new InvalidOperationException("Installer argument test requested an unexpected path.");
    }

    var body = $$"""
{
  "version": "0.3.0",
  "download_url": "http://127.0.0.1:{{argsPort}}/package.exe",
  "sha256": "{{goodSha256}}",
  "mandatory": true,
  "auto_install": true,
  "installer_arguments": "/VERYSILENT\n/NORESTART"
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var invalidArgumentsConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{argsPort}/invalid-installer-args.json",
        ClientVersion = "0.2.0"
    };
    if (!await updateService.CheckAsync(invalidArgumentsConfig, force: true))
    {
        throw new InvalidOperationException("Invalid installer arguments manifest should still mark the update check as handled.");
    }
}
finally
{
    argsListener.Stop();
}
await argsServerTask.WaitAsync(TimeSpan.FromSeconds(5));
if (argsPackageRequested)
{
    throw new InvalidOperationException("Invalid installer arguments should be rejected before requesting the package.");
}
var invalidArgsLogs = await logStore.ListPendingAsync(10);
var invalidArgsLog = invalidArgsLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Invalid installer arguments did not create a structured local warning.");
if (!invalidArgsLog.MetadataJson.Contains("invalid_installer_arguments", StringComparison.Ordinal)
    || !invalidArgsLog.MetadataJson.Contains($"http://127.0.0.1:{argsPort}/package.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Invalid installer arguments warning did not include the expected reason and URL.");
}
await logStore.MarkUploadedAsync(invalidArgsLogs.Select(item => item.Id));

var versionListener = new TcpListener(IPAddress.Loopback, 0);
versionListener.Start();
var versionPort = ((IPEndPoint)versionListener.LocalEndpoint).Port;
var versionServerTask = Task.Run(async () =>
{
    using var client = await versionListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /invalid-version.json ", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Invalid version test requested an unexpected path.");
    }

    var body = $$"""
{
  "version": "latest",
  "download_url": "http://127.0.0.1:1/package.exe",
  "sha256": "{{goodSha256}}"
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var invalidVersionConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{versionPort}/invalid-version.json",
        ClientVersion = "0.2.0"
    };
    if (!await updateService.CheckAsync(invalidVersionConfig, force: true))
    {
        throw new InvalidOperationException("Invalid update version manifest should still mark the update check as handled.");
    }
}
finally
{
    versionListener.Stop();
}
await versionServerTask.WaitAsync(TimeSpan.FromSeconds(5));
var invalidVersionLogs = await logStore.ListPendingAsync(10);
var invalidVersionLog = invalidVersionLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Invalid update version did not create a structured local warning.");
if (!invalidVersionLog.MetadataJson.Contains("invalid_update_version", StringComparison.Ordinal)
    || !invalidVersionLog.MetadataJson.Contains("http://127.0.0.1:1/package.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Invalid update version warning did not include the expected reason and download URL.");
}
await logStore.MarkUploadedAsync(invalidVersionLogs.Select(item => item.Id));

var upToDateListener = new TcpListener(IPAddress.Loopback, 0);
upToDateListener.Start();
var upToDatePort = ((IPEndPoint)upToDateListener.LocalEndpoint).Port;
var upToDatePackageRequested = false;
var upToDateServerTask = Task.Run(async () =>
{
    for (var requestIndex = 0; requestIndex < 2; requestIndex++)
    {
        TcpClient client;
        try
        {
            client = await upToDateListener.AcceptTcpClientAsync().WaitAsync(
                requestIndex == 0 ? TimeSpan.FromSeconds(5) : TimeSpan.FromMilliseconds(500));
        }
        catch (TimeoutException) when (requestIndex > 0)
        {
            break;
        }
        catch (SocketException) when (requestIndex > 0)
        {
            break;
        }
        catch (ObjectDisposedException) when (requestIndex > 0)
        {
            break;
        }

        using (client)
        await using (var stream = client.GetStream())
        {
            var buffer = new byte[4096];
            var requestText = "";
            while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
            {
                var read = await stream.ReadAsync(buffer);
                if (read <= 0) break;
                requestText += Encoding.ASCII.GetString(buffer, 0, read);
            }

            if (requestText.StartsWith("GET /up-to-date.json ", StringComparison.Ordinal))
            {
                var body = $$"""
{
  "version": "0.4.0",
  "download_url": "http://127.0.0.1:{{upToDatePort}}/package.exe",
  "sha256": "{{goodSha256}}"
}
""";
                var response = "HTTP/1.1 200 OK\r\n"
                    + "Content-Type: application/json\r\n"
                    + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
                    + "Connection: close\r\n\r\n"
                    + body;
                await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
                continue;
            }

            if (requestText.StartsWith("GET /package.exe ", StringComparison.Ordinal))
            {
                upToDatePackageRequested = true;
                var response = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
                continue;
            }

            throw new InvalidOperationException("Up-to-date manifest requested an unexpected path.");
        }
    }
});

try
{
    var upToDateConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{upToDatePort}/up-to-date.json",
        ClientVersion = "0.4.0",
        PendingUpdateVersion = "0.4.0",
        PendingUpdateInstallerPath = "C:\\old-pending-installer.exe",
        PendingUpdateInstallerProcessId = 9876,
        PendingUpdateInstallerStartedAt = DateTimeOffset.Now.AddMinutes(-2)
    };

    if (!await updateService.CheckAsync(upToDateConfig, force: true))
    {
        throw new InvalidOperationException("Up-to-date manifest should still mark the update check as handled.");
    }
    if (upToDatePackageRequested)
    {
        throw new InvalidOperationException("Up-to-date manifest should not request the update package.");
    }
    if (!string.IsNullOrWhiteSpace(upToDateConfig.PendingUpdateVersion)
        || !string.IsNullOrWhiteSpace(upToDateConfig.PendingUpdateInstallerPath)
        || upToDateConfig.PendingUpdateInstallerProcessId is not null
        || upToDateConfig.PendingUpdateInstallerStartedAt is not null)
    {
        throw new InvalidOperationException("Up-to-date manifest should clear stale pending update state.");
    }
}
finally
{
    upToDateListener.Stop();
}
await upToDateServerTask.WaitAsync(TimeSpan.FromSeconds(5));
var upToDateLogs = await logStore.ListPendingAsync(10);
var upToDateLog = upToDateLogs.SingleOrDefault(item => item.EventType == "collector_update_not_required")
    ?? throw new InvalidOperationException("Up-to-date manifest did not create the expected not-required log.");
if (!upToDateLog.MetadataJson.Contains("pending_update_cleared", StringComparison.Ordinal)
    || !upToDateLog.MetadataJson.Contains("true", StringComparison.Ordinal)
    || !upToDateLog.MetadataJson.Contains($"http://127.0.0.1:{upToDatePort}/up-to-date.json", StringComparison.Ordinal)
    || !upToDateLog.MetadataJson.Contains($"http://127.0.0.1:{upToDatePort}/package.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Up-to-date manifest log did not include stale cleanup and update URL metadata.");
}
await logStore.MarkUploadedAsync(upToDateLogs.Select(item => item.Id));

var hashListener = new TcpListener(IPAddress.Loopback, 0);
hashListener.Start();
var hashPort = ((IPEndPoint)hashListener.LocalEndpoint).Port;
var packageRequested = false;
var hashServerTask = Task.Run(async () =>
{
    using var client = await hashListener.AcceptTcpClientAsync();
    await using var stream = client.GetStream();
    var buffer = new byte[4096];
    var requestText = "";
    while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
    {
        var read = await stream.ReadAsync(buffer);
        if (read <= 0) break;
        requestText += Encoding.ASCII.GetString(buffer, 0, read);
    }

    if (!requestText.StartsWith("GET /update-invalid-sha.json ", StringComparison.Ordinal))
    {
        packageRequested = requestText.StartsWith("GET /package.exe ", StringComparison.Ordinal);
        throw new InvalidOperationException("Update manifest SHA test requested an unexpected path.");
    }

    var body = $$"""
{
  "version": "0.3.0",
  "download_url": "http://127.0.0.1:{{hashPort}}/package.exe",
  "sha256": "not-a-sha"
}
""";
    var response = "HTTP/1.1 200 OK\r\n"
        + "Content-Type: application/json\r\n"
        + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
        + "Connection: close\r\n\r\n"
        + body;
    await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
});

try
{
    var invalidHashConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{hashPort}/update-invalid-sha.json",
        ClientVersion = "0.2.0"
    };
    if (!await updateService.CheckAsync(invalidHashConfig, force: true))
    {
        throw new InvalidOperationException("Invalid SHA256 manifest should still mark the update check as handled.");
    }
}
finally
{
    hashListener.Stop();
}
await hashServerTask.WaitAsync(TimeSpan.FromSeconds(5));
if (packageRequested)
{
    throw new InvalidOperationException("Invalid SHA256 manifest should be rejected before requesting the package.");
}
var invalidHashLogs = await logStore.ListPendingAsync(10);
var invalidHashLog = invalidHashLogs.SingleOrDefault(item => item.EventType == "collector_update_manifest_invalid")
    ?? throw new InvalidOperationException("Invalid SHA256 manifest did not create a structured local warning.");
if (!invalidHashLog.MetadataJson.Contains("invalid_sha256", StringComparison.Ordinal)
    || !invalidHashLog.MetadataJson.Contains($"http://127.0.0.1:{hashPort}/package.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Invalid SHA256 warning did not include the expected reason and download URL.");
}
await logStore.MarkUploadedAsync(invalidHashLogs.Select(item => item.Id));

var downloadFailureListener = new TcpListener(IPAddress.Loopback, 0);
downloadFailureListener.Start();
var downloadFailurePort = ((IPEndPoint)downloadFailureListener.LocalEndpoint).Port;
var downloadFailureServerTask = Task.Run(async () =>
{
    for (var requestIndex = 0; requestIndex < 2; requestIndex++)
    {
        using var client = await downloadFailureListener.AcceptTcpClientAsync();
        await using var stream = client.GetStream();
        var buffer = new byte[4096];
        var requestText = "";
        while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
        {
            var read = await stream.ReadAsync(buffer);
            if (read <= 0) break;
            requestText += Encoding.ASCII.GetString(buffer, 0, read);
        }

        if (requestText.StartsWith("GET /download-failure.json ", StringComparison.Ordinal))
        {
            var body = $$"""
{
  "version": "0.4.2",
  "download_url": "http://127.0.0.1:{{downloadFailurePort}}/download-failure.exe",
  "sha256": "{{goodSha256}}"
}
""";
            var response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: application/json\r\n"
                + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
                + "Connection: close\r\n\r\n"
                + body;
            await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
            continue;
        }

        if (requestText.StartsWith("GET /download-failure.exe ", StringComparison.Ordinal))
        {
            var response = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
            continue;
        }

        throw new InvalidOperationException("Download failure test requested an unexpected path.");
    }
});

try
{
    var downloadFailureConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{downloadFailurePort}/download-failure.json",
        ClientVersion = "0.4.1"
    };
    if (!await updateService.CheckAsync(downloadFailureConfig, force: true))
    {
        throw new InvalidOperationException("Failed update package download should still mark the update check as handled.");
    }
}
finally
{
    downloadFailureListener.Stop();
}
await downloadFailureServerTask.WaitAsync(TimeSpan.FromSeconds(5));
var downloadFailureLogs = await logStore.ListPendingAsync(10);
var downloadFailureLog = downloadFailureLogs.SingleOrDefault(item => item.EventType == "collector_update_check_failed")
    ?? throw new InvalidOperationException("Failed update package download did not create a structured warning.");
if (!downloadFailureLog.MetadataJson.Contains($"http://127.0.0.1:{downloadFailurePort}/download-failure.json", StringComparison.Ordinal)
    || !downloadFailureLog.MetadataJson.Contains($"http://127.0.0.1:{downloadFailurePort}/download-failure.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Failed update package download log did not include manifest and download URLs.");
}
await logStore.MarkUploadedAsync(downloadFailureLogs.Select(item => item.Id));

var installerSuccessListener = new TcpListener(IPAddress.Loopback, 0);
installerSuccessListener.Start();
var installerSuccessPort = ((IPEndPoint)installerSuccessListener.LocalEndpoint).Port;
var installerSuccessServerTask = Task.Run(async () =>
{
    for (var requestIndex = 0; requestIndex < 2; requestIndex++)
    {
        using var client = await installerSuccessListener.AcceptTcpClientAsync();
        await using var stream = client.GetStream();
        var buffer = new byte[4096];
        var requestText = "";
        while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
        {
            var read = await stream.ReadAsync(buffer);
            if (read <= 0) break;
            requestText += Encoding.ASCII.GetString(buffer, 0, read);
        }

        if (requestText.StartsWith("GET /auto-install-success.json ", StringComparison.Ordinal))
        {
            var body = $$"""
{
  "version": "0.4.1",
  "download_url": "http://127.0.0.1:{{installerSuccessPort}}/auto-install-success.exe",
  "sha256": "{{goodSha256}}",
  "mandatory": false,
  "auto_install": false,
  "installer_arguments": "/MANIFEST-SILENT"
}
""";
            var response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: application/json\r\n"
                + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
                + "Connection: close\r\n\r\n"
                + body;
            await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
            continue;
        }

        if (requestText.StartsWith("GET /auto-install-success.exe ", StringComparison.Ordinal))
        {
            var response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: application/octet-stream\r\n"
                + $"Content-Length: {goodBytes.Length}\r\n"
                + "Connection: close\r\n\r\n";
            await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
            await stream.WriteAsync(goodBytes);
            continue;
        }

        throw new InvalidOperationException("Installer success test requested an unexpected path.");
    }
});

try
{
    var installerStarts = new List<(string Path, string Arguments)>();
    var installerStartedAt = new DateTimeOffset(2026, 6, 23, 12, 0, 0, TimeSpan.Zero);
    var successfulInstallerService = new UpdateService(logService, (path, arguments) =>
    {
        installerStarts.Add((path, arguments));
        return new UpdateInstallerStartResult(2468, installerStartedAt, arguments);
    });
    var installerSuccessConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        AutoUpdateInstallEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{installerSuccessPort}/auto-install-success.json",
        UpdateInstallerArguments = "  /CONFIG-SILENT /NORESTART  ",
        ClientVersion = "0.4.0"
    };

    if (!await successfulInstallerService.CheckAsync(installerSuccessConfig, force: true))
    {
        throw new InvalidOperationException("Successful auto-install update should mark the update check as handled.");
    }
    if (installerStarts.Count != 1)
    {
        throw new InvalidOperationException("Successful auto-install update should start the installer exactly once.");
    }
    if (!installerStarts[0].Path.EndsWith("EISCore.Collector-0.4.1.exe", StringComparison.Ordinal)
        || !File.Exists(installerStarts[0].Path))
    {
        throw new InvalidOperationException("Successful auto-install did not download the expected installer path.");
    }
    if (installerStarts[0].Arguments != "/CONFIG-SILENT /NORESTART")
    {
        throw new InvalidOperationException("Successful auto-install should use trimmed config installer arguments.");
    }
    if (installerSuccessConfig.PendingUpdateVersion != "0.4.1"
        || !installerSuccessConfig.PendingUpdateInstallerPath.EndsWith("EISCore.Collector-0.4.1.exe", StringComparison.Ordinal)
        || installerSuccessConfig.PendingUpdateInstallerProcessId != 2468
        || installerSuccessConfig.PendingUpdateInstallerStartedAt != installerStartedAt)
    {
        throw new InvalidOperationException("Successful auto-install should persist pending update and installer audit fields.");
    }
}
finally
{
    installerSuccessListener.Stop();
}
await installerSuccessServerTask.WaitAsync(TimeSpan.FromSeconds(5));

var installerSuccessLogs = await logStore.ListPendingAsync(10);
var installerDownloadedLog = installerSuccessLogs.SingleOrDefault(item => item.EventType == "collector_update_downloaded")
    ?? throw new InvalidOperationException("Successful auto-install did not log update download.");
var installerStartedLog = installerSuccessLogs.SingleOrDefault(item => item.EventType == "collector_update_installer_started")
    ?? throw new InvalidOperationException("Successful auto-install did not log installer start.");
if (!installerDownloadedLog.MetadataJson.Contains("0.4.1", StringComparison.Ordinal)
    || !installerDownloadedLog.MetadataJson.Contains("EISCore.Collector-0.4.1.exe", StringComparison.Ordinal)
    || !installerDownloadedLog.MetadataJson.Contains($"http://127.0.0.1:{installerSuccessPort}/auto-install-success.json", StringComparison.Ordinal)
    || !installerDownloadedLog.MetadataJson.Contains($"http://127.0.0.1:{installerSuccessPort}/auto-install-success.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Successful auto-install download log did not include expected version, path, and update URLs.");
}
if (!installerStartedLog.MetadataJson.Contains("2468", StringComparison.Ordinal)
    || !installerStartedLog.MetadataJson.Contains("/CONFIG-SILENT /NORESTART", StringComparison.Ordinal)
    || !installerStartedLog.MetadataJson.Contains("EISCore.Collector-0.4.1.exe", StringComparison.Ordinal)
    || !installerStartedLog.MetadataJson.Contains($"http://127.0.0.1:{installerSuccessPort}/auto-install-success.json", StringComparison.Ordinal)
    || !installerStartedLog.MetadataJson.Contains($"http://127.0.0.1:{installerSuccessPort}/auto-install-success.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Successful auto-install start log did not include expected installer audit and URL metadata.");
}
await logStore.MarkUploadedAsync(installerSuccessLogs.Select(item => item.Id));

var installerFailureListener = new TcpListener(IPAddress.Loopback, 0);
installerFailureListener.Start();
var installerFailurePort = ((IPEndPoint)installerFailureListener.LocalEndpoint).Port;
var installerFailureServerTask = Task.Run(async () =>
{
    for (var requestIndex = 0; requestIndex < 2; requestIndex++)
    {
        using var client = await installerFailureListener.AcceptTcpClientAsync();
        await using var stream = client.GetStream();
        var buffer = new byte[4096];
        var requestText = "";
        while (!requestText.Contains("\r\n\r\n", StringComparison.Ordinal))
        {
            var read = await stream.ReadAsync(buffer);
            if (read <= 0) break;
            requestText += Encoding.ASCII.GetString(buffer, 0, read);
        }

        if (requestText.StartsWith("GET /auto-install-failure.json ", StringComparison.Ordinal))
        {
            var body = $$"""
{
  "version": "0.4.0",
  "download_url": "http://127.0.0.1:{{installerFailurePort}}/auto-install-failure.exe",
  "sha256": "{{goodSha256}}",
  "mandatory": true,
  "auto_install": true,
  "installer_arguments": "/VERYSILENT"
}
""";
            var response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: application/json\r\n"
                + $"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n"
                + "Connection: close\r\n\r\n"
                + body;
            await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
            continue;
        }

        if (requestText.StartsWith("GET /auto-install-failure.exe ", StringComparison.Ordinal))
        {
            var response = "HTTP/1.1 200 OK\r\n"
                + "Content-Type: application/octet-stream\r\n"
                + $"Content-Length: {goodBytes.Length}\r\n"
                + "Connection: close\r\n\r\n";
            await stream.WriteAsync(Encoding.UTF8.GetBytes(response));
            await stream.WriteAsync(goodBytes);
            continue;
        }

        throw new InvalidOperationException("Installer start failure test requested an unexpected path.");
    }
});

try
{
    var installerStartAttempts = 0;
    var failingInstallerService = new UpdateService(logService, (_, _) =>
    {
        installerStartAttempts++;
        throw new InvalidOperationException("synthetic installer start failure");
    });
    var installerFailureConfig = new AppConfig
    {
        AutoUpdateEnabled = true,
        UpdateManifestUrl = $"http://127.0.0.1:{installerFailurePort}/auto-install-failure.json",
        ClientVersion = "0.3.0",
        PendingUpdateVersion = "0.2.9",
        PendingUpdateInstallerPath = "C:\\old-installer.exe",
        PendingUpdateInstallerProcessId = 4321,
        PendingUpdateInstallerStartedAt = DateTimeOffset.Now.AddMinutes(-10)
    };

    if (!await failingInstallerService.CheckAsync(installerFailureConfig, force: true))
    {
        throw new InvalidOperationException("Installer start failure should still mark the update check as handled.");
    }
    if (installerStartAttempts != 1)
    {
        throw new InvalidOperationException("Auto-install manifest should attempt to start the installer exactly once.");
    }
    if (installerFailureConfig.PendingUpdateVersion != "0.4.0")
    {
        throw new InvalidOperationException("Installer start failure should preserve the newly downloaded pending update version.");
    }
    if (!installerFailureConfig.PendingUpdateInstallerPath.EndsWith("EISCore.Collector-0.4.0.exe", StringComparison.Ordinal)
        || !File.Exists(installerFailureConfig.PendingUpdateInstallerPath))
    {
        throw new InvalidOperationException("Installer start failure should preserve the newly downloaded installer path.");
    }
    if (installerFailureConfig.PendingUpdateInstallerProcessId is not null
        || installerFailureConfig.PendingUpdateInstallerStartedAt is not null)
    {
        throw new InvalidOperationException("Installer start failure should clear stale installer process audit fields.");
    }
}
finally
{
    installerFailureListener.Stop();
}
await installerFailureServerTask.WaitAsync(TimeSpan.FromSeconds(5));

var installerFailureLogs = await logStore.ListPendingAsync(10);
var installerFailureLog = installerFailureLogs.SingleOrDefault(item => item.EventType == "collector_update_installer_start_failed")
    ?? throw new InvalidOperationException("Installer start failure did not create a structured local error.");
if (!installerFailureLog.Stack.Contains("synthetic installer start failure", StringComparison.Ordinal)
    || !installerFailureLog.MetadataJson.Contains("0.4.0", StringComparison.Ordinal)
    || !installerFailureLog.MetadataJson.Contains("EISCore.Collector-0.4.0.exe", StringComparison.Ordinal)
    || !installerFailureLog.MetadataJson.Contains("/VERYSILENT", StringComparison.Ordinal)
    || !installerFailureLog.MetadataJson.Contains($"http://127.0.0.1:{installerFailurePort}/auto-install-failure.json", StringComparison.Ordinal)
    || !installerFailureLog.MetadataJson.Contains($"http://127.0.0.1:{installerFailurePort}/auto-install-failure.exe", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Installer start failure log did not include the expected error, metadata, and update URLs.");
}
if (installerFailureLogs.Any(item => item.EventType == "collector_update_installer_started"))
{
    throw new InvalidOperationException("Installer start failure should not log installer_started.");
}
await logStore.MarkUploadedAsync(installerFailureLogs.Select(item => item.Id));

var downloadPolicy = CollectorUpdateUrlPolicy.EvaluateDownloadUrl("file:///tmp/EISCore.Collector.exe");
if (downloadPolicy.IsValid || downloadPolicy.Reason != "invalid_download_url")
{
    throw new InvalidOperationException("Non-http download_url should be rejected before download.");
}

var missingHashPolicy = CollectorUpdateHashPolicy.EvaluateSha256("  ");
if (missingHashPolicy.IsValid || missingHashPolicy.Reason != "missing_sha256")
{
    throw new InvalidOperationException("Missing update SHA256 should be rejected.");
}
var invalidHashPolicy = CollectorUpdateHashPolicy.EvaluateSha256("not-a-sha");
if (invalidHashPolicy.IsValid || invalidHashPolicy.Reason != "invalid_sha256")
{
    throw new InvalidOperationException("Malformed update SHA256 should be rejected.");
}

try
{
    await using var noHashStream = new MemoryStream(goodBytes);
    await UpdatePackageStore.SaveAtomicallyAsync(noHashStream, Path.Combine(updateDir, "missing-sha.exe"), "");
    throw new InvalidOperationException("Update package without SHA256 unexpectedly saved.");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("SHA256", StringComparison.OrdinalIgnoreCase))
{
}
AssertNoTempDownloads(updateDir);

static void AssertNoTempDownloads(string updateDir)
{
    var leftovers = Directory.EnumerateFiles(updateDir, "*.download").ToList();
    if (leftovers.Count > 0)
    {
        throw new InvalidOperationException("Temporary update download files were not cleaned up: " + string.Join(", ", leftovers));
    }
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

  console.log('PASS: collector update download regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
