#!/bin/bash

# ========================================
# App Center Quick Start Script
# ========================================

set -e

echo "🚀 启动 EISCore 应用中心..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，从模板创建..."
    cp .env.example .env
    echo "❗ 请编辑 .env 文件并配置 ANTHROPIC_API_KEY"
    exit 1
fi

# Check ANTHROPIC_API_KEY
if ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
    echo "❌ ANTHROPIC_API_KEY 未配置！"
    echo "请在 .env 文件中设置有效的 Anthropic API Key"
    exit 1
fi

# Step 1: Initialize database
echo ""
echo "📊 Step 1/5: 初始化数据库..."
docker-compose up -d db
sleep 5

echo "   导入 app_center schema..."
docker exec -i eiscore-db psql -U postgres -d eiscore < sql/app_center_schema.sql 2>/dev/null || {
    echo "   ✅ Schema 已存在，跳过"
}

# Step 2: Build and start agent-runtime
echo ""
echo "🤖 Step 2/5: 构建 Agent Runtime..."
docker-compose build agent-runtime

echo "   启动 Agent Runtime..."
docker-compose up -d agent-runtime

# Step 3: Start other services
echo ""
echo "🐳 Step 3/5: 启动其他服务..."
docker-compose up -d

# Step 4: Install frontend dependencies
echo ""
echo "📦 Step 4/5: 安装前端依赖..."

if [ ! -d "eiscore-apps/node_modules" ]; then
    echo "   安装 eiscore-apps 依赖..."
    cd eiscore-apps
    npm install
    cd ..
else
    echo "   ✅ eiscore-apps 依赖已安装"
fi

# Step 5: Check status
echo ""
echo "🔍 Step 5/5: 检查服务状态..."
sleep 3

docker-compose ps

echo ""
echo "✅ 部署完成！"
echo ""
echo "📌 下一步："
echo "   1. 启动基座应用："
echo "      cd eiscore-base && npm run dev"
echo ""
echo "   2. 启动应用中心："
echo "      cd eiscore-apps && npm run dev"
echo ""
echo "   3. 访问："
echo "      - 主应用: http://localhost:8080"
echo "      - 应用中心: http://localhost:8080/apps"
echo ""
echo "📚 查看文档："
echo "   cat APP_CENTER_DEPLOYMENT.md"
echo ""
echo "🐛 查看日志："
echo "   docker-compose logs -f agent-runtime"
echo ""
