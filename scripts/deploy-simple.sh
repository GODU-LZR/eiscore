#!/bin/bash

# ========================================
# Simple Deploy Script (No PM2)
# ========================================

set -e

echo "🚀 部署 EISCore 应用中心"

cd /home/lzr/eiscore

# Step 1: Check .env
echo ""
echo "📋 Step 1/7: 检查环境配置..."
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i 's/POSTGRES_PASSWORD=change_me/POSTGRES_PASSWORD=postgres123/' .env
    sed -i 's/PGRST_JWT_SECRET=change_me/PGRST_JWT_SECRET=your-secret-jwt-key-min-32-chars-long/' .env
    echo "✅ .env 已创建"
fi

# Step 2: Start Docker
echo ""
echo "🐳 Step 2/7: 启动 Docker 服务..."
docker-compose up -d db
sleep 3

echo "   导入数据库 schema..."
docker exec -i eiscore-db psql -U postgres -d eiscore < sql/app_center_schema.sql 2>/dev/null || echo "   Schema 已存在"

docker-compose build agent-runtime 2>&1 | grep -E "(Step|Successfully|built)" || true
docker-compose up -d

echo ""
echo "🧩 Step 3/7: 应用 Workflow 运行时补丁..."
for patch in sql/workflow_runtime_patch.sql sql/patch_lightweight_ontology_runtime.sql; do
    if [ ! -f "$patch" ]; then
        echo "❌ 缺少补丁文件: $patch"
        exit 1
    fi
    echo "   应用 $patch ..."
    docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore < "$patch"
done

echo ""
echo "🧪 Step 4/7: 执行本体语义 UTF-8 校验..."
./scripts/apply-sql-patch-utf8.sh -p sql/patch_fix_ontology_semantic_chinese.sql

# Step 5: Install dependencies
echo ""
echo "📦 Step 5/7: 安装依赖..."
for app in eiscore-apps eiscore-base eiscore-hr eiscore-materials; do
    if [ -d "$app" ] && [ ! -d "$app/node_modules" ]; then
        echo "   安装 $app..."
        cd $app
        npm install --legacy-peer-deps 2>&1 | tail -5
        cd ..
    fi
done

# Step 6: Start dev servers in background
echo ""
echo "▶️  Step 6/7: 启动开发服务器..."

# Kill existing processes
pkill -f "vite.*8080" || true
pkill -f "vite.*8081" || true  
pkill -f "vite.*8082" || true
pkill -f "vite.*8083" || true

# Start eiscore-apps
cd /home/lzr/eiscore/eiscore-apps
nohup npm run dev > ../logs/eiscore-apps.log 2>&1 &
echo "   ✅ eiscore-apps 已启动 (PID: $!)"

sleep 2

# Start other apps if needed
# cd /home/lzr/eiscore/eiscore-base
# nohup npm run dev > ../logs/base.log 2>&1 &

echo ""
echo "✅ 部署完成！"
echo ""
echo "🔍 Step 7/7: 检查服务状态..."
echo ""
echo "📊 服务状态："
echo "   Docker 服务："
docker-compose ps

echo ""
echo "   前端服务："
ps aux | grep -E "vite.*(8080|8081|8082|8083)" | grep -v grep || echo "   检查 logs/eiscore-apps.log"

echo ""
echo "🌐 访问地址："
echo "   应用中心开发服务器：http://localhost:8083"
echo "   (需要基座应用时启动 eiscore-base)"
echo ""
echo "📝 查看日志："
echo "   tail -f logs/eiscore-apps.log"
echo "   docker-compose logs -f agent-runtime"
echo ""
