#!/bin/bash

# --- 配置区 ---
# 默认提交信息 (如果执行脚本时不带参数，就用这个)
DEFAULT_MSG="自动归档: 更新代码及数据库结构"
# 导出的SQL文件名
SQL_FILE="db_schema_and_data.sql"
# --- 配置结束 ---

# 1. 获取提交信息
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="$DEFAULT_MSG - $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo -e "\n🚀 \033[36m开始自动归档流程...\033[0m"

# 2. 导出数据库 (关键步骤)
echo -e "💾 \033[33m正在导出数据库结构和数据...\033[0m"
# 注意：这里加了 -T 参数避免脚本执行时的 TTY 错误
docker compose exec -T db pg_dump -U postgres -d eiscore > "$SQL_FILE"

# 检查导出是否成功
if [ $? -eq 0 ]; then
    echo -e "✅ \033[32m数据库导出成功！已保存为 $SQL_FILE\033[0m"
else
    echo -e "❌ \033[31m数据库导出失败！请检查 Docker 容器是否在运行。\033[0m"
    exit 1
fi

# 3. Git 添加和提交
echo -e "📦 \033[33m正在提交到 Git...\033[0m"
git add .
git commit -m "$COMMIT_MSG"

# 4. 结束
if [ $? -eq 0 ]; then
    echo -e "\n🎉 \033[32m大功告成！所有更改已归档。\033[0m"
    echo -e "📝 提交记录: $COMMIT_MSG\n"
else
    echo -e "\n⚠️ \033[33m没有需要提交的更改 (或者 Git 报错了)。\033[0m\n"
fi
