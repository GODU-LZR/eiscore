<#
.SYNOPSIS
Publishes and verifies the EISCore Collector release in the local WSL/Docker stack.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\setup-local-wsl-release.ps1

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\setup-local-wsl-release.ps1 -SeedDevice -BindingCode local-bind-code
#>

[CmdletBinding()]
param(
    [string]$DownloadBaseUrl = "http://localhost/agent/document-intake/collector/releases",
    [string]$DockerComposeFile = "docker-compose.yml",
    [string]$InstallerArguments = "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS",
    [switch]$SkipPublish,
    [switch]$SkipAutoInstall,
    [switch]$SkipDockerRestart,
    [switch]$SeedDevice,
    [string]$DbContainer = "eiscore-db",
    [string]$DbName = "eiscore",
    [string]$DbUser = "postgres",
    [string]$EnterpriseCode = "local",
    [string]$DeviceCode = "local-collector-01",
    [string]$DeviceName = "Local Collector 01",
    [string]$BindingCode = "local-bind-code",
    [string]$DefaultUserId = "local-user",
    [string]$DefaultUsername = "local-user",
    [string]$DefaultRole = "warehouse",
    [string]$ServerBaseUrl = "http://localhost",
    [switch]$SkipDeviceApiCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath((Join-Path $repoRoot $RelativePath))
}

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name command was not found."
    }
}

function ConvertTo-BashQuoted {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return "''" }
    return "'" + $Value.Replace("'", "'""'""'") + "'"
}

function Join-BashArguments {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    return (($Arguments | ForEach-Object { ConvertTo-BashQuoted $_ }) -join " ")
}

function ConvertFrom-WslUncPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $normalized = $Path.Trim()
    if ($normalized -notmatch '^\\\\wsl(?:\.localhost)?\\([^\\]+)\\(.+)$') {
        return $null
    }

    return [pscustomobject]@{
        Distro = $matches[1]
        Path = "/" + ($matches[2] -replace '\\', '/')
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$WorkingDirectory = $repoRoot
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$FilePath failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Invoke-WslChecked {
    param([Parameter(Mandatory = $true)][string]$Command)

    & wsl.exe -d $script:wslDistro -- bash -lc $Command
    if ($LASTEXITCODE -ne 0) {
        throw "WSL command failed with exit code $LASTEXITCODE`: $Command"
    }
}

function Invoke-DockerCommand {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    if ($script:useWslDocker) {
        Invoke-WslChecked -Command ("docker " + (Join-BashArguments $Arguments))
        return
    }

    Invoke-Checked -FilePath "docker" -Arguments $Arguments
}

function Invoke-DockerCompose {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    if ($script:useWslDocker) {
        $composeArgs = @("compose", "-f", $script:composeArgumentPath) + $Arguments
        Invoke-WslChecked -Command ("cd " + (ConvertTo-BashQuoted $script:wslRepoRoot) + " && docker " + (Join-BashArguments $composeArgs))
        return
    }

    Invoke-Checked -FilePath "docker" -Arguments (@("compose", "-f", $script:composeArgumentPath) + $Arguments)
}

function ConvertTo-SqlLiteral {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return "null" }
    return "'" + $Value.Replace("'", "''") + "'"
}

function Invoke-DockerPsqlSql {
    param([Parameter(Mandatory = $true)][string]$Sql)

    $psqlArgs = @("exec", "-i", $DbContainer, "psql", "-v", "ON_ERROR_STOP=1", "-U", $DbUser, "-d", $DbName)
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    if ($script:useWslDocker) {
        $command = "(" + "docker " + (Join-BashArguments $psqlArgs) + ") 2>&1"
        try {
            $output = $Sql | & wsl.exe -d $script:wslDistro -- bash -lc $command
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
    } else {
        try {
            $output = $Sql | & docker @psqlArgs 2>&1
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
    }

    if ($output) { Write-Host (($output | Out-String).TrimEnd()) }
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed with exit code $LASTEXITCODE"
    }
}

function Invoke-CurlTextWithRetry {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Description,
        [int]$Attempts = 8,
        [int]$DelaySeconds = 2
    )

    $lastOutput = ""
    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        $output = & curl.exe @Arguments 2>&1
        $exitCode = $LASTEXITCODE
        $lastOutput = ($output | Out-String).Trim()
        if ($exitCode -eq 0) {
            return $lastOutput
        }

        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "$Description failed after $Attempts attempts. Last output: $lastOutput"
}

function Invoke-CurlDownloadWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$OutputPath,
        [int]$Attempts = 8,
        [int]$DelaySeconds = 2
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        & curl.exe -sS --max-time 120 -o $OutputPath $Url
        if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $OutputPath)) {
            return
        }

        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "Installer download failed after $Attempts attempts for $Url"
}

