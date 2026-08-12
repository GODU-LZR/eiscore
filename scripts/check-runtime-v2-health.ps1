# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

param(
    [switch]$Start,
    [switch]$SkipPostcheck,
    [switch]$SkipAccessSmoke,
    [int]$TimeoutSeconds = 90,
    [string]$DbContainer = "eiscore-db",
    [string]$DbName = "eiscore",
    [string]$DbUser = "postgres",
    [string]$AgentHealthUrl = "http://127.0.0.1:8078/health",
    [string]$PostgrestUrl = "http://127.0.0.1:3000/",
    [string]$Distro = $env:EISCORE_WSL_DISTRO,
    [string]$WslRepoRoot = $env:EISCORE_WSL_REPO_ROOT
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    [Console]::Error.WriteLine("ERROR: $Message")
    exit 1
}

function Convert-RepoRootToWsl {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string]$PreferredDistro
    )

    if ($RepoRoot -match "^\\\\wsl(?:\.localhost)?\\([^\\]+)\\(.+)$") {
        $detectedDistro = $Matches[1]
        $linuxPath = "/" + ($Matches[2] -replace "\\", "/")
        return @{
            Distro = $detectedDistro
            Path = $linuxPath
        }
    }

    $selectedDistro = if ($PreferredDistro) { $PreferredDistro } else { "Ubuntu" }
    $converted = & wsl.exe -d $selectedDistro -- wslpath -a $RepoRoot 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $converted) {
        Fail "Unable to convert repo path to WSL path. Set EISCORE_WSL_REPO_ROOT and EISCORE_WSL_DISTRO."
    }

    return @{
        Distro = $selectedDistro
        Path = $converted.Trim()
    }
}

function Get-OutputText {
    param([object[]]$Output)

    return (($Output | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

function Write-DockerDesktopDiagnostics {
    $service = Get-Service com.docker.service -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne "Running") {
        Write-Warning "Docker Desktop service com.docker.service is $($service.Status). Start Docker Desktop from an elevated Windows session if the engine cannot start."
    }

    if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) {
        Write-Warning "docker.exe command not found on Windows PATH; the WSL health script will still try the WSL Docker CLI."
        return
    }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $dockerInfo = & docker.exe info --format "{{.ServerVersion}}" 2>&1
        $dockerExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($dockerExitCode -ne 0) {
        Write-Warning ("Docker engine is not ready from Windows: " + (Get-OutputText $dockerInfo))
    }
}


function Test-WslDockerReady {
    param([Parameter(Mandatory = $true)][string]$Distro)

    $probe = & wsl.exe -d $Distro -- sh -lc "command -v docker >/dev/null 2>&1 && docker info --format '{{.ServerVersion}}'" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail "Docker is not ready inside WSL distro '$Distro'. Enable Docker Desktop WSL integration for this distro or restore the Docker engine. Raw error: $(Get-OutputText $probe)"
    }
}
function Test-WslDistroReady {
    param([Parameter(Mandatory = $true)][string]$Distro)

    $probe = & wsl.exe -d $Distro -- sh -lc "printf runtime-v2-wsl-ready" 2>&1
    $probeText = Get-OutputText $probe
    if ($LASTEXITCODE -ne 0 -or -not $probeText.Contains("runtime-v2-wsl-ready")) {
        Fail "WSL distro '$Distro' is not ready. Raw error: $probeText"
    }
}
function Normalize-LinuxPath([string]$Path) {
    $stack = New-Object 'System.Collections.Generic.List[string]'
    foreach ($segment in ($Path -split "/")) {
        if (-not $segment -or $segment -eq ".") {
            continue
        }
        if ($segment -eq "..") {
            if ($stack.Count -gt 0) {
                $stack.RemoveAt($stack.Count - 1)
            }
            continue
        }
        $stack.Add($segment)
    }
    return "/" + ($stack -join "/")
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Fail "wsl.exe command not found."
}

if (-not $Distro) {
    $Distro = "Ubuntu"
}

if ($WslRepoRoot) {
    $resolved = @{
        Distro = $Distro
        Path = $WslRepoRoot
    }
} else {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
    $resolved = Convert-RepoRootToWsl -RepoRoot $repoRoot -PreferredDistro $Distro
}

$resolved.Path = Normalize-LinuxPath $resolved.Path
Write-DockerDesktopDiagnostics
Test-WslDistroReady -Distro $resolved.Distro
Test-WslDockerReady -Distro $resolved.Distro
$scriptPath = ($resolved.Path.TrimEnd("/") + "/scripts/check-runtime-v2-health.sh")
$argsList = @()
if ($Start) { $argsList += "--start" }
if ($SkipPostcheck) { $argsList += "--skip-postcheck" }
if ($SkipAccessSmoke) { $argsList += "--skip-access-smoke" }
$argsList += @(
    "--timeout", [string]$TimeoutSeconds,
    "--db-container", $DbContainer,
    "--db-name", $DbName,
    "--db-user", $DbUser,
    "--agent-health", $AgentHealthUrl,
    "--postgrest", $PostgrestUrl
)

Write-Host "Running Runtime V2 health check in WSL distro $($resolved.Distro): $scriptPath" -ForegroundColor Cyan
& wsl.exe -d $resolved.Distro -- bash $scriptPath @argsList
exit $LASTEXITCODE
