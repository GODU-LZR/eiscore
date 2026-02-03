#!/bin/bash

# --- 配置区 ---
DEFAULT_MSG="自动归档: 更新代码及数据库结构"
SQL_FILE="env/db_schema_and_data.sql"
# --- 配置结束 ---

# 1. 获取提交信息
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="$DEFAULT_MSG - $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo -e "\n🚀 \033[36m开始自动归档流程...\033[0m"

# 2. 导出数据库
echo -e "💾 \033[33m正在导出数据库结构和数据...\033[0m"
docker compose exec -T db pg_dump -U postgres -d eiscore > "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo -e "✅ \033[32m数据库导出成功！\033[0m"
else
    echo -e "❌ \033[31m数据库导出失败！\033[0m"
    exit 1
fi

# 3. Git 提交 (本地)
echo -e "📦 \033[33m正在提交到本地 Git...\033[0m"
git add .
git commit -m "$COMMIT_MSG"

# 4. 结束
echo -e "\n✅ \033[32m本地提交完成（未执行远程推送）。\033[0m"
