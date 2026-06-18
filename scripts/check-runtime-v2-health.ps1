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
    Write-Error $Message
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
