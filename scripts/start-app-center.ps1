# ========================================
# App Center Quick Start Script (Windows)
# ========================================

Write-Host "🚀 启动 EISCore 应用中心..." -ForegroundColor Green

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "⚠️  未找到 .env 文件，从模板创建..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "❗ 请编辑 .env 文件并配置 ANTHROPIC_API_KEY" -ForegroundColor Red
    exit 1
}

# Check ANTHROPIC_API_KEY
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "ANTHROPIC_API_KEY=sk-ant-") {
    Write-Host "❌ ANTHROPIC_API_KEY 未配置！" -ForegroundColor Red
    Write-Host "请在 .env 文件中设置有效的 Anthropic API Key"
    exit 1
}

# Step 1: Initialize database
Write-Host ""
Write-Host "📊 Step 1/5: 初始化数据库..." -ForegroundColor Cyan
docker-compose up -d db
Start-Sleep -Seconds 5

Write-Host "   导入 app_center schema..."
Get-Content sql\app_center_schema.sql | docker exec -i eiscore-db psql -U postgres -d eiscore 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✅ Schema 已存在，跳过" -ForegroundColor Green
}

# Step 2: Build and start agent-runtime
Write-Host ""
Write-Host "🤖 Step 2/5: 构建 Agent Runtime..." -ForegroundColor Cyan
docker-compose build agent-runtime

Write-Host "   启动 Agent Runtime..."
docker-compose up -d agent-runtime

# Step 3: Start other services
Write-Host ""
Write-Host "🐳 Step 3/5: 启动其他服务..." -ForegroundColor Cyan
docker-compose up -d

# Step 4: Install frontend dependencies
Write-Host ""
Write-Host "📦 Step 4/5: 安装前端依赖..." -ForegroundColor Cyan

if (-not (Test-Path "eiscore-apps\node_modules")) {
    Write-Host "   安装 eiscore-apps 依赖..."
    Set-Location eiscore-apps
    npm install
    Set-Location ..
} else {
    Write-Host "   ✅ eiscore-apps 依赖已安装" -ForegroundColor Green
}

# Step 5: Check status
Write-Host ""
Write-Host "🔍 Step 5/5: 检查服务状态..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

docker-compose ps

Write-Host ""
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📌 下一步：" -ForegroundColor Yellow
Write-Host "   1. 启动基座应用："
Write-Host "      cd eiscore-base; npm run dev"
Write-Host ""
Write-Host "   2. 启动应用中心："
Write-Host "      cd eiscore-apps; npm run dev"
Write-Host ""
Write-Host "   3. 访问："
Write-Host "      - 主应用: http://localhost:8080"
Write-Host "      - 应用中心: http://localhost:8080/apps"
Write-Host ""
Write-Host "📚 查看文档：" -ForegroundColor Cyan
Write-Host "   Get-Content APP_CENTER_DEPLOYMENT.md"
Write-Host ""
Write-Host "🐛 查看日志：" -ForegroundColor Cyan
Write-Host "   docker-compose logs -f agent-runtime"
Write-Host ""
