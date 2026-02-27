param(
    [string]$PatchFile = "sql/patch_fix_ontology_semantic_chinese.sql",
    [string]$DbContainer = "eiscore-db",
    [string]$DbName = "eiscore",
    [string]$DbUser = "postgres",
    [switch]$SkipBackup
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

    $bytes = Get-Content -Path $PatchPath -Encoding Byte -ReadCount 0
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

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$patchPath = (Resolve-Path (Join-Path $repoRoot $PatchFile)).Path

if (-not (Test-Path $patchPath)) {
    Fail "Patch file not found: $patchPath"
}

$running = docker ps --format "{{.Names}}" | Select-String -Pattern ("^" + [regex]::Escape($DbContainer) + "$")
if (-not $running) {
    Fail "DB container is not running: $DbContainer"
}

if (-not $SkipBackup) {
    Write-Host "Creating backup before patch..." -ForegroundColor Cyan
    $backupScript = Join-Path $PSScriptRoot "backup-ontology-semantics.ps1"
    try {
        & $backupScript -DbContainer $DbContainer -DbName $DbName -DbUser $DbUser
    } catch {
        Fail "Backup failed."
    }
}

Write-Host "Applying patch with UTF-8 input..." -ForegroundColor Cyan
$exitCode = Invoke-DockerPsqlPatch -PatchPath $patchPath -Container $DbContainer -User $DbUser -Database $DbName

if ($exitCode -ne 0) {
    Fail "Patch execution failed."
}

Write-Host "Running UTF-8 / semantic checks..." -ForegroundColor Cyan
$clientEncoding = docker exec $DbContainer psql -U $DbUser -d $DbName -Atc "show client_encoding;"
$garbledSemantics = docker exec $DbContainer psql -U $DbUser -d $DbName -Atc "select count(*) from public.ontology_table_semantics where semantic_name like '%?%' or semantic_description like '%?%';"
$garbledRelations = docker exec $DbContainer psql -U $DbUser -d $DbName -Atc "select count(*) from app_data.ontology_table_relations where relation_type='ontology' and (coalesce(subject_semantic_name,'') like '%?%' or coalesce(object_semantic_name,'') like '%?%');"

Write-Host ("client_encoding=" + $clientEncoding)
Write-Host ("garbled_semantics=" + $garbledSemantics)
Write-Host ("garbled_ontology_relations=" + $garbledRelations)

if ($clientEncoding.Trim() -ne "UTF8") {
    Fail "client_encoding is not UTF8."
}
if ([int]$garbledSemantics.Trim() -ne 0 -or [int]$garbledRelations.Trim() -ne 0) {
    Fail "Validation failed: garbled semantic text still exists."
}

Write-Host "Done: patch applied and UTF-8 validation passed." -ForegroundColor Green