function Invoke-JsonApiWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [ValidateSet("GET", "POST")][string]$Method = "GET",
        [hashtable]$Headers = @{},
        [AllowNull()][object]$Body = $null,
        [int]$Attempts = 8,
        [int]$DelaySeconds = 2
    )

    $lastError = ""
    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        try {
            $invokeArgs = @{
                Uri = $Uri
                Method = $Method
                TimeoutSec = 30
            }
            if ($Headers.Count -gt 0) {
                $invokeArgs.Headers = $Headers
            }
            if ($null -ne $Body) {
                $invokeArgs.ContentType = "application/json"
                $invokeArgs.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
            }

            return Invoke-RestMethod @invokeArgs
        } catch {
            $lastError = $_.Exception.Message
            if ($attempt -lt $Attempts) {
                Start-Sleep -Seconds $DelaySeconds
            }
        }
    }

    throw "$Method $Uri failed after $Attempts attempts. Last error: $lastError"
}

$scriptRoot = Split-Path -Parent $PSCommandPath
$collectorRoot = Split-Path -Parent $scriptRoot
$repoRoot = Split-Path -Parent $collectorRoot
$releaseDirectory = Resolve-RepoPath "collector-desktop/artifacts/release"
$publishScript = Resolve-RepoPath "collector-desktop/scripts/publish-collector.ps1"
$composePath = Resolve-RepoPath $DockerComposeFile
$wslPath = ConvertFrom-WslUncPath $repoRoot
$script:useWslDocker = $null -ne $wslPath
$script:wslDistro = if ($wslPath) { $wslPath.Distro } else { "" }
$script:wslRepoRoot = if ($wslPath) { $wslPath.Path } else { "" }
$script:composeArgumentPath = if ($script:useWslDocker -and -not [System.IO.Path]::IsPathRooted($DockerComposeFile)) {
    $DockerComposeFile
} elseif ($script:useWslDocker) {
    $convertedComposePath = ConvertFrom-WslUncPath $composePath
    if (-not $convertedComposePath) {
        throw "DockerComposeFile must be inside WSL when the repository is on WSL: $DockerComposeFile"
    }
    $convertedComposePath.Path
} else {
    $composePath
}

if ($script:useWslDocker) {
    Assert-Command "wsl.exe"
    Invoke-WslChecked -Command "command -v docker >/dev/null"
    Write-Host "Using WSL Docker context: $($script:wslDistro):$($script:wslRepoRoot)" -ForegroundColor Cyan
} else {
    Assert-Command "docker"
}
Assert-Command "curl.exe"

if (-not $SkipPublish) {
    $publishArgs = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $publishScript,
        "-DownloadBaseUrl",
        $DownloadBaseUrl,
        "-BuildInstaller",
        "-InstallerArguments",
        $InstallerArguments,
        "-ReleaseDirectory",
        $releaseDirectory
    )
    if (-not $SkipAutoInstall) {
        $publishArgs += "-AutoInstall"
    }

    Write-Host "Publishing collector release..." -ForegroundColor Cyan
    Invoke-Checked -FilePath "powershell" -Arguments $publishArgs
}

if (-not $SkipDockerRestart) {
    Write-Host "Ensuring local Docker services are running..." -ForegroundColor Cyan
    Invoke-DockerCompose -Arguments @("up", "-d", "db", "api", "nginx")
    Invoke-DockerCompose -Arguments @("up", "-d", "--force-recreate", "agent-runtime")
    Start-Sleep -Seconds 2
}

if ($SeedDevice) {
    Write-Host "Seeding local collector device..." -ForegroundColor Cyan
    $manifestUrl = ($DownloadBaseUrl.TrimEnd('/')) + "/update.json"
    $seedSql = @"
create extension if not exists pgcrypto;

insert into public.collector_devices (
  enterprise_id,
  device_code,
  device_name,
  default_user_id,
  default_username,
  default_role,
  server_base_url,
  binding_code_hash,
  status,
  metadata,
  client_version
)
values (
  $(ConvertTo-SqlLiteral $EnterpriseCode),
  $(ConvertTo-SqlLiteral $DeviceCode),
  $(ConvertTo-SqlLiteral $DeviceName),
  $(ConvertTo-SqlLiteral $DefaultUserId),
  $(ConvertTo-SqlLiteral $DefaultUsername),
  $(ConvertTo-SqlLiteral $DefaultRole),
  $(ConvertTo-SqlLiteral $ServerBaseUrl),
  encode(digest($(ConvertTo-SqlLiteral $BindingCode), 'sha256'), 'hex'),
  'pending',
  jsonb_build_object(
    'remote_config',
    jsonb_build_object(
      'version', 'local-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      'default_user_id', $(ConvertTo-SqlLiteral $DefaultUserId),
      'default_username', $(ConvertTo-SqlLiteral $DefaultUsername),
      'default_role', $(ConvertTo-SqlLiteral $DefaultRole),
      'auto_start_enabled', false,
      'update', jsonb_build_object(
        'enabled', true,
        'manifest_url', $(ConvertTo-SqlLiteral $manifestUrl),
        'check_interval_hours', 1,
        'auto_install', true,
        'installer_arguments', $(ConvertTo-SqlLiteral $InstallerArguments)
      )
    )
  ),
  '0.2.0'
)
on conflict (enterprise_id, device_code) do update set
  device_name = excluded.device_name,
  default_user_id = excluded.default_user_id,
  default_username = excluded.default_username,
  default_role = excluded.default_role,
  server_base_url = excluded.server_base_url,
  binding_code_hash = excluded.binding_code_hash,
  metadata = excluded.metadata,
  updated_at = now()
returning id, enterprise_id, device_code, status, metadata->'remote_config'->'update' as update_config;
"@
    Invoke-DockerPsqlSql -Sql $seedSql
}

