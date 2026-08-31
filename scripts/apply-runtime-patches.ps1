# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

param(
    [string]$ManifestFile = "database/migrations/runtime-v2.json",
    [string]$DbContainer = "eiscore-db",
    [string]$DbName = "eiscore",
    [string]$DbUser = "postgres",
    [string]$BackupEvidence = "",
    [string]$ReleaseRevision = "",
    [string]$Operator = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "apply-runtime-migrations.mjs"
$runnerArgs = @(
    $runner,
    "--manifest", $ManifestFile,
    "--db-container", $DbContainer,
    "--db-name", $DbName,
    "--db-user", $DbUser
)

if ($BackupEvidence) { $runnerArgs += @("--backup-evidence", $BackupEvidence) }
if ($ReleaseRevision) { $runnerArgs += @("--release-revision", $ReleaseRevision) }
if ($Operator) { $runnerArgs += @("--operator", $Operator) }
if ($DryRun) { $runnerArgs += "--dry-run" }

& node @runnerArgs
exit $LASTEXITCODE
