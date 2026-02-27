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
Write-Host "📊 Step 1/7: 初始化数据库..." -ForegroundColor Cyan
docker-compose up -d db
Start-Sleep -Seconds 5

Write-Host "   导入 app_center schema..."
Get-Content sql\app_center_schema.sql | docker exec -i eiscore-db psql -U postgres -d eiscore 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✅ Schema 已存在，跳过" -ForegroundColor Green
}

# Step 2: Build and start agent-runtime
Write-Host ""
Write-Host "🤖 Step 2/7: 构建 Agent Runtime..." -ForegroundColor Cyan
docker-compose build agent-runtime

Write-Host "   启动 Agent Runtime..."
docker-compose up -d agent-runtime

# Step 3: Start other services
Write-Host ""
Write-Host "🐳 Step 3/7: 启动其他服务..." -ForegroundColor Cyan
docker-compose up -d

# Step 4: Workflow runtime patches
Write-Host ""
Write-Host "🧩 Step 4/7: 应用 Workflow 运行时补丁..." -ForegroundColor Cyan
$workflowPatches = @(
    "sql/workflow_runtime_patch.sql",
    "sql/patch_lightweight_ontology_runtime.sql"
)
foreach ($patch in $workflowPatches) {
    if (-not (Test-Path $patch)) {
        Write-Host "❌ 缺少补丁文件: $patch" -ForegroundColor Red
        exit 1
    }
    Write-Host "   应用 $patch ..."
    Get-Content $patch -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Workflow 补丁执行失败: $patch" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# Step 5: UTF-8 ontology patch and validation
Write-Host ""
Write-Host "🧪 Step 5/7: 执行本体语义 UTF-8 校验..." -ForegroundColor Cyan
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\apply-sql-patch-utf8.ps1 -PatchFile "sql/patch_fix_ontology_semantic_chinese.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 本体语义 UTF-8 校验失败，终止部署" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Step 6: Install frontend dependencies
Write-Host ""
Write-Host "📦 Step 6/7: 安装前端依赖..." -ForegroundColor Cyan

if (-not (Test-Path "eiscore-apps\node_modules")) {
    Write-Host "   安装 eiscore-apps 依赖..."
    Set-Location eiscore-apps
    npm install
    Set-Location ..
} else {
    Write-Host "   ✅ eiscore-apps 依赖已安装" -ForegroundColor Green
}

# Step 7: Check status
Write-Host ""
Write-Host "🔍 Step 7/7: 检查服务状态..." -ForegroundColor Cyan
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
