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
echo "📊 Step 1/7: 初始化数据库..."
docker-compose up -d db
sleep 5

echo "   导入 app_center schema..."
docker exec -i eiscore-db psql -U postgres -d eiscore < sql/app_center_schema.sql 2>/dev/null || {
    echo "   ✅ Schema 已存在，跳过"
}

# Step 2: Build and start agent-runtime
echo ""
echo "🤖 Step 2/7: 构建 Agent Runtime..."
docker-compose build agent-runtime

echo "   启动 Agent Runtime..."
docker-compose up -d agent-runtime

# Step 3: Start other services
echo ""
echo "🐳 Step 3/7: 启动其他服务..."
docker-compose up -d

echo ""
echo "🧩 Step 4/7: 应用 Workflow 运行时补丁..."
for patch in sql/workflow_runtime_patch.sql sql/patch_lightweight_ontology_runtime.sql; do
    if [ ! -f "$patch" ]; then
        echo "❌ 缺少补丁文件: $patch"
        exit 1
    fi
    echo "   应用 $patch ..."
    docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore < "$patch"
done

echo ""
echo "🧪 Step 5/7: 执行本体语义 UTF-8 校验..."
./scripts/apply-sql-patch-utf8.sh -p sql/patch_fix_ontology_semantic_chinese.sql

# Step 6: Install frontend dependencies
echo ""
echo "📦 Step 6/7: 安装前端依赖..."

if [ ! -d "eiscore-apps/node_modules" ]; then
    echo "   安装 eiscore-apps 依赖..."
    cd eiscore-apps
    npm install
    cd ..
else
    echo "   ✅ eiscore-apps 依赖已安装"
fi

# Step 7: Check status
echo ""
echo "🔍 Step 7/7: 检查服务状态..."
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
