param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$python = "C:\Users\Twist\.aigc-scan\venv\Scripts\python.exe"
$script = "\\wsl.localhost\Ubuntu\home\lzr\eiscore\tools\aigc_scan\scan_thesis.py"

if (!(Test-Path $python)) {
    throw "Python runtime not found: $python"
}

if (!(Test-Path $script)) {
    throw "Scanner script not found: $script"
}

$args = @($script, $InputPath)
if ($OutputDir -ne "") {
    $args += @("--output-dir", $OutputDir)
}

& $python @args
