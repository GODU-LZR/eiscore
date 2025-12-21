#!/bin/bash

# --- 配置区 ---
DEFAULT_MSG="自动归档: 更新代码及数据库结构"
SQL_FILE="db_schema_and_data.sql"
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

# 4. Git 推送 (远程) - 🟢 新增步骤
echo -e "☁️  \033[33m正在推送到 GitHub...\033[0m"
git push

# 5. 结束
if [ $? -eq 0 ]; then
    echo -e "\n🎉 \033[32m大功告成！代码已同步到 GitHub。\033[0m"
else
    echo -e "\n⚠️ \033[33m本地提交成功，但推送到 GitHub 失败（请检查网络或权限）。\033[0m\n"
fi