Write-Host "Verifying release manifest..." -ForegroundColor Cyan
$manifestUrlToFetch = ($DownloadBaseUrl.TrimEnd('/')) + "/update.json"
$manifestJson = Invoke-CurlTextWithRetry -Arguments @("-sS", "--max-time", "20", $manifestUrlToFetch) -Description "Manifest download"
$manifest = $manifestJson | ConvertFrom-Json
if (-not $manifest.download_url -or -not $manifest.sha256) {
    throw "Manifest is missing download_url or sha256."
}
$downloadUrlText = [string]$manifest.download_url
$expectedDownloadUrlPrefix = ($DownloadBaseUrl.TrimEnd('/')) + "/"
if (-not $downloadUrlText.StartsWith($expectedDownloadUrlPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Manifest download_url must point inside the configured DownloadBaseUrl. expectedPrefix=$expectedDownloadUrlPrefix actual=$downloadUrlText"
}

Write-Host "Verifying installer HEAD..." -ForegroundColor Cyan
$headText = Invoke-CurlTextWithRetry -Arguments @("-sS", "-I", "--max-time", "20", $downloadUrlText) -Description "Installer HEAD"
if ($headText -notmatch "200 OK") {
    throw "Installer HEAD check failed for $downloadUrlText"
}

Write-Host "Downloading installer for hash verification..." -ForegroundColor Cyan
$downloadPath = Join-Path ([System.IO.Path]::GetTempPath()) ("eiscore-collector-release-check-" + [Guid]::NewGuid().ToString("N") + ".exe")
Invoke-CurlDownloadWithRetry -Url $downloadUrlText -OutputPath $downloadPath

$actualHash = (Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash.ToLowerInvariant()
$expectedHash = [string]$manifest.sha256
if (-not [string]::Equals($actualHash, $expectedHash, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Installer SHA256 mismatch. expected=$expectedHash actual=$actualHash"
}

$deviceApiCheck = $null
if ($SeedDevice -and -not $SkipDeviceApiCheck) {
    Write-Host "Verifying device bind/config/heartbeat..." -ForegroundColor Cyan
    $apiBaseUrl = $ServerBaseUrl.TrimEnd("/")
    $expectedManifestUrl = ($DownloadBaseUrl.TrimEnd("/")) + "/update.json"
    $bindResponse = Invoke-JsonApiWithRetry -Uri "$apiBaseUrl/agent/document-intake/devices/bind" -Method "POST" -Body @{
        enterpriseCode = $EnterpriseCode
        deviceCode = $DeviceCode
        deviceName = $DeviceName
        authorizationCode = $BindingCode
        defaultUserId = $DefaultUserId
        defaultUsername = $DefaultUsername
        defaultRole = $DefaultRole
        clientVersion = [string]$manifest.version
    }
    if (-not $bindResponse.deviceToken) {
        throw "Device bind did not return a deviceToken."
    }

    $authHeaders = @{ Authorization = "Bearer $($bindResponse.deviceToken)" }
    $configResponse = Invoke-JsonApiWithRetry -Uri "$apiBaseUrl/agent/document-intake/devices/config" -Method "GET" -Headers $authHeaders
    if ($configResponse.config.update.manifestUrl -ne $expectedManifestUrl) {
        throw "Device config manifestUrl mismatch. expected=$expectedManifestUrl actual=$($configResponse.config.update.manifestUrl)"
    }
    if (-not [bool]$configResponse.config.update.autoInstall) {
        throw "Device config update.autoInstall was not enabled."
    }

    $heartbeatResponse = Invoke-JsonApiWithRetry -Uri "$apiBaseUrl/agent/document-intake/devices/heartbeat" -Method "POST" -Headers $authHeaders -Body @{
        clientVersion = [string]$manifest.version
    }
    if (-not [bool]$heartbeatResponse.ok) {
        throw "Device heartbeat did not return ok=true."
    }

    $deviceApiCheck = [ordered]@{
        deviceId = $bindResponse.deviceId
        deviceCode = $bindResponse.deviceCode
        tokenLength = ([string]$bindResponse.deviceToken).Length
        configVersion = $configResponse.configVersion
        manifestUrl = $configResponse.config.update.manifestUrl
        heartbeatOk = [bool]$heartbeatResponse.ok
        heartbeatConfigVersion = $heartbeatResponse.configVersion
    }
}

[ordered]@{
    manifestUrl = $manifestUrlToFetch
    downloadUrl = $downloadUrlText
    version = $manifest.version
    sha256 = $actualHash
    downloadedBytes = (Get-Item -LiteralPath $downloadPath).Length
    seedDevice = [bool]$SeedDevice
    deviceApi = $deviceApiCheck
} | ConvertTo-Json -Depth 4
