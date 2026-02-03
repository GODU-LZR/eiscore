# Start eiscore-apps development server
# Run this in PowerShell

Write-Host "🚀 启动 eiscore-apps 开发服务器..." -ForegroundColor Green

$appsManagePath = "\\wsl.localhost\Ubuntu\home\lzr\eiscore\eiscore-apps"

# Check if directory exists
if (-not (Test-Path $appsManagePath)) {
    Write-Host "❌ 目录不存在: $appsManagePath" -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "$appsManagePath\node_modules")) {
    Write-Host "📦 安装依赖..." -ForegroundColor Cyan
    Push-Location $appsManagePath
    npm install --legacy-peer-deps
    Pop-Location
}

# Start dev server
Write-Host "▶️  启动开发服务器..." -ForegroundColor Cyan
Write-Host "   端口: 8083" -ForegroundColor Gray
Write-Host "   路径: $appsManagePath" -ForegroundColor Gray
Write-Host ""

Push-Location $appsManagePath
npm run dev
Pop-Location
