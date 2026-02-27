#!/bin/bash

# ========================================
# Deploy App Center with PM2
# ========================================

set -e

echo "🚀 部署 EISCore 应用中心（PM2 模式）"

# Step 1: Check environment
echo ""
echo "📋 Step 1/9: 检查环境..."

if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，从模板创建..."
    cp .env.example .env
    # Set default values
    sed -i 's/POSTGRES_PASSWORD=change_me/POSTGRES_PASSWORD=postgres123/' .env
    sed -i 's/PGRST_JWT_SECRET=change_me/PGRST_JWT_SECRET=your-secret-jwt-key-min-32-chars-long/' .env
    echo "✅ .env 文件已创建（使用默认配置）"
fi

# Check ANTHROPIC_API_KEY (warning only, not required)
if ! grep -q "^ANTHROPIC_API_KEY=sk-ant-" .env 2>/dev/null; then
    echo "⚠️  ANTHROPIC_API_KEY 未配置，AI Agent 功能将不可用"
    echo "   如需使用 Flash Builder，请在 .env 中配置有效的 API Key"
fi

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 未安装，正在安装..."
    npm install -g pm2
fi

echo "✅ 环境检查完成"

# Step 2: Create logs directory
echo ""
echo "📁 Step 2/9: 创建日志目录..."
mkdir -p logs

# Step 3: Start Docker services
echo ""
echo "🐳 Step 3/9: 启动 Docker 服务..."
docker-compose up -d db
sleep 5

echo "   导入 app_center schema..."
docker exec -i eiscore-db psql -U postgres -d eiscore < sql/app_center_schema.sql 2>/dev/null || {
    echo "   ✅ Schema 已存在，跳过"
}

echo "   构建并启动 agent-runtime..."
docker-compose build agent-runtime
docker-compose up -d

echo ""
echo "🧩 Step 4/9: 应用 Workflow 运行时补丁..."
for patch in sql/workflow_runtime_patch.sql sql/patch_lightweight_ontology_runtime.sql; do
    if [ ! -f "$patch" ]; then
        echo "❌ 缺少补丁文件: $patch"
        exit 1
    fi
    echo "   应用 $patch ..."
    docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore < "$patch"
done

echo ""
echo "🧪 Step 5/9: 执行本体语义 UTF-8 校验..."
./scripts/apply-sql-patch-utf8.sh -p sql/patch_fix_ontology_semantic_chinese.sql

# Step 6: Install dependencies
echo ""
echo "📦 Step 6/9: 安装前端依赖..."

for app in eiscore-base eiscore-hr eiscore-materials eiscore-apps; do
    if [ -d "$app" ]; then
        if [ ! -d "$app/node_modules" ]; then
            echo "   安装 $app 依赖..."
            cd $app
            npm install
            cd ..
        else
            echo "   ✅ $app 依赖已安装"
        fi
    fi
done

# Step 7: Stop existing PM2 processes
echo ""
echo "🛑 Step 7/9: 停止现有 PM2 进程..."
pm2 delete all 2>/dev/null || true

# Step 8: Start with PM2
echo ""
echo "▶️  Step 8/9: 使用 PM2 启动前端服务..."
pm2 start ecosystem.config.js

# Step 9: Save PM2 configuration
echo ""
echo "💾 Step 9/9: 保存 PM2 配置..."
pm2 save

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服务状态："
pm2 status

echo ""
echo "📌 常用命令："
echo "   查看日志：pm2 logs"
echo "   查看特定服务日志：pm2 logs eiscore-apps"
echo "   重启服务：pm2 restart eiscore-apps"
echo "   停止所有服务：pm2 stop all"
echo "   查看监控：pm2 monit"
echo ""
echo "🌐 访问地址："
echo "   主应用：http://localhost:8080"
echo "   应用中心：http://localhost:8080/apps"
echo ""
echo "🐛 Docker 日志："
echo "   docker-compose logs -f agent-runtime"
echo ""
