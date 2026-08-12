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
const workDir = mkdtempSync(join(tmpdir(), 'eiscore-config-persistence-'))
const dataDir = join(workDir, 'collector-data')

const project = join(workDir, 'CollectorConfigPersistenceSmoke.csproj')
const sources = [
  'collector-desktop/EISCore.Collector/Models/AppConfig.cs',
  'collector-desktop/EISCore.Collector/Models/BindingModels.cs',
  'collector-desktop/EISCore.Collector/Services/AppPaths.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorAllowedExtensionsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorServerAddressPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorConfigSavePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorBindingIdentityPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorRemoteUpdatePolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateInstallerArgumentsPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/CollectorUpdateUrlPolicy.cs',
  'collector-desktop/EISCore.Collector/Services/DeviceTokenProtector.cs',
  'collector-desktop/EISCore.Collector/Services/ConfigurationService.cs'
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
    <PackageReference Include="System.Security.Cryptography.ProtectedData" Version="8.0.0" />
${sources.map((source) => `    <Compile Include="${resolve(repoRoot, source)}" Link="${source.split('/').pop()}" />`).join('\n')}
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`)

writeFileSync(join(workDir, 'Program.cs'), String.raw`
using System.Text.Json;
using EISCore.Collector.Models;
using EISCore.Collector.Services;

var dataDir = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
if (string.IsNullOrWhiteSpace(dataDir))
{
    throw new InvalidOperationException("EISCORE_COLLECTOR_DATA_DIR is required.");
}

Directory.CreateDirectory(dataDir);
var service = new ConfigurationService();
var configPath = AppPaths.ConfigPath;
var backupPath = configPath + ".bak";
var sensitiveToken = "sensitive-device-token-123";
var protectedToken = service.ProtectToken(sensitiveToken);
if (string.IsNullOrWhiteSpace(protectedToken)
    || protectedToken.Contains(sensitiveToken, StringComparison.Ordinal)
    || service.UnprotectToken(protectedToken) != sensitiveToken)
{
    throw new InvalidOperationException("Device token protection did not round-trip without plaintext.");
}

var firstLoadedDefault = await service.LoadAsync();
if (firstLoadedDefault.ServerBaseUrl != AppConfig.DefaultServerBaseUrl)
{
    throw new InvalidOperationException($"New collector config should default to {AppConfig.DefaultServerBaseUrl}, got {firstLoadedDefault.ServerBaseUrl}.");
}

await service.SaveAsync(new AppConfig
{
    ServerBaseUrl = "",
    DeviceCode = "draft-collector",
    DeviceName = "Draft Collector"
});
var blankDraftConfig = await service.LoadAsync();
if (blankDraftConfig.ServerBaseUrl != "")
{
    throw new InvalidOperationException("Explicitly saved blank server address should remain an editable draft.");
}

await service.SaveAsync(new AppConfig
{
    ServerBaseUrl = "https://first.example.test",
    DeviceCode = "collector-01",
    DeviceName = "Collector 01",
    DefaultUsername = "first-user",
    EncryptedDeviceToken = protectedToken,
    UploadRetryIntervalSeconds = 1,
    LogBatchSize = -1,
    WatchFolders = new List<WatchFolderConfig>
    {
        new() { FolderPath = "D:\\FirstInbox", FolderName = "FirstInbox", Enabled = true }
    }
});

if (!File.Exists(configPath))
{
    throw new InvalidOperationException("Config file was not created.");
}
if (Directory.EnumerateFiles(dataDir).Any(path => path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Temporary config file was left behind after first save.");
}
var firstConfigText = await File.ReadAllTextAsync(configPath);
if (firstConfigText.Contains(sensitiveToken, StringComparison.Ordinal)
    || !firstConfigText.Contains("encryptedDeviceToken", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Protected device token was not persisted safely.");
}

await service.SaveAsync(new AppConfig
{
    ServerBaseUrl = "https://second.example.test",
    DeviceCode = "collector-02",
    DeviceName = "Collector 02",
    DefaultUsername = "second-user",
    UploadRetryIntervalSeconds = 30,
    LogBatchSize = 20,
    WatchFolders = new List<WatchFolderConfig>
    {
        new() { FolderPath = "D:\\SecondInbox", FolderName = "SecondInbox", Enabled = true }
    }
});

if (!File.Exists(backupPath))
{
    throw new InvalidOperationException("Backup config file was not created on replacement save.");
}

var mainBeforeCorruption = await File.ReadAllTextAsync(configPath);
using (var mainDoc = JsonDocument.Parse(mainBeforeCorruption))
{
    if (mainDoc.RootElement.GetProperty("serverBaseUrl").GetString() != "https://second.example.test")
    {
        throw new InvalidOperationException("Main config did not contain the latest saved version.");
    }
}

var backupBeforeCorruption = await File.ReadAllTextAsync(backupPath);
using (var backupDoc = JsonDocument.Parse(backupBeforeCorruption))
{
    if (backupDoc.RootElement.GetProperty("serverBaseUrl").GetString() != "https://first.example.test")
    {
        throw new InvalidOperationException("Backup config did not preserve the previous good version.");
    }
}

await File.WriteAllTextAsync(configPath, "{ broken config");
var loadedFromBackup = await service.LoadAsync();
if (loadedFromBackup.ServerBaseUrl != "https://first.example.test")
{
    throw new InvalidOperationException($"Expected corrupt main config to fall back to backup, got {loadedFromBackup.ServerBaseUrl}.");
}
if (loadedFromBackup.UploadRetryIntervalSeconds != 5 || loadedFromBackup.LogBatchSize != 100)
{
    throw new InvalidOperationException("Loaded backup config was not normalized.");
}

loadedFromBackup.DeviceName = "Recovered Collector";
await service.SaveAsync(loadedFromBackup);
var backupAfterRecoverySave = await File.ReadAllTextAsync(backupPath);
if (backupAfterRecoverySave.Contains("broken config", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Corrupt main config was copied over the backup during recovery save.");
}

var recoveredMain = await service.LoadAsync();
if (recoveredMain.DeviceName != "Recovered Collector")
{
    throw new InvalidOperationException("Recovered config was not saved back to the main config file.");
}
if (Directory.EnumerateFiles(dataDir).Any(path => path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Temporary config file was left behind after recovery save.");
}

var legacyPlainToken = "legacy-device-token-plaintext";
await File.WriteAllTextAsync(configPath, $$"""
{
  "serverBaseUrl": "legacy.example.test/agent/document-intake/devices/bind",
  "deviceCode": "legacy-collector",
  "deviceName": "Legacy Collector",
  "deviceToken": "{{legacyPlainToken}}",
  "uploadRetryIntervalSeconds": 30
}
""");
await File.WriteAllTextAsync(backupPath, $$"""
{
  "serverBaseUrl": "https://legacy-backup.example.test",
  "deviceToken": "legacy-backup-device-token"
}
""");

var migratedLegacy = await service.LoadAsync();
if (migratedLegacy.ServerBaseUrl != "https://legacy.example.test")
{
    throw new InvalidOperationException("Legacy main config server address was not normalized during token migration.");
}
if (service.UnprotectToken(migratedLegacy.EncryptedDeviceToken) != legacyPlainToken)
{
    throw new InvalidOperationException("Legacy plaintext deviceToken was not migrated into encryptedDeviceToken.");
}
var migratedMainText = await File.ReadAllTextAsync(configPath);
var migratedBackupText = await File.ReadAllTextAsync(backupPath);
using (var migratedMainDoc = JsonDocument.Parse(migratedMainText))
{
    if (migratedMainDoc.RootElement.GetProperty("serverBaseUrl").GetString() != "https://legacy.example.test")
    {
        throw new InvalidOperationException("Migrated main config did not persist the normalized server address.");
    }
}
if (migratedMainText.Contains(legacyPlainToken, StringComparison.Ordinal)
    || migratedMainText.Contains("\"deviceToken\"", StringComparison.Ordinal)
    || migratedBackupText.Contains(legacyPlainToken, StringComparison.Ordinal)
    || migratedBackupText.Contains("\"deviceToken\"", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Legacy plaintext deviceToken remained in the migrated config or backup.");
}

var cleanProtectedToken = service.ProtectToken("clean-device-token");
await File.WriteAllTextAsync(configPath, JsonSerializer.Serialize(new
{
    serverBaseUrl = "clean.example.test/agent/document-intake/client-logs/batch",
    encryptedDeviceToken = cleanProtectedToken
}));
await File.WriteAllTextAsync(backupPath, """
{
  "serverBaseUrl": "https://stale-backup.example.test",
  "deviceToken": "stale-backup-device-token",
  "autoUpdateEnabled": true,
  "updateManifestUrl": "ftp://stale-backup.example.test/update.json",
  "updateCheckIntervalHours": 9999,
  "autoUpdateInstallEnabled": true,
  "updateInstallerArguments": "/VERYSILENT\\n/NORESTART"
}
""");
var cleanLoaded = await service.LoadAsync();
if (cleanLoaded.ServerBaseUrl != "https://clean.example.test")
{
    throw new InvalidOperationException("Clean encrypted config server address was not normalized on load.");
}
if (service.UnprotectToken(cleanLoaded.EncryptedDeviceToken) != "clean-device-token")
{
    throw new InvalidOperationException("Clean encrypted token did not survive backup sanitization.");
}
var sanitizedBackupText = await File.ReadAllTextAsync(backupPath);
if (sanitizedBackupText.Contains("stale-backup-device-token", StringComparison.Ordinal)
    || sanitizedBackupText.Contains("\"deviceToken\"", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Legacy plaintext deviceToken remained in a stale backup.");
}
if (sanitizedBackupText.Contains("ftp://stale-backup.example.test/update.json", StringComparison.Ordinal)
    || sanitizedBackupText.Contains("/NORESTART", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Unsafe update settings remained in a stale backup.");
}

var activeBinding = new AppConfig
{
    ServerBaseUrl = "https://nanpai.eissys.top/agent/",
    EnterpriseCode = "local",
    DeviceCode = "collector-01",
    DeviceId = "device-1",
    DeviceStatus = "active",
    RemoteConfigVersion = "remote-v1",
    LastBoundAt = DateTimeOffset.Now.AddDays(-1),
    LastRemoteConfigAt = DateTimeOffset.Now.AddMinutes(-30),
    EncryptedDeviceToken = service.ProtectToken("bound-token")
};
if (CollectorServerAddressPolicy.NormalizeForStorage("nanpai.eissys.top") != "https://nanpai.eissys.top")
{
    throw new InvalidOperationException("Production host without scheme should normalize to https.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("localhost:8080/") != "http://localhost:8080")
{
    throw new InvalidOperationException("Localhost without scheme should normalize to http.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("127.0.0.1:5173/agent/") != "http://127.0.0.1:5173")
{
    throw new InvalidOperationException("Local loopback API prefix should normalize to the site root.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("::1") != "http://[::1]")
{
    throw new InvalidOperationException("Unbracketed IPv6 loopback without scheme should normalize to http://[::1].");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("::1:5173/agent/document-intake") != "http://[::1]:5173")
{
    throw new InvalidOperationException("Unbracketed IPv6 loopback with port and API prefix should normalize to bracketed authority.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("http://::1:5173/agent/document-intake") != "http://[::1]:5173")
{
    throw new InvalidOperationException("Unbracketed IPv6 loopback with scheme should normalize to bracketed authority.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("[::1]:5173/agent/") != "http://[::1]:5173")
{
    throw new InvalidOperationException("Bracketed IPv6 loopback without scheme should keep brackets and normalize the API prefix.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json") != "https://nanpai.eissys.top")
{
    throw new InvalidOperationException("Pasted collector release/API URL should normalize to the site root.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("https://nanpai.eissys.top/eiscore/agent/document-intake") != "https://nanpai.eissys.top/eiscore")
{
    throw new InvalidOperationException("Sub-path deployments should keep the path before the API agent prefix.");
}
if (CollectorServerAddressPolicy.NormalizeForStorage("https://nanpai.eissys.top/eiscore/app") != "https://nanpai.eissys.top/eiscore/app")
{
    throw new InvalidOperationException("Non-API sub-path server addresses should be preserved.");
}
var invalidServer = CollectorServerAddressPolicy.Evaluate("ftp://nanpai.eissys.top", requireNonEmpty: true);
if (invalidServer.IsValid || !invalidServer.StatusMessage.Contains("http/https", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Non-http server address should be rejected with a friendly message.");
}
var emptyRequiredServer = CollectorServerAddressPolicy.Evaluate("  ", requireNonEmpty: true);
if (emptyRequiredServer.IsValid || emptyRequiredServer.StatusMessage != "请先配置服务器地址。")
{
    throw new InvalidOperationException("Required empty server address should be rejected.");
}
var emptySaveState = CollectorConfigSavePolicy.Evaluate("  ");
if (!emptySaveState.CanSave)
{
    throw new InvalidOperationException("Saving a draft config with an empty server address should be allowed.");
}
var hostSaveState = CollectorConfigSavePolicy.Evaluate("nanpai.eissys.top");
if (!hostSaveState.CanSave)
{
    throw new InvalidOperationException("Saving a host-only server address should be allowed before normalization.");
}
var ipv6LoopbackSaveState = CollectorConfigSavePolicy.Evaluate("::1:5173");
if (!ipv6LoopbackSaveState.CanSave)
{
    throw new InvalidOperationException("Saving a local IPv6 loopback server address should be allowed before normalization.");
}
var invalidSaveState = CollectorConfigSavePolicy.Evaluate("ftp://nanpai.eissys.top");
if (invalidSaveState.CanSave || !invalidSaveState.StatusMessage.Contains("http/https", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Saving an invalid non-http server address should be blocked.");
}
var normalizedTextConfig = ConfigurationService.Normalize(new AppConfig
{
    EnterpriseCode = " local\nenterprise ",
    DeviceId = " device\rid ",
    DeviceCode = " collector\t01 ",
    DeviceName = " Collector\n" + new string('N', 200),
    DefaultUserId = " user\0id ",
    DefaultUsername = " Operator\r\n" + new string('U', 200),
    DefaultRole = " warehouse\nmanager ",
    ClientVersion = " 0.2.0\n ",
    WebViewVersion = "WebView2/" + new string('1', 200),
    RemoteConfigVersion = " remote\nv1 ",
    PendingUpdateVersion = " 0.3.0\r ",
    PendingUpdateInstallerPath = " C:\\Updates\\" + new string('P', 2000),
    AllowedExtensions = new List<string>
    {
        " PDF ",
        "xlsx",
        ".PDF",
        ".tar.gz",
        "../exe",
        "*",
        "jpeg\n",
        "7Z",
        ".",
        "." + new string('a', 40)
    },
    WatchFolders = new List<WatchFolderConfig>
    {
        null!,
        new()
        {
            FolderPath = "   ",
            FolderName = "Ignored Empty"
        },
        new()
        {
            FolderPath = " C:\\Inbox\n ",
            FolderName = " Inbox\rName ",
            DefaultUserId = " folder\nuser ",
            DefaultUsername = " folder\r\noperator ",
            DefaultRole = " folder\trole "
        },
        new()
        {
            FolderPath = "c:\\inbox\\",
            FolderName = "Duplicate",
            DefaultUserId = "duplicate-user",
            DefaultUsername = "duplicate-operator",
            DefaultRole = "duplicate-role"
        }
    }
});
if (normalizedTextConfig.EnterpriseCode != "localenterprise"
    || normalizedTextConfig.DeviceId != "deviceid"
    || normalizedTextConfig.DeviceCode != "collector01"
    || normalizedTextConfig.DefaultUserId != "userid"
    || normalizedTextConfig.DefaultRole != "warehousemanager"
    || normalizedTextConfig.ClientVersion != "0.2.0"
    || normalizedTextConfig.RemoteConfigVersion != "remotev1"
    || normalizedTextConfig.PendingUpdateVersion != "0.3.0")
{
    throw new InvalidOperationException("Config text fields were not trimmed and stripped of control characters.");
}
if (normalizedTextConfig.DeviceName.Length != 120
    || normalizedTextConfig.DefaultUsername.Length != 120
    || normalizedTextConfig.WebViewVersion.Length != 120
    || normalizedTextConfig.PendingUpdateInstallerPath.Length != 1024)
{
    throw new InvalidOperationException("Config text fields were not clamped to safe lengths.");
}
if (normalizedTextConfig.DeviceName.Any(char.IsControl)
    || normalizedTextConfig.DefaultUsername.Any(char.IsControl)
    || normalizedTextConfig.WebViewVersion.Any(char.IsControl)
    || normalizedTextConfig.PendingUpdateInstallerPath.Any(char.IsControl))
{
    throw new InvalidOperationException("Config text field normalization left control characters behind.");
}
if (normalizedTextConfig.WatchFolders.Count != 1
    || normalizedTextConfig.WatchFolders[0].FolderPath != "C:\\Inbox"
    || normalizedTextConfig.WatchFolders[0].FolderName != "InboxName"
    || normalizedTextConfig.WatchFolders[0].DefaultUserId != "folderuser"
    || normalizedTextConfig.WatchFolders[0].DefaultUsername != "folderoperator"
    || normalizedTextConfig.WatchFolders[0].DefaultRole != "folderrole")
{
    throw new InvalidOperationException("Watch folder text fields were not normalized safely.");
}
if (ConfigurationService.NormalizeText(" remote\nconfig\tversion ", 120) != "remoteconfigversion")
{
    throw new InvalidOperationException("Remote config text comparison should use the same stable normalized form.");
}
var expectedAllowedExtensions = new[] { ".7z", ".jpeg", ".pdf", ".xlsx" };
if (!normalizedTextConfig.AllowedExtensions.SequenceEqual(expectedAllowedExtensions, StringComparer.OrdinalIgnoreCase))
{
    throw new InvalidOperationException("Allowed extensions were not normalized, deduplicated, sorted, or filtered safely: "
        + string.Join(", ", normalizedTextConfig.AllowedExtensions));
}
var manyExtensions = ConfigurationService.Normalize(new AppConfig
{
    AllowedExtensions = Enumerable.Range(0, 140).Select(index => "x" + index).ToList()
});
if (manyExtensions.AllowedExtensions.Count != 128
    || manyExtensions.AllowedExtensions.Any(item => !item.StartsWith('.') || item.Length < 2))
{
    throw new InvalidOperationException("Allowed extensions should be normalized and capped at 128 entries.");
}
var defaultUploadConfig = ConfigurationService.Normalize(new AppConfig
{
    MaxUploadBytes = -1,
    ChunkSizeBytes = -1
});
if (defaultUploadConfig.MaxUploadBytes != 256L * 1024 * 1024
    || defaultUploadConfig.ChunkSizeBytes != 8 * 1024 * 1024)
{
    throw new InvalidOperationException("Invalid upload size config should fall back to defaults.");
}
var minUploadConfig = ConfigurationService.Normalize(new AppConfig
{
    MaxUploadBytes = 512,
    ChunkSizeBytes = 1024
});
if (minUploadConfig.MaxUploadBytes != 1024L * 1024
    || minUploadConfig.ChunkSizeBytes != 256 * 1024)
{
    throw new InvalidOperationException("Upload size config should be clamped to safe minimums.");
}
var maxUploadConfig = ConfigurationService.Normalize(new AppConfig
{
    MaxUploadBytes = 5L * 1024 * 1024 * 1024,
    ChunkSizeBytes = 512 * 1024 * 1024
});
if (maxUploadConfig.MaxUploadBytes != 1024L * 1024 * 1024
    || maxUploadConfig.ChunkSizeBytes != 64 * 1024 * 1024)
{
    throw new InvalidOperationException("Upload size config should be clamped to safe maximums.");
}
var validRemoteUpdate = CollectorRemoteUpdatePolicy.Normalize(new CollectorUpdatePolicy
{
    Enabled = true,
    ManifestUrl = "  https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json  ",
    CheckIntervalHours = 0,
    AutoInstall = true,
    InstallerArguments = "  /VERYSILENT /NORESTART  "
});
if (!validRemoteUpdate.AutoUpdateEnabled
    || validRemoteUpdate.ManifestUrl != "https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json"
    || validRemoteUpdate.CheckIntervalHours != 24
    || !validRemoteUpdate.AutoInstallEnabled
    || validRemoteUpdate.InstallerArguments != "/VERYSILENT /NORESTART"
    || !string.IsNullOrWhiteSpace(validRemoteUpdate.Reason))
{
    throw new InvalidOperationException("Valid remote update config was not normalized for local persistence.");
}
var invalidRemoteManifest = CollectorRemoteUpdatePolicy.Normalize(new CollectorUpdatePolicy
{
    Enabled = true,
    ManifestUrl = "ftp://nanpai.eissys.top/update.json",
    CheckIntervalHours = 9999,
    AutoInstall = true,
    InstallerArguments = "/VERYSILENT"
});
if (invalidRemoteManifest.AutoUpdateEnabled
    || !string.IsNullOrWhiteSpace(invalidRemoteManifest.ManifestUrl)
    || invalidRemoteManifest.CheckIntervalHours != 720
    || invalidRemoteManifest.AutoInstallEnabled
    || !string.IsNullOrWhiteSpace(invalidRemoteManifest.InstallerArguments)
    || invalidRemoteManifest.Reason != "invalid_manifest_url")
{
    throw new InvalidOperationException("Invalid remote update manifest URL should not be persisted as an enabled local update config.");
}
var invalidRemoteInstallerArgs = CollectorRemoteUpdatePolicy.Normalize(new CollectorUpdatePolicy
{
    Enabled = true,
    ManifestUrl = "https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json",
    CheckIntervalHours = 1,
    AutoInstall = true,
    InstallerArguments = "/VERYSILENT\n/NORESTART"
});
if (!invalidRemoteInstallerArgs.AutoUpdateEnabled
    || invalidRemoteInstallerArgs.ManifestUrl != "https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json"
    || invalidRemoteInstallerArgs.AutoInstallEnabled
    || !string.IsNullOrWhiteSpace(invalidRemoteInstallerArgs.InstallerArguments)
    || invalidRemoteInstallerArgs.Reason != "invalid_installer_arguments")
{
    throw new InvalidOperationException("Invalid remote installer arguments should disable auto-install without disabling update downloads.");
}
var disabledRemoteUpdate = CollectorRemoteUpdatePolicy.Normalize(new CollectorUpdatePolicy
{
    Enabled = false,
    ManifestUrl = "ftp://bad.example.test/update.json",
    CheckIntervalHours = -10,
    AutoInstall = true,
    InstallerArguments = "/VERYSILENT\n/NORESTART"
});
if (disabledRemoteUpdate.AutoUpdateEnabled
    || !string.IsNullOrWhiteSpace(disabledRemoteUpdate.ManifestUrl)
    || disabledRemoteUpdate.CheckIntervalHours != 24
    || disabledRemoteUpdate.AutoInstallEnabled
    || !string.IsNullOrWhiteSpace(disabledRemoteUpdate.InstallerArguments))
{
    throw new InvalidOperationException("Disabled remote update config should not persist stale URL or installer arguments.");
}
var normalizedLocalUpdate = ConfigurationService.Normalize(new AppConfig
{
    AutoUpdateEnabled = true,
    UpdateManifestUrl = "  https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json  ",
    UpdateCheckIntervalHours = 0,
    AutoUpdateInstallEnabled = true,
    UpdateInstallerArguments = "  /VERYSILENT /NORESTART  "
});
if (!normalizedLocalUpdate.AutoUpdateEnabled
    || normalizedLocalUpdate.UpdateManifestUrl != "https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json"
    || normalizedLocalUpdate.UpdateCheckIntervalHours != 24
    || !normalizedLocalUpdate.AutoUpdateInstallEnabled
    || normalizedLocalUpdate.UpdateInstallerArguments != "/VERYSILENT /NORESTART")
{
    throw new InvalidOperationException("Local config normalize should apply the same safe update policy as remote config sync.");
}
var invalidLocalUpdate = ConfigurationService.Normalize(new AppConfig
{
    AutoUpdateEnabled = true,
    UpdateManifestUrl = "file:///tmp/update.json",
    UpdateCheckIntervalHours = 9999,
    AutoUpdateInstallEnabled = true,
    UpdateInstallerArguments = "/VERYSILENT"
});
if (invalidLocalUpdate.AutoUpdateEnabled
    || !string.IsNullOrWhiteSpace(invalidLocalUpdate.UpdateManifestUrl)
    || invalidLocalUpdate.UpdateCheckIntervalHours != 720
    || invalidLocalUpdate.AutoUpdateInstallEnabled
    || !string.IsNullOrWhiteSpace(invalidLocalUpdate.UpdateInstallerArguments))
{
    throw new InvalidOperationException("Invalid local update config should be disabled and scrubbed during normalize.");
}
var invalidLocalInstallerArgs = ConfigurationService.Normalize(new AppConfig
{
    AutoUpdateEnabled = true,
    UpdateManifestUrl = "https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json",
    UpdateCheckIntervalHours = 12,
    AutoUpdateInstallEnabled = true,
    UpdateInstallerArguments = "/VERYSILENT\n/NORESTART"
});
if (!invalidLocalInstallerArgs.AutoUpdateEnabled
    || invalidLocalInstallerArgs.UpdateManifestUrl != "https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json"
    || invalidLocalInstallerArgs.UpdateCheckIntervalHours != 12
    || invalidLocalInstallerArgs.AutoUpdateInstallEnabled
    || !string.IsNullOrWhiteSpace(invalidLocalInstallerArgs.UpdateInstallerArguments))
{
    throw new InvalidOperationException("Invalid local installer arguments should disable auto-install while keeping update downloads enabled.");
}
await service.SaveAsync(new AppConfig
{
    ServerBaseUrl = "https://config-normalize.example.test",
    AutoUpdateEnabled = true,
    UpdateManifestUrl = "ftp://nanpai.eissys.top/update.json",
    UpdateCheckIntervalHours = 9999,
    AutoUpdateInstallEnabled = true,
    UpdateInstallerArguments = "/VERYSILENT\n/NORESTART"
});
var scrubbedLocalUpdate = await service.LoadAsync();
if (scrubbedLocalUpdate.AutoUpdateEnabled
    || !string.IsNullOrWhiteSpace(scrubbedLocalUpdate.UpdateManifestUrl)
    || scrubbedLocalUpdate.UpdateCheckIntervalHours != 720
    || scrubbedLocalUpdate.AutoUpdateInstallEnabled
    || !string.IsNullOrWhiteSpace(scrubbedLocalUpdate.UpdateInstallerArguments))
{
    throw new InvalidOperationException("Saved local config should persist scrubbed update settings.");
}
var scrubbedLocalUpdateText = await File.ReadAllTextAsync(configPath);
if (scrubbedLocalUpdateText.Contains("ftp://nanpai.eissys.top/update.json", StringComparison.Ordinal)
    || scrubbedLocalUpdateText.Contains("/NORESTART", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Saved local config still contains unsafe update URL or installer arguments.");
}
await File.WriteAllTextAsync(configPath, """
{
  "serverBaseUrl": "https://unsafe-backup-source.example.test/agent/document-intake/devices/config",
  "autoUpdateEnabled": true,
  "updateManifestUrl": "ftp://unsafe-backup-source.example.test/update.json",
  "updateCheckIntervalHours": 9999,
  "autoUpdateInstallEnabled": true,
  "updateInstallerArguments": "/VERYSILENT\\n/NORESTART"
}
""");
await service.SaveAsync(new AppConfig
{
    ServerBaseUrl = "https://after-unsafe-backup.example.test",
    DeviceCode = "after-unsafe-backup"
});
var unsafeBackupText = await File.ReadAllTextAsync(backupPath);
using (var unsafeBackupDoc = JsonDocument.Parse(unsafeBackupText))
{
    if (unsafeBackupDoc.RootElement.GetProperty("serverBaseUrl").GetString() != "https://unsafe-backup-source.example.test")
    {
        throw new InvalidOperationException("Backup config did not normalize the previous main server address.");
    }
    if (unsafeBackupDoc.RootElement.GetProperty("autoUpdateEnabled").GetBoolean())
    {
        throw new InvalidOperationException("Backup config preserved an unsafe enabled update policy.");
    }
    if (unsafeBackupDoc.RootElement.GetProperty("updateManifestUrl").GetString() != "")
    {
        throw new InvalidOperationException("Backup config preserved an unsafe update manifest URL.");
    }
    if (unsafeBackupDoc.RootElement.GetProperty("autoUpdateInstallEnabled").GetBoolean())
    {
        throw new InvalidOperationException("Backup config preserved unsafe auto-install state.");
    }
    if (unsafeBackupDoc.RootElement.GetProperty("updateInstallerArguments").GetString() != "")
    {
        throw new InvalidOperationException("Backup config preserved unsafe installer arguments.");
    }
}
if (unsafeBackupText.Contains("ftp://unsafe-backup-source.example.test/update.json", StringComparison.Ordinal)
    || unsafeBackupText.Contains("/NORESTART", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Backup config copied unsafe update URL or installer arguments from the previous main config.");
}
if (Directory.EnumerateFiles(dataDir).Any(path => path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Temporary config file was left behind after backup replacement.");
}
await service.SaveAsync(new AppConfig
{
    ServerBaseUrl = "https://upload-limits.example.test",
    MaxUploadBytes = 5L * 1024 * 1024 * 1024,
    ChunkSizeBytes = 512 * 1024 * 1024
});
var persistedUploadLimits = await service.LoadAsync();
if (persistedUploadLimits.MaxUploadBytes != 1024L * 1024 * 1024
    || persistedUploadLimits.ChunkSizeBytes != 64 * 1024 * 1024)
{
    throw new InvalidOperationException("Saved upload size config should persist clamped values.");
}

File.Delete(backupPath);
Directory.CreateDirectory(backupPath);
await service.SaveAsync(new AppConfig
{
    ServerBaseUrl = "https://backup-blocked.example.test",
    DeviceCode = "backup-blocked"
});
var backupBlockedMain = await service.LoadAsync();
if (backupBlockedMain.ServerBaseUrl != "https://backup-blocked.example.test")
{
    throw new InvalidOperationException("Main config save should succeed even when the backup path is occupied.");
}
if (Directory.EnumerateFiles(dataDir).Any(path => path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Temporary config file was left behind after best-effort backup failure.");
}
Directory.Delete(backupPath, recursive: true);

var concurrentSaves = Enumerable.Range(0, 12)
    .Select(index => service.SaveAsync(new AppConfig
    {
        ServerBaseUrl = $"https://concurrent-{index}.example.test",
        DeviceCode = $"concurrent-{index}",
        DeviceName = $"Concurrent Collector {index}",
        WatchFolders = new List<WatchFolderConfig>
        {
            new() { FolderPath = $"D:\\Concurrent\\{index}", FolderName = $"Concurrent {index}", Enabled = true }
        }
    }))
    .ToArray();
await Task.WhenAll(concurrentSaves);

var concurrentMainText = await File.ReadAllTextAsync(configPath);
using (var concurrentMainDoc = JsonDocument.Parse(concurrentMainText))
{
    var serverBaseUrl = concurrentMainDoc.RootElement.GetProperty("serverBaseUrl").GetString() ?? "";
    if (!serverBaseUrl.StartsWith("https://concurrent-", StringComparison.Ordinal)
        || !serverBaseUrl.EndsWith(".example.test", StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"Concurrent config save left an unexpected main config: {serverBaseUrl}");
    }
}
var concurrentBackupText = await File.ReadAllTextAsync(backupPath);
using (JsonDocument.Parse(concurrentBackupText))
{
}
if (Directory.EnumerateFiles(dataDir).Any(path => path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Temporary config file was left behind after concurrent saves.");
}

var bindingSnapshot = CollectorBindingIdentityPolicy.Capture(activeBinding);
activeBinding.ServerBaseUrl = "https://nanpai.eissys.top/agent";
activeBinding.DeviceName = "Renamed Collector";
if (CollectorBindingIdentityPolicy.InvalidateIfIdentityChanged(bindingSnapshot, activeBinding))
{
    throw new InvalidOperationException("Display-only changes and trailing slash normalization should not invalidate binding.");
}
activeBinding.DeviceCode = "collector-02";
if (!CollectorBindingIdentityPolicy.InvalidateIfIdentityChanged(bindingSnapshot, activeBinding))
{
    throw new InvalidOperationException("Changing a bound device code should invalidate local binding.");
}
if (activeBinding.DeviceStatus != "pending"
    || !string.IsNullOrWhiteSpace(activeBinding.DeviceId)
    || !string.IsNullOrWhiteSpace(activeBinding.EncryptedDeviceToken)
    || activeBinding.LastBoundAt is not null
    || activeBinding.LastRemoteConfigAt is not null
    || !string.IsNullOrWhiteSpace(activeBinding.RemoteConfigVersion))
{
    throw new InvalidOperationException("Binding identity invalidation did not clear local device credentials and remote state.");
}
var invalidatedStateSaveAttempted = false;
var invalidatedStateSaveFailure = await CollectorConfigSavePolicy.TrySaveBestEffortAsync(
    activeBinding,
    _ =>
    {
        invalidatedStateSaveAttempted = true;
        return Task.FromException(new IOException("simulated invalidated binding state save failure"));
    });
if (!invalidatedStateSaveAttempted || invalidatedStateSaveFailure is not IOException)
{
    throw new InvalidOperationException("Invalidated binding state save failure should be returned without throwing.");
}
if (activeBinding.DeviceStatus != "pending"
    || !string.IsNullOrWhiteSpace(activeBinding.DeviceId)
    || !string.IsNullOrWhiteSpace(activeBinding.EncryptedDeviceToken))
{
    throw new InvalidOperationException("Invalidated binding state should remain converged in memory when persistence fails.");
}
var invalidatedStateSaveSuccess = await CollectorConfigSavePolicy.TrySaveBestEffortAsync(
    activeBinding,
    _ => Task.CompletedTask);
if (invalidatedStateSaveSuccess is not null)
{
    throw new InvalidOperationException("Invalidated binding state save should report no failure when save succeeds.");
}

var pendingWithoutToken = new AppConfig
{
    ServerBaseUrl = "https://old.example.test",
    EnterpriseCode = "local",
    DeviceCode = "collector-pending",
    DeviceStatus = "pending"
};
var pendingSnapshot = CollectorBindingIdentityPolicy.Capture(pendingWithoutToken);
pendingWithoutToken.ServerBaseUrl = "https://new.example.test";
if (CollectorBindingIdentityPolicy.InvalidateIfIdentityChanged(pendingSnapshot, pendingWithoutToken))
{
    throw new InvalidOperationException("Unbound pending config should not be invalidated again.");
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

  console.log('PASS: collector config persistence regression')
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
