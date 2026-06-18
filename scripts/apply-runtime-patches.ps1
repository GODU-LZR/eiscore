# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

param(
    [string]$ManifestFile = "sql/runtime_v2_patch_manifest.txt",
    [string]$PostcheckFile = "sql/runtime_v2_postcheck.sql",
    [string]$DbContainer = "eiscore-db",
    [string]$DbName = "eiscore",
    [string]$DbUser = "postgres",
    [switch]$DryRun,
    [switch]$SkipPostcheck
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

function Invoke-DockerPsqlPatch {
    param(
        [Parameter(Mandatory = $true)][string]$PatchPath,
        [Parameter(Mandatory = $true)][string]$Container,
        [Parameter(Mandatory = $true)][string]$User,
        [Parameter(Mandatory = $true)][string]$Database
    )

    $bytes = [System.IO.File]::ReadAllBytes($PatchPath)
    $args = @("exec", "-i", $Container, "psql", "-v", "ON_ERROR_STOP=1", "-U", $User, "-d", $Database)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = ($args -join " ")
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()

    $proc.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
    $proc.StandardInput.Close()

    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($stdout) { Write-Host $stdout.TrimEnd() }
    if ($stderr) { Write-Host $stderr.TrimEnd() }

    return $proc.ExitCode
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "docker command not found."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).ProviderPath
$manifestPath = (Resolve-Path (Join-Path $repoRoot $ManifestFile)).ProviderPath
$postcheckPath = Join-Path $repoRoot $PostcheckFile

if (-not (Test-Path $manifestPath)) {
    Fail "Manifest file not found: $manifestPath"
}

if (-not $SkipPostcheck -and -not (Test-Path $postcheckPath)) {
    Fail "Postcheck file not found: $postcheckPath"
}

$running = docker ps --format "{{.Names}}" | Select-String -Pattern ("^" + [regex]::Escape($DbContainer) + "$")
if (-not $running) {
    Fail "DB container is not running: $DbContainer"
}

docker exec $DbContainer pg_isready -U $DbUser -d $DbName | Out-Null
if ($LASTEXITCODE -ne 0) {
    Fail "DB is not ready: $DbContainer/$DbName"
}

Write-Host "Using manifest: $ManifestFile"
Write-Host "Target database: $DbContainer/$DbName as $DbUser"

$patches = @()
foreach ($line in [System.IO.File]::ReadLines($manifestPath)) {
    $clean = ($line -replace "#.*$", "").Trim()
    if ($clean) { $patches += $clean }
}

$index = 0
foreach ($patchFile in $patches) {
    $index += 1
    $patchPath = Join-Path $repoRoot $patchFile
    if (-not (Test-Path $patchPath)) {
        Fail "Patch file not found: $patchFile"
    }

    Write-Host ""
    Write-Host ("[{0:D2}] {1}" -f $index, $patchFile)
    if ($DryRun) { continue }

    $exitCode = Invoke-DockerPsqlPatch -PatchPath $patchPath -Container $DbContainer -User $DbUser -Database $DbName
    if ($exitCode -ne 0) {
        Fail "Patch execution failed: $patchFile"
    }
}

Write-Host ""
if ($DryRun) {
    Write-Host "Dry run passed: $($patches.Count) patch file(s) are present." -ForegroundColor Green
} else {
    if (-not $SkipPostcheck) {
        Write-Host ""
        Write-Host "[postcheck] $PostcheckFile"
        $exitCode = Invoke-DockerPsqlPatch -PatchPath $postcheckPath -Container $DbContainer -User $DbUser -Database $DbName
        if ($exitCode -ne 0) {
            Fail "Runtime V2 postcheck failed."
        }
    }

    Write-Host "Runtime patch manifest applied: $($patches.Count) patch file(s)." -ForegroundColor Green
}
