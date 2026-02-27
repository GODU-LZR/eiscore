param(
    [string]$DbContainer = "eiscore-db",
    [string]$DbName = "eiscore",
    [string]$DbUser = "postgres",
    [string]$OutDir = "backups/ontology"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "docker command not found."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$targetDir = Join-Path $repoRoot $OutDir
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$running = docker ps --format "{{.Names}}" | Select-String -Pattern ("^" + [regex]::Escape($DbContainer) + "$")
if (-not $running) {
    Fail "DB container is not running: $DbContainer"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$base = Join-Path $targetDir ("ontology_backup_" + $timestamp)
$metaPath = $base + ".meta.txt"
$semPath = $base + ".ontology_table_semantics.csv"
$relPath = $base + ".ontology_table_relations.csv"

Write-Host "Creating ontology backup at $base ..."

$meta = docker exec $DbContainer psql -U $DbUser -d $DbName -Atc "select 'backup_at='||now()||E'\n'||'client_encoding='||(select setting from pg_settings where name='client_encoding')||E'\n'||'semantics_count='||(select count(*) from public.ontology_table_semantics)||E'\n'||'relations_count='||(select count(*) from app_data.ontology_table_relations);"
$meta | Set-Content -Path $metaPath -Encoding UTF8

$semCsv = docker exec $DbContainer psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -c "COPY (SELECT * FROM public.ontology_table_semantics ORDER BY table_schema, table_name) TO STDOUT WITH CSV HEADER"
$semCsv | Set-Content -Path $semPath -Encoding UTF8

$relCsv = docker exec $DbContainer psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -c "COPY (SELECT * FROM app_data.ontology_table_relations ORDER BY id) TO STDOUT WITH CSV HEADER"
$relCsv | Set-Content -Path $relPath -Encoding UTF8

Write-Host "Backup completed:"
Write-Host "  $metaPath"
Write-Host "  $semPath"
Write-Host "  $relPath"

