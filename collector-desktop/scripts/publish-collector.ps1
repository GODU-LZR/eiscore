<#
.SYNOPSIS
Publishes EISCore Collector and writes an auto-update manifest.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -DownloadBaseUrl https://download.example.com/eiscore/collector

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -DownloadBaseUrl https://download.example.com/eiscore/collector `
  -BuildInstaller `
  -AutoInstall `
  -InstallerArguments "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS"

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -PackagePath .\collector-desktop\artifacts\installer\EISCore.Collector-0.2.0.msi `
  -DownloadBaseUrl https://download.example.com/eiscore/collector `
  -AutoInstall `
  -InstallerArguments "/quiet /norestart"
#>

[CmdletBinding()]
param(
    [string]$Version = "",
    [ValidateSet("Release", "Debug")]
    [string]$Configuration = "Release",
    [ValidateSet("win-x64", "win-x86", "win-arm64")]
    [string]$Runtime = "win-x64",
    [string]$OutputRoot = "",
    [string]$DownloadBaseUrl = "",
    [string]$PackagePath = "",
    [string]$InstallerScript = "",
    [string]$InnoSetupCompiler = "",
    [string]$ManifestFileName = "update.json",
    [string]$InstallerArguments = "",
    [string]$AppPublisher = "EISCore",
    [string]$AppUrl = "https://nanpai.eissys.top",
    [switch]$SelfContained,
    [switch]$SingleFile,
    [switch]$BuildInstaller,
    [switch]$SkipManifest,
    [switch]$Mandatory,
    [switch]$AutoInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-FullPath {
    param([Parameter(Mandatory = $true)][string]$PathValue)
    return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PathValue)
}

function ConvertTo-SafeFilePart {
    param([Parameter(Mandatory = $true)][string]$Value)
    return ($Value -replace "[^A-Za-z0-9._-]", "-")
}

function Get-ProjectVersion {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectPath,
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )

    [xml]$projectXml = Get-Content -LiteralPath $ProjectPath -Raw
    foreach ($propertyGroup in @($projectXml.Project.PropertyGroup)) {
        $versionNode = $propertyGroup.PSObject.Properties["Version"]
        if ($versionNode -and -not [string]::IsNullOrWhiteSpace([string]$versionNode.Value)) {
            return ([string]$versionNode.Value).Trim()
        }
    }

    $packageJsonPath = Join-Path $RepoRoot "package.json"
    if (Test-Path -LiteralPath $packageJsonPath) {
        $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
        $versionProperty = $packageJson.PSObject.Properties["version"]
        if ($versionProperty -and -not [string]::IsNullOrWhiteSpace([string]$versionProperty.Value)) {
            return ([string]$versionProperty.Value).Trim()
        }
    }

    return "0.1.0"
}

function Reset-Directory {
    param(
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [Parameter(Mandatory = $true)][string]$AllowedRoot
    )

    $targetFullPath = Resolve-FullPath $TargetPath
    $allowedRootFullPath = Resolve-FullPath $AllowedRoot
    if (-not $targetFullPath.StartsWith($allowedRootFullPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clear a path outside the output root: $targetFullPath"
    }

    if (Test-Path -LiteralPath $targetFullPath) {
        Remove-Item -LiteralPath $targetFullPath -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $targetFullPath | Out-Null
}

function Get-Sha256Hex {
    param([Parameter(Mandatory = $true)][string]$FilePath)
    return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Join-DownloadUrl {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][string]$FileName
    )

    $base = $BaseUrl.TrimEnd("/")
    $encoded = [System.Uri]::EscapeDataString($FileName)
    return "$base/$encoded"
}

function ConvertTo-InnoStringLiteral {
    param([Parameter(Mandatory = $true)][string]$Value)
    return '"' + ($Value -replace '"', '""') + '"'
}

function Test-DotnetSdk {
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
        return $false
    }

    $sdks = & dotnet --list-sdks 2>$null
    return -not [string]::IsNullOrWhiteSpace(($sdks -join ""))
}

function Find-InnoSetupCompiler {
    param([string]$PreferredPath = "")

    if (-not [string]::IsNullOrWhiteSpace($PreferredPath)) {
        $fullPath = (Resolve-Path -LiteralPath $PreferredPath).ProviderPath
        if (Test-Path -LiteralPath $fullPath) {
            return $fullPath
        }
    }

    $command = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "Inno Setup compiler ISCC.exe was not found. Install Inno Setup 6 or pass -InnoSetupCompiler."
}

function Invoke-InnoSetupBuild {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$OutputDir,
        [Parameter(Mandatory = $true)][string]$OutputBaseFilename,
        [Parameter(Mandatory = $true)][string]$Version,
        [Parameter(Mandatory = $true)][string]$Publisher,
        [Parameter(Mandatory = $true)][string]$Url,
        [string]$CompilerPath = ""
    )

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        throw "Inno Setup script was not found: $ScriptPath"
    }
    if (-not (Test-Path -LiteralPath $SourceDir)) {
        throw "Installer source directory was not found: $SourceDir"
    }

    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $iscc = Find-InnoSetupCompiler -PreferredPath $CompilerPath
    $args = @(
        "/DAppVersion=$(ConvertTo-InnoStringLiteral $Version)",
        "/DSourceDir=$(ConvertTo-InnoStringLiteral $SourceDir)",
        "/DOutputDir=$(ConvertTo-InnoStringLiteral $OutputDir)",
        "/DOutputBaseFilename=$(ConvertTo-InnoStringLiteral $OutputBaseFilename)",
        "/DAppPublisher=$(ConvertTo-InnoStringLiteral $Publisher)",
        "/DAppUrl=$(ConvertTo-InnoStringLiteral $Url)",
        $ScriptPath
    )

    & $iscc @args
    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup compiler failed with exit code $LASTEXITCODE"
    }

    $installerPath = Join-Path $OutputDir "$OutputBaseFilename.exe"
    if (-not (Test-Path -LiteralPath $installerPath)) {
        throw "Installer was not produced: $installerPath"
    }

    return (Resolve-Path -LiteralPath $installerPath).ProviderPath
}

$scriptRoot = Split-Path -Parent $PSCommandPath
$collectorRoot = Split-Path -Parent $scriptRoot
$repoRoot = Split-Path -Parent $collectorRoot
$projectPath = Join-Path $collectorRoot "EISCore.Collector\EISCore.Collector.csproj"

if (-not (Test-Path -LiteralPath $projectPath)) {
    throw "Collector project was not found: $projectPath"
}

if ($BuildInstaller -and -not [string]::IsNullOrWhiteSpace($PackagePath)) {
    throw "BuildInstaller cannot be combined with PackagePath. Use PackagePath for prebuilt installer manifest generation."
}

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $collectorRoot "artifacts"
}

$outputRootFullPath = Resolve-FullPath $OutputRoot
New-Item -ItemType Directory -Force -Path $outputRootFullPath | Out-Null

if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = Get-ProjectVersion -ProjectPath $projectPath -RepoRoot $repoRoot
}
$Version = $Version.Trim()
$safeVersion = ConvertTo-SafeFilePart $Version
$zipArtifactPath = ""
$installerArtifactPath = ""

if (-not $SkipManifest -and [string]::IsNullOrWhiteSpace($DownloadBaseUrl)) {
    throw "DownloadBaseUrl is required when writing update manifest. Use -SkipManifest for local package-only builds."
}

if (-not [string]::IsNullOrWhiteSpace($PackagePath)) {
    $artifactPath = (Resolve-Path -LiteralPath $PackagePath).ProviderPath
} else {
    if (-not (Test-DotnetSdk)) {
        throw "dotnet SDK was not found. Install .NET SDK or provide -PackagePath for manifest-only packaging."
    }

    $publishDir = Join-Path $outputRootFullPath "publish\EISCore.Collector-$safeVersion-$Runtime"
    Reset-Directory -TargetPath $publishDir -AllowedRoot $outputRootFullPath

    $selfContainedValue = if ($SelfContained) { "true" } else { "false" }
    $singleFileValue = if ($SingleFile) { "true" } else { "false" }
    $publishArgs = @(
        "publish",
        $projectPath,
        "-c",
        $Configuration,
        "-r",
        $Runtime,
        "--self-contained:$selfContainedValue",
        "-o",
        $publishDir,
        "/p:Version=$Version",
        "/p:InformationalVersion=$Version",
        "/p:PublishSingleFile=$singleFileValue"
    )

    & dotnet @publishArgs
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet publish failed with exit code $LASTEXITCODE"
    }

    $packageDir = Join-Path $outputRootFullPath "packages"
    New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
    $artifactPath = Join-Path $packageDir "EISCore.Collector-$safeVersion-$Runtime.zip"
    if (Test-Path -LiteralPath $artifactPath) {
        Remove-Item -LiteralPath $artifactPath -Force
    }

    Compress-Archive -Path (Join-Path $publishDir "*") -DestinationPath $artifactPath -Force
    $zipArtifactPath = (Resolve-Path -LiteralPath $artifactPath).ProviderPath

    if ($BuildInstaller) {
        if ([string]::IsNullOrWhiteSpace($InstallerScript)) {
            $InstallerScript = Join-Path $collectorRoot "installer\EISCore.Collector.iss"
        }

        $installerDir = Join-Path $outputRootFullPath "installer"
        $installerBaseName = "EISCore.Collector-$safeVersion-$Runtime-setup"
        $installerArtifactPath = Invoke-InnoSetupBuild `
            -ScriptPath $InstallerScript `
            -SourceDir $publishDir `
            -OutputDir $installerDir `
            -OutputBaseFilename $installerBaseName `
            -Version $Version `
            -Publisher $AppPublisher `
            -Url $AppUrl `
            -CompilerPath $InnoSetupCompiler
        $artifactPath = $installerArtifactPath
    }
}

$artifactPath = (Resolve-Path -LiteralPath $artifactPath).ProviderPath
$artifactFileName = Split-Path -Leaf $artifactPath
$artifactHash = Get-Sha256Hex -FilePath $artifactPath
$installerExtensions = @(".exe", ".msi", ".msix", ".cmd", ".bat")
$artifactExtension = [System.IO.Path]::GetExtension($artifactPath).ToLowerInvariant()
$canShellInstall = $installerExtensions -contains $artifactExtension
$effectiveAutoInstall = [bool]$AutoInstall

if ($effectiveAutoInstall -and -not $canShellInstall) {
    Write-Warning "AutoInstall was requested, but $artifactExtension is not treated as an installer. Manifest auto_install will be false."
    $effectiveAutoInstall = $false
}

$manifestPath = ""
$downloadUrl = ""
if (-not $SkipManifest) {
    $manifestDir = Join-Path $outputRootFullPath "manifest"
    New-Item -ItemType Directory -Force -Path $manifestDir | Out-Null
    $manifestPath = Join-Path $manifestDir $ManifestFileName
    $downloadUrl = Join-DownloadUrl -BaseUrl $DownloadBaseUrl -FileName $artifactFileName

    $manifest = [ordered]@{
        version = $Version
        download_url = $downloadUrl
        sha256 = $artifactHash
        mandatory = [bool]$Mandatory
        auto_install = $effectiveAutoInstall
        installer_arguments = if ($canShellInstall) { $InstallerArguments } else { "" }
    }

    $manifestJson = $manifest | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($manifestPath, $manifestJson + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

$result = [ordered]@{
    version = $Version
    runtime = $Runtime
    artifactPath = $artifactPath
    zipArtifactPath = $zipArtifactPath
    installerArtifactPath = $installerArtifactPath
    artifactSha256 = $artifactHash
    manifestPath = $manifestPath
    downloadUrl = $downloadUrl
    autoInstall = $effectiveAutoInstall
}

$result | ConvertTo-Json -Depth 4
